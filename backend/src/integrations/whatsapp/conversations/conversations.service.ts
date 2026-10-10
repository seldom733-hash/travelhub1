import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { Prisma } from "../../../generated/prisma/client";
import type {
  BookingStatus,
  OrderStatus,
  RequestStatus,
  WhatsAppMatchingStatus,
  WhatsAppOutboundStatus,
} from "../../../generated/prisma/enums";
import { WHATSAPP_CONFIG } from "../whatsapp.tokens";
import type { WhatsAppConfig } from "../whatsapp.config";
import {
  findCustomerIdsByCanonicalPhone,
  resolveCustomer,
} from "../../../shared/customer-resolver/customer-resolver";
import { normalizePhoneE164 } from "../../../shared/phone/phone";
import { normalizeEmail } from "../../../shared/field-validation";
import { CrmService } from "../../../modules/crm/crm.service";
import { ActivationService } from "../../../security/activation.service";

/**
 * M3 «Inbound & Chat» (§13/§14/§18/§24/§25): операции диалогов.
 *
 * Непрерывная история (§14): timeline собирается из inbound/outbound-строк,
 * ссылающихся на WhatsAppConversation; Communication — ОДНА на сообщение,
 * ничего не копируется. Conversion Request→Order→Booking меняет только
 * резолвимый бизнес-контекст (§13: Booking→Order→Request→Customer,
 * читается на лету) — набор строк истории не меняется.
 *
 * §4: CommunicationThread (pre-sale, buyerRequestId NOT NULL) НЕ
 * используется и не изменяется.
 */

/** §13: текущий бизнес-контекст диалога (приоритет Booking→Order→Request→Customer). */
export interface ResolvedContext {
  readonly type: "BOOKING" | "ORDER" | "REQUEST" | "CUSTOMER";
  readonly id: string;
  readonly code: string;
  readonly status: string | null;
}

export interface ConversationListRow {
  readonly id: string;
  /** M5: номер, которому принадлежит диалог (бейдж/фильтр в инбоксе). */
  readonly accountId: string;
  readonly remoteJid: string;
  readonly canonicalPhone: string | null;
  readonly matchingStatus: WhatsAppMatchingStatus;
  readonly customerId: string | null;
  readonly lastMessageAt: Date | null;
  readonly lastMessagePreview: string | null;
  readonly lastReadAt: Date | null;
  readonly unreadCount: number;
  readonly suppressed: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CustomerRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly email: string;
}

export interface ConversationDetail extends ConversationListRow {
  readonly customer: CustomerRef | null;
  readonly candidates: readonly CustomerRef[];
  readonly context: ResolvedContext | null;
}

/** M4.4 §18: вход onboarding первого контакта WhatsApp (collect → re-resolve → create/reuse). */
export interface OnboardCustomerInput {
  /** Обязательная контактная информация: email — unique-ключ Customer (§18). */
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  /** Override канонического телефона; по умолчанию — conversation.canonicalPhone. */
  readonly phone?: string;
  /** Опциональная активация существующего User (механика §19; без регистрации). */
  readonly activateUser?: boolean;
}

export interface OnboardCustomerResult {
  readonly conversation: ConversationDetail;
  readonly customerId: string;
  readonly created: boolean;
  readonly user: { readonly id: string; readonly status: string } | null;
  readonly activation: { readonly token: string; readonly expiresAt: string } | null;
}

export interface TimelineItem {
  readonly id: string;
  readonly origin: "inbound" | "outbound";
  readonly direction: "INBOUND" | "OUTBOUND";
  readonly body: string | null;
  readonly messageType: string;
  readonly occurredAt: Date;
  readonly communicationCode: string | null;
  readonly providerMessageId: string | null;
  /** M3+: вложение (файл) — имя/размер для чипа в ленте. */
  readonly mediaFilename: string | null;
  /** M5: mime вложения — фронт различает аудио/видео/документ. */
  readonly mediaMime: string | null;
  readonly mediaSize: number | null;
  readonly hasMedia: boolean;
  /** Только для outbound: integration lifecycle (M0-05) + receipt-факты. */
  readonly status: WhatsAppOutboundStatus | null;
  readonly sentAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly readAt: Date | null;
}

