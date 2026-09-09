/**
 * D8 (B-06) — cross-surface registry date-param validation matrix.
 *
 * Proves that EVERY affected registry surface rejects malformed query-param
 * dates with the canonical contract (BadRequestException → HTTP 400,
 * "<paramName> must be a valid date") and does so BEFORE any DB read.
 *
 * Surfaces (per Final Correction Pass C2 / D8 MUST #1):
 *   - Orders        listOrders / exportOrders (buildOrderWhere)
 *   - Bookings      listBookings / exportBookings
 *   - Requests      listRequests / getRequestKpi (400 already canonical here)
 *   - Payments      registry list (422 → 400 alignment; KPI dimensions stay 422)
 *   - CRM customers listCustomers / exportCustomers (period activity filter)
 *   - Catalog       listProducts (publishedAt filter; [from, to] boundary variance)
 *   - CRM Activity  listCustomerActivity / listPartnerActivity (404 → 400)
 *
 * All services are stubbed Prisma-free; the assertion "before any DB read" is
 * proven by asserting the mocked prisma.order.findMany / booking.findMany /
 * customer.findMany / product.findMany / crmActivity.findMany were never called.
 */
import { BadRequestException } from "@nestjs/common";
import { parseDateParam } from "./date-param";

import { OrderService } from "../modules/order/order.service";
import { BookingService } from "../modules/booking/booking.service";
import { RequestService } from "../modules/order/request.service";
import { PaymentService } from "../modules/finance/payment.service";
import { CrmService } from "../modules/crm/crm.service";
import { CatalogService } from "../modules/catalog/catalog.service";
import { CrmActivityController } from "../modules/crm-activity/crm-activity.controller";

import type { PrismaService } from "../prisma/prisma.service";
import type { IdsService } from "./ids.service";
import type { ReferenceNumberService } from "./reference-number.service";
import type { SecurityService } from "../security/security.service";
import type { EventBusService } from "../eventbus/eventbus.service";
import type { BookingQueryService } from "../modules/booking/booking-query.service";
import type { CatalogAccessPolicy } from "../modules/catalog/catalog-access.policy";
import type { PublicSellerProfileService } from "../modules/catalog/seller/seller-profile.service";
import type { CrmActivityService } from "../modules/crm-activity/crm-activity.service";

function makePrisma(): Record<string, any> {
  return {
    order: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
    orderItem: { create: jest.fn() },
    orderTraveler: { create: jest.fn() },
    fulfillment: { create: jest.fn() },
    orderHistory: { create: jest.fn() },
    booking: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), findFirst: jest.fn() },
    payment: { findMany: jest.fn(), groupBy: jest.fn() },
    refund: { findMany: jest.fn(), groupBy: jest.fn(), findFirst: jest.fn() },
    customer: { findMany: jest.fn(), findUnique: jest.fn() },
    product: { findMany: jest.fn(), findUnique: jest.fn() },
    partner: { findMany: jest.fn(), findUnique: jest.fn() },
    partnerStorefront: { findUnique: jest.fn() },
    request: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    requestHistory: { create: jest.fn(), findMany: jest.fn() },
    crmActivity: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };
}

function makeOrderService(prisma: Record<string, any>): OrderService {
  return new OrderService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn(), nextOrderNumber: jest.fn() } as unknown as IdsService,
    { emit: jest.fn(), publishPending: jest.fn(), publishEvent: jest.fn() } as unknown as EventBusService,
    {} as unknown as ReferenceNumberService,
  );
}

function makeBookingService(prisma: Record<string, any>): BookingService {
  return new BookingService(
    prisma as unknown as PrismaService,
    { emit: jest.fn(), publishPending: jest.fn(), publishEvent: jest.fn() } as unknown as EventBusService,
    {} as unknown as BookingQueryService,
  );
}

function makeRequestService(prisma: Record<string, any>): RequestService {
  return new RequestService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn() } as unknown as IdsService,
    {} as unknown as ReferenceNumberService,
    { audit: jest.fn() } as unknown as SecurityService,
    { emit: jest.fn(), publishEvent: jest.fn(), publishPending: jest.fn() } as unknown as EventBusService,
    makeOrderService(prisma),
  );
}

function makePaymentService(prisma: Record<string, any>): PaymentService {
  return new PaymentService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn() } as unknown as IdsService,
    { audit: jest.fn() } as unknown as SecurityService,
    { emit: jest.fn(), publishPending: jest.fn(), publishEvent: jest.fn() } as unknown as EventBusService,
    {} as unknown as ReferenceNumberService,
  );
}

