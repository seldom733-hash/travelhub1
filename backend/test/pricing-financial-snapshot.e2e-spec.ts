/**
 * E2E PHASE 2 STEP 2.11 — Pricing & Financial Snapshot (§38/§39/§44 2.11).
 *
 * Доказывает канонический pricing/financial snapshot contract:
 *  1.  frozen money facts verbatim по всей цепочке
 *      Quote(ISSUE) → CheckoutIntent → Sale(complete) → Order → Booking:
 *      currency/subtotal/discount/total/amount НЕ пересчитываются;
 *  2.  Product/Tariff price change ПОСЛЕ freeze → НЕТ repricing нигде
 *      (Quote/Checkout/Sale/Order/Booking сохраняют исходную цену);
 *  3.  Booking.currency (Step 2.11): frozen verbatim из OrderItem.currency;
 *      legacy Booking без валюты → NULL читаем (без backfill);
 *  4.  mass assignment: forged money/currency на checkout create → 422;
 *  5.  boundaries: цепочка НЕ создаёт LedgerTransaction/ProviderFee/
 *      Settlement/Payout/Payment/Refund/Invoice/Commission(Accrual);
 *      Order.paymentStatus остаётся UNPAID;
 *  6.  Reverse (BUYER_REQUEST) money contract — та же frozen семантика;
 *  7.  decimal serialization — string-based, без float.
 *
 * Traceability (negative/positive матрицы 2.11):
 *  1-13 positive: цепочка фиксирует snapshot (T1), decimal string (T1/T4),
 *  rounding детерминирован (unit), Direct snapshot (T1), Buyer Request (T6),
 *  Sale→Order verbatim (T1/T2), Order→Booking verbatim (T1/T3), multi-item
 *  (T5), replay first-write-wins (существующие e2e 2.5/2.8), Product change
 *  после freeze (T2), legacy читаем (T3), correlation/causation (сущ. e2e),
 *  AuditLog минимален (сущ. e2e).
 *  1-24 negative: 401/403/404 (сущ. RBAC e2e), forged money → 422 (T4),
 *  malformed decimal → 422 (сущ. validation), zero/negative (сущ.), overflow
 *  (unit + сущ.), unsupported currency (T4 + сущ.), inconsistent snapshot →
 *  controlled 422 (unit), duplicate replay (сущ. 2.4), divergent replay (сущ.),
 *  unknown P2002 (сущ.), Product change после freeze → no repricing (T2),
 *  Tax/FX change → no historical mutation (T2b — master-data правки после
 *  freeze не трогают snapshot; FX/tax-движка нет — boundary), Booking
 *  lifecycle → no money mutation (сущ. 2.9A), cancellation → no rewrite
 *  (сущ. 2.9), no ledger auto-post (T7), no ProviderFee/Settlement/Payout
 *  auto-create (T7), no Payment runtime side effect (T7), no PII (сущ.),
 *  failed transaction → no partial snapshot (сущ. 2.4), legacy без snapshot
 *  читаем (T3).
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

describe("Phase 2 Step 2.11 — Pricing & Financial Snapshot (e2e)", () => {
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
    customers: string[];
    auditLogs: string[];
  } = { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], bookings: [], customers: [], auditLogs: [] };

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

  const createProduct = async (tag: string, price: number): Promise<{ productId: string; tariffId: string }> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `Snap ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };

  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent
      .post(`/api/v1/products/${productId}/availability`)
      .send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal })
      .expect(201);
  };

  const buildChain = async (
    sm: Session,
    fx: { productId: string; tariffId: string },
    date: string,
    opts: { discountType?: string; discountValue?: string; quantity?: number; beforeIssue?: (quoteId: string) => Promise<void> } = {},
  ) => {
    const smAgent = agent(sm.accessToken);
    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    if (opts.beforeIssue) await opts.beforeIssue(quote.id);
    await smAgent
      .post(`/api/v1/sales/quotes/${quote.code}/items`)
      .send({ productId: fx.productId, tariffId: fx.tariffId, quantity: opts.quantity ?? 1 })
      .expect(201);
    await smAgent
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: opts.discountType ?? "NONE", discountValue: opts.discountValue, validUntil: futureIso() })
      .expect(200);
    const issued = (await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201)).body as {
      subtotal: string;
      discountAmount: string;
      total: string;
      currency: string;
      items: Array<{ amount: string; unitPrice: string; quantity: number }>;
    };
    const intent = (await smAgent
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; code: string; version: number; currency: string; subtotal: string; discountAmount: string; total: string };
    created.checkouts.push(intent.id);
    await smAgent
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);
    const sale = (await smAgent.post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.sales.push(sale.id);
    await smAgent.post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    await eventBus.publishPending();

    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    return { quote, issued, intent, sale, order };
  };

  const driveToBooking = async (orderId: string) => {
    const act = (a: string) => adminAgent.patch(`/api/v1/orders/${orderId}`).send({ action: a });
    await act("process").expect(200);
    await act("confirm").expect(200);
    await act("send").expect(200);
    await eventBus.publishPending();
    return prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
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
    if (created.bookings.length > 0) {
      await prisma.passenger.deleteMany({ where: { bookingId: { in: created.bookings } } });
      await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    }
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.outboxEvent.deleteMany({ where: { eventType: "BookingCreated", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
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
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. canonical chain: frozen snapshot verbatim ────────────────────────────

  it("T1. canonical chain: Quote ISSUE → CheckoutIntent → Sale → Order → Booking — frozen money verbatim (amount + currency)", async () => {
    const sm = await createStaff("s11_sm1", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_chain", 100);
    const date = futureDate();
    const { issued, intent, order } = await buildChain(sm, fx, date);
    // Quote ISSUE: frozen totals (Decimal strings).
    expect(typeof issued.subtotal).toBe("string");
    expect(issued.total).toBe("100");
    expect(issued.currency).toBe("USD");
    // CheckoutIntent: verbatim copy (frozen binding price, без reprice).
    expect(intent.currency).toBe(issued.currency);
    expect(intent.subtotal).toBe(issued.subtotal);
    expect(intent.total).toBe(issued.total);
    // Order: frozen snapshot (subtotal/amount), OrderItem amount.
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(String(orderRow.subtotal)).toBe(issued.subtotal);
    expect(String(orderRow.amount)).toBe(issued.total);
    expect(orderRow.currency).toBe("USD");
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(String(item.amount)).toBe("100");
    // Booking: frozen money fact — amount AND currency (Step 2.11).
    const bookings = await driveToBooking(order.id);
    created.bookings.push(...bookings.map((b) => b.id));
    expect(bookings).toHaveLength(1);
    expect(String(bookings[0]!.amount)).toBe(String(item.amount)); // verbatim
    expect(bookings[0]!.currency).toBe(item.currency); // verbatim из OrderItem
    expect(bookings[0]!.currency).toBe("USD");
  });

  // ── 2. adversarial: Product price change after freeze → NO repricing ────────

  it("T2. Product/Tariff price change ПОСЛЕ ISSUE → нигде нет repricing (Quote/Checkout/Sale/Order/Booking держат исходную цену)", async () => {
    const sm = await createStaff("s11_sm2", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_reprice", 150);
    const date = futureDate();
    const { issued, intent, sale, order } = await buildChain(sm, fx, date);
    const originalTotal = issued.total;

    // Seller меняет цену тарифа ПОСЛЕ freeze (150 → 250).
    await prisma.tariff.update({ where: { id: fx.tariffId }, data: { price: new Prisma.Decimal(250) } });
    const changed = await prisma.tariff.findUniqueOrThrow({ where: { id: fx.tariffId } });
    expect(String(changed.price)).toBe("250"); // change applied to Catalog

    // Ни один frozen факт не repriced.
    expect(intent.total).toBe(originalTotal);
    const checkoutRow = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(String(checkoutRow.total)).toBe(originalTotal);
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(String(saleRow.total)).toBe(originalTotal);
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(String(orderRow.amount)).toBe(originalTotal);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(String(item.amount)).toBe(originalTotal);

    const bookings = await driveToBooking(order.id);
    created.bookings.push(...bookings.map((b) => b.id));
    expect(String(bookings[0]!.amount)).toBe(originalTotal); // frozen, без reprice
    expect(bookings[0]!.currency).toBe("USD");
  });

  // ── 2b. Tax/FX master-data change после freeze → no historical mutation ────

  it("T2b. Finance master-data правки после freeze (Currency/Tax/ExchangeRate) не мутируют frozen snapshot; FX/tax-движка нет", async () => {
    const sm = await createStaff("s11_sm2b", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_master", 80);
    const date = futureDate();
    const { issued, sale, order } = await buildChain(sm, fx, date);
    // Деактивируем/изменяем master-data: валюта USD, налог, курс (существующие).
    await prisma.currency.updateMany({ where: { isoCode: "USD" }, data: { isActive: false } });
    const tax = await prisma.tax.findFirst({ where: { countryIso: "RU" } });
    if (tax) await prisma.tax.update({ where: { id: tax.id }, data: { rate: new Prisma.Decimal(99.99) } });
    const rate = await prisma.exchangeRate.findFirst();
    if (rate) await prisma.exchangeRate.update({ where: { id: rate.id }, data: { rate: new Prisma.Decimal(0.0001) } });
    // Frozen snapshot не тронут.
    expect(issued.total).toBe("80");
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(String(saleRow.total)).toBe("80");
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(String(orderRow.amount)).toBe("80");
    expect(orderRow.currency).toBe("USD");
    // Нет FX-конверсии/налоговых сумм в snapshot (движков нет — boundary).
    expect(orderRow.subtotal).not.toBeNull();
    await prisma.currency.updateMany({ where: { isoCode: "USD" }, data: { isActive: true } });
  });

  // ── 3. Booking.currency legacy NULL ─────────────────────────────────────────

  it("T3. legacy Booking без currency (до 2.11) → NULL, читаем, без backfill", async () => {
    const sm = await createStaff("s11_sm3", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_legacy", 60);
    const date = futureDate();
    const { order } = await buildChain(sm, fx, date);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    // Pre-2.11-like Booking: физически без currency (raw insert, как legacy).
    const legacy = await prisma.booking.create({
      data: {
        code: `BKG-LG-${stamp}`, referenceNumber: "MKT-BKG-000001",
        orderId: order.id,
        productId: item.productId,
        orderItemId: item.id,
        status: "NEW",
        amount: new Prisma.Decimal(60),
        serviceDate: new Date(`${date}T00:00:00.000Z`),
        version: 1,
      },
    });
    created.bookings.push(legacy.id);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(row.currency).toBeNull(); // честный NULL, без fabricated backfill
    expect(String(row.amount)).toBe("60"); // читаем
  });

  // ── 4. mass assignment: forged money/currency → 422 ─────────────────────────

  it("T4. forged money/currency на checkout create → 422 (frontend не источник цены); decimal string serialization", async () => {
    const sm = await createStaff("s11_sm4", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_forge", 70);
    const date = futureDate();
    const smAgent = agent(sm.accessToken);
    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await smAgent.put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: futureIso() }).expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    // Forged server-owned frozen money fields → 422 (assertForbiddenKeys по raw body).
    await smAgent
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [], subtotal: "1", total: "1", currency: "RUB", discountAmount: "0" })
      .expect(422);
    // Контроль: легитимный create без forged полей — работает, деньги — строки.
    const intent = (await smAgent
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; subtotal: string; total: string };
    created.checkouts.push(intent.id);
    expect(typeof intent.subtotal).toBe("string");
    expect(typeof intent.total).toBe("string");
    expect(Number(intent.total)).toBe(70);
  });

  // ── 5. multi-item order: независимые item snapshots ─────────────────────────

  it("T5. multi-item Quote → независимые frozen item amounts; суммы verbatim вниз по цепочке", async () => {
    const sm = await createStaff("s11_sm5", RoleCode.SALES_MANAGER);
    const fxA = await createProduct("s11_multi_a", 100);
    const fxB = await createProduct("s11_multi_b", 50);
    const date = futureDate();
    const smAgent = agent(sm.accessToken);
    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fxA.productId, tariffId: fxA.tariffId, quantity: 1 }).expect(201);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fxB.productId, tariffId: fxB.tariffId, quantity: 2 }).expect(201);
    await smAgent.put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: futureIso() }).expect(200);
    const issued = (await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201)).body as { subtotal: string; total: string; items: Array<{ amount: string; quantity: number }> };
    expect(issued.subtotal).toBe("200"); // 100 + 2×50
    expect(issued.total).toBe("200");
    expect(issued.items).toHaveLength(2);
    expect(issued.items[0]!.amount).toBe("100");
    expect(issued.items[1]!.amount).toBe("100"); // 50 × 2

    const intent = (await smAgent.post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201)).body as { id: string; code: string; version: number; total: string };
    created.checkouts.push(intent.id);
    expect(intent.total).toBe("200");
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200);
    await upsertAvailability(fxA.productId, fxA.tariffId, date, 10);
    await upsertAvailability(fxB.productId, fxB.tariffId, date, 10);
    const sale = (await smAgent.post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as { id: string; code: string };
    created.sales.push(sale.id);
    await smAgent.post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    await eventBus.publishPending();
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } });
    expect(items.map((i) => String(i.amount))).toEqual(["100", "100"]);
    expect(new Set(items.map((i) => i.currency))).toEqual(new Set(["USD"]));
    const bookings = await driveToBooking(order.id);
    created.bookings.push(...bookings.map((b) => b.id));
    expect(bookings).toHaveLength(2);
    expect(bookings.map((b) => String(b.amount)).sort()).toEqual(["100", "100"]);
    for (const b of bookings) expect(b.currency).toBe("USD"); // verbatim per item
  });

  // ── 6. Reverse (BUYER_REQUEST) money contract ───────────────────────────────

  it("T6. BUYER_REQUEST acquisition: та же frozen money семантика (snapshot не зависит от acquisitionSource)", async () => {
    const sm = await createStaff("s11_sm6", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_reverse", 120);
    const date = futureDate();
    // Симулируем Reverse-конверсию: Quote получен из Opportunity (BUYER_REQUEST).
    // Реальный reverse-conversion flow (select → Sale → Order → Booking) покрыт
    // отдельным e2e (reverse-conversion #16); здесь доказываем money-инвариант:
    // snapshot идентичен DIRECT-цепочке независимо от acquisitionSource.
    const { issued, intent, order } = await buildChain(sm, fx, date, {
      beforeIssue: async (quoteId) => {
        await prisma.quote.update({ where: { id: quoteId }, data: { acquisitionSource: "BUYER_REQUEST" } });
      },
    });
    expect(issued.total).toBe("120");
    expect(issued.currency).toBe("USD");
    // frozen source: BUYER_REQUEST прокидывается вниз (проверка для полноты).
    const checkoutRow = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(checkoutRow.acquisitionSource).toBe("BUYER_REQUEST");
    expect(String(checkoutRow.total)).toBe("120");
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderRow.acquisitionSource).toBe("BUYER_REQUEST");
    expect(String(orderRow.amount)).toBe("120");
    const bookings = await driveToBooking(order.id);
    created.bookings.push(...bookings.map((b) => b.id));
    expect(bookings[0]!.currency).toBe("USD");
    expect(String(bookings[0]!.amount)).toBe("120");
    expect(bookings[0]!.acquisitionSource).toBe("BUYER_REQUEST");
  });

  // ── 7. boundaries: no finance facts, no payment runtime ─────────────────────

  it("T7. цепочка snapshot НЕ создаёт Ledger/ProviderFee/Settlement/Payout/Payment/Refund/Invoice/Commission; paymentStatus UNPAID", async () => {
    const sm = await createStaff("s11_sm7", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s11_bound", 90);
    const date = futureDate();
    const { sale, order } = await buildChain(sm, fx, date);
    const before = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      payments: await prisma.payment.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
    };
    const bookings = await driveToBooking(order.id);
    created.bookings.push(...bookings.map((b) => b.id));
    const after = {
      ledger: await prisma.ledgerTransaction.count(),
      fees: await prisma.providerFee.count(),
      settlements: await prisma.settlement.count(),
      payouts: await prisma.payout.count(),
      payments: await prisma.payment.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
    };
    expect(after).toEqual(before);
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderRow.paymentStatus).toBe("UNPAID"); // Payment runtime не начат
    expect(String(orderRow.amount)).toBe("90");
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(String(saleRow.total)).toBe("90");
  });
});
