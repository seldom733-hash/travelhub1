import type { WhatsAppConnectionState } from "../../../generated/prisma/enums";

/**
 * Connection state machine (мастер-промпт v2.3 §6.2).
 *
 * Явная таблица допустимых переходов + правила разбора причин разрыва
 * Baileys-соединения. Состояние НИКОГДА не смешивается со статусами
 * Communication/Order/Booking — это состояние транспорта.
 *
 * Базовая цепочка:
 *   DISCONNECTED → INITIALIZING → QR_REQUIRED → CONNECTING → CONNECTED
 *   CONNECTED → RECONNECTING → CONNECTED | ERROR
 *   любое → LOGGING_OUT → DISCONNECTED
 */

export class WhatsAppStateTransitionError extends Error {
  readonly from: WhatsAppConnectionState;
  readonly to: WhatsAppConnectionState;

  constructor(from: WhatsAppConnectionState, to: WhatsAppConnectionState) {
    super(`Illegal WhatsApp connection transition: ${from} → ${to}`);
    this.name = "WhatsAppStateTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Допустимые переходы (§6.2 + M2-амендмент владельца: LOGGED_OUT — явный
 * терминал удалённого logout). Self-transitions запрещены; LOGGING_OUT
 * доступен из любого состояния («any → LOGGING_OUT → DISCONNECTED»).
 */
export const WHATSAPP_ALLOWED_TRANSITIONS: Readonly<
  Record<WhatsAppConnectionState, readonly WhatsAppConnectionState[]>
> = {
  DISCONNECTED: ["INITIALIZING", "LOGGING_OUT"],
  INITIALIZING: ["QR_REQUIRED", "CONNECTING", "ERROR", "DISCONNECTED", "LOGGING_OUT", "LOGGED_OUT"],
  QR_REQUIRED: ["CONNECTING", "ERROR", "DISCONNECTED", "LOGGING_OUT", "LOGGED_OUT"],
  CONNECTING: ["CONNECTED", "QR_REQUIRED", "ERROR", "DISCONNECTED", "LOGGING_OUT", "LOGGED_OUT"],
  CONNECTED: ["RECONNECTING", "ERROR", "LOGGING_OUT", "LOGGED_OUT"],
  RECONNECTING: ["CONNECTED", "ERROR", "DISCONNECTED", "LOGGING_OUT", "LOGGED_OUT"],
  ERROR: ["INITIALIZING", "DISCONNECTED", "LOGGING_OUT", "LOGGED_OUT"],
  LOGGING_OUT: ["DISCONNECTED"],
  LOGGED_OUT: ["DISCONNECTED", "INITIALIZING", "LOGGING_OUT"],
};

/** Допустим ли переход (таблица §6.2; self-transition — запрещён). */
export function canTransition(
  from: WhatsAppConnectionState,
  to: WhatsAppConnectionState,
): boolean {
  return from !== to && WHATSAPP_ALLOWED_TRANSITIONS[from].includes(to);
}

/** Бросает WhatsAppStateTransitionError при недопустимом переходе. */
export function assertTransition(
  from: WhatsAppConnectionState,
  to: WhatsAppConnectionState,
): void {
  if (!canTransition(from, to)) throw new WhatsAppStateTransitionError(from, to);
}

/**
 * Причина разрыва соединения (Baileys disconnect codes, §6.2).
 * Неизвестные причины НЕ угадываются → "unknown".
 */
export type WhatsAppDisconnectReason =
  | "loggedOut"
  | "connectionReplaced"
  | "authFailure"
  | "restartRequired"
  | "network"
  | "shutdown"
  | "unknown";

/**
 * Куда переходить после разрыва (правила §6.2 + M2-амендмент владельца):
 *  - loggedOut → LOGGED_OUT (терминал удалённого logout; без auto-reconnect);
 *  - connectionReplaced → ERROR (не воевать за сессию, пересмотреть lease);
 *  - authFailure → ERROR, без бесконечных попыток;
 *  - network/restartRequired → RECONNECTING (транзиент);
 *  - shutdown → LOGGING_OUT (graceful);
 *  - unknown → ERROR (никаких догадок, R6).
 */
export function stateAfterDisconnect(reason: WhatsAppDisconnectReason): WhatsAppConnectionState {
  switch (reason) {
    case "loggedOut":
      return "LOGGED_OUT";
    case "connectionReplaced":
    case "authFailure":
    case "unknown":
      return "ERROR";
    case "restartRequired":
    case "network":
      return "RECONNECTING";
    case "shutdown":
      return "LOGGING_OUT";
  }
}

/** Разрешён ли auto-reconnect после причины (логические причины не ретраим). */
export function canAutoReconnect(reason: WhatsAppDisconnectReason): boolean {
  return reason === "network" || reason === "restartRequired";
}
