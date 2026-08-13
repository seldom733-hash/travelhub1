/**
 * E2E Phase 1 Step 1.14 — Canonical Order Events (strict implementation §21).
 *
 * Доказывает фактическую семантику:
 *  - OrderReadyForBooking публикуется ровно при transition confirm (→ READY_FOR_BOOKING),
 *    НЕ раньше, НЕ повторно; payload — минимальный {orderId, code, customerId};
 *  - OrderFulfilled — только при реальном fulfillment: прямой `complete` И
 *    reconcileOrder по терминальным броням; unrelated update не публикует;
 *  - OrderClosed — только при close; fulfilled ≠ closed; cancelled ≠ closed;
 *  - retry/duplicate/concurrent переход не создаёт второй logical canonical event
 *    (optimistic concurrency updateMany + from-guard);
 *  - atomicity: state + OrderHistory + OutboxEvent согласованы в одной транзакции;
 *  - generic OrderStatusChanged остаётся только для технических переходов;
 *  - consumer dedup: повторная доставка BookingRequested не дублирует Booking.
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
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

describe("Phase 1 Step 1.14 — Canonical Order Events (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let http: request.Agent;

  const stamp = Date.now();
  const productIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];

  let productId: string;
  let customerId: string;

  // Step 2.6: test-only fixture вместо удалённого POST /orders/bootstrap.
  const fixtureOrder = (overrides: Partial<FixtureOrderInput> = {}) =>
    createFixtureOrder(prisma, ids, eventBus, {
      customerId,
      currency: "USD",
      items: [{ productId, title: "Tour", type: "TOUR", quantity: 1, price: 100 }],
      travelers: [{ firstName: "А", lastName: "Б", birthDate: "1990-05-01", passportNumber: "P1234567" }],
      ...overrides,
    });

  const action = (orderId: string, act: string) => http.patch(`/api/v1/orders/${orderId}`).send({ action: act });

  const eventsFor = async (orderId: string) =>
    prisma.outboxEvent.findMany({ where: { aggregateId: orderId }, orderBy: { createdAt: "asc" } });

  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;

  /** Штатный полный цикл: send booking → подтвердить/завершить бронь (reconcile). */
  const fulfillViaBooking = async (orderId: string) => {
    await action(orderId, "send").expect(200);
    const bookingId = (await http.get(`/api/v1/bookings?orderId=${orderId}`).expect(200)).body.items[0].id;
    for (const a of ["send", "confirm", "service", "complete"]) {
      await http.patch(`/api/v1/bookings/${bookingId}`).send({ action: a }).expect(200);
    }
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

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    http = request.agent(app.getHttpServer());
    http.set("Authorization", `Bearer ${login.body.accessToken}`);

    const product = (await http.post("/api/v1/products").send({ type: "TOUR", title: `Canon ${stamp}` }).expect(201)).body.product;
    productIds.push(product.id);
    productId = product.id;
    await http.post(`/api/v1/products/${productId}/publish`).expect(201);

    const customer = (await http.post("/api/v1/customers").send({ type: "PERSON", firstName: "А", lastName: "Б", email: `canon${stamp}@test.local` }).expect(201)).body.customer;
    customerIds.push(customer.id);
    customerId = customer.id;
  });

  afterAll(async () => {
    const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: orderIds } }, select: { id: true } })).map((e) => e.id);
    await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: orderIds } } });
    // Shared-DB isolation (STRICT REVIEW 2.5B): child BookingCreated имеет
    // aggregateId = bookingId (НЕ orderId) — вычищаем по payload.orderId.
    if (orderIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: { eventType: "BookingCreated", OR: orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })) },
      });
    }
    await prisma.booking.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await app.close();
  });

  it("1. OrderReadyForBooking: не публикуется до confirm, ровно один раз при confirm; payload минимальный", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);

    // До confirm — только OrderCreated + технический OrderStatusChanged на process.
    await action(order.id, "process").expect(200);
    let types = (await eventsFor(order.id)).map((e) => e.eventType);
    expect(types).toContain("OrderCreated");
    expect(types).not.toContain("OrderReadyForBooking");

    // confirm → ровно одно OrderReadyForBooking.
    await action(order.id, "confirm").expect(200);
    const events = await eventsFor(order.id);
    types = events.map((e) => e.eventType);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);

    // Payload whitelist: только orderId/code/customerId; никакого PII/raw-дампов.
    const ready = events.find((e) => e.eventType === "OrderReadyForBooking")!;
    expect(ready.payload).toEqual({ orderId: order.id, code: order.code, customerId });
    const raw = JSON.stringify(ready.payload);
    expect(raw).not.toContain("email");
    expect(raw).not.toContain("phone");
    expect(raw).not.toContain("passportNumber");
    expect(raw).not.toContain("firstName");

    // Atomicity: state + history согласованы с outbox.
    const state = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state!.status).toBe("READY_FOR_BOOKING");
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.some((h) => h.action === "confirm" && h.from === "IN_PROCESSING" && h.to === "READY_FOR_BOOKING")).toBe(true);

    // §23.6: confirm ALONE (без send) НЕ создаёт Booking — Booking только по BookingRequested.
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(0);
    const afterConfirm = (await eventsFor(order.id)).map((e) => e.eventType);
    expect(afterConfirm).not.toContain("BookingRequested");
  });

  it("2. retry/duplicate confirm → 409 и НЕ создаёт второй OrderReadyForBooking", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "confirm").expect(409); // from-guard
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);
  });

  it("3. concurrent confirm: ровно один выигрывает, одно OrderReadyForBooking (optimistic concurrency)", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    const results = await Promise.allSettled([action(order.id, "confirm"), action(order.id, "confirm")]);
    const fulfilled200 = results.filter(
      (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<request.Response>).value.status === 200,
    );
    expect(fulfilled200.length).toBe(1);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);
  });

  it("4. OrderFulfilled (прямой complete): только при реальном fulfillment; unrelated update не публикует", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);

    // Unrelated update (travelers без смены статуса) → нет OrderFulfilled.
    // Контракт PATCH /travelers (STRICT REVIEW 2.7 §28): server-owned ключи
    // (id/version/dataCompleteness/…) — forbidden → 422; отправляем только
    // traveler-поля (сервис сопоставляет по позиции, id не передаётся).
    const detail = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    const travelers = detail.body.travelers.map((t: { firstName: string; lastName: string; birthDate: string | null; citizenship: string | null; gender: string | null; passportNumber: string | null }) => ({
      firstName: t.firstName,
      lastName: t.lastName,
      birthDate: t.birthDate ?? undefined,
      citizenship: t.citizenship ?? undefined,
      gender: t.gender ?? undefined,
      passportNumber: t.passportNumber ?? undefined,
    }));
    await http.patch(`/api/v1/orders/${order.id}/travelers`).send({ travelers }).expect(200);
    // Forged `id` в traveler-item → 422 (loud, конвенция assertNoForbiddenKeys).
    await http
      .patch(`/api/v1/orders/${order.id}/travelers`)
      .send({ travelers: [{ ...travelers[0], id: "00000000-0000-4000-8000-000000000001" }] })
      .expect(422);
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(0);

    // Прямой complete из SENT_TO_BOOKING (штатный переход, без ожидания броней).
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);

    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    const fulfilled = events.find((e) => e.eventType === "OrderFulfilled")!;
    expect(fulfilled.payload).toEqual({ orderId: order.id, code: order.code, customerId });
    const state = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state!.status).toBe("FULFILLED");
  });

  it("5. OrderFulfilled через reconcile (терминальные брони) — ровно одно; retry не дублирует", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await fulfillViaBooking(order.id); // reconcile → PARTIALLY_FULFILLED → FULFILLED

    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    // Технические: process + reconcile→PARTIALLY_FULFILLED (canonical на partial нет).
    expect(typeCount(events, "OrderStatusChanged")).toBe(2);
    const state = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state!.status).toBe("FULFILLED");

    // Retry: повторный order complete → 409 (уже FULFILLED); повторная бронь-команда → 409.
    await action(order.id, "complete").expect(409);
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1);
  });

  it("6. OrderClosed: только при close; fulfilled ≠ closed; cancelled ≠ closed", async () => {
    // A: fulfilled, но не закрыт → НЕТ OrderClosed.
    const a = (await fixtureOrder()).order;
    orderIds.push(a.id);
    await action(a.id, "process").expect(200);
    await action(a.id, "confirm").expect(200);
    await action(a.id, "send").expect(200);
    await action(a.id, "complete").expect(200);
    let events = await eventsFor(a.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(0);

    // B: cancelled → OrderCancelled, НЕ OrderClosed.
    const b = (await fixtureOrder()).order;
    orderIds.push(b.id);
    await action(b.id, "cancel").expect(200);
    events = await eventsFor(b.id);
    expect(typeCount(events, "OrderCancelled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(0);

    // A: close → ровно одно OrderClosed; статус становится CLOSED (≠ FULFILLED).
    await action(a.id, "close").expect(200);
    const closedState = await prisma.order.findUnique({ where: { id: a.id } });
    expect(closedState!.status).toBe("CLOSED");
    events = await eventsFor(a.id);
    expect(typeCount(events, "OrderClosed")).toBe(1);
    const closed = events.find((e) => e.eventType === "OrderClosed")!;
    expect(closed.payload).toEqual({ orderId: a.id, code: a.code, customerId });

    // §23.15: retry/duplicate close → 409, второй OrderClosed не создаётся.
    await action(a.id, "close").expect(409);
    expect(typeCount(await eventsFor(a.id), "OrderClosed")).toBe(1);
  });

  it("11. explicit complete раньше reconcile: reconcile не создаёт второй OrderFulfilled (race-защита CAS)", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const bookingId = (await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.items[0].id;

    // Прямой complete: FULFILLED + ровно одно OrderFulfilled, пока броня ещё не завершена.
    await action(order.id, "complete").expect(200);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe("FULFILLED");
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1);

    // Позже приходит подтверждение/завершение брони → reconcile срабатывает,
    // но CAS не даёт повторному переходу создать второй canonical факт.
    for (const a of ["send", "confirm", "service", "complete"]) {
      await http.patch(`/api/v1/bookings/${bookingId}`).send({ action: a }).expect(200);
    }
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(0);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe("FULFILLED");
  });

  it("9. partial fulfillment (reconcile → PARTIALLY_FULFILLED) НЕ создаёт OrderFulfilled", async () => {    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const bookingId = (await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.items[0].id;

    // Одна бронь подтверждена, но НЕ завершена → order PARTIALLY_FULFILLED.
    for (const a of ["send", "confirm"]) {
      await http.patch(`/api/v1/bookings/${bookingId}`).send({ action: a }).expect(200);
    }
    const state = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state!.status).toBe("PARTIALLY_FULFILLED");
    const events = await eventsFor(order.id);
    // Partial — технический переход: generic OrderStatusChanged, НЕ canonical.
    expect(typeCount(events, "OrderFulfilled")).toBe(0);
    expect(typeCount(events, "OrderStatusChanged")).toBe(2); // process + partial

    // Завершаем бронь → reconcile → FULFILLED → ровно одно OrderFulfilled.
    for (const a of ["service", "complete"]) {
      await http.patch(`/api/v1/bookings/${bookingId}`).send({ action: a }).expect(200);
    }
    const state2 = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state2!.status).toBe("FULFILLED");
    expect(typeCount(await eventsFor(order.id), "OrderFulfilled")).toBe(1);
  });

  it("10. rollback/atomicity: неуспешный transition не оставляет orphan state/history/event", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);

    // complete из NEW — невалидный from-state → 409 до каких-либо записей.
    await action(order.id, "complete").expect(409);
    const state = await prisma.order.findUnique({ where: { id: order.id } });
    expect(state!.status).toBe("NEW");
    expect(state!.version).toBe(1);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.filter((h) => h.action === "complete")).toHaveLength(0);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderFulfilled")).toBe(0);

    // process → confirm с неполными данными туристов → 400 ДО записи события.
    await action(order.id, "process").expect(200);
    const incomplete = (await fixtureOrder({ travelers: [{ firstName: "А", lastName: "Б" }] })).order;
    orderIds.push(incomplete.id);
    await action(incomplete.id, "process").expect(200);
    await action(incomplete.id, "confirm").expect(422); // данные туристов неполные (ValidationDomainError → 422)
    const incState = await prisma.order.findUnique({ where: { id: incomplete.id } });
    expect(incState!.status).toBe("IN_PROCESSING"); // переход не применился
    const incEvents = await eventsFor(incomplete.id);
    expect(typeCount(incEvents, "OrderReadyForBooking")).toBe(0);
    const incHist = await prisma.orderHistory.findMany({ where: { orderId: incomplete.id } });
    expect(incHist.filter((h) => h.action === "confirm")).toHaveLength(0);
  });

  it("7. generic OrderStatusChanged остаётся только для технических переходов", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200); // technical
    await action(order.id, "markWaitingData").expect(200); // technical
    await action(order.id, "resumeProcessing").expect(200); // technical
    await action(order.id, "confirm").expect(200); // canonical
    let events = await eventsFor(order.id);
    expect(typeCount(events, "OrderStatusChanged")).toBe(3); // process/markWaitingData/resumeProcessing
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);

    // canonical fulfillment/close НЕ публикуют generic.
    await action(order.id, "send").expect(200);
    await action(order.id, "complete").expect(200);
    await action(order.id, "close").expect(200);
    events = await eventsFor(order.id);
    expect(typeCount(events, "OrderStatusChanged")).toBe(3); // без новых
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(1);
  });

  it("8. consumer dedup: повторная доставка BookingRequested не дублирует Booking", async () => {
    const order = (await fixtureOrder()).order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);
    // Повторный send запрещён from-guard'ом → 409, брони не дублируются.
    await action(order.id, "send").expect(409);
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);
    // Consumer отметил обработку ровно одного BookingRequested (InboxEvent).
    const requested = (await eventsFor(order.id)).find((e) => e.eventType === "BookingRequested")!;
    const inbox = await prisma.inboxEvent.findUnique({
      where: { consumerId_eventId: { consumerId: "booking-requested-consumer", eventId: requested.id } },
    });
    expect(inbox).not.toBeNull();
  });
});
