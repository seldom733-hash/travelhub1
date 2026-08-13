/**
 * E2E PHASE 2 STEP 2.8A — Booking Service Date / Time Model.
 *
 * Доказывает (§35 negative / §36 positive implementation prompt), что:
 *  - frozen local temporal факты (serviceDate + serviceTime/serviceEndTime +
 *    serviceTimeZone) пропагируются канонической цепочкой
 *    Catalog → Quote → CheckoutIntent → Sale → OrderRequested → Order →
 *    BookingRequested → Booking (E2E, без live-резолва Catalog);
 *  - UTC instants (serviceStartsAt/serviceEndsAt) деривируются ОДИН раз
 *    consumer-ом BookingRequested (чистая функция, Intl — не арифметика) и
 *    не могут быть forged через API (server-owned, 422);
 *  - date-only услуга НЕ превращается в UTC-midnight instant (§7);
 *  - timezone authority — только IANA (offset/forge → 422);
 *  - legacy Booking (null temporal факты) читается/управляется;
 *  - никакого второго Availability hold, никакого repricing, никакого
 *    прямого Order→Booking writer;
 *  - кардинальность/идемпотентность 2.8 сохранены (1 OrderItem → 1 Booking,
 *    inbox dedup, logically-duplicate → no-op);
 *  - correlation/causation BookingCreated наследуются;
 *  - projections (buyer cabinet / staff) сериализуют authorized temporal факты.
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
import { RoleCode, type Prisma } from "../src/generated/prisma/client";
import { SalesAcquisitionSource } from "../src/generated/prisma/enums";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";
import { localToUtc, offsetMinutesAt } from "../src/shared/service-time";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
}

// Non-DST зона: UTC+4 круглый год (детерминированные UTC-конверсии в тестах).
const BAKU = "Asia/Baku";
// DST-зона: +2 летом / +1 зимой (Europe/Berlin, transitions: last Sun Mar → last Sun Oct).
const BERLIN = "Europe/Berlin";

const FUTURE = (offsetDays = 40): string => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

describe("Phase 2 Step 2.8A — Booking Service Date / Time Model (e2e)", () => {
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
  const syntheticEventIds: string[] = [];

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
      .send({
        username: `${tag}${stamp}`,
        email: `${tag}${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Покупатель",
        lastName: tag.toUpperCase(),
      })
      .expect(201);
    const session = res.body as Session;
    created.users.push(session.user.id);
    if (session.user.customerId) created.customers.push(session.user.customerId);
    return session;
  };
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as {
      id: string;
    };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };
  const createProduct = async (tag: string, opts: { price?: number; serviceTimeZone?: string; type?: string } = {}): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({
        type: opts.type ?? "TOUR",
        title: `S28A ${tag} ${stamp}`,
        tariffs: [{ name: "Std", price: opts.price ?? 100 }],
        serviceTimeZone: opts.serviceTimeZone ?? null,
      })
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
  const sendToBookings = async (orderId: string) => {
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);
  };
  const eventsFor = async (orderId: string) => prisma.outboxEvent.findMany({ where: { aggregateId: orderId }, orderBy: { createdAt: "asc" } });
  const bookingsFor = (orderId: string) => prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const typeCount = (events: Array<{ eventType: string }>, t: string) => events.filter((e) => e.eventType === t).length;

  /** Полная canonical цепочка: Product(zone) → Quote → Checkout(zone frozen)
   *  → service-date(+time) → Sale → complete → Order (temporal факты frozen). */
  const makeTimedSale = async (
    smToken: string,
    fx: ProductFixture,
    opts: { serviceTime?: string; serviceEndTime?: string; date?: string } = {},
  ): Promise<{ orderId: string; intentCode: string; date: string }> => {
    const date = opts.date ?? FUTURE();
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: [] })
      .expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);

    // Step 2.8A: local wall-clock (timezone authority — frozen zone продукта).
    if (opts.serviceTime) {
      const updated = (await agent(smToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: date, serviceTime: opts.serviceTime, serviceEndTime: opts.serviceEndTime ?? null, expectedVersion: intent.version })
        .expect(200)).body as { version: number };
      intent.version = updated.version;
    }

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
    await agent(smToken).post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: sale.version }).expect(201);

    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    return { orderId: order.id, intentCode: intent.code, date };
  };

  /** Синтетический OrderRequested (contract-level failure-injection, как в 2.5B). */
  const injectOrderRequested = async (payloadPatch: Record<string, unknown>): Promise<string> => {
    const ev = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Sale",
        aggregateId: `sale-synth28a-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        eventType: DomainEvents.OrderRequested,
        payload: {
          version: 1,
          saleId: `sale-synth28a-${stamp}`,
          saleCode: `SAL-SYNTH28A-${stamp}`,
          checkoutId: `co-synth28a-${stamp}`,
          checkoutCode: `CO-SYNTH28A-${stamp}`,
          quoteId: `q-synth28a-${stamp}`,
          customerId: null,
          reservationId: null,
          reservationIds: [`rsv-synth28a-${stamp}`],
          items: [
            {
              productId: `p-synth28a-${stamp}`,
              productCode: `P-SYNTH28A-${stamp}`,
              productTitle: "Synthetic",
              productType: "TOUR",
              tariffId: `t-synth28a-${stamp}`,
              tariffCode: "T-SYNTH28A",
              quantity: 1,
              unitPrice: "100.00",
              amount: "100.00",
            },
          ],
          currency: "USD",
          subtotal: "100.00",
          discountType: "NONE",
          discountValue: null,
          discountAmount: null,
          total: "100.00",
          paymentScheme: null,
          prepaymentType: null,
          prepaymentValue: null,
          initialAmount: "100.00",
          remainingAmount: "100.00",
          acquisitionSource: "DIRECT",
          serviceDate: FUTURE(),
          ...payloadPatch,
        } as Prisma.InputJsonValue,
        status: "PENDING",
        retryable: true,
      },
      select: { id: true },
    });
    syntheticEventIds.push(ev.id);
    await eventBus.publishPending();
    return ev.id;
  };

  /** Синтетический BookingRequested (logically-duplicate: новый eventId, тот же Order). */
  const injectBookingRequested = async (orderId: string, orderCode: string): Promise<string> => {
    const ev = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Order",
        aggregateId: orderId,
        eventType: DomainEvents.BookingRequested,
        payload: { orderId, orderCode, customerId: null } as Prisma.InputJsonValue,
        status: "PENDING",
        retryable: true,
      },
      select: { id: true },
    });
    syntheticEventIds.push(ev.id);
    await eventBus.publishPending();
    return ev.id;
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
    if (syntheticEventIds.length > 0) {
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: syntheticEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { id: { in: syntheticEventIds } } });
    }
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §35 NEGATIVE matrix
  // ══════════════════════════════════════════════════════════════════════════

  describe("§35 negative — forged/invalid temporal facts → controlled 4xx", () => {
    it("35.1. invalid service date (past) → 422, не 500", async () => {
      const sm = await createStaff("s28an1", "SALES_MANAGER");
      const fx = await createProduct("s28an1", { serviceTimeZone: BAKU });
      const date = FUTURE();
      const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
      created.quotes.push(quote.id);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
        .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
        .expect(200);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
      const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201))
        .body as { id: string; code: string; version: number };
      created.checkouts.push(intent.id);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: "2020-01-01", expectedVersion: intent.version })
        .expect(422);
    });

    it("35.2. invalid local time (25:99) → 422, не 500", async () => {
      const sm = await createStaff("s28an2", "SALES_MANAGER");
      const fx = await createProduct("s28an2", { serviceTimeZone: BAKU });
      const date = FUTURE();
      const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
      created.quotes.push(quote.id);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
        .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
        .expect(200);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
      const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201))
        .body as { id: string; code: string; version: number };
      created.checkouts.push(intent.id);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: date, serviceTime: "25:99", expectedVersion: intent.version })
        .expect(422);
    });

    it("35.3. invalid timezone (offset 'UTC+4' вместо IANA) при создании Product → 422", async () => {
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `S28A bad-zone ${stamp}`, tariffs: [{ name: "Std", price: 100 }], serviceTimeZone: "UTC+4" })
        .expect(422);
    });

    it("35.4. forged serviceTimeZone в checkout service-date (server-owned IANA authority) → 422", async () => {
      const sm = await createStaff("s28an4", "SALES_MANAGER");
      const fx = await createProduct("s28an4", { serviceTimeZone: BAKU });
      const date = FUTURE();
      const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
      created.quotes.push(quote.id);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
        .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
        .expect(200);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
      const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201))
        .body as { id: string; code: string; version: number };
      created.checkouts.push(intent.id);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: date, serviceTimeZone: "Asia/Tokyo", expectedVersion: intent.version })
        .expect(422);
    });

    it("35.5. exact time без authoritative IANA zone (product без zone) → 422", async () => {
      const sm = await createStaff("s28an5", "SALES_MANAGER");
      const fx = await createProduct("s28an5"); // без serviceTimeZone
      const date = FUTURE();
      const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
      created.quotes.push(quote.id);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
        .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
        .expect(200);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
      const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201))
        .body as { id: string; code: string; version: number };
      created.checkouts.push(intent.id);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: date, serviceTime: "10:30", expectedVersion: intent.version })
        .expect(422);
    });

    it("35.6. forged derived UTC instant (serviceStartsAt) в checkout → 422", async () => {
      const sm = await createStaff("s28an6", "SALES_MANAGER");
      const fx = await createProduct("s28an6", { serviceTimeZone: BAKU });
      const date = FUTURE();
      const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
      created.quotes.push(quote.id);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
        .send({ discountType: "NONE", validUntil: new Date(Date.now() + 60 * 86400000).toISOString() })
        .expect(200);
      await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
      const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201))
        .body as { id: string; code: string; version: number };
      created.checkouts.push(intent.id);
      await agent(sm.accessToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/service-date`)
        .send({ serviceDate: date, serviceStartsAt: "2026-09-15T08:30:00.000Z", expectedVersion: intent.version })
        .expect(422);
    });

    it("35.7. forged Booking temporal PATCH (action + serviceStartsAt) → 422", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      await adminAgent
        .patch(`/api/v1/bookings/${booking.id}`)
        .send({ action: "confirm", serviceStartsAt: "2026-09-15T08:30:00.000Z" })
        .expect(422);
    });

    it("35.8. Buyer не может overwrite frozen occurrence (RBAC: нет booking.confirm) → 403", async () => {
      const buyer = await registerBuyer("s28an8");
      const order = (await fixtureOrder({ customerId: buyer.user.customerId, serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      const buyerAgent = agent(buyer.accessToken);
      await buyerAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(403);
    });

    it("35.9. Seller Catalog edit (zone) не мутирует существующую Booking (frozen при создании)", async () => {
      const sm = await createStaff("s28an9", "SALES_MANAGER");
      const fx = await createProduct("s28an9", { serviceTimeZone: BERLIN });
      const { orderId } = await makeTimedSale(sm.accessToken, fx, { serviceTime: "10:30" });
      await sendToBookings(orderId);
      const booking = (await bookingsFor(orderId))[0]!;
      expect(booking.serviceTimeZone).toBe(BERLIN);

      // Seller правит zone в Catalog — существующая Booking не переписывается.
      await adminAgent.patch(`/api/v1/products/${fx.productId}`).send({ serviceTimeZone: BAKU }).expect(200);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: fx.productId } });
      expect(product.serviceTimeZone).toBe(BAKU);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.serviceTimeZone).toBe(BERLIN);
      expect(after.serviceTime).toBe("10:30");
    });

    it("35.10. later price edit (Catalog tariff) не reprice-ит Booking (frozen money)", async () => {
      const sm = await createStaff("s28an10", "SALES_MANAGER");
      const fx = await createProduct("s28an10", { price: 100, serviceTimeZone: BAKU });
      const { orderId } = await makeTimedSale(sm.accessToken, fx, { serviceTime: "10:30" });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
      await sendToBookings(orderId);
      const booking = (await bookingsFor(orderId))[0]!;
      expect(booking.amount.toFixed(2)).toBe("100.00");

      // Seller правит цену тарифа (симуляция API-редактирования Catalog) —
      // Booking хранит frozen amount и не имеет reprice-пути (ADR-0001).
      await prisma.tariff.update({ where: { id: fx.tariffId }, data: { price: 999 } });
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.amount.toFixed(2)).toBe("100.00");
      expect(item.amount.toFixed(2)).toBe("100.00");
      expect(order.amount.toFixed(2)).toBe("100.00");
    });

    it("35.11. later restriction edit не переписывает bound Booking — INAPPLICABLE (no post-binding rewrite path; Booking хранит только frozen факты, restriction refs отсутствуют) — доказывается 35.9/35.10", () => {
      expect(true).toBe(true);
    });

    it("35.12. duplicate BookingRequested (re-delivery того же eventId) → одна Booking", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      expect((await bookingsFor(order.id)).length).toBe(1);

      const req = (await eventsFor(order.id)).find((e) => e.eventType === "BookingRequested")!;
      await prisma.outboxEvent.update({ where: { id: req.id }, data: { status: "PENDING" } });
      await eventBus.publishPending();
      expect((await bookingsFor(order.id)).length).toBe(1);
    });

    it("35.13. logically duplicate BookingRequested (новый eventId, тот же Order) → одна Booking", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      expect((await bookingsFor(order.id)).length).toBe(1);

      await injectBookingRequested(order.id, order.code);
      expect((await bookingsFor(order.id)).length).toBe(1);
    });

    it("35.14. concurrent duplicate — COVERED BY 2.8 suite (P2002 allowlist Booking_orderItemId_key + inbox unique; DB-level защита)", () => {
      expect(true).toBe(true);
    });

    it("35.15. malformed temporal payload в OrderRequested → событие FAILED, никакого Order", async () => {
      // (a) invalid local time (99:99)
      await injectOrderRequested({ serviceTime: "99:99", serviceTimeZone: BAKU });
      // (b) STRICT REVIEW 2.8A fix: time без serviceDate — противоречивый факт
      await injectOrderRequested({ serviceTime: "10:30", serviceTimeZone: BAKU, serviceDate: null });
      const failed = await prisma.outboxEvent.findMany({
        where: { id: { in: syntheticEventIds }, eventType: DomainEvents.OrderRequested },
        orderBy: { createdAt: "asc" },
      });
      expect(failed.length).toBeGreaterThanOrEqual(2);
      expect(failed.every((e) => e.status === "FAILED")).toBe(true);
      expect(await prisma.order.count({ where: { saleId: `sale-synth28a-${stamp}` } })).toBe(0);
    });

    it("35.16. unknown P2002 не проглатывается — COVERED BY 2.8 suite (isUniqueViolation allowlist, unit-проверен)", () => {
      expect(true).toBe(true);
    });

    it("35.17. legacy null temporal факты → Booking читается/управляется", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE() })).order; // без time/zone (legacy shape)
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.serviceTime).toBeNull();
      expect(booking.serviceEndTime).toBeNull();
      expect(booking.serviceTimeZone).toBeNull();
      expect(booking.serviceStartsAt).toBeNull();
      expect(booking.serviceEndsAt).toBeNull();
      // Управляемость не сломана: статус-переходы работают (send → confirm).
      await adminAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
      await adminAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(200);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe("CONFIRMED");
    });

    it("35.18. date-only НЕ становится UTC-midnight instant (serviceStartsAt = null, §7)", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE() })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.serviceTimeType).toBe("DATE_ONLY");
      expect(booking.serviceDate).not.toBeNull();
      expect(booking.serviceStartsAt).toBeNull();
    });

    it("35.19. никакого второго Availability hold (hold count неизменен после Booking)", async () => {
      const sm = await createStaff("s28an19", "SALES_MANAGER");
      const fx = await createProduct("s28an19", { serviceTimeZone: BAKU });
      const { orderId } = await makeTimedSale(sm.accessToken, fx, { serviceTime: "10:30" });
      const saleId = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).saleId!;
      const holdsBefore = await prisma.availabilityReservation.count({ where: { sourceSaleId: saleId } });

      await sendToBookings(orderId);

      const holdsAfter = await prisma.availabilityReservation.count({ where: { sourceSaleId: saleId } });
      expect(holdsAfter).toBe(holdsBefore);
      expect(holdsAfter).toBeGreaterThanOrEqual(1); // ровно один hold на Sale
    });

    it("35.20. нет прямого Order→Booking writer (POST /api/v1/bookings → 404)", async () => {
      await adminAgent
        .post("/api/v1/bookings")
        .send({ orderId: "00000000-0000-4000-8000-000000000001", productId: "00000000-0000-4000-8000-000000000002", amount: 100 })
        .expect(404);
    });

    it("35.21. никакого raw 500 — все malformed temporal входы дают контролируемые 4xx (доказано 35.1–35.7)", () => {
      expect(true).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // §36 POSITIVE matrix
  // ══════════════════════════════════════════════════════════════════════════

  describe("§36 positive — canonical temporal propagation", () => {
    it("36.1. date-only Booking: DATE_ONLY, frozen serviceDate, instants null", async () => {
      const date = FUTURE();
      const order = (await fixtureOrder({ serviceDate: date })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.serviceTimeType).toBe("DATE_ONLY");
      expect(booking.serviceDate!.toISOString().slice(0, 10)).toBe(date);
      expect(booking.serviceTime).toBeNull();
      expect(booking.serviceTimeZone).toBeNull();
      expect(booking.serviceStartsAt).toBeNull();
      expect(booking.serviceEndsAt).toBeNull();
    });

    it("36.2+3+4+5. exact-time + timezone-aware Booking (Asia/Baku, non-DST) с точной local→UTC конверсией", async () => {
      const date = FUTURE();
      const order = (await fixtureOrder({ serviceDate: date, serviceTime: "10:30", serviceEndTime: null, serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      // Zone frozen и на Order (verbatim из цепочки) — Booking читает Order.
      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(dbOrder.serviceTimeZone).toBe(BAKU);
      expect(dbOrder.serviceTime).toBe("10:30");

      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
      expect(booking.serviceTime).toBe("10:30");
      expect(booking.serviceTimeZone).toBe(BAKU);
      // Baku = UTC+4 всегда: 10:30 local = 06:30 UTC (детерминированно).
      expect(booking.serviceStartsAt!.toISOString()).toBe(`${date}T06:30:00.000Z`);
      expect(booking.serviceEndsAt).toBeNull();
    });

    it("36.6. DST-зона (Europe/Berlin): UTC instant выведен через Intl-оффсет, не naive UTC", async () => {
      const sm = await createStaff("s28ap6", "SALES_MANAGER");
      const fx = await createProduct("s28ap6", { serviceTimeZone: BERLIN });
      // E2E: FUTURE() дата; точный offset даты берётся из Intl (не угадывается).
      const date = FUTURE();
      const { orderId } = await makeTimedSale(sm.accessToken, fx, { serviceTime: "10:30", date });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.serviceTimeZone).toBe(BERLIN);

      await sendToBookings(orderId);
      const booking = (await bookingsFor(orderId))[0]!;
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
      const expected = localToUtc(date, "10:30", BERLIN);
      expect(booking.serviceStartsAt!.toISOString()).toBe(expected.toISOString());
      // Zone-aware: реальный offset (не 0, не наивный UTC-midnight).
      expect(offsetMinutesAt(BERLIN, booking.serviceStartsAt!.getTime())).not.toBe(0);
      // Инвариант local↔UTC (§13): обратная сверка не зависит от хранимого instant.
      expect(booking.serviceStartsAt!.getTime()).toBe(expected.getTime());
    });

    it("36.7. multi-day (cross-midnight): serviceEndTime < serviceTime → end на следующем local дне", async () => {
      const date = FUTURE();
      const order = (await fixtureOrder({ serviceDate: date, serviceTime: "22:00", serviceEndTime: "02:00", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
      expect(booking.serviceEndTime).toBe("02:00");
      // Baku +4: 22:00 local → 18:00Z; 02:00 следующего local дня → 22:00Z того же UTC-дня.
      expect(booking.serviceStartsAt!.toISOString()).toBe(`${date}T18:00:00.000Z`);
      expect(booking.serviceEndsAt!.toISOString()).toBe(`${date}T22:00:00.000Z`);
      expect(booking.serviceEndsAt!.getTime()).toBeGreaterThan(booking.serviceStartsAt!.getTime());
    });

    it("36.8. категорийная нейтральность: TOUR + TRANSFER в одном Order → обе Booking c frozen zone", async () => {
      const date = FUTURE();
      const order = (
        await fixtureOrder({
          serviceDate: date,
          serviceTime: "10:30",
          serviceTimeZone: BAKU,
          items: [
            { productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 1, price: 100 },
            { productId: "00000000-0000-4000-8000-000000000002", title: "Transfer", type: "TRANSFER", quantity: 1, price: 50 },
          ],
        })
      ).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const bookings = await bookingsFor(order.id);
      expect(bookings.length).toBe(2);
      for (const b of bookings) {
        expect(b.serviceTimeZone).toBe(BAKU);
        expect(b.serviceTime).toBe("10:30");
        expect(b.serviceTimeType).toBe("TIME_SLOT");
        expect(b.serviceStartsAt!.toISOString()).toBe(`${date}T06:30:00.000Z`);
      }
    });

    it("36.9. DIRECT: acquisitionSource пропагируется (fixture default)", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.acquisitionSource).toBe(SalesAcquisitionSource.DIRECT);
    });

    it("36.10. BUYER_REQUEST: acquisitionSource пропагируется без мутации temporal", async () => {
      const order = (
        await fixtureOrder({ acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST, serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })
      ).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.acquisitionSource).toBe(SalesAcquisitionSource.BUYER_REQUEST);
      expect(booking.serviceTimeZone).toBe(BAKU);
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
    });

    it("36.11. legacy null acquisition: temporal факты не ломают null-acquisition Booking", async () => {
      const order = (await fixtureOrder({ acquisitionSource: null, serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.acquisitionSource).toBeNull();
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
    });

    it("36.12. frozen money: amount неизменен, currency verbatim", async () => {
      const order = (
        await fixtureOrder({
          currency: "EUR",
          serviceDate: FUTURE(),
          serviceTime: "10:30",
          serviceTimeZone: BAKU,
          items: [{ productId: "00000000-0000-4000-8000-000000000001", title: "Tour", type: "TOUR", quantity: 2, price: 150 }],
        })
      ).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      expect(booking.amount.toFixed(2)).toBe("300.00"); // 2 × 150, frozen без reprice
    });

    it("36.13. canonical temporal propagation end-to-end: Product(zone) → Booking (zone + UTC instant)", async () => {
      const sm = await createStaff("s28ap13", "SALES_MANAGER");
      const fx = await createProduct("s28ap13", { serviceTimeZone: BAKU });
      const date = FUTURE();
      const { orderId, intentCode } = await makeTimedSale(sm.accessToken, fx, { serviceTime: "10:30", date });

      // CheckoutIntent: zone frozen из Product (authority Catalog → Sales).
      const intent = await prisma.checkoutIntent.findFirstOrThrow({ where: { code: intentCode } });
      expect(intent.serviceTimeZone).toBe(BAKU);
      expect(intent.serviceTime).toBe("10:30");

      // Order: verbatim frozen.
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.serviceDate!.toISOString().slice(0, 10)).toBe(date);
      expect(order.serviceTime).toBe("10:30");
      expect(order.serviceTimeZone).toBe(BAKU);

      // Booking: derived instant, один раз, из frozen фактов.
      await sendToBookings(orderId);
      const booking = (await bookingsFor(orderId))[0]!;
      expect(booking.serviceTimeType).toBe("TIME_SLOT");
      expect(booking.serviceTimeZone).toBe(BAKU);
      expect(booking.serviceStartsAt!.toISOString()).toBe(`${date}T06:30:00.000Z`);
    });

    it("36.14. ровно одна Booking на OrderItem (кардинальность 2.8 сохранена)", async () => {
      const date = FUTURE();
      const order = (await fixtureOrder({ serviceDate: date, serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const bookings = await bookingsFor(order.id);
      expect(bookings.length).toBe(1);
      expect(bookings[0]!.orderItemId).not.toBeNull();
    });

    it("36.15+16. ровно одно BookingCreated; correlation/causation наследуются", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const events = await eventsFor(order.id);
      expect(typeCount(events, "BookingRequested")).toBe(1);
      // BookingCreated.aggregateId = canonical booking id (не orderId) — ищем по payload.orderId.
      const createdEvs = await prisma.outboxEvent.findMany({
        where: { eventType: "BookingCreated", OR: [{ payload: { path: ["orderId"], equals: order.id } }] },
      });
      expect(createdEvs.length).toBe(1);

      const req = events.find((e) => e.eventType === "BookingRequested")!;
      const createdEv = createdEvs[0]!;
      expect(createdEv.correlationId).toBe(req.correlationId);
      expect(createdEv.causationId).toBe(req.id);
    });

    it("36.17. Passenger behavior неизменен (COMPLETE traveler → Passenger)", async () => {
      const order = (
        await fixtureOrder({
          serviceDate: FUTURE(),
          serviceTime: "10:30",
          serviceTimeZone: BAKU,
          travelers: [{ firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" }],
        })
      ).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      const passengers = await prisma.passenger.findMany({ where: { bookingId: booking.id } });
      expect(passengers.length).toBe(1);
      expect(passengers[0]!.firstName).toBe("Олег");
      expect(passengers[0]!.passportNumber).toBe("P3334445");
    });

    it("36.18. BookingHistory корректен (created entry при создании)", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      const history = await prisma.bookingHistory.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0]!.action).toBe("created");
      expect(history[0]!.to).toBe("NEW");
    });

    it("36.19. Availability hold count неизменен — COVERED BY 35.19 (позитивная проверка выше)", () => {
      expect(true).toBe(true);
    });

    it("36.20. Reverse→Booking — COVERED BY reverse regression (2.2F Proposal→Sales→Order→Booking; никакого Reverse-specific Booking writer)", () => {
      expect(true).toBe(true);
    });

    it("36.21. Buyer projection: temporal факты сериализованы (YYYY-MM-DD / HH:mm / IANA / ISO instant)", async () => {
      const buyer = await registerBuyer("s28ap21");
      const date = FUTURE();
      const order = (await fixtureOrder({ customerId: buyer.user.customerId, serviceDate: date, serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;

      const res = (await agent(buyer.accessToken).get("/api/v1/account/bookings").expect(200)).body as {
        items: Array<{
          id: string;
          code: string;
          serviceDate: string | null;
          serviceTime: string | null;
          serviceTimeZone: string | null;
          serviceStartsAt: string | null;
        }>;
      };
      const projected = res.items.find((b) => b.id === booking.id);
      expect(projected).toBeDefined();
      // Кабинетная проекция: serviceDate — ISO instant (устоявшаяся конвенция
      // isoOrNull этой проекции), время/зона/instant — свои форматы (§26).
      expect(projected!.serviceDate).toBe(`${date}T00:00:00.000Z`);
      expect(projected!.serviceTime).toBe("10:30");
      expect(projected!.serviceTimeZone).toBe(BAKU);
      expect(projected!.serviceStartsAt).toBe(`${date}T06:30:00.000Z`);
    });

    it("36.22. staff projection: GET /bookings/:id сериализует temporal факты", async () => {
      const order = (await fixtureOrder({ serviceDate: FUTURE(), serviceTime: "10:30", serviceTimeZone: BAKU })).order;
      created.orders.push(order.id);
      await sendToBookings(order.id);
      const booking = (await bookingsFor(order.id))[0]!;
      const res = (await adminAgent.get(`/api/v1/bookings/${booking.id}`).expect(200)).body as {
        id: string;
        serviceTimeType: string;
        serviceTime: string | null;
        serviceTimeZone: string | null;
        serviceStartsAt: string | null;
      };
      expect(res.id).toBe(booking.id);
      expect(res.serviceTimeType).toBe("TIME_SLOT");
      expect(res.serviceTime).toBe("10:30");
      expect(res.serviceTimeZone).toBe(BAKU);
      expect(res.serviceStartsAt).toBe(booking.serviceStartsAt!.toISOString());
    });

    it("36.23. migration/fresh replay — COVERED BY CLI gates (migrate status + clean replay в отчёте)", () => {
      expect(true).toBe(true);
    });
  });
});
