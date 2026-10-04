import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SecurityService } from "../../../security/security.service";
import { normalizePhoneE164 } from "../../../shared/phone/phone";
import { getRequestContext } from "../../../shared/request-context";
import { uniqueConstraintNames } from "../../../shared/prisma-errors";
import type { Prisma } from "../../../generated/prisma/client";
import type {
  WhatsAppInboundProcessingStatus,
  WhatsAppMatchingStatus,
} from "../../../generated/prisma/enums";
import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "../whatsapp.tokens";
import type { WhatsAppConfig } from "../whatsapp.config";
import { WhatsAppMediaStorage } from "../media/whatsapp-media.storage";
import type {
  WhatsAppInboundMedia,
  WhatsAppInboundProviderMessage,
  WhatsAppProvider,
} from "../provider/whatsapp-provider";

/**
 * M3 «Inbound & Chat» (промпт M3 §5–§12): приём входящих событий провайдера.
 *
 * Канонический поток processInbound:
 *   валидация → В ОДНОЙ транзакции: dedup-gate (canonical unique
 *   (accountId, providerMessageId), §7) → ensure WhatsAppConversation (§4) →
 *   сопоставление с Customer (§10: 0/1/>1 → UNMATCHED/MATCHED/AMBIGUOUS) →
 *   Communication (channel=WHATSAPP, direction=INBOUND, ОДНА история) →
 *   обновление inbound-строки/диалога → после commit: suppression-hook §22.
 *
 * Идемпотентность (§5/§7): повторная доставка того же providerMessageId
 * (в т.ч. конкурентная) → P2002 на dedup-gate → вся транзакция откатывается,
 * возвращается { outcome: "duplicate" }, ВТОРОЕ событие/Communication не
 * создаётся. Продолжать tx после P2002 нельзя (PostgreSQL 25P02).
 *
 * fromMe=true (§8): echo ЭТОГО же провайдерского id — строка inbound
 * связывается с существующей Communication отправленного сообщения БЕЗ
 * второй копии; неизвестный TravelHUB (отправлен с телефона вне HUB) →
 * отдельная Communication OUTBOUND (marker «sentOutsideTravelHub» —
 * сама inbound-строка с fromMe=true; отдельного поля в Communication нет).
 *
 * Медиа/пустые (§21): строка inbound сохраняется (messageType/text),
 * Communication НЕ создаётся → processingStatus=SKIPPED; сырые провайдерные
 * события (raw metadata) не сохраняются (I2).
 */

export type InboundProcessResult =
  | { readonly outcome: "invalid" }
  | { readonly outcome: "duplicate" }
  | {
      readonly outcome: "persisted";
      readonly inboundId: string;
      readonly conversationId: string;
      readonly communicationId: string | null;
      readonly matchingStatus: WhatsAppMatchingStatus;
      readonly processingStatus: WhatsAppInboundProcessingStatus;
      readonly suppressed: boolean;
    };

/** M3 §22: inbound STOP-ключевые слова (точное совпадение, без угадывания). */
const STOP_KEYWORDS = new Set(["STOP", "СТОП", "UNSUBSCRIBE"]);

/** Нормализует текст и возвращает STOP-ключевое слово либо null. */
export function detectStopKeyword(text: string | null | undefined): string | null {
  const normalized = (text ?? "").trim().toUpperCase();
  return STOP_KEYWORDS.has(normalized) ? normalized : null;
}

/** Извлекает канонический E.164 из провайдерного события (§10, read-only). */
export function extractCanonicalPhone(
  message: Pick<WhatsAppInboundProviderMessage, "remoteJid" | "senderPn">,
  defaultRegion: string,
): string | null {
  const jidMatch = /^(\d{7,15})(?::\d+)?@s\.whatsapp\.net$/.exec(message.remoteJid);
  if (jidMatch) return normalizePhoneE164(jidMatch[1], defaultRegion);
  // LID-адресация: remoteJid = `<digits>@lid`, номер даёт только senderPn
  // (Baileys WAMessageKey.senderPn либо USync-резолв в провайдере). Группам
  // и broadcast номер участника НЕ якорь диалога (§4) — fallback не применяется.
  if (message.senderPn && message.remoteJid.endsWith("@lid")) {
    // Форматы: `99450…@s.whatsapp.net`, `99450…:12@s.whatsapp.net`, голые цифры.
    const bare = message.senderPn.split("@")[0].split(":")[0];
    return normalizePhoneE164(bare, defaultRegion);
  }
  return null;
}

