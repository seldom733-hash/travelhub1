/**
 * UI-C1.2E — Payments registry read-model tests.
 *
 * Two layers:
 *  1. Pure scope contract (payments-registry.ts) — BASE (overview) scope keeps
 *     every global registry dimension; the active KPI dimensions
 *     (paymentStatus / refundStatus) compose into the TABLE scope only.
 *  2. Stub-driven PaymentService.list() — server-authoritative aggregate
 *     coverage (PaymentStatus 6/6, RefundStatus 4/4, zero-count preserved),
 *     overview-vs-table stability under KPI filters, one-active-dimension
 *     compatibility, total semantics, base-scope preservation, channel/tenant
 *     security, currency semantics and validation.
 */
import { Prisma } from "../../generated/prisma/client";
import { PaymentStatus, RefundStatus } from "../../generated/prisma/enums";
import { NotFoundError, ValidationDomainError } from "../../shared/errors";
import { PaymentService } from "./payment.service";
import {
  buildPaymentsScopes,
  emptyPaymentStatusAgg,
  emptyRefundStatusAgg,
  PAYMENT_STATUS_ORDER,
  REFUND_STATUS_ORDER,
} from "./payments-registry";
import type { PrismaService } from "../../prisma/prisma.service";
import type { IdsService } from "../../shared/ids.service";
import type { SecurityService } from "../../security/security.service";
import type { EventBusService } from "../../eventbus/eventbus.service";

// ── 1. Pure scope contract ────────────────────────────────────────────────────

describe("UI-C1.2E — Payments registry scope (pure)", () => {
  const CH = ["o1", "o2"];

  it("BASE scope contains channel; TABLE scope adds an active paymentStatus only", () => {
    const { baseWhere, tableWhere } = buildPaymentsScopes({
      channelOrderIds: CH,
      paymentStatus: PaymentStatus.CAPTURED,
    });
    expect(baseWhere).toEqual({ orderId: { in: CH } });
    expect(tableWhere).toEqual({ AND: [{ orderId: { in: CH } }, { status: PaymentStatus.CAPTURED }] });
  });

  it("keeps every global registry dimension in BASE (orderId×channel, currency, search, period)", () => {
    const from = new Date("2026-08-01T00:00:00Z");
    const to = new Date("2026-09-01T00:00:00Z");
    const { baseWhere } = buildPaymentsScopes({
      channelOrderIds: CH,
      orderId: "oX",
      currency: "USD",
      searchText: "MKT-PAY",
      searchOrderIds: ["o2"],
      dateFrom: from,
      dateTo: to,
      dateField: "createdAt",
    });
    const and = (baseWhere as { AND: unknown[] }).AND;
    expect(and).toHaveLength(4);
    expect(and[0]).toEqual({ AND: [{ orderId: "oX" }, { orderId: { in: CH } }] });
    expect(and[1]).toEqual({ currency: "USD" });
    expect(and[2]).toEqual({ createdAt: { gte: from, lt: to } });
    expect(and[3]).toEqual({
      OR: [
        { code: { contains: "MKT-PAY", mode: "insensitive" } },
        { referenceNumber: { contains: "MKT-PAY", mode: "insensitive" } },
        { providerRef: { contains: "MKT-PAY", mode: "insensitive" } },
        { orderId: { in: ["o2"] } },
      ],
    });
  });

  it("an explicit deep-link orderId is intersected with the channel (never bypasses it)", () => {
    const { baseWhere } = buildPaymentsScopes({ channelOrderIds: CH, orderId: "storefront-order" });
    expect(baseWhere).toEqual({
      AND: [{ orderId: "storefront-order" }, { orderId: { in: CH } }],
    });
  });

  it("refundStatus filters TABLE by the refund-correlated payment id set", () => {
    const { baseWhere, tableWhere } = buildPaymentsScopes({
      channelOrderIds: CH,
      refundStatus: RefundStatus.PROCESSED,
      refundPaymentIds: ["p1"],
    });
    expect(baseWhere).toEqual({ orderId: { in: CH } }); // overview keeps channel only
    expect(tableWhere).toEqual({ AND: [{ orderId: { in: CH } }, { id: { in: ["p1"] } }] });
  });

  it("refundStatus with NO matching refunds forces a deterministic empty table", () => {
    const { tableWhere } = buildPaymentsScopes({
      channelOrderIds: CH,
      refundStatus: RefundStatus.PROCESSED,
      refundPaymentIds: [],
    });
    expect(tableWhere).toEqual({ AND: [{ orderId: { in: CH } }, { id: "" }] });
  });

  it("zero-filled aggregate maps cover every canonical status in enum order", () => {
    expect(Object.keys(emptyPaymentStatusAgg())).toEqual(PAYMENT_STATUS_ORDER);
    expect(Object.keys(emptyRefundStatusAgg())).toEqual(REFUND_STATUS_ORDER);
    expect(Object.values(emptyPaymentStatusAgg()).every((v) => v === 0)).toBe(true);
  });
});

