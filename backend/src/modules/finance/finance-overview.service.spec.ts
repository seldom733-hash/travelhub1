/**
 * UNIFIED FINANCE CENTER Phase 3 — FinanceOverviewService tests.
 *
 * Контракт (§2 «Profit is not cash flow»):
 *  - obligations: AZN-суммы из SupplierObligation (CANCELLED исключены);
 *    aznAmount UNKNOWN не суммируется, раскрыт через unknownCount;
 *  - supplierPayouts: AZN из SupplierPayout.aznAmount;
 *  - expectedMargin: из frozen snapshot (customerFinalPrice AZN − supplierCost
 *    AZN); PARTIAL/UNKNOWN при отсутствии snapshot/fx (never zero);
 *  - customerReceipts/customerDebt: source-currency разбивка + AZN=UNKNOWN
 *    (нет frozen AZN-курса — не изобретаем);
 *  - actualProfit/netCashFlow: UNAVAILABLE (recognition policy — Phase 5),
 *    НИКОГДА не «captured − payouts».
 */
import { Prisma } from "../../generated/prisma/client";
import { FinanceOverviewService } from "./finance-overview.service";

const aznSnapshot = {
  supplierCurrency: "USD",
  supplierPrice: 1000,
  customerCurrency: "AZN",
  customerFinalPrice: 2000,
  fx: { aznAmount: 1700 },
};
// AZN-source (нет fx): supplierPrice уже в AZN.
const aznSourceSnapshot = {
  supplierCurrency: "AZN",
  supplierPrice: 500,
  customerCurrency: "AZN",
  customerFinalPrice: 900,
};
// Нет frozen AZN-стоимости поставщика (USD без fx) → margin UNKNOWN.
const unknownSnapshot = {
  supplierCurrency: "USD",
  supplierPrice: 1000,
  customerCurrency: "AZN",
  customerFinalPrice: 2000,
};

