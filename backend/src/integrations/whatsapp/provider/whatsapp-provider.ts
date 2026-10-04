import type { WhatsAppConnectionState } from "../../../generated/prisma/enums";

/**
 * WhatsApp provider contract (мастер-промпт v2.3 §4.2/§6, ADR M0-02).
 *
 * Провайдер-нейтральный интерфейс транспорта: Baileys (M2+), mock (M1) и
 * будущий Cloud API обязаны удовлетворять ему (contract tests). Бизнес-слое
 * (CRM/Booking/Order/Finance/Communication) НЕ импортирует Baileys и НЕ
 * обращается к этому контракту напрямую — только через whatsapp-слой (I1).
 *
 * Правила контракта:
 *  - состояния — только WhatsAppConnectionState (таблица §6.2); никогда не
 *    смешиваются со статусами Communication/Order/Booking;
 *  - QR живёт только в памяти snapshot (не хранить в БД, не логировать);
 *  - send() бросает типизированные WhatsAppProviderError c retryable;
 *  - события (state/inbound/delivery) доставляются через подписки с
 *    unsubscribe; провайдер не знает про Communication/Business-сущности.
 */

/** Провайдерские capabilities (единый контракт для всех провайдеров). */
export interface WhatsAppCapabilities {
  /** Провайдер поддерживает QR-pairing (Baileys: да). */
  readonly qrPairing: boolean;
  /** Провайдер отдаёт delivery receipts (sent/delivered/read). */
  readonly deliveryReceipts: boolean;
  /** Поддерживаемые типы исходящих медиа (M3+: файлы уходят documentMessage). */
  readonly media: readonly ("image" | "video" | "audio" | "document" | "sticker")[];
  /** Требуется single-owner lease + fencing token (I13). */
  readonly requiresSessionOwnership: boolean;
  /** Требуются approved templates (Cloud API; Baileys — false). */
  readonly requiresApprovedTemplates: boolean;
}

/** Моментальный снимок состояния соединения (для status/UI/health). */
export interface WhatsAppConnectionSnapshot {
  readonly state: WhatsAppConnectionState;
  /** Канонический E.164 номер аккаунта после pairing; null — ещё неизвестен. */
  readonly phone: string | null;
  readonly connectedAt: Date | null;
  /** QR-строка; только при state=QR_REQUIRED; не логировать и не хранить. */
  readonly qr: string | null;
  /** Последняя ошибка транспорта (человекочитаемая, без stack trace). */
  readonly lastError: string | null;
  /** Идентификатор инстанса (lease owner candidate). */
  readonly instanceId: string;
}

/** Файл исходящего сообщения (M3+: local→local через WhatsApp). */
export interface WhatsAppSendMedia {
  readonly filename: string;
  readonly mimetype: string;
  readonly bytes: Uint8Array;
}

/** Файл входящего сообщения: метаданные из stanza + скачанные байты. */
export interface WhatsAppInboundMedia {
  readonly filename: string | null;
  readonly mimetype: string | null;
  readonly size: number | null;
  /** null — скачать не удалось (метаданные stanza сохраняются). */
  readonly bytes: Uint8Array | null;
}

/** Входящее сообщение от провайдера (provider metadata; без business context). */
export interface WhatsAppInboundProviderMessage {
  readonly providerMessageId: string;
  readonly remoteJid: string;
  /** fromMe=true → direction=OUTBOUND с пометкой sentOutsideTravelHub (решение №4). */
  readonly fromMe: boolean;
  readonly participant: string | null;
  readonly occurredAt: Date;
  readonly type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "other";
  readonly text: string | null;
  /** LID — стабильный внутренний идентификатор (если провайдер его прислал). */
  readonly lid: string | null;
  /** PN (phone number) отправителя, если провайдер его прислал. */
  readonly senderPn: string | null;
  /** Медиа (M3+): null/undefined у текста и when download не удался. */
  readonly media?: WhatsAppInboundMedia | null;
}

/** Подтверждение доставки от провайдера (только реально полученные receipts). */
export interface WhatsAppDeliveryUpdate {
  readonly providerMessageId: string;
  readonly status: "sent" | "delivered" | "read";
  readonly occurredAt: Date;
}

export interface WhatsAppSendCommand {
  /** JID получателя (после разрешения контакта). */
  readonly recipientJid: string;
  /** Текст (или caption, если передан media). */
  readonly text: string;
  /** Файл (M3+): уходит documentMessage; текст — caption. */
  readonly media?: WhatsAppSendMedia | null;
  /** Наш id (operation key): провайдер должен использовать его как messageId. */
  readonly messageId: string;
  /** Явный таймаут отправки (иначе — sendTimeoutMs конфигурации). */
  readonly timeoutMs?: number;
}

export interface WhatsAppSendResult {
  readonly providerMessageId: string;
  readonly sentAt: Date;
}

/**
 * Результат Reconcile (решение №5, M2): провайдер наблюдал факт отправки/
 * доставления по сохранённому providerMessageId (receipt/echo в этой сессии).
 */
export interface WhatsAppReconcileResult {
  readonly status: "sent" | "delivered" | "read";
  readonly observedAt: Date;
}

export type Unsubscribe = () => void;

/** Контракт провайдера WhatsApp-транспорта. */
export interface WhatsAppProvider {
  readonly capabilities: WhatsAppCapabilities;

  /** Инициализация соединения. Защищена от конкурентных вызовов (mutex). */
  start(): Promise<void>;

  /**
   * Graceful shutdown: перестать принимать, дождаться безопасных операций
   * (с таймаутом), сохранить auth state, закрыть сокет, освободить lease.
   * Идемпотентен.
   */
  stop(reason?: string): Promise<void>;

  /** Явный logout: уничтожить сессию → DISCONNECTED (без auto-reconnect). */
  logout(): Promise<void>;

  getSnapshot(): WhatsAppConnectionSnapshot;

  onStateChange(listener: (snapshot: WhatsAppConnectionSnapshot) => void): Unsubscribe;
  onInbound(listener: (message: WhatsAppInboundProviderMessage) => void): Unsubscribe;
  onDeliveryUpdate(listener: (update: WhatsAppDeliveryUpdate) => void): Unsubscribe;

  /**
   * Отправка сообщения. Бросает типизированные WhatsAppProviderError:
   * см. whatsapp-errors.ts (retryable — единственное, что решает outbox).
   */
  send(command: WhatsAppSendCommand): Promise<WhatsAppSendResult>;

  /**
   * Reconcile (M2, решение №5): evidence по сохранённому providerMessageId.
   * null — провайдер не наблюдал подтверждений (НЕ означает, что не отправлено:
   * если process упал до получения receipt, evidence может отсутствовать).
   */
  reconcile(providerMessageId: string): Promise<WhatsAppReconcileResult | null>;

  /**
   * LID→PN по известным кандидатам (§10): WhatsApp маскирует номера
   * (remoteJid=`…@lid`), обратный резолв сервер не отдаёт — HUB сверяет
   * кандидатов (CRM-номера) через pn→lid. Опционально: mock/Cloud API может
   * не поддерживать (тогда null — диалог остаётся без canonicalPhone).
   */
  findPhoneByLid?(lidJid: string, candidatePhones: string[]): Promise<string | null>;
}
