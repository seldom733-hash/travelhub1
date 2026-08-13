/**
 * E2E Phase 1 (Jest + Supertest): полный сквозной сценарий DoD.
 *
 *   Product → Customer → Order (test-fixture, Step 2.6) → OrderTraveler validation →
 *   Ready for Booking → BookingRequested → Booking (+Passenger) → BookingConfirmed →
 *   Order aggregate updated (через событие, не напрямую).
 *
 * Дополнительно: идемпотентность consumer-а, correlation/causation трассировка,
 * аудит переходов, канонические ID (PRD-/CUS-/ORD-/TH-/BKG-).
 *
 * Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную
 * тестовую БД (TEST_DATABASE_URL) до импорта AppModule — dev-БД не используется.
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
import { createFixtureOrder } from "./fixtures/create-order.fixture";

describe("Phase 1 — Product → Order → Booking (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let http: request.Agent;

  // Created ids for cleanup
  const productIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];

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

    // Phase 2: вход администратором (seed выполняется при старте AppModule);
    // авторизованный agent подставляет Bearer во все последующие запросы.
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    expect(login.body.accessToken).toBeTruthy();
    http = request.agent(app.getHttpServer());
    http.set("Authorization", `Bearer ${login.body.accessToken}`);
  });

  afterAll(async () => {
    // Очистка: в обратном порядке зависимостей (events → booking → order → crm → catalog).
    await prisma.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: orderIds } }, { aggregateId: { in: productIds } }, { aggregateId: { in: customerIds } }] } });
    // Shared-DB isolation: child BookingCreated имеет aggregateId = bookingId (НЕ orderId),
    // payload содержит orderId — удаляем по payload (equals на JSON path).
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

  it("полный сценарий: Product → Customer → Order → Booking → статусы синхронизированы", async () => {
    // ── 1. Product создаётся и публикуется ────────────────────────────────────
    const productRes = await http
      .post("/api/v1/products")
      .send({ type: "TOUR", title: "Test Tour Phase1", tariffs: [{ name: "Standard", price: 250 }] })
      .expect(201);
    const product = productRes.body.product;
    productIds.push(product.id);
    expect(product.code).toMatch(/^PRD-\d{8}$/);
    expect(product.status).toBe("DRAFT");

    await http.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const published = await http.get(`/api/v1/products/${product.id}`).expect(200);
    expect(published.body.status).toBe("PUBLISHED");
    expect(published.body.publishedAt).toBeTruthy();
    expect(published.body.tariffs.length).toBe(1);

    // ── 2. Customer создаётся ─────────────────────────────────────────────────
    const customerRes = await http
      .post("/api/v1/customers")
      .send({ type: "PERSON", firstName: "Айгюн", lastName: "Тестова", email: "phase1@test.local" })
      .expect(201);
    const customer = customerRes.body.customer;
    customerIds.push(customer.id);
    expect(customer.code).toMatch(/^CUS-\d{8}$/);

    // ── 3. Order (test-fixture, Step 2.6): ORD-* + TH-*, items + travelers ──
    const orderRes = await createFixtureOrder(prisma, ids, eventBus, {
      customerId: customer.id,
      currency: "USD",
      serviceDate: "2026-10-01T00:00:00.000Z",
      items: [{ productId: product.id, title: product.title, type: "TOUR", quantity: 1, price: 250 }],
      travelers: [{ firstName: "Айгюн", lastName: "Тестова", birthDate: "1990-05-01", passportNumber: "P1234567" }],
    });
    const order = orderRes.order;
    orderIds.push(order.id);
    expect(order.code).toMatch(/^ORD-\d{8}$/);
    expect(order.number).toMatch(/^TH-\d{4}-\d{6}$/);
    expect(order.status).toBe("NEW");
    expect(Number(order.amount)).toBe(250);

    // ── 4. Traveler сохранён и COMPLETE (есть паспорт) ────────────────────────
    const orderDetail = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(orderDetail.body.travelers).toHaveLength(1);
    expect(orderDetail.body.travelers[0].dataCompleteness).toBe("COMPLETE");
    expect(orderDetail.body.items).toHaveLength(1);
    expect(orderDetail.body.items[0].productCode).toBe(product.code);

    // ── 5. Нельзя перейти в READY_FOR_BOOKING без паспортных данных ──────────
    const badOrderRes = await createFixtureOrder(prisma, ids, eventBus, {
      customerId: customer.id,
      items: [{ productId: product.id, title: product.title, type: "TOUR", price: 100 }],
      travelers: [{ firstName: "Без", lastName: "Паспорта" }],
    });
    const badOrder = badOrderRes.order;
    orderIds.push(badOrder.id);
    // Принять в работу можно; переход в READY_FOR_BOOKING без паспорта запрещён.
    await http.patch(`/api/v1/orders/${badOrder.id}`).send({ action: "process" }).expect(200);
    await http.patch(`/api/v1/orders/${badOrder.id}`).send({ action: "confirm" }).expect(422);

    // ── 6. Lifecycle: process → confirm → send (BookingRequested) ─────────────
    await http.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await http.patch(`/api/v1/orders/${order.id}`).send({ action: "confirm" }).expect(200);
    const ready = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(ready.body.status).toBe("READY_FOR_BOOKING");

    // «Передать в Booking Center»
    const sendRes = await http.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(200);
    expect(sendRes.body.status).toBe("SENT_TO_BOOKING");
    // Step 1.15: сервер-authoritative requestId в response header.
    const sendRequestId = sendRes.headers["x-request-id"] as string;
    expect(sendRequestId).toBeTruthy();

    // ── 7. Booking создан consumer-ом (BKG-*) + Passenger ────────────────────
    const bookings = await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200);
    expect(bookings.body.total).toBe(1);
    const booking = bookings.body.items[0];
    expect(booking.code).toMatch(/^BKG-\d{8}$/);
    expect(booking.status).toBe("NEW");
    expect(booking.orderId).toBe(order.id);

    const bookingDetail = await http.get(`/api/v1/bookings/${booking.id}`).expect(200);
    expect(bookingDetail.body.passengers).toHaveLength(1);
    expect(bookingDetail.body.passengers[0].firstName).toBe("Айгюн");
    expect(bookingDetail.body.history[0].action).toBe("created");

    // ── 8. Идемпотентность: повторный send НЕ создаёт вторую бронь ────────────
    await http.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(409);
    const bookingsAfter = await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200);
    expect(bookingsAfter.body.total).toBe(1);

    // ── 9. BookingConfirmed → Order обновляет агрегированное состояние ────────
    await http.patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
    const confirmed = await http.patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(200);
    expect(confirmed.body.status).toBe("CONFIRMED");

    const orderAfterConfirm = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(orderAfterConfirm.body.status).toBe("PARTIALLY_FULFILLED");

    // ── 10. Завершение: complete → FULFILLED → close → CLOSED ────────────────
    await http.patch(`/api/v1/bookings/${booking.id}`).send({ action: "service" }).expect(200);
    await http.patch(`/api/v1/bookings/${booking.id}`).send({ action: "complete" }).expect(200);
    const orderFulfilled = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(orderFulfilled.body.status).toBe("FULFILLED");
    await http.patch(`/api/v1/orders/${order.id}`).send({ action: "close" }).expect(200);

    // ── 11. Трассировка: correlation/causation + аудит переходов ──────────────
    // Step 1.15: correlation — техническая цепочка (requestId команды),
    // НЕ business-код заказа. События Booking-домена имеют aggregateId = booking.id,
    // поэтому выбираем события обоих агрегатов (Order + Booking) заказа.
    const events = await prisma.outboxEvent.findMany({
      where: { OR: [{ aggregateId: order.id }, { aggregateId: booking.id }] },
      orderBy: { createdAt: "asc" },
    });
    const types = events.map((e) => e.eventType);
    expect(types).toContain("OrderCreated");
    // Step 1.14: canonical факт «готов к бронированию» (бывш. OrderApproved).
    expect(types).toContain("OrderReadyForBooking");
    expect(types).not.toContain("OrderApproved");
    expect(types).toContain("BookingRequested");
    expect(types).toContain("BookingCreated");
    expect(types).toContain("BookingConfirmed");
    // Step 1.14: canonical факты fulfillment/close присутствуют ровно по одному.
    expect(types.filter((t) => t === "OrderFulfilled")).toHaveLength(1);
    expect(types.filter((t) => t === "OrderClosed")).toHaveLength(1);

    const bookingRequested = events.find((e) => e.eventType === "BookingRequested");
    const bookingCreated = events.find((e) => e.eventType === "BookingCreated");
    expect(bookingCreated?.causationId).toBe(bookingRequested?.id);
    // Step 1.15: child event наследует correlation родителя (= requestId send-команды);
    // business-код заказа больше НЕ используется как correlationId.
    expect(bookingRequested?.correlationId).toBe(sendRequestId);
    expect(bookingCreated?.correlationId).toBe(bookingRequested?.correlationId);

    const history = await prisma.orderHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    const actions = history.map((h) => h.action);
    expect(actions).toContain("booking_confirmed");
    expect(actions).not.toContain("booking_rejected");

    // ── 12. Финал: заказ закрыт ───────────────────────────────────────────────
    const closed = await http.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(closed.body.status).toBe("CLOSED");
  });
});