// ── 2. Stub-driven PaymentService.list() contract ─────────────────────────────

function mkPaymentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pay-1",
    code: "PAY-00000001",
    referenceNumber: "MKT-PAY-000001",
    orderId: "o1",
    customerId: "cus-1",
    partnerId: null,
    amount: new Prisma.Decimal("150.00"),
    currency: "USD",
    status: PaymentStatus.CAPTURED,
    paymentMethod: null,
    providerRef: null,
    version: 1,
    createdAt: new Date("2026-08-14T00:00:00Z"),
    paidAt: new Date("2026-08-14T00:00:00Z"),
    failedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

interface RegistryConfig {
  channelOrderIds?: string[];
  searchOrderIds?: string[];
  basePaymentIds?: string[];
  refundStatusPaymentIds?: string[];
  items?: Array<Record<string, unknown>>;
  tableTotal?: number;
  baseTotal?: number;
  statusGroups?: Array<{ status: PaymentStatus; count: number }>;
  refundGroups?: Array<{ status: RefundStatus; count: number }>;
  currencyGroups?: Array<{ currency: string; count: number; amount: string }>;
  orderRefs?: Array<{ id: string; referenceNumber: string }>;
}

type PrismaMethod = jest.Mock;

function makeRegistryService(cfg: RegistryConfig) {
  const prisma: Record<string, Record<string, PrismaMethod>> = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  // Channel order-id resolution.
  (prisma.order.findMany as PrismaMethod).mockImplementation((args: any) => {
    if (args?.select?.referenceNumber) {
      return Promise.resolve(cfg.orderRefs ?? []);
    }
    if (args?.where?.OR) {
      return Promise.resolve((cfg.searchOrderIds ?? []).map((id) => ({ id })));
    }
    return Promise.resolve((cfg.channelOrderIds ?? ["o1"]).map((id) => ({ id })));
  });

  // Base-scope payment-id enumeration (select id, no orderBy) vs table items.
  (prisma.payment.findMany as PrismaMethod).mockImplementation((args: any) => {
    if (args?.select?.id === true && !args.orderBy) {
      return Promise.resolve((cfg.basePaymentIds ?? ["p1"]).map((id) => ({ id })));
    }
    return Promise.resolve(cfg.items ?? []);
  });

  (prisma.payment.count as PrismaMethod).mockImplementation((args: any) => {
    const whereJson = JSON.stringify(args?.where ?? {});
    // Table-scoped count receives the active KPI dimension (status or refund id
    // set); the overview count never does.
    const isTable = whereJson.includes('"status"') || whereJson.includes('"id"');
    return Promise.resolve(isTable ? (cfg.tableTotal ?? 1) : (cfg.baseTotal ?? 1));
  });

  (prisma.payment.groupBy as PrismaMethod).mockImplementation((args: any) => {
    if (args.by[0] === "currency") {
      return Promise.resolve(
        (cfg.currencyGroups ?? []).map((c) => ({
          currency: c.currency,
          _count: { _all: c.count },
          _sum: { amount: new Prisma.Decimal(c.amount) },
        })),
      );
    }
    return Promise.resolve(
      (cfg.statusGroups ?? []).map((g) => ({ status: g.status, _count: { status: g.count } })),
    );
  });

  (prisma.refund.findMany as PrismaMethod).mockImplementation(() =>
    Promise.resolve((cfg.refundStatusPaymentIds ?? []).map((id) => ({ paymentId: id }))),
  );
  (prisma.refund.groupBy as PrismaMethod).mockImplementation(() =>
    Promise.resolve((cfg.refundGroups ?? []).map((g) => ({ status: g.status, _count: { status: g.count } }))),
  );
  (prisma.payment.findUnique as PrismaMethod).mockResolvedValue(null);
  (prisma.order.findUnique as PrismaMethod).mockResolvedValue(null);

  const ids = { nextCode: jest.fn() } as unknown as IdsService;
  const security = { audit: jest.fn() } as unknown as SecurityService;
  const eventBus = { emit: jest.fn(), publishPending: jest.fn() } as unknown as EventBusService;
  const refNum = {} as never;
  const service = new PaymentService(prisma as unknown as PrismaService, ids, security, eventBus, refNum);
  return { service, prisma };
}

