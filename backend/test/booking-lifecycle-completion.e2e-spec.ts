/**
 * E2E PHASE 2 STEP 2.9 — Booking Lifecycle Completion (canonical machine).
 *
 * Доказывает (§41/§42 implementation prompt) канонический Booking lifecycle:
 *  - единственный state-machine authority: booking.service.bookingAction (HARD
 *    GATE §6) — контроллеры и consumer-ы используют те же guards/CAS;
 *  - полная машина состояний: NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER ⇄
 *    NEEDS_CLARIFICATION → CONFIRMED → IN_SERVICE → COMPLETED; SUPPLIER_REJECTED;
 *    CHANGE_REQUESTED ⇄ CONFIRMED; CANCELLATION_REQUESTED → CANCELLED; PROBLEM;
 *    AWAITING_CONFIRMATION — резервный код без producer-а (legacy-источник);
 *  - невалидные переходы — контролируемые 409/422, никогда raw 500;
 *  - ровно одно canonical событие на факт: BookingConfirmed / BookingRejected /
 *    BookingCancelled / BookingCompleted (+ технический BookingStatusChanged);
 *  - Booking → Order feedback исключительно событиями (Order-owned reconcile):
 *    confirm → PARTIALLY_FULFILLED, reject → PROBLEM, все terminal → FULFILLED;
 *  - Step 2.8 deferred compensation (§15): OrderCancelled → активные Booking
 *    компенсируются (CANCELLED + history + BookingCancelled); гонка Order-cancel
 *    vs Booking-create в обоих порядках детерминирована (создание сразу в
 *    CANCELLED при уже отменённом заказе);
 *  - frozen факты immutable: acquisitionSource (DIRECT/BUYER_REQUEST/null),
 *    money/currency, service occurrence (2.8A), никакого второго availability
 *    hold, никаких Finance-фактов;
 *  - RBAC/IDOR/mass-assignment; PII отсутствует в событиях; correlation/causation;
 *  - CAS-гонки (confirm vs reject, confirm vs cancel, complete vs cancel);
 *  - legacy Booking (orderItemId NULL) читаема/управляема.
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
import { DomainEvents, type BookingRequestedPayload } from "../src/eventbus/domain-events";
import { RoleCode } from "../src/generated/prisma/client";
import { SalesAcquisitionSource } from "../src/generated/prisma/enums";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Phase 2 Step 2.9 — Booking Lifecycle Completion (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    products: string[];
    orders: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
  } = { users: [], customers: [], products: [], orders: [], quotes: [], checkouts: [], sales: [] };

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
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `${tag}${stamp}`, email: `${tag}${stamp}@test.local`, password: "buyerpass123", firstName: "Покупатель", lastName: tag.toUpperCase() })
      .expect(201);
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
      .send({ type: "TOUR", title: `S29 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };

  const fixtureOrder = (overrides: Partial<FixtureOrderInput> = {}) =>
    createFixtureOrder(prisma, ids, eventBus, {
      customerId: null,
      currency: "USD",
      items: [{ productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 }],
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" }],
      ...overrides,
    });

  const orderAction = (orderId: string, act: string, token?: string) => {
    const a = token ? agent(token) : adminAgent;
    return a.patch(`/api/v1/orders/${orderId}`).send({ action: act });
  };
  const bookingAction = (bookingId: string, act: string, token?: string) => {
    const a = token ? agent(token) : adminAgent;
    return a.patch(`/api/v1/bookings/${bookingId}`).send({ action: act });
  };
  const eventsFor = async (orderId: string) => prisma.outboxEvent.findMany({ where: { aggregateId: orderId }, orderBy: { createdAt: "asc" } });
  const bookingEventsFor = async (bookingId: string) => prisma.outboxEvent.findMany({ where: { aggregateId: bookingId }, orderBy: { createdAt: "asc" } });
  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;
  const bookingsFor = (orderId: string) => prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });

  /** Довести заказ до существующей Booking (send → consumer). */
  const orderToBooking = async (orderId: string, token?: string) => {
    await orderAction(orderId, "process", token).expect(200);
    await orderAction(orderId, "confirm", token).expect(200);
    await orderAction(orderId, "send", token).expect(200);
    const bookings = await bookingsFor(orderId);
    expect(bookings.length).toBeGreaterThan(0);
    return bookings[0]!;
  };

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
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.outboxEvent.deleteMany({
        where: { eventType: "BookingCreated", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) },
      });
      await prisma.passenger.deleteMany({ where: { booking: { orderId: { in: created.orders } } } });
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

  // ─────────────────────────── POSITIVE LIFECYCLE ───────────────────────────

  it("1/2. initial NEW → prepare (PREPARING_REQUEST) → send (SENT_TO_SUPPLIER): явная supplier-processing команда", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect(b.status).toBe("NEW"); // initial state — никакого implied accepted/confirmed/fulfilled

    // prepare: NEW → PREPARING_REQUEST
    await bookingAction(b.id, "prepare").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("PREPARING_REQUEST");
    // send: PREPARING_REQUEST → SENT_TO_SUPPLIER
    await bookingAction(b.id, "send").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("SENT_TO_SUPPLIER");
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: "asc" } });
    expect(hist.map((h) => h.action)).toEqual(["created", "prepare", "send"]);
    // «created» (consumer) не имеет from (нет предыдущего состояния); переходы — полные.
    expect(hist.filter((h) => h.action !== "created").every((h) => h.from && h.to)).toBe(true);
    // Технические переходы → BookingStatusChanged (2 шт.), canonical нет.
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingStatusChanged")).toBe(2);
    expect(typeCount(events, "BookingConfirmed")).toBe(0);
    // lifecycle не трогает frozen факты
    expect(String(state.amount)).toBe("100");
    expect(state.acquisitionSource).toBe("DIRECT");
  });

  it("3/4. clarification round-trip: requestClarification → NEEDS_CLARIFICATION → resume → SENT_TO_SUPPLIER", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200); // NEW → SENT_TO_SUPPLIER
    await bookingAction(b.id, "requestClarification").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("NEEDS_CLARIFICATION");
    await bookingAction(b.id, "resume").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("SENT_TO_SUPPLIER");
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: "asc" } });
    expect(hist.some((h) => h.action === "requestClarification" && h.to === "NEEDS_CLARIFICATION")).toBe(true);
    expect(hist.some((h) => h.action === "resume" && h.to === "SENT_TO_SUPPLIER")).toBe(true);
    // frozen facts не меняются (money/service/acquisition — не тронуты; fixture без
    // serviceDate → OPEN_DATE/date-only факт остаётся verbatim)
    expect(String(state.amount)).toBe("100");
    expect(state.serviceDate).toBeNull();
    expect(state.serviceTimeType).toBe("OPEN_DATE");
  });

  it("5/6. confirm: SENT_TO_SUPPLIER → CONFIRMED + ровно одно BookingConfirmed; retry → 409 без дубля", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CONFIRMED");
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingConfirmed")).toBe(1);
    // retry confirm → 409, второго события нет
    await bookingAction(b.id, "confirm").expect(409);
    expect(typeCount(await bookingEventsFor(b.id), "BookingConfirmed")).toBe(1);
    const confirmed = events.find((e) => e.eventType === "BookingConfirmed")!;
    expect(confirmed.payload).toEqual({ bookingId: b.id, code: state.code, orderId: order.id, productId: state.productId });
    expect(JSON.stringify(confirmed.payload)).not.toContain("passport");
  });

  it("7/8. reject: SENT_TO_SUPPLIER → SUPPLIER_REJECTED + ровно одно BookingRejected; retry → 409", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "reject").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("SUPPLIER_REJECTED");
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingRejected")).toBe(1);
    await bookingAction(b.id, "reject").expect(409); // терминальный
    expect(typeCount(await bookingEventsFor(b.id), "BookingRejected")).toBe(1);
  });

  it("9/10. cancellation: requestCancellation → CANCELLATION_REQUESTED → cancel → CANCELLED + ровно одно BookingCancelled; retry → 409", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "requestCancellation").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CANCELLATION_REQUESTED");
    await bookingAction(b.id, "cancel").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CANCELLED");
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingCancelled")).toBe(1);
    await bookingAction(b.id, "cancel").expect(409);
    expect(typeCount(await bookingEventsFor(b.id), "BookingCancelled")).toBe(1);
    // no hard delete — durable history
    expect(await prisma.booking.findUnique({ where: { id: b.id } })).not.toBeNull();
  });

  it("11/12. change marker: requestChange → CHANGE_REQUESTED → resolveChange → CONFIRMED (без reprice/reschedule)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "requestChange").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CHANGE_REQUESTED");
    await bookingAction(b.id, "resolveChange").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CONFIRMED");
    // frozen money/service occurrence не тронуты marker-переходами
    expect(String(state.amount)).toBe(String(before.amount));
    expect(state.serviceDate?.getTime()).toBe(before.serviceDate?.getTime());
    expect(state.serviceStartsAt?.getTime()).toBe(before.serviceStartsAt?.getTime());
  });

  it("13. complete: IN_SERVICE → COMPLETED + ровно одно BookingCompleted (canonical) и технический BookingStatusChanged", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("IN_SERVICE");
    await bookingAction(b.id, "complete").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("COMPLETED");
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingCompleted")).toBe(1); // ровно одно canonical completion
    // Технические BookingStatusChanged: send(1) + service(1) + complete(1) = 3.
    // complete ЭМИТИТ и технический (reconcile-контракт 2.5A) и canonical BookingCompleted.
    expect(typeCount(events, "BookingStatusChanged")).toBe(3);
    // retry → 409, дублей нет
    await bookingAction(b.id, "complete").expect(409);
    expect(typeCount(await bookingEventsFor(b.id), "BookingCompleted")).toBe(1);
    const completed = events.find((e) => e.eventType === "BookingCompleted")!;
    expect(completed.payload).toEqual({ bookingId: b.id, code: state.code, orderId: order.id, productId: state.productId });
  });

  it("14. problem marker: PROBLEM из активного состояния, терминальные не переоткрываются", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "problem").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("PROBLEM");
    // PROBLEM остаётся активным (cancelable), но confirm/reject невалидны
    await bookingAction(b.id, "confirm").expect(409);
    await bookingAction(b.id, "cancel").expect(200); // PROBLEM → CANCELLED
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CANCELLED");
    // reopen terminal → 409
    await bookingAction(b.id, "problem").expect(409);
    await bookingAction(b.id, "send").expect(409);
  });

  // ─────────────────────────── NEGATIVE / SECURITY ──────────────────────────

  it("15. anonymous → 401; BUYER/PARTNER/MODERATOR/SALES_MANAGER → 403 на все lifecycle-команды", async () => {
    const buyer = await registerBuyer("s29buy");
    const partner = await createStaff("s29prt", "PARTNER");
    const moderator = await createStaff("s29mod", "MODERATOR");
    const sales = await createStaff("s29sm", "SALES_MANAGER");
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);

    const actions = ["prepare", "send", "requestClarification", "resume", "confirm", "reject", "service", "requestChange", "resolveChange", "requestCancellation", "complete", "cancel", "problem"];
    await request(app.getHttpServer()).patch(`/api/v1/bookings/${b.id}`).send({ action: "confirm" }).expect(401);
    for (const s of [buyer, partner, moderator, sales]) {
      for (const a of actions) {
        await bookingAction(b.id, a, s.accessToken).expect(403);
      }
    }
    // Ни одна запрещённая команда не применилась.
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("NEW");
  });

  it("16. unknown Booking → нейтральный 404; malformed action → 400; PATCH без action → 400", async () => {
    await bookingAction("00000000-0000-4000-8000-000000000000", "confirm").expect(404);
    await bookingAction("00000000-0000-4000-8000-000000000000", "cancel").expect(404);
    await adminAgent.patch("/api/v1/bookings/00000000-0000-4000-8000-000000000000").send({ action: "nonsense" }).expect(400);
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({}).expect(400);
  });

  it("17. forged server-owned поля (status/amount/acquisitionSource/temporal/provenance/version) → 422, переход не применяется", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect(b.status).toBe("NEW");
    await adminAgent
      .patch(`/api/v1/bookings/${b.id}`)
      .send({
        action: "send",
        status: "CONFIRMED",
        amount: 0.01,
        currency: "EUR",
        acquisitionSource: "MARKETPLACE",
        serviceDate: "2020-01-01",
        serviceTime: "10:00",
        serviceTimeZone: "Asia/Baku",
        serviceStartsAt: "2020-01-01T10:00:00.000Z",
        orderId: "forged",
        orderItemId: "forged",
        productId: "forged",
        version: 999,
        confirmedAt: "2020-01-01T00:00:00.000Z",
        createdAt: "2020-01-01T00:00:00.000Z",
      })
      .expect(422);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("NEW");
    expect(after.version).toBe(1);
    expect(String(after.amount)).toBe("100");
    expect(after.acquisitionSource).toBe("DIRECT");
    // PATCH без action (только forged) → 400
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({ status: "CONFIRMED" }).expect(400);
  });

  it("18. invalid transition → 409 (confirm из NEW, complete из NEW, confirm из COMPLETED, complete из CANCELLED) без state/history/event", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    for (const act of ["confirm", "reject", "complete", "service", "requestChange", "resolveChange", "requestCancellation"]) {
      await bookingAction(b.id, act).expect(409);
    }
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("NEW");
    expect(state.version).toBe(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    expect(hist.filter((h) => h.action !== "created")).toHaveLength(0);
    expect(typeCount(await bookingEventsFor(b.id), "BookingStatusChanged")).toBe(0);

    // Полный цикл до терминального COMPLETED → confirm из терминального → 409
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    await bookingAction(b.id, "confirm").expect(409);
    await bookingAction(b.id, "service").expect(409);
    // complete из CANCELLED → 409
    const b2 = (await fixtureOrder()).order;
    created.orders.push(b2.id);
    const c = await orderToBooking(b2.id);
    await bookingAction(c.id, "cancel").expect(200);
    await bookingAction(c.id, "complete").expect(409);
    await bookingAction(c.id, "send").expect(409);
    await bookingAction(c.id, "resume").expect(409);
  });

  it("19. PII отсутствует во всех lifecycle-событиях (Confirmed/Rejected/Cancelled/Completed/StatusChanged)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "requestChange").expect(200);
    await bookingAction(b.id, "resolveChange").expect(200);
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    const events = await bookingEventsFor(b.id);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      const raw = JSON.stringify(e.payload);
      expect(raw).not.toContain("passport");
      expect(raw).not.toContain("firstName");
      expect(raw).not.toContain("lastName");
      expect(raw).not.toContain("birthDate");
      expect(raw).not.toContain("email");
      expect(raw).not.toContain("phone");
    }
  });

  // ─────────────────────── BOOKING → ORDER FEEDBACK ─────────────────────────

  it("20. confirm → Order PARTIALLY_FULFILLED ТОЛЬКО через Order-owned reconcile (order history пишет subscriber)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SENT_TO_BOOKING");
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PARTIALLY_FULFILLED");
    // Order-история пишется Order-owned reconcile (action booking_confirmed),
    // НЕ Booking-сервисом — доказательство «no direct Order write» (§21).
    const orderHist = await prisma.orderHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(orderHist.some((h) => h.action === "booking_confirmed" && h.to === "PARTIALLY_FULFILLED")).toBe(true);
  });

  it("21. reject → Order PROBLEM (Order-owned); последующий complete брони не разблокирует PROBLEM", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "reject").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PROBLEM");
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderStatusChanged")).toBeGreaterThanOrEqual(1);
    const problemEv = events.find((e) => e.eventType === "OrderStatusChanged" && (e.payload as { to?: string })?.to === "PROBLEM")!;
    expect(problemEv).toBeDefined();
    expect(problemEv.causationId).not.toBeNull(); // SYSTEM reconcile от BookingRejected
  });

  it("22. completion feeding: single Booking complete → Order FULFILLED (all terminal), ровно одно OrderFulfilled", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("FULFILLED");
    expect(state.fulfilledAt).not.toBeNull();
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
  });

  it("23. multi-item: один COMPLETED ≠ Order fulfilled; все terminal → FULFILLED (без bookingCount>0 shortcut)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    expect(bookings).toHaveLength(2);

    // Обе confirm → PARTIALLY_FULFILLED
    for (const b of bookings) {
      await bookingAction(b.id, "send").expect(200);
      await bookingAction(b.id, "confirm").expect(200);
    }
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PARTIALLY_FULFILLED");

    // Одна завершена, вторая активна → НЕ FULFILLED
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200);
    let state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PARTIALLY_FULFILLED");
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);

    // Вторая тоже завершена → FULFILLED (все terminal)
    await bookingAction(bookings[1]!.id, "service").expect(200);
    await bookingAction(bookings[1]!.id, "complete").expect(200);
    state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("FULFILLED");
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1);
  });

  it("24. Booking-cancel НЕ трогает Order (BookingCancelled не подписан Order-ом): заказ остаётся SENT_TO_BOOKING, никакого OrderFulfilled", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "cancel").expect(200); // NEW → CANCELLED
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("SENT_TO_BOOKING"); // Order-статус НЕ меняется Booking-cancel-ом
    // Order-подписчик слушает ТОЛЬКО BookingConfirmed/BookingRejected/BookingStatusChanged;
    // BookingCancelled — booking-факт без Order-реакции (компенсация идёт от OrderCancelled).
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(0);
    // Единственный OrderStatusChanged — от команды `process` (NEW → IN_PROCESSING);
    // Booking-cancel НЕ добавил ни одного.
    expect(typeCount(events, "OrderStatusChanged")).toBe(1);
  });

  // ─────────────────────── COMPENSATION (Step 2.8 → 2.9) ───────────────────

  it("25. Order-cancel ПОСЛЕ Booking exists → активные Booking компенсируются (CANCELLED + history + BookingCancelled), без delete", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("SENT_TO_SUPPLIER");

    await orderAction(order.id, "cancel").expect(200);
    const orderState = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderState.status).toBe("CANCELLED");
    // Booking компенсирована: durable факт остаётся, статус терминальный CANCELLED.
    const bState = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(bState.status).toBe("CANCELLED");
    expect(bState.version).toBeGreaterThan(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: "asc" } });
    expect(hist.some((h) => h.action === "cancelled_order" && h.from === "SENT_TO_SUPPLIER" && h.to === "CANCELLED")).toBe(true);
    // canonical факт компенсации с корректной lineage
    const cancelled = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "BookingCancelled", aggregateId: b.id } });
    expect((cancelled.payload as { reason?: string }).reason).toBe("Заказ отменён");
    const orderCancelledEv = (await eventsFor(order.id)).find((e) => e.eventType === "OrderCancelled")!;
    expect(cancelled.causationId).toBe(orderCancelledEv.id);
    expect(cancelled.correlationId).toBe(orderCancelledEv.correlationId);
    // no hard delete
    expect(await prisma.booking.findUnique({ where: { id: b.id } })).not.toBeNull();
  });

  it("26. гонка (OrderCancelled обработан раньше BookingRequested): Booking создаётся сразу в CANCELLED (compensated state)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    // Order отменяется ДО создания Booking (send не выполнялся) → OrderCancelled
    // обработан первым: компенсация no-op (броней нет).
    await orderAction(order.id, "cancel").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect(await bookingsFor(order.id)).toHaveLength(0);
    // BookingRequested — durable факт, доставляется ПОЗЖЕ (stale/raced send): consumer
    // видит order CANCELLED → создаёт Booking СРАЗУ в компенсированном CANCELLED.
    await prisma.$transaction((tx) =>
      eventBus.emit(tx, {
        aggregateType: "Order",
        aggregateId: order.id,
        eventType: DomainEvents.BookingRequested,
        payload: { orderId: order.id, orderCode: order.code, customerId: null } as BookingRequestedPayload,
      }),
    );
    await eventBus.publishPending();
    const bookings = await bookingsFor(order.id);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.status).toBe("CANCELLED");
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: bookings[0]!.id } });
    expect(hist.some((h) => h.action === "created_cancelled" && h.to === "CANCELLED")).toBe(true);
    // BookingCreated result-факт всё равно существует (Booking создана)
    const createdEv = await prisma.outboxEvent.findFirst({ where: { eventType: "BookingCreated", aggregateId: bookings[0]!.id } });
    expect(createdEv).not.toBeNull();
    // НЕ было «cancelled»-события: перехода не было (создание сразу в терминале)
    expect(typeCount(await bookingEventsFor(bookings[0]!.id), "BookingCancelled")).toBe(0);
  });

  it("27. гонка (BookingRequested обработан раньше OrderCancelled): booking создана → компенсация отменяет её", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    // BookingRequested доставляется первым (normal send) — booking создана как NEW
    await orderAction(order.id, "send").expect(200);
    const b = (await bookingsFor(order.id))[0]!;
    expect(b.status).toBe("NEW");
    // Order отменяется ПОСЛЕ создания booking
    await orderAction(order.id, "cancel").expect(200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CANCELLED");
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: "asc" } });
    expect(hist.some((h) => h.action === "created" && h.to === "NEW")).toBe(true);
    expect(hist.some((h) => h.action === "cancelled_order" && h.to === "CANCELLED")).toBe(true);
    expect(typeCount(await bookingEventsFor(b.id), "BookingCancelled")).toBe(1);
  });

  it("28. терминальные Booking не перезаписываются компенсацией (COMPLETED остаётся), активные — отменяются", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    // Booking 1 → COMPLETED (terminal), Booking 2 → остаётся активной (CONFIRMED)
    await bookingAction(bookings[0]!.id, "send").expect(200);
    await bookingAction(bookings[0]!.id, "confirm").expect(200);
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200);
    await bookingAction(bookings[1]!.id, "send").expect(200);
    await bookingAction(bookings[1]!.id, "confirm").expect(200);

    await orderAction(order.id, "cancel").expect(200);
    const after = await bookingsFor(order.id);
    expect(after.find((b) => b.id === bookings[0]!.id)!.status).toBe("COMPLETED"); // terminal не трогается
    expect(after.find((b) => b.id === bookings[1]!.id)!.status).toBe("CANCELLED"); // активная компенсирована
    // ровно один BookingCancelled (для активной)
    const cancelledEvents = await prisma.outboxEvent.findMany({ where: { eventType: "BookingCancelled", aggregateId: { in: bookings.map((b) => b.id) } } });
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]!.aggregateId).toBe(bookings[1]!.id);
  });

  it("29. re-delivery OrderCancelled (inbox reset + PENDING) не дублирует компенсацию (idempotent)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await orderAction(order.id, "cancel").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
    const histBefore = (await prisma.bookingHistory.findMany({ where: { bookingId: b.id } })).length;
    const cancelledBefore = await prisma.outboxEvent.count({ where: { eventType: "BookingCancelled", aggregateId: b.id } });

    const ev = (await eventsFor(order.id)).find((e) => e.eventType === "OrderCancelled")!;
    await prisma.inboxEvent.deleteMany({ where: { consumerId: "booking-order-cancelled-consumer", eventId: ev.id } });
    await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
    expect((await prisma.bookingHistory.findMany({ where: { bookingId: b.id } })).length).toBe(histBefore);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingCancelled", aggregateId: b.id } })).toBe(cancelledBefore);
  });

  // ─────────────────────────── INVARIANTS ───────────────────────────────────

  it("30. frozen acquisition (DIRECT / BUYER_REQUEST / legacy null) immutable через полный lifecycle", async () => {
    const a = (await fixtureOrder()).order;
    created.orders.push(a.id);
    const ab = await orderToBooking(a.id);
    await bookingAction(ab.id, "send").expect(200);
    await bookingAction(ab.id, "confirm").expect(200);
    await bookingAction(ab.id, "service").expect(200);
    await bookingAction(ab.id, "complete").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: ab.id } })).acquisitionSource).toBe("DIRECT");

    const b = (await fixtureOrder({ acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST })).order;
    created.orders.push(b.id);
    const bb = await orderToBooking(b.id);
    expect(bb.acquisitionSource).toBe("BUYER_REQUEST");
    await bookingAction(bb.id, "cancel").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bb.id } })).acquisitionSource).toBe("BUYER_REQUEST");

    const c = (await fixtureOrder({ acquisitionSource: null })).order;
    created.orders.push(c.id);
    const cb = await orderToBooking(c.id);
    expect(cb.acquisitionSource).toBeNull();
    await bookingAction(cb.id, "send").expect(200);
    await bookingAction(cb.id, "confirm").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: cb.id } })).acquisitionSource).toBeNull();
  });

  it("31. money/currency + service occurrence immutable; никакого reprice/Finance-факта", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    for (const act of ["prepare", "send", "requestClarification", "resume", "confirm", "requestChange", "resolveChange", "service", "complete"] as const) {
      const st = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      const r = await bookingAction(b.id, act);
      expect([200, 409]).toContain(r.status);
      if (r.status === 200) {
        const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
        expect(String(after.amount)).toBe(String(before.amount));
        expect(after.serviceDate?.getTime()).toBe(before.serviceDate?.getTime());
        expect(after.serviceTime).toBe(before.serviceTime);
        expect(after.serviceEndTime).toBe(before.serviceEndTime);
        expect(after.serviceTimeZone).toBe(before.serviceTimeZone);
        expect(after.serviceTimeType).toBe(before.serviceTimeType);
        expect(after.serviceStartsAt?.getTime()).toBe(before.serviceStartsAt?.getTime());
        expect(after.serviceEndsAt?.getTime()).toBe(before.serviceEndsAt?.getTime());
      }
    }
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("COMPLETED");
    // никаких Finance-фактов (модуль payment в этой фазе не существует — проверяем отсутствие
    // событий/строк платежей по заказу)
    const payments = await prisma.outboxEvent.findMany({ where: { eventType: { contains: "Payment", mode: "insensitive" } } });
    expect(payments.filter((e) => (e.payload as { orderId?: string })?.orderId === order.id)).toHaveLength(0);
  });

  it("32. availability isolation: lifecycle не создаёт второй hold и не освобождает без owner-contract", async () => {
    const sm = await createStaff("s29av", "SALES_MANAGER");
    const fx = await createProduct("s29_avail");
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    const intent = (await agent(sm.accessToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.sales.push(sale.id);
    await agent(sm.accessToken).post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: sale.id } })).toBe(1);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    // Lifecycle (send→confirm→complete) НЕ создаёт/не освобождает holds (owner — Availability domain).
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: sale.id } })).toBe(1);
  });

  it("33. legacy Booking (orderItemId NULL) читаема/управляема; lifecycle работает", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const legacy = await prisma.booking.create({
      data: { code: `BKG-${stamp}-legacy`, orderId: order.id, productId: "00000000-0000-4000-8000-000000000001", status: "NEW", amount: 100, version: 1 },
      select: { id: true, code: true },
    });
    // legacy без orderItemId (до 2.8) — управляется lifecycle
    await bookingAction(legacy.id, "prepare").expect(200);
    await bookingAction(legacy.id, "send").expect(200);
    await bookingAction(legacy.id, "confirm").expect(200);
    const detail = (await adminAgent.get(`/api/v1/bookings/${legacy.id}`).expect(200)).body;
    expect(detail.status).toBe("CONFIRMED");
    expect(detail.orderItemId).toBeNull();
    expect(detail.acquisitionSource).toBeNull(); // legacy null — без fabrication
  });

  it("34. correlation/causation: HTTP-команды → correlation=server UUID, causation=null", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    const events = await bookingEventsFor(b.id);
    const commandEvents = events.filter((e) => ["BookingConfirmed", "BookingCompleted", "BookingStatusChanged"].includes(e.eventType));
    expect(commandEvents.length).toBeGreaterThan(0);
    for (const e of commandEvents) {
      expect(e.correlationId).toMatch(UUID_RE);
      expect(e.causationId).toBeNull();
    }
  });

  // ─────────────────────────── CONCURRENCY / CAS ────────────────────────────

  it("35. concurrent confirm vs reject: ровно один победитель, один canonical факт, без raw 500", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const results = await Promise.allSettled([bookingAction(b.id, "confirm"), bookingAction(b.id, "reject")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(["CONFIRMED", "SUPPLIER_REJECTED"]).toContain(state.status);
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingConfirmed") + typeCount(events, "BookingRejected")).toBe(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    const applied = hist.filter((h) => h.action === "confirm" || h.action === "reject");
    expect(new Set(applied.map((h) => `${h.action}:${h.from}->${h.to}`)).size).toBe(applied.length);
  });

  it("36. concurrent confirm vs cancel: ≤1 canonical эффект, детерминированный победитель", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const results = await Promise.allSettled([bookingAction(b.id, "confirm"), bookingAction(b.id, "cancel")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(["CONFIRMED", "CANCELLED"]).toContain(state.status);
    const events = await bookingEventsFor(b.id);
    const canonical = typeCount(events, "BookingConfirmed") + typeCount(events, "BookingCancelled");
    expect(canonical).toBeLessThanOrEqual(1);
    if (state.status === "CONFIRMED") expect(typeCount(events, "BookingConfirmed")).toBe(1);
    if (state.status === "CANCELLED") expect(typeCount(events, "BookingCancelled")).toBe(1);
  });

  it("37. concurrent complete vs cancel: один терминальный факт, без duplicate event", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200);
    const results = await Promise.allSettled([bookingAction(b.id, "complete"), bookingAction(b.id, "cancel")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(["COMPLETED", "CANCELLED"]).toContain(state.status);
    const events = await bookingEventsFor(b.id);
    const canonical = typeCount(events, "BookingCompleted") + typeCount(events, "BookingCancelled");
    expect(canonical).toBeLessThanOrEqual(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    expect(hist.filter((h) => h.action === "complete" || h.action === "cancel").length).toBeLessThanOrEqual(1);
  });

  it("38. rollback atomicity: неуспешный переход не оставляет state/history/event; все ошибки — контролируемые 4xx", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    const responses: number[] = [];
    for (const act of ["complete", "service", "confirm", "reject", "requestChange", "resolveChange", "requestCancellation", "resume"]) {
      const r = await bookingAction(b.id, act);
      responses.push(r.status);
    }
    expect(responses.every((s) => s >= 400 && s < 500)).toBe(true);
    expect(responses.every((s) => s !== 500)).toBe(true);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("NEW");
    expect(state.version).toBe(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    expect(hist.filter((h) => h.action !== "created")).toHaveLength(0);
    const events = await bookingEventsFor(b.id);
    expect(typeCount(events, "BookingStatusChanged")).toBe(0);
    expect(typeCount(events, "BookingConfirmed")).toBe(0);
  });

  it("39. duplicate event delivery (consumer replay) для BookingRequested не дублирует Booking; Order-команды не падают в 500", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(1);
    const before = await prisma.outboxEvent.count({ where: { eventType: "BookingCreated" } });
    const req = (await eventsFor(order.id)).find((e) => e.eventType === "BookingRequested")!;
    await prisma.inboxEvent.deleteMany({ where: { consumerId: "booking-requested-consumer", eventId: req.id } });
    await prisma.outboxEvent.update({ where: { id: req.id }, data: { status: "PENDING" } });
    await eventBus.publishPending();
    expect(await bookingsFor(order.id)).toHaveLength(1);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingCreated" } })).toBe(before);
  });

  it("41. STRICT REVIEW §28: order-status guard — lifecycle-команды на брони отменённого заказа → 409 (кроме cancel)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await orderAction(order.id, "cancel").expect(200); // order CANCELLED → компенсация отменила бронь
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");

    // Любая «оживляющая» команда на брони отменённого заказа → 409 (детерминированно).
    for (const act of ["prepare", "send", "requestClarification", "resume", "confirm", "reject", "service", "requestChange", "resolveChange", "requestCancellation", "complete", "problem"]) {
      await bookingAction(b.id, act).expect(409);
    }
    // cancel остаётся разрешён (безопасный valve — no-op на терминальной брони).
    await bookingAction(b.id, "cancel").expect(409); // уже CANCELLED → from-guard
    // состояние не изменилось; новых событий/истории нет
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
  });

  it("42. STRICT REVIEW §28: compensation-vs-confirm race — детерминированный победитель, активная бронь под отменённым заказом невозможна", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);

    const results = await Promise.allSettled([orderAction(order.id, "cancel"), bookingAction(b.id, "confirm")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const orderState = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderState.status).toBe("CANCELLED"); // cancel всегда выигрывает на уровне Order
    // Инвариант §15: бронь НЕ остаётся активной (либо confirm проиграл CAS/guard → 409,
    // либо confirm успел → компенсация отменила). В обоих сериализациях — CANCELLED.
    const bState = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(bState.status).toBe("CANCELLED");
    expect(typeCount(await bookingEventsFor(b.id), "BookingConfirmed")).toBeLessThanOrEqual(1);
    expect(typeCount(await bookingEventsFor(b.id), "BookingCancelled")).toBeLessThanOrEqual(1);
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    const applied = hist.filter((h) => h.action === "confirm" || h.action === "cancelled_order");
    expect(new Set(applied.map((h) => `${h.action}:${h.from}->${h.to}`)).size).toBe(applied.length);
  });

  it("43. STRICT REVIEW §28: compensation-vs-complete race — терминальная бронь не перезаписывается, активная компенсируется", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "service").expect(200); // IN_SERVICE

    const results = await Promise.allSettled([orderAction(order.id, "cancel"), bookingAction(b.id, "complete")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const bState = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    // complete выиграл (COMPLETED — терминал) или компенсация выиграла (CANCELLED).
    // Никогда — активное состояние под отменённым заказом.
    expect(["COMPLETED", "CANCELLED"]).toContain(bState.status);
    const events = await bookingEventsFor(b.id);
    const canonical = typeCount(events, "BookingCompleted") + typeCount(events, "BookingCancelled");
    expect(canonical).toBeLessThanOrEqual(1);
    if (bState.status === "COMPLETED") expect(typeCount(events, "BookingCompleted")).toBe(1);
    if (bState.status === "CANCELLED") expect(typeCount(events, "BookingCancelled")).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });

  // ─────────────── STRICT REVIEW §46 — MANDATORY Order reconciliation matrix ───────────────

  it("44. M1 confirmed+NEW → PARTIALLY_FULFILLED (подтверждение — прогресс, не fulfillment)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    await bookingAction(bookings[0]!.id, "send").expect(200);
    await bookingAction(bookings[0]!.id, "confirm").expect(200); // confirmed + NEW
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PARTIALLY_FULFILLED"); // inherited-approved 2.5A: anyConfirmed → partial
    expect(state.fulfilledAt).toBeNull();
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);
  });

  it("45. M2 completed+confirmed → PARTIALLY_FULFILLED (одна исполнена, вторая нет)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    for (const b of bookings) {
      await bookingAction(b.id, "send").expect(200);
      await bookingAction(b.id, "confirm").expect(200);
    }
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200); // completed + confirmed
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PARTIALLY_FULFILLED");
    expect(state.fulfilledAt).toBeNull();
  });

  it("46. M3 completed+rejected → PROBLEM (одна rejection ставит весь заказ в PROBLEM — inherited 1.14)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    await bookingAction(bookings[0]!.id, "send").expect(200);
    await bookingAction(bookings[0]!.id, "confirm").expect(200);
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200);
    await bookingAction(bookings[1]!.id, "send").expect(200);
    await bookingAction(bookings[1]!.id, "reject").expect(200); // completed + rejected
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PROBLEM");
  });

  it("47. M4 completed+cancelled → FULFILLED (все booking-work resolved; cancel не триггерит reconcile — complete последним)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    await bookingAction(bookings[0]!.id, "cancel").expect(200); // cancelled (no reconcile)
    await bookingAction(bookings[1]!.id, "send").expect(200);
    await bookingAction(bookings[1]!.id, "confirm").expect(200);
    await bookingAction(bookings[1]!.id, "service").expect(200);
    await bookingAction(bookings[1]!.id, "complete").expect(200); // completed last → reconcile: all terminal → FULFILLED
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("FULFILLED");
    expect(state.fulfilledAt).not.toBeNull();
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1);
  });

  it("48. M5 all completed → FULFILLED (все услуги исполнены)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    for (const b of bookings) {
      await bookingAction(b.id, "send").expect(200);
      await bookingAction(b.id, "confirm").expect(200);
      await bookingAction(b.id, "service").expect(200);
      await bookingAction(b.id, "complete").expect(200);
    }
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("FULFILLED");
    expect(state.fulfilledAt).not.toBeNull();
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1); // ровно один canonical факт
  });

  it("49. M6 all rejected → PROBLEM (rejection drives Order PROBLEM; не FULFILLED)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    for (const b of bookings) {
      await bookingAction(b.id, "send").expect(200);
      await bookingAction(b.id, "reject").expect(200);
    }
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PROBLEM"); // не FULFILLED
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);
  });

  it("50. M7 all cancelled → Order остаётся SENT_TO_BOOKING (BookingCancelled не подписан Order-ом; НЕ FULFILLED)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    for (const b of bookings) {
      await bookingAction(b.id, "cancel").expect(200);
    }
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("SENT_TO_BOOKING"); // cancel не триггерит reconcile (inherited 2.5A)
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);
    // Инвариант: никакого FULFILLED для cancelled-only заказа (cancelled ≠ delivered).
    expect(state.fulfilledAt).toBeNull();
  });

  it("51. M8 completed+rejected+cancelled → PROBLEM (rejection доминирует; reconcile из PROBLEM не выводит)", async () => {
    const order = (await fixtureOrder({
      items: [
        { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
        { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
        { productId: "00000000-0000-4000-8000-000000000003", title: "Hotel", type: "HOTEL", quantity: 1, price: 200 },
      ],
      travelers: [
        { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
        { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
      ],
    })).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    await orderAction(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    await bookingAction(bookings[0]!.id, "send").expect(200);
    await bookingAction(bookings[0]!.id, "confirm").expect(200);
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200);
    await bookingAction(bookings[1]!.id, "send").expect(200);
    await bookingAction(bookings[1]!.id, "reject").expect(200); // → Order PROBLEM
    await bookingAction(bookings[2]!.id, "cancel").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("PROBLEM"); // PROBLEM не перезаписывается reconcile
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);
  });

  it("40. legacy AcquisitionSource null + full lifecycle: никакого fabrication в событиях/истории", async () => {
    const order = (await fixtureOrder({ acquisitionSource: null })).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect(b.acquisitionSource).toBeNull();
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "complete").expect(409); // из CONFIRMED невалидно — валидный путь ниже
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.acquisitionSource).toBeNull();
    expect(after.status).toBe("COMPLETED");
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    expect(hist.every((h) => !String(h.comment).includes("DIRECT"))).toBe(true);
  });
});