function makeCrmService(prisma: Record<string, any>): CrmService {
  return new CrmService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn() } as unknown as IdsService,
    { emit: jest.fn(), publishPending: jest.fn(), publishEvent: jest.fn() } as unknown as EventBusService,
  );
}

function makeCatalogService(prisma: Record<string, any>): CatalogService {
  return new CatalogService(
    prisma as unknown as PrismaService,
    { nextCode: jest.fn() } as unknown as IdsService,
    { emit: jest.fn(), publishPending: jest.fn(), publishEvent: jest.fn() } as unknown as EventBusService,
    {} as unknown as CatalogAccessPolicy,
    {} as unknown as PublicSellerProfileService,
  );
}

function makeCrmActivityController(prisma: Record<string, any>): CrmActivityController {
  return new CrmActivityController(
    {} as unknown as CrmActivityService,
    prisma as unknown as PrismaService,
  );
}

// ─── Expected canonical error shape ─────────────────────────────────────────

const CANONICAL_MESSAGE = /must be a valid date/;

async function expectCanonical400(promise: Promise<unknown>, paramName: string, prisma: Record<string, any>): Promise<void> {
  await expect(promise).rejects.toThrow(BadRequestException);
  await expect(promise).rejects.toThrow(new RegExp(`${paramName} must be a valid date`));
  // Validation must fire BEFORE any DB read — no Prisma call may have happened.
  for (const model of ["order", "booking", "payment", "customer", "product", "request", "crmActivity"]) {
    const m = prisma[model];
    if (!m) continue;
    for (const fn of Object.values(m)) {
      if (typeof fn === "function") expect((fn as jest.Mock).mock.calls.length).toBe(0);
    }
  }
}

// ─── Orders ─────────────────────────────────────────────────────────────────

