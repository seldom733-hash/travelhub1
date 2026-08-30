/**
 * Step 3.3 Analytics Foundation — Analytics Service Unit Tests (Remediated)
 *
 * Tests for remediated service logic:
 * - HIGH-2: Decimal arithmetic (no JS float corruption)
 * - HIGH-4: Partner isolation (resolvePartnerScope)
 * - MEDIUM-1: AOV computation
 * - MEDIUM-4: Multi-currency aggregation
 * - HIGH-5: Attribution metadata
 */

import { AnalyticsService } from "./analytics.service";
import { AnalyticsPeriodPreset } from "./analytics-period.resolver";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    refund: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    commission: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    partner: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    checkoutIntent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ cnt: BigInt(0) }]),
  } as any;
}

// ─── Decimal Arithmetic Tests ───────────────────────────────────────────────

describe("AnalyticsService — Decimal Arithmetic (HIGH-2)", () => {
  it("sumDecimalString handles single currency correctly", async () => {
    // Import the private function through the module
    // We test via service behavior: create mock that returns Decimal-like records
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "1", amount: "100.50", currency: "USD", status: "FULFILLED" },
      { id: "2", amount: "200.25", currency: "USD", status: "FULFILLED" },
    ]);
    prisma.payment.findMany.mockResolvedValue([
      { id: "p1", amount: "100.50", currency: "USD" },
      { id: "p2", amount: "200.25", currency: "USD" },
    ]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      {
        preset: AnalyticsPeriodPreset.MONTH,
        comparison: false,
      },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // 100.50 + 200.25 = 300.75 exactly
    expect(result.metrics.gmv.current).toBe("300.75");
    expect(result.metrics.revenue.current).toBe("300.75");
  });

  it("Decimal values do not produce floating-point corruption", async () => {
    const prisma = createMockPrisma();
    // Classic float corruption: 0.1 + 0.2 = 0.30000000000000004 in JS
    prisma.order.findMany.mockResolvedValue([
      { id: "1", amount: "0.10", currency: "USD", status: "FULFILLED" },
      { id: "2", amount: "0.20", currency: "USD", status: "FULFILLED" },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // Must be exactly "0.30", NOT "0.30000000000000004"
    expect(result.metrics.gmv.current).toBe("0.30");
  });

  it("Net Revenue subtracts correctly across currencies", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockImplementation((args: any) => {
      if (args.where?.status === "CAPTURED") {
        return Promise.resolve([
          { id: "p1", amount: "1000.00", currency: "USD" },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.refund.findMany.mockResolvedValue([
      { id: "r1", amount: "50.00", currency: "USD", status: "PROCESSED" },
    ]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // 1000.00 - 50.00 = 950.00
    expect(result.metrics.netRevenue.current).toBe("950.00");
  });

  it("handles large Decimal values without precision loss", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "1", amount: "999999.99", currency: "USD", status: "FULFILLED" },
      { id: "2", amount: "0.01", currency: "USD", status: "FULFILLED" },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.metrics.gmv.current).toBe("1000000.00");
  });
});

// ─── Partner Isolation Tests (HIGH-4) ───────────────────────────────────────

describe("AnalyticsService — Partner Isolation (HIGH-4)", () => {
  it("PARTNER role is scoped to own partnerId regardless of query param", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    // Partner A requests Partner B's data — should be scoped to Partner A
    await service.getPartnerPerformance(
      {
        preset: AnalyticsPeriodPreset.MONTH,
        partnerId: "partner-B-id",
      },
      { id: "u1", role: "PARTNER", partnerId: "partner-A-id" } as any,
    );

    // Orders should be filtered by partner-A, not partner-B
    const orderCall = prisma.order.findMany.mock.calls[0][0];
    expect(orderCall.where.sellerPartnerId).toBe("partner-A-id");
  });

  it("BUYER role throws ForbiddenException", async () => {
    const prisma = createMockPrisma();
    const service = new AnalyticsService(prisma);

    await expect(
      service.getPartnerPerformance(
        { preset: AnalyticsPeriodPreset.MONTH },
        { id: "u1", role: "BUYER", partnerId: null } as any,
      ),
    ).rejects.toThrow("BUYER role cannot access analytics");
  });

  it("ADMIN can query any partnerId", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    await service.getPartnerPerformance(
      {
        preset: AnalyticsPeriodPreset.MONTH,
        partnerId: "partner-B-id",
      },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    const orderCall = prisma.order.findMany.mock.calls[0][0];
    expect(orderCall.where.sellerPartnerId).toBe("partner-B-id");
  });
});

// ─── Attribution Metadata Tests (HIGH-5) ───────────────────────────────────

describe("AnalyticsService — Actor Attribution (HIGH-5)", () => {
  it("Company KPI includes attribution metadata", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.attribution).toBeDefined();
    expect(result.attribution!.actionFields).toContain("Order.createdBy");
    expect(result.attribution!.ownershipFields).toContain("Order.sellerPartnerId");
    expect(result.attribution!.outcomeFields).toContain("Commission.partnerId");
  });
});

