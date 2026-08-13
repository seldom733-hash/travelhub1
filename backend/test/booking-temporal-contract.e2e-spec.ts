/**
 * E2E PHASE 2 STEP 2.9A — Booking Temporal Contract.
 *
 * Доказывает (§40–42 implementation prompt) canonical lifecycle milestones:
 *  - server-owned UTC instants, immutable (first-transition-only), атомарны с
 *    CAS (status+version+milestone+history+outbox);
 *  - requestedAt = transition `send` → SENT_TO_SUPPLIER (запрос поставщику),
 *    НЕ createdAt и НЕ BookingRequested receipt;
 *  - confirmedAt/rejectedAt/cancelledAt/completedAt — только реальные переходы;
 *  - компенсация OrderCancelled → cancelledAt атомарно с CAS;
 *  - born-CANCELLED (OrderCancelled раньше BookingRequested) → cancelledAt ==
 *    createdAt (Booking создана уже отменённой), requestedAt NULL, без
 *    BookingCancelled-события (approved 2.9);
 *  - lifecycle время ≠ service occurrence время (2.8A — никогда не выводится,
 *    никогда не мутируется);
 *  - forged temporal → 422 (масс-ассигнмент); retry не перезаписывает;
 *  - legacy null milestones читаемы; ноль Availability/Finance/service-time
 *    side effects; correlation/causation не меняются; concurrency — один
 *    победитель с корректным milestone.
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

const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("Phase 2 Step 2.9A — Booking Temporal Contract (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: { users: string[]; customers: string[]; orders: string[] } = { users: [], customers: [], orders: [] };

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

  const fixtureOrder = (overrides: Partial<FixtureOrderInput> = {}) =>
    createFixtureOrder(prisma, ids, eventBus, {
      customerId: null,
      currency: "USD",
      items: [{ productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 }],
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" }],
      ...overrides,
    });

  const orderAction = (orderId: string, act: string) => adminAgent.patch(`/api/v1/orders/${orderId}`).send({ action: act });
  const bookingAction = (bookingId: string, act: string, token?: string) => {
    const a = token ? agent(token) : adminAgent;
    return a.patch(`/api/v1/bookings/${bookingId}`).send({ action: act });
  };
  const bookingsFor = (orderId: string) => prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const bookingEventsFor = async (bookingId: string) => prisma.outboxEvent.findMany({ where: { aggregateId: bookingId }, orderBy: { createdAt: "asc" } });
  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;
  const orderToBooking = async (orderId: string) => {
    await orderAction(orderId, "process").expect(200);
    await orderAction(orderId, "confirm").expect(200);
    await orderAction(orderId, "send").expect(200);
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
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ─────────────────────── LIFECYCLE TEMPORAL MATRIX (§40) ──────────────────

  it("1. creation: NEW — только creation fact; все milestones NULL (без fake confirm/cancel/completion)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("NEW");
    expect(state.requestedAt).toBeNull();
    expect(state.confirmedAt).toBeNull();
    expect(state.rejectedAt).toBeNull();
    expect(state.cancelledAt).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.createdAt).not.toBeNull();
  });

  it("2. requestedAt: устанавливается на `send` (запрос поставщику), НЕ на создание; resume не перезаписывает", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    expect(b.requestedAt).toBeNull();
    const createdTs = b.createdAt.getTime();
    await bookingAction(b.id, "send").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.requestedAt).not.toBeNull();
    expect(state.requestedAt!.toISOString()).toMatch(UTC_ISO_RE);
    expect(state.requestedAt!.getTime()).toBeGreaterThanOrEqual(createdTs);
    const firstRequested = state.requestedAt!.getTime();
    // clarify → resume: requestedAt остаётся (first-only), не сдвигается
    await bookingAction(b.id, "requestClarification").expect(200);
    await bookingAction(b.id, "resume").expect(200);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.requestedAt!.getTime()).toBe(firstRequested);
    // прочие milestones NULL
    expect(state.confirmedAt).toBeNull();
    expect(state.rejectedAt).toBeNull();
    expect(state.cancelledAt).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it("3. confirmedAt: только на реальный confirm → CONFIRMED, ровно один раз", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    let state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.confirmedAt).not.toBeNull();
    expect(state.confirmedAt!.toISOString()).toMatch(UTC_ISO_RE);
    const first = state.confirmedAt!.getTime();
    // retry confirm → 409; milestone не меняется
    await bookingAction(b.id, "confirm").expect(409);
    state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.confirmedAt!.getTime()).toBe(first);
    expect(state.rejectedAt).toBeNull(); // reject milestone не проставлен
    expect(state.cancelledAt).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it("4. rejectedAt: только на реальный reject → SUPPLIER_REJECTED; cancelledAt НЕ используется для rejection", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "reject").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("SUPPLIER_REJECTED");
    expect(state.rejectedAt).not.toBeNull();
    expect(state.rejectedAt!.toISOString()).toMatch(UTC_ISO_RE);
    expect(state.cancelledAt).toBeNull(); // rejection ≠ cancellation
    expect(state.confirmedAt).toBeNull();
    expect(state.completedAt).toBeNull();
    await bookingAction(b.id, "reject").expect(409); // терминал
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.rejectedAt!.getTime()).toBe(state.rejectedAt!.getTime());
  });

  it("5. completedAt: только на реальный IN_SERVICE → COMPLETED; никакого inference из serviceEndsAt", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).completedAt).toBeNull();
    // complete из CONFIRMED → 409, без milestone
    await bookingAction(b.id, "complete").expect(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).completedAt).toBeNull();
    await bookingAction(b.id, "service").expect(200);
    await bookingAction(b.id, "complete").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("COMPLETED");
    expect(state.completedAt).not.toBeNull();
    expect(state.completedAt!.toISOString()).toMatch(UTC_ISO_RE);
    expect(state.cancelledAt).toBeNull();
    // retry → 409, не перезаписывается
    await bookingAction(b.id, "complete").expect(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).completedAt!.getTime()).toBe(state.completedAt!.getTime());
  });

  it("6. explicit cancel → cancelledAt ровно один раз", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    await bookingAction(b.id, "confirm").expect(200);
    await bookingAction(b.id, "requestCancellation").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).cancelledAt).toBeNull(); // marker — не milestone
    await bookingAction(b.id, "cancel").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CANCELLED");
    expect(state.cancelledAt).not.toBeNull();
    const first = state.cancelledAt!.getTime();
    await bookingAction(b.id, "cancel").expect(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).cancelledAt!.getTime()).toBe(first);
  });

  it("7. компенсация OrderCancelled → cancelledAt атомарно с CAS (multi-item: каждая реально отменённая бронь)", async () => {
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
    // b0 → COMPLETED (терминал — не трогается компенсацией), b1 → активная
    await bookingAction(bookings[0]!.id, "send").expect(200);
    await bookingAction(bookings[0]!.id, "confirm").expect(200);
    await bookingAction(bookings[0]!.id, "service").expect(200);
    await bookingAction(bookings[0]!.id, "complete").expect(200);
    await bookingAction(bookings[1]!.id, "send").expect(200);
    await bookingAction(bookings[1]!.id, "confirm").expect(200);

    await orderAction(order.id, "cancel").expect(200);
    const b0 = await prisma.booking.findUniqueOrThrow({ where: { id: bookings[0]!.id } });
    const b1 = await prisma.booking.findUniqueOrThrow({ where: { id: bookings[1]!.id } });
    expect(b0.status).toBe("COMPLETED");
    expect(b0.completedAt).not.toBeNull();
    expect(b0.cancelledAt).toBeNull(); // терминал не перезаписывается
    expect(b1.status).toBe("CANCELLED");
    expect(b1.cancelledAt).not.toBeNull();
    expect(b1.cancelledAt!.toISOString()).toMatch(UTC_ISO_RE);
    // lineage: BookingCancelled causation = OrderCancelled
    const cancelled = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "BookingCancelled", aggregateId: b1.id } });
    const orderCancelled = (await prisma.outboxEvent.findMany({ where: { aggregateId: order.id } })).find((e) => e.eventType === "OrderCancelled")!;
    expect(cancelled.causationId).toBe(orderCancelled.id);
    expect(cancelled.correlationId).toBe(orderCancelled.correlationId);
    // history согласована
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b1.id }, orderBy: { createdAt: "asc" } });
    expect(hist.some((h) => h.action === "cancelled_order" && h.to === "CANCELLED")).toBe(true);
  });

  it("8. born-CANCELLED: cancelledAt == createdAt (Booking создана уже отменённой), requestedAt NULL, без BookingCancelled", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await orderAction(order.id, "process").expect(200);
    await orderAction(order.id, "confirm").expect(200);
    // Order отменён ДО создания Booking
    await orderAction(order.id, "cancel").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(0);
    // durable BookingRequested доставляется позже
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
    const b = bookings[0]!;
    expect(b.status).toBe("CANCELLED");
    expect(b.cancelledAt).not.toBeNull();
    expect(b.cancelledAt!.getTime()).toBe(b.createdAt.getTime()); // один instant создания
    expect(b.requestedAt).toBeNull(); // поставщику не отправлялся
    expect(b.confirmedAt).toBeNull();
    expect(b.completedAt).toBeNull();
    expect(b.rejectedAt).toBeNull();
    // history: created_cancelled; НЕ было BookingCancelled (перехода не было)
    const hist = await prisma.bookingHistory.findMany({ where: { bookingId: b.id } });
    expect(hist.some((h) => h.action === "created_cancelled" && h.to === "CANCELLED")).toBe(true);
    expect(typeCount(await bookingEventsFor(b.id), "BookingCancelled")).toBe(0);
    // BookingCreated result-факт существует
    expect(await prisma.outboxEvent.findFirst({ where: { eventType: "BookingCreated", aggregateId: b.id } })).not.toBeNull();
  });

  // ─────────────────────────── NEGATIVE (§41) ───────────────────────────────

  it("9. forged milestones (requestedAt/confirmedAt/rejectedAt/cancelledAt/completedAt) → 422, state/version не меняются", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    for (const field of ["requestedAt", "confirmedAt", "rejectedAt", "cancelledAt", "completedAt"]) {
      const res = await adminAgent
        .patch(`/api/v1/bookings/${b.id}`)
        .send({ action: "confirm", [field]: "2026-01-01T00:00:00.000Z" })
        .expect(422);
      expect(res.body.message).toBeDefined();
    }
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("SENT_TO_SUPPLIER"); // переход не применён
    expect(after.version).toBe(2); // send (v1→v2); confirm ни разу не применился
    expect(after.confirmedAt).toBeNull();
    expect(after.requestedAt).not.toBeNull(); // только от реального send
    expect(typeCount(await bookingEventsFor(b.id), "BookingConfirmed")).toBe(0);
  });

  it("10. failed transitions не ставят milestones; retry не перезаписывает; BUYER/PARTNER/MODERATOR → 403", async () => {
    const buyer = await registerBuyer("s29a_buy");
    const partner = await createStaff("s29a_prt", "PARTNER");
    const moderator = await createStaff("s29a_mod", "MODERATOR");
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    // failed transitions (from NEW): confirm/reject/complete/cancel → 409 без milestone
    await bookingAction(b.id, "confirm").expect(409);
    await bookingAction(b.id, "reject").expect(409);
    await bookingAction(b.id, "complete").expect(409);
    await bookingAction(b.id, "cancel").expect(200); // cancel валиден из NEW → CANCELLED
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.confirmedAt).toBeNull();
    expect(state.rejectedAt).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.cancelledAt).not.toBeNull();
    // retry не перезаписывает
    const first = state.cancelledAt!.getTime();
    await bookingAction(b.id, "cancel").expect(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).cancelledAt!.getTime()).toBe(first);
    // роли без прав — 403, milestones не трогаются
    const b2 = (await fixtureOrder()).order;
    created.orders.push(b2.id);
    const b2row = await orderToBooking(b2.id);
    for (const s of [buyer, partner, moderator]) {
      await bookingAction(b2row.id, "confirm", s.accessToken).expect(403);
    }
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b2row.id } })).confirmedAt).toBeNull();
  });

  it("11. malformed timestamp не обходит forbidden-key защиту; legacy null milestone читаемы", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({ action: "send", confirmedAt: "not-a-date" }).expect(422);
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({ action: "send", confirmedAt: 12345 }).expect(422);
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({ action: "send", confirmedAt: { nested: true } }).expect(422);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("NEW");
    expect(state.confirmedAt).toBeNull();
    // legacy null milestone строка читаема
    const legacy = await prisma.booking.create({
      data: { code: `BKG-${stamp}-legacy-t`, orderId: order.id, productId: "00000000-0000-4000-8000-000000000001", status: "CONFIRMED", amount: 100, version: 1 },
      select: { id: true, code: true },
    });
    const detail = (await adminAgent.get(`/api/v1/bookings/${legacy.id}`).expect(200)).body;
    expect(detail.status).toBe("CONFIRMED");
    expect(detail.confirmedAt).toBeNull(); // без backfill
    expect(detail.requestedAt).toBeNull();
    expect(detail.cancelledAt).toBeNull();
  });

  it("12. timeline: milestones — UTC instants, сервер-generated; события/history/milestone — один логический переход", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.requestedAt!.toISOString()).toMatch(UTC_ISO_RE);
    const requestedTs = state.requestedAt!.getTime();
    const history = await prisma.bookingHistory.findMany({ where: { bookingId: b.id, action: "send" } });
    expect(history).toHaveLength(1);
    // history.createdAt и milestone — одна логическая транзакция (не требуем ms-неравенства, §39)
    expect(history[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(state.createdAt.getTime());
    // событие BookingStatusChanged принадлежит тому же переходу
    const statusEv = (await bookingEventsFor(b.id)).find((e) => e.eventType === "BookingStatusChanged" && (e.payload as { to?: string })?.to === "SENT_TO_SUPPLIER")!;
    expect(statusEv).toBeDefined();
    expect(statusEv.createdAt.getTime()).toBeGreaterThanOrEqual(requestedTs - 1000); // один logical transition
    // milestone ≠ service occurrence (frozen 2.8A не тронут)
    expect(state.serviceStartsAt).toBeNull(); // date-only fixture
    expect(state.serviceTimeType).toBe("OPEN_DATE");
  });

  // ─────────────────────────── CONCURRENCY (§38) ────────────────────────────

  it("13. concurrent confirm/confirm: один победитель, один confirmedAt, без противоречивых milestone", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const results = await Promise.allSettled([bookingAction(b.id, "confirm"), bookingAction(b.id, "confirm")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.filter((s) => s === 200).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.status).toBe("CONFIRMED");
    expect(state.confirmedAt).not.toBeNull();
    expect(typeCount(await bookingEventsFor(b.id), "BookingConfirmed")).toBe(1);
  });

  it("14. concurrent confirm/reject: один победитель — только его milestone; loser не оставляет противоречивый timestamp", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const results = await Promise.allSettled([bookingAction(b.id, "confirm"), bookingAction(b.id, "reject")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    if (state.status === "CONFIRMED") {
      expect(state.confirmedAt).not.toBeNull();
      expect(state.rejectedAt).toBeNull();
    } else {
      expect(state.status).toBe("SUPPLIER_REJECTED");
      expect(state.rejectedAt).not.toBeNull();
      expect(state.confirmedAt).toBeNull();
    }
  });

  it("15. concurrent confirm/cancel и complete/cancel: один терминальный milestone, без raw 500", async () => {
    const a = (await fixtureOrder()).order;
    created.orders.push(a.id);
    const ba = await orderToBooking(a.id);
    await bookingAction(ba.id, "send").expect(200);
    const r1 = await Promise.allSettled([bookingAction(ba.id, "confirm"), bookingAction(ba.id, "cancel")]);
    const s1 = r1.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(s1.every((s) => s === 200 || s === 409)).toBe(true);
    const sa = await prisma.booking.findUniqueOrThrow({ where: { id: ba.id } });
    expect(["CONFIRMED", "CANCELLED"]).toContain(sa.status);
    expect(sa.confirmedAt !== null || sa.cancelledAt !== null).toBe(true);
    expect(sa.confirmedAt !== null && sa.cancelledAt !== null).toBe(false); // не оба

    const c = (await fixtureOrder()).order;
    created.orders.push(c.id);
    const bc = await orderToBooking(c.id);
    await bookingAction(bc.id, "send").expect(200);
    await bookingAction(bc.id, "confirm").expect(200);
    await bookingAction(bc.id, "service").expect(200);
    const r2 = await Promise.allSettled([bookingAction(bc.id, "complete"), bookingAction(bc.id, "cancel")]);
    const s2 = r2.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(s2.every((s) => s === 200 || s === 409)).toBe(true);
    const sc = await prisma.booking.findUniqueOrThrow({ where: { id: bc.id } });
    expect(["COMPLETED", "CANCELLED"]).toContain(sc.status);
    expect(sc.completedAt !== null || sc.cancelledAt !== null).toBe(true);
    expect(sc.completedAt !== null && sc.cancelledAt !== null).toBe(false);
  });

  it("16. compensation/confirm race: детерминированный результат, cancelledAt один раз, без raw 500", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await bookingAction(b.id, "send").expect(200);
    const results = await Promise.allSettled([orderAction(order.id, "cancel"), bookingAction(b.id, "confirm")]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<request.Response>).value.status : 500));
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    // Инвариант: активная бронь под отменённым заказом невозможна (guard + компенсация).
    expect(state.status).toBe("CANCELLED");
    expect(state.cancelledAt).not.toBeNull();
    // Детерминизм: два возможных честных interleaving — confirm проиграл (confirmedAt=null)
    // или confirm выиграл гонку и компенсация отменила позже (confirmedAt <= cancelledAt).
    // Противоречивой пары (confirmedAt после cancelledAt) быть не может.
    if (state.confirmedAt) {
      expect(state.confirmedAt.getTime()).toBeLessThanOrEqual(state.cancelledAt!.getTime());
    }
    expect(typeCount(await bookingEventsFor(b.id), "BookingCancelled")).toBeLessThanOrEqual(1);
  });

  it("17. duplicate compensation replay не меняет cancelledAt; no Finance/Availability/service-time side effects", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    const b = await orderToBooking(order.id);
    await orderAction(order.id, "cancel").expect(200);
    const state = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(state.cancelledAt).not.toBeNull();
    const first = state.cancelledAt!.getTime();
    const histBefore = (await prisma.bookingHistory.findMany({ where: { bookingId: b.id } })).length;
    const cancelledBefore = await prisma.outboxEvent.count({ where: { eventType: "BookingCancelled", aggregateId: b.id } });

    const ev = (await prisma.outboxEvent.findMany({ where: { aggregateId: order.id } })).find((e) => e.eventType === "OrderCancelled")!;
    await prisma.inboxEvent.deleteMany({ where: { consumerId: "booking-order-cancelled-consumer", eventId: ev.id } });
    await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.cancelledAt!.getTime()).toBe(first); // replay не меняет milestone
    expect((await prisma.bookingHistory.findMany({ where: { bookingId: b.id } })).length).toBe(histBefore);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingCancelled", aggregateId: b.id } })).toBe(cancelledBefore);
    // ноль Availability/Finance side effects
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: { in: [] } } })).toBe(0); // нет продаж в этом suite — факт отсутствия записей
    const payments = await prisma.outboxEvent.findMany({ where: { eventType: { contains: "Payment", mode: "insensitive" } } });
    expect(payments.filter((e) => (e.payload as { orderId?: string })?.orderId === order.id)).toHaveLength(0);
  });

  it("18. acquisition frozen (DIRECT/BUYER_REQUEST/null) + service occurrence не тронуты milestones", async () => {
    for (const src of [SalesAcquisitionSource.DIRECT, SalesAcquisitionSource.BUYER_REQUEST, null] as const) {
      const order = (await fixtureOrder({ acquisitionSource: src, serviceDate: "2026-09-01", serviceTime: "10:30", serviceTimeZone: "Asia/Baku" })).order;
      created.orders.push(order.id);
      const b = await orderToBooking(order.id);
      const before = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(before.acquisitionSource).toBe(src);
      await bookingAction(b.id, "send").expect(200);
      await bookingAction(b.id, "confirm").expect(200);
      await bookingAction(b.id, "service").expect(200);
      await bookingAction(b.id, "complete").expect(200);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(after.acquisitionSource).toBe(src);
      expect(String(after.amount)).toBe(String(before.amount));
      expect(after.serviceDate?.getTime()).toBe(before.serviceDate?.getTime());
      expect(after.serviceTime).toBe(before.serviceTime);
      expect(after.serviceTimeZone).toBe(before.serviceTimeZone);
      expect(after.serviceStartsAt?.getTime()).toBe(before.serviceStartsAt?.getTime());
      expect(after.serviceEndsAt?.getTime()).toBe(before.serviceEndsAt?.getTime());
      expect(after.serviceTimeType).toBe(before.serviceTimeType);
      expect(after.completedAt).not.toBeNull();
    }
  });
});
