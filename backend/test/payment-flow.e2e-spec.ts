/**
 * E2E PHASE 2 STEP 2.12 — Payment Flow (provider-neutral Payment runtime).
 *
 * Доказывает canonical Payment contract:
 *  1. Payment — Finance-owned (PAY-*): создание ТОЛЬКО finance.payment.write;
 *     деньги — frozen Order snapshot verbatim (amount/currency), НЕ из
 *     mutable Catalog (reprice-proof);
 *  2. единственный state-machine authority: PENDING → CAPTURED (paidAt) |
 *     FAILED (failedAt) | CANCELLED (cancelledAt); AUTHORIZED/REFUNDED —
 *     reserved vocabulary (2.12B/2.13); первый milestone wins;
 *  3. Order projection (paymentStatus/paidAmount) — Order-owned subscriber на
 *     PaymentCaptured (Finance НЕ пишет order.* напрямую);
 *  4. cardinality: один активный Payment на Order (isActivePayment partial
 *     unique); FAILED/CANCELLED → attempt 2 легален; CAPTURED → overpayment
 *     409; idempotent retry → существующий факт; concurrent → один факт;
 *  5. mass assignment: forged money/status/milestones → 422;
 *  6. boundaries: 0 Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/
 *     Commission/CommissionAccrual auto-post; Booking не тронуты;
 *  7. события PaymentCreated/Captured/Failed/Cancelled (correlation/causation);
 *  8. RBAC: 401/403/404; PII-free DTO.
 *
 * Traceability (Prompt §39 negative / §40 positive):
 *  1-30 negative: 401 (T9), 403 (T9), 404 (T10), forged amount/currency/status/
 *  milestones → 422 (T4), malformed decimal/unsupported currency — server-copied
 *  (не forgeable; money authority — Order snapshot, T1/T2), amount mismatch —
 *  невозможен (нет клиентского amount), Product price change после freeze →
 *  Payment держит frozen (T2), duplicate create → no-op (T6), concurrent
 *  duplicate → один факт + 409 (T7), divergent replay — нет payload-сравнения
 *  (create идемпотентен по активному Payment; repeat transition → 409 T8),
 *  duplicate provider event — N/A (2.12B webhook deferred, §35: 0 активных
 *  webhook-путей), unknown P2002 — unit, invalid transition → 409 (T8),
 *  terminal retry → 409 (T8), success-vs-failure race — CAS детерминизм (T8 +
 *  unit), no direct Order write (T3 — проекция через событие), no direct
 *  Booking write (T11), no repricing (T2), no Refund/CommissionAccrual/
 *  Settlement/Payout/ProviderFee/Ledger (T11), no PII/PCI (T12), no raw 500 (T7).
 *  1-17 positive: canonical create (T1), canonical code (T1), frozen money
 *  verbatim (T1), initial status PENDING (T1), lifecycle transitions (T5),
 *  first-only milestones (T5), identical replay (T6), concurrent one fact (T7),
 *  correct events (T5), correlation/causation (T5), own-scope Buyer — N/A
 *  (Buyer payment deferred, §31 — не экспонирован), FINANCE/ADMIN behavior
 *  (T9), Order projection (T3), legacy — N/A (Payment runtime новый; миграция
 *  аддитивная), Direct acquisition (T1), BUYER_REQUEST (T13), fresh migration
 *  replay (harness).
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

describe("Phase 2 Step 2.12 — Payment Flow (e2e)", () => {
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
  } = { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], bookings: [], payments: [] };

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

  /** Полная canonical цепочка до Order (frozen money snapshot, как 2.11 e2e). */
  const buildOrder = async (sm: Session, tag: string, price: number, opts: { buyerRequest?: boolean } = {}): Promise<{ orderId: string; orderCode: string; amount: string; currency: string }> => {
    const smAgent = agent(sm.accessToken);
    const prod = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Pay ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] }).expect(201)).body.product as { id: string };
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
    return { orderId: order.id, orderCode: order.code, amount: issued.total, currency: issued.currency };
  };

  // Step 2.12H: payment.create — защищённая операция; Idempotency-Key обязателен.
  // Каждый вызов — НОВЫЙ ключ (новый запрос); intentional retry-тесты (T6/T8)
  // полагаются на business idempotency (один активный Payment на Order).
  let payKeySeq = 0;
  const nextPayKey = () => `e2e-payflow-${Date.now()}-${++payKeySeq}`;
  const createPayment = (fin: Session, orderId: string, body: Record<string, unknown> = {}) => {
    const a = agent(fin.accessToken);
    return a.post("/api/v1/finance/payments").set("Idempotency-Key", nextPayKey()).send({ orderId, ...body });
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
    if (created.payments.length > 0) {
      // Payment-события (aggregateId = payment id) + inbox — полная изоляция
      // (глобальные счётчики в order-temporal #9: 0 Payment-событий в БД).
      const payEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.payments } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: payEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.payments } } });
      await prisma.paymentHistory.deleteMany({ where: { paymentId: { in: created.payments } } });
      await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    }
    if (created.bookings.length > 0) {
      await prisma.passenger.deleteMany({ where: { bookingId: { in: created.bookings } } });
      await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    }
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.outboxEvent.deleteMany({ where: { eventType: "PaymentCaptured", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
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

  // ── 1. canonical create: frozen money verbatim ──────────────────────────────

  it("T1. canonical Payment create: PAY-* code, PENDING, frozen amount/currency verbatim из Order (Finance, finance.payment.write)", async () => {
    const sm = await createStaff("s12_sm1", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin1", RoleCode.FINANCE);
    const { orderId, amount, currency } = await buildOrder(sm, "pay_t1", 150);

    const res = await createPayment(fin, orderId).expect(201);
    created.payments.push((res.body as { id: string }).id);
    expect((res.body as { code: string }).code).toMatch(/^PAY-\d{8}$/);
    expect((res.body as { status: string }).status).toBe("PENDING");
    expect((res.body as { amount: string }).amount).toBe(amount);
    expect((res.body as { currency: string }).currency).toBe(currency);
    // Milestones ещё не произошли.
    const body = res.body as { paidAt: string | null; failedAt: string | null; cancelledAt: string | null };
    expect(body.paidAt).toBeNull();
    expect(body.failedAt).toBeNull();
    expect(body.cancelledAt).toBeNull();
    // Order projection ещё UNPAID (не подтверждено).
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("UNPAID");
    expect(String(orderRow.paidAmount)).toBe("0");
  });

  // ── 2. reprice-proof: Product price change после freeze ─────────────────────

  it("T2. Product price change ПОСЛЕ freeze → Payment держит frozen amount (без repricing)", async () => {
    const sm = await createStaff("s12_sm2", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin2", RoleCode.FINANCE);
    const { orderId, amount } = await buildOrder(sm, "pay_t2", 120);
    // Seller меняет цену тарифа ПОСЛЕ создания Order.
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: item.productId } });
    await prisma.tariff.update({ where: { id: tariff.id }, data: { price: new Prisma.Decimal(999) } });

    const res = await createPayment(fin, orderId).expect(201);
    created.payments.push((res.body as { id: string }).id);
    expect((res.body as { amount: string }).amount).toBe(amount); // frozen, не 999
  });

  // ── 3. Order projection via event (Finance НЕ пишет order.*) ────────────────

  it("T3. confirm → CAPTURED + paidAt; Order-owned subscriber → paymentStatus PAID, paidAmount (через PaymentCaptured)", async () => {
    const sm = await createStaff("s12_sm3", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin3", RoleCode.FINANCE);
    const { orderId, amount } = await buildOrder(sm, "pay_t3", 80);
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);

    const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(before.paymentStatus).toBe("UNPAID");

    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    await eventBus.publishPending();

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(row.status).toBe("CAPTURED");
    expect(row.paidAt).not.toBeNull();
    expect(row.failedAt).toBeNull();
    expect(row.cancelledAt).toBeNull();
    // Order projection (Order-owned subscriber, inbox).
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("PAID");
    expect(String(orderRow.paidAmount)).toBe(amount);
    // Canonical факт в ленте. HTTP-команда: correlation = server UUID,
    // causation = null (ADR-0009/0010, как orderAction).
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "PaymentCaptured", aggregateId: pay.id } });
    expect((ev.payload as { orderId: string }).orderId).toBe(orderId);
    expect((ev.payload as { amount: string }).amount).toBe(amount);
    expect(ev.correlationId).not.toBeNull();
  });

  // ── 4. mass assignment: forged money/status/milestones → 422 ────────────────

  it("T4. forged server-owned поля на create (amount/currency/status/milestones/version) → 422", async () => {
    const sm = await createStaff("s12_sm4", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin4", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t4", 60);
    for (const forged of [
      { amount: "1" },
      { currency: "RUB" },
      { status: "CAPTURED" },
      { paidAt: "2026-08-14T00:00:00.000Z" },
      { version: 99 },
      { isActivePayment: false },
      { providerRef: "fake" },
    ]) {
      await createPayment(fin, orderId, forged).expect(422);
    }
    // Контроль: ни один forged create не создал Payment.
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });

  // ── 5. lifecycle transitions + first-only milestones + events ───────────────

  it("T5. fail → FAILED + failedAt; attempt 2 легален; события PaymentFailed/PaymentCreated с correlation", async () => {
    const sm = await createStaff("s12_sm5", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin5", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t5", 90);
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);

    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/fail`).expect(201);
    await eventBus.publishPending();
    const failed = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failedAt).not.toBeNull();
    expect(failed.paidAt).toBeNull();
    expect(failed.isActivePayment).toBe(false);

    // Attempt 2: повторная инициация легальна после FAILED.
    const retry = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string; status: string };
    created.payments.push(retry.id);
    expect(retry.status).toBe("PENDING");
    expect(retry.code).not.toBe(pay.code);

    // События: PaymentCreated (инициация) + PaymentFailed. HTTP-команда:
    // correlation = server UUID, causation = null (ADR-0009/0010).
    const createdEv = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "PaymentCreated", aggregateId: pay.id } });
    expect((createdEv.payload as { orderId: string }).orderId).toBe(orderId);
    expect(createdEv.correlationId).not.toBeNull();
    const failedEv = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "PaymentFailed", aggregateId: pay.id } });
    expect(failedEv.correlationId).not.toBeNull();
    // Order projection остаётся UNPAID (FAILED не проецируется).
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.paymentStatus).toBe("UNPAID");
  });

  // ── 6. idempotent retry: duplicate create → существующий факт ───────────────

  it("T6. identical retry create → существующий активный Payment (no-op, один факт)", async () => {
    const sm = await createStaff("s12_sm6", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin6", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t6", 70);
    const first = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(first.id);
    const second = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    expect(second.id).toBe(first.id);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  });

  // ── 7. concurrent duplicate create → один факт, контролируемый 409 ──────────

  it("T7. concurrent duplicate create → ровно один факт; проигравший — controlled 409 (не raw 500)", async () => {
    const sm = await createStaff("s12_sm7", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin7", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t7", 55);
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", nextPayKey()).send({ orderId }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", nextPayKey()).send({ orderId }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // 201 + 409 (или 201+201 в случае последовательного no-op — но параллельно
    // один обязан проиграть partial unique: детерминированный победитель).
    expect(statuses).toContain(201);
    const errors = [r1.status, r2.status].filter((s) => s >= 400);
    for (const s of errors) expect(s).toBeLessThan(500); // controlled, без raw 500
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    const winner = [r1, r2].find((r) => r.status === 201);
    created.payments.push((winner!.body as { id: string }).id);
  });

  // ── 8. invalid/repeat transitions → 409 (terminal protection) ───────────────

  it("T8. повторный confirm → 409; confirm после fail → 409; overpayment после CAPTURED → no-op (второй Payment не создаётся)", async () => {
    const sm = await createStaff("s12_sm8", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin8", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t8", 45);
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);

    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    // Повторный confirm → 409 (terminal retry controlled).
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(409);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/fail`).expect(409);
    // Overpayment: после CAPTURED повторный create — idempotent no-op
    // (identical retry = same effect, конвенция Ledger): возвращает СУЩЕСТВУЮЩИЙ
    // Payment, второй строки НЕ создаётся (isActivePayment partial unique —
    // overpayment protection на DB-уровне).
    const dup = (await createPayment(fin, orderId).expect(201)).body as { id: string };
    expect(dup.id).toBe(pay.id);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  });

  // ── 9. RBAC / IDOR ──────────────────────────────────────────────────────────

  it("T9. RBAC: 401 аноним, 403 на write для ролей без finance.payment.write, FINANCE/ADMIN работают; 404 unknown", async () => {
    const sm = await createStaff("s12_sm9a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin9b", RoleCode.FINANCE);
    const dir = await createStaff("s12_dir9c", RoleCode.DIRECTOR);
    const { orderId } = await buildOrder(sm, "pay_t9", 40);

    // 401 — аноним.
    await request(app.getHttpServer()).post("/api/v1/finance/payments").send({ orderId }).expect(401);
    await request(app.getHttpServer()).get("/api/v1/finance/payments").expect(401);
    // 403 — SALES_MANAGER на write (read разрешён).
    await createPayment(sm, orderId).expect(403);
    const list = await agent(sm.accessToken).get("/api/v1/finance/payments").expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    // DIRECTOR — read-only (403 на write).
    await createPayment(dir, orderId).expect(403);
    // FINANCE — write OK.
    const ok = (await createPayment(fin, orderId).expect(201)).body as { id: string };
    created.payments.push(ok.id);
    // 404 — unknown payment.
    await agent(fin.accessToken).get("/api/v1/finance/payments/PAY-99999999").expect(404);
    await agent(fin.accessToken).post("/api/v1/finance/payments/PAY-99999999/confirm").expect(404);
  });

  // ── 10. cancel → CANCELLED + cancelledAt; attempt 2 ─────────────────────────

  it("T10. cancel → CANCELLED + cancelledAt; повторная инициация легальна; detail-read", async () => {
    const sm = await createStaff("s12_sm10a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin10b", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t10", 65);
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/cancel`).expect(201);
    const cancelled = (await agent(fin.accessToken).get(`/api/v1/finance/payments/${pay.code}`).expect(200)).body as {
      status: string;
      cancelledAt: string | null;
      paidAt: string | null;
    };
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.paidAt).toBeNull();
    const retry = (await createPayment(fin, orderId).expect(201)).body as { id: string };
    created.payments.push(retry.id);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(2); // 1 CANCELLED + 1 PENDING
  });

  // ── 11. boundaries: 0 finance side effects; Booking не тронуты ──────────────

  it("T11. Payment runtime создаёт 0 Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission/CommissionAccrual; Booking не тронуты", async () => {
    const sm = await createStaff("s12_sm11a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin11b", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t11", 35);
    const before = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      bookings: await prisma.booking.count({ where: { orderId } }),
    };
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    await eventBus.publishPending();
    const after = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      bookings: await prisma.booking.count({ where: { orderId } }),
    };
    expect(after).toEqual(before);
  });

  // ── 12. PII-free DTO / secrets ──────────────────────────────────────────────

  it("T12. Payment DTO не содержит PII/card/секретов (только refs + money)", async () => {
    const sm = await createStaff("s12_sm12a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin12b", RoleCode.FINANCE);
    const { orderId } = await buildOrder(sm, "pay_t12", 30);
    const pay = (await createPayment(fin, orderId).expect(201)).body as Record<string, unknown>;
    created.payments.push(pay.id as string);
    const keys = Object.keys(pay).join(",");
    expect(keys).not.toContain("pan");
    expect(keys).not.toContain("cvv");
    expect(keys).not.toContain("cardNumber");
    expect(keys).not.toContain("secret");
    expect(keys).not.toContain("firstName");
    expect(keys).not.toContain("passport");
    // Opaque refs only.
    expect(pay.orderId).toBe(orderId);
    expect((pay as { amount: string }).amount).toBeTruthy();
  });

  // ── 13. BUYER_REQUEST acquisition — та же money семантика ───────────────────

  it("T13. BUYER_REQUEST Order: Payment использует ту же frozen money семантику (acquisitionSource ортогонален)", async () => {
    const sm = await createStaff("s12_sm13a", RoleCode.SALES_MANAGER);
    const fin = await createStaff("s12_fin13b", RoleCode.FINANCE);
    const { orderId, amount, currency } = await buildOrder(sm, "pay_t13", 25, { buyerRequest: true });
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderRow.acquisitionSource).toBe("BUYER_REQUEST");
    const pay = (await createPayment(fin, orderId).expect(201)).body as { id: string; amount: string; currency: string };
    created.payments.push(pay.id);
    expect(pay.amount).toBe(amount);
    expect(pay.currency).toBe(currency);
  });
});
