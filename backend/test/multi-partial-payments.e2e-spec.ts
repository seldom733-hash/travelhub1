/**
 * E2E MULTI/PARTIAL PAYMENTS (TRAVELHUB_MULTI_PARTIAL §16 Backend + E2E).
 *
 * Проверяет новую модель «неограниченное число платежей на Order»:
 *  1. цепочка Order 1300 → 300/500/400/100 → PARTIALLY_PAID → PAID (due 1000/500/100/0);
 *  2. unlimited count (много Payment-записей на одном Order);
 *  3. zero / negative / amount > due → 422 (transaction-safe due-guard);
 *  4. FAILED / CANCELLED / PENDING не увеличивают paidAmount; CAPTURED увеличивает;
 *  5. статусы UNPAID / PARTIALLY_PAID / PAID / REFUNDED (4-значная шкала);
 *  6. remaining balance (dueAmount) после каждого шага (Order detail API);
 *  7. concurrent overpayment protection (адvisory lock, ровно один ≤ due проходит);
 *  8. idempotent retry (same Idempotency-Key replay, один факт) + разные ключи =
 *     отдельные записи;
 *  9. refund interaction (refundedAmount растёт, Payment остаётся CAPTURED,
 *     paidAmount не переписывается, финальный REFUNDED);
 *  10. history/audit (OrderHistory from→to, PaymentHistory created/captured,
 *      AuditLog finance.payment.created/captured).
 *
 * Money authority: backend (0 < amount <= due под pg_advisory_xact_lock);
 * RBAC: finance.payment.create / finance.payment.manage сохранены.
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
import { RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("MULTI/PARTIAL PAYMENTS (e2e, §16)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: {
    users: string[];
    partners: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
    payments: string[];
    refunds: string[];
  } = { users: [], partners: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], payments: [], refunds: [] };

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

  /** Полная canonical цепочка до Order (frozen money snapshot, как payment-flow).
   *  Step 3.6B: commercial Product требует Partner-владельца (harness-only partner). */
  const buildOrder = async (sm: Session, tag: string, price: number): Promise<{ orderId: string; orderCode: string; amount: string; currency: string }> => {
    const smAgent = agent(sm.accessToken);
    const partner = await prisma.partner.create({ data: { code: `MP${stamp}${payKeySeq++}`, name: `MP Partner ${tag}` } });
    created.partners.push(partner.id);
    const prod = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `MP ${tag} ${stamp}`, partnerId: partner.id, tariffs: [{ name: "Std", price }] }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.id } });
    const date = futureDate();
    await adminAgent.post(`/api/v1/products/${prod.id}/availability`).send({ tariffId: tariff.id, date: `${date}T00:00:00.000Z`, slotsTotal: 10 }).expect(201);

    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: prod.id, tariffId: tariff.id, quantity: 1 }).expect(201);
    await smAgent.put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: futureIso() }).expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    const intent = (await smAgent.post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200);
    const sale = (await smAgent.post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as { id: string; code: string };
    created.sales.push(sale.id);
    await smAgent.post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    await eventBus.publishPending();
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    return { orderId: order.id, orderCode: order.code, amount: order.amount.toString(), currency: order.currency };
  };

  // payment.create — защищённая операция; Idempotency-Key обязателен.
  let payKeySeq = 0;
  const nextPayKey = () => `e2e-mp-${Date.now()}-${++payKeySeq}`;
  const createPayment = (fin: Session, orderId: string, body: Record<string, unknown> = {}, key?: string) => {
    const a = agent(fin.accessToken);
    // reason ОБЯЗАТЕЛЕН (Step 3.6C.1, DTO 400) — default, тесты переопределяют.
    return a.post("/api/v1/finance/payments").set("Idempotency-Key", key ?? nextPayKey()).send({ orderId, reason: "e2e manual payment", ...body });
  };
  const confirmPayment = async (fin: Session, code: string) => {
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${code}/confirm`).expect(201);
    await eventBus.publishPending();
  };
  /** Order detail: backend-authoritative financial view (D7 micro-closure). */
  const orderView = async (viewer: Session, orderId: string) =>
    (await agent(viewer.accessToken).get(`/api/v1/orders/${orderId}`).expect(200)).body as {
      paymentStatus: string;
      paidAmount: string | number;
      dueAmount: string | number;
      refundedAmount: string | number;
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
      const rEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.refunds } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: rEventIds } } });
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
      await prisma.outboxEvent.deleteMany({ where: { eventType: "PaymentCaptured", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
      await prisma.outboxEvent.deleteMany({ where: { eventType: "RefundProcessed", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
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
    if (created.partners.length > 0) await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1-5, 12-16. canonical chain: 1300 → 300/500/400/100 ────────────────────

  it("цепочка §16: Order 1300 → 300/500/400/100 → PARTIALLY_PAID (due 1000/500/100) → PAID (due 0); PENDING не влияет", async () => {
    const sm = await createStaff("mp_sm1", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin1", RoleCode.FINANCE);
    const { orderId, amount: total } = await buildOrder(sm, "mp_chain", 1300);
    expect(total).toBe("1300");

    // Payment 300 (check 1).
    const p1 = (await createPayment(fin, orderId, { amount: "300", paymentMethod: "cash", reason: "partial 1" }).expect(201)).body as { id: string; code: string; amount: string };
    created.payments.push(p1.id);
    expect(p1.amount).toBe("300");
    // PENDING не увеличивает paid (check 12) — заказ всё ещё UNPAID.
    let view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("UNPAID");
    expect(String(view.paidAmount)).toBe("0");
    expect(String(view.dueAmount)).toBe("1300");

    await confirmPayment(fin, p1.code);
    // → PARTIALLY_PAID / due 1000 (checks 14, 16).
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PARTIALLY_PAID");
    expect(String(view.paidAmount)).toBe("300");
    expect(String(view.dueAmount)).toBe("1000");

    // Phase 5 ledger: PaymentCaptured → PAYMENT_CAPTURED append-only fact
    // (LedgerPostingConsumer). Факт движения: сумма/валюта = фактическая оплата.
    const payRec = await prisma.payment.findUniqueOrThrow({ where: { id: p1.id } });
    const captureLedger = await prisma.ledgerTransaction.findFirst({
      where: { sourceType: "PAYMENT", sourceId: p1.id, type: "PAYMENT_CAPTURED" },
    });
    expect(captureLedger).not.toBeNull();
    expect(captureLedger!.amount.toString()).toBe(payRec.amount.toString());
    expect(captureLedger!.currency).toBe(payRec.currency);
    expect(captureLedger!.sourceEventId).not.toBeNull();

    // Payment 500 (check 2).
    const p2 = (await createPayment(fin, orderId, { amount: "500", reason: "partial 2" }).expect(201)).body as { id: string; code: string; amount: string };
    created.payments.push(p2.id);
    expect(p2.amount).toBe("500");
    await confirmPayment(fin, p2.code);
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PARTIALLY_PAID");
    expect(String(view.paidAmount)).toBe("800");
    expect(String(view.dueAmount)).toBe("500");

    // Payment 400 (check 3).
    const p3 = (await createPayment(fin, orderId, { amount: "400", reason: "partial 3" }).expect(201)).body as { id: string; code: string; amount: string };
    created.payments.push(p3.id);
    expect(p3.amount).toBe("400");
    await confirmPayment(fin, p3.code);
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PARTIALLY_PAID");
    expect(String(view.paidAmount)).toBe("1200");
    expect(String(view.dueAmount)).toBe("100");

    // Payment 100 (check 4) → final PAID / due 0 (check 5, 15).
    const p4 = (await createPayment(fin, orderId, { amount: "100", reason: "final" }).expect(201)).body as { id: string; code: string; amount: string };
    created.payments.push(p4.id);
    expect(p4.amount).toBe("100");
    await confirmPayment(fin, p4.code);
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PAID");
    expect(String(view.paidAmount)).toBe("1300");
    expect(String(view.dueAmount)).toBe("0");

    // Оплачено полностью → следующий create → 422 (due-guard).
    await createPayment(fin, orderId, { amount: "1" }).expect(422);
    await createPayment(fin, orderId).expect(422);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(4);
  });

  // ── 6. unlimited count ─────────────────────────────────────────────────────

  it("unlimited count: 6 платежей по 100 на одном Order — все записи сохраняются, финально PAID", async () => {
    const sm = await createStaff("mp_sm2", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin2", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_multi", 600);

    const codes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = (await createPayment(fin, orderId, { amount: "100", reason: `tranche ${i + 1}` }).expect(201)).body as { id: string; code: string };
      created.payments.push(p.id);
      codes.push(p.code);
    }
    expect(await prisma.payment.count({ where: { orderId } })).toBe(6);
    const viewMid = await orderView(sm, orderId);
    expect(viewMid.paymentStatus).toBe("UNPAID"); // все ещё PENDING
    expect(String(viewMid.paidAmount)).toBe("0");

    for (const code of codes) await confirmPayment(fin, code);
    const view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PAID");
    expect(String(view.paidAmount)).toBe("600");
    expect(String(view.dueAmount)).toBe("0");
    expect(await prisma.payment.count({ where: { orderId } })).toBe(6);
  });

  // ── 7-9. zero / negative / amount > due ────────────────────────────────────

  it("zero / negative / >2 знака / amount > due → 422; due-guard арифметика после частичной оплаты", async () => {
    const sm = await createStaff("mp_sm3", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin3", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_guard", 300);

    for (const amount of ["0", "-10", "10.123", "301"]) {
      await createPayment(fin, orderId, { amount, reason: "guard" }).expect(422);
    }
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);

    // Частичная оплата 200 → due 100.
    const p = (await createPayment(fin, orderId, { amount: "200", reason: "first" }).expect(201)).body as { id: string; code: string };
    created.payments.push(p.id);
    await confirmPayment(fin, p.code);
    const view = await orderView(sm, orderId);
    expect(String(view.dueAmount)).toBe("100");

    // amount > due (101 > 100) → 422; ровно due → 201.
    await createPayment(fin, orderId, { amount: "101", reason: "over" }).expect(422);
    const p2 = (await createPayment(fin, orderId, { amount: "100", reason: "rest" }).expect(201)).body as { id: string; code: string };
    created.payments.push(p2.id);
    await confirmPayment(fin, p2.code);
    const final = await orderView(sm, orderId);
    expect(final.paymentStatus).toBe("PAID");
    expect(String(final.paidAmount)).toBe("300");
  });

  // ── 10-13. FAILED / CANCELLED / PENDING не увеличивают paid; CAPTURED увеличивает ──

  it("FAILED / CANCELLED / PENDING не увеличивают paidAmount; CAPTURED увеличивает (и освобождает due)", async () => {
    const sm = await createStaff("mp_sm4", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin4", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_status", 500);

    // PENDING → paid не растёт (check 12).
    const a = (await createPayment(fin, orderId, { amount: "200", reason: "pending" }).expect(201)).body as { id: string; code: string };
    created.payments.push(a.id);
    expect(String((await orderView(sm, orderId)).paidAmount)).toBe("0");

    // FAILED → paid не растёт (check 10); due возвращается.
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${a.code}/fail`).expect(201);
    await eventBus.publishPending();
    let view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("UNPAID");
    expect(String(view.paidAmount)).toBe("0");
    expect(String(view.dueAmount)).toBe("500");

    // CANCELLED → paid не растёт (check 11).
    const b = (await createPayment(fin, orderId, { amount: "150", reason: "cancel" }).expect(201)).body as { id: string; code: string };
    created.payments.push(b.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${b.code}/cancel`).expect(201);
    await eventBus.publishPending();
    view = await orderView(sm, orderId);
    expect(String(view.paidAmount)).toBe("0");
    expect(String(view.dueAmount)).toBe("500");

    // CAPTURED увеличивает paid (check 13) → PARTIALLY_PAID.
    const c = (await createPayment(fin, orderId, { amount: "200", reason: "capture" }).expect(201)).body as { id: string; code: string };
    created.payments.push(c.id);
    await confirmPayment(fin, c.code);
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PARTIALLY_PAID");
    expect(String(view.paidAmount)).toBe("200");
    expect(String(view.dueAmount)).toBe("300");

    // Второй CAPTURED → paid 350 (накопление двух captured + failed/cancelled не участвуют).
    const d = (await createPayment(fin, orderId, { amount: "150", reason: "capture 2" }).expect(201)).body as { id: string; code: string };
    created.payments.push(d.id);
    await confirmPayment(fin, d.code);
    view = await orderView(sm, orderId);
    expect(view.paymentStatus).toBe("PARTIALLY_PAID");
    expect(String(view.paidAmount)).toBe("350");
    expect(String(view.dueAmount)).toBe("150");
    // Итог: 4 записи (FAILED, CANCELLED, 2×CAPTURED).
    expect(await prisma.payment.count({ where: { orderId } })).toBe(4);
  });

  // ── 17. concurrent overpayment protection ──────────────────────────────────

  it("concurrent overpayment protection: два параллельных create 300+300 на due=500 → ровно один 201, второй 422", async () => {
    const sm = await createStaff("mp_sm5", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin5", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_race", 500);
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", nextPayKey()).send({ orderId, amount: "300", reason: "race 1" }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", nextPayKey()).send({ orderId, amount: "300", reason: "race 2" }),
    ]);
    const statuses = [r1.status, r2.status];
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 422)).toHaveLength(1);
    const rows = await prisma.payment.findMany({ where: { orderId }, select: { amount: true, status: true } });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].amount)).toBe("300");
    expect(rows[0].status).toBe("PENDING");
    created.payments.push(((r1.status === 201 ? r1.body : r2.body) as { id: string }).id);
  });

  // ── 18. idempotent retry + разные легальные платежи ────────────────────────

  it("idempotent retry: same Idempotency-Key → один факт; другой ключ → отдельная запись", async () => {
    const sm = await createStaff("mp_sm6", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin6", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_idem", 200);
    const key = nextPayKey();
    const first = (await createPayment(fin, orderId, { amount: "50", reason: "idem" }, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    const replay = (await createPayment(fin, orderId, { amount: "50", reason: "idem" }, key).expect(201)).body as { id: string };
    expect(replay.id).toBe(first.id);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);

    // Разные легальные платежи → отдельные Payment records (§13).
    const second = (await createPayment(fin, orderId, { amount: "50", reason: "second" }).expect(201)).body as { id: string };
    created.payments.push(second.id);
    expect(second.id).not.toBe(first.id);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(2);
  });

  // ── 19. refund interaction ─────────────────────────────────────────────────

  it("refund interaction: refundedAmount растёт, Payment остаётся CAPTURED, paidAmount не переписывается; полный возврат → REFUNDED", async () => {
    const sm = await createStaff("mp_sm7", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin7", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_refund", 1000);
    const pa = (await createPayment(fin, orderId, { amount: "600", reason: "pay A" }).expect(201)).body as { id: string; code: string };
    created.payments.push(pa.id);
    await confirmPayment(fin, pa.code);
    const pb = (await createPayment(fin, orderId, { amount: "400", reason: "pay B" }).expect(201)).body as { id: string; code: string };
    created.payments.push(pb.id);
    await confirmPayment(fin, pb.code);
    expect((await orderView(sm, orderId)).paymentStatus).toBe("PAID");

    const doRefund = async (paymentId: string, amount: string, tag: string) => {
      const r = (await agent(fin.accessToken).post("/api/v1/finance/refunds").send({ paymentId, amount, reason: `refund ${tag}` }).expect(201)).body as { id: string; code: string };
      created.refunds.push(r.id);
      await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r.code}/approve`).expect(201);
      await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r.code}/process`).expect(201);
      await eventBus.publishPending();
      return r;
    };

    // Частичный возврат 200 → refundedAmount=200; paid не тронут; статус PAID
    // (paid == total, refunded < paid).
    await doRefund(pa.id, "200", "partial");
    let view = await orderView(sm, orderId);
    expect(String(view.refundedAmount)).toBe("200");
    expect(String(view.paidAmount)).toBe("1000");
    expect(String(view.dueAmount)).toBe("0"); // refund НЕ увеличивает due
    expect(view.paymentStatus).toBe("PAID");
    const payA = await prisma.payment.findUniqueOrThrow({ where: { id: pa.id } });
    expect(payA.status).toBe("CAPTURED"); // Payment НЕ мутируется

    // Добиваем до полного возврата: A ещё refundable 400, B — 400.
    await doRefund(pa.id, "400", "A rest");
    await doRefund(pb.id, "400", "B rest");
    view = await orderView(sm, orderId);
    expect(String(view.refundedAmount)).toBe("1000");
    expect(String(view.paidAmount)).toBe("1000"); // исторический факт
    expect(view.paymentStatus).toBe("REFUNDED"); // refunded >= paid
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pb.id } })).status).toBe("CAPTURED");
  });

  // ── 20. history / audit ────────────────────────────────────────────────────

  it("history/audit: OrderHistory from→to по цепочке, PaymentHistory created/captured, AuditLog payment.created/captured", async () => {
    const sm = await createStaff("mp_sm8", RoleCode.SALES_MANAGER);
    const fin = await createStaff("mp_fin8", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "mp_history", 400);
    const payIds: string[] = [];
    for (const amount of ["100", "300"]) {
      const p = (await createPayment(fin, orderId, { amount, reason: "history" }).expect(201)).body as { id: string; code: string };
      created.payments.push(p.id);
      payIds.push(p.id);
      await confirmPayment(fin, p.code);
    }

    // OrderHistory: UNPAID→PARTIALLY_PAID, PARTIALLY_PAID→PAID.
    const oh = await prisma.orderHistory.findMany({
      where: { orderId, action: "payment_captured" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(oh.length).toBe(2);
    expect(oh[0].from).toBe("UNPAID");
    expect(oh[0].to).toBe("PARTIALLY_PAID");
    expect(oh[1].from).toBe("PARTIALLY_PAID");
    expect(oh[1].to).toBe("PAID");

    // PaymentHistory: created (кто принял) + captured на каждый Payment.
    const ph = await prisma.paymentHistory.findMany({ where: { paymentId: { in: payIds } } });
    expect(ph.filter((h) => h.action === "created")).toHaveLength(2);
    expect(ph.filter((h) => h.action === "captured")).toHaveLength(2);
    for (const h of ph.filter((h) => h.action === "created")) {
      expect(h.actorName).toBeTruthy();
      expect(h.actorId).toBeTruthy();
    }

    // AuditLog: finance.payment.created / finance.payment.captured.
    const auditCreated = await prisma.auditLog.count({ where: { action: "finance.payment.created", resourceId: { in: payIds } } });
    const auditCaptured = await prisma.auditLog.count({ where: { action: "finance.payment.captured", resourceId: { in: payIds } } });
    expect(auditCreated).toBe(2);
    expect(auditCaptured).toBe(2);
  });
});
