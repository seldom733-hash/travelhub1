/**
 * E2E Phase 1 Step 1.15 — Correlation / Request ID infrastructure (strict §18).
 *
 * Доказывает:
 *  1. HTTP request получает requestId (X-Request-Id header + тело ошибки).
 *  2. Response возвращает canonical diagnostic ID.
 *  3. Независимые requests имеют разные ID.
 *  4. Invalid/oversized/spoofed header безопасен (server authority).
 *  5. Async service (Outbox запись) видит тот же context.
 *  6. HTTP-triggered Outbox event получает correlation.
 *  7. Child event (BookingCreated) наследует correlation.
 *  8. Child causation указывает на parent event.
 *  9. Independent chain имеет другой correlation.
 * 10. Consumer retry сохраняет correlation (legacy NULL → inherited).
 * 11. Duplicate delivery не создаёт новый effect.
 * 12. Legacy NULL event обрабатывается.
 * 13. Anonymous endpoint работает.
 * 14. Authenticated endpoint работает.
 * 15. Behavioral sessionId не подменяется requestId.
 * 16. Errors/logs без secrets/PII.
 * 17-20. Регрессии (Order 1.14, BookingRequested, Buyer Cabinet, behavioral)
 *        — покрыты существующими e2e; здесь — ключевые assertions.
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
import { createRequestId, isValidRequestId } from "../src/shared/request-context";

describe("Phase 1 Step 1.15 — Correlation / Request ID (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let http: request.Agent;
  let anon: request.Agent;

  const stamp = Date.now();
  const productIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];
  const behavioralEventIds: string[] = [];

  let productId: string;
  let customerId: string;

  const bootstrap = () =>
    http.post("/api/v1/orders/bootstrap").send({
      customerId,
      currency: "USD",
      items: [{ productId, title: "Tour", type: "TOUR", quantity: 1, price: 100 }],
      travelers: [{ firstName: "А", lastName: "Б", birthDate: "1990-05-01", passportNumber: "P1234567" }],
    });

  const action = (orderId: string, act: string) => http.patch(`/api/v1/orders/${orderId}`).send({ action: act });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    http = request.agent(app.getHttpServer());
    http.set("Authorization", `Bearer ${login.body.accessToken}`);
    anon = request.agent(app.getHttpServer());

    const product = (await http.post("/api/v1/products").send({ type: "TOUR", title: `Ctx ${stamp}` }).expect(201)).body.product;
    productIds.push(product.id);
    productId = product.id;
    await http.post(`/api/v1/products/${productId}/publish`).expect(201);

    const customer = (await http.post("/api/v1/customers").send({ type: "PERSON", firstName: "А", lastName: "Б", email: `ctx${stamp}@test.local` }).expect(201)).body.customer;
    customerIds.push(customer.id);
    customerId = customer.id;
  });

  afterAll(async () => {
    const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: orderIds } }, select: { id: true } })).map((e) => e.id);
    await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: orderIds } } });
    await prisma.booking.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    if (behavioralEventIds.length > 0) {
      await prisma.marketplaceBehavioralEvent.deleteMany({ where: { eventId: { in: behavioralEventIds } } });
    }
    await app.close();
  });

  // ── 1-3. requestId: header, canonical ID, uniqueness ──────────────────────

  it("1-2. каждый HTTP response возвращает валидный X-Request-Id (canonical diagnostic ID)", async () => {
    const res = await anon.get("/api/v1/public/products?pageSize=1").expect(200);
    const requestId = res.headers["x-request-id"] as string;
    expect(isValidRequestId(requestId)).toBe(true);
  });

  it("3. независимые requests получают РАЗНЫЕ requestId", async () => {
    const r1 = await anon.get("/api/v1/public/products?pageSize=1").expect(200);
    const r2 = await anon.get("/api/v1/public/products?pageSize=1").expect(200);
    expect(r1.headers["x-request-id"]).not.toBe(r2.headers["x-request-id"]);
  });

  // ── 4. Trust boundary / spoofing ─────────────────────────────────────────

  it("4a. невалидный/oversized X-Request-Id не принимается (server authority)", async () => {
    // Oversized (65 chars) — сервер игнорирует и генерирует свой UUID.
    const big = await anon.get("/api/v1/public/products?pageSize=1").set("x-request-id", "a".repeat(65)).expect(200);
    const bigId = big.headers["x-request-id"] as string;
    expect(isValidRequestId(bigId)).toBe(true);
    expect(bigId).not.toBe("a".repeat(65));

    // Log injection (control chars) — superagent не может отправить такой header
    // на клиенте (TypeError), что уже доказывает: node/http не пропустит его
    // на wire; серверная валидация (unit request-context.spec) отклоняет его
    // как невалидный. Здесь — не-UUID строка:
    const inject = await anon.get("/api/v1/public/products?pageSize=1").set("x-request-id", "forged; DELETE FROM x").expect(200);
    expect(isValidRequestId(inject.headers["x-request-id"] as string)).toBe(true);

    // Не-UUID строка — не принимается.
    const spoof = await anon.get("/api/v1/public/products?pageSize=1").set("x-request-id", "forged-id").expect(200);
    expect(isValidRequestId(spoof.headers["x-request-id"] as string)).toBe(true);
  });

  it("4b. валидный client UUID X-Request-Id эхо-отражается как requestId (diagnostic), но correlation остаётся server-authoritative", async () => {
    const clientId = createRequestId();
    const res = await anon.get("/api/v1/public/products?pageSize=1").set("x-request-id", clientId).expect(200);
    expect(res.headers["x-request-id"]).toBe(clientId); // requestId echo
    // correlation в outbox для этого запроса НЕ равен client UUID.
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").set("x-request-id", clientId).expect(200);
    const ev = await prisma.outboxEvent.findFirst({ where: { aggregateId: order.id, eventType: "OrderStatusChanged" } });
    expect(ev!.correlationId).not.toBe(clientId);
    expect(ev!.correlationId).toBeTruthy();
  });

  it("4c. client X-Correlation-Id НЕ становится authoritative correlation (server assigns)", async () => {
    // Произвольный client correlation не формирует цепочку: сервер сам назначает
    // correlation = requestId. Проверяем на HTTP-команде с outbox-событием.
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    const res = await action(order.id, "process").set("x-correlation-id", "client-forged-chain").expect(200);
    const requestId = res.headers["x-request-id"] as string;
    const created = await prisma.outboxEvent.findFirst({
      where: { aggregateId: order.id, eventType: "OrderStatusChanged" },
      orderBy: { createdAt: "asc" },
    });
    // Correlation = server requestId (не client-forged-chain, не order.code).
    expect(created!.correlationId).toBe(requestId);
    expect(created!.correlationId).not.toBe("client-forged-chain");
    expect(created!.correlationId).not.toBe(order.code);
  });

  // ── 5-6. Async propagation: outbox видит тот же context ──────────────────

  it("5-6. HTTP-triggered Outbox event наследует correlation = requestId", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    const res = await action(order.id, "process").expect(200);
    const requestId = res.headers["x-request-id"] as string;
    const ev = await prisma.outboxEvent.findFirst({
      where: { aggregateId: order.id, eventType: "OrderStatusChanged" },
      orderBy: { createdAt: "asc" },
    });
    expect(ev!.correlationId).toBe(requestId);
    expect(ev!.causationId).toBeNull();
  });

  // ── 7-9. Causal chain: Order command → BookingRequested → Booking consumer ─

  it("7-8. child event (BookingCreated) наследует correlation и получает causation → parent", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const sendRes = await action(order.id, "send").expect(200);
    const requestId = sendRes.headers["x-request-id"] as string;

    const bookingRequested = await prisma.outboxEvent.findFirst({
      where: { aggregateId: order.id, eventType: "BookingRequested" },
      orderBy: { createdAt: "asc" },
    });
    const bookingCreated = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCreated", payload: { path: ["orderId"], equals: order.id } },
      orderBy: { createdAt: "asc" },
    });

    // correlation: parent (BookingRequested) = requestId команды send;
    // child (BookingCreated) наследует тот же correlation.
    expect(bookingRequested!.correlationId).toBe(requestId);
    expect(bookingCreated!.correlationId).toBe(bookingRequested!.correlationId);
    // causation: child указывает на parent event id (не на HTTP).
    expect(bookingCreated!.causationId).toBe(bookingRequested!.id);

    // Booking создан (потребитель сработал) — flow не сломан.
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);
  });

  it("4d. повтор одного client X-Request-Id в двух независимых requests НЕ сливает chains (разные correlationId)", async () => {
    // REVIEW FIX (Step 1.15 review §2): correlationId всегда server-authoritative.
    // Два независимых запроса с ОДНИМ client UUID получают одинаковый requestId
    // (echo), но РАЗНЫЕ correlationId — никакого случайного слияния в одну chain.
    const sharedClientId = createRequestId();
    const o1 = (await bootstrap().expect(201)).body.order;
    orderIds.push(o1.id);
    const o2 = (await bootstrap().expect(201)).body.order;
    orderIds.push(o2.id);
    const r1 = await action(o1.id, "process").set("x-request-id", sharedClientId).expect(200);
    const r2 = await action(o2.id, "process").set("x-request-id", sharedClientId).expect(200);
    // requestId echo одинаковый, correlationId разные.
    expect(r1.headers["x-request-id"]).toBe(sharedClientId);
    expect(r2.headers["x-request-id"]).toBe(sharedClientId);
    const e1 = await prisma.outboxEvent.findFirst({ where: { aggregateId: o1.id, eventType: "OrderStatusChanged" } });
    const e2 = await prisma.outboxEvent.findFirst({ where: { aggregateId: o2.id, eventType: "OrderStatusChanged" } });
    expect(e1!.correlationId).not.toBe(e2!.correlationId);
    expect(e1!.correlationId).not.toBe(sharedClientId);
    expect(e2!.correlationId).not.toBe(sharedClientId);
  });

  it("9. independent chains имеют разные correlation (разные requestId)", async () => {
    const o1 = (await bootstrap().expect(201)).body.order;
    orderIds.push(o1.id);
    const o2 = (await bootstrap().expect(201)).body.order;
    orderIds.push(o2.id);
    const r1 = await action(o1.id, "process").expect(200);
    const r2 = await action(o2.id, "process").expect(200);
    expect(r1.headers["x-request-id"]).not.toBe(r2.headers["x-request-id"]);
    const e1 = await prisma.outboxEvent.findFirst({ where: { aggregateId: o1.id, eventType: "OrderStatusChanged" } });
    const e2 = await prisma.outboxEvent.findFirst({ where: { aggregateId: o2.id, eventType: "OrderStatusChanged" } });
    expect(e1!.correlationId).not.toBe(e2!.correlationId);
  });

  // ── 10-12. Consumer retry / duplicate delivery / legacy NULL ─────────────

  it("10. consumer retry (повторная доставка того же события) сохраняет correlation и не создаёт новый effect", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);

    const requested = await prisma.outboxEvent.findFirst({ where: { aggregateId: order.id, eventType: "BookingRequested" } });
    const createdBefore = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCreated", payload: { path: ["orderId"], equals: order.id } },
    });

    // Повторная доставка: снимаем PUBLISHED → PENDING и очищаем inbox.
    await prisma.outboxEvent.update({ where: { id: requested!.id }, data: { status: "PENDING" } });
    await prisma.inboxEvent.deleteMany({ where: { eventId: requested!.id } });
    await eventBus.publishPending(100);

    // Inbox dedup: эффект НЕ дублируется (BookingCreated ровно один, bookings 1).
    const createdAfter = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCreated", payload: { path: ["orderId"], equals: order.id } },
      orderBy: { createdAt: "desc" },
    });
    expect(createdAfter!.id).toBe(createdBefore!.id); // тот же child event
    expect(createdAfter!.correlationId).toBe(requested!.correlationId); // correlation сохранён
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);
    // Событие снова обработано (inbox восстановлен).
    const inbox = await prisma.inboxEvent.findUnique({
      where: { consumerId_eventId: { consumerId: "booking-requested-consumer", eventId: requested!.id } },
    });
    expect(inbox).not.toBeNull();
  });

  it("11. duplicate delivery (тот же eventId) не создаёт новую logical chain", async () => {
    // Фактически покрыто тестом 10 (inbox dedup). Дополнительно: повторный send
    // команды отклоняется from-guard'ом, второй BookingRequested не публикуется.
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    await action(order.id, "send").expect(409);
    const requested = await prisma.outboxEvent.findMany({ where: { aggregateId: order.id, eventType: "BookingRequested" } });
    expect(requested).toHaveLength(1);
  });

  it("12. legacy NULL correlation event обрабатывается consumer-ом", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);

    // Симуляция legacy NULL correlation: существующий BookingRequested → NULL.
    const requested = await prisma.outboxEvent.findFirst({ where: { aggregateId: order.id, eventType: "BookingRequested" } });
    await prisma.outboxEvent.update({ where: { id: requested!.id }, data: { correlationId: null, status: "PENDING" } });
    await prisma.inboxEvent.deleteMany({ where: { eventId: requested!.id } });
    await eventBus.publishPending(100);

    // Consumer обрабатывает legacy NULL: inbox восстановлен, новый effect не создан.
    const inbox = await prisma.inboxEvent.findUnique({
      where: { consumerId_eventId: { consumerId: "booking-requested-consumer", eventId: requested!.id } },
    });
    expect(inbox).not.toBeNull();
    expect((await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.total).toBe(1);
  });

  // ── 13-14. Anonymous / authenticated ─────────────────────────────────────

  it("13. anonymous public endpoint работает и получает requestId", async () => {
    const res = await anon.get("/api/v1/public/products?pageSize=1").expect(200);
    expect(isValidRequestId(res.headers["x-request-id"] as string)).toBe(true);
    expect(res.body.items).toBeDefined();
  });

  it("14. authenticated endpoint работает и получает requestId", async () => {
    const res = await http.get("/api/v1/auth/me").expect(200);
    expect(isValidRequestId(res.headers["x-request-id"] as string)).toBe(true);
    expect(res.body.role).toBeTruthy();
  });

  // ── 15. Behavioral isolation ─────────────────────────────────────────────

  it("15. behavioral sessionId/eventId не подменяются requestId", async () => {
    const sessionId = `sess-${stamp}-${createRequestId()}`.slice(0, 64);
    const eventId = createRequestId();
    const res = await anon
      .post("/api/v1/public/marketplace/events")
      .send({
        eventId,
        eventType: "MARKETPLACE_VIEWED",
        occurredAt: new Date().toISOString(),
        sessionId,
        locale: "ru",
        path: "/",
      })
      .expect(202);
    behavioralEventIds.push(eventId);
    const requestId = res.headers["x-request-id"] as string;
    expect(isValidRequestId(requestId)).toBe(true);

    const row = await prisma.marketplaceBehavioralEvent.findUnique({ where: { eventId } });
    // sessionId — свой opaque ID, НЕ requestId; eventId — клиентский, НЕ requestId.
    expect(row!.sessionId).toBe(sessionId);
    expect(row!.sessionId).not.toBe(requestId);
    expect(row!.eventId).toBe(eventId);
    expect(row!.eventId).not.toBe(requestId);
  });

  // ── 16. Errors/logs без PII, requestId в ошибке ──────────────────────────

  it("16a. error response содержит requestId (связь с logs) без internal leakage", async () => {
    const res = await anon.post("/api/v1/auth/login").send({ username: "admin", password: "wrong-password-xyz" }).expect(401);
    const requestId = res.headers["x-request-id"] as string;
    expect(isValidRequestId(requestId)).toBe(true);
    expect(res.body.requestId).toBe(requestId);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("wrong-password-xyz");
    expect(raw).not.toContain("Bearer");
    expect(raw).not.toContain("secret");
  });

  it("16b. 4xx (validation) несёт requestId и не раскрывает детали", async () => {
    const res = await http.post("/api/v1/orders/bootstrap").send({}).expect(400);
    expect(isValidRequestId(res.headers["x-request-id"] as string)).toBe(true);
    expect(res.body.requestId).toBe(res.headers["x-request-id"]);
  });

  // ── ALS isolation: 50+ параллельных requests ─────────────────────────────

  it("5b. 50 параллельных requests: каждый видит СВОЙ context (уникальные requestId, без пересечения)", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => anon.get("/api/v1/public/products?pageSize=1")),
    );
    const ids = results.map((r) => r.headers["x-request-id"] as string);
    expect(ids).toHaveLength(50);
    for (const id of ids) expect(isValidRequestId(id)).toBe(true);
    expect(new Set(ids).size).toBe(50); // ни один context не видит ID другого request
  });


  // ── 17-20. Ключевые регрессии (полные — в отдельных e2e-файлах) ─────────

  it("17. Order canonical events 1.14 не сломаны (confirm → одно OrderReadyForBooking)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const ready = await prisma.outboxEvent.findMany({ where: { aggregateId: order.id, eventType: "OrderReadyForBooking" } });
    expect(ready).toHaveLength(1);
    expect(ready[0].correlationId).toBeTruthy(); // correlation из context
  });

  it("18. BookingRequested flow не сломан (Booking + Passenger созданы)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const bookings = (await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.items;
    expect(bookings).toHaveLength(1);
    const detail = await http.get(`/api/v1/bookings/${bookings[0].id}`).expect(200);
    expect(detail.body.passengers).toHaveLength(1);
  });

  it("20. Marketplace behavioral ingestion не сломан (202 + requestId)", async () => {
    const eventId = createRequestId();
    const res = await anon
      .post("/api/v1/public/marketplace/events")
      .send({
        eventId,
        eventType: "MARKETPLACE_VIEWED",
        occurredAt: new Date().toISOString(),
        sessionId: `sess-mkt-${stamp}`,
        locale: "ru",
        path: "/",
      })
      .expect(202);
    expect(res.body).toEqual({ accepted: true });
    expect(isValidRequestId(res.headers["x-request-id"] as string)).toBe(true);
  });
});