// ─── AOV Tests (MEDIUM-1) ───────────────────────────────────────────────────

describe("AnalyticsService — AOV (MEDIUM-1)", () => {
  it("AOV = GMV / count(fulfilled orders)", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "1", amount: "100.00", currency: "USD", status: "FULFILLED" },
      { id: "2", amount: "200.00", currency: "USD", status: "FULFILLED" },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // GMV = 300.00, orders = 2, AOV = 150.00
    expect(result.metrics.averageOrderValue.current).toBe("150.00");
  });

  it("AOV returns 0.00 when no fulfilled orders", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.metrics.averageOrderValue.current).toBe("0.00");
  });
});

// ─── Multi-Currency Tests (MEDIUM-4) ────────────────────────────────────────

describe("AnalyticsService — Multi-Currency (MEDIUM-4)", () => {
  it("grouping by currency returns correct per-currency totals", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "1", amount: "100.00", currency: "USD", status: "FULFILLED" },
      { id: "2", amount: "200.00", currency: "EUR", status: "FULFILLED" },
      { id: "3", amount: "50.00", currency: "USD", status: "FULFILLED" },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // GMV: USD = 150.00, EUR = 200.00 → primary = USD 150.00
    expect(result.metrics.gmv.current).toBe("150.00");
  });
});

// ─── Revenue Uses paidAt (HIGH-1) ───────────────────────────────────────────

describe("AnalyticsService — Revenue uses paidAt (HIGH-1)", () => {
  it("payment queries use paidAt not createdAt", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    await service.getCompanyKpi(
      { preset: AnalyticsPeriodPreset.MONTH, comparison: false },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // Find the payment query call (should use paidAt)
    const paymentCalls = prisma.payment.findMany.mock.calls;
    const revenueCall = paymentCalls.find(
      (call: any) => call[0]?.where?.status === "CAPTURED",
    );
    expect(revenueCall).toBeDefined();
    expect(revenueCall[0].where.paidAt).toBeDefined();
    expect(revenueCall[0].where.createdAt).toBeUndefined();
  });
});

// ─── Financial Reconciliation Tests (HIGH-3) ────────────────────────────────

describe("AnalyticsService — Financial Reconciliation (HIGH-3)", () => {
  it("returns reconciliation summary with correct structure", async () => {
    const prisma = createMockPrisma();
    prisma.payment.findMany.mockResolvedValue([
      { id: "p1", amount: "500.00", currency: "USD" },
    ]);
    prisma.refund.findMany.mockResolvedValue([
      { id: "r1", amount: "50.00", currency: "USD" },
    ]);
    prisma.commission.findMany.mockResolvedValue([
      { id: "c1", amount: "25.00", currency: "USD" },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ cnt: BigInt(10) }]);

    const service = new AnalyticsService(prisma);
    const result = await service.getFinancialReconciliation(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.currency).toBe("USD");
    expect(result.totalPayments).toBe("500.00");
    expect(result.totalRefunds).toBe("50.00");
    expect(result.netPayments).toBe("450.00");
    expect(result.totalCommission).toBe("25.00");
    expect(result.totalLedgerEntries).toBe(10);
  });

  it("reconciliation is strictly read-only", async () => {
    const prisma = createMockPrisma();
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([{ cnt: BigInt(0) }]);

    const service = new AnalyticsService(prisma);
    await service.getFinancialReconciliation(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // Verify no write operations were called
    expect(prisma.order.create).toBeUndefined();
    expect(prisma.payment.create).toBeUndefined();
    expect(prisma.payment.update).toBeUndefined();
  });
});

