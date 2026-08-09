/**
 * E2E Phase 1 Step 1.15A — Business Event Temporal Contract (§37).
 *
 * Доказывает фактический canonical envelope:
 *  1. OrderReadyForBooking — canonical envelope (USER actor из authenticated
 *     command, entityId=orderId, occurredAt UTC, correlation=requestId);
 *  2. OrderFulfilled — canonical envelope (SYSTEM actor при reconcile);
 *  3. OrderClosed — canonical envelope (USER actor при explicit close);
 *  4. trigger counts не изменились относительно Step 1.14;
 *  5. child BookingCreated наследует correlation/causation от BookingRequested;
 *  6. actor из authenticated command — {type:"USER", id} (userId, не username);
 *  7. system-produced event actor — {type:"SYSTEM"};
 *  8. entityId — canonical aggregate (orderId/bookingId);
 *  9. occurredAt — UTC ISO, стабилен (не мутируется при доставке);
 * 10. eventId стабилен;
 * 11. повторная доставка не мутирует envelope;
 * 12. legacy event без actor/NULL correlation остаётся читаемым (projection);
 * 13. нет PII в Order payload;
 * 14. нет raw CRM в Customer/Partner event;
 * 15. AuditLog структурно не затронут (отдельная модель, не envelope);
 * 16. behavioral events не затронуты (отдельное storage, не бизнес-envelope);
 * 17. FAILED/PENDING processing не мутирует business envelope;
 * 18. независимые request chains остаются различными.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../src/eventbus/eventbus.service";
import type { BusinessEventActor } from "../src/eventbus/domain-events";

const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("Phase 1 Step 1.15A — Business Event Envelope (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let http: request.Agent;
  let adminId: string;

  const stamp = Date.now();
  const envStart = new Date(); // граница «только события этого прогона» для выборочных проверок
  const productIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];
  const legacyEventIds: string[] = [];
  const behavioralEventIds: string[] = [];

  let productId: string;
  let customerId: string;

  const bootstrap = (overrides: Record<string, unknown> = {}) =>
    http.post("/api/v1/orders/bootstrap").send({
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

  /** Штатный полный цикл: send booking → подтвердить/завершить бронь (reconcile → FULFILLED). */
  const fulfillViaBooking = async (orderId: string) => {
    await action(orderId, "send").expect(200);
    const bookingId = (await http.get(`/api/v1/bookings?orderId=${orderId}`).expect(200)).body.items[0].id;
    for (const a of ["send", "confirm", "service", "complete"]) {
      await http.patch(`/api/v1/bookings/${bookingId}`).send({ action: a }).expect(200);
    }
    return bookingId;
  };

  const actorOf = (actor: unknown): BusinessEventActor | null => actor as BusinessEventActor | null;

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
    adminId = (await http.get("/api/v1/auth/me").expect(200)).body.id as string;

    const product = (await http.post("/api/v1/products").send({ type: "TOUR", title: `Env ${stamp}` }).expect(201)).body.product;
    productIds.push(product.id);
    productId = product.id;
    await http.post(`/api/v1/products/${productId}/publish`).expect(201);

    const customer = (await http.post("/api/v1/customers").send({ type: "PERSON", firstName: "А", lastName: "Б", email: `env${stamp}@test.local` }).expect(201)).body.customer;
    customerIds.push(customer.id);
    customerId = customer.id;
  });

  afterAll(async () => {
    const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: orderIds } }, select: { id: true } })).map((e) => e.id);
    await prisma.inboxEvent.deleteMany({ where: { eventId: { in: [...orderEventIds, ...legacyEventIds] } } });
    await prisma.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: orderIds } }, { id: { in: legacyEventIds } }] } });
    await prisma.booking.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.marketplaceBehavioralEvent.deleteMany({ where: { eventId: { in: behavioralEventIds } } });
    await app.close();
  });

  it("1. OrderReadyForBooking: canonical envelope (USER actor, entityId, occurredAt UTC, correlation=requestId)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    const confirmRes = await action(order.id, "confirm").expect(200);
    const requestId = confirmRes.headers["x-request-id"] as string;

    const ready = (await eventsFor(order.id)).find((e) => e.eventType === "OrderReadyForBooking")!;
    expect(ready).toBeDefined();
    // §1/§8: entityId = aggregateId = orderId; entityType = Order.
    expect(ready.aggregateId).toBe(order.id);
    expect(ready.aggregateType).toBe("Order");
    // §6: actor из authenticated command — canonical userId, НЕ username/email.
    expect(actorOf(ready.actor)).toEqual({ type: "USER", id: adminId });
    // §7(1.15): correlation = server correlationId (X-Request-Id), causation = null (root HTTP).
    expect(ready.correlationId).toBe(requestId);
    expect(ready.causationId).toBeNull();
    // §9: occurredAt (createdAt, проекция при чтении) — валидный UTC ISO.
    expect(ready.createdAt.toISOString()).toMatch(UTC_ISO_RE);
    // §13: payload без PII.
    expect(ready.payload).toEqual({ orderId: order.id, code: order.code, customerId });
    const raw = JSON.stringify(ready.payload);
    expect(raw).not.toContain("email");
    expect(raw).not.toContain("phone");
    expect(raw).not.toContain("passportNumber");
    expect(raw).not.toContain("firstName");
  });

  it("2. OrderFulfilled (SYSTEM при reconcile) и OrderClosed (USER при close): envelope + counts как в 1.14 (§37.2-4)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await fulfillViaBooking(order.id); // reconcile → FULFILLED (SYSTEM actor)
    const closeRes = await action(order.id, "close").expect(200);
    const closeRequestId = closeRes.headers["x-request-id"] as string;

    const events = await eventsFor(order.id);
    // §4: counts НЕ изменились относительно Step 1.14 (order-canonical-events):
    // OrderCreated 1, OrderReadyForBooking 1, OrderFulfilled 1, OrderClosed 1,
    // OrderStatusChanged 2 (process + reconcile→PARTIALLY_FULFILLED),
    // BookingRequested 1 (+ 1 child BookingCreated с aggregateId=bookingId).
    expect(typeCount(events, "OrderCreated")).toBe(1);
    expect(typeCount(events, "OrderReadyForBooking")).toBe(1);
    expect(typeCount(events, "OrderFulfilled")).toBe(1);
    expect(typeCount(events, "OrderClosed")).toBe(1);
    expect(typeCount(events, "OrderStatusChanged")).toBe(2);
    const requestedEv = events.find((e) => e.eventType === "BookingRequested")!;
    expect(requestedEv).toBeDefined();
    const childCreated = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCreated", causationId: requestedEv.id },
    });
    expect(childCreated).not.toBeNull();

    // §2/§7: OrderFulfilled через reconcile — system-produced событие.
    const fulfilled = events.find((e) => e.eventType === "OrderFulfilled")!;
    expect(actorOf(fulfilled.actor)).toEqual({ type: "SYSTEM" });
    expect(fulfilled.aggregateId).toBe(order.id);
    // §9: causation = непосредственная причина — eventId родительского события брони.
    expect(fulfilled.causationId).not.toBeNull();
    const parent = await prisma.outboxEvent.findUnique({ where: { id: fulfilled.causationId! } });
    expect(parent?.eventType).toBe("BookingStatusChanged");

    // §3/§6: OrderClosed через explicit close — authenticated command (USER actor).
    const closed = events.find((e) => e.eventType === "OrderClosed")!;
    expect(actorOf(closed.actor)).toEqual({ type: "USER", id: adminId });
    expect(closed.correlationId).toBe(closeRequestId);
    expect(closed.causationId).toBeNull();
    expect(closed.aggregateId).toBe(order.id);
    expect(closed.createdAt.toISOString()).toMatch(UTC_ISO_RE);
  });

  it("3. child BookingCreated: наследует correlation/causation, SYSTEM actor, entityId=bookingId (§37.5/§37.7/§37.8)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);

    const events = await eventsFor(order.id);
    const requested = events.find((e) => e.eventType === "BookingRequested")!;
    expect(requested).toBeDefined();
    // STRICT REVIEW FIX (PII): payload — ТОЛЬКО canonical refs; items/travelers
    // (паспортные данные) НЕ хранятся в durable Outbox; consumer читает их из БД.
    expect(requested.payload).toEqual({ orderId: order.id, orderCode: order.code, customerId });
    const requestedRaw = JSON.stringify(requested.payload);
    expect(requestedRaw).not.toContain("passportNumber");
    expect(requestedRaw).not.toContain("firstName");
    expect(requestedRaw).not.toContain("travelers");
    expect(requestedRaw).not.toContain("items");
    // BookingCreated — entityId = bookingId (НЕ orderId): ищем по causation chain.
    const created = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCreated", causationId: requested.id },
    });
    expect(created).not.toBeNull();

    // §5: child наследует correlation (вся causal chain) и causation = parent eventId.
    expect(created!.correlationId).toBe(requested.correlationId);
    expect(created!.causationId).toBe(requested.id);
    // §7: события-результаты consumer-а — SYSTEM actor.
    expect(actorOf(created!.actor)).toEqual({ type: "SYSTEM" });
    // §8: entityId — canonical booking ID (первая созданная бронь).
    const bookingId = (await http.get(`/api/v1/bookings?orderId=${order.id}`).expect(200)).body.items[0].id;
    expect(created!.aggregateId).toBe(bookingId);
    expect(created!.aggregateType).toBe("Booking");
    // §7(1.15): OrderReadyForBooking не порождает booking-команду; BookingRequested — USER actor (send).
    const requestedActor = actorOf(requested.actor);
    expect(requestedActor?.type).toBe("USER");
  });

  it("4. occurredAt/eventId стабильны; повторная доставка не мутирует envelope (§37.9-11)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    await action(order.id, "process").expect(200);
    const before = (await eventsFor(order.id)).find((e) => e.eventType === "OrderStatusChanged")!;
    expect(before.createdAt.toISOString()).toMatch(UTC_ISO_RE);

    // Повторный publishPending не пересоздаёт/не мутирует события (PUBLISHED не доставляются).
    await eventBus.publishPending();
    const after = await prisma.outboxEvent.findUnique({ where: { id: before.id } });
    // §10: eventId стабилен; §9: occurredAt (createdAt) не меняется; §11: payload/actor не мутируются.
    expect(after!.id).toBe(before.id);
    expect(after!.createdAt).toEqual(before.createdAt);
    expect(after!.payload).toEqual(before.payload);
    expect(after!.actor).toEqual(before.actor);
    expect(after!.correlationId).toEqual(before.correlationId);
    expect(after!.causationId).toEqual(before.causationId);
  });

  it("5. нет PII в Order payload (§37.13)", async () => {
    const order = (await bootstrap().expect(201)).body.order;
    orderIds.push(order.id);
    const events = await eventsFor(order.id);
    const created = events.find((e) => e.eventType === "OrderCreated")!;
    // Typed payload: только canonical refs + amount/currency. Никаких email/phone/passport.
    expect(created.payload).toEqual({
      orderId: order.id,
      code: order.code,
      number: expect.any(String),
      customerId,
      amount: expect.any(String),
      currency: "USD",
    });
    const raw = JSON.stringify(created.payload);
    for (const forbidden of ["email", "phone", "passportNumber", "firstName", "lastName", "birthDate", "travelers", "items"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("6. нет raw CRM в Customer event (§37.14)", async () => {
    const created = await prisma.outboxEvent.findFirst({
      where: { eventType: "CustomerCreated", createdAt: { gte: envStart } }, // только события ЭТОГО прогона
      orderBy: { createdAt: "desc" },
    });
    expect(created).not.toBeNull();
    // Только типизированные поля контракта CustomerEventPayload — никакого raw-дампа сущности.
    // STRICT REVIEW FIX: email убран из payload (нет consumer-ов; data minimization).
    const payload = created!.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["code", "customerId", "name"]);
    const raw = JSON.stringify(created!.payload);
    for (const forbidden of ["email", "phone", "address", "passportNumber", "taxId", "registrationNumber", "birthDate", "gender", "notes"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("7. AuditLog структурно не затронут (§37.15)", async () => {
    const loginAudit = await prisma.auditLog.findFirst({
      where: { action: "auth.login" },
      orderBy: { createdAt: "desc" },
    });
    expect(loginAudit).not.toBeNull();
    // Отдельная модель: envelope не добавляет полей/семантики в AuditLog.
    expect(loginAudit!.action).toBe("auth.login");
    expect(loginAudit!.resource).toBe("User");
    expect(loginAudit!.userId).toBe(adminId);
    // details несут только Step 1.15 correlation reference — не business envelope.
    const details = (loginAudit!.details ?? {}) as Record<string, unknown>;
    if (details.correlation) {
      const corr = details.correlation as Record<string, unknown>;
      expect(typeof corr.requestId).toBe("string");
      expect(typeof corr.correlationId).toBe("string");
    }
    expect(details).not.toHaveProperty("actor");
    expect(details).not.toHaveProperty("occurredAt");
    expect(details).not.toHaveProperty("entityId");
    expect(details).not.toHaveProperty("eventType");
  });

  it("8. behavioral events не затронуты: отдельное storage, не бизнес-envelope (§37.16)", async () => {
    // Никакой миграции behavioral-таблиц под business envelope.
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'catalog' AND table_name = 'MarketplaceBehavioralEvent'`;
    const names = cols.map((c) => c.column_name);
    expect(names).not.toContain("actor");
    expect(names).not.toContain("entityId");
    expect(names).not.toContain("correlationId");

    // Инжестция продолжает работать (свой envelope: eventId/sessionId/occurredAt).
    const eventId = crypto.randomUUID();
    const sessionId = `sess-env-${stamp}`;
    await request(app.getHttpServer())
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
    const row = await prisma.marketplaceBehavioralEvent.findUnique({ where: { eventId } });
    expect(row).not.toBeNull();
    expect(row!.sessionId).toBe(sessionId);
    expect(row!.eventId).toBe(eventId);
  });

  it("9. legacy event (без actor, NULL correlation): читаем + FAILED/PENDING не мутирует envelope (§37.12/§37.17)", async () => {
    // onAny-хендлеры регистрируются БЕЗ отписки и остаются до конца прогона —
    // это безопасно: observer только коллекционирует (без эффектов), а failing
    // бросает ТОЛЬКО для legacy1.id, который после первого publishPending
    // становится FAILED и НИКОГДА не доставляется повторно (publishPending
    // выбирает только PENDING). Повторная доставка legacy2 обрабатывается
    // failing-хендлером без эффекта (id не совпадает).
    const seen: OutboxEnvelope[] = [];
    const observer = (ev: OutboxEnvelope): void => {
      seen.push(ev);
    };
    eventBus.onAny(observer);
    const failing = (ev: OutboxEnvelope): void => {
      if (ev.id === legacy1.id) throw new Error("simulated-consumer-failure");
    };
    eventBus.onAny(failing);

    // Legacy-строка в до-1.15A формате: нет actor, NULL correlation/causation.
    const legacy1 = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Order",
        aggregateId: `legacy-${stamp}`,
        eventType: "OrderStatusChanged",
        payload: { from: "NEW", to: "IN_PROCESSING" },
        correlationId: null,
        causationId: null,
        status: "PENDING",
      },
    });
    legacyEventIds.push(legacy1.id);

    await eventBus.publishPending();

    // Consumer-ошибка → FAILED; business envelope (eventId/occurredAt/payload/actor/correlation) НЕ мутирован.
    const after1 = await prisma.outboxEvent.findUnique({ where: { id: legacy1.id } });
    expect(after1!.status).toBe("FAILED");
    expect(after1!.error).toContain("simulated-consumer-failure");
    expect(after1!.id).toBe(legacy1.id);
    expect(after1!.createdAt).toEqual(legacy1.createdAt);
    expect(after1!.payload).toEqual({ from: "NEW", to: "IN_PROCESSING" });
    expect(after1!.actor).toBeNull();
    expect(after1!.correlationId).toBeNull();
    expect(after1!.causationId).toBeNull();

    // §19: consumer (observer) получил NORMALIZED canonical envelope для legacy строки.
    const seenLegacy = seen.find((e) => e.id === legacy1.id);
    expect(seenLegacy).toBeDefined();
    expect(seenLegacy!.actor).toBeNull(); // legacy actor → null (UNKNOWN), без backfill
    expect(seenLegacy!.entityId).toBe(`legacy-${stamp}`);
    expect(seenLegacy!.entityType).toBe("Order");
    expect(seenLegacy!.occurredAt).toBe(legacy1.createdAt.toISOString());
    expect(seenLegacy!.correlationId).toBeNull();

    // Здоровая доставка legacy-строки → PUBLISHED, envelope не мутирован.
    const legacy2 = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Order",
        aggregateId: `legacy2-${stamp}`,
        eventType: "OrderStatusChanged",
        payload: { from: "NEW", to: "IN_PROCESSING" },
        correlationId: null,
        causationId: null,
        status: "PENDING",
      },
    });
    legacyEventIds.push(legacy2.id);
    await eventBus.publishPending();
    const after2 = await prisma.outboxEvent.findUnique({ where: { id: legacy2.id } });
    expect(after2!.status).toBe("PUBLISHED");
    expect(after2!.id).toBe(legacy2.id);
    expect(after2!.actor).toBeNull();
    expect(after2!.payload).toEqual({ from: "NEW", to: "IN_PROCESSING" });
    expect(after2!.createdAt).toEqual(legacy2.createdAt);
  });

  it("10. независимые request chains остаются различными (§37.18)", async () => {
    const o1 = (await bootstrap().expect(201)).body.order;
    const o2 = (await bootstrap().expect(201)).body.order;
    orderIds.push(o1.id, o2.id);
    const e1 = (await eventsFor(o1.id)).find((e) => e.eventType === "OrderCreated")!;
    const e2 = (await eventsFor(o2.id)).find((e) => e.eventType === "OrderCreated")!;
    expect(e1.correlationId).not.toBe(e2.correlationId);
    expect(e1.correlationId).not.toBeNull();
    expect(e2.correlationId).not.toBeNull();
    expect(actorOf(e1.actor)).toEqual({ type: "USER", id: adminId });
    expect(actorOf(e2.actor)).toEqual({ type: "USER", id: adminId });
  });
});
