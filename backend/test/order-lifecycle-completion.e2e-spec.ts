/**
 * E2E PHASE 2 STEP 2.7 — Order Lifecycle Completion (canonical machine).
 *
 * Доказывает (§37 implementation prompt) канонический Order lifecycle:
 *  - единственный production writer: OrderRequested → consumer → Order (NEW);
 *  - полная машина состояний: NEW → IN_PROCESSING ⇄ WAITING_FOR_DATA →
 *    READY_FOR_BOOKING → SENT_TO_BOOKING → PARTIALLY_FULFILLED → FULFILLED →
 *    CLOSED; CANCELLED/PROBLEM/SUSPENDED (marker-состояния);
 *  - невалидные переходы — контролируемые 409/422, никогда raw 500;
 *  - READY_FOR_BOOKING = ядро: guard полноты данных туристов, ровно одно
 *    OrderReadyForBooking, retry/concurrent — без дублей;
 *  - явная команда «Send to Booking Center»: только из READY_FOR_BOOKING →
 *    SENT_TO_BOOKING + ровно один BookingRequested (минимальный payload без
 *    PII); дубликат/гонка не дублируют эффект; Booking создаёт ТОЛЬКО
 *    consumer (Step 2.8 boundary — Order не пишет в booking.*);
 *  - OrderFulfilled/OrderClosed — только реальные переходы, milestone-времена
 *    immutable, ровно одно событие;
 *  - READY_TO_CLOSE — зарезервированный Screen Design код без producer-а
 *    (close каноничен из FULFILLED);
 *  - temporal-контракт 2.5A, history, correlation/causation, RBAC/IDOR,
 *    mass-assignment защита, legacy Order совместимость;
 *  - lifecycle не трогает: acquisitionSource, деньги, availability holds,
 *    Booking (кроме send→consumer).
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
import { IdsService } from "../src/shared/ids.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { Prisma, RoleCode } from "../src/generated/prisma/client";
import { SalesAcquisitionSource } from "../src/generated/prisma/enums";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
  tariffPrice: string;
}

interface SaleCtx {
  quote: { id: string; code: string };
  intent: { id: string; code: string; version: number; total: string; currency: string };
  sale: { id: string; code: string; version: number; status: string };
  date: string;
  total: string;
  currency: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Phase 2 Step 2.7 — Order Lifecycle Completion (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: { users: string[]; customers: string[]; products: string[]; orders: string[]; quotes: string[]; checkouts: string[]; sales: string[] } = {
    users: [],
    customers: [],
    products: [],
    orders: [],
    quotes: [],
    checkouts: [],
    sales: [],
  };

  const register = (body: Record<string, unknown>) => request(app.getHttpServer()).post("/api/v1/auth/register").send(body);
  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };
  const registerBuyer = async (tag: string): Promise<Session> => {
    const res = await register({
      username: `${tag}${stamp}`,
      email: `${tag}${stamp}@test.local`,
      password: "buyerpass123",
      firstName: "Покупатель",
      lastName: tag.toUpperCase(),
    }).expect(201);
    const session = res.body as Session;
    created.users.push(session.user.id);
    if (session.user.customerId) created.customers.push(session.user.customerId);
    return session;
  };
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };
  const createProduct = async (tag: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `S27 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };

  /** Полный fixture до Sale (НЕ complete): ISSUED Quote + Checkout + Sale OPEN. */
  const makeReadySale = async (smToken: string, fx: ProductFixture): Promise<SaleCtx> => {
    const date = FUTURE();
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; code: string; version: number; total: string; currency: string };
    created.checkouts.push(intent.id);
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number; status: string };
    created.sales.push(sale.id);
    return { quote, intent, sale, date, total: intent.total, currency: intent.currency };
  };
  const complete = (token: string, saleCode: string, expectedVersion: number) =>
    agent(token).post(`/api/v1/sales/sales/${saleCode}/complete`).send({ expectedVersion });

  // ── Step 2.6: test-only fixture для lifecycle-специфичных тестов (НЕ для
  // проверки canonical Order creation — это отдельный сьют order-creation-consumer). ──
  const fixtureOrder = (overrides: Partial<FixtureOrderInput> = {}) =>
    createFixtureOrder(prisma, ids, eventBus, {
      customerId: null,
      currency: "USD",
      items: [{ productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 }],
      // COMPLETE travelers по умолчанию (guard confirm требует passport).
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" }],
      ...overrides,
    });

  const action = (orderId: string, act: string, token?: string) => {
    const a = token ? agent(token) : adminAgent;
    return a.patch(`/api/v1/orders/${orderId}`).send({ action: act });
  };
  const eventsFor = async (orderId: string) =>
    prisma.outboxEvent.findMany({ where: { aggregateId: orderId }, orderBy: { createdAt: "asc" } });
  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;
  const bookingCount = async (orderId: string) => (await prisma.booking.count({ where: { orderId } }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    ids = app.get(IdsService);
    eventBus = app.get(EventBusService);

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    // Shared-DB isolation: чистим свои Order + их outbox/inbox + Booking (по payload.orderId).
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.outboxEvent.deleteMany({
        where: { eventType: "BookingCreated", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) },
      });
      await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.checkoutIntent.deleteMany({ where: { id: { in: created.checkouts } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. канонический Order стартует в NEW с submittedAt и frozen фактами (OrderRequested → consumer)", async () => {
    const sm = await createStaff("s27sm", "SALES_MANAGER");
    const fx = await createProduct("s27_canon");
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    const order = await prisma.order.findFirstOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.status).toBe("NEW");
    expect(order.submittedAt).not.toBeNull();
    expect(order.confirmedAt).toBeNull();
    expect(order.fulfilledAt).toBeNull();
    expect(order.closedAt).toBeNull();
    expect(order.acquisitionSource).toBe("DIRECT");
    expect(String(order.amount)).toBe(ctx.total); // frozen money, без reprice
    expect(order.orderRequestedEventId).not.toBeNull();
    // Ровно один capacity hold остаётся — lifecycle НЕ резервирует повторно.
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
    // OrderCreated: correlation наследуется из OrderRequested, causation = OrderRequested eventId.
    const createdEv = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateType: "Order", aggregateId: order.id, eventType: DomainEvents.OrderCreated },
    });
    const requested = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: order.orderRequestedEventId! } });
    expect(createdEv.correlationId).toBe(requested.correlationId);
    expect(createdEv.causationId).toBe(requested.id);
  });

  it("2. NEW → IN_PROCESSING (process): статус/history/техническое событие; без Booking", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("IN_PROCESSING");
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.some((h) => h.action === "process" && h.from === "NEW" && h.to === "IN_PROCESSING")).toBe(true);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderStatusChanged")).toBe(1);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(0);
    expect(await bookingCount(order.id)).toBe(0);
  });

  it("3. невалидный NEW → CLOSED отклонён 409 без частичного state/history/события", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "close").expect(409);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("NEW");
    expect(state.version).toBe(1);
    expect(state.closedAt).toBeNull();
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.filter((h) => h.action === "close")).toHaveLength(0);
    expect(typeCount(await eventsFor(order.id), "OrderClosed")).toBe(0);
  });

  it("4. WAITING_FOR_DATA: markWaitingData (IN_PROCESSING→WAITING_FOR_DATA) → resumeProcessing (обратно)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "markWaitingData").expect(200);
    let state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("WAITING_FOR_DATA");
    await action(order.id, "resumeProcessing").expect(200);
    state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("IN_PROCESSING");
    // Технические переходы → OrderStatusChanged, не canonical.
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderStatusChanged")).toBe(3);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(0);
  });

  it("5. readiness guard: confirm с неполными данными туристов → 422, перехода нет", async () => {
    const order = (await fixtureOrder({ travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02" }] })).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(422);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("IN_PROCESSING");
    expect(state.confirmedAt).toBeNull();
    expect(typeCount(await eventsFor(order.id), "OrderReadyForBooking")).toBe(0);
    expect(await bookingCount(order.id)).toBe(0);
  });

  it("6. valid confirm → READY_FOR_BOOKING: confirmedAt + ровно одно OrderReadyForBooking; БЕЗ BookingRequested/Booking", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("READY_FOR_BOOKING");
    expect(state.confirmedAt).not.toBeNull();
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);
    expect(typeCount(events, "BookingRequested")).toBe(0);
    const ready = events.find((e) => e.eventType === DomainEvents.OrderReadyForBooking)!;
    expect(ready.payload).toEqual({ orderId: order.id, code: order.code, customerId: null });
    // HTTP-команда: correlation = server UUID, causation = null.
    expect(ready.correlationId).toMatch(UUID_RE);
    expect(ready.causationId).toBeNull();
    expect(await bookingCount(order.id)).toBe(0);
  });

  it("7. retry confirm → 409, второе OrderReadyForBooking не создаётся; confirmedAt immutable", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const first = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await action(order.id, "confirm").expect(409);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("READY_FOR_BOOKING");
    expect(after.confirmedAt?.getTime()).toBe(first.confirmedAt?.getTime()); // milestone не сдвигается
    expect(typeCount(await eventsFor(order.id), "OrderReadyForBooking")).toBe(1);
  });

  it("8. send только из READY_FOR_BOOKING: из IN_PROCESSING → 409", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "send").expect(409);
    expect(typeCount(await eventsFor(order.id), "BookingRequested")).toBe(0);
    expect(await bookingCount(order.id)).toBe(0);
  });

  it("9. явная команда send → SENT_TO_BOOKING + ровно один BookingRequested (payload без PII); Booking создаёт consumer", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("SENT_TO_BOOKING");
    const events = await eventsFor(order.id);
    expect(typeCount(events, "BookingRequested")).toBe(1);
    const req = events.find((e) => e.eventType === DomainEvents.BookingRequested)!;
    // Minimal payload: только canonical refs, никакого PII/raw-дампов.
    expect(req.payload).toEqual({ orderId: order.id, orderCode: order.code, customerId: null });
    const raw = JSON.stringify(req.payload);
    expect(raw).not.toContain("passportNumber");
    expect(raw).not.toContain("firstName");
    expect(req.correlationId).toMatch(UUID_RE);
    expect(req.causationId).toBeNull();
    // Booking создаётся ТОЛЬКО consumer-ом BookingRequested (booking.subscribers) —
    // Order-модуль НЕ пишет в booking.* (Step 2.8 boundary сохраняется).
    expect(await bookingCount(order.id)).toBe(1);
    const createdBooking = await prisma.booking.findFirstOrThrow({ where: { orderId: order.id } });
    const bCreated = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "BookingCreated", aggregateId: createdBooking.id } });
    expect(bCreated.causationId).toBe(req.id); // causation = BookingRequested eventId
  });

  it("10. duplicate send → 409; BookingRequested/Booking не дублируются", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "send").expect(409);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "BookingRequested")).toBe(1);
    expect(await bookingCount(order.id)).toBe(1);
  });

  it("11. concurrent duplicate send: ровно один победитель, одно BookingRequested, одна Booking", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const results = await Promise.allSettled([action(order.id, "send"), action(order.id, "send")]);
    const ok = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 200);
    const conflict = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 409);
    expect(ok.length).toBe(1);
    expect(conflict.length).toBe(1);
    expect(typeCount(await eventsFor(order.id), "BookingRequested")).toBe(1);
    expect(await bookingCount(order.id)).toBe(1);
  });

  it("12. RBAC: BUYER/PARTNER/SALES_MANAGER/MODERATOR → 403 на все lifecycle-команды; OPERATOR/ADMIN → 200", async () => {
    const buyer = await registerBuyer("s27buy");
    const partner = await createStaff("s27prt", "PARTNER");
    const sales = await createStaff("s27sm2", "SALES_MANAGER");
    const moderator = await createStaff("s27mod", "MODERATOR");
    const operator = await createStaff("s27op", "OPERATOR");
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);

    for (const s of [buyer, partner, sales, moderator]) {
      for (const act of ["process", "confirm", "send", "complete", "close", "cancel", "problem", "suspend"]) {
        await action(order.id, act, s.accessToken).expect(403);
      }
    }
    // Order остался в NEW — ни одна запрещённая команда не применилась.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("NEW");

    await action(order.id, "process", operator.accessToken).expect(200);
    await action(order.id, "confirm", operator.accessToken).expect(200);
    await action(order.id, "send", operator.accessToken).expect(200);
    await action(order.id, "complete", operator.accessToken).expect(200);
    await action(order.id, "close", operator.accessToken).expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CLOSED");

    const adminOrder = (await fixtureOrder()).order;
    created.orders.push(adminOrder.id);
    await action(adminOrder.id, "process").expect(200);
    await action(adminOrder.id, "confirm").expect(200);
    await action(adminOrder.id, "send").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: adminOrder.id } })).status).toBe("SENT_TO_BOOKING");
  });

  it("13. IDOR/unknown Order → 404 (нейтральный), не 500", async () => {
    await action("00000000-0000-4000-8000-000000000000", "process").expect(404);
    await action("00000000-0000-4000-8000-000000000000", "confirm").expect(404);
  });

  it("14. mass-assignment: forged server-owned поля → 422 (loud, конвенция assertNoForbiddenKeys); переход не применяется; PATCH без action → 400", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    // STRICT REVIEW §28: forged server-owned поля рядом с валидным action — ЯВНЫЙ 422
    // (как в Sales/Reverse/Catalog), а не silent-strip через whitelist.
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({
      action: "process",
      status: "CLOSED",
      amount: 0.01,
      confirmedAt: "2020-01-01T00:00:00.000Z",
      customerId: "forged",
      saleId: "forged",
      acquisitionSource: "MARKETPLACE",
      version: 999,
    }).expect(422);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("NEW"); // переход НЕ применён
    expect(after.version).toBe(1);
    expect(after.confirmedAt).toBeNull();
    expect(after.customerId).toBeNull();
    expect(after.acquisitionSource).toBe("DIRECT");
    expect(typeCount(await eventsFor(order.id), "OrderStatusChanged")).toBe(0);
    // PATCH без валидного action (только forged поля) → 400 (DTO: action обязателен).
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ status: "CLOSED", amount: 5 }).expect(400);
    // travelers: forged server-owned ключ (dataCompleteness) внутри item → 422, а не silent-strip.
    await adminAgent
      .patch(`/api/v1/orders/${order.id}/travelers`)
      .send({ travelers: [{ firstName: "Анна", lastName: "Петрова", dataCompleteness: "COMPLETE" }] })
      .expect(422);
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id } });
    expect(travelers[0]?.dataCompleteness).toBe("COMPLETE"); // из fixture (passport задан) — не изменён
    expect(travelers[0]?.firstName).toBe("Анна");
    // travelers: server-owned ключ на верхнем уровне body → 422.
    await adminAgent
      .patch(`/api/v1/orders/${order.id}/travelers`)
      .send({ travelers: [{ firstName: "Анна", lastName: "Петрова" }], version: 5 })
      .expect(422);
  });

  it("15. valid cancellation: CANCELLED + OrderCancelled + cancelledAt; no Booking", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "cancel").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("CANCELLED");
    expect(state.cancelledAt).not.toBeNull();
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderCancelled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(0);
    expect(await bookingCount(order.id)).toBe(0);
  });

  it("16/17. невалидная отмена (из CLOSED → 409); CANCELLED не может стать READY_FOR_BOOKING", async () => {
    const a = (await fixtureOrder()).order;
    created.orders.push(a.id);
    await action(a.id, "process").expect(200);
    await action(a.id, "confirm").expect(200);
    await action(a.id, "send").expect(200);
    await action(a.id, "complete").expect(200);
    await action(a.id, "close").expect(200);
    await action(a.id, "cancel").expect(409); // CLOSED — терминал

    const b = (await fixtureOrder()).order;
    created.orders.push(b.id);
    await action(b.id, "cancel").expect(200);
    await action(b.id, "confirm").expect(409); // CANCELLED → READY_FOR_BOOKING запрещён
    await action(b.id, "send").expect(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
  });

  it("18/27. valid fulfillment: SENT_TO_BOOKING → complete → FULFILLED + fulfilledAt + ровно одно OrderFulfilled; invalid complete из NEW → 409", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "complete").expect(409); // из NEW невалидно

    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("FULFILLED");
    expect(state.fulfilledAt).not.toBeNull();
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(0);
    // no direct Booking side effect от complete (booking уже был от send — ровно одна).
    expect(await bookingCount(order.id)).toBe(1);
  });

  it("19/21/22/23. close: FULFILLED → CLOSED (READY_TO_CLOSE не требуется) + OrderClosed + closedAt; invalid close из NEW → 409; CLOSED не открывается", async () => {
    const a = (await fixtureOrder()).order;
    created.orders.push(a.id);
    await action(a.id, "close").expect(409); // из NEW невалидно
    await action(a.id, "process").expect(200);
    await action(a.id, "confirm").expect(200);
    await action(a.id, "send").expect(200);
    await action(a.id, "complete").expect(200);
    // READY_TO_CLOSE — зарезервированный Screen Design код; канонический close идёт из FULFILLED.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("FULFILLED");
    await action(a.id, "close").expect(200);
    const closed = await prisma.order.findUniqueOrThrow({ where: { id: a.id } });
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();
    const events = await eventsFor(a.id);
    expect(typeCount(events, "OrderClosed")).toBe(1);
    await action(a.id, "process").expect(409); // CLOSED нельзя открыть заново
    await action(a.id, "cancel").expect(409);
    expect(typeCount(await eventsFor(a.id), "OrderClosed")).toBe(1);
  });

  it("20. READY_TO_CLOSE не производится ни одним действием машины (резервный код, close каноничен из FULFILLED)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    for (const act of ["process", "confirm", "send", "complete", "close"]) {
      const r = await action(order.id, act);
      expect([200, 409, 422]).toContain(r.status);
    }
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("CLOSED");
    // Ни на одном шаге статус не становился READY_TO_CLOSE (проверяем по history).
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.some((h) => h.to === "READY_TO_CLOSE")).toBe(false);
  });

  it("24. milestone timestamps immutable: только на реальном переходе, не сдвигаются при конфликтах", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    const confirmedAtBefore = null;
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).confirmedAt).toBe(confirmedAtBefore);
    await action(order.id, "confirm").expect(200);
    const t1 = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).confirmedAt;
    // Конфликтующие повторные переходы не двигают milestone.
    await action(order.id, "confirm").expect(409);
    await action(order.id, "complete").expect(409);
    await action(order.id, "close").expect(409);
    const t2 = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).confirmedAt;
    expect(t2?.getTime()).toBe(t1?.getTime());
    // fulfilledAt/closedAt остаются NULL до реальных переходов.
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.fulfilledAt).toBeNull();
    expect(state.closedAt).toBeNull();
  });

  it("25. history: каждый реальный переход пишет ровно одну OrderHistory-строку (from/to/action)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "markWaitingData").expect(200);
    await action(order.id, "resumeProcessing").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    const lifecycle = hist.filter((h) => ["process", "markWaitingData", "resumeProcessing", "confirm", "send", "complete", "close"].includes(h.action));
    expect(lifecycle.map((h) => h.action)).toEqual(["process", "markWaitingData", "resumeProcessing", "confirm", "send", "complete", "close"]);
    expect(lifecycle.every((h) => h.from && h.to)).toBe(true);
    expect(lifecycle.filter((h) => h.action === "confirm")[0].to).toBe("READY_FOR_BOOKING");
    expect(lifecycle.filter((h) => h.action === "close")[0].to).toBe("CLOSED");
  });

  it("26. correlation/causation: HTTP-команды → correlation=server UUID, causation=null; consumer-события наследуют lineage", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    const events = await eventsFor(order.id);
    // Command-события (HTTP-команды): correlation = server UUID из request context,
    // causation = null (корневой HTTP flow, ADR-0009). OrderCreated fixture-заказа
    // (вне HTTP) честно несёт null-correlation — не включается в assertion.
    const commandEvents = events.filter((e) =>
      ["OrderReadyForBooking", "BookingRequested", "OrderFulfilled", "OrderClosed", "OrderCancelled", "OrderStatusChanged"].includes(e.eventType),
    );
    expect(commandEvents.length).toBeGreaterThan(0);
    for (const e of commandEvents) {
      expect(e.correlationId).toMatch(UUID_RE);
      expect(e.causationId).toBeNull();
    }
  });

  it("28/31. acquisition и деньги immutable на всём lifecycle; legacy Order (без saleId) полностью управляем", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(before.acquisitionSource).toBe("DIRECT");
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.acquisitionSource).toBe(before.acquisitionSource);
    expect(String(after.amount)).toBe(String(before.amount));
    expect(after.currency).toBe(before.currency);
    expect(after.paymentStatus).toBe(before.paymentStatus);
    // legacy Order: saleId/quoteId/checkoutId = NULL — lifecycle не требует новых refs.
    expect(before.saleId).toBeNull();
  });

  it("29. availability isolation: lifecycle НЕ создаёт второй hold", async () => {
    const sm = await createStaff("s27av", "SALES_MANAGER");
    const fx = await createProduct("s27_avail");
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);

    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    // READY_FOR_BOOKING / SEND / FULFILLED / CLOSED не трогают catalog.AvailabilityReservation.
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
  });

  it("30. Booking ownership isolation: только send порождает Booking (через consumer); остальные действия — ноль прямых записей", async () => {
    // Полный lifecycle БЕЗ send: ни одной Booking.
    const a = (await fixtureOrder()).order;
    created.orders.push(a.id);
    await action(a.id, "process").expect(200);
    await action(a.id, "confirm").expect(200);
    await action(a.id, "complete").expect(409); // не из SENT_TO_BOOKING
    await action(a.id, "cancel").expect(200);
    expect(await bookingCount(a.id)).toBe(0);

    // Order-модуль не пишет booking.* напрямую: Booking создаётся consumer-ом
    // с causation = BookingRequested (проверено в #9). Здесь — отсутствие записи
    // на cancel/close/complete без send.
    const b = (await fixtureOrder()).order;
    created.orders.push(b.id);
    await action(b.id, "process").expect(200);
    await action(b.id, "confirm").expect(200);
    await action(b.id, "send").expect(200);
    expect(await bookingCount(b.id)).toBe(1);
    await action(b.id, "cancel").expect(200); // Order отменён, Booking не трогается (2.9 оркестрация не выдумывается)
    expect(await bookingCount(b.id)).toBe(1);
  });

  it("32/41. гонка конфликтующих переходов (process vs cancel): CAS — без double-apply, ≤1 canonical эффект, без raw 500", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const results = await Promise.allSettled([action(order.id, "process"), action(order.id, "cancel")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    // Только контролируемые коды, никогда raw 500. Под настоящей конкуренцией —
    // ровно [200, 409]; при сериализации планировщика process→cancel легально
    // [200, 200] (cancel разрешён из IN_PROCESSING) — CAS при этом не нарушен.
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(["IN_PROCESSING", "CANCELLED"]).toContain(state.status);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    const applied = hist.filter((h) => h.action === "process" || h.action === "cancel");
    // Ни один action не применяется дважды (CAS): строки уникальны по (action, from→to).
    expect(applied.length).toBeGreaterThanOrEqual(1);
    expect(new Set(applied.map((h) => `${h.action}:${h.from}->${h.to}`)).size).toBe(applied.length);
    // ≤1 терминальное событие: ровно один OrderCancelled, если cancel применился первым/в цепочке.
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderCancelled")).toBeLessThanOrEqual(1);
    if (state.status === "CANCELLED") {
      expect(typeCount(events, "OrderCancelled")).toBe(1);
    } else {
      expect(typeCount(events, "OrderCancelled")).toBe(0);
    }
  });

  it("33/42/43. атомарность: неуспешный переход не оставляет state/history/event; ошибки всегда контролируемые (не 500)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const responses: number[] = [];
    for (const act of ["complete", "close", "send", "confirm"]) {
      const r = await action(order.id, act);
      responses.push(r.status);
    }
    expect(responses.every((s) => s >= 400 && s < 500)).toBe(true); // все — контролируемые 4xx
    expect(responses.every((s) => s !== 500)).toBe(true);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("NEW");
    expect(state.version).toBe(1);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.filter((h) => ["complete", "close", "send", "confirm"].includes(h.action))).toHaveLength(0);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(0);
    expect(typeCount(events, "BookingRequested")).toBe(0);
  });

  it("34. concurrent duplicate confirm: ровно один победитель, одно OrderReadyForBooking, confirmedAt один раз (STRICT REVIEW §29/§40)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    const results = await Promise.allSettled([action(order.id, "confirm"), action(order.id, "confirm")]);
    const ok = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 200);
    const conflict = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 409);
    expect(ok.length).toBe(1);
    expect(conflict.length).toBe(1);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("READY_FOR_BOOKING");
    expect(typeCount(await eventsFor(order.id), "OrderReadyForBooking")).toBe(1);
    // Ровно одна history-строка confirm.
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.filter((h) => h.action === "confirm")).toHaveLength(1);
  });

  it("35. гонка send vs cancel: ≤1 BookingRequested/Booking, ≤1 OrderCancelled, без raw 500 (STRICT REVIEW §29/§40)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const results = await Promise.allSettled([action(order.id, "send"), action(order.id, "cancel")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    // Только 200/409 (сериализация send→cancel легально даёт [200, 200]: cancel
    // разрешён из SENT_TO_BOOKING). Никогда raw 500.
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const events = await eventsFor(order.id);
    const bookings = await bookingCount(order.id);
    expect(typeCount(events, "BookingRequested")).toBeLessThanOrEqual(1);
    expect(typeCount(events, "OrderCancelled")).toBeLessThanOrEqual(1);
    if (state.status === "SENT_TO_BOOKING") {
      expect(typeCount(events, "BookingRequested")).toBe(1);
      expect(bookings).toBe(1);
      expect(typeCount(events, "OrderCancelled")).toBe(0);
    } else {
      expect(state.status).toBe("CANCELLED");
      expect(typeCount(events, "OrderCancelled")).toBe(1);
      if (bookings === 1) {
        // send применился первым, затем cancel — Booking из durable BookingRequested остаётся.
        expect(typeCount(events, "BookingRequested")).toBe(1);
      } else {
        expect(typeCount(events, "BookingRequested")).toBe(0);
      }
    }
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    const applied = hist.filter((h) => h.action === "send" || h.action === "cancel");
    // CAS: ни один action не применяется дважды.
    expect(applied.length).toBeGreaterThanOrEqual(1);
    expect(new Set(applied.map((h) => `${h.action}:${h.from}->${h.to}`)).size).toBe(applied.length);
  });

  it("36. fulfill race: гонка complete vs cancel (из SENT_TO_BOOKING) — один canonical факт, milestone один раз (STRICT REVIEW §18/§29)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect(await bookingCount(order.id)).toBe(1);
    const results = await Promise.allSettled([action(order.id, "complete"), action(order.id, "cancel")]);
    const ok = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 200);
    const conflict = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 409);
    expect(ok.length).toBe(1);
    expect(conflict.length).toBe(1);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const events = await eventsFor(order.id);
    if (state.status === "FULFILLED") {
      expect(typeCount(events, "OrderFulfilled")).toBe(1);
      expect(typeCount(events, "OrderCancelled")).toBe(0);
      expect(state.fulfilledAt).not.toBeNull();
    } else {
      expect(state.status).toBe("CANCELLED");
      expect(typeCount(events, "OrderCancelled")).toBe(1);
      expect(typeCount(events, "OrderFulfilled")).toBe(0);
      expect(state.cancelledAt).not.toBeNull();
    }
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.filter((h) => h.action === "complete" || h.action === "cancel")).toHaveLength(1);
  });

  it("37. acquisition non-DIRECT (BUYER_REQUEST) immutable на всём lifecycle; Booking копирует frozen source (STRICT REVIEW §33)", async () => {
    const order = (await fixtureOrder({ acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST })).order;
    created.orders.push(order.id);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(before.acquisitionSource).toBe("BUYER_REQUEST");
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.acquisitionSource).toBe("BUYER_REQUEST");
    expect(String(after.amount)).toBe(String(before.amount));
    // Booking копирует frozen source (READ-only, ADR-0001) — не ре-выводит.
    const booking = await prisma.booking.findFirstOrThrow({ where: { orderId: order.id } });
    expect(booking.acquisitionSource).toBe("BUYER_REQUEST");
  });

  it("38. legacy Order (nullable acquisitionSource, без Sale provenance) полностью управляем (STRICT REVIEW §37)", async () => {
    const order = (await fixtureOrder({ acquisitionSource: null })).order;
    created.orders.push(order.id);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(before.acquisitionSource).toBeNull();
    expect(before.saleId).toBeNull();
    expect(before.submittedAt).not.toBeNull();
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("SENT_TO_BOOKING");
    // Booking создаётся с nullable source (копия null, без fabrication).
    const booking = await prisma.booking.findFirstOrThrow({ where: { orderId: order.id } });
    expect(booking.acquisitionSource).toBeNull();
  });
});
