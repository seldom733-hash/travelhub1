import { randomBytes } from "crypto";
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
import { NotFoundError, ConflictError, ValidationDomainError, DomainError } from "../../../shared/errors";
import { normalizePhoneE164 } from "../../../shared/phone/phone";
import { getRequestContext } from "../../../shared/request-context";
import type { WhatsAppOutboundStatus } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "../whatsapp.tokens";
import type { WhatsAppConfig } from "../whatsapp.config";
import type {
  WhatsAppDeliveryUpdate,
  WhatsAppProvider,
  WhatsAppSendCommand,
} from "../provider/whatsapp-provider";
import { WhatsAppProviderError, WhatsAppMessageSendError } from "../provider/whatsapp-errors";
import { WhatsAppMediaStorage, type StagedUpload } from "../media/whatsapp-media.storage";
import { WhatsAppSessionOwnershipService } from "../ownership/session-ownership.service";
import {
  assertOutboundTransition,
  receiptEligibleTarget,
  receiptEvidenceField,
  reconcileTargetFromEvidence,
} from "./outbound-lifecycle";

/**
 * M2: outbound lifecycle (решение владельца M2, D6, решение №5).
 *
 * Канонический поток manual send:
 *   authenticate/authorize → resolve Customer/phone (E.164) → проверка
 *   connection → проверка lease (fencing) → В ОДНОЙ транзакции:
 *   Communication (CML-*) + WhatsAppOutboundMessage(providerMessageId,
 *   operationKey, CREATED) → CAS-переходы CREATED→QUEUED→SENDING →
 *   provider.send(messageId = сохранённый providerMessageId) → SENT |
 *   FAILED_* | UNKNOWN.
 *
 * At-most-once (решение №5): crash/timeout после фактического начала send →
 * UNKNOWN; автоповтор запрещён; recovery только Reconcile / Mark failed /
 * Retry anyway (с confirm) с audit. Receipt-и двигают статус только из
 * SENT/DELIVERED; для UNKNOWN пишутся ТОЛЬКО evidence-колонки.
 *
 * Примечание (scope M2): suppression/throttle НЕ проверяются (следующий
 * этап); CommunicationStatus НЕ расширяется — SENT/DELIVERED/READ живут
 * только в whatsapp.WhatsAppOutboundMessage.
 */

export type WhatsAppRecoverAction = "reconcile" | "mark-failed" | "retry-anyway";

export interface ActorRef {
  readonly id: string;
  readonly username?: string | null;
}

export interface SendManualInput {
  readonly customerId?: string | null;
  readonly phone?: string | null;
  /** Текст/caption; пустой разрешён только вместе с uploadId (M3+ файл). */
  readonly text: string;
  /** M3 §19: диалог, в который отправляется сообщение (опционально). */
  readonly conversationId?: string | null;
  /** M3+: staged-загрузка через POST /whatsapp/uploads (файл уходит document). */
  readonly uploadId?: string | null;
}

export interface OutboundSendResult {
  readonly outboundId: string;
  readonly communicationCode: string;
  readonly status: WhatsAppOutboundStatus;
  readonly providerMessageId: string;
}

export interface OutboundRecoverResult {
  readonly outboundId: string;
  readonly action: WhatsAppRecoverAction;
  readonly status: WhatsAppOutboundStatus;
  readonly recovered: boolean;
  readonly evidence?: "db" | "provider";
}

/**
 * Наш providerMessageId генерируется ДО provider.send (D6) в формате
 * Baileys `generateMessageID` = '3EB0' + 18 random bytes hex UPPER
 * (lib/Utils/generics.js:160, проверено M0-04) — Reconcile по этому id.
 */
export function generateProviderMessageId(): string {
  return `3EB0${randomBytes(18).toString("hex").toUpperCase()}`;
}

const CRASH_SCAN_INTERVAL_MS = 60_000;