/** Терминальные статусы для резолва активного контекста (§13). */
const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["CLOSED", "CANCELLED"];
const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "SUPPLIER_REJECTED",
];
const TERMINAL_REQUEST_STATUSES: readonly RequestStatus[] = [
  "CONVERTED",
  "REJECTED",
  "UNAVAILABLE",
  "EXPIRED",
  "CANCELLED_BY_CUSTOMER",
  "CUSTOMER_PAYMENT_TIMEOUT",
];

@Injectable()
export class WhatsAppConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    private readonly crm: CrmService,
    private readonly activation: ActivationService,
  ) {}

  /** §25 list: сортировка по последнему сообщению, unread = входящие новее lastReadAt.
   *  M5: accountId — фильтр по номеру (undefined → все номера, архив включён). */
  async list(
    limit = 50,
    matchingStatus?: WhatsAppMatchingStatus,
    accountId?: string,
  ): Promise<ConversationListRow[]> {
    const take = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.whatsAppConversation.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        ...(matchingStatus ? { matchingStatus } : {}),
      },
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      take,
    });
    return Promise.all(rows.map((row) => this.toListRow(row)));
  }

  /** §25 detail: customer + AMBIGUOUS-кандидаты + контекст §13 + suppression. */
  async detail(conversationId: string): Promise<ConversationDetail> {
    const row = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!row) throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    const listRow = await this.toListRow(row);

    const customer = row.customerId ? await this.customerRef(row.customerId) : null;
    const candidates: CustomerRef[] = [];
    if (row.matchingStatus === "AMBIGUOUS" && row.canonicalPhone) {
      const ids = await findCustomerIdsByCanonicalPhone(
        this.prisma,
        row.canonicalPhone,
        this.config.defaultPhoneRegion,
      );
      for (const id of ids) {
        const ref = await this.customerRef(id);
        if (ref) candidates.push(ref);
      }
    }
    const context = row.customerId ? await this.resolveContext(row.customerId) : null;
    const resolvedContext =
      context && context.type === "CUSTOMER" && context.code === "" && customer
        ? { ...context, code: customer.code }
        : context;
    return { ...listRow, customer, candidates, context: resolvedContext };
  }

  /** §25 messages: merged timeline (inbound + outbound) одной историей (§14). */
  async timeline(conversationId: string, limit = 100): Promise<TimelineItem[]> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    const take = Math.min(Math.max(Math.trunc(limit), 1), 200);

    const [inboundRows, outboundRows] = await Promise.all([
      this.prisma.whatsAppInboundMessage.findMany({
        where: { conversationId },
        orderBy: { occurredAt: "desc" },
        take,
      }),
      this.prisma.whatsAppOutboundMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    const communicationIds = [
      ...inboundRows.map((row) => row.communicationId),
      ...outboundRows.map((row) => row.communicationId),
    ].filter((id): id is string => id !== null);
    const communications =
      communicationIds.length > 0
        ? await this.prisma.communication.findMany({
            where: { id: { in: communicationIds } },
            select: {
              id: true,
              code: true,
              body: true,
              direction: true,
              occurredAt: true,
            },
          })
        : [];
    const commById = new Map(communications.map((row) => [row.id, row]));
    // §8: inbound-эхо известного outbound ссылается на ТУ ЖЕ Communication —
    // в таймлайне она уже представлена outbound-строкой (без дублей).
    const outboundCommIds = new Set(outboundRows.map((row) => row.communicationId));

    const items: TimelineItem[] = [];

    for (const row of inboundRows) {
      if (row.communicationId && outboundCommIds.has(row.communicationId)) continue;
      const comm = row.communicationId ? commById.get(row.communicationId) : undefined;
      items.push({
        id: row.id,
        origin: "inbound",
        direction:
          comm && comm.direction !== "INTERNAL"
            ? comm.direction
            : row.fromMe
              ? "OUTBOUND"
              : "INBOUND",
        body: comm ? comm.body : row.text,
        messageType: row.messageType,
        occurredAt: comm?.occurredAt ?? row.occurredAt,
        communicationCode: comm?.code ?? null,
        providerMessageId: row.providerMessageId,
        mediaFilename: row.mediaFilename,
        mediaMime: row.mediaMime,
        mediaSize: row.mediaSize,
        hasMedia: row.mediaMime !== null || row.mediaPath !== null || row.mediaFilename !== null,
        status: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      });
    }

    for (const row of outboundRows) {
      const comm = row.communicationId ? commById.get(row.communicationId) : undefined;
      items.push({
        id: row.id,
        origin: "outbound",
        direction: "OUTBOUND",
        body: comm?.body ?? null,
        messageType: row.mediaFilename !== null || row.mediaPath !== null ? "document" : "text",
        occurredAt: comm?.occurredAt ?? row.createdAt,
        communicationCode: comm?.code ?? null,
        providerMessageId: row.providerMessageId,
        mediaFilename: row.mediaFilename,
        mediaMime: row.mediaMime,
        mediaSize: row.mediaSize,
        hasMedia: row.mediaMime !== null || row.mediaPath !== null || row.mediaFilename !== null,
        status: row.status,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
      });
    }

    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return items.slice(0, take).reverse();
  }

  /**
   * §25 link-customer / resolve: ручной выбор Customer для UNMATCHED/AMBIGUOUS.
   * Аудит §24: whatsapp.customer_linked с old/new state (без PII в details).
   * Прошлые сообщения диалога без контекста получают contextType=CUSTOMER
   * (только pointer, сами строки/история не переписываются).
   */
  async linkCustomer(
    conversationId: string,
    customerId: string,
    actor: { id: string; username?: string | null },
  ): Promise<ConversationDetail> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, phone: true },
    });
    if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);
    if (
      conversation.matchingStatus === "MATCHED" &&
      conversation.customerId === customerId
    ) {
      return this.detail(conversationId); // идемпотентный no-op
    }
    // LID-маскировка: у диалога без canonicalPhone подставляем номер клиента —
    // UI показывает номер, а не `…@lid` (§10, E.164 через нормализацию).
    const backfillPhone =
      conversation.canonicalPhone ??
      normalizePhoneE164(customer.phone, this.config.defaultPhoneRegion);

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          customerId,
          matchingStatus: "MATCHED",
          matchedAt: new Date(),
          ...(conversation.canonicalPhone === null && backfillPhone
            ? { canonicalPhone: backfillPhone }
            : {}),
        },
      });
      await tx.whatsAppContact.upsert({
        where: { accountId_jid: { accountId: conversation.accountId, jid: conversation.remoteJid } },
        create: {
          accountId: conversation.accountId,
          jid: conversation.remoteJid,
          canonicalPhone: backfillPhone,
          customerId,
          linkSource: "MANUAL",
        },
        update: { customerId, linkSource: "MANUAL", ...(backfillPhone ? { canonicalPhone: backfillPhone } : {}) },
      });

      // Pointer-бэкфилл прошлых сообщений диалога без контекста (§14: сами
      // строки истории не меняются — только их business-context указатель).
      const commIds = (
        await Promise.all([
          tx.whatsAppInboundMessage.findMany({
            where: { conversationId },
            select: { communicationId: true },
          }),
          tx.whatsAppOutboundMessage.findMany({
            where: { conversationId },
            select: { communicationId: true },
          }),
        ])
      )
        .flat()
        .map((row) => row.communicationId)
        .filter((id): id is string => id !== null);
      if (commIds.length > 0) {
        await tx.communication.updateMany({
          where: { id: { in: commIds }, contextType: null },
          data: { contextType: "CUSTOMER", contextId: customerId },
        });
      }

      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.customer_linked",
        resource: "WhatsAppConversation",
        resourceId: conversationId,
        details: {
          fromCustomerId: conversation.customerId,
          toCustomerId: customerId,
          fromMatchingStatus: conversation.matchingStatus,
          toMatchingStatus: "MATCHED",
        },
      });
    });

    return this.detail(conversationId);
  }

  /**
   * §10 LID→PN: ручной бинд номера собеседника к lid-диалогу («Привязать Lid
   * к номеру») — оператор вводит номер ДО определения Customer. Диалог после
   * бинда показывает номер (peerLabel), Customer НЕ создаётся и НЕ связывается
   * автоматически (link-customer остаётся отдельной операцией).
   *
   * Правила:
   *  - только диалоги, у которых номер не разрешён: canonicalPhone=null И
   *    remoteJid заканчивается на @lid (иначе 409 — номер уже известен);
   *  - номер нормализуется в E.164 shared-нормализатором; невалидный → 422;
   *  - 409, если номер уже привязан к ДРУГОМУ диалогу того же аккаунта;
   *  - WhatsAppContact обновляется (linkSource=MANUAL); matchingStatus,
   *    customerId и история НЕ меняются;
   *  - audit `whatsapp.phone_bound` (без PII в details).
   */
  async bindPhone(
    conversationId: string,
    phone: string,
    actor: { id: string; username?: string | null },
  ): Promise<ConversationDetail> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    if (conversation.canonicalPhone !== null) {
      throw new ConflictError("Conversation already has a resolved phone number");
    }
    if (!conversation.remoteJid.endsWith("@lid")) {
      throw new ConflictError("Conversation is not a LID conversation");
    }

    const canonicalPhone = normalizePhoneE164(phone, this.config.defaultPhoneRegion);
    if (!canonicalPhone) {
      throw new ValidationDomainError("Phone number is not a valid E.164 number");
    }

    const duplicate = await this.prisma.whatsAppConversation.findFirst({
      where: {
        accountId: conversation.accountId,
        canonicalPhone,
        id: { not: conversationId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError("Phone number is already bound to another conversation");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({
        where: { id: conversationId },
        data: { canonicalPhone },
      });
      await tx.whatsAppContact.upsert({
        where: { accountId_jid: { accountId: conversation.accountId, jid: conversation.remoteJid } },
        create: {
          accountId: conversation.accountId,
          jid: conversation.remoteJid,
          canonicalPhone,
          linkSource: "MANUAL",
        },
        update: { canonicalPhone, linkSource: "MANUAL" },
      });

      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.phone_bound",
        resource: "WhatsAppConversation",
        resourceId: conversationId,
        details: { fromLid: true, manual: true },
      });
    });

    return this.detail(conversationId);
  }

  /**
   * M4.2 — unlink: ручное снятие связи Customer ↔ диалог (аддитивный
   * endpoint, `whatsapp.manage` + audit §24-стиля).
   *
   * Правила:
   *  - снимается связь диалога (customerId=null, matchedAt=null) И контактная
   *    связь WhatsAppContact.customerId — иначе fast-path авто-связки на
   *    следующем входящем сообщении вернул бы её немедленно;
   *  - matchingStatus пересчитывается по текущему canonicalPhone через общий
   *    resolver: >1 владельцев → AMBIGUOUS, иначе UNMATCHED;
   *  - история НЕ переписывается: прошлые Communication-указатели
   *    (contextType=CUSTOMER) и строки inbound/outbound остаются как есть
   *    (M3 link/unlink — только связь, не правка истории);
   *  - audit `whatsapp.customer_unlinked` с actor и old/new state (без PII);
   *  - идемпотентно: уже разъединённый диалог → no-op + detail;
   *  - ограничение (M3 semantics frozen): следующее входящее сообщение с
   *    валидным каноническим телефоном МОЖЕТ заново автоматически связать
   *    диалог (0/1 → MATCHED) — unlink отменяет текущую связь, а не вечный
   *    запрет phone-матчинга (permanent-запрет — отдельное решение M4.6+).
   */
  async unlinkCustomer(
    conversationId: string,
    actor: { id: string; username?: string | null },
  ): Promise<ConversationDetail> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    if (conversation.customerId === null) return this.detail(conversationId); // идемпотентный no-op

    let nextStatus: WhatsAppMatchingStatus = "UNMATCHED";
    if (conversation.canonicalPhone) {
      const owners = await findCustomerIdsByCanonicalPhone(
        this.prisma,
        conversation.canonicalPhone,
        this.config.defaultPhoneRegion,
      );
      if (owners.length > 1) nextStatus = "AMBIGUOUS";
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({
        where: { id: conversationId },
        data: { customerId: null, matchingStatus: nextStatus, matchedAt: null },
      });
      await tx.whatsAppContact.updateMany({
        where: {
          accountId: conversation.accountId,
          jid: conversation.remoteJid,
          customerId: { not: null },
        },
        data: { customerId: null },
      });

      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.customer_unlinked",
        resource: "WhatsAppConversation",
        resourceId: conversationId,
        details: {
          fromCustomerId: conversation.customerId,
          fromMatchingStatus: conversation.matchingStatus,
          toMatchingStatus: nextStatus,
        },
      });
    });

    return this.detail(conversationId);
  }

  /**
   * M4.4 §18 — WhatsApp first contact onboarding:
   *
   *   UNMATCHED → collect required info → re-resolve (общий resolver) →
   *   create/reuse Customer → link диалога → optionally activate User.
   *
   * Правила (§10/§18, owner decision option B):
   *  - re-resolve — общий channel-independent resolver (не WhatsApp-копия):
   *    phone (conversation.canonicalPhone или override) + email (обязательный
   *    unique-ключ Customer); 0 → create, 1 → reuse, >1 → AMBIGUOUS → 409
   *    (ручной выбор через link-customer, никогда не auto-merge);
   *  - creation — CRM-owned (CrmService.createCustomer: code-sequence, history,
   *    CustomerCreated event, M4.2 duplicate-гарды) — WhatsApp не пишет в crm.*
   *    напрямую;
   *  - ручной link уважается: диалог уже связанный с ДРУГИМ customer → 409
   *    (unlink вручную, затем onboarding);
   *  - активация опциональна и только для СУЩЕСТВУЮЩЕГО User с loginPhone =
   *    canonical phone (§18 «optionally activate User»): механика токена §19
   *    (issue → operator передаёт out-of-band, delivery отложен). Website-
   *    регистрация НЕ форсируется, пароли НЕ изобретаются (user не создаётся);
   *  - audit `whatsapp.customer_onboarded` (метаданные, без PII/секретов);
   *  - история диалога не переписывается (linkCustomer — pointer-бэкфилл §14).
   */
  async onboardCustomer(
    conversationId: string,
    input: OnboardCustomerInput,
    actor: { id: string; username?: string | null },
  ): Promise<OnboardCustomerResult> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }

    // Телефон первого контакта: override или номер диалога; без номера —
    // не угадываем (только collected email не является ключом телефона).
    const phone = normalizePhoneE164(
      input.phone ?? conversation.canonicalPhone,
      this.config.defaultPhoneRegion,
    );
    if (!phone) {
      throw new ValidationDomainError(
        "Phone number is required for onboarding (conversation has no canonical phone)",
      );
    }

    // Re-resolve общим resolver после collected информации (§18).
    const resolved = await resolveCustomer(
      this.prisma,
      { phone, email: input.email },
      this.config.defaultPhoneRegion,
    );
    if (resolved.status === "AMBIGUOUS") {
      // Без PII в сообщении: ручной выбор через link-customer (§25).
      throw new ConflictError("Multiple customers match this phone — choose manually");
    }
    if (conversation.customerId !== null && conversation.customerId !== resolved.customerId) {
      throw new ConflictError("Conversation is already linked to a different customer — unlink first");
    }

    let customerId = resolved.customerId;
    let created = false;
    if (customerId === null) {
      const result = await this.crm.createCustomer(
        {
          type: "PERSON",
          firstName: input.firstName,
          lastName: input.lastName,
          email: normalizeEmail(input.email),
          phone,
        },
        actor.username ?? undefined,
      );
      customerId = result.customer.id;
      created = true;
    }

    // Link: contact upsert + pointer-бэкфилл истории + audit customer_linked.
    if (conversation.customerId !== customerId) {
      await this.linkCustomer(conversationId, customerId, actor);
    }

    // Опциональная активация СУЩЕСТВУЮЩЕГО User (loginPhone = canonical phone).
    // User не создаётся: нет доставки/пароля (option B), регистрация не форсируется.
    let user: { readonly id: string; readonly status: string } | null = null;
    let activation: { readonly token: string; readonly expiresAt: string } | null = null;
    const loginUser = await this.prisma.user.findUnique({
      where: { loginPhone: phone },
      select: { id: true, status: true },
    });
    if (loginUser) {
      user = { id: loginUser.id, status: loginUser.status };
      if (input.activateUser && loginUser.status !== "ACTIVE") {
        const issued = await this.activation.issue(loginUser.id, {
          id: actor.id,
          username: actor.username ?? "system",
        });
        activation = { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
      }
    }

    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.customer_onboarded",
      resource: "WhatsAppConversation",
      resourceId: conversationId,
      details: {
        customerId,
        created,
        resolvedSource: resolved.source,
        userId: user?.id ?? null,
        activationIssued: activation !== null,
      },
    });

    return {
      conversation: await this.detail(conversationId),
      customerId,
      created,
      user,
      activation,
    };
  }

  /** §25 read: база непрочитанных (unread count §18). */
  async markRead(conversationId: string): Promise<{ lastReadAt: Date }> {
    const exists = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    const lastReadAt = new Date();
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastReadAt },
    });
    return { lastReadAt };
  }

  /**
   * §25 ручной поиск клиента для link-customer: код/имя/email (case-insensitive)
   * ИЛИ телефон (канонический E.164, та же read-only нормализация, что в §10).
   * Без CRM Marketplace-scope фильтра — это WhatsApp-операционный поиск.
   */
  async searchCustomers(search: string): Promise<CustomerRef[]> {
    const q = search.trim();
    if (q.length === 0) return [];
    const canonical = normalizePhoneE164(q, this.config.defaultPhoneRegion);
    const phoneIds = canonical
      ? new Set(
          await findCustomerIdsByCanonicalPhone(this.prisma, canonical, this.config.defaultPhoneRegion),
        )
      : new Set<string>();
    const textRows = await this.prisma.customer.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const ids = [...new Set([...phoneIds, ...textRows.map((row) => row.id)])].slice(0, 10);
    const refs: CustomerRef[] = [];
    for (const id of ids) {
      const ref = await this.customerRef(id);
      if (ref) refs.push(ref);
    }
    return refs;
  }

  /**
   * §13: активный бизнес-контекст Customer (приоритет Booking→Order→
   * Request→Customer). НИЧЕГО не переписывает — читает на лету.
   */
  async resolveContext(customerId: string): Promise<ResolvedContext | null> {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      select: { id: true, code: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    const activeOrders = orders.filter((order) => !TERMINAL_ORDER_STATUSES.includes(order.status));
    if (activeOrders.length > 0) {
      const bookings = await this.prisma.booking.findMany({
        where: {
          orderId: { in: activeOrders.map((order) => order.id) },
          status: { notIn: [...TERMINAL_BOOKING_STATUSES] },
        },
        select: { id: true, code: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      const booking = bookings[0];
      if (booking) {
        return { type: "BOOKING", id: booking.id, code: booking.code, status: booking.status };
      }
      const order = activeOrders[0];
      return { type: "ORDER", id: order.id, code: order.code, status: order.status };
    }

    const request = await this.prisma.request.findFirst({
      where: {
        customerId,
        // Stage 1 (Order → Request): активная заявка с link (returned из
        // Order) снова становится текущим контекстом переписки. CONVERTED
        // отфильтрован статусом (терминальный для коммуникации), поэтому
        // link-фильтр `convertedOrderId: null` больше не нужен.
        status: { notIn: [...TERMINAL_REQUEST_STATUSES] },
      },
      select: { id: true, code: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (request) {
      return { type: "REQUEST", id: request.id, code: request.code, status: request.status };
    }
    return { type: "CUSTOMER", id: customerId, code: "", status: null };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async toListRow(row: {
    id: string;
    accountId: string;
    remoteJid: string;
    canonicalPhone: string | null;
    matchingStatus: WhatsAppMatchingStatus;
    customerId: string | null;
    lastMessageAt: Date | null;
    lastMessagePreview: string | null;
    lastReadAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<ConversationListRow> {
    const since = row.lastReadAt ?? new Date(0);
    const unreadCount = await this.prisma.whatsAppInboundMessage.count({
      where: {
        conversationId: row.id,
        fromMe: false,
        occurredAt: { gt: since },
      },
    });
    const suppressed = row.canonicalPhone
      ? (await this.prisma.whatsAppSuppression.findUnique({
          where: { canonicalPhone: row.canonicalPhone },
          select: { id: true },
        })) !== null
      : false;
    return {
      id: row.id,
      accountId: row.accountId,
      remoteJid: row.remoteJid,
      canonicalPhone: row.canonicalPhone,
      matchingStatus: row.matchingStatus,
      customerId: row.customerId,
      lastMessageAt: row.lastMessageAt,
      lastMessagePreview: row.lastMessagePreview,
      lastReadAt: row.lastReadAt,
      unreadCount,
      suppressed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async customerRef(customerId: string): Promise<CustomerRef | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, firstName: true, lastName: true, companyName: true, email: true },
    });
    if (!customer) return null;
    const name =
      customer.companyName ??
      [customer.firstName, customer.lastName].filter((part) => part).join(" ") ??
      "";
    return {
      id: customer.id,
      code: customer.code,
      name: name || customer.email,
      email: customer.email,
    };
  }
}
