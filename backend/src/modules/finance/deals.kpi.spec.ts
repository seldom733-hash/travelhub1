import { computeDealIncome } from "./deals.service";

const base = {
  isCancelledDeal: false,
  completed: false,
  sales: 1000,
  cost: 800,
  clientReceived: 0,
  clientRefunded: 0,
  supplierPaid: 0,
  supplierRefunded: 0,
  clientWriteOff: 0,
};

describe("Deals KPI income model", () => {
  it("1 active deal has expected margin only", () => {
    const r = computeDealIncome(base);
    expect(r.expectedIncome).toBe(200);
    expect(r.currentIncome).toBe(0);
  });

  it("2 completed deal recognizes accrual profit with full payment", () => {
    const r = computeDealIncome({ ...base, completed: true, clientReceived: 1000, supplierPaid: 800 });
    expect(r.expectedIncome).toBe(0);
    expect(r.currentIncome).toBe(200);
  });

  it("3 completed deal with partial payment still recognizes revenue", () => {
    const r = computeDealIncome({ ...base, completed: true, clientReceived: 700, supplierPaid: 800 });
    expect(r.currentIncome).toBe(200);
  });

  it("4 cancelled deal with full refund has zero result", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 300, clientRefunded: 300, supplierPaid: 250, supplierRefunded: 250 });
    expect(r.cancellationResult).toBe(0);
    expect(r.cancellationIncome).toBe(0);
    expect(r.cancellationLoss).toBe(0);
  });

  it("5 cancelled partial refunds produce loss", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 300, clientRefunded: 200, supplierPaid: 250, supplierRefunded: 100 });
    expect(r.cancellationResult).toBe(-50);
    expect(r.cancellationLoss).toBe(-50);
    expect(r.currentIncome).toBe(0);
  });

  it("6 cancelled full penalty produces income", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 300, clientRefunded: 0, supplierPaid: 250, supplierRefunded: 250 });
    expect(r.cancellationIncome).toBe(300);
  });

  it("7 cancelled zero result", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 300, clientRefunded: 100, supplierPaid: 250, supplierRefunded: 50 });
    expect(r.cancellationResult).toBe(0);
  });

  it("8 closed cancelled with written-off debt is expense, not income", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientWriteOff: 100, clientReceived: 0, supplierPaid: 0 });
    expect(r.currentIncome).toBe(0);
    expect(r.writeOffExpense).toBe(100);
  });

  it("9 closed cancelled loss", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 100, clientRefunded: 150, supplierPaid: 100, supplierRefunded: 50 });
    expect(r.cancellationLoss).toBe(-100);
  });

  it("10 closed cancelled positive result", () => {
    const r = computeDealIncome({ ...base, isCancelledDeal: true, clientReceived: 200, clientRefunded: 50, supplierPaid: 100, supplierRefunded: 50 });
    expect(r.cancellationIncome).toBe(100);
  });
});