@Injectable()
export class WhatsAppOutboundService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly provider: WhatsAppProvider | null;
  private readonly media: WhatsAppMediaStorage;
  private crashTimer: NodeJS.Timeout | null = null;
  private unsubscribeDelivery: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly ownership: WhatsAppSessionOwnershipService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
    @Optional() @Inject(WHATSAPP_PROVIDER) provider: WhatsAppProvider | null,
  ) {
    this.provider = provider;
    this.media = new WhatsAppMediaStorage(config.mediaDir ?? ".whatsapp-media");
  }

  onApplicationBootstrap(): void {
    if (!this.config.enabled || !this.provider) return;
    this.unsubscribeDelivery = this.provider.onDeliveryUpdate((update) => {
      void this.applyReceipt(update);
    });
    void this.recoverStaleSending();
    this.crashTimer = setInterval(() => {
      void this.recoverStaleSending();
    }, CRASH_SCAN_INTERVAL_MS);
    this.crashTimer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.crashTimer) clearInterval(this.crashTimer);
    this.crashTimer = null;
    this.unsubscribeDelivery?.();
    this.unsubscribeDelivery = null;
  }

  /**
   * Manual send (§6.4): проверки → транзакция (Communication + Outbound +
   * providerMessageId + operationKey ДО send) → CAS-pipeline → provider.send.
   */
  async sendManual(
    input: SendManualInput,
    actor: ActorRef,
    operationKey: string,
  ): Promise<OutboundSendResult> {
    const text = (input.text ?? "").trim();
    if (text.length > 4000) {
      throw new ValidationDomainError("Message text must be between 1 and 4000 characters");
    }
    // M3+: файл — обязательный uploadId (staged), текст опционален (caption).
    const staged: StagedUpload | null = input.uploadId ? await this.media.readUpload(input.uploadId) : null;
    if (input.uploadId && !staged) {
      throw new NotFoundError("Uploaded file not found (uploadId)");
    }
    if (!staged && text.length < 1) {
      throw new ValidationDomainError("Message text must be between 1 and 4000 characters");
    }
    if (!operationKey || operationKey.trim() === "") {
      throw new ValidationDomainError("operationKey (Idempotency-Key) is required");
    }
    const recipient = await this.resolveRecipient(input);

    // M3 §22: opt-out gate — подавленный номер не отправляется (audit без PII).
    if (await this.isSuppressed(recipient.canonicalPhone)) {
      await this.security.audit(undefined, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.send.suppressed",
        resource: "WhatsAppOutboundMessage",
        resourceId: null,
        details: { operationKey, customerId: recipient.customerId ?? null, reason: "suppression" },
      });
      throw new ConflictError("Recipient opted out of WhatsApp messages (suppressed)");
    }

    if (!this.provider) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
    const snapshot = this.provider.getSnapshot();
    if (snapshot.state !== "CONNECTED") {
      throw new ConflictError(`WhatsApp is not connected (state=${snapshot.state})`);
    }
    if (staged && !this.provider.capabilities.media.includes("document")) {
      throw new DomainError("WhatsApp provider does not support media send", 503);
    }
    // Fencing: только владелец lease может менять outbound state.
    const handle = await this.ownership.assertActive();

    const providerMessageId = generateProviderMessageId();
    const recipientJid = `${recipient.canonicalPhone.replace(/^\+/, "")}@s.whatsapp.net`;
    const accountId = await this.ensureAccountId();

    // M3+: staged-загрузка переносится на постоянное место ДО транзакции
    // (mediaPath известен и пишется в outbound-строку вместе с creation).
    const mediaFile = staged ? await this.media.adoptUpload(staged.uploadId, providerMessageId) : null;
    if (staged && !mediaFile) {
      throw new NotFoundError("Uploaded file not found (uploadId)");
    }

    // M3 §19: явный диалог проверяется ДО транзакции (соответствие получателю).
    const explicitConversation = input.conversationId
      ? await this.validateExplicitConversation(input.conversationId, recipient, recipientJid)
      : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const conversation = explicitConversation
        ? await this.fillConversation(tx, explicitConversation.id, recipient)
        : await this.upsertSendConversation(tx, accountId, recipientJid, recipient);
      const code = await this.ids.nextCode(tx, "CML");
      const communication = await tx.communication.create({
        data: {
          code,
          type: "MESSAGE",
          channel: "WHATSAPP",
          direction: "OUTBOUND",
          status: "ACTIVE",
          // caption; у файла без подписи — пусто (чип в ленте покажет файл).
          body: text,
          contextType: recipient.customerId ? "CUSTOMER" : null,
          contextId: recipient.customerId ?? null,
          actorUserId: actor.id,
          senderType: "USER",
          senderId: actor.id,
          recipientType: "CUSTOMER",
          recipientId: recipient.customerId ?? null,
          ...((): { requestId: string | null; correlationId: string | null } => {
            const ctx = getRequestContext();
            return { requestId: ctx?.requestId ?? null, correlationId: ctx?.correlationId ?? null };
          })(),
        },
        select: { id: true, code: true },
      });
      const outbound = await tx.whatsAppOutboundMessage.create({
        data: {
          accountId,
          communicationId: communication.id,
          operationKey,
          recipientJid,
          recipientPhone: recipient.canonicalPhone,
          conversationId: conversation.id,
          status: "CREATED",
          providerMessageId,
          fencingToken: handle.fencingToken,
          ...(mediaFile
            ? {
                mediaFilename: mediaFile.filename,
                mediaMime: mediaFile.mimetype,
                mediaSize: mediaFile.size,
                mediaPath: mediaFile.relativePath,
              }
            : {}),
        },
      });
      // M3 §4: исходящее входит в общую историю диалога (превью списка).
      await tx.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: (text.length > 0 ? text : mediaFile!.filename).slice(0, 200),
        },
      });
      // Audit без текста сообщения и телефона (PII minimization).
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.send",
        resource: "WhatsAppOutboundMessage",
        resourceId: outbound.id,
        details: {
          communicationCode: communication.code,
          operationKey,
          providerMessageId,
          customerId: recipient.customerId ?? null,
        },
      });
      return { outboundId: outbound.id, communicationCode: communication.code };
    });

    const finalState = await this.executeSend(created.outboundId, text, recipientJid);
    return {
      outboundId: created.outboundId,
      communicationCode: created.communicationCode,
      status: finalState.status,
      providerMessageId: finalState.providerMessageId,
    };
  }

  /**
   * Операционный список outbound (§6.4 GET /messages, whatsapp.read):
   * статусы/evidence/ошибки; без телефона получателя (PII minimization).
   */
  async list(limit = 50): Promise<Array<Record<string, unknown>>> {
    const take = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.whatsAppOutboundMessage.findMany({
      take,
      orderBy: { updatedAt: "desc" },
    });
    const communicationIds = [...new Set(rows.map((row) => row.communicationId))];
    const communications =
      communicationIds.length > 0
        ? await this.prisma.communication.findMany({
            where: { id: { in: communicationIds } },
            select: { id: true, code: true },
          })
        : [];
    const codeById = new Map(communications.map((row) => [row.id, row.code]));
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      providerMessageId: row.providerMessageId,
      attempts: row.attempts,
      fencingToken: row.fencingToken,
      communicationCode: codeById.get(row.communicationId) ?? null,
      lastError: row.lastError,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * M3+: метаданные файла исходящего для GET /whatsapp/media/outbound/:id.
   */
  async getMedia(id: string): Promise<{
    filename: string;
    mimetype: string | null;
    mediaPath: string | null;
  } | null> {
    const row = await this.prisma.whatsAppOutboundMessage.findUnique({
      where: { id },
      select: { mediaFilename: true, mediaMime: true, mediaPath: true },
    });
    if (!row) return null;
    return { filename: row.mediaFilename ?? "file", mimetype: row.mediaMime, mediaPath: row.mediaPath };
  }

  /**
   * Recovery действий (решение №5): Reconcile / Mark failed / Retry anyway.
   * Любое действие аудируется; retry-anyway требует confirm=true.
   */
  async recover(
    outboundId: string,
    action: WhatsAppRecoverAction,
    options: { confirm?: boolean },
    actor: ActorRef,
  ): Promise<OutboundRecoverResult> {
    await this.ownership.assertActive();
    const row = await this.prisma.whatsAppOutboundMessage.findUnique({ where: { id: outboundId } });
    if (!row) throw new NotFoundError(`WhatsApp outbound message ${outboundId} not found`);
    if (row.status !== "UNKNOWN") {
      throw new ConflictError(
        `Recovery actions are defined for UNKNOWN messages only (current status: ${row.status})`,
      );
    }

    switch (action) {
      case "reconcile":
        return this.reconcile(row, actor);
      case "mark-failed":
        return this.markFailed(row.id, actor);
      case "retry-anyway":
        if (options.confirm !== true) {
          throw new ValidationDomainError(
            "retry-anyway requires explicit confirmation (confirm=true): duplicate delivery is possible",
          );
        }
        return this.retryAnyway(row.id, actor);
      default:
        throw new ValidationDomainError(`Unknown recovery action: ${String(action)}`);
    }
  }

  /**
   * Crash-recovery: строки, застрявшие в SENDING дольше sendTimeout+grace,
   * переводятся в UNKNOWN (исход неизвестен, автоповтор запрещён).
   */
  async recoverStaleSending(): Promise<{ count: number; ids: string[] }> {
    const cutoff = new Date(Date.now() - (this.config.sendTimeoutMs + 30_000));
    const stale = await this.prisma.whatsAppOutboundMessage.findMany({
      where: { status: "SENDING", updatedAt: { lt: cutoff } },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const row of stale) {
      const updated = await this.prisma.whatsAppOutboundMessage.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: {
          status: "UNKNOWN",
          lastError: "crash recovery: send outcome unknown (at-most-once, no auto retry)",
        },
      });
      if (updated.count === 1) {
        ids.push(row.id);
        await this.security.audit(undefined, {
          userId: null,
          username: "system",
          action: "whatsapp.send.crash_to_unknown",
          resource: "WhatsAppOutboundMessage",
          resourceId: row.id,
          details: { reason: "stale SENDING after restart/timeout", autoRetry: false },
        });
      }
    }
    return { count: ids.length, ids };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async resolveRecipient(input: SendManualInput): Promise<{
    canonicalPhone: string;
    customerId: string | null;
  }> {
    const hasCustomer = typeof input.customerId === "string" && input.customerId.trim() !== "";
    const hasPhone = typeof input.phone === "string" && input.phone.trim() !== "";
    if (hasCustomer && hasPhone) {
      throw new ValidationDomainError("Provide either customerId or phone, not both");
    }
    if (!hasCustomer && !hasPhone) {
      throw new ValidationDomainError("Either customerId or phone is required");
    }
    if (hasCustomer) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId!.trim() },
        select: { id: true, phone: true },
      });
      if (!customer) throw new NotFoundError(`Customer ${input.customerId} not found`);
      const canonical = normalizePhoneE164(customer.phone, this.config.defaultPhoneRegion);
      if (!canonical) {
        throw new ValidationDomainError(
          "Customer has no valid phone number (canonical E.164 required, no guessing)",
        );
      }
      return { canonicalPhone: canonical, customerId: customer.id };
    }
    const canonical = normalizePhoneE164(input.phone, this.config.defaultPhoneRegion);
    if (!canonical) {
      throw new ValidationDomainError("Phone is not a valid E.164 number");
    }
    return { canonicalPhone: canonical, customerId: null };
  }

  /** v1: одна singleton-строка WhatsAppAccount (dedicated number). */
  private async ensureAccountId(): Promise<string> {
    const existing = await this.prisma.whatsAppAccount.findFirst({ select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.whatsAppAccount.create({
      data: { provider: this.config.provider },
      select: { id: true },
    });
    return created.id;
  }

  /** M3 §22: проверка opt-out по каноническому телефону (D9 suppression). */
  private async isSuppressed(canonicalPhone: string): Promise<boolean> {
    const row = await this.prisma.whatsAppSuppression.findUnique({
      where: { canonicalPhone },
      select: { id: true },
    });
    return row !== null;
  }

  /** M3 §19: явный conversationId должен соответствовать получателю. */
  private async validateExplicitConversation(
    conversationId: string,
    recipient: { canonicalPhone: string; customerId: string | null },
    recipientJid: string,
  ): Promise<{ id: string; canonicalPhone: string | null; customerId: string | null }> {
    const conversation = await this.prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, remoteJid: true, canonicalPhone: true, customerId: true },
    });
    if (!conversation) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    if (
      conversation.remoteJid !== recipientJid &&
      conversation.canonicalPhone !== recipient.canonicalPhone
    ) {
      throw new ValidationDomainError(
        "conversationId does not match the resolved recipient (customerId/phone)",
      );
    }
    return conversation;
  }

  /** Заполняет недостающие customerId/canonicalPhone существующего диалога. */
  private async fillConversation(
    tx: Prisma.TransactionClient,
    conversationId: string,
    recipient: { canonicalPhone: string; customerId: string | null },
  ): Promise<{ id: string }> {
    const current = await tx.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, customerId: true, canonicalPhone: true },
    });
    if (!current) {
      throw new NotFoundError(`WhatsApp conversation ${conversationId} not found`);
    }
    const needsCustomer = !current.customerId && recipient.customerId !== null;
    const needsPhone = current.canonicalPhone === null;
    if (!needsCustomer && !needsPhone) return current;
    return tx.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        ...(needsCustomer
          ? {
              customerId: recipient.customerId,
              matchingStatus: "MATCHED" as const,
              matchedAt: new Date(),
            }
          : {}),
        ...(needsPhone ? { canonicalPhone: recipient.canonicalPhone } : {}),
      },
      select: { id: true },
    });
  }

  /** M3 §4: диалог для исходящего — по (accountId, recipientJid); существующий
   * диалог НЕ перепривязывается (customerId заполняется только если отсутствует). */
  private async upsertSendConversation(
    tx: Prisma.TransactionClient,
    accountId: string,
    recipientJid: string,
    recipient: { canonicalPhone: string; customerId: string | null },
  ): Promise<{ id: string }> {
    const existing = await tx.whatsAppConversation.findUnique({
      where: { accountId_remoteJid: { accountId, remoteJid: recipientJid } },
      select: { id: true, customerId: true, canonicalPhone: true },
    });
    if (existing) return this.fillConversation(tx, existing.id, recipient);
    return tx.whatsAppConversation.create({
      data: {
        accountId,
        remoteJid: recipientJid,
        canonicalPhone: recipient.canonicalPhone,
        customerId: recipient.customerId,
        matchingStatus: recipient.customerId ? "MATCHED" : "UNMATCHED",
        matchedAt: recipient.customerId ? new Date() : null,
      },
      select: { id: true },
    });
  }

  /** Файл outbound-сообщения: байты с диска; потеря файла → FAILED_PERMANENT. */
  private async readOutboundMedia(row: {
    mediaPath: string | null;
    mediaFilename: string | null;
    mediaMime: string | null;
  }): Promise<NonNullable<WhatsAppSendCommand["media"]>> {
    const bytes = row.mediaPath ? await this.media.readRelative(row.mediaPath) : null;
    if (!bytes) {
      throw new WhatsAppMessageSendError("Media file is missing on disk (mediaPath)", false);
    }
    return {
      filename: row.mediaFilename ?? "file",
      mimetype: row.mediaMime ?? "application/octet-stream",
      bytes,
    };
  }

  /**
   * CAS-pipeline CREATED → QUEUED → SENDING → SENT | FAILED_* | UNKNOWN.
   * Повторный вызов перезапускает отправку только из QUEUED/SENDING-путей,
   * защищённых CAS по текущему статусу (гонки исключены).
   */
  private async executeSend(
    outboundId: string,
    text: string,
    recipientJid: string,
  ): Promise<{ status: WhatsAppOutboundStatus; providerMessageId: string }> {
    if (!this.provider) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }

    const queued = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: outboundId, status: "CREATED" },
      data: { status: "QUEUED" },
    });
    if (queued.count === 0) {
      const current = await this.prisma.whatsAppOutboundMessage.findUnique({
        where: { id: outboundId },
      });
      if (current && current.status === "QUEUED") {
        // Повторный вход (retry-anyway уже перевёл в QUEUED) — продолжаем.
      } else {
        throw new ConflictError(
          `Outbound message is not in a sendable state (current: ${current?.status ?? "missing"})`,
        );
      }
    }

    const handle = await this.ownership.assertActive();
    const sending = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: outboundId, status: "QUEUED" },
      data: { status: "SENDING", attempts: { increment: 1 }, fencingToken: handle.fencingToken },
    });
    if (sending.count === 0) {
      throw new ConflictError("Outbound message state changed concurrently (QUEUED → SENDING CAS lost)");
    }

    const row = await this.prisma.whatsAppOutboundMessage.findUnique({ where: { id: outboundId } });
    if (!row || !row.providerMessageId) {
      throw new ConflictError("Outbound message is missing providerMessageId");
    }
    const providerMessageId = row.providerMessageId;

    try {
      // M3+: файл читается с диска на каждой отправке (в т.ч. retry-anyway).
      const media = row.mediaPath ? await this.readOutboundMedia(row) : null;
      const result = await this.provider.send({
        recipientJid,
        text,
        media,
        messageId: providerMessageId,
        timeoutMs: this.config.sendTimeoutMs,
      });
      const sent = await this.prisma.whatsAppOutboundMessage.updateMany({
        where: { id: outboundId, status: "SENDING" },
        data: { status: "SENT", sentAt: result.sentAt, lastError: null },
      });
      if (sent.count === 0) {
        // Статус изменён параллельно (краш-скан) — НЕ дёргаем статус обратно.
        return { status: "UNKNOWN", providerMessageId };
      }
      return { status: "SENT", providerMessageId };
    } catch (error) {
      return this.applySendFailure(outboundId, providerMessageId, error);
    }
  }

  private async applySendFailure(
    outboundId: string,
    providerMessageId: string,
    error: unknown,
  ): Promise<{ status: WhatsAppOutboundStatus; providerMessageId: string }> {
    // Правило №5: ambiguous (timeout/разрыв/не-типизированная ошибка) → UNKNOWN.
    const isTyped = error instanceof WhatsAppProviderError;
    const ambiguous = !isTyped || error.ambiguous;
    const retryable = isTyped && error.retryable;
    const message = isTyped
      ? error.message
      : "Unexpected provider failure (treated as ambiguous for at-most-once)";

    const target: WhatsAppOutboundStatus = ambiguous
      ? "UNKNOWN"
      : retryable
        ? "FAILED_RETRYABLE"
        : "FAILED_PERMANENT";

    if (isTyped) assertOutboundTransition("SENDING", target);

    const updated = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: outboundId, status: "SENDING" },
      data: {
        status: target,
        lastError: message.slice(0, 500),
        ...(target === "UNKNOWN" ? {} : { nextAttemptAt: null }),
      },
    });
    if (updated.count === 0) {
      return { status: "UNKNOWN", providerMessageId };
    }
    return { status: target, providerMessageId };
  }

  /** Receipt от провайдера: монотонный статус из SENT/DELIVERED + evidence. */
  private async applyReceipt(update: WhatsAppDeliveryUpdate): Promise<void> {
    try {
      const row = await this.prisma.whatsAppOutboundMessage.findUnique({
        where: { providerMessageId: update.providerMessageId },
      });
      if (!row) return;
      const field = receiptEvidenceField(update.status);
      const target = receiptEligibleTarget(row.status, update.status);
      if (target) {
        await this.prisma.whatsAppOutboundMessage.updateMany({
          where: { id: row.id, status: row.status },
          data: { status: target, [field]: update.occurredAt },
        });
        return;
      }
      // UNKNOWN/SENDING: только evidence-колонка, статус НЕ меняется (№5).
      if (row.status === "UNKNOWN" || row.status === "SENDING") {
        await this.prisma.whatsAppOutboundMessage.updateMany({
          where: { id: row.id, status: row.status, [field]: null },
          data: { [field]: update.occurredAt },
        });
      }
    } catch (error) {
      // Обработчик события не должен ронять провайдерный event-loop.
      console.error("[whatsapp] receipt apply failed", {
        providerMessageId: update.providerMessageId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  /** Reconcile: evidence из БД-колонок, затем из провайдерной сессии. */
  private async reconcile(
    row: { id: string; status: WhatsAppOutboundStatus; providerMessageId: string | null; sentAt: Date | null; deliveredAt: Date | null; readAt: Date | null },
    actor: ActorRef,
  ): Promise<OutboundRecoverResult> {
    let target = reconcileTargetFromEvidence(row);
    let source: "db" | "provider" = "db";

    if (!target && this.provider && row.providerMessageId) {
      const evidence = await this.provider.reconcile(row.providerMessageId);
      if (evidence) {
        target = evidence.status === "read" ? "READ" : evidence.status === "delivered" ? "DELIVERED" : "SENT";
        source = "provider";
      }
    }

    if (!target) {
      await this.security.audit(undefined, {
        userId: actor.id,
        username: actor.username ?? null,
        action: "whatsapp.send.reconcile",
        resource: "WhatsAppOutboundMessage",
        resourceId: row.id,
        details: { result: "no_evidence", providerMessageId: row.providerMessageId },
      });
      return { outboundId: row.id, action: "reconcile", status: "UNKNOWN", recovered: false };
    }

    const data: Record<string, unknown> = { status: target };
    if (target === "SENT") data["sentAt"] = row.sentAt ?? new Date();
    if (target === "DELIVERED") {
      data["sentAt"] = row.sentAt ?? new Date();
      data["deliveredAt"] = row.deliveredAt ?? new Date();
    }
    if (target === "READ") {
      data["sentAt"] = row.sentAt ?? new Date();
      data["deliveredAt"] = row.deliveredAt ?? new Date();
      data["readAt"] = row.readAt ?? new Date();
    }
    const updated = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: row.id, status: "UNKNOWN" },
      data,
    });
    if (updated.count === 0) {
      throw new ConflictError("Outbound message was recovered concurrently (UNKNOWN CAS lost)");
    }
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.send.reconciled",
      resource: "WhatsAppOutboundMessage",
      resourceId: row.id,
      details: {
        to: target,
        evidence: source,
        providerMessageId: row.providerMessageId,
      },
    });
    return { outboundId: row.id, action: "reconcile", status: target, recovered: true, evidence: source };
  }

  private async markFailed(outboundId: string, actor: ActorRef): Promise<OutboundRecoverResult> {
    const updated = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: outboundId, status: "UNKNOWN" },
      data: {
        status: "FAILED_PERMANENT",
        lastError: "marked failed by operator (recovery action, no auto retry)",
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("Outbound message was modified concurrently (UNKNOWN CAS lost)");
    }
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.send.mark_failed",
      resource: "WhatsAppOutboundMessage",
      resourceId: outboundId,
      details: { from: "UNKNOWN", to: "FAILED_PERMANENT" },
    });
    return { outboundId, action: "mark-failed", status: "FAILED_PERMANENT", recovered: true };
  }

  private async retryAnyway(outboundId: string, actor: ActorRef): Promise<OutboundRecoverResult> {
    if (!this.provider) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
    const row = await this.prisma.whatsAppOutboundMessage.findUnique({ where: { id: outboundId } });
    if (!row || row.status !== "UNKNOWN") {
      throw new ConflictError("Retry anyway is defined for UNKNOWN messages only");
    }
    if (!row.recipientJid) {
      throw new ConflictError("Outbound message has no recipient JID");
    }
    const communication = await this.prisma.communication.findUnique({
      where: { id: row.communicationId },
      select: { body: true },
    });
    if (!communication) {
      throw new ConflictError("Communication for outbound message is missing");
    }

    const handle = await this.ownership.assertActive();
    const newProviderMessageId = generateProviderMessageId();
    const updated = await this.prisma.whatsAppOutboundMessage.updateMany({
      where: { id: outboundId, status: "UNKNOWN" },
      data: {
        status: "QUEUED",
        providerMessageId: newProviderMessageId,
        lastError: null,
        fencingToken: handle.fencingToken,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("Outbound message was modified concurrently (UNKNOWN CAS lost)");
    }
    await this.security.audit(undefined, {
      userId: actor.id,
      username: actor.username ?? null,
      action: "whatsapp.send.retry_anyway",
      resource: "WhatsAppOutboundMessage",
      resourceId: outboundId,
      details: {
        confirm: true,
        previousProviderMessageId: row.providerMessageId,
        providerMessageId: newProviderMessageId,
        duplicateDeliveryPossible: true,
      },
    });

    const finalState = await this.executeSend(outboundId, communication.body, row.recipientJid);
    return { outboundId, action: "retry-anyway", status: finalState.status, recovered: true };
  }
}