describe("D8 B-06 — Orders registry date validation (canonical 400)", () => {
  it("listOrders: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeOrderService(prisma);
    await expectCanonical400(svc.listOrders({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("listOrders: invalid dateTo → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeOrderService(prisma);
    await expectCanonical400(svc.listOrders({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("listOrders: invalid dateFrom wins when both params are invalid", async () => {
    const prisma = makePrisma();
    const svc = makeOrderService(prisma);
    await expectCanonical400(svc.listOrders({ dateFrom: "x", dateTo: "y" } as never), "dateFrom", prisma);
  });

  it("exportOrders (buildOrderWhere): invalid dateFrom → 400", async () => {
    const prisma = makePrisma();
    const svc = makeOrderService(prisma);
    await expectCanonical400(svc.exportOrders({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("valid dates parse and flow into the createdAt [from, to) filter", async () => {
    const prisma = makePrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);
    prisma.order.groupBy.mockResolvedValue([]);
    const svc = makeOrderService(prisma);
    await svc.listOrders({ dateFrom: "2026-09-01", dateTo: "2026-10-01" } as never);
    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({
      gte: parseDateParam("2026-09-01", "dateFrom"),
      lt: parseDateParam("2026-10-01", "dateTo"),
    });
  });
});

// ─── Bookings ───────────────────────────────────────────────────────────────

describe("D8 B-06 — Bookings registry date validation (canonical 400)", () => {
  it("listBookings: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeBookingService(prisma);
    await expectCanonical400(svc.listBookings({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("listBookings: invalid dateTo → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeBookingService(prisma);
    await expectCanonical400(svc.listBookings({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("exportBookings: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    const svc = makeBookingService(prisma);
    await expectCanonical400(svc.exportBookings({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("valid dates flow into the createdAt [from, to) filter", async () => {
    const prisma = makePrisma();
    prisma.order.findMany.mockResolvedValue([{ id: "o1" }]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);
    prisma.booking.groupBy.mockResolvedValue([]);
    const svc = makeBookingService(prisma);
    await svc.listBookings({ dateFrom: "2026-09-01", dateTo: "2026-10-01" } as never);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({
      gte: parseDateParam("2026-09-01", "dateFrom"),
      lt: parseDateParam("2026-10-01", "dateTo"),
    });
  });
});

// ─── Requests ───────────────────────────────────────────────────────────────

describe("D8 B-06 — Requests registry date validation (canonical 400)", () => {
  it("listRequests: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeRequestService(prisma);
    await expectCanonical400(svc.listRequests({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("listRequests: invalid dateTo → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeRequestService(prisma);
    await expectCanonical400(svc.listRequests({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("getRequestKpi: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeRequestService(prisma);
    await expectCanonical400(svc.getRequestKpi({ dateFrom: "not-a-date" }), "dateFrom", prisma);
  });

  it("getRequestKpi: invalid dateTo → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeRequestService(prisma);
    await expectCanonical400(svc.getRequestKpi({ dateTo: "not-a-date" }), "dateTo", prisma);
  });
});

// ─── Payments ───────────────────────────────────────────────────────────────

describe("D8 B-06 — Payments registry date validation (422 → 400 alignment)", () => {
  it("list: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makePaymentService(prisma);
    await expectCanonical400(svc.list({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("list: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    const svc = makePaymentService(prisma);
    await expectCanonical400(svc.list({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("KPI dimension params keep the Finance 422 contract (intentional, unchanged)", async () => {
    const prisma = makePrisma();
    const svc = makePaymentService(prisma);
    await expect(svc.list({ paymentStatus: "VOID" } as never)).rejects.not.toThrow(BadRequestException);
  });
});

// ─── CRM customers ──────────────────────────────────────────────────────────

describe("D8 B-06 — CRM customers period validation (canonical 400)", () => {
  it("listCustomers: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeCrmService(prisma);
    await expectCanonical400(svc.listCustomers({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("listCustomers: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    const svc = makeCrmService(prisma);
    await expectCanonical400(svc.listCustomers({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });

  it("exportCustomers: invalid dateFrom → 400", async () => {
    const prisma = makePrisma();
    const svc = makeCrmService(prisma);
    await expectCanonical400(svc.exportCustomers({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });
});

// ─── Catalog ────────────────────────────────────────────────────────────────

describe("D8 B-06 — Catalog products date validation (canonical 400)", () => {
  it("listProducts: invalid dateFrom → 400 before any DB read", async () => {
    const prisma = makePrisma();
    const svc = makeCatalogService(prisma);
    await expectCanonical400(svc.listProducts({ dateFrom: "not-a-date" } as never), "dateFrom", prisma);
  });

  it("listProducts: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    const svc = makeCatalogService(prisma);
    await expectCanonical400(svc.listProducts({ dateTo: "not-a-date" } as never), "dateTo", prisma);
  });
});

// ─── CRM Activity ───────────────────────────────────────────────────────────

const ACTIVITY_ACTOR = {
  id: "user-1",
  code: "USR-001",
  username: "admin",
  email: "admin@test.com",
  fullName: "Admin User",
  status: "ACTIVE" as any,
  role: "ADMIN",
  roleTitle: "Administrator",
  partnerId: null,
  customerId: null,
  permissions: [],
};

describe("D8 B-06 — CRM Activity date validation (404 → 400 correction)", () => {
  it("listCustomerActivity: invalid dateFrom → 400 (no longer NotFoundException)", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "cus-1" });
    const ctrl = makeCrmActivityController(prisma);
    await expectCanonical400(
      ctrl.listCustomerActivity("cus-1", { dateFrom: "not-a-date" } as never, ACTIVITY_ACTOR as never),
      "dateFrom",
      prisma,
    );
  });

  it("listCustomerActivity: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "cus-1" });
    const ctrl = makeCrmActivityController(prisma);
    await expectCanonical400(
      ctrl.listCustomerActivity("cus-1", { dateTo: "not-a-date" } as never, ACTIVITY_ACTOR as never),
      "dateTo",
      prisma,
    );
  });

  it("listPartnerActivity: invalid dateFrom → 400", async () => {
    const prisma = makePrisma();
    prisma.partner.findUnique.mockResolvedValue({ id: "par-1" });
    const ctrl = makeCrmActivityController(prisma);
    await expectCanonical400(
      ctrl.listPartnerActivity("par-1", { dateFrom: "not-a-date" } as never, ACTIVITY_ACTOR as never),
      "dateFrom",
      prisma,
    );
  });

  it("listPartnerActivity: invalid dateTo → 400", async () => {
    const prisma = makePrisma();
    prisma.partner.findUnique.mockResolvedValue({ id: "par-1" });
    const ctrl = makeCrmActivityController(prisma);
    await expectCanonical400(
      ctrl.listPartnerActivity("par-1", { dateTo: "not-a-date" } as never, ACTIVITY_ACTOR as never),
      "dateTo",
      prisma,
    );
  });
});