/** Нормализация на лету: все Customer.phone сверяются в E.164 в памяти
 * (read-only, без индексов/backfill — §10; v1: полный scan, объём CRM мал). */
export async function findCustomerIdsByCanonicalPhone(
  tx: Prisma.TransactionClient,
  canonicalPhone: string,
  defaultRegion: string,
): Promise<string[]> {
  const rows = await tx.customer.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  return rows
    .filter((row) => normalizePhoneE164(row.phone, defaultRegion) === canonicalPhone)
    .map((row) => row.id);
}

@Injectable()
export class WhatsAppInboundService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly provider: WhatsAppProvider | null;
  private readonly media: WhatsAppMediaStorage;
  private unsubscribeInbound: (() => void) | null = null;
  /** FIFO-очередь: события применяются в порядке emission (как в runtime). */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    @Optional() @Inject(WHATSAPP_PROVIDER) provider: WhatsAppProvider | null,
  ) {
    this.provider = provider;
    this.media = new WhatsAppMediaStorage(config.mediaDir ?? ".whatsapp-media");
  }

  onApplicationBootstrap(): void {
    if (!this.config.enabled || !this.provider) return;
    this.unsubscribeInbound = this.provider.onInbound((message) => {
      // Обработчик события не должен ронять провайдерный event-loop (§5);
      // FIFO-очередь сохраняет порядок emission.
      this.queue = this.queue.then(async () => {
        try {
          await this.processInbound(message);
        } catch (error) {
          console.error("[whatsapp] inbound processing failed", {
            providerMessageId: message.providerMessageId,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      });
    });
  }

  onApplicationShutdown(): void {
    this.unsubscribeInbound?.();
    this.unsubscribeInbound = null;
  }

  /**
   * Синхронная обработка одного события (§5); используется подпиской выше
   * и тестами напрямую (await → результат детерминирован).
   */
  async processInbound(message: WhatsAppInboundProviderMessage): Promise<InboundProcessResult> {
    const providerMessageId = message.providerMessageId?.trim();
    const remoteJid = message.remoteJid?.trim();
    if (!providerMessageId || !remoteJid) return { outcome: "invalid" };

    const accountId = await this.ensureAccountId();
    let canonicalPhone = extractCanonicalPhone(message, this.config.defaultPhoneRegion);
    if (canonicalPhone === null) {
      // LID-маскировка: номер не в stanza — сверяем CRM-кандидатов (pn→lid).
      canonicalPhone = await this.resolveLidViaCrm(remoteJid);
    }
    const bodyText = (message.text ?? "").trim();
    // M3+: файл — метаданные stanza (filename/mimetype/size) + байты.
    // Байты отдельно (download мог не успеть/упасть) — сообщение не теряется.
    const mediaMeta = message.media ?? null;
    const hasMediaFile = message.type !== "text" && message.type !== "other" && mediaMeta !== null;
    const supported = (message.type === "text" && bodyText.length > 0) || hasMediaFile;
    // Preview списка: caption, иначе имя файла, иначе [type]; body Communication
    // остаётся caption (у файла без подписи — пустой, чип в ленте покажет файл).
    const previewText =
      bodyText.length > 0
        ? bodyText
        : hasMediaFile
          ? mediaMeta.filename ?? message.type
          : "";
    const processingStatus: WhatsAppInboundProcessingStatus = supported ? "PROCESSED" : "SKIPPED";
    const mediaPath = await this.saveInboundMedia(providerMessageId, mediaMeta);

    // §8: echo известного outbound → связываем, ВТОРАЯ копия не создаётся.
    const knownOutbound = message.fromMe
      ? await this.prisma.whatsAppOutboundMessage.findUnique({
          where: { providerMessageId },
          select: { communicationId: true, conversationId: true, recipientJid: true },
        })
      : null;

    let suppressed = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1) Dedup-gate §7 (первый оператор: P2002 → rollback всего tx).
        const inbound = await tx.whatsAppInboundMessage.create({
          data: {
            accountId,
            remoteJid,
            fromMe: message.fromMe,
            providerMessageId,
            participant: message.participant ?? null,
            lid: message.lid ?? null,
            senderPn: message.senderPn ?? null,
            occurredAt: message.occurredAt,
            messageType: message.type,
            text: bodyText.length > 0 ? bodyText : null,
            mediaFilename: hasMediaFile ? mediaMeta.filename : null,
            mediaMime: hasMediaFile ? mediaMeta.mimetype : null,
            mediaSize: hasMediaFile ? mediaMeta.size : null,
            mediaPath,
            canonicalPhone,
            processingStatus,
          },
          select: { id: true },
        });

        // 2) Ветвление §8 (fromMe) / inbound-пайплайн.
        if (message.fromMe && knownOutbound) {
          return this.persistKnownOutboundEcho(tx, {
            inboundId: inbound.id,
            knownOutbound,
            fallbackJid: remoteJid,
            accountId,
            canonicalPhone,
            bodyText: previewText,
            supported,
            occurredAt: message.occurredAt,
          });
        }

        // 3) Ensure conversation (якорь истории, §4) + сопоставление §10.
        let conversation = await this.ensureConversation(tx, accountId, remoteJid, canonicalPhone);
        let matchingStatus = conversation.matchingStatus;
        if (message.fromMe) {
          // Вне-HUB: сообщение отправлено с телефона, TravelHUB его не создавал.
          const communicationId = supported
            ? await this.createCommunication(tx, {
                direction: "OUTBOUND",
                senderType: "SYSTEM",
                senderId: null,
                recipientType: "CUSTOMER",
                recipientId: conversation.customerId,
                contextId: conversation.customerId,
                body: bodyText,
                occurredAt: message.occurredAt,
                actorUserId: null,
              })
            : null;
          await tx.whatsAppInboundMessage.update({
            where: { id: inbound.id },
            data: {
              conversationId: conversation.id,
              communicationId,
              matchingStatus,
            },
          });
          if (supported || message.type !== "text") {
            await this.touchConversation(
              tx,
              conversation.id,
              message.occurredAt,
              supported ? previewText.slice(0, 200) : `[${message.type}]`,
            );
          }
          return {
            outcome: "persisted" as const,
            inboundId: inbound.id,
            conversationId: conversation.id,
            communicationId,
            matchingStatus,
            processingStatus,
            suppressed: false,
          };
        }

        if (!conversation.customerId) {
          const match = await this.matchCustomer(tx, accountId, remoteJid, canonicalPhone);
          if (match.status === "MATCHED" && match.customerId) {
            conversation = await tx.whatsAppConversation.update({
              where: { id: conversation.id },
              data: { customerId: match.customerId, matchingStatus: "MATCHED", matchedAt: new Date() },
            });
            await this.linkContact(tx, accountId, remoteJid, canonicalPhone, match.customerId, match.source);
          } else if (match.status === "AMBIGUOUS") {
            conversation = await tx.whatsAppConversation.update({
              where: { id: conversation.id },
              data: { matchingStatus: "AMBIGUOUS" },
            });
          }
          matchingStatus = conversation.matchingStatus;
        }

        const communicationId = supported
          ? await this.createCommunication(tx, {
              direction: "INBOUND",
              senderType: "CUSTOMER",
              senderId: conversation.customerId,
              recipientType: "USER",
              recipientId: null,
              contextId: conversation.customerId,
              body: bodyText,
              occurredAt: message.occurredAt,
              actorUserId: null,
            })
          : null;

        await tx.whatsAppInboundMessage.update({
          where: { id: inbound.id },
          data: {
            conversationId: conversation.id,
            communicationId,
            matchingStatus,
          },
        });
        if (supported || message.type !== "text") {
          await this.touchConversation(
            tx,
            conversation.id,
            message.occurredAt,
            supported ? previewText.slice(0, 200) : `[${message.type}]`,
          );
        }

        // §22 hook: STOP-ключевое слово → suppression (в этой же транзакции).
        if (supported && canonicalPhone) {
          const keyword = detectStopKeyword(bodyText);
          if (keyword) suppressed = await this.suppress(tx, canonicalPhone, keyword);
        }

        return {
          outcome: "persisted" as const,
          inboundId: inbound.id,
          conversationId: conversation.id,
          communicationId,
          matchingStatus,
          processingStatus,
          suppressed,
        };
      });
      return result;
    } catch (error) {
      // §7/§5: конкурентная/повторная доставка → дубль, НЕ ошибка.
      const constraints = uniqueConstraintNames(error);
      if (
        constraints.length === 0
          ? (error as { code?: unknown } | null | undefined)?.code === "P2002"
          : constraints.some((name) => name.startsWith("WhatsAppInboundMessage"))
      ) {
        return { outcome: "duplicate" };
      }
      throw error;
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * M3+: байты входящего файла → WHATSAPP_MEDIA_DIR/inbound/<id>/<file>.
   * Сбой записи НЕ роняет сообщение (метаданные stanza сохраняются).
   */
  private async saveInboundMedia(
    providerMessageId: string,
    media: WhatsAppInboundMedia | null,
  ): Promise<string | null> {
    if (!media || !media.bytes || media.bytes.length === 0) return null;
    const bytes = media.bytes;
    try {
      const saved = await this.media.saveInbound(providerMessageId, {
        filename: media.filename,
        mimetype: media.mimetype,
        size: media.size,
        bytes,
      });
      return saved?.relativePath ?? null;
    } catch (error) {
      console.warn("[whatsapp] inbound media save failed", {
        providerMessageId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  }

  /** M3+: метаданные файла входящего для GET /whatsapp/media/inbound/:id. */
  async getMedia(id: string): Promise<{
    filename: string;
    mimetype: string | null;
    mediaPath: string | null;
  } | null> {
    const row = await this.prisma.whatsAppInboundMessage.findUnique({
      where: { id },
      select: { mediaFilename: true, mediaMime: true, mediaPath: true },
    });
    if (!row) return null;
    return { filename: row.mediaFilename ?? "file", mimetype: row.mediaMime, mediaPath: row.mediaPath };
  }

  /** v1: одна singleton-строка WhatsAppAccount (как в outbound). */
  private async ensureAccountId(): Promise<string> {
    const existing = await this.prisma.whatsAppAccount.findFirst({ select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.whatsAppAccount.create({
      data: { provider: this.config.provider },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * §10 LID→PN: WhatsApp маскирует номера (`…@lid`); обратного резолва на
   * сервере нет — сверяем CRM-номера через provider.findPhoneByLid (pn→lid).
   * Опционально (mock/Cloud API без capability) → null.
   */
  private async resolveLidViaCrm(remoteJid: string): Promise<string | null> {
    if (!remoteJid.endsWith("@lid")) return null;
    if (typeof this.provider?.findPhoneByLid !== "function") return null;
    const rows = await this.prisma.customer.findMany({
      where: { phone: { not: null } },
      select: { phone: true },
    });
    const candidates: string[] = [];
    for (const row of rows) {
      const normalized = normalizePhoneE164(row.phone, this.config.defaultPhoneRegion);
      if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    }
    if (candidates.length === 0) return null;
    return this.provider.findPhoneByLid(remoteJid, candidates);
  }

  /** §4: (accountId, remoteJid) — якорь диалога; customerId не затирается. */
  private async ensureConversation(
    tx: Prisma.TransactionClient,
    accountId: string,
    remoteJid: string,
    canonicalPhone: string | null,
    customerId: string | null = null,
  ): Promise<{
    id: string;
    customerId: string | null;
    matchingStatus: WhatsAppMatchingStatus;
  }> {
    return tx.whatsAppConversation.upsert({
      where: { accountId_remoteJid: { accountId, remoteJid } },
      create: {
        accountId,
        remoteJid,
        canonicalPhone,
        customerId,
        matchingStatus: customerId ? "MATCHED" : "UNMATCHED",
        matchedAt: customerId ? new Date() : null,
      },
      update: canonicalPhone ? { canonicalPhone } : {},
      select: { id: true, customerId: true, matchingStatus: true },
    });
  }

  /**
   * §10: сопоставление канонического телефона с crm.Customer (read-only
   * нормализация, никаких индексов/backfill): 0 → UNMATCHED, 1 → MATCHED,
   * >1 → AMBIGUOUS. Быстрый путь — уже существующая связь WhatsAppContact.
   */
  private async matchCustomer(
    tx: Prisma.TransactionClient,
    accountId: string,
    jid: string,
    canonicalPhone: string | null,
  ): Promise<{
    customerId: string | null;
    status: WhatsAppMatchingStatus;
    source: "contact" | "phone";
  }> {
    const contact = await tx.whatsAppContact.findUnique({
      where: { accountId_jid: { accountId, jid } },
      select: { customerId: true },
    });
    if (contact?.customerId) {
      return { customerId: contact.customerId, status: "MATCHED", source: "contact" };
    }
    if (!canonicalPhone) return { customerId: null, status: "UNMATCHED", source: "phone" };

    const matches = await findCustomerIdsByCanonicalPhone(tx, canonicalPhone, this.config.defaultPhoneRegion);
    if (matches.length === 1) {
      return { customerId: matches[0], status: "MATCHED", source: "phone" };
    }
    if (matches.length > 1) return { customerId: null, status: "AMBIGUOUS", source: "phone" };
    return { customerId: null, status: "UNMATCHED", source: "phone" };
  }

  /** §24: связь JID ↔ Customer (входящая авто-связка, source=AUTO). */
  private async linkContact(
    tx: Prisma.TransactionClient,
    accountId: string,
    jid: string,
    canonicalPhone: string | null,
    customerId: string,
    source: "contact" | "phone",
  ): Promise<void> {
    if (source === "contact") return; // уже связан
    await tx.whatsAppContact.upsert({
      where: { accountId_jid: { accountId, jid } },
      create: { accountId, jid, canonicalPhone, customerId, linkSource: "AUTO" },
      update: { customerId, ...(canonicalPhone ? { canonicalPhone } : {}) },
    });
  }

  /** Echo известного outbound: связь без второй копии сообщения (§8). */
  private async persistKnownOutboundEcho(
    tx: Prisma.TransactionClient,
    args: {
      inboundId: string;
      knownOutbound: { communicationId: string; conversationId: string | null; recipientJid: string | null };
      fallbackJid: string;
      accountId: string;
      canonicalPhone: string | null;
      bodyText: string;
      supported: boolean;
      occurredAt: Date;
    },
  ): Promise<InboundProcessResult> {
    const conversation = await this.ensureConversation(
      tx,
      args.accountId,
      args.knownOutbound.recipientJid ?? args.fallbackJid,
      args.canonicalPhone,
    );
    await tx.whatsAppInboundMessage.update({
      where: { id: args.inboundId },
      data: {
        conversationId: conversation.id,
        communicationId: args.knownOutbound.communicationId,
        matchingStatus: conversation.matchingStatus,
      },
    });
    if (args.supported) {
      const communication = await tx.communication.findUnique({
        where: { id: args.knownOutbound.communicationId },
        select: { body: true },
      });
      await this.touchConversation(
        tx,
        conversation.id,
        args.occurredAt,
        (communication?.body ?? args.bodyText).slice(0, 200),
      );
    }
    return {
      outcome: "persisted",
      inboundId: args.inboundId,
      conversationId: conversation.id,
      communicationId: args.knownOutbound.communicationId,
      matchingStatus: conversation.matchingStatus,
      processingStatus: "PROCESSED",
      suppressed: false,
    };
  }

  /** ОДНА история (§4/§13): каноническая Communication, channel=WHATSAPP. */
  private async createCommunication(
    tx: Prisma.TransactionClient,
    args: {
      direction: "INBOUND" | "OUTBOUND";
      senderType: "CUSTOMER" | "SYSTEM";
      senderId: string | null;
      recipientType: "USER" | "CUSTOMER";
      recipientId: string | null;
      contextId: string | null;
      body: string;
      occurredAt: Date;
      actorUserId: string | null;
    },
  ): Promise<string> {
    const code = await this.ids.nextCode(tx, "CML");
    const communication = await tx.communication.create({
      data: {
        code,
        type: "MESSAGE",
        channel: "WHATSAPP",
        direction: args.direction,
        status: "ACTIVE",
        body: args.body.slice(0, 4000),
        contextType: args.contextId ? "CUSTOMER" : null,
        contextId: args.contextId,
        occurredAt: args.occurredAt,
        actorUserId: args.actorUserId,
        senderType: args.senderType,
        senderId: args.senderId,
        recipientType: args.recipientType,
        recipientId: args.recipientId,
        ...((): { requestId: string | null; correlationId: string | null } => {
          const ctx = getRequestContext();
          return { requestId: ctx?.requestId ?? null, correlationId: ctx?.correlationId ?? null };
        })(),
      },
      select: { id: true },
    });
    return communication.id;
  }

  private async touchConversation(
    tx: Prisma.TransactionClient,
    conversationId: string,
    lastMessageAt: Date,
    preview: string | null,
  ): Promise<void> {
    await tx.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt,
        ...(preview !== null ? { lastMessagePreview: preview.slice(0, 200) } : {}),
      },
    });
  }

  /** §22: opt-out по STOP/СТОП/UNSUBSCRIBE (idempotent, scope=ALL). */
  private async suppress(
    tx: Prisma.TransactionClient,
    canonicalPhone: string,
    keyword: string,
  ): Promise<boolean> {
    const existing = await tx.whatsAppSuppression.findUnique({
      where: { canonicalPhone },
      select: { id: true },
    });
    if (existing) return false;
    const row = await tx.whatsAppSuppression.create({
      data: { canonicalPhone, scope: "ALL", reason: keyword },
      select: { id: true },
    });
    await this.security.audit(tx, {
      userId: null,
      username: "system",
      action: "whatsapp.suppression.added",
      resource: "WhatsAppSuppression",
      resourceId: row.id,
      details: { reason: keyword, scope: "ALL", source: "inbound" },
    });
    return true;
  }
}
