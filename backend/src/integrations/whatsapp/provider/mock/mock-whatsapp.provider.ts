import type {
  WhatsAppCapabilities,
  WhatsAppConnectionSnapshot,
  WhatsAppDeliveryUpdate,
  WhatsAppInboundProviderMessage,
  WhatsAppProvider,
  WhatsAppReconcileResult,
  WhatsAppSendCommand,
  WhatsAppSendResult,
  Unsubscribe,
} from "../whatsapp-provider";
import {
  WhatsAppInvalidRecipientError,
  WhatsAppMessageSendError,
  WhatsAppNotConnectedError,
  WhatsAppRateLimitError,
} from "../whatsapp-errors";
import { assertTransition } from "../../state/connection-state.machine";
import type { WhatsAppConnectionState } from "../../../../generated/prisma/enums";

/** Что должен уметь тестовый драйвер для contract tests (M1) и M2+. */
export interface MockWhatsAppProviderOptions {
  /** Сценарий start(): "connected" — сразу CONNECTED; "qr" — через QR_REQUIRED. */
  readonly startFlow?: "connected" | "qr";
  readonly connectDelayMs?: number;
  readonly sendDelayMs?: number;
  readonly instanceId?: string;
}

export type MockSendFailure = "retryable" | "permanent" | "rate_limit" | "invalid_recipient";

type Listener<T> = (value: T) => void;

