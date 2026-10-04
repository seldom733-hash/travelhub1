/**
 * Типизированные ошибки WhatsApp-провайдера (мастер-промпт §6, D7).
 *
 * `retryable` — единственное поле, по которому outbox принимает решение
 * о повторе; все остальные причины остаются для людей/диагностики.
 * Ошибки контракта: WhatsAppNotConnectedError, WhatsAppAuthenticationError,
 * WhatsAppSessionError, WhatsAppRateLimitError, WhatsAppInvalidRecipientError,
 * WhatsAppMessageSendError, WhatsAppProviderError (fallback).
 */

export type WhatsAppErrorKind =
  | "not_connected"
  | "authentication"
  | "session"
  | "rate_limit"
  | "invalid_recipient"
  | "message_send"
  | "provider";

export interface WhatsAppProviderErrorOptions {
  /** Можно ли повторять операцию (по решению D7). */
  readonly retryable: boolean;
  /** Исходная ошибка-первоисточник (не попадает в ответы API). */
  readonly cause?: unknown;
  /**
   * M2 (решение №5): true — send мог ФАКТИЧЕСКИ начаться (timeout/разрыв
   * во время отправки), исход неизвестен → outbound уходит в UNKNOWN
   * (at-most-once), автоповтор запрещён; recovery только Reconcile/Mark
   * failed/Retry anyway с подтверждением и audit.
   */
  readonly ambiguous?: boolean;
}

export class WhatsAppProviderError extends Error {
  readonly kind: WhatsAppErrorKind;
  readonly retryable: boolean;
  /** Исход отправки неизвестен (см. WhatsAppProviderErrorOptions.ambiguous). */
  readonly ambiguous: boolean;

  constructor(kind: WhatsAppErrorKind, message: string, options: WhatsAppProviderErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "WhatsAppProviderError";
    this.kind = kind;
    this.retryable = options.retryable;
    this.ambiguous = options.ambiguous ?? false;
  }
}

/** Нет соединения / провайдер не инициализирован — повтор возможен. */
export class WhatsAppNotConnectedError extends WhatsAppProviderError {
  constructor(message = "WhatsApp provider is not connected", cause?: unknown) {
    super("not_connected", message, { retryable: true, cause });
    this.name = "WhatsAppNotConnectedError";
  }
}

/** Аутентификация сессии невалидна (logged out / credentials rejected). */
export class WhatsAppAuthenticationError extends WhatsAppProviderError {
  constructor(message = "WhatsApp authentication failed", cause?: unknown) {
    super("authentication", message, { retryable: false, cause });
    this.name = "WhatsAppAuthenticationError";
  }
}

/** Проблема сессии (session replaced / lease lost / state corrupt). */
export class WhatsAppSessionError extends WhatsAppProviderError {
  constructor(message = "WhatsApp session error", cause?: unknown) {
    super("session", message, { retryable: false, cause });
    this.name = "WhatsAppSessionError";
  }
}

/** Rate limit провайдера — повтор с backoff разрешён. */
export class WhatsAppRateLimitError extends WhatsAppProviderError {
  constructor(message = "WhatsApp rate limit exceeded", cause?: unknown) {
    super("rate_limit", message, { retryable: true, cause });
    this.name = "WhatsAppRateLimitError";
  }
}

/** Невалидный получатель (нет JID / номер не в WhatsApp). */
export class WhatsAppInvalidRecipientError extends WhatsAppProviderError {
  constructor(message = "WhatsApp recipient is invalid", cause?: unknown) {
    super("invalid_recipient", message, { retryable: false, cause });
    this.name = "WhatsAppInvalidRecipientError";
  }
}

/**
 * Ошибка отправки конкретного сообщения. `retryable` передаётся явно:
 * провайдер сам знает, был ли это таймаут (повтор) или reject (нет).
 * `ambiguous=true` — исход неизвестен (send начался) → UNKNOWN, не FAILED_*.
 */
export class WhatsAppMessageSendError extends WhatsAppProviderError {
  constructor(message: string, retryable: boolean, cause?: unknown, ambiguous = false) {
    super("message_send", message, { retryable, cause, ambiguous });
    this.name = "WhatsAppMessageSendError";
  }
}
