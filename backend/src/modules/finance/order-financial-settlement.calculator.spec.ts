import { calculateCancellationSettlement, type CancellationSettlementInput } from "./order-financial-settlement.calculator";

const base: CancellationSettlementInput = {
  originalAmount: "2000.00",
  capturedAmount: "1200.00",
  refundedAmount: "300.00",
  pendingRefundAmount: "0.00",
  pendingPaymentsCount: 0,
  activeRefundsCount: 0,
  terminal: true,
  terminalKind: "CANCELLED",
  cancellationConfirmed: true,
  finalCustomerLiability: "900.00",
  penaltyAmount: "900.00",
  platformPenaltyShare: "400.00",
  supplierPenaltyShare: "500.00",
  penaltyReason: "Non-refundable hotel cancellation fee",
  ledgerComplete: true,
};

describe("calculateCancellationSettlement", () => {
  it("scenario A: penalty retained, unpaid part written off", () => {
    const r = calculateCancellationSettlement(base);
    expect(r.status).toBe("FINANCIALLY_SETTLED_WITH_PENALTY");
    expect(r.remainingToPay).toBe("0");
    expect(r.remainingToRefund).toBe("0");
    expect(r.annulledUnpaidAmount).toBe("800");
    expect(r.blockers).toEqual([]);
  });

  it("scenario B: full refund, unpaid part written off", () => {
    const r = calculateCancellationSettlement({
      ...base,
      originalAmount: "1800.00",
      capturedAmount: "540.00",
      refundedAmount: "540.00",
      finalCustomerLiability: "0.00",
      penaltyAmount: "0.00",
      platformPenaltyShare: "0.00",
      supplierPenaltyShare: "0.00",
      penaltyReason: null,
    });
    expect(r.status).toBe("FINANCIALLY_SETTLED_FULL_REFUND");
    expect(r.remainingToPay).toBe("0");
    expect(r.remainingToRefund).toBe("0");
    expect(r.annulledUnpaidAmount).toBe("1260");
  });

  it("penalty greater than received money leaves a client payable", () => {
    const r = calculateCancellationSettlement({
      ...base,
      capturedAmount: "500.00",
      refundedAmount: "0.00",
      finalCustomerLiability: "700.00",
      penaltyAmount: "700.00",
      platformPenaltyShare: "400.00",
      supplierPenaltyShare: "300.00",
    });
    expect(r.remainingToPay).toBe("200");
    expect(r.remainingToRefund).toBe("0");
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("REMAINING_TO_PAY");
  });

  it("unpaid cancelled order is not a debt", () => {
    const r = calculateCancellationSettlement({
      ...base,
      capturedAmount: "0.00",
      refundedAmount: "0.00",
      finalCustomerLiability: "0.00",
      penaltyAmount: "0.00",
      platformPenaltyShare: "0.00",
      supplierPenaltyShare: "0.00",
      penaltyReason: null,
    });
    expect(r.status).toBe("FINANCIALLY_SETTLED_NO_CHARGES");
    expect(r.remainingToPay).toBe("0");
    expect(r.annulledUnpaidAmount).toBe("2000");
  });

  it("pending refund blocks closure", () => {
    const r = calculateCancellationSettlement({
      ...base,
      pendingRefundAmount: "100.00",
      activeRefundsCount: 1,
      finalCustomerLiability: "800.00",
    });
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("PENDING_REFUNDS");
  });

  it("incomplete ledger blocks closure", () => {
    const r = calculateCancellationSettlement({ ...base, ledgerComplete: false });
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("LEDGER_INCOMPLETE");
  });

  it("penalty shares must add up to the penalty", () => {
    const r = calculateCancellationSettlement({
      ...base,
      platformPenaltyShare: "400.00",
      supplierPenaltyShare: "400.00",
    });
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("PENALTY_SPLIT_MISMATCH");
  });

  it("no final liability means no automatic settlement", () => {
    const r = calculateCancellationSettlement({ ...base, finalCustomerLiability: null });
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("FINAL_LIABILITY_NOT_CONFIRMED");
  });

  it("full penalty retains all captured money", () => {
    const r = calculateCancellationSettlement({
      ...base, originalAmount: "1000.00", capturedAmount: "300.00", refundedAmount: "0.00",
      finalCustomerLiability: "300.00", penaltyAmount: "300.00", platformPenaltyShare: "300.00", supplierPenaltyShare: "0.00",
    });
    expect(r.status).toBe("FINANCIALLY_SETTLED_WITH_PENALTY");
    expect(r.remainingToRefund).toBe("0");
    expect(r.annulledUnpaidAmount).toBe("700");
  });

  it("supplier fault gives full refund and zero penalty", () => {
    const r = calculateCancellationSettlement({
      ...base, originalAmount: "1000.00", capturedAmount: "300.00", refundedAmount: "300.00",
      finalCustomerLiability: "0.00", penaltyAmount: "0.00", platformPenaltyShare: "0.00", supplierPenaltyShare: "0.00", penaltyReason: null,
    });
    expect(r.status).toBe("FINANCIALLY_SETTLED_FULL_REFUND");
    expect(r.remainingToRefund).toBe("0");
  });

  it("partial refund settles with remaining penalty", () => {
    const r = calculateCancellationSettlement({
      ...base, originalAmount: "1000.00", capturedAmount: "300.00", refundedAmount: "200.00",
      finalCustomerLiability: "100.00", penaltyAmount: "100.00", platformPenaltyShare: "100.00", supplierPenaltyShare: "0.00",
    });
    expect(r.status).toBe("FINANCIALLY_SETTLED_WITH_PENALTY");
    expect(r.remainingToRefund).toBe("0");
  });

  it("penalty above final liability is blocked", () => {
    const r = calculateCancellationSettlement({
      ...base, finalCustomerLiability: "50.00", penaltyAmount: "100.00", clientPenaltyAmount: "100.00",
      platformPenaltyShare: "100.00", supplierPenaltyShare: "0.00",
    });
    expect(r.status).toBe("PENDING_SETTLEMENT");
    expect(r.blockers).toContain("PENALTY_EXCEEDS_LIABILITY");
  });
});