// ─── Partner Performance Metrics (HIGH-6) ───────────────────────────────────

describe("AnalyticsService — Partner Performance (HIGH-6)", () => {
  it("returns real revenue and commission values", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", sellerPartnerId: "p1", amount: "100.00", currency: "USD" },
    ]);
    prisma.payment.findMany.mockImplementation((args: any) => {
      // Revenue call
      if (args.where?.status === "CAPTURED") {
        return Promise.resolve([
          { amount: "100.00", currency: "USD", orderId: "o1" },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.commission.findMany.mockResolvedValue([
      { partnerId: "p1", amount: "10.00", currency: "USD" },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([
      { id: "p1", name: "Test Partner" },
    ]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getPartnerPerformance(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.partners.length).toBe(1);
    expect(result.partners[0].revenue).toBe("100.00");
    expect(result.partners[0].commission).toBe("10.00");
    expect(result.partners[0].gmv).toBe("100.00");
    expect(result.partners[0].partnerName).toBe("Test Partner");
  });

  it("returns booking completion rate", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([
      { id: "b1", status: "CONFIRMED", productId: "prod1" },
      { id: "b2", status: "COMPLETED", productId: "prod1" },
      { id: "b3", status: "COMPLETED", productId: "prod1" },
    ]);
    prisma.partner.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([
      { id: "prod1", partnerId: "p1" },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getPartnerPerformance(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // RT13: New formula: completedBookings / totalBookings (all statuses)
    // 3 bookings total: 1 CONFIRMED + 2 COMPLETED
    // rate = 2/3 = 66.67%
    const partner = result.partners.find((p) => p.partnerId === "p1");
    expect(partner).toBeDefined();
    expect(partner!.bookingCompletionRate).toBe(66.67);
  });
});

// ─── Round 2: Time Series payments uses paidAt (HIGH-NEW-2) ──────────────────

describe("AnalyticsService — Time Series payments paidAt (HIGH-NEW-2)", () => {
  it("payments metric uses paidAt not createdAt", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.checkoutIntent.findMany.mockResolvedValue([]);
    // Time series buckets → each bucket calls getMetricCountForBucket
    prisma.payment.count.mockResolvedValue(5);

    const service = new AnalyticsService(prisma);
    await service.getTimeSeries(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
      "payments",
    );

    // Find the payment.count call — should use paidAt
    const countCalls = prisma.payment.count.mock.calls;
    expect(countCalls.length).toBeGreaterThan(0);
    const firstCall = countCalls[0][0];
    expect(firstCall.where.paidAt).toBeDefined();
    expect(firstCall.where.createdAt).toBeUndefined();
    expect(firstCall.where.status).toBe("CAPTURED");
  });
});

// ─── Round 2: Partner Performance integer-cent exactness (HIGH-NEW-1) ────────

describe("AnalyticsService — Partner Performance integer-cent (HIGH-NEW-1)", () => {
  it("does not produce float corruption with classic 0.10 + 0.20 + 0.30", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", sellerPartnerId: "p1", amount: "0.10", currency: "USD" },
      { id: "o2", sellerPartnerId: "p1", amount: "0.20", currency: "USD" },
      { id: "o3", sellerPartnerId: "p1", amount: "0.30", currency: "USD" },
    ]);
    prisma.payment.findMany.mockImplementation((args: any) => {
      if (args.where?.status === "CAPTURED") {
        return Promise.resolve([
          { amount: "0.10", currency: "USD", orderId: "o1" },
          { amount: "0.20", currency: "USD", orderId: "o2" },
          { amount: "0.30", currency: "USD", orderId: "o3" },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.commission.findMany.mockResolvedValue([
      { partnerId: "p1", amount: "0.10", currency: "USD" },
      { partnerId: "p1", amount: "0.20", currency: "USD" },
      { partnerId: "p1", amount: "0.30", currency: "USD" },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([
      { id: "p1", name: "Test Partner" },
    ]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getPartnerPerformance(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    const partner = result.partners[0];
    // 0.10 + 0.20 + 0.30 = 0.60 exactly
    expect(partner.gmv).toBe("0.60");
    expect(partner.revenue).toBe("0.60");
    expect(partner.commission).toBe("0.60");
    // Must NOT contain float artifacts
    expect(partner.gmv).not.toContain("6000000000000001");
    expect(partner.revenue).not.toContain("6000000000000001");
  });

  it("handles large values without precision loss", async () => {
    const prisma = createMockPrisma();
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", sellerPartnerId: "p1", amount: "999999.99", currency: "USD" },
      { id: "o2", sellerPartnerId: "p1", amount: "0.01", currency: "USD" },
    ]);
    prisma.payment.findMany.mockImplementation((args: any) => {
      if (args.where?.status === "CAPTURED") {
        return Promise.resolve([
          { amount: "999999.99", currency: "USD", orderId: "o1" },
          { amount: "0.01", currency: "USD", orderId: "o2" },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.partner.findMany.mockResolvedValue([
      { id: "p1", name: "Test Partner" },
    ]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getPartnerPerformance(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    const partner = result.partners[0];
    // 999999.99 + 0.01 = 1000000.00 exactly
    expect(partner.gmv).toBe("1000000.00");
    expect(partner.revenue).toBe("1000000.00");
  });
});

// ─── Round 2: Financial Reconciliation multi-currency (MEDIUM-NEW-1) ──────────

describe("AnalyticsService — Financial Reconciliation multi-currency (MEDIUM-NEW-1)", () => {
  it("returns currency-separated reconciliation", async () => {
    const prisma = createMockPrisma();
    prisma.payment.findMany.mockResolvedValue([
      { id: "p1", amount: "500.00", currency: "USD" },
      { id: "p2", amount: "300.00", currency: "EUR" },
    ]);
    prisma.refund.findMany.mockResolvedValue([
      { id: "r1", amount: "50.00", currency: "USD" },
    ]);
    prisma.commission.findMany.mockResolvedValue([
      { id: "c1", amount: "25.00", currency: "USD" },
      { id: "c2", amount: "15.00", currency: "EUR" },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ cnt: BigInt(10) }]);

    const service = new AnalyticsService(prisma);
    const result = await service.getFinancialReconciliation(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // currencies array should contain both USD and EUR
    expect(result.currencies).toBeDefined();
    expect(result.currencies.length).toBe(2);

    const usd = result.currencies.find((c) => c.currency === "USD");
    const eur = result.currencies.find((c) => c.currency === "EUR");

    expect(usd).toBeDefined();
    expect(usd!.totalPayments).toBe("500.00");
    expect(usd!.totalRefunds).toBe("50.00");
    expect(usd!.netPayments).toBe("450.00");
    expect(usd!.totalCommission).toBe("25.00");

    expect(eur).toBeDefined();
    expect(eur!.totalPayments).toBe("300.00");
    expect(eur!.totalRefunds).toBe("0.00");
    expect(eur!.netPayments).toBe("300.00");
    expect(eur!.totalCommission).toBe("15.00");

    // No fake combined total — USD + EUR are separate
    expect(usd!.totalPayments).not.toBe("800.00");

    // Backward-compatible primary fields still present
    expect(result.currency).toBeDefined();
    expect(result.totalPayments).toBeDefined();
  });

  it("returns deterministic currency ordering (sorted)", async () => {
    const prisma = createMockPrisma();
    prisma.payment.findMany.mockResolvedValue([
      { id: "p1", amount: "100.00", currency: "AZN" },
      { id: "p2", amount: "200.00", currency: "EUR" },
      { id: "p3", amount: "300.00", currency: "USD" },
    ]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([{ cnt: BigInt(0) }]);

    const service = new AnalyticsService(prisma);
    const result = await service.getFinancialReconciliation(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.currencies.map((c) => c.currency)).toEqual(["AZN", "EUR", "USD"]);
  });
});

// ── Step 3.5E — CRM Analytics Tests ──────────────────────────────────────

describe("Step 3.5E — CRM Analytics Read Model", () => {
  function makeCrmMock() {
    const prisma = createMockPrisma();
    // Add partnerCustomerRelation mock
    prisma.partnerCustomerRelation = {
      count: jest.fn().mockResolvedValue(5),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    } as any;
    return prisma;
  }

  it("Platform scope: returns all metrics with label 'platform'", async () => {
    const prisma = makeCrmMock();
    prisma.partnerCustomerRelation.count.mockResolvedValue(10);
    prisma.partnerCustomerRelation.groupBy
      .mockResolvedValueOnce([{ lifecycle: "ACTIVE", _count: 7 }, { lifecycle: "LEAD", _count: 3 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 6 }, { leadSource: "PHONE", _count: 4 }])
      .mockResolvedValueOnce([{ assignedTo: "mgr1", _count: 10 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 3 }]);
    prisma.partnerCustomerRelation.findMany.mockResolvedValue([
      { customerId: "c1" }, { customerId: "c2" }, { customerId: "c3" },
    ]);
    prisma.order.findMany.mockResolvedValue([
      { customerId: "c1" }, { customerId: "c2" }, { customerId: "c1" },
    ]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.scope.label).toBe("platform");
    expect(result.scope.partnerId).toBeNull();
    expect(result.metrics.totalCustomers).toBe(3);
    expect(result.metrics.totalRelationships).toBe(10);
    expect(result.metrics.lifecycleBreakdown).toEqual({ ACTIVE: 7, LEAD: 3 });
    expect(result.metrics.sourceBreakdown).toEqual({ DIRECT: 6, PHONE: 4 });
    expect(result.metrics.newRelationships).toBe(10);
    expect(result.metrics.commerciallyActiveCustomers).toBe(2); // c1, c2
  });

  it("Partner scope: PARTNER role automatically scoped to own partnerId", async () => {
    const prisma = makeCrmMock();
    prisma.partnerCustomerRelation.count.mockResolvedValue(3);
    prisma.partnerCustomerRelation.groupBy
      .mockResolvedValueOnce([{ lifecycle: "ACTIVE", _count: 3 }])
      .mockResolvedValueOnce([{ leadSource: "PHONE", _count: 3 }])
      .mockResolvedValueOnce([{ assignedTo: null, _count: 3 }])
      .mockResolvedValueOnce([{ leadSource: "PHONE", _count: 1 }]);
    prisma.partnerCustomerRelation.findMany.mockResolvedValue([
      { customerId: "c1" }, { customerId: "c2" }, { customerId: "c3" },
    ]);
    prisma.order.findMany.mockResolvedValue([{ customerId: "c1" }]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u2", role: "PARTNER", partnerId: "partner-x" } as any,
    );

    expect(result.scope.label).toBe("partner");
    expect(result.scope.partnerId).toBe("partner-x");
  });

  it("Partner A/B isolation: different partners get different results", async () => {
    const prismaA = makeCrmMock();
    prismaA.partnerCustomerRelation.count.mockResolvedValue(5);
    prismaA.partnerCustomerRelation.groupBy
      .mockResolvedValueOnce([{ lifecycle: "ACTIVE", _count: 5 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 5 }])
      .mockResolvedValueOnce([{ assignedTo: null, _count: 5 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 2 }]);
    prismaA.partnerCustomerRelation.findMany.mockResolvedValue([
      { customerId: "c1" }, { customerId: "c2" }, { customerId: "c3" }, { customerId: "c4" }, { customerId: "c5" },
    ]);
    prismaA.order.findMany.mockResolvedValue([{ customerId: "c1" }]);

    const serviceA = new AnalyticsService(prismaA);
    const resultA = await serviceA.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "uA", role: "PARTNER", partnerId: "partner-a" } as any,
    );

    const prismaB = makeCrmMock();
    prismaB.partnerCustomerRelation.count.mockResolvedValue(2);
    prismaB.partnerCustomerRelation.groupBy
      .mockResolvedValueOnce([{ lifecycle: "LEAD", _count: 2 }])
      .mockResolvedValueOnce([{ leadSource: "OFFICE", _count: 2 }])
      .mockResolvedValueOnce([{ assignedTo: null, _count: 2 }])
      .mockResolvedValueOnce([{ leadSource: "OFFICE", _count: 1 }]);
    prismaB.partnerCustomerRelation.findMany.mockResolvedValue([
      { customerId: "c10" }, { customerId: "c11" },
    ]);
    prismaB.order.findMany.mockResolvedValue([]);

    const serviceB = new AnalyticsService(prismaB);
    const resultB = await serviceB.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "uB", role: "PARTNER", partnerId: "partner-b" } as any,
    );

    expect(resultA.metrics.totalCustomers).toBe(5);
    expect(resultB.metrics.totalCustomers).toBe(2);
    expect(resultA.metrics.lifecycleBreakdown).toEqual({ ACTIVE: 5 });
    expect(resultB.metrics.lifecycleBreakdown).toEqual({ LEAD: 2 });
  });

  it("A→B→A isolation: Partner A result unchanged after B query", async () => {
    const prisma = makeCrmMock();
    prisma.partnerCustomerRelation.count
      .mockResolvedValueOnce(5) // A total
      .mockResolvedValueOnce(1) // A new
      .mockResolvedValueOnce(2) // B total
      .mockResolvedValueOnce(0) // B new
      .mockResolvedValueOnce(5); // A again
    prisma.partnerCustomerRelation.groupBy
      .mockResolvedValue([{ lifecycle: "ACTIVE", _count: 5 }, { leadSource: "DIRECT", _count: 5 }, { assignedTo: null, _count: 5 }]);
    prisma.partnerCustomerRelation.findMany
      .mockResolvedValueOnce([{ customerId: "c1" }])
      .mockResolvedValueOnce([{ customerId: "c2" }])
      .mockResolvedValueOnce([{ customerId: "c1" }]);
    prisma.order.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const rA1 = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "uA", role: "PARTNER", partnerId: "partner-a" } as any,
    );
    const _rB = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "uB", role: "PARTNER", partnerId: "partner-b" } as any,
    );
    const rA2 = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "uA", role: "PARTNER", partnerId: "partner-a" } as any,
    );

    expect(rA1.metrics.totalCustomers).toBe(rA2.metrics.totalCustomers);
  });

  it("No double-counting: Customer with multiple Orders counted once", async () => {
    const prisma = makeCrmMock();
    prisma.partnerCustomerRelation.count.mockResolvedValue(1);
    prisma.partnerCustomerRelation.groupBy
      .mockResolvedValueOnce([{ lifecycle: "ACTIVE", _count: 1 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 1 }])
      .mockResolvedValueOnce([{ assignedTo: null, _count: 1 }])
      .mockResolvedValueOnce([{ leadSource: "DIRECT", _count: 1 }]);
    prisma.partnerCustomerRelation.findMany.mockResolvedValue([{ customerId: "c1" }]);
    // Same customer, multiple orders
    prisma.order.findMany.mockResolvedValue([
      { customerId: "c1" }, { customerId: "c1" }, { customerId: "c1" },
    ]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    // commerciallyActiveCustomers should be 1, not 3
    expect(result.metrics.commerciallyActiveCustomers).toBe(1);
  });

  it("BUYER role denied", async () => {
    const prisma = makeCrmMock();
    const service = new AnalyticsService(prisma);
    await expect(
      service.getCrmAnalytics(
        { preset: AnalyticsPeriodPreset.MONTH },
        { id: "u1", role: "BUYER", partnerId: null } as any,
      ),
    ).rejects.toThrow("BUYER role cannot access analytics");
  });

  it("Empty dataset: zero counts, no errors", async () => {
    const prisma = makeCrmMock();
    prisma.partnerCustomerRelation.count.mockResolvedValue(0);
    prisma.partnerCustomerRelation.groupBy.mockResolvedValue([]);
    prisma.partnerCustomerRelation.findMany.mockResolvedValue([]);
    prisma.order.findMany.mockResolvedValue([]);

    const service = new AnalyticsService(prisma);
    const result = await service.getCrmAnalytics(
      { preset: AnalyticsPeriodPreset.MONTH },
      { id: "u1", role: "ADMIN", partnerId: null } as any,
    );

    expect(result.metrics.totalCustomers).toBe(0);
    expect(result.metrics.totalRelationships).toBe(0);
    expect(result.metrics.lifecycleBreakdown).toEqual({});
    expect(result.metrics.commerciallyActiveCustomers).toBe(0);
  });
});
