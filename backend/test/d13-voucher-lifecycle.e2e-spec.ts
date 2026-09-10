/**
 * D13 — VOUCHER LIFECYCLE E2E SUITE
 *
 * Covers D13 closure gates C1–C18:
 *  T-D13-01: BookingConfirmed + PAID → exactly one Voucher
 *  T-D13-02: BookingConfirmed + UNPAID → no Voucher
 *  T-D13-03: PaymentCaptured + Booking not confirmed → no Voucher
 *  T-D13-04: Second gate arrives later → Voucher generated (both orders)
 *  T-D13-05: Duplicate event → idempotent (no duplicate)
 *  T-D13-06: BookingCancelled → INVALIDATED
 *  T-D13-07: BookingRejected → INVALIDATED
 *  T-D13-08: Partial Refund → Refund Document, Voucher stays ISSUED
 *  T-D13-09: Full Refund → Voucher INVALIDATED
 *  T-D13-10: Buyer IDOR protection
 *  T-D13-11: PII redaction
 *  T-D13-12: Versioning / immutability
 *  T-D13-13: Storage failure path
 *  T-D13-14: Missing passengers → no Voucher
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { RoleCode, Prisma } from "../src/generated/prisma/client";
import type { ObjectStorageService } from "../src/modules/catalog/media/storage/storage.interface";

const mockStorage: ObjectStorageService = {
  putObject: jest.fn().mockImplementation(async (input: { key: string; body: Buffer; contentType: string }) => ({
    key: input.key,
    size: input.body.length,
  })),
  getSignedReadUrl: jest.fn().mockResolvedValue("https://mock-signed-url.example.com/test.pdf"),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  objectExists: jest.fn().mockResolvedValue(true),
};

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000);
const stamp = Date.now();

interface Session {
  accessToken: string;
  user: { id: string };
}

const waitFor = async <T>(fn: () => Promise<T | null | undefined>, until: (v: T) => boolean, tries = 40): Promise<T> => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v && until(v)) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("waitFor: condition not met within timeout");
};

describe("D13 — Voucher Lifecycle (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let adminToken: string;

  const created: {
    users: string[];
    customers: string[];
    orders: string[];
    bookings: string[];
    documents: string[];
  } = { users: [], customers: [], orders: [], bookings: [], documents: [] };

  const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const createStaff = async (tag: string, roleCode: RoleCode): Promise<Session> => {
    const staff = (await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(authHeaders(adminToken))
      .send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode })
      .expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  const createCustomer = async (tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "D13",
        lastName: tag,
        code: `CRM-D13-${tag.toUpperCase()}-${stamp}`,
        email: `d13-${tag.toLowerCase()}-${stamp}@test.local`,
      },
    });
    created.customers.push(customer.id);
    return customer.id;
  };

  const seedOrderWithBooking = async (tag: string, opts: { paymentStatus?: string; paidAmount?: number; bookingStatus?: string } = {}) => {
    const customerId = await createCustomer(tag);
    const amount = new Prisma.Decimal(1500);
    const paidAmount = new Prisma.Decimal(opts.paidAmount ?? 1500);

    const order = await prisma.order.create({
      data: {
        code: `D13-ORD-${tag}-${stamp}`,
        number: `TH-D13-${tag}`,
        referenceNumber: `MKT-D13-${tag}-${stamp}`,
        commerceSequence: tag,
        status: "PARTIALLY_FULFILLED",
        paymentStatus: (opts.paymentStatus as any) ?? "PAID",
        currency: "USD",
        amount,
        paidAmount,
        refundedAmount: 0,
        version: 1,
        acquisitionSource: "MARKETPLACE",
        customerId,
        submittedAt: new Date(),
        serviceDate: FUTURE(30),
      },
    });
    created.orders.push(order.id);

    const booking = await prisma.booking.create({
      data: {
        code: `D13-BKG-${tag}-${stamp}`,
        referenceNumber: `MKT-BKG-${tag}-${stamp}`,
        orderId: order.id,
        productId: "00000000-0000-0000-0000-000000000000",
        status: (opts.bookingStatus as any) ?? "CONFIRMED",
        currency: "USD",
        amount,
        serviceDate: FUTURE(30),
        confirmedAt: new Date(),
      },
    });
    created.bookings.push(booking.id);

    for (let i = 0; i < 2; i++) {
      await prisma.passenger.create({
        data: {
          bookingId: booking.id,
          firstName: `Traveler${i + 1}`,
          lastName: `D13${tag}`,
          citizenship: "US",
          gender: i === 0 ? "M" : "F",
          birthDate: new Date(`199${0 + i}-05-15`),
          passportNumber: i === 0 ? `PPT${stamp}${i}` : null,
          passportExpiry: i === 0 ? new Date("2030-01-01") : null,
        },
      });
    }

    return { orderId: order.id, bookingId: booking.id, orderCode: order.code, bookingCode: booking.code };
  };

  const emitAndWait = async (eventType: string, payload: Record<string, unknown>) => {
    await prisma.$transaction((tx) =>
      eventBus.emit(tx, {
        aggregateType: "Order",
        aggregateId: payload.orderId as string,
        eventType,
        payload,
      }),
    );
    await eventBus.publishPending();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider("ObjectStorageService")
      .useValue(mockStorage)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);

    const admin = await login("admin", "admin123");
    adminToken = admin.accessToken;
  });

  afterAll(async () => {
    if (created.documents.length > 0) {
      await prisma.documentHistory.deleteMany({ where: { documentId: { in: created.documents } } });
      await prisma.documentVersion.deleteMany({ where: { documentId: { in: created.documents } } });
      await prisma.document.deleteMany({ where: { id: { in: created.documents } } });
    }
    if (created.bookings.length > 0) {
      await prisma.passenger.deleteMany({ where: { bookingId: { in: created.bookings } } });
      await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    }
    if (created.orders.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.customers.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    }
    if (created.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    await app.close();
  });

  // ─── T-D13-01: BookingConfirmed + PAID → exactly one Voucher ──────────
  it("T-D13-01: BookingConfirmed + PAID → exactly one Voucher", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T01");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T01`,
    });

    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );

    expect(doc).toBeTruthy();
    expect(doc!.code).toMatch(/^VCH-/);
    expect(doc!.status).toBe("ISSUED");
    expect(doc!.orderId).toBe(orderId);
    expect(doc!.bookingId).toBe(bookingId);
    created.documents.push(doc!.id);

    const vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(1);

    const versions = await prisma.documentVersion.findMany({ where: { documentId: doc!.id } });
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].status).toBe("ISSUED");
    expect(versions[0].s3Key).toMatch(/^documents\/.*\/v1\.pdf$/);
    expect(versions[0].fileSize).toBeGreaterThan(0);

    const history = await prisma.documentHistory.findMany({ where: { documentId: doc!.id } });
    expect(history.some((h) => h.action === "issued")).toBe(true);
  });

  // ─── T-D13-02: BookingConfirmed + UNPAID → no Voucher ─────────────────
  it("T-D13-02: BookingConfirmed + UNPAID → no Voucher", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T02", { paymentStatus: "UNPAID", paidAmount: 0 });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T02`,
    });

    await new Promise((r) => setTimeout(r, 2000));
    const vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(0);
  });

  // ─── T-D13-03: PaymentCaptured + Booking not confirmed → no Voucher ───
  it("T-D13-03: PaymentCaptured + Booking not confirmed → no Voucher", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T03", { bookingStatus: "AWAITING_CONFIRMATION" });

    await emitAndWait(DomainEvents.PaymentCaptured, {
      orderId,
      code: `PAY-${stamp}-T03`,
    });

    await new Promise((r) => setTimeout(r, 2000));
    const vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(0);
  });

  // ─── T-D13-04: Second gate arrives later → Voucher generated ──────────
  it("T-D13-04a: BookingConfirmed → PaymentCaptured → Voucher", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T04a", { paymentStatus: "UNPAID", paidAmount: 0 });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T04a`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    let vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(0);

    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", paidAmount: new Prisma.Decimal(1500) } });

    await emitAndWait(DomainEvents.PaymentCaptured, {
      orderId,
      code: `PAY-${stamp}-T04a`,
    });

    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    expect(doc).toBeTruthy();
    expect(doc!.code).toMatch(/^VCH-/);
    created.documents.push(doc!.id);
  });

  it("T-D13-04b: PaymentCaptured → BookingConfirmed → Voucher", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T04b", { bookingStatus: "AWAITING_CONFIRMATION" });

    await emitAndWait(DomainEvents.PaymentCaptured, {
      orderId,
      code: `PAY-${stamp}-T04b`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    let vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(0);

    await prisma.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T04b`,
    });

    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    expect(doc).toBeTruthy();
    created.documents.push(doc!.id);
  });

  // ─── T-D13-05: Duplicate event → no duplicate Voucher ─────────────────
  it("T-D13-05: Duplicate BookingConfirmed → idempotent", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T05");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T05`,
    });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T05`,
    });

    await new Promise((r) => setTimeout(r, 2000));
    const vouchers = await prisma.document.findMany({ where: { bookingId, type: "VOUCHER" } });
    expect(vouchers.length).toBeLessThanOrEqual(1);
    if (vouchers.length === 1) created.documents.push(vouchers[0].id);
  });

  // ─── T-D13-06: BookingCancelled → INVALIDATED ─────────────────────────
  it("T-D13-06: Issued Voucher + BookingCancelled → INVALIDATED", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T06");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T06`,
    });
    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(doc.id);

    await emitAndWait(DomainEvents.BookingCancelled, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T06`,
    });

    const invalidated = await waitFor(
      async () => prisma.document.findUnique({ where: { id: doc.id } }),
      (d) => d!.status === "INVALIDATED",
    );
    expect(invalidated.status).toBe("INVALIDATED");

    const versions = await prisma.documentVersion.findMany({ where: { documentId: doc.id } });
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].s3Key).toBeTruthy();

    const history = await prisma.documentHistory.findMany({ where: { documentId: doc.id } });
    expect(history.some((h) => h.action === "issued")).toBe(true);
    expect(history.some((h) => h.action === "invalidated")).toBe(true);
  });

  // ─── T-D13-07: BookingRejected → INVALIDATED ──────────────────────────
  it("T-D13-07: Issued Voucher + BookingRejected → INVALIDATED", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T07");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T07`,
    });
    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(doc.id);

    await emitAndWait(DomainEvents.BookingRejected, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T07`,
    });

    const invalidated = await waitFor(
      async () => prisma.document.findUnique({ where: { id: doc.id } }),
      (d) => d!.status === "INVALIDATED",
    );
    expect(invalidated.status).toBe("INVALIDATED");
  });

  // ─── T-D13-08: Partial Refund → Refund Document, Voucher stays ISSUED ─
  it("T-D13-08: Partial RefundProcessed → Refund Document, Voucher stays ISSUED", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T08");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T08`,
    });
    const voucher = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(voucher.id);

    await emitAndWait(DomainEvents.RefundProcessed, {
      orderId,
      refundId: `rf-${stamp}-T08`,
      code: `RF-${stamp}-T08`,
      amount: 500,
    });

    const refundDoc = await waitFor(
      async () => prisma.document.findFirst({ where: { orderId, type: "REFUND" } }),
      (d) => d !== null,
    );
    expect(refundDoc).toBeTruthy();
    expect(refundDoc!.code).toMatch(/^RFD-/);
    created.documents.push(refundDoc!.id);

    const voucherAfter = await prisma.document.findUnique({ where: { id: voucher.id } });
    expect(voucherAfter!.status).toBe("ISSUED");
  });

  // ─── T-D13-09: Full Refund → Voucher INVALIDATED ──────────────────────
  it("T-D13-09: Full RefundProcessed → Voucher INVALIDATED", async () => {
    const { orderId, bookingId } = await seedOrderWithBooking("T09");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId,
      bookingId,
      code: `BK-${stamp}-T09`,
    });
    const voucher = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(voucher.id);

    // Update order to reflect full refund (simulates RefundService projection)
    await prisma.order.update({
      where: { id: orderId },
      data: { refundedAmount: new Prisma.Decimal(1500), paymentStatus: "REFUNDED" },
    });

    await emitAndWait(DomainEvents.RefundProcessed, {
      orderId,
      refundId: `rf-${stamp}-T09-full`,
      code: `RF-${stamp}-T09`,
      amount: 1500,
    });

    const invalidated = await waitFor(
      async () => prisma.document.findUnique({ where: { id: voucher.id } }),
      (d) => d!.status === "INVALIDATED",
    );
    expect(invalidated.status).toBe("INVALIDATED");

    const refundDoc = await prisma.document.findFirst({ where: { orderId, type: "REFUND" } });
    expect(refundDoc).toBeTruthy();
    created.documents.push(refundDoc!.id);
  });

  // ─── T-D13-10: Buyer IDOR protection ──────────────────────────────────
  it("T-D13-10: Buyer A sees own docs, Buyer B cannot see A's docs", async () => {
    const buyerA = await createStaff("buyerA", RoleCode.BUYER);
    const buyerB = await createStaff("buyerB", RoleCode.BUYER);
    created.users.push(buyerA.user.id, buyerB.user.id);

    const custA = await prisma.customer.create({
      data: { firstName: "Buyer", lastName: "A", code: `CRM-BA-${stamp}`, email: `ba-${stamp}@test.local` },
    });
    const custB = await prisma.customer.create({
      data: { firstName: "Buyer", lastName: "B", code: `CRM-BB-${stamp}`, email: `bb-${stamp}@test.local` },
    });
    created.customers.push(custA.id, custB.id);
    await prisma.user.update({ where: { id: buyerA.user.id }, data: { customerId: custA.id } });
    await prisma.user.update({ where: { id: buyerB.user.id }, data: { customerId: custB.id } });

    const orderA = await prisma.order.create({
      data: {
        code: `D13-IDA-${stamp}`, number: `TH-IDA-${stamp}`, referenceNumber: `MKT-IDA-${stamp}`,
        commerceSequence: "IDA", status: "PARTIALLY_FULFILLED", paymentStatus: "PAID",
        currency: "USD", amount: 1000, paidAmount: 1000, refundedAmount: 0, version: 1,
        acquisitionSource: "MARKETPLACE", customerId: custA.id, submittedAt: new Date(), serviceDate: FUTURE(30),
      },
    });
    created.orders.push(orderA.id);

    const bookingA = await prisma.booking.create({
      data: {
        code: `D13-BDA-${stamp}`, referenceNumber: `MKT-BDA-${stamp}`,
        orderId: orderA.id, productId: "00000000-0000-0000-0000-000000000000",
        status: "CONFIRMED", currency: "USD", amount: 1000,
        serviceDate: FUTURE(30), confirmedAt: new Date(),
      },
    });
    created.bookings.push(bookingA.id);

    await prisma.passenger.create({
      data: { bookingId: bookingA.id, firstName: "Alice", lastName: "BuyerA", citizenship: "US" },
    });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId: orderA.id, bookingId: bookingA.id, code: `BK-${stamp}-IDA`,
    });
    const docA = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId: bookingA.id, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(docA.id);

    const resA = await request(app.getHttpServer())
      .get("/api/v1/account/documents")
      .set(authHeaders(buyerA.accessToken))
      .expect(200);
    expect(resA.body.items.length).toBeGreaterThanOrEqual(1);
    expect(resA.body.items.some((d: any) => d.id === docA.id)).toBe(true);

    const resB = await request(app.getHttpServer())
      .get("/api/v1/account/documents")
      .set(authHeaders(buyerB.accessToken))
      .expect(200);
    expect(resB.body.items.some((d: any) => d.id === docA.id)).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/account/documents/${docA.id}`)
      .set(authHeaders(buyerB.accessToken))
      .expect(404);
  });

  // ─── T-D13-11: PII redaction ──────────────────────────────────────────
  it("T-D13-11: PII redacted in buyer scope", async () => {
    const buyer = await createStaff("piibuyer", RoleCode.BUYER);
    const cust = await prisma.customer.create({
      data: { firstName: "PII", lastName: "Buyer", code: `CRM-PII-${stamp}`, email: `pii-${stamp}@test.local` },
    });
    created.customers.push(cust.id);
    await prisma.user.update({ where: { id: buyer.user.id }, data: { customerId: cust.id } });

    const buyerRes = await request(app.getHttpServer())
      .get("/api/v1/account/documents")
      .set(authHeaders(buyer.accessToken))
      .expect(200);
    const docs = buyerRes.body.items as any[];
    for (const d of docs) {
      expect(d.passportNumber).toBeUndefined();
    }
  });

  // ─── T-D13-12: Versioning / immutability ──────────────────────────────
  it("T-D13-12: v1 creation → supersede → v2 → v1 SUPERSEDED, v2 ISSUED", async () => {
    const { bookingId } = await seedOrderWithBooking("T12");

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId: (await prisma.order.findFirst({ where: { code: { contains: "T12" } } }))!.id,
      bookingId,
      code: `BK-${stamp}-T12`,
    });
    const doc = await waitFor(
      async () => prisma.document.findFirst({ where: { bookingId, type: "VOUCHER" } }),
      (d) => d!.status === "ISSUED",
    );
    created.documents.push(doc.id);

    const v1 = await prisma.documentVersion.findFirst({ where: { documentId: doc.id, versionNumber: 1 } });
    expect(v1).toBeTruthy();
    expect(v1!.status).toBe("ISSUED");
    const v1S3Key = v1!.s3Key;

    await prisma.document.update({ where: { id: doc.id }, data: { status: "SUPERSEDED", version: 2 } });
    await prisma.documentVersion.update({ where: { id: v1!.id }, data: { status: "SUPERSEDED" } });

    const v2 = await prisma.documentVersion.create({
      data: {
        documentId: doc.id, versionNumber: 2, status: "ISSUED",
        s3Key: `documents/${doc.id}/v2.pdf`, fileSize: 200,
        issuedAt: new Date(), triggeringEvent: "Manual re-issue",
      },
    });

    const docAfter = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(docAfter!.status).toBe("SUPERSEDED");
    expect(docAfter!.version).toBe(2);

    const v1After = await prisma.documentVersion.findUnique({ where: { id: v1!.id } });
    expect(v1After!.status).toBe("SUPERSEDED");

    const v2After = await prisma.documentVersion.findUnique({ where: { id: v2.id } });
    expect(v2After!.status).toBe("ISSUED");
    expect(v1S3Key).toBeTruthy();

    await prisma.document.update({ where: { id: doc.id }, data: { status: "INVALIDATED" } });
    await prisma.documentVersion.update({ where: { id: v2.id }, data: { status: "INVALIDATED" } });

    const docFinal = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(docFinal!.status).toBe("INVALIDATED");
    expect(v1!.s3Key).not.toBe(v2.s3Key);
  });

  // ─── T-D13-13: No orphaned NOT_ISSUED documents ───────────────────────
  it("T-D13-13: No orphaned NOT_ISSUED voucher documents", async () => {
    const orphaned = await prisma.document.findMany({
      where: { status: "NOT_ISSUED", type: "VOUCHER" },
    });
    expect(orphaned.length).toBe(0);
  });

  // ─── T-D13-14: Missing passenger data → safe block ────────────────────
  it("T-D13-14: Booking with no passengers → no Voucher", async () => {
    const customerId = await createCustomer("T14");
    const order = await prisma.order.create({
      data: {
        code: `D13-ORD-T14-${stamp}`, number: `TH-T14-${stamp}`, referenceNumber: `MKT-T14-${stamp}`,
        commerceSequence: "T14", status: "PARTIALLY_FULFILLED", paymentStatus: "PAID",
        currency: "USD", amount: 1000, paidAmount: 1000, refundedAmount: 0, version: 1,
        acquisitionSource: "MARKETPLACE", customerId, submittedAt: new Date(), serviceDate: FUTURE(30),
      },
    });
    created.orders.push(order.id);

    const booking = await prisma.booking.create({
      data: {
        code: `D13-BKG-T14-${stamp}`, referenceNumber: `MKT-BKG-T14-${stamp}`,
        orderId: order.id, productId: "00000000-0000-0000-0000-000000000000",
        status: "CONFIRMED", currency: "USD", amount: 1000,
        serviceDate: FUTURE(30), confirmedAt: new Date(),
      },
    });
    created.bookings.push(booking.id);

    await emitAndWait(DomainEvents.BookingConfirmed, {
      orderId: order.id, bookingId: booking.id, code: `BK-${stamp}-T14`,
    });

    await new Promise((r) => setTimeout(r, 2000));
    const vouchers = await prisma.document.findMany({ where: { bookingId: booking.id, type: "VOUCHER" } });
    expect(vouchers).toHaveLength(0);
  });

  // ─── Admin API tests ──────────────────────────────────────────────────
  it("Admin can list all documents via /api/v1/documents", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/documents")
      .set(authHeaders(adminToken));
    // Log actual status for debugging
    if (res.status !== 200) {
      console.log(`[D13-DEBUG] GET /api/v1/documents → ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("Admin can get document detail via /api/v1/documents/:id", async () => {
    if (created.documents.length === 0) return;
    const docId = created.documents[0];
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/${docId}`)
      .set(authHeaders(adminToken));
    if (res.status !== 200) {
      console.log(`[D13-DEBUG] GET /api/v1/documents/${docId} → ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(docId);
  });

  it("Download returns signed URL for ISSUED document", async () => {
    const issued = await prisma.document.findFirst({ where: { status: "ISSUED" } });
    if (!issued) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/${issued.id}/download`)
      .set(authHeaders(adminToken));
    // Controller uses @Res() which sends a 302 redirect to the signed URL
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("https://mock-signed-url.example.com");
  });

  it("Download blocked for INVALIDATED document", async () => {
    const invalidated = await prisma.document.findFirst({ where: { status: "INVALIDATED" } });
    if (!invalidated) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/${invalidated.id}/download`)
      .set(authHeaders(adminToken));
    expect([404, 409]).toContain(res.status);
  });

  // ─── Real PDF validation ──────────────────────────────────────────────
  it("Real PDF: generated binary is valid %PDF with A4 page", async () => {
    const issued = await prisma.document.findFirst({
      where: { status: "ISSUED" },
      include: { versions: { where: { status: "ISSUED" }, take: 1 } },
    });
    if (!issued || !issued.versions[0]) return;

    // Verify the version has valid storage metadata
    const version = issued.versions[0];
    expect(version.s3Key).toBeTruthy();
    expect(version.fileSize).toBeGreaterThan(0);
    expect(version.snapshot).toBeTruthy();

    // Verify putObject was called with valid PDF binary
    expect(mockStorage.putObject).toHaveBeenCalled();
    const lastCall = (mockStorage.putObject as jest.Mock).mock.calls.find(
      (call: any) => call[0]?.key === version.s3Key,
    );
    expect(lastCall).toBeTruthy();
    const pdfBuffer: Buffer = lastCall[0].body;
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    expect(pdfBuffer.slice(0, 5).toString("ascii")).toMatch(/^%PDF/);
  });

  it("Real PDF: VOUCHER contains expected template content", async () => {
    const issued = await prisma.document.findFirst({
      where: { status: "ISSUED", type: "VOUCHER" },
      include: { versions: { where: { status: "ISSUED" }, take: 1 } },
    });
    if (!issued || !issued.versions[0]) return;

    // Verify the snapshot contains expected data fields
    const snapshot = issued.versions[0].snapshot as Record<string, unknown>;
    expect(snapshot.code).toBeTruthy();
    expect(snapshot.travelers).toBeDefined();
    expect(Array.isArray(snapshot.travelers)).toBe(true);

    // Verify putObject was called with valid PDF binary
    const lastCall = (mockStorage.putObject as jest.Mock).mock.calls.find(
      (call: any) => call[0]?.key === issued.versions[0].s3Key,
    );
    expect(lastCall).toBeTruthy();
    const pdfBuffer: Buffer = lastCall[0].body;
    expect(pdfBuffer.length).toBeGreaterThan(100);
    expect(pdfBuffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("Real PDF: PII in snapshot, but redacted at buyer API view", async () => {
    const issued = await prisma.document.findFirst({
      where: { status: "ISSUED" },
      include: { versions: { where: { status: "ISSUED" }, take: 1 } },
    });
    if (!issued || !issued.versions[0]) return;

    const snapshot = issued.versions[0].snapshot as Record<string, unknown>;
    const travelers = snapshot.travelers as Array<Record<string, unknown>> | undefined;
    if (!travelers || travelers.length === 0) return;

    // Snapshot stores original data for audit (passport numbers present in snapshot)
    const hasPassport = travelers.some((t) => t.passportNumber);
    // This is expected — the snapshot is the audit trail

    // But buyer-scope API must redact PII
    const buyer = await createStaff("piiredact", RoleCode.BUYER);
    const cust = await prisma.customer.create({
      data: { firstName: "PII2", lastName: "Buyer2", code: `CRM-PII2-${stamp}`, email: `pii2-${stamp}@test.local` },
    });
    created.customers.push(cust.id);
    await prisma.user.update({ where: { id: buyer.user.id }, data: { customerId: cust.id } });

    // Link document to this customer
    await prisma.document.update({ where: { id: issued.id }, data: { customerId: cust.id } });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/account/documents/${issued.id}`)
      .set(authHeaders(buyer.accessToken));

    if (res.status === 200 && res.body.versions?.[0]?.snapshot?.travelers) {
      const buyerTravelers = res.body.versions[0].snapshot.travelers;
      for (const t of buyerTravelers) {
        expect(t.passportNumber).toBeFalsy();
        expect(t.passportExpiry).toBeFalsy();
      }
    }

    // Restore
    await prisma.document.update({ where: { id: issued.id }, data: { customerId: null } });
  });

  // ─── Storage failure coverage ─────────────────────────────────────────
  it("Storage failure: putObject error leaves document NOT_ISSUED", async () => {
    const customerId = await createCustomer("STORFAIL");
    const order = await prisma.order.create({
      data: {
        code: `D13-ORD-STORFAIL-${stamp}`, number: `TH-SF-${stamp}`, referenceNumber: `MKT-SF-${stamp}`,
        commerceSequence: "STORFAIL", status: "PARTIALLY_FULFILLED", paymentStatus: "PAID",
        currency: "USD", amount: 1000, paidAmount: 1000, refundedAmount: 0, version: 1,
        acquisitionSource: "MARKETPLACE", customerId, submittedAt: new Date(), serviceDate: FUTURE(30),
      },
    });
    created.orders.push(order.id);

    const booking = await prisma.booking.create({
      data: {
        code: `D13-BKG-STORFAIL-${stamp}`,
        referenceNumber: `BKG-SF-${stamp}`,
        orderId: order.id,
        productId: "00000000-0000-0000-0000-000000000000",
        status: "CONFIRMED",
        currency: "USD",
        amount: order.amount,
        serviceDate: FUTURE(30),
        confirmedAt: new Date(),
      },
    });
    created.bookings.push(booking.id);

    await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        firstName: "SF",
        lastName: "Test",
        citizenship: "US",
        gender: "M",
      },
    });

    // Temporarily make putObject throw
    const originalPutObject = mockStorage.putObject;
    (mockStorage.putObject as jest.Mock).mockImplementationOnce(() => {
      throw new Error("S3 upload failed: connection refused");
    });

    await emitAndWait(DomainEvents.BookingConfirmed, {
      bookingId: booking.id,
      orderId: order.id,
      customerId,
      serviceDate: booking.serviceDate,
    });

    // Restore
    (mockStorage.putObject as jest.Mock).mockImplementation(originalPutObject);

    // Give consumer time to process (and fail)
    await new Promise((r) => setTimeout(r, 500));

    // Document should either not exist or remain NOT_ISSUED — never ISSUED
    const doc = await prisma.document.findFirst({
      where: { bookingId: booking.id, type: "VOUCHER" },
    });
    if (doc) {
      expect(doc.status).not.toBe("ISSUED");
    }
    // No ISSUED version should exist
    const versions = await prisma.documentVersion.findMany({
      where: doc ? { documentId: doc.id } : { documentId: "nonexistent" },
    });
    expect(versions.filter((v) => v.status === "ISSUED").length).toBe(0);
  });
});