/**
 * MockWhatsAppProvider — референс-реализация WhatsAppProvider (M1).
 *
 * Живёт только в тестах/локальной разработке: имитирует соединение, inbound,
 * delivery receipts и ошибки отправки без какой-либо связи с WhatsApp.
 * Baileys-реализация (M2) обязана пройти тот же contract suite.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly capabilities: WhatsAppCapabilities = {
    qrPairing: true,
    deliveryReceipts: true,
    media: ["image", "video", "audio", "document", "sticker"],
    requiresSessionOwnership: true,
    requiresApprovedTemplates: false,
  };

  private readonly options: Required<MockWhatsAppProviderOptions>;
  private state: WhatsAppConnectionState = "DISCONNECTED";
  private qr: string | null = null;
  private phone: string | null = null;
  private connectedAt: Date | null = null;
  private lastError: string | null = null;

  private started = false;
  private startInFlight: Promise<void> | null = null;
  private startCount = 0;
  private nextSendFailure: MockSendFailure | null = null;
  private qrCounter = 0;
  private inboundCounter = 0;

  private readonly stateListeners = new Set<Listener<WhatsAppConnectionSnapshot>>();
  private readonly inboundListeners = new Set<Listener<WhatsAppInboundProviderMessage>>();
  private readonly deliveryListeners = new Set<Listener<WhatsAppDeliveryUpdate>>();
  /** Evidence для Reconcile (M2): providerMessageId → наблюдавшийся статус. */
  private readonly reconcileEvidence = new Map<string, WhatsAppReconcileResult>();

  constructor(options: MockWhatsAppProviderOptions = {}) {
    this.options = {
      startFlow: options.startFlow ?? "connected",
      connectDelayMs: options.connectDelayMs ?? 0,
      sendDelayMs: options.sendDelayMs ?? 0,
      instanceId: options.instanceId ?? "mock-instance",
    };
  }

  /** Тестовый счётчик реально выполненных инициализаций. */
  get initCount(): number {
    return this.startCount;
  }

  async start(): Promise<void> {
    // Защита от конкурентной инициализации: параллельные вызовы ждут один старт.
    if (this.startInFlight) return this.startInFlight;
    if (this.started) return;
    this.startInFlight = this.doStart().finally(() => {
      this.startInFlight = null;
    });
    return this.startInFlight;
  }

  private async doStart(): Promise<void> {
    this.startCount += 1;
    this.transition("INITIALIZING");
    await this.delay(this.options.connectDelayMs);
    if (this.options.startFlow === "qr") {
      this.qrCounter += 1;
      this.qr = `mock-qr-${this.qrCounter}`;
      this.transition("QR_REQUIRED");
      return;
    }
    this.transition("CONNECTING");
    await this.delay(this.options.connectDelayMs);
    this.qr = null;
    this.phone = "+994501234567";
    this.connectedAt = new Date();
    this.lastError = null;
    this.started = true;
    this.transition("CONNECTED");
  }

  async stop(reason = "shutdown"): Promise<void> {
    if (this.startInFlight) await this.startInFlight.catch(() => undefined);
    this.started = false;
    this.qr = null;
    this.connectedAt = null;
    this.lastError = reason === "shutdown" ? null : reason;
    if (this.state === "LOGGED_OUT") {
      this.transition("DISCONNECTED");
    } else if (this.state !== "DISCONNECTED" && this.state !== "LOGGING_OUT") {
      this.transition("LOGGING_OUT");
      this.transition("DISCONNECTED");
    } else if (this.state === "LOGGING_OUT") {
      this.transition("DISCONNECTED");
    }
  }

  async logout(): Promise<void> {
    if (this.state !== "DISCONNECTED" && this.state !== "LOGGED_OUT") this.transition("LOGGING_OUT");
    this.phone = null;
    this.started = false;
    this.transition("DISCONNECTED", "logout");
  }

  getSnapshot(): WhatsAppConnectionSnapshot {
    return Object.freeze({
      state: this.state,
      phone: this.phone,
      connectedAt: this.connectedAt,
      qr: this.qr,
      lastError: this.lastError,
      instanceId: this.options.instanceId,
    });
  }

  onStateChange(listener: Listener<WhatsAppConnectionSnapshot>): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onInbound(listener: Listener<WhatsAppInboundProviderMessage>): Unsubscribe {
    this.inboundListeners.add(listener);
    return () => this.inboundListeners.delete(listener);
  }

  onDeliveryUpdate(listener: Listener<WhatsAppDeliveryUpdate>): Unsubscribe {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  async send(command: WhatsAppSendCommand): Promise<WhatsAppSendResult> {
    if (this.state !== "CONNECTED") throw new WhatsAppNotConnectedError();
    await this.delay(this.options.sendDelayMs);
    if (this.nextSendFailure) {
      const failure = this.nextSendFailure;
      this.nextSendFailure = null;
      switch (failure) {
        case "rate_limit":
          throw new WhatsAppRateLimitError();
        case "invalid_recipient":
          throw new WhatsAppInvalidRecipientError();
        case "permanent":
          throw new WhatsAppMessageSendError("mock permanent send failure", false);
        case "retryable":
          throw new WhatsAppMessageSendError("mock transient send failure", true);
      }
    }
    const providerMessageId = `mock-${command.messageId}`;
    this.recordEvidence(providerMessageId, "sent", new Date());
    return { providerMessageId, sentAt: new Date() };
  }

  /** Reconcile (M2): evidence, наблюдавшийся провайдером в ЭТОМ процессе. */
  async reconcile(providerMessageId: string): Promise<WhatsAppReconcileResult | null> {
    return this.reconcileEvidence.get(providerMessageId) ?? null;
  }

  // ── Test driver API (contract tests / M2 harness) ─────────────────────────

  /** Перевести провайдер в состояние с проверкой таблицы §6.2. */
  driveState(to: WhatsAppConnectionState, error?: string): void {
    this.lastError = error ?? (to === "ERROR" ? "mock error" : this.lastError);
    if (to === "QR_REQUIRED") {
      // Харнесс: QR_REQUIRED без qr-строки недостижим для GET /qr.
      this.qrCounter += 1;
      this.qr = `mock-qr-${this.qrCounter}`;
    }
    if (to === "CONNECTED" && this.state !== "CONNECTED") {
      this.connectedAt = new Date();
      this.phone = this.phone ?? "+994501234567";
    }
    if (to === "DISCONNECTED" || to === "LOGGING_OUT") this.connectedAt = null;
    this.transition(to);
  }

  /** Смоделировать входящее сообщение (сохраняет fromMe/lid/senderPn как есть). */
  driveInbound(partial: Partial<WhatsAppInboundProviderMessage> = {}): void {
    this.inboundCounter += 1;
    const message: WhatsAppInboundProviderMessage = {
      providerMessageId: partial.providerMessageId ?? `mock-in-${this.inboundCounter}`,
      remoteJid: partial.remoteJid ?? "994501234567@s.whatsapp.net",
      fromMe: partial.fromMe ?? false,
      participant: partial.participant ?? null,
      occurredAt: partial.occurredAt ?? new Date(),
      type: partial.type ?? "text",
      text: partial.text ?? "hello",
      lid: partial.lid ?? null,
      senderPn: partial.senderPn ?? null,
    };
    for (const listener of [...this.inboundListeners]) listener(message);
  }

  /** Смоделировать delivery receipt. */
  driveDelivery(partial: Partial<WhatsAppDeliveryUpdate> = {}): void {
    const update: WhatsAppDeliveryUpdate = {
      providerMessageId: partial.providerMessageId ?? "mock-in-1",
      status: partial.status ?? "delivered",
      occurredAt: partial.occurredAt ?? new Date(),
    };
    this.recordEvidence(update.providerMessageId, update.status, update.occurredAt);
    for (const listener of [...this.deliveryListeners]) listener(update);
  }

  /** Следующий send() завершится указанной ошибкой. */
  failNextSend(failure: MockSendFailure): void {
    this.nextSendFailure = failure;
  }

  /** Очистить evidence Reconcile (harness reset; не автосброс в рантайме). */
  clearReconcileEvidence(): void {
    this.reconcileEvidence.clear();
  }

  /** Monotonic merge evidence: sent < delivered < read. */
  private recordEvidence(providerMessageId: string, status: "sent" | "delivered" | "read", observedAt: Date): void {
    const rank = { sent: 1, delivered: 2, read: 3 } as const;
    const existing = this.reconcileEvidence.get(providerMessageId);
    if (existing && rank[existing.status] >= rank[status]) return;
    this.reconcileEvidence.set(providerMessageId, { status, observedAt });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private transition(to: WhatsAppConnectionState, error?: string): void {
    assertTransition(this.state, to);
    this.state = to;
    if (error !== undefined) this.lastError = error;
    if (to === "CONNECTED") {
      this.lastError = null;
      this.qr = null; // после pairing QR инвалидируется (§6.4)
    }
    const snapshot = this.getSnapshot();
    for (const listener of [...this.stateListeners]) listener(snapshot);
  }

  private delay(ms: number): Promise<void> {
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }
}
