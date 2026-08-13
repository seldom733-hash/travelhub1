/**
 * E2E PHASE 2 STEP 2.6 — Remove Bootstrap Order Creation.
 *
 * Доказывает целевой инвариант: NORMAL ORDER CREATION = CANONICAL FLOW ONLY.
 *
 * §33 negative:
 *  1. POST /orders/bootstrap → 404 (anonymous / BUYER / PARTNER / ADMIN);
 *  5. нет alias direct-create маршрутов (/orders/create, /orders/manual,
 *     /orders/admin-create, /orders/init → 404);
 *  6. malformed direct create не может обойти consumer (404 — маршрута нет);
 * 16. исторический (legacy) Order остаётся читаемым/управляемым;
 *  2. BUYER нет direct create;
 *  3. PARTNER нет direct create;
 *  4. ADMIN нет hidden bootstrap.
 *
 * §34 positive — полный канонический путь:
 *  Quote → CheckoutIntent → payment terms/serviceDate → Sale → complete Sale →
 *  OrderRequested → consumer → ровно один Order → items/travelers → OrderCreated.
 *  Assert: bootstrap unavailable, IDs ORD-* / TH-*, frozen money, acquisition DIRECT,
 *  temporal submittedAt, one OrderCreated, no Booking/Payment/BookingRequested,
 *  correlation/causation корректны.
 *
 * Test DB: jest setupFiles (test/e2e.env.ts) — изолированная тестовая БД.
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
import { RoleCode } from "../src/generated/prisma/enums";
import { IdsService } from "../src/shared/ids.service";
import { createFixtureOrder } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe("Phase 2 Step 2.6 — Remove Bootstrap Order Creation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
  } = { users: [], customers: [], products: [], quotes: [], checkouts: [], sales: [], orders: [] };

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
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };
  const createProduct = async (tag: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `S26 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };

  /** Полный канонический путь до Sale (OPEN). */
  const makeReadySale = async (
    smToken: string,
    fx: ProductFixture,
  ): Promise<{ quote: { id: string; code: string }; intent: { id: string; code: string; version: number; total: string }; sale: { id: string; code: string }; date: string }> => {
    const date = FUTURE();
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken)
      .post(`/api/v1/sales/quotes/${quote.code}/items`)
      .send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 })
      .expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }] })
      .expect(201)).body as { id: string; code: string; version: number; total: string };
    created.checkouts.push(intent.id);
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number };
    created.sales.push(sale.id);
    return { quote, intent, sale, date };
  };

  const complete = (token: string, saleCode: string, expectedVersion: number) =>
    agent(token).post(`/api/v1/sales/sales/${saleCode}/complete`).send({ expectedVersion });

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
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`, created.sales);
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "events"."InboxEvent" WHERE "consumerId" = 'order-requested-consumer' AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`);
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    for (const id of created.quotes) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.deleteMany({ where: { id } });
    }
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Negative: removed route / aliases ──────────────────────────────────

  it("1. POST /orders/bootstrap → 404 для anonymous/BUYER/PARTNER/ADMIN; нет alias direct-create", async () => {
    const bootBody = {
      customerId: "c-none",
      items: [{ productId: "p-none", title: "x", type: "TOUR", price: 1 }],
    };
    // Anonymous
    await request(app.getHttpServer()).post("/api/v1/orders/bootstrap").send(bootBody).expect(404);
    // BUYER
    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `s26buy${stamp}`, email: `s26buy${stamp}@test.local`, password: "buyerpass123" })
      .expect(201);
    created.users.push(reg.body.user.id);
    if (reg.body.user.customerId) created.customers.push(reg.body.user.customerId);
    await agent(reg.body.accessToken).post("/api/v1/orders/bootstrap").send(bootBody).expect(404);
    // PARTNER (ADMIN-created role user)
    const partner = await createStaff("s26part", RoleCode.PARTNER);
    await agent(partner.accessToken).post("/api/v1/orders/bootstrap").send(bootBody).expect(404);
    // ADMIN
    await adminAgent.post("/api/v1/orders/bootstrap").send(bootBody).expect(404);
    // Alias direct-create routes не существуют
    for (const alias of ["create", "manual", "admin-create", "init"]) {
      await adminAgent.post(`/api/v1/orders/${alias}`).send(bootBody).expect(404);
    }
    // Никакого Order создано не было
    expect(await prisma.order.count()).toBe(0);
  });

  // ── 2. Positive: canonical journey ────────────────────────────────────────

  it("2. canonical journey: Quote → Checkout → Sale → OrderRequested → ровно один Order → OrderCreated", async () => {
    const sm = await createStaff("s26sm", RoleCode.SALES_MANAGER);
    // Нетривиальная Decimal-сумма (§15): точность 123.45 должна пройти без
    // float-drift от Quote до Order/OrderCreated (никакого reprice).
    const fx = await createProduct("s26canon", 123.45);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const before = new Date();
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    // Ровно один Order на Sale.
    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
    // Канонические ID.
    expect(order.code).toMatch(/^ORD-\d{8}$/);
    expect(order.number).toMatch(/^TH-\d{4}-\d{6}$/);
    // Frozen money: total из CheckoutIntent, без пересчёта; Decimal(12,2)
    // без float-drift — нетривиальная дробная сумма 123.45.
    expect(ctx.intent.total).toBe("123.45");
    expect(order.amount.toString()).toBe("123.45");
    expect(order.amount.toString()).toBe(ctx.intent.total);
    expect(order.currency).toBe("USD");
    // Acquisition: DIRECT, frozen (2.5B).
    expect(order.acquisitionSource).toBe("DIRECT");
    // Temporal: submittedAt server-owned при создании (2.5A).
    expect(order.submittedAt).not.toBeNull();
    expect(order.submittedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
    // Прочие milestones ещё не наступили.
    expect(order.confirmedAt).toBeNull();
    expect(order.fulfilledAt).toBeNull();
    expect(order.closedAt).toBeNull();
    // Upstream refs.
    expect(order.saleId).toBe(ctx.sale.id);
    expect(order.quoteId).toBe(ctx.quote.id);
    expect(order.checkoutId).toBe(ctx.intent.id);
    expect(order.orderRequestedEventId).toBe(r.orderRequestedEventId);
    // Items + travelers.
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.orderTraveler.count({ where: { orderId: order.id } })).toBe(1);
    // Ровно один OrderCreated; frozen money в payload; correlation/causation.
    const createdEv = await prisma.outboxEvent.findMany({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    expect(createdEv).toHaveLength(1);
    expect((createdEv[0].payload as { amount: string }).amount).toBe("123.45");
    const reqEv = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: r.orderRequestedEventId } });
    expect(createdEv[0].causationId).toBe(reqEv.id);
    expect(createdEv[0].correlationId).toBe(reqEv.correlationId);
    // Нет преждевременных side effects: никакого Booking/Payment/BookingRequested.
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingRequested", aggregateId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: { contains: "Payment" } } })).toBe(0);
    // Lifecycle НЕ продвинут за пределы создания.
    expect(order.status).toBe("NEW");
  });

  // ── 3. Duplicate OrderRequested → один Order ─────────────────────────────

  it("3. duplicate OrderRequested delivery → ровно один Order, один OrderCreated", async () => {
    const sm = await createStaff("s26dup", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s26dup");
    const ctx = await makeReadySale(sm.accessToken, fx);
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });
    await (app.get(EventBusService)).publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.id, eventType: "OrderCreated" } })).toBe(1);
  });

  // ── 4. Legacy compatibility: исторический Order читаем/управляем ─────────

  it("4. исторический (legacy) Order остаётся читаемым и управляемым (без удаления/перезаписи)", async () => {
    // Legacy-строка «до Step 2.6»: создаётся test-only fixture (те же поля,
    // что и старые bootstrap-заказы) — НЕ через production-маршрут.
    const legacy = await createFixtureOrder(prisma, app.get(IdsService), app.get(EventBusService), {
      customerId: null,
      items: [{ productId: "00000000-0000-0000-0000-000000000000", title: "Legacy Tour", type: "TOUR", price: 250 }],
      travelers: [{ firstName: "Легаси", lastName: "Клиент", passportNumber: "PLEGACY1" }],
    });
    created.orders.push(legacy.order.id);

    // Читается staff-ом (READ), поля сохранены.
    const sm = await createStaff("s26leg", RoleCode.SALES_MANAGER);
    const detail = (await agent(sm.accessToken).get(`/api/v1/orders/${legacy.order.id}`).expect(200)).body as {
      code: string;
      number: string;
      status: string;
      amount: string;
      travelers: Array<{ dataCompleteness: string }>;
    };
    expect(detail.code).toMatch(/^ORD-\d{8}$/);
    expect(detail.number).toMatch(/^TH-\d{4}-\d{6}$/);
    expect(detail.status).toBe("NEW");
    expect(detail.amount).toBe("250");
    expect(detail.travelers[0].dataCompleteness).toBe("COMPLETE");
    // Управляется (lifecycle) без проблем — OPERATOR (order.accept/order.cancel).
    const op = await createStaff("s26legop", RoleCode.OPERATOR);
    await agent(op.accessToken).patch(`/api/v1/orders/${legacy.order.id}`).send({ action: "process" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/orders/${legacy.order.id}`).send({ action: "cancel" }).expect(200);
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: legacy.order.id } });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
  });
});
