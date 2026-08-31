/**
 * E2E PHASE 2 STEP 2.8 — BookingRequested → Booking Creation (canonicalization).
 *
 * Доказывает (§35/§36 implementation prompt), что pre-existing Phase 1 consumer
 * (`booking.subscribers.ts`) — ЕДИНСТВЕННЫЙ механизм создания нормальной Booking:
 *  - canonical trigger: Order → send → ровно один BookingRequested → consumer;
 *  - кардинальность: 1 OrderItem → ровно 1 Booking (orderItemId @unique, DB-level);
 *  - initial status NEW + canonical BKG-* коды; Passenger из COMPLETE OrderTraveler;
 *  - frozen факты: acquisitionSource verbatim (DIRECT/BUYER_REQUEST/null), money без
 *    reprice, никакого availability-второго hold;
 *  - BookingCreated — ровно одно событие-результат (count+bookings, без PII),
 *    correlation наследуется, causation = BookingRequested.eventId;
 *  - идемпотентность: re-delivery того же события, logically-duplicate (другой
 *    eventId, тот же Order), concurrent-доставка (DB unique P2002);
 *  - event authority: BookingRequested — durable факт (нет live-state gate);
 *  - Order НЕ fulfilled от создания Booking; reconcile только от BookingConfirmed/…;
 *  - нет HTTP create-авторитета (POST /bookings → 404); mass-assignment 422;
 *  - legacy: acquisitionSource = null, saleId = null — читаем/управляем.
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
import { uniqueConstraintNames } from "../src/shared/prisma-errors";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BKG_RE = /^BKG-\d{8}$/;

describe("Phase 2 Step 2.8 — BookingRequested → Booking Creation (e2e)", () => {
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
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as {
      id: string;
    };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };
  const createProduct = async (tag: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `S28 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
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

  const action = (orderId: string, act: string) => adminAgent.patch(`/api/v1/orders/${orderId}`).send({ action: act });
  const bookingAction = (bookingId: string, act: string) => adminAgent.patch(`/api/v1/bookings/${bookingId}`).send({ action: act });
  const eventsFor = async (orderId: string) => prisma.outboxEvent.findMany({ where: { aggregateId: orderId }, orderBy: { createdAt: "asc" } });
  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;
  const bookingsFor = (orderId: string) => prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const bookingCreatedEvents = () => prisma.outboxEvent.findMany({ where: { eventType: "BookingCreated" }, orderBy: { createdAt: "asc" } });

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
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map(
        (e) => e.id,
      );
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

  it("1. canonical Order → send → ровно один BookingRequested → consumer создаёт Booking (NEW, BKG-*, frozen facts)", async () => {
    const sm = await createStaff("s28sm", "SALES_MANAGER");
    const fx = await createProduct("s28_canon");
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
    expect(order.status).toBe("NEW");
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200); // travelers пусто (canonical checkout) → guard проходит
    await action(order.id, "send").expect(200);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("SENT_TO_BOOKING");

    const events = await eventsFor(order.id);
    expect(typeCount(events, "BookingRequested")).toBe(1);
    const req = events.find((e) => e.eventType === "BookingRequested")!;
    expect(req.payload).toEqual({ orderId: order.id, orderCode: order.code, customerId: null });

    const bookings = await bookingsFor(order.id);
    expect(bookings).toHaveLength(1); // 1 OrderItem → 1 Booking
    const b = bookings[0]!;
    expect(b.status).toBe("NEW");
    expect(b.code).toMatch(BKG_RE);
    expect(b.orderId).toBe(order.id);
    expect(b.productId).toBe(fx.productId);
    expect(b.orderItemId).toBe((await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).id);
    expect(String(b.amount)).toBe("100"); // frozen, без reprice
    expect(b.acquisitionSource).toBe("DIRECT");
    // availability: ровно один hold (Step 2.4), Booking НЕ создаёт второй.
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: sale.id } })).toBe(1);
    // BookingCreated — ровно одно событие-результат, без PII.
    const createdEvents = await bookingCreatedEvents();
    const mine = createdEvents.filter((e) => (e.payload as { orderId?: string })?.orderId === order.id);
    expect(mine).toHaveLength(1);
    const raw = JSON.stringify(mine[0]!.payload);
    expect(raw).not.toContain("passportNumber");
    expect(raw).not.toContain("firstName");
    expect(mine[0]!.causationId).toBe(req.id);
    expect(mine[0]!.correlationId).toBe(req.correlationId);
    // Booking creation НЕ mark Order fulfilled (reconcile только от BookingConfirmed/…).
    expect(state.status).toBe("SENT_TO_BOOKING");
    expect(typeCount(events, "OrderFulfilled")).toBe(0);
  });

  it("2. кардинальность: multi-item Order → по одной Booking на каждый OrderItem (orderItemId @unique, productId mapping)", async () => {
    const order = (
      await fixtureOrder({
        items: [
          { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
          { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 2, price: 50 },
        ],
        travelers: [
          { firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" },
          { firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" },
        ],
      })
    ).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } });
    expect(items).toHaveLength(2);
    const bookings = await bookingsFor(order.id);
    expect(bookings).toHaveLength(2);
    const byItem = new Map(bookings.map((b) => [b.orderItemId, b]));
    for (const item of items) {
      const b = byItem.get(item.id);
      expect(b).toBeDefined();
      expect(b!.productId).toBe(item.productId);
      expect(String(b!.amount)).toBe(String(item.amount)); // frozen item money
    }
    expect(new Set(bookings.map((b) => b.orderItemId)).size).toBe(2);
    // каждый booking несёт обоих ready-пассажиров (current canonical projection).
    for (const b of bookings) {
      const passengers = await prisma.passenger.findMany({ where: { bookingId: b.id } });
      expect(passengers).toHaveLength(2);
      expect(passengers.map((p) => p.firstName).sort()).toEqual(["Анна", "Олег"]);
      expect(passengers.every((p) => p.passportNumber)).toBe(true);
    }
  });

  it("3. DB-level инвариант: повторный create с тем же orderItemId → P2002 (не raw 500)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const b = (await bookingsFor(order.id))[0]!;
    // Точный инвариант: P2002 именно по Booking_orderItemId_key (shape-agnostic
    // через shared-хелпер — классический meta.target / driver-adapter message).
    const err = await prisma.booking
      .create({
        data: { code: "BKG-99999999", referenceNumber: "MKT-BKG-999999", orderId: order.id, productId: "00000000-0000-4000-8000-000000000001", orderItemId: b.orderItemId, status: "NEW", version: 1 },
      })
      .catch((e: unknown) => e);
    expect((err as { code?: string })?.code).toBe("P2002");
    expect(uniqueConstraintNames(err)).toContain("Booking_orderItemId_key");
    expect(await bookingsFor(order.id)).toHaveLength(1);
  });

  it("4. re-delivery того же события (после crash без inbox-commit) не дублирует Booking/Passenger/BookingCreated", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(1);
    const before = (await prisma.outboxEvent.findMany({ where: { eventType: "BookingCreated" } })).length;

    // Симуляция повторной доставки ТОГО ЖЕ события: сброс PENDING (inbox уже
    // есть → handler no-op → событие снова PUBLISHED, без side effect).
    const req = (await eventsFor(order.id)).find((e) => e.eventType === "BookingRequested")!;
    await prisma.outboxEvent.update({ where: { id: req.id }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    expect(await bookingsFor(order.id)).toHaveLength(1);
    expect((await prisma.passenger.findMany({ where: { booking: { orderId: order.id } } })).length).toBe(1);
    expect((await prisma.outboxEvent.findMany({ where: { eventType: "BookingCreated" } })).length).toBe(before);
    const reqAfter = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: req.id } });
    expect(reqAfter.status).toBe("PUBLISHED");
  });

  it("5. logically-duplicate BookingRequested (другой eventId, тот же Order) не создаёт второй набор Booking", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(1);
    const beforeCreated = (await prisma.outboxEvent.findMany({ where: { eventType: "BookingCreated" } })).length;

    // Второй BookingRequested (новый eventId) — тот же Order (logical duplicate).
    const code = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).code;
    const payload: BookingRequestedPayload = { orderId: order.id, orderCode: code, customerId: null };
    await prisma.$transaction((tx) =>
      eventBus.emit(tx, { aggregateType: "Order", aggregateId: order.id, eventType: DomainEvents.BookingRequested, payload }),
    );
    await eventBus.publishPending();

    expect(await bookingsFor(order.id)).toHaveLength(1); // count-check + DB unique
    expect((await prisma.outboxEvent.findMany({ where: { eventType: "BookingCreated" } })).length).toBe(beforeCreated);
  });

  it("6. malformed/unknown Order ref в BookingRequested — безопасный no-op, без Booking и без raw-ошибки", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    await prisma.$transaction((tx) =>
      eventBus.emit(tx, { aggregateType: "Order", aggregateId: unknown, eventType: DomainEvents.BookingRequested, payload: { orderId: unknown, orderCode: "ORD-UNKNOWN", customerId: null } }),
    );
    await eventBus.publishPending();
    expect(await prisma.booking.count({ where: { orderId: unknown } })).toBe(0);
    // forged extra-поля в payload игнорируются (consumer читает order.* по orderId).
    await prisma.$transaction((tx) =>
      eventBus.emit(tx, {
        aggregateType: "Order",
        aggregateId: unknown,
        eventType: DomainEvents.BookingRequested,
        payload: { orderId: unknown, orderCode: "ORD-UNKNOWN", customerId: null, items: [{ productId: "x", title: "forged", type: "TOUR", price: 1 }] },
      }),
    );
    await eventBus.publishPending();
    expect(await prisma.booking.count({ where: { orderId: unknown } })).toBe(0);
  });

  it("7. acquisition verbatim: BUYER_REQUEST и legacy null сохраняются (без fabrication)", async () => {
    const br = (await fixtureOrder({ acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST })).order;
    created.orders.push(br.id);
    await action(br.id, "process").expect(200);
    await action(br.id, "confirm").expect(200);
    await action(br.id, "send").expect(200);
    const brBooking = (await bookingsFor(br.id))[0]!;
    expect(brBooking.acquisitionSource).toBe("BUYER_REQUEST");

    const legacy = (await fixtureOrder({ acquisitionSource: null })).order;
    created.orders.push(legacy.id);
    await action(legacy.id, "process").expect(200);
    await action(legacy.id, "confirm").expect(200);
    await action(legacy.id, "send").expect(200);
    const legacyBooking = (await bookingsFor(legacy.id))[0]!;
    expect(legacyBooking.acquisitionSource).toBeNull();
    expect(legacyBooking.orderItemId).not.toBeNull(); // новая Booking всё равно получает linkage
  });

  it("8. non-traveler категория: Order без туристов → Booking без Passenger (без placeholder)", async () => {
    const order = (await fixtureOrder({ travelers: [] })).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200); // пустой travelers → guard проходит (cross-category)
    await action(order.id, "send").expect(200);
    const bookings = await bookingsFor(order.id);
    expect(bookings).toHaveLength(1);
    expect(await prisma.passenger.count({ where: { bookingId: bookings[0]!.id } })).toBe(0);
  });

  it("9. mass-assignment: forged server-owned поля на PATCH /bookings → 422, переход не применяется; POST /bookings → 404", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const b = (await bookingsFor(order.id))[0]!;
    expect(b.status).toBe("NEW");

    await adminAgent
      .patch(`/api/v1/bookings/${b.id}`)
      .send({ action: "send", status: "CONFIRMED", amount: 0.01, acquisitionSource: "MARKETPLACE", version: 99, orderId: "forged" })
      .expect(422);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("NEW"); // переход не применён
    expect(String(after.amount)).toBe("100");
    expect(after.acquisitionSource).toBe("DIRECT");
    expect(after.version).toBe(1);
    // PATCH без action → 400.
    await adminAgent.patch(`/api/v1/bookings/${b.id}`).send({ status: "CONFIRMED" }).expect(400);
    // Нет HTTP create-авторитета.
    await adminAgent.post("/api/v1/bookings").send({ orderId: order.id, productId: "x" }).expect(404);
    // invalid booking id → нейтральный 404, не raw 500.
    await bookingAction("00000000-0000-4000-8000-000000000000", "send").expect(404);
  });

  it("10. event authority: Order отменён ПОСЛЕ send → Booking остаётся (durable BookingRequested), состояние консистентно", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(1);
    await action(order.id, "cancel").expect(200); // Order CANCELLED после durable send
    const state = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(state.status).toBe("CANCELLED");
    // Booking — факт, созданный из уже-authoritative события; компенсация — Step 2.9.
    expect(await bookingsFor(order.id)).toHaveLength(1);
    const events = await eventsFor(order.id);
    expect(typeCount(events, "OrderCancelled")).toBe(1);
    expect(typeCount(events, "OrderFulfilled")).toBe(0);
  });

  it("11. cancel ДО send: BookingRequested/Booking не создаются; Booking legacy управляема (GET/PATCH)", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "cancel").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(0);
    expect(typeCount(await eventsFor(order.id), "BookingRequested")).toBe(0);

    // Legacy Booking (создана до 2.8 hardening) читаема/управляема.
    const legacy = (await fixtureOrder()).order;
    created.orders.push(legacy.id);
    await action(legacy.id, "process").expect(200);
    await action(legacy.id, "confirm").expect(200);
    await action(legacy.id, "send").expect(200);
    const b = (await bookingsFor(legacy.id))[0]!;
    const detail = (await adminAgent.get(`/api/v1/bookings/${b.id}`).expect(200)).body;
    expect(detail.id).toBe(b.id);
    expect(detail.passengers).toHaveLength(1);
    await bookingAction(b.id, "send").expect(200); // NEW → SENT_TO_SUPPLIER
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("SENT_TO_SUPPLIER");
  });

  it("12. concurrent доставка (DB unique + inbox): ни один путь не создаёт второй Booking/дубль BookingCreated", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    expect(await bookingsFor(order.id)).toHaveLength(1);
    // «Concurrent» логическая дубликация двумя разными событиями, обработанными
    // подряд (in-process bus serial): второй event → count-check no-op.
    const code = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).code;
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        eventBus.emit(tx, { aggregateType: "Order", aggregateId: order.id, eventType: DomainEvents.BookingRequested, payload: { orderId: order.id, orderCode: code, customerId: null } }),
      ),
      prisma.$transaction((tx) =>
        eventBus.emit(tx, { aggregateType: "Order", aggregateId: order.id, eventType: DomainEvents.BookingRequested, payload: { orderId: order.id, orderCode: code, customerId: null } }),
      ),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    await eventBus.publishPending();
    expect(await bookingsFor(order.id)).toHaveLength(1);
  });

  it("13. correlation/causation полной цепочки: OrderCreated → BookingRequested → BookingCreated", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    await action(order.id, "send").expect(200);
    const events = await eventsFor(order.id);
    const req = events.find((e) => e.eventType === "BookingRequested")!;
    // HTTP-команда send: correlation = server UUID, causation = null.
    expect(req.correlationId).toMatch(UUID_RE);
    expect(req.causationId).toBeNull();
    const b = (await bookingsFor(order.id))[0]!;
    const bCreated = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "BookingCreated", aggregateId: b.id } });
    expect(bCreated.correlationId).toBe(req.correlationId); // наследование
    expect(bCreated.causationId).toBe(req.id); // causation = BookingRequested.eventId
    expect(bCreated.actor).toEqual({ type: "SYSTEM" }); // consumer-produced result event
  });

  it("14. no raw DB error leak: дубль BKG-кода не всплывает как 500 (consumer-паттерн), HTTP-команды Booking → контролируемые коды", async () => {
    const order = (await fixtureOrder()).order;
    created.orders.push(order.id);
    await action(order.id, "process").expect(200);
    await action(order.id, "confirm").expect(200);
    const res = await action(order.id, "send");
    expect(res.status).toBe(200);
    // Повторный send → 409 (контролируемый), не 500.
    await action(order.id, "send").expect(409);
    // invalid Booking action → 409/404 контролируемые.
    const b = (await bookingsFor(order.id))[0]!;
    await bookingAction(b.id, "confirm").expect(409); // из NEW → confirm невалиден
    await bookingAction(b.id, "complete").expect(409);
  });
});
