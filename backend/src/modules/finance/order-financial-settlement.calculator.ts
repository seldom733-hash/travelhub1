import { Prisma } from "../../generated/prisma/client";

/**
 * Pure cancellation/settlement formula. No I/O, no hidden state.
 *
 * Historical facts (Order.amount/paidAmount/refundedAmount and Payment/Refund
 * rows) are inputs only and are never rewritten. The calculator decides whether
 * the order may receive a FINANCIALLY_SETTLED_* status.
 */
export interface CancellationSettlementInput {
  originalAmount: string;
  capturedAmount: string;
  refundedAmount: string;
  pendingRefundAmount: string;
  pendingPaymentsCount: number;
  activeRefundsCount: number;
  terminal: boolean;
  terminalKind: "CANCELLED" | "COMPLETED" | null;
  cancellationConfirmed: boolean;
  finalCustomerLiability: string | null;
  penaltyAmount: string;
  platformPenaltyShare: string;
  supplierPenaltyShare: string;
  penaltyReason: string | null;
  ledgerComplete: boolean;
}

export type SettlementStatus =
  | "OPEN"
  | "PENDING_SETTLEMENT"
  | "FINANCIALLY_SETTLED"
  | "FINANCIALLY_SETTLED_WITH_PENALTY"
  | "FINANCIALLY_SETTLED_FULL_REFUND"
  | "FINANCIALLY_SETTLED_NO_CHARGES";

export interface CancellationSettlementResult {
  originalAmount: string;
  capturedAmount: string;
  refundedAmount: string;
  pendingRefundAmount: string;
  finalCustomerLiability: string | null;
  penaltyAmount: string;
  platformPenaltyShare: string;
  supplierPenaltyShare: string;
  annulledUnpaidAmount: string;
  remainingToPay: string;
  remainingToRefund: string;
  status: SettlementStatus;
  blockers: string[];
}

const money = (value: string, field: string): Prisma.Decimal => {
  const n = new Prisma.Decimal(value);
  if (n.isNegative()) throw new Error(`${field} must be >= 0`);
  return n;
};

const two = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toString();

export function calculateCancellationSettlement(
  input: CancellationSettlementInput,
): CancellationSettlementResult {
  const original = money(input.originalAmount, "originalAmount");
  const captured = money(input.capturedAmount, "capturedAmount");
  const refunded = money(input.refundedAmount, "refundedAmount");
  const pendingRefund = money(input.pendingRefundAmount, "pendingRefundAmount");
  const penalty = money(input.penaltyAmount, "penaltyAmount");
  const platformPenalty = money(input.platformPenaltyShare, "platformPenaltyShare");
  const supplierPenalty = money(input.supplierPenaltyShare, "supplierPenaltyShare");
  const blockers: string[] = [];

  if (input.pendingPaymentsCount > 0) blockers.push("PENDING_PAYMENTS");
  if (input.activeRefundsCount > 0 || pendingRefund.greaterThan(0)) blockers.push("PENDING_REFUNDS");
  if (penalty.greaterThan(0) && !input.penaltyReason?.trim()) blockers.push("PENALTY_JUSTIFICATION_MISSING");

  if (!input.terminal) {
    return {
      originalAmount: two(original),
      capturedAmount: two(captured),
      refundedAmount: two(refunded),
      pendingRefundAmount: two(pendingRefund),
      finalCustomerLiability: null,
      penaltyAmount: two(penalty),
      platformPenaltyShare: two(platformPenalty),
      supplierPenaltyShare: two(supplierPenalty),
      annulledUnpaidAmount: "0.00",
      remainingToPay: two(Prisma.Decimal.max(new Prisma.Decimal(0), original.minus(captured))),
      remainingToRefund: two(Prisma.Decimal.max(new Prisma.Decimal(0), captured.minus(refunded))),
      status: "OPEN",
      blockers,
    };
  }

  if (input.terminalKind === "CANCELLED" && !input.cancellationConfirmed) {
    blockers.push("CANCELLATION_NOT_CONFIRMED");
  }
  if (input.finalCustomerLiability == null) {
    blockers.push("FINAL_LIABILITY_NOT_CONFIRMED");
  }

  const finalLiability = input.terminalKind === "COMPLETED"
    ? original
    : input.finalCustomerLiability == null
      ? null
      : money(input.finalCustomerLiability, "finalCustomerLiability");

  if (!penalty.equals(platformPenalty.add(supplierPenalty))) {
    blockers.push("PENALTY_SPLIT_MISMATCH");
  }
  if (finalLiability != null && penalty.greaterThan(finalLiability)) {
    blockers.push("PENALTY_EXCEEDS_LIABILITY");
  }

  const netRetained = captured.minus(refunded);
  const remainingToPay = finalLiability == null
    ? new Prisma.Decimal(0)
    : Prisma.Decimal.max(new Prisma.Decimal(0), finalLiability.minus(netRetained));
  const remainingToRefund = finalLiability == null
    ? new Prisma.Decimal(0)
    : Prisma.Decimal.max(new Prisma.Decimal(0), netRetained.minus(finalLiability));
  const annulledUnpaid = input.terminalKind === "CANCELLED" && finalLiability != null
    ? Prisma.Decimal.max(new Prisma.Decimal(0), original.minus(Prisma.Decimal.max(captured, finalLiability)))
    : new Prisma.Decimal(0);

  if (!remainingToPay.isZero()) blockers.push("REMAINING_TO_PAY");
  if (!remainingToRefund.isZero()) blockers.push("REMAINING_TO_REFUND");
  if (!input.ledgerComplete) blockers.push("LEDGER_INCOMPLETE");

  let status: SettlementStatus;
  if (blockers.length > 0) {
    status = "PENDING_SETTLEMENT";
  } else if (penalty.greaterThan(0)) {
    status = "FINANCIALLY_SETTLED_WITH_PENALTY";
  } else if (finalLiability != null && finalLiability.isZero() && captured.greaterThan(0) && refunded.greaterThanOrEqualTo(captured)) {
    status = "FINANCIALLY_SETTLED_FULL_REFUND";
  } else if (finalLiability != null && finalLiability.isZero()) {
    status = "FINANCIALLY_SETTLED_NO_CHARGES";
  } else {
    status = "FINANCIALLY_SETTLED";
  }

  return {
    originalAmount: two(original),
    capturedAmount: two(captured),
    refundedAmount: two(refunded),
    pendingRefundAmount: two(pendingRefund),
    finalCustomerLiability: finalLiability == null ? null : two(finalLiability),
    penaltyAmount: two(penalty),
    platformPenaltyShare: two(platformPenalty),
    supplierPenaltyShare: two(supplierPenalty),
    annulledUnpaidAmount: two(annulledUnpaid),
    remainingToPay: two(remainingToPay),
    remainingToRefund: two(remainingToRefund),
    status,
    blockers: [...new Set(blockers)],
  };
}
