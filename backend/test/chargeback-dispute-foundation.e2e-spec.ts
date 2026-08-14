/**
 * E2E PHASE 2 STEP 2.13A — Chargeback / Dispute Foundation (provider-neutral).
 *
 * Доказывает canonical Dispute contract:
 *  1. Dispute — Finance-owned (DSP-*): создание ТОЛЬКО finance.dispute.write;
 *     source authority — CAPTURED Payment (currency/orderId server-derived
 *     verbatim; PENDING/FAILED/CANCELLED → 422); Payment НЕ мутируется
 *     (остаётся CAPTURED; никакого Payment.status = DISPUTED);
 *  2. amount: server-validated 0 < amount ≤ payment.amount (frozen captured);
 *     amount > captured → 409; НЕ netting с Refund (monetary netting deferred —
 *     explicit restriction, документировано в арх-доке);
 *  3. lifecycle: OPENED → RESOLVED | CANCELLED (CAS from-guard); milestones
 *     openedAt/resolvedAt/cancelledAt (first-only, server-owned); повторный
 *     переход → 409; терминальные освобождают слот (attempt 2 легален);
 *  4. cardinality/idempotency: один активный Dispute на Payment; identical
 *     retry → no-op; concurrent duplicate → один факт + controlled 409;
 *  5. mass assignment: forged amount/currency/status/orderId/version →
 *     422; RBAC 401/403/404;
 *  6. boundaries: 0 PSP/webhook; 0 Ledger/ProviderFee/Settlement/Payout/
 *     Invoice/Commission/CommissionAccrual; Booking/availability не тронуты;
 *     Refund-факты не тронуты; 0 Order-проекций;
 *  7. события DisputeOpened/Resolved/Cancelled (correlation/causation);
 *     PII-free DTO.
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
import { Prisma, RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("Phase 2 Step 2.13A — Chargeback / Dispute Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: {
    users: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
    payments: string[];
    refunds: string[];
    disputes: string[];
  } = { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], payments: [], refunds: [], disputes: [] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const createStaff = async (tag: string, roleCode: RoleCode): Promise<Session> => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  const futureDate = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const futureIso = (days = 30) => new Date(Date.now() + days * 86400000).toISOString();

  /** Полная canonical цепочка до Order (frozen money snapshot, как 2.11–2.13 e2e). */
  const buildOrder = async (sm: Session, tag: string, price: number): Promise<{ orderId: string; amount: string; currency: string }> => {
    const smAgent = agent(sm.accessToken);
    const prod = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Dsp ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.id } });
    const date = futureDate();
    await adminAgent.post(`/api/v1/products/${prod.id}/availability`).send({ tariffId: tariff.id, date: `${date}T00:00:00.000Z`, slotsTotal: 10 }).expect(201);

    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: prod.id, tariffId: tariff.id, quantity: 1 }).expect(201);
    await smAgent.put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: futureIso() }).expect(200);
    const issued = (await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201)).body as { total: string; currency: string };
    const intent = (await smAgent.post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200);
    const sale = (await smAgent.post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as { id: string; code: string };
    created.sales.push(sale.id);
    await smAgent.post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    await eventBus.publishPending();
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    return { orderId: order.id, amount: issued.total, currency: issued.currency };
  };

  /** buildOrder + Payment create + confirm → CAPTURED (source authority для Dispute). */
  const buildCapturedPayment = async (sm: Session, fin: Session, tag: string, price: number): Promise<{ orderId: string; paymentId: string; paymentCode: string; amount: string; currency: string }> => {
    const { orderId, amount, currency } = await buildOrder(sm, tag, price);
    const pay = (await agent(fin.accessToken).post("/api/v1/finance/payments").send({ orderId }).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    await eventBus.publishPending();
    return { orderId, paymentId: pay.id, paymentCode: pay.code, amount, currency };
  };

  const createDispute = (fin: Session, paymentId: string, body: Record<string, unknown> = {}) => {
    const a = agent(fin.accessToken);
    return a.post("/api/v1/finance/disputes").send({ paymentId, ...body });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);
    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.disputes.length > 0) {
      const dspEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.disputes } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: dspEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.disputes } } });
      await prisma.disputeHistory.deleteMany({ where: { disputeId: { in: created.disputes } } });
      await prisma.dispute.deleteMany({ where: { id: { in: created.disputes } } });
    }
    if (created.refunds.length > 0) {
      const refundEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.refunds } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: refundEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.refunds } } });
      await prisma.refundHistory.deleteMany({ where: { refundId: { in: created.refunds } } });
      await prisma.refund.deleteMany({ where: { id: { in: created.refunds } } });
    }
    if (created.payments.length > 0) {
      const payEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.payments } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: payEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.payments } } });
      await prisma.paymentHistory.deleteMany({ where: { paymentId: { in: created.payments } } });
      await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    }
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      for (const evType of ["PaymentCaptured", "RefundProcessed", "DisputeOpened"]) {
        await prisma.outboxEvent.deleteMany({ where: { eventType: evType, OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
      }
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.checkoutIntent.deleteMany({ where: { id: { in: created.checkouts } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. canonical create: source CAPTURED Payment, frozen money ─────────────

  it("T1. canonical Dispute create: DSP-* code, OPENED + openedAt, amount из запроса, currency/orderId verbatim из Payment", async () => {
    const sm = await createStaff("s13a_sm1", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin1", RoleCode.FINANCE);
    const { paymentId, orderId, amount, currency } = await buildCapturedPayment(sm, fin, "dsp_t1", 150);

    const res = await createDispute(fin, paymentId, { amount, reason: "Услуга не оказана" }).expect(201);
    created.disputes.push((res.body as { id: string }).id);
    const body = res.body as { code: string; status: string; amount: string; currency: string; orderId: string; openedAt: string | null; resolvedAt: string | null };
    expect(body.code).toMatch(/^DSP-\d{8}$/);
    expect(body.status).toBe("OPENED");
    expect(body.amount).toBe(amount);
    expect(body.currency).toBe(currency);
    expect(body.orderId).toBe(orderId);
    expect(body.openedAt).not.toBeNull();
    expect(body.resolvedAt).toBeNull();
    // Payment НЕ мутирован: status CAPTURED, frozen.
    const payRow = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payRow.status).toBe("CAPTURED");
    expect(String(payRow.amount)).toBe(amount);
    expect(payRow.paidAt).not.toBeNull();
  });

  // ── 2. source authority: non-CAPTURED → 422; unknown → 404 ─────────────────

  it("T2. Dispute против НЕ-CAPTURED Payment (PENDING/FAILED/CANCELLED) → 422; unknown → 404", async () => {
    const sm = await createStaff("s13a_sm2", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin2", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "dsp_t2", 60);
    const pending = (await agent(fin.accessToken).post("/api/v1/finance/payments").send({ orderId }).expect(201)).body as { id: string };
    created.payments.push(pending.id);
    await createDispute(fin, pending.id, { amount: "10" }).expect(422);
    await createDispute(fin, "no-such-payment", { amount: "10" }).expect(404);
  });

  // ── 3. lifecycle: resolve/cancel; milestones first-only; terminal ──────────

  it("T3. create → resolve: milestones first-only; повторный resolve → 409; cancel из RESOLVED → 409 (terminal)", async () => {
    const sm = await createStaff("s13a_sm3", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin3", RoleCode.FINANCE);
    const { orderId, amount } = await buildCapturedPayment(sm, fin, "dsp_t3", 100);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const dsp = (await createDispute(fin, payment.id, { amount }).expect(201)).body as { id: string; code: string };
    created.disputes.push(dsp.id);

    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${dsp.code}/resolve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${dsp.code}/resolve`).expect(409); // repeat → 409
    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${dsp.code}/cancel`).expect(409); // terminal → 409
    await eventBus.publishPending();

    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: dsp.id } });
    expect(row.status).toBe("RESOLVED");
    expect(row.openedAt).not.toBeNull();
    expect(row.resolvedAt).not.toBeNull();
    expect(row.cancelledAt).toBeNull();
    expect(row.isActiveDispute).toBe(false); // слот освобождён
    // События: DisputeOpened/DisputeResolved + correlation.
    for (const evType of ["DisputeOpened", "DisputeResolved"]) {
      const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: evType, aggregateId: dsp.id } });
      expect((ev.payload as { orderId: string }).orderId).toBe(orderId);
      expect(ev.correlationId).not.toBeNull();
    }
  });

  // ── 4. cancel + attempt 2 (повторное открытие после терминального) ─────────

  it("T4. cancel → CANCELLED + cancelledAt; повторное открытие (attempt 2) легально", async () => {
    const sm = await createStaff("s13a_sm4", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin4", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t4", 90);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    const d1 = (await createDispute(fin, payment.id, { amount: "50" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(d1.id);
    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${d1.code}/cancel`).expect(201);
    await eventBus.publishPending();
    const cancelled = await prisma.dispute.findUniqueOrThrow({ where: { id: d1.id } });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.isActiveDispute).toBe(false);

    // Attempt 2: новый факт (слот освобождён).
    const d2 = (await createDispute(fin, payment.id, { amount: "50" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(d2.id);
    expect(d2.code).not.toBe(d1.code);
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(2);
  });

  // ── 5. amount guard + idempotent no-op ─────────────────────────────────────

  it("T5. amount > captured → 409; identical retry (активный Dispute) → no-op существующий факт", async () => {
    const sm = await createStaff("s13a_sm5", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin5", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t5", 100);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    await createDispute(fin, payment.id, { amount: "101" }).expect(409); // > captured
    const d1 = (await createDispute(fin, payment.id, { amount: "60" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(d1.id);
    // Identical retry (тот же amount) → no-op существующий факт (один активный
    // Dispute на Payment; не сумма-срез).
    const dup = (await createDispute(fin, payment.id, { amount: "60" }).expect(201)).body as { id: string };
    expect(dup.id).toBe(d1.id);
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(1);
    // STRICT REVIEW FIX: DIVERGENT amount при активном Dispute → controlled 409,
    // НЕ молчаливый возврат существующего факта с другой суммой (класс
    // «silent divergent idempotency success», Ledger 2.10A FIX 1 прецедент).
    await createDispute(fin, payment.id, { amount: "30" }).expect(409);
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(1);
  });

  // ── 6. concurrent duplicate → один факт, controlled 409 ───────────────────

  it("T6. concurrent duplicate create → один факт; проигравший — controlled 409 (не raw 500)", async () => {
    const sm = await createStaff("s13a_sm6", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin6", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t6", 80);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/disputes").send({ paymentId: payment.id, amount: "40" }),
      a.post("/api/v1/finance/disputes").send({ paymentId: payment.id, amount: "40" }),
    ]);
    expect([r1.status, r2.status]).toContain(201);
    for (const s of [r1.status, r2.status]) {
      if (s >= 400) expect(s).toBeLessThan(500); // controlled, без raw 500
    }
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(1);
    const winner = [r1, r2].find((r) => r.status === 201);
    created.disputes.push((winner!.body as { id: string }).id);
  });

  // ── 7. RBAC / IDOR ─────────────────────────────────────────────────────────

  it("T7. RBAC: 401 аноним, 403 на write для SALES_MANAGER/DIRECTOR, FINANCE работает; read 200; 404 unknown", async () => {
    const sm = await createStaff("s13a_sm7a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin7b", RoleCode.FINANCE);
    const dir = await createStaff("s13a_dir7c", RoleCode.DIRECTOR);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t7", 70);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    await request(app.getHttpServer()).post("/api/v1/finance/disputes").send({ paymentId: payment.id, amount: "10" }).expect(401);
    await createDispute(sm, payment.id, { amount: "10" }).expect(403); // SALES read-only
    await createDispute(dir, payment.id, { amount: "10" }).expect(403); // DIRECTOR read-only
    const ok = (await createDispute(fin, payment.id, { amount: "10" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(ok.id);
    await agent(sm.accessToken).post(`/api/v1/finance/disputes/${ok.code}/resolve`).expect(403); // resolve — write
    const list = await agent(sm.accessToken).get("/api/v1/finance/disputes").expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    await agent(fin.accessToken).get("/api/v1/finance/disputes/DSP-99999999").expect(404);
    await agent(fin.accessToken).post("/api/v1/finance/disputes/DSP-99999999/resolve").expect(404);
  });

  // ── 8. mass assignment ─────────────────────────────────────────────────────

  it("T8. forged server-owned поля на create (currency/status/orderId/version/milestones) → 422", async () => {
    const sm = await createStaff("s13a_sm8a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin8b", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t8", 60);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    for (const forged of [
      { amount: "10", currency: "RUB" },
      { amount: "10", status: "RESOLVED" },
      { amount: "10", orderId: "ord-fake" },
      { amount: "10", version: 99 },
      { amount: "10", resolvedAt: "2026-08-14T00:00:00.000Z" },
      { amount: "10", isActiveDispute: false },
      { amount: "10", code: "DSP-99999999" },
    ]) {
      await createDispute(fin, payment.id, forged).expect(422);
    }
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(0);
  });

  // ── 9. boundaries: 0 finance side effects; Payment/Refund не тронуты ───────

  it("T9. Dispute runtime создаёт 0 Ledger/ProviderFee/Settlement/Payout/Invoice/Commission/CommissionAccrual; Payment/Refund/Booking не тронуты", async () => {
    const sm = await createStaff("s13a_sm9a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin9b", RoleCode.FINANCE);
    const { orderId, paymentId, paymentCode, amount } = await buildCapturedPayment(sm, fin, "dsp_t9", 45);
    const before = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      refunds: await prisma.refund.count({ where: { paymentId } }),
      bookings: await prisma.booking.count({ where: { orderId } }),
      availReserved: await prisma.availabilityReservation.count({ where: { sourceSaleId: { in: created.sales } } }),
    };
    const dsp = (await createDispute(fin, paymentId, { amount }).expect(201)).body as { id: string; code: string };
    created.disputes.push(dsp.id);
    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${dsp.code}/resolve`).expect(201);
    await eventBus.publishPending();
    const after = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      refunds: await prisma.refund.count({ where: { paymentId } }),
      bookings: await prisma.booking.count({ where: { orderId } }),
      availReserved: await prisma.availabilityReservation.count({ where: { sourceSaleId: { in: created.sales } } }),
    };
    expect(after).toEqual(before);
    // Payment НЕ мутирован (никакого DISPUTED-статуса).
    const payRow = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payRow.status).toBe("CAPTURED");
    expect(String(payRow.amount)).toBe(amount);
    expect(payRow.paidAt).not.toBeNull();
    expect(payRow.code).toBe(paymentCode);
  });

  // ── 10. Refund interaction: explicit restriction (без netting) ─────────────

  it("T10. Refund interaction: Dispute создаётся независимо от refund state; amount ≤ captured (НЕ netting с Refund — monetary netting deferred)", async () => {
    const sm = await createStaff("s13a_sm10a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin10b", RoleCode.FINANCE);
    const { orderId, paymentId, amount } = await buildCapturedPayment(sm, fin, "dsp_t10", 100);
    // Partial processed refund 40 → refundable-срез занят; dispute amount ≤ captured (100), без netting.
    const rfd = (await agent(fin.accessToken).post("/api/v1/finance/refunds").send({ paymentId, amount: "40" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(rfd.id);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/process`).expect(201);
    await eventBus.publishPending();

    // Explicit restriction: dispute amount ограничен captured (100), НЕ captured−refunded (60).
    // Monetary netting (disputable vs already-refunded) — deferred (2.12D/2.14A), документировано.
    const dsp = (await createDispute(fin, paymentId, { amount }).expect(201)).body as { id: string; amount: string; currency: string; orderId: string };
    created.disputes.push(dsp.id);
    expect(dsp.amount).toBe(amount);
    expect(dsp.currency).toBe("USD");
    expect(dsp.orderId).toBe(orderId);
    // Refund-факт не тронут.
    const refundRow = await prisma.refund.findUniqueOrThrow({ where: { id: rfd.id } });
    expect(refundRow.status).toBe("PROCESSED");
    expect(String(refundRow.amount)).toBe("40");
  });

  // ── 11. PII-free DTO / events ──────────────────────────────────────────────

  it("T11. Dispute DTO/events не содержат PII/card/секретов (только refs + money)", async () => {
    const sm = await createStaff("s13a_sm11a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin11b", RoleCode.FINANCE);
    const { paymentId, orderId } = await buildCapturedPayment(sm, fin, "dsp_t11", 30);
    const dsp = (await createDispute(fin, paymentId, { amount: "30" }).expect(201)).body as Record<string, unknown>;
    created.disputes.push(dsp.id as string);
    const keys = Object.keys(dsp).join(",");
    expect(keys).not.toContain("pan");
    expect(keys).not.toContain("cvv");
    expect(keys).not.toContain("cardNumber");
    expect(keys).not.toContain("secret");
    expect(keys).not.toContain("firstName");
    expect(keys).not.toContain("passport");
    expect((dsp as { paymentId: string }).paymentId).toBe(paymentId);
    expect((dsp as { orderId: string }).orderId).toBe(orderId);
  });

  // ── 12. attempt 2 после RESOLVED (терминальный) легален ────────────────────

  it("T12. attempt 2 после RESOLVED: новый факт (слот освобождён терминальным состоянием)", async () => {
    const sm = await createStaff("s13a_sm12a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13a_fin12b", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "dsp_t12", 50);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const d1 = (await createDispute(fin, payment.id, { amount: "30" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(d1.id);
    await agent(fin.accessToken).post(`/api/v1/finance/disputes/${d1.code}/resolve`).expect(201);
    await eventBus.publishPending();
    const d2 = (await createDispute(fin, payment.id, { amount: "30" }).expect(201)).body as { id: string; code: string };
    created.disputes.push(d2.id);
    expect(d2.code).not.toBe(d1.code);
    expect(await prisma.dispute.count({ where: { paymentId: payment.id } })).toBe(2);
  });
});
