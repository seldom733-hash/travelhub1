import type { WhatsAppOutboundStatus } from "../../../generated/prisma/enums";

/**
 * M2: outbound lifecycle исходящего сообщения (D6, решение владельца M2):
 *
 *   CREATED → QUEUED → SENDING → SENT → DELIVERED → READ
 *   SENDING → FAILED_RETRYABLE | FAILED_PERMANENT | UNKNOWN
 *   UNKNOWN → (Reconcile: DELIVERED/READ/SENT) | (Mark failed: FAILED_PERMANENT)
 *             | (Retry anyway: QUEUED)
 *
 * Правила:
 *  - автоматических переходов из UNKNOWN нет (at-most-once, решение №5):
 *    только явные recovery-действия с audit;
 *  - crash в SENDING → UNKNOWN (recoverStaleSending), автоповтор запрещён;
 *  - статусы SENT/DELIVERED/READ в communication.Communication НЕ записываются
 *    (только whatsapp.WhatsAppOutboundMessage).
 */

export const WHATSAPP_OUTBOUND_TRANSITIONS: Readonly<
  Record<WhatsAppOutboundStatus, readonly WhatsAppOutboundStatus[]>
> = {
  CREATED: ["QUEUED", "FAILED_PERMANENT"],
  QUEUED: ["SENDING", "FAILED_PERMANENT"],
  SENDING: ["SENT", "FAILED_RETRYABLE", "FAILED_PERMANENT", "UNKNOWN"],
  SENT: ["DELIVERED", "READ"],
  DELIVERED: ["READ"],
  READ: [],
  FAILED_RETRYABLE: ["QUEUED"],
  FAILED_PERMANENT: [],
  UNKNOWN: ["SENT", "DELIVERED", "READ", "FAILED_PERMANENT", "QUEUED"],
};

export class WhatsAppOutboundTransitionError extends Error {
  readonly from: WhatsAppOutboundStatus;
  readonly to: WhatsAppOutboundStatus;

  constructor(from: WhatsAppOutboundStatus, to: WhatsAppOutboundStatus) {
    super(`Illegal WhatsApp outbound transition: ${from} → ${to}`);
    this.name = "WhatsAppOutboundTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canOutboundTransition(
  from: WhatsAppOutboundStatus,
  to: WhatsAppOutboundStatus,
): boolean {
  if (from === to) return false;
  return WHATSAPP_OUTBOUND_TRANSITIONS[from].includes(to);
}

export function assertOutboundTransition(
  from: WhatsAppOutboundStatus,
  to: WhatsAppOutboundStatus,
): void {
  if (!canOutboundTransition(from, to)) throw new WhatsAppOutboundTransitionError(from, to);
}

/** Receipt → целевой статус (монотонный: назад — никогда). */
export type WhatsAppReceiptKind = "sent" | "delivered" | "read";

const RECEIPT_TARGET: Readonly<Record<WhatsAppReceiptKind, WhatsAppOutboundStatus>> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
};

const RECEIPT_RANK: Readonly<Record<WhatsAppOutboundStatus, number>> = {
  CREATED: 0,
  QUEUED: 0,
  SENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED_RETRYABLE: -1,
  FAILED_PERMANENT: -1,
  UNKNOWN: -1,
};

/**
 * Статус-линейка, в которой receipt имеет право менять статус:
 * только реально отправленные (SENT/DELIVERED). Прочие статусы
 * (в т.ч. UNKNOWN) получают ТОЛЬКО evidence-колонки.
 */
export function receiptEligibleTarget(
  current: WhatsAppOutboundStatus,
  receipt: WhatsAppReceiptKind,
): WhatsAppOutboundStatus | null {
  if (current !== "SENT" && current !== "DELIVERED") return null;
  const target = RECEIPT_RANK[RECEIPT_TARGET[receipt]] ?? null;
  if (target === null) return null;
  return target > RECEIPT_RANK[current] ? RECEIPT_TARGET[receipt] : null;
}

/** Evidence-колонка для receipt (заполняется даже в UNKNOWN). */
export function receiptEvidenceField(
  receipt: WhatsAppReceiptKind,
): "sentAt" | "deliveredAt" | "readAt" {
  switch (receipt) {
    case "sent":
      return "sentAt";
    case "delivered":
      return "deliveredAt";
    case "read":
      return "readAt";
  }
}

/**
 * Crash-recovery: строка в SENDING старше порога → UNKNOWN
 * (send начался, результат неизвестен; автоповтор запрещён — решение №5).
 */
export function isStaleSending(updatedAt: Date, now: Date, sendTimeoutMs: number, graceMs = 30_000): boolean {
  return now.getTime() - updatedAt.getTime() > sendTimeoutMs + graceMs;
}

/** Целевой статус Reconcile по накопленным evidence-колонкам. */
export function reconcileTargetFromEvidence(row: {
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
}): WhatsAppOutboundStatus | null {
  if (row.readAt) return "READ";
  if (row.deliveredAt) return "DELIVERED";
  if (row.sentAt) return "SENT";
  return null;
}