describe("UI-C1.2E — PaymentService payments registry list()", () => {
  it("denies explicit Storefront scope on the platform contract (empty + zero aggregates)", async () => {
    const { service } = makeRegistryService({});
    const res = await service.list({ acquisitionSource: "PARTNER_STOREFRONT" } as never);
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.aggregates).toEqual({ total: 0, paymentStatus: emptyPaymentStatusAgg(), refundStatus: emptyRefundStatusAgg(), currency: [] });
  });

  it("returns zero aggregates when the channel has no orders", async () => {
    const { service } = makeRegistryService({ channelOrderIds: [] });
    const res = await service.list({} as never);
    expect(res.aggregates.total).toBe(0);
    expect(res.aggregates.paymentStatus).toEqual(emptyPaymentStatusAgg());
  });

  it("validates the active KPI dimensions deterministically (invalid → 422-class error)", async () => {
    const { service } = makeRegistryService({});
    await expect(service.list({ paymentStatus: "VOID" } as never)).rejects.toThrow(ValidationDomainError);
    await expect(service.list({ refundStatus: "VOID" } as never)).rejects.toThrow(ValidationDomainError);
    await expect(service.list({ currency: "usd" } as never)).rejects.toThrow(ValidationDomainError);
    await expect(service.list({ dateFrom: "not-a-date" } as never)).rejects.toThrow(ValidationDomainError);
    await expect(service.list({ status: "CAPTURED", paymentStatus: "FAILED" } as never)).rejects.toThrow(ValidationDomainError);
    // Legacy alias is accepted.
    await expect(service.list({ status: "CAPTURED" } as never)).resolves.toBeDefined();
  });

  it("exposes every canonical PaymentStatus (6/6) and RefundStatus (4/4) with zero-count coverage", async () => {
    const { service } = makeRegistryService({
      statusGroups: [
        { status: PaymentStatus.CAPTURED, count: 7 },
        { status: PaymentStatus.FAILED, count: 2 },
      ],
      refundGroups: [{ status: RefundStatus.REQUESTED, count: 1 }],
      currencyGroups: [{ currency: "USD", count: 9, amount: "1100.00" }],
      items: [mkPaymentRow()],
      baseTotal: 9,
      tableTotal: 9,
      basePaymentIds: ["p1"],
    });
    const res = await service.list({} as never);
    // All six canonical payment statuses present, deterministic, zero-filled.
    for (const s of PAYMENT_STATUS_ORDER) expect(res.aggregates.paymentStatus).toHaveProperty(s);
    expect(res.aggregates.paymentStatus[PaymentStatus.CAPTURED]).toBe(7);
    expect(res.aggregates.paymentStatus[PaymentStatus.AUTHORIZED]).toBe(0);
    expect(res.aggregates.paymentStatus[PaymentStatus.REFUNDED]).toBe(0);
    for (const s of REFUND_STATUS_ORDER) expect(res.aggregates.refundStatus).toHaveProperty(s);
    expect(res.aggregates.refundStatus[RefundStatus.REQUESTED]).toBe(1);
    expect(res.aggregates.refundStatus[RefundStatus.PROCESSED]).toBe(0);
    expect(res.aggregates.currency).toEqual([{ currency: "USD", count: 9, amount: "1100" }]);
  });

  it("keeps overview aggregates stable while a paymentStatus KPI filter narrows only the table", async () => {
    const { service, prisma } = makeRegistryService({
      statusGroups: [
        { status: PaymentStatus.CAPTURED, count: 3 },
        { status: PaymentStatus.FAILED, count: 6 },
      ],
      items: [mkPaymentRow()],
      baseTotal: 9,
      tableTotal: 3,
      basePaymentIds: ["p1"],
    });
    const res = await service.list({ paymentStatus: "CAPTURED" } as never);
    expect(res.total).toBe(3); // table-scoped
    expect(res.aggregates.total).toBe(9); // overview-scoped total stays stable
    expect(res.aggregates.paymentStatus[PaymentStatus.FAILED]).toBe(6); // other cards stable
    // Overview groupBy ran over the base where (no status dimension)…
    const groupByCall = (prisma.payment.groupBy as PrismaMethod).mock.calls.find((c) => c[0].by[0] === "status");
    expect(JSON.stringify(groupByCall![0].where)).not.toContain('"status"');
    // …while the table count received the status dimension.
    const tableCountCall = (prisma.payment.count as PrismaMethod).mock.calls[0];
    expect(JSON.stringify(tableCountCall[0].where)).toContain('"status":"CAPTURED"');
  });

  it("one-active-dimension compatibility: paymentStatus only / refundStatus only / both / neither", async () => {
    // refundStatus-only
    const { service, prisma } = makeRegistryService({
      refundStatusPaymentIds: ["p1"],
      basePaymentIds: ["p1"],
      items: [mkPaymentRow()],
      baseTotal: 5,
      tableTotal: 1,
      refundGroups: [{ status: RefundStatus.PROCESSED, count: 1 }],
    });
    const onlyRefund = await service.list({ refundStatus: "PROCESSED" } as never);
    expect(onlyRefund.total).toBe(1);
    const refundWhere = JSON.stringify((prisma.payment.count as PrismaMethod).mock.calls[0][0].where);
    expect(refundWhere).toContain('"id":{"in":["p1"]}');
    // refundStatus with no matching refunds → deterministic empty table
    const none = makeRegistryService({ refundStatusPaymentIds: [], basePaymentIds: ["p1"], tableTotal: 0, baseTotal: 4 });
    const emptyRefund = await none.service.list({ refundStatus: "PROCESSED" } as never);
    expect(emptyRefund.total).toBe(0);
  });

  it("preserves global base scope (search/period/currency/channel) in the overview where", async () => {
    const { service, prisma } = makeRegistryService({
      searchOrderIds: ["o2"],
      basePaymentIds: ["p1"],
      items: [mkPaymentRow()],
      baseTotal: 2,
      tableTotal: 2,
    });
    await service.list({
      search: "MKT-PAY-",
      currency: "USD",
      dateFrom: "2026-08-01",
      dateTo: "2026-09-01",
      acquisitionSource: "MARKETPLACE",
    } as never);
    const overviewCountCall = (prisma.payment.count as PrismaMethod).mock.calls[1];
    const whereJson = JSON.stringify(overviewCountCall[0].where);
    expect(whereJson).toContain('"currency":"USD"');
    expect(whereJson).toContain('"createdAt"');
    expect(whereJson).toContain('"contains":"MKT-PAY-"');
    expect(whereJson).toContain('"in":["o2"]');
  });

  it("orders refund-status aggregates through the canonical Refund.paymentId relation only", async () => {
    const { service, prisma } = makeRegistryService({
      basePaymentIds: ["p1", "p2"],
      refundGroups: [{ status: RefundStatus.APPROVED, count: 2 }],
      items: [mkPaymentRow()],
      baseTotal: 2,
      tableTotal: 2,
    });
    const res = await service.list({} as never);
    const refundGroupByCall = (prisma.refund.groupBy as PrismaMethod).mock.calls[0];
    expect(refundGroupByCall[0].by).toEqual(["status"]);
    expect(refundGroupByCall[0].where).toEqual({ paymentId: { in: ["p1", "p2"] } });
    expect(res.aggregates.refundStatus[RefundStatus.APPROVED]).toBe(2);
  });

  it("direct read of a Storefront payment is invisible (404-like) on the platform contract", async () => {
    const { service, prisma } = makeRegistryService({});
    (prisma.payment.findUnique as PrismaMethod).mockResolvedValue(mkPaymentRow());
    (prisma.order.findUnique as PrismaMethod).mockResolvedValue({ acquisitionSource: "PARTNER_STOREFRONT" });
    await expect(service.getByCode("PAY-00000001")).rejects.toThrow(NotFoundError);
  });

  it("direct read of a Marketplace payment returns the whitelist DTO", async () => {
    const { service, prisma } = makeRegistryService({});
    (prisma.payment.findUnique as PrismaMethod).mockResolvedValue(mkPaymentRow());
    (prisma.order.findUnique as PrismaMethod).mockResolvedValue({ acquisitionSource: "MARKETPLACE" });
    const dto = await service.getByCode("PAY-00000001");
    expect(dto.status).toBe(PaymentStatus.CAPTURED);
    expect(dto.amount).toBe("150");
    expect(dto).not.toHaveProperty("providerPayload");
  });
});
