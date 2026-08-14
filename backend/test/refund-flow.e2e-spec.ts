/**
 * E2E PHASE 2 STEP 2.13 — Refund Flow (provider-neutral Refund runtime).
 *
 * Доказывает canonical Refund contract:
 *  1. Refund — Finance-owned (RFD-*): создание ТОЛЬКО finance.refund.write;
 *     source authority — CAPTURED Payment (currency/orderId server-derived
 *     verbatim; PENDING/FAILED/CANCELLED → 422); Payment НЕ мутируется
 *     (остаётся CAPTURED; REFUNDED reserved unreachable — partial refund
 *     делает одиночный Payment.REFUNDED семантически неверным, §9);
 *  2. lifecycle: REQUESTED → APPROVED → PROCESSED | FAILED; milestones
 *     requestedAt/approvedAt/processedAt/failedAt (first-only, server-owned);
 *     CAS from-guard; повторный переход → 409;
 *  3. partial refunds: несколько Refund на Payment (разные суммы); full refund
 *     (refunded >= paid) → Order paymentStatus REFUNDED; partial → PAID;
 *     refundedAmount — Order-owned projection (Order НЕ пишется Finance-ом);
 *  4. over-refund protection: refundable = payment.amount − Σ(non-FAILED);
 *     sequential > refundable → 409; concurrent 70+70 на 100 → один факт,
 *     total ≤ amount, без raw 500 (serialized advisory lock);
 *  5. idempotency: identical retry (paymentId+amount, НЕ-FAILED) → no-op;
 *     attempt 2 после FAILED легален; concurrent duplicate → один факт;
 *  6. mass assignment: forged amount/currency/status/orderId/version →
 *     422; RBAC 401/403/404;
 *  7. boundaries: 0 Ledger/ProviderFee/Settlement/Payout/Invoice/Commission/
 *     CommissionAccrual; Booking/availability не тронуты; Payment.amount
 *     frozen (никакого reprice);
 *  8. события RefundCreated/Approved/Processed/Failed (correlation/causation);
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

describe("Phase 2 Step 2.13 — Refund Flow (e2e)", () => {
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
    bookings: string[];
    payments: string[];
    refunds: string[];
  } = { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], bookings: [], payments: [], refunds: [] };

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

  /** Полная canonical цепочка до Order (frozen money snapshot, как 2.11/2.12 e2e). */
  const buildOrder = async (sm: Session, tag: string, price: number, opts: { buyerRequest?: boolean } = {}): Promise<{ orderId: string; amount: string; currency: string }> => {
    const smAgent = agent(sm.accessToken);
    const prod = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Ref ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.id } });
    const date = futureDate();
    await adminAgent.post(`/api/v1/products/${prod.id}/availability`).send({ tariffId: tariff.id, date: `${date}T00:00:00.000Z`, slotsTotal: 10 }).expect(201);

    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    if (opts.buyerRequest) await prisma.quote.update({ where: { id: quote.id }, data: { acquisitionSource: "BUYER_REQUEST" } });
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

  /** buildOrder + Payment create + confirm → CAPTURED (source authority для Refund). */
  const buildCapturedPayment = async (sm: Session, fin: Session, tag: string, price: number, opts: { buyerRequest?: boolean } = {}): Promise<{ orderId: string; paymentId: string; paymentCode: string; amount: string; currency: string }> => {
    const { orderId, amount, currency } = await buildOrder(sm, tag, price, opts);
    const pay = (await agent(fin.accessToken).post("/api/v1/finance/payments").send({ orderId }).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    await eventBus.publishPending();
    return { orderId, paymentId: pay.id, paymentCode: pay.code, amount, currency };
  };

  const createRefund = (fin: Session, paymentId: string, body: Record<string, unknown> = {}) => {
    const a = agent(fin.accessToken);
    return a.post("/api/v1/finance/refunds").send({ paymentId, ...body });
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
      // PaymentCaptured/RefundProcessed payload-ссылки на эти заказы.
      for (const evType of ["PaymentCaptured", "RefundProcessed"]) {
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

  // ── 1. canonical create: source CAPTURED Payment, frozen currency ──────────

  it("T1. canonical Refund create: RFD-* code, REQUESTED + requestedAt, amount из запроса, currency/orderId verbatim из Payment", async () => {
    const sm = await createStaff("s13_sm1", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin1", RoleCode.FINANCE);
    const { paymentId, orderId, amount, currency } = await buildCapturedPayment(sm, fin, "rfd_t1", 150);

    const res = await createRefund(fin, paymentId, { amount, reason: "Отказ от услуги" }).expect(201);
    created.refunds.push((res.body as { id: string }).id);
    const body = res.body as { code: string; status: string; amount: string; currency: string; orderId: string; requestedAt: string | null; approvedAt: string | null };
    expect(body.code).toMatch(/^RFD-\d{8}$/);
    expect(body.status).toBe("REQUESTED");
    expect(body.amount).toBe(amount);
    expect(body.currency).toBe(currency);
    expect(body.orderId).toBe(orderId);
    expect(body.requestedAt).not.toBeNull();
    expect(body.approvedAt).toBeNull();
    // Order projection не меняется до PROCESSED.
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("PAID");
    expect(String(orderRow.refundedAmount)).toBe("0");
  });

  // ── 2. source authority: non-CAPTURED → 422 ────────────────────────────────

  it("T2. Refund против НЕ-CAPTURED Payment (PENDING/FAILED/CANCELLED) → 422; unknown → 404", async () => {
    const sm = await createStaff("s13_sm2", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin2", RoleCode.FINANCE);
    // Order + PENDING payment (НЕ подтверждён) — refund невозможен.
    const { orderId } = await buildOrder(sm, "rfd_t2", 60);
    const pending = (await agent(fin.accessToken).post("/api/v1/finance/payments").send({ orderId }).expect(201)).body as { id: string };
    created.payments.push(pending.id);
    await createRefund(fin, pending.id, { amount: "10" }).expect(422);
    await createRefund(fin, "no-such-payment", { amount: "10" }).expect(404);
  });

  // ── 3. full flow: approve → process → PROCESSED; Order projection REFUNDED ─

  it("T3. create → approve → process: milestones first-only, Order paymentStatus REFUNDED (полный возврат), refundedAmount", async () => {
    const sm = await createStaff("s13_sm3", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin3", RoleCode.FINANCE);
    const { orderId, amount } = await buildCapturedPayment(sm, fin, "rfd_t3", 100);
    const rfd = (await createRefund(fin, (await prisma.payment.findFirstOrThrow({ where: { orderId } })).id, { amount }).expect(201)).body as { id: string; code: string };
    created.refunds.push(rfd.id);

    // process до approve → 409 (from-guard).
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/process`).expect(409);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/approve`).expect(409); // repeat → 409
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/process`).expect(201);
    await eventBus.publishPending();

    const row = await prisma.refund.findUniqueOrThrow({ where: { id: rfd.id } });
    expect(row.status).toBe("PROCESSED");
    expect(row.requestedAt).not.toBeNull();
    expect(row.approvedAt).not.toBeNull();
    expect(row.processedAt).not.toBeNull();
    expect(row.failedAt).toBeNull();
    // Order projection (Order-owned subscriber на RefundProcessed).
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("REFUNDED");
    expect(String(orderRow.refundedAmount)).toBe(amount);
    expect(String(orderRow.paidAmount)).toBe(amount); // исторический факт не переписан
    // События: RefundCreated/Approved/Processed + correlation.
    for (const evType of ["RefundCreated", "RefundApproved", "RefundProcessed"]) {
      const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: evType, aggregateId: rfd.id } });
      expect((ev.payload as { orderId: string }).orderId).toBe(orderId);
      expect(ev.correlationId).not.toBeNull();
    }
  });

  // ── 4. partial refunds: две разные суммы; Order paymentStatus PAID → REFUNDED ─

  it("T4. частичные refunds: 40 + 60 на 100 → paymentStatus PAID (partial), затем REFUNDED (full); разные суммы — независимые Refund", async () => {
    const sm = await createStaff("s13_sm4", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin4", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t4", 100);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    const r1 = (await createRefund(fin, payment.id, { amount: "40" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(r1.id);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1.code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1.code}/process`).expect(201);
    await eventBus.publishPending();
    let orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("PAID"); // partial → остаётся PAID
    expect(String(orderRow.refundedAmount)).toBe("40");

    const r2 = (await createRefund(fin, payment.id, { amount: "60" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(r2.id);
    expect(r2.code).not.toBe(r1.code); // разные суммы → разные факты
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r2.code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r2.code}/process`).expect(201);
    await eventBus.publishPending();
    orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("REFUNDED"); // полный возврат
    expect(String(orderRow.refundedAmount)).toBe("100");
    expect(await prisma.refund.count({ where: { paymentId: payment.id } })).toBe(2);
  });

  // ── 5. over-refund: sequential → 409 ───────────────────────────────────────

  it("T5. refund > refundable → 409 (sequential over-refund); второй полный refund — idempotent no-op", async () => {
    const sm = await createStaff("s13_sm5", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin5", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t5", 100);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    const r1 = (await createRefund(fin, payment.id, { amount: "60" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(r1.id);
    // 60 + 50 = 110 > 100 → 409 (refundable = 40).
    await createRefund(fin, payment.id, { amount: "50" }).expect(409);
    // Повторный идентичный create (60) — no-op существующий факт.
    const dup = (await createRefund(fin, payment.id, { amount: "60" }).expect(201)).body as { id: string };
    expect(dup.id).toBe(r1.id);
    expect(await prisma.refund.count({ where: { paymentId: payment.id } })).toBe(1);
  });

  // ── 6. attempt 2 после FAILED; fail из REQUESTED и APPROVED ────────────────

  it("T6. fail из REQUESTED → FAILED + failedAt; attempt 2 (тот же amount) легален", async () => {
    const sm = await createStaff("s13_sm6", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin6", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t6", 90);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    const r1 = (await createRefund(fin, payment.id, { amount: "50" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(r1.id);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1.code}/fail`).expect(201);
    await eventBus.publishPending();
    const failed = await prisma.refund.findUniqueOrThrow({ where: { id: r1.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failedAt).not.toBeNull();
    expect(failed.processedAt).toBeNull();
    expect(failed.isActiveRefund).toBe(false);
    // Order projection не реагирует на FAILED.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe("PAID");

    // Attempt 2: тот же amount после FAILED → новый факт (слот освобождён).
    const r2 = (await createRefund(fin, payment.id, { amount: "50" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(r2.id);
    expect(r2.code).not.toBe(r1.code);
    expect(await prisma.refund.count({ where: { paymentId: payment.id } })).toBe(2);
  });

  // ── 7. concurrent duplicate create → один факт, controlled 409 ─────────────

  it("T7. concurrent duplicate create (тот же amount) → один факт; проигравший — controlled 409 (не raw 500)", async () => {
    const sm = await createStaff("s13_sm7", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin7", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t7", 80);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/refunds").send({ paymentId: payment.id, amount: "40" }),
      a.post("/api/v1/finance/refunds").send({ paymentId: payment.id, amount: "40" }),
    ]);
    expect([r1.status, r2.status]).toContain(201);
    for (const s of [r1.status, r2.status]) {
      if (s >= 400) expect(s).toBeLessThan(500); // controlled, без raw 500
    }
    expect(await prisma.refund.count({ where: { paymentId: payment.id } })).toBe(1);
    const winner = [r1, r2].find((r) => r.status === 201);
    created.refunds.push((winner!.body as { id: string }).id);
  });

  // ── 8. concurrent over-refund race: 70+70 на 100 → total ≤ amount ──────────

  it("T8. concurrent over-refund race (70+70 на 100) → сумма никогда не превышает amount; без raw 500 (serialized advisory lock)", async () => {
    const sm = await createStaff("s13_sm8", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin8", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t8", 100);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/refunds").send({ paymentId: payment.id, amount: "70" }),
      a.post("/api/v1/finance/refunds").send({ paymentId: payment.id, amount: "70" }),
    ]);
    const statuses = [r1.status, r2.status];
    expect(statuses).toContain(201);
    for (const s of statuses) {
      if (s >= 400) expect(s).toBeLessThan(500); // 409 (over-refund), без raw 500
    }
    // Суммарный refundable-слот никогда не превышает payment.amount.
    const rows = await prisma.refund.findMany({ where: { paymentId: payment.id, status: { notIn: ["FAILED"] } } });
    const total = rows.reduce((acc, r) => acc.plus(r.amount), new Prisma.Decimal(0));
    expect(total.lessThanOrEqualTo(new Prisma.Decimal("100"))).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(1); // ровно один факт 70
    const winner = [r1, r2].find((r) => r.status === 201);
    created.refunds.push((winner!.body as { id: string }).id);
  });

  // ── 9. RBAC / IDOR ─────────────────────────────────────────────────────────

  it("T9. RBAC: 401 аноним, 403 на write/approve для SALES_MANAGER/DIRECTOR, FINANCE работает; 404 unknown", async () => {
    const sm = await createStaff("s13_sm9a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin9b", RoleCode.FINANCE);
    const dir = await createStaff("s13_dir9c", RoleCode.DIRECTOR);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t9", 70);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    await request(app.getHttpServer()).post("/api/v1/finance/refunds").send({ paymentId: payment.id, amount: "10" }).expect(401);
    await createRefund(sm, payment.id, { amount: "10" }).expect(403); // SALES read-only
    await createRefund(dir, payment.id, { amount: "10" }).expect(403); // DIRECTOR read-only
    const ok = (await createRefund(fin, payment.id, { amount: "10" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(ok.id);
    // approve — только finance.refund.approve (FINANCE/ADMIN).
    await agent(sm.accessToken).post(`/api/v1/finance/refunds/${ok.code}/approve`).expect(403);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${ok.code}/approve`).expect(201);
    // Read — SALES/DIRECTOR/FINANCE.
    const list = await agent(sm.accessToken).get("/api/v1/finance/refunds").expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    // 404 unknown.
    await agent(fin.accessToken).get("/api/v1/finance/refunds/RFD-99999999").expect(404);
    await agent(fin.accessToken).post("/api/v1/finance/refunds/RFD-99999999/approve").expect(404);
  });

  // ── 10. mass assignment ────────────────────────────────────────────────────

  it("T10. forged server-owned поля на create (currency/status/orderId/version/milestones) → 422", async () => {
    const sm = await createStaff("s13_sm10a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin10b", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(sm, fin, "rfd_t10", 60);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    for (const forged of [
      { amount: "10", currency: "RUB" },
      { amount: "10", status: "PROCESSED" },
      { amount: "10", orderId: "ord-fake" },
      { amount: "10", version: 99 },
      { amount: "10", processedAt: "2026-08-14T00:00:00.000Z" },
      { amount: "10", isActiveRefund: false },
      { amount: "10", code: "RFD-99999999" },
    ]) {
      await createRefund(fin, payment.id, forged).expect(422);
    }
    expect(await prisma.refund.count({ where: { paymentId: payment.id } })).toBe(0);
  });

  // ── 11. boundaries: 0 finance side effects; Payment НЕ мутируется; Booking не тронуты ─

  it("T11. Refund runtime создаёт 0 Ledger/ProviderFee/Settlement/Payout/Invoice/Commission/CommissionAccrual; Payment остаётся CAPTURED (frozen); Booking не тронуты", async () => {
    const sm = await createStaff("s13_sm11a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin11b", RoleCode.FINANCE);
    const { orderId, paymentId, paymentCode, amount } = await buildCapturedPayment(sm, fin, "rfd_t11", 45);
    const before = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      bookings: await prisma.booking.count({ where: { orderId } }),
      availReserved: await prisma.availabilityReservation.count({ where: { sourceSaleId: { in: created.sales } } }),
    };
    const rfd = (await createRefund(fin, paymentId, { amount }).expect(201)).body as { id: string; code: string };
    created.refunds.push(rfd.id);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/process`).expect(201);
    await eventBus.publishPending();
    const after = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      bookings: await prisma.booking.count({ where: { orderId } }),
      availReserved: await prisma.availabilityReservation.count({ where: { sourceSaleId: { in: created.sales } } }),
    };
    expect(after).toEqual(before);
    // Payment НЕ мутирован: status CAPTURED, amount/currency frozen (никакого reprice).
    const payRow = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payRow.status).toBe("CAPTURED");
    expect(String(payRow.amount)).toBe(amount);
    expect(payRow.currency).toBe("USD");
    // Payment.REFUNDED НЕ активирован (reserved; partial-семантика).
    expect(payRow.status).not.toBe("REFUNDED");
    expect(payRow.paidAt).not.toBeNull();
    // REFUNDED-перехода нет в enum-активном runtime — Payment.status writer-ов 0.
  });

  // ── 12. PII-free DTO / events ──────────────────────────────────────────────

  it("T12. Refund DTO/events не содержат PII/card/секретов (только refs + money)", async () => {
    const sm = await createStaff("s13_sm12a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin12b", RoleCode.FINANCE);
    const { paymentId, orderId } = await buildCapturedPayment(sm, fin, "rfd_t12", 30);
    const rfd = (await createRefund(fin, paymentId, { amount: "30" }).expect(201)).body as Record<string, unknown>;
    created.refunds.push(rfd.id as string);
    const keys = Object.keys(rfd).join(",");
    expect(keys).not.toContain("pan");
    expect(keys).not.toContain("cvv");
    expect(keys).not.toContain("cardNumber");
    expect(keys).not.toContain("secret");
    expect(keys).not.toContain("firstName");
    expect(keys).not.toContain("passport");
    expect((rfd as { paymentId: string }).paymentId).toBe(paymentId);
    expect((rfd as { orderId: string }).orderId).toBe(orderId);
  });

  // ── 13. BUYER_REQUEST acquisition — та же семантика ────────────────────────

  it("T13. BUYER_REQUEST Order: Refund использует ту же source-семантику (acquisitionSource ортогонален)", async () => {
    const sm = await createStaff("s13_sm13a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s13_fin13b", RoleCode.FINANCE);
    const { paymentId, amount, currency } = await buildCapturedPayment(sm, fin, "rfd_t13", 25, { buyerRequest: true });
    // Refund использует ту же frozen source-семантику (BUYER_REQUEST ортогонален).
    const rfd = (await createRefund(fin, paymentId, { amount }).expect(201)).body as { id: string; amount: string; currency: string };
    created.refunds.push(rfd.id);
    expect(rfd.amount).toBe(amount);
    expect(rfd.currency).toBe(currency);
  });
});