function makeService(opts: {
  obligations?: unknown;
  payouts?: unknown;
  orders?: Array<{ commercialSnapshot: unknown }>;
  payments?: unknown[];
  orderGroups?: unknown[];
}): FinanceOverviewService {
  const prisma = {
    supplierObligation: {
      aggregate: jest.fn().mockResolvedValue(opts.obligations ?? { _sum: { aznAmount: null, paidAmount: null, remainingAmount: null }, _count: { _all: 0 } }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    supplierPayout: {
      aggregate: jest.fn().mockResolvedValue(opts.payouts ?? { _sum: { aznAmount: null }, _count: { _all: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    supplierPayoutAllocation: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    order: {
      findMany: jest.fn().mockResolvedValue(opts.orders ?? []),
      groupBy: jest.fn().mockResolvedValue(opts.orderGroups ?? []),
    },
    payment: {
      groupBy: jest.fn().mockResolvedValue(opts.payments ?? []),
    },
  };
  return new FinanceOverviewService(prisma as never);
}

const D = (v: string | number | null) => (v == null ? null : new Prisma.Decimal(String(v)));

describe("FinanceOverviewService (UNIFIED FINANCE CENTER Phase 3)", () => {
  it("obligations: AZN-суммы, CANCELLED исключены, unknown раскрыт", async () => {
    const s = makeService({
      obligations: { _sum: { aznAmount: D(3400), paidAmount: D(850), remainingAmount: D(2550) }, _count: { _all: 3 } },
    });
    // count() вызывается second раз для unknown — мок вернёт 0 из opts? зададим явно.
    (s as unknown as { prisma: { supplierObligation: { count: jest.Mock } } }).prisma.supplierObligation.count.mockResolvedValue(1);
    const o = await s.getOverview();
    expect(o.obligations.totalAzn).toBe("3400");
    expect(o.obligations.paidAzn).toBe("850");
    expect(o.obligations.remainingAzn).toBe("2550");
    expect(o.obligations.count).toBe(3);
    expect(o.obligations.unknownCount).toBe(1);
  });

  it("supplierPayouts: AZN из payout.aznAmount", async () => {
    const s = makeService({ payouts: { _sum: { aznAmount: D(850) }, _count: { _all: 2 } } });
    const o = await s.getOverview();
    expect(o.supplierPayouts.paidAzn).toBe("850");
    expect(o.supplierPayouts.count).toBe(2);
  });

  it("expectedMargin: snapshot AZN (fx) → маржа = final − cost", async () => {
    const s = makeService({ orders: [{ commercialSnapshot: aznSnapshot }] });
    const o = await s.getOverview();
    // 2000 − 1700 = 300
    expect(o.expectedMargin.amount).toBe("300");
    expect(o.expectedMargin.availability).toBe("OK");
    expect(o.expectedMargin.knownCount).toBe(1);
  });

  it("expectedMargin: AZN-source snapshot (без fx) → final − supplierPrice", async () => {
    const s = makeService({ orders: [{ commercialSnapshot: aznSourceSnapshot }] });
    const o = await s.getOverview();
    // 900 − 500 = 400
    expect(o.expectedMargin.amount).toBe("400");
    expect(o.expectedMargin.availability).toBe("OK");
  });

  it("expectedMargin: нет frozen AZN-стоимости → UNKNOWN (never zero)", async () => {
    const s = makeService({ orders: [{ commercialSnapshot: unknownSnapshot }] });
    const o = await s.getOverview();
    expect(o.expectedMargin.amount).toBeNull();
    expect(o.expectedMargin.availability).toBe("UNKNOWN");
    expect(o.expectedMargin.unknownCount).toBe(1);
  });

  it("expectedMargin: смесь known/unknown → PARTIAL с раскрытием", async () => {
    const s = makeService({ orders: [{ commercialSnapshot: aznSnapshot }, { commercialSnapshot: unknownSnapshot }] });
    const o = await s.getOverview();
    expect(o.expectedMargin.amount).toBe("300");
    expect(o.expectedMargin.availability).toBe("PARTIAL");
    expect(o.expectedMargin.knownCount).toBe(1);
    expect(o.expectedMargin.unknownCount).toBe(1);
  });

  it("customerReceipts: byCurrency из CAPTURED, AZN=UNKNOWN (не изобретаем)", async () => {
    const s = makeService({ payments: [{ currency: "USD", _sum: { amount: D(500) } }, { currency: "AZN", _sum: { amount: D(300) } }] });
    const o = await s.getOverview();
    expect(o.customerReceipts.byCurrency).toEqual([
      { currency: "AZN", amount: "300" },
      { currency: "USD", amount: "500" },
    ]);
    expect(o.customerReceipts.azn.amount).toBeNull();
    expect(o.customerReceipts.azn.availability).toBe("UNKNOWN");
  });

  it("customerDebt: byCurrency (amount − paid), AZN=UNKNOWN", async () => {
    const s = makeService({ orderGroups: [{ currency: "USD", _sum: { amount: D(1000), paidAmount: D(400) } }] });
    const o = await s.getOverview();
    expect(o.customerDebt.byCurrency).toEqual([{ currency: "USD", amount: "600" }]);
    expect(o.customerDebt.azn.amount).toBeNull();
    expect(o.customerDebt.azn.availability).toBe("UNKNOWN");
  });

  it("actualProfit и netCashFlow — UNAVAILABLE (не «captured − payouts»)", async () => {
    const s = makeService({
      obligations: { _sum: { aznAmount: D(1700), paidAmount: D(0), remainingAmount: D(1700) }, _count: { _all: 1 } },
      payouts: { _sum: { aznAmount: D(0) }, _count: { _all: 0 } },
      payments: [{ currency: "AZN", _sum: { amount: D(2000) } }],
    });
    const o = await s.getOverview();
    expect(o.actualProfit.amount).toBeNull();
    expect(o.actualProfit.availability).toBe("UNAVAILABLE");
    expect(o.netCashFlow.amount).toBeNull();
    expect(o.netCashFlow.availability).toBe("UNAVAILABLE");
    // Никогда не выводит profit как captured(2000) − payouts(0) = 2000.
    expect(o.actualProfit.amount).not.toBe("2000");
  });

  it("пустой snapshot (null) → margin UNKNOWN, не падает", async () => {
    const s = makeService({ orders: [{ commercialSnapshot: null }] });
    const o = await s.getOverview();
    expect(o.expectedMargin.amount).toBeNull();
    expect(o.expectedMargin.availability).toBe("UNKNOWN");
  });
});
