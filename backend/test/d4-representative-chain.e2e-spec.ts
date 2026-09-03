/**
 * PHASE 3 — PRE-STEP 3.12 — D4 — REPRESENTATIVE END-TO-END COMMERCE CHAIN (e2e).
 *
 * D4 §28 — deterministic lifecycle chains через РЕАЛЬНЫЕ команды (никаких
 * прямых INSERT финальных статусов, §14). Каждая цепь проходит canonical
 * Request → convert → traveler collection → final-confirm → Booking → finance.
 *
 * Охват (Request→Booking-ноги уже доказаны d3-request-flow / d3-traveler-
 * collection; здесь — финансовые и отменные ноги, которые до D4 F3 fix были
 * недостижимы: finance.payment.create/manage + finance.refund.execute не
 * существовали → 403 для ВСЕХ ролей):
 *  1. Request → ... → Booking CONFIRMED (S7/S8/S9) — целостность графа +
 *     temporal invariants;
 *  2. Booking → successful Payment CAPTURED (S11) — Order-paid projection;
 *  3. partial refund → PROCESSED (S15) + over-refund 409 + full refund → Order
 *     REFUNDED (S16) — финансовая целостность (sum(refunds) ≤ paid, temporal);
 *  4. Booking → cancellation BEFORE payment (S13) — CANCELLED без Payment/
 *     Refund, Booking отменяется компенсацией OrderCancelled.
 *
 * Synthetic personas (§26), PII-safe: TOUR product требует только имена.
 * Fixtures: одобренный PARTNER (owner-rule Step 3.6B), продукт, CRM customer.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { Prisma, RoleCode } from "../src/generated/prisma/client";

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

interface Session {
  accessToken: string;
  user: { id: string };
}
interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

const waitFor = async <T>(fn: () => Promise<T | null | undefined>, until: (v: T) => boolean, tries = 25): Promise<T> => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v && until(v)) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("waitFor: condition not met");
};

describe("Phase 3 Pre-Step 3.12 D4 — Representative Commerce Chains (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    requests: string[];
    orders: string[];
  } = { users: [], customers: [], partners: [], products: [], requests: [], orders: [] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201);
    const s = await login(`${tag}${stamp}`, password);
    created.users.push(s.user.id);
    return s;
  };

  /** Полный onboarding одобренного партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `d4chp${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D4 Chain Partner ${tag} ${stamp}`,
        country: "AZ",
        contactEmail: email,
        termsAccepted: true,
      })
      .expect(201);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    created.users.push(session.user.id);
    return { partnerId: approved.partnerId, token: session.accessToken, agent: agent(session.accessToken) };
  };

  const createProduct = async (seller: Seller, tag: string) => {
    const res = await seller.agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `D4CH ${tag} ${stamp}`, tariffs: [{ name: "Std", price: 150 }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    return product.id;
  };

  const createCustomer = async (tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "D4CH",
        lastName: tag,
        code: `CRM-D4CH-${tag.toUpperCase()}-${stamp}`,
        email: `d4ch-${tag.toLowerCase()}-${stamp}@example.com`,
      },
    });
    created.customers.push(customer.id);
    return customer.id;
  };

  const persona = (n: number) => ({ firstName: `Чейн${n}`, lastName: "Представительный" });

  /**
   * Deterministic chain builder — canonical Request → Booking CONFIRMED.
   * Реальные команды: Request → confirm-price → customer-accept → convert →
   * process → traveler collection (2) → final-confirm → order confirm → order
   * send → (Booking via subscriber) → booking send → booking confirm.
   * Возвращает order/booking/request ids. Кодирует ровно те transition gates,
   * что и production lifecycle.
   */
  const chainToBookingConfirmed = async (op: Session, seller: Seller, productId: string, customerId: string) => {
    const req = (await agent(op.accessToken)
      .post("/api/v1/requests")
      .send({
        customerId,
        productId,
        partnerId: seller.partnerId,
        requestedServiceDate: FUTURE(30),
        quantity: 2,
        travelerCount: 2,
        displayedPrice: 340,
        displayedCurrency: "USD",
      })
      .expect(201)).body as { id: string; referenceNumber: string };
    created.requests.push(req.id);
    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/confirm-price`).send({}).expect(201);
    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/customer-accept`).send({}).expect(201);
    const conv = (await agent(op.accessToken).post(`/api/v1/requests/${req.id}/convert`).send({}).expect(201)).body as any;
    const orderId = conv.convertedOrder.id as string;
    created.orders.push(orderId);

    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "process" }).expect(200);
    const travelersRes = (await agent(op.accessToken).get(`/api/v1/orders/${orderId}/travelers`).expect(200)).body as { travelers: Array<{ id: string }> };
    expect(travelersRes.travelers).toHaveLength(2);
    for (let i = 0; i < travelersRes.travelers.length; i++) {
      await agent(op.accessToken)
        .patch(`/api/v1/orders/${orderId}/travelers/${travelersRes.travelers[i].id}`)
        .send(persona(i + 1))
        .expect(200);
    }
    await agent(op.accessToken).post(`/api/v1/orders/${orderId}/final-confirm`).send({}).expect(201);
    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "confirm" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(200);

    // Booking создаётся in-process subscriber-ом по BookingRequested.
    const booking = await waitFor(
      async () => {
        const rows = await prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
        return rows[0] ?? null;
      },
      (b) => !!b,
    );
    await agent(op.accessToken).patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(200);
    return { requestRef: req.referenceNumber, orderId, bookingId: booking.id };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Booking" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('BookingRequested','BookingCreated','BookingConfirmed','BookingCancelled','OrderCancelled','PaymentCaptured','RefundProcessed') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM "finance"."Refund" WHERE "paymentId" IN (SELECT id FROM "finance"."Payment" WHERE "orderId" = ANY($1))`, created.orders);
      await prisma.$executeRawUnsafe(`DELETE FROM "finance"."Payment" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  let op: Session;
  let fin: Session;
  let seller: Seller;
  let productId: string;
  let customerId: string;

  it("1. Request → Booking CONFIRMED: полная canonical цепь + graph/temporal integrity (S7/S8/S9)", async () => {
    seller = await createApprovedSeller("pay");
    op = await createStaff("d4ch_op1", RoleCode.OPERATOR);
    fin = await createStaff("d4ch_fin1", RoleCode.FINANCE);
    customerId = await createCustomer("Pay");
    productId = await createProduct(seller, "pay");

    const { requestRef, orderId, bookingId } = await chainToBookingConfirmed(op, seller, productId, customerId);
    (global as any).__d4_chain = { requestRef, orderId, bookingId };

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId }, orderBy: { position: "asc" } });
    const passengers = await prisma.passenger.findMany({ where: { bookingId }, orderBy: { id: "asc" } });

    // Graph: статусы, связи и ссылки (commercial refs через UUID-отношения).
    expect(order.status).toBe("PARTIALLY_FULFILLED"); // Booking CONFIRMED reconcile
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.orderId).toBe(orderId);
    expect(travelers).toHaveLength(2);
    expect(travelers.every((t) => t.firstName !== null && t.lastName !== null)).toBe(true);
    expect(passengers).toHaveLength(2);
    expect(order.referenceNumber).toBe(`MKT-ORD-${requestRef.replace("MKT-REQ-", "")}`);
    expect(booking.commerceSequence).toBe(order.commerceSequence);
    expect(order.finalConfirmedAt).not.toBeNull();
    expect(booking.confirmedAt).not.toBeNull();

    // Temporal invariants (§19): Request.createdAt ≤ order.createdAt ≤ booking.
    const reqRow = await prisma.request.findFirstOrThrow({ where: { convertedOrderId: orderId } });
    expect(reqRow.createdAt.getTime()).toBeLessThanOrEqual(order.createdAt.getTime());
    expect(order.createdAt.getTime()).toBeLessThanOrEqual(booking.createdAt.getTime());
    expect(booking.createdAt.getTime()).toBeLessThanOrEqual(booking.confirmedAt!.getTime());
    expect(order.amount.greaterThan(0)).toBe(true);
  });

  it("2. Booking → Payment CAPTURED (S11): finance.payment.create/manage реально работают (D4 F3 fix)", async () => {
    const chain = (global as any).__d4_chain as { orderId: string; bookingId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { id: chain.orderId } });
    const expected = order.amount.toString();

    // F3 regression: до миграции эти ключи отсутствовали → 403 для всех ролей.
    const createdPay = (await agent(fin.accessToken)
      .post("/api/v1/finance/payments")
      .set("Idempotency-Key", `d4ch-pay-${chain.orderId}`)
      .send({ orderId: chain.orderId, paymentMethod: "MANUAL", reason: "D4 e2e: оплата по заказу (manual capture)" })
      .expect(201)).body as any;
    expect(createdPay.status).toBe("PENDING");
    expect(createdPay.amount).toBe(expected);

    const confirmed = (await agent(fin.accessToken)
      .post(`/api/v1/finance/payments/${createdPay.code}/confirm`)
      .send({})
      .expect(201)).body as any;
    expect(confirmed.status).toBe("CAPTURED");
    expect(confirmed.paidAt).toBeTruthy();

    // Order-owned projection (PaymentCaptured subscriber) — paidAmount/PAID.
    const projected = await waitFor(
      async () => prisma.order.findUnique({ where: { id: chain.orderId } }),
      (o) => o!.paymentStatus === "PAID" && o!.paidAmount.toString() === expected,
    );
    expect(projected.paymentStatus).toBe("PAID");
    expect(projected.paidAmount.toString()).toBe(expected);
    const pay = await prisma.payment.findUniqueOrThrow({ where: { code: createdPay.code } });
    expect(pay.referenceNumber).toBe(`MKT-PAY-${order.commerceSequence}-1`);
    expect(pay.paidAt!.getTime()).toBeGreaterThanOrEqual(order.createdAt.getTime());
    (global as any).__d4_chain = { ...chain, paymentCode: createdPay.code, paymentId: pay.id };
  });

  it("3. partial refund (S15) + over-refund 409 + full refund → Order REFUNDED (S16) — financial integrity", async () => {
    const chain = (global as any).__d4_chain as { orderId: string; paymentCode: string; paymentId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { id: chain.orderId } });
    const total = order.paidAmount;
    // Distinct amounts (⅓ + ⅔): refund idempotency-key = (paymentId, amount),
    // поэтому partial и remainder обязаны отличаться.
    const totalInt = Number(total.toString());
    const partialAmt = Math.max(1, Math.floor(totalInt / 3));
    const remainderAmt = totalInt - partialAmt;
    expect(remainderAmt).toBeGreaterThan(0);
    expect(remainderAmt).not.toBe(partialAmt);

    // S15: частичный возврат (⅓).
    const r1 = (await agent(fin.accessToken)
      .post("/api/v1/finance/refunds")
      .send({ paymentId: chain.paymentId, amount: String(partialAmt), reason: "D4 e2e: частичный возврат" })
      .expect(201)).body as any;
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1.code}/approve`).send({}).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1.code}/process`).send({}).expect(201);
    const refundRow1 = await prisma.refund.findUniqueOrThrow({ where: { code: r1.code } });
    expect(refundRow1.status).toBe("PROCESSED");

    const after1 = await waitFor(
      async () => prisma.order.findUnique({ where: { id: chain.orderId } }),
      (o) => o!.refundedAmount.toString() === String(partialAmt),
    );
    expect(after1.refundedAmount.toString()).toBe(String(partialAmt));
    expect(after1.paymentStatus).toBe("PAID"); // частичный возврат — не REFUNDED

    // Over-refund protection: remainder + 1 > refundable → 409.
    const over = remainderAmt + 1;
    await agent(fin.accessToken)
      .post("/api/v1/finance/refunds")
      .send({ paymentId: chain.paymentId, amount: String(over), reason: "D4 e2e: over-refund probe" })
      .expect(409);

    // S16: полный возврат остатка (⅔).
    const r2 = (await agent(fin.accessToken)
      .post("/api/v1/finance/refunds")
      .send({ paymentId: chain.paymentId, amount: String(remainderAmt), reason: "D4 e2e: полный возврат остатка" })
      .expect(201)).body as any;
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r2.code}/approve`).send({}).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r2.code}/process`).send({}).expect(201);

    const after2 = await waitFor(
      async () => prisma.order.findUnique({ where: { id: chain.orderId } }),
      (o) => o!.refundedAmount.toString() === total.toString(),
    );
    expect(after2.paymentStatus).toBe("REFUNDED"); // refunded >= paid → REFUNDED

    // Financial integrity (§20): sum(refunds) == paid, каждый refund ≥ payment.createdAt.
    const refunds = await prisma.refund.findMany({ where: { paymentId: chain.paymentId } });
    const sum = refunds.reduce((acc: Prisma.Decimal, r) => acc.add(r.amount), new Prisma.Decimal(0));
    expect(sum.toString()).toBe(total.toString());
    const pay = await prisma.payment.findUniqueOrThrow({ where: { id: chain.paymentId } });
    for (const r of refunds) {
      expect(r.createdAt.getTime()).toBeGreaterThanOrEqual(pay.paidAt!.getTime());
      expect(r.amount.greaterThan(0)).toBe(true);
    }
    // Refund reference — marketplace REF sequence (Finance-owned aggregate).
    expect(refundRow1.referenceNumber).toMatch(/^MKT-REF-/);
  });

  it("4. Booking → cancellation BEFORE payment (S13): CANCELLED, zero Payment/Refund, Booking компенсируется", async () => {
    const chain2 = await chainToBookingConfirmed(op, seller, productId, customerId);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: chain2.orderId } });
    expect(order.paymentStatus).toBe("UNPAID");

    // Cancel до payment — реальная команда (valid transition from active state).
    await agent(op.accessToken).patch(`/api/v1/orders/${chain2.orderId}`).send({ action: "cancel" }).expect(200);

    const cancelled = await waitFor(
      async () => prisma.order.findUnique({ where: { id: chain2.orderId } }),
      (o) => o!.status === "CANCELLED",
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.paidAmount.toString()).toBe("0");
    expect(cancelled.refundedAmount.toString()).toBe("0");
    expect(cancelled.paymentStatus).toBe("UNPAID");

    // Компенсация OrderCancelled → Booking CANCELLED.
    const booking = await waitFor(
      async () => prisma.booking.findUnique({ where: { id: chain2.bookingId } }),
      (b) => b!.status === "CANCELLED",
    );
    expect(booking.status).toBe("CANCELLED");

    // Никаких Payment/Refund фактов (S13 — отмена до оплаты). Refund ссылается
    // на Payment (paymentId, без FK) — при 0 Payment 0 Refund для этого заказа.
    expect(await prisma.payment.count({ where: { orderId: chain2.orderId } })).toBe(0);
    const orderPayments = await prisma.payment.findMany({ where: { orderId: chain2.orderId }, select: { id: true } });
    expect(await prisma.refund.count({ where: { paymentId: { in: orderPayments.map((p) => p.id) } } })).toBe(0);
  });
});
