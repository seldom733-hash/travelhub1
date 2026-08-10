/**
 * E2E PHASE 2 STEP 2.5B — Acquisition Source Propagation.
 *
 * Покрывает (§21 implementation prompt):
 *  1. canonical DIRECT flow: Checkout → Sale → OrderRequested → Order (source frozen);
 *  2. client cannot forge acquisitionSource (bootstrap DTO — whitelist strip);
 *  3. Sale completion does NOT recompute source;
 *  4. Order consumer persists payload source exactly;
 *  5. duplicate delivery preserves source;
 *  6. lifecycle actions (confirm/complete/close + 2.5A temporal) preserve source;
 *  7. bootstrap source semantics truthful (server-assisted DIRECT);
 *  8. unknown acquisition value rejected at event/contract boundary (FAILED, no Order);
 *  9. BUYER_REQUEST (Roadmap Amendment) propagates at contract level — без Reverse
 *     Marketplace сущностей;
 * 10. Booking propagation: send → Booking.acquisitionSource копируется из Order
 *     (READ-only, ADR-0001);
 * 11. legacy/null semantics: строки до 2.5B остаются NULL без backfill;
 * 12. no Payment/BookingRequested side effects на create-пути; no PII в событиях.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { Prisma, RoleCode } from "../src/generated/prisma/client";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const CONSUMER_ID = "order-requested-consumer";

describe("Phase 2 Step 2.5B — Acquisition Source Propagation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let eventBus: EventBusService;

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
  const syntheticOrderRequestedIds: string[] = [];

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
      .send({ type: "TOUR", title: `S25B ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };
  const bootstrapOrder = (body: Record<string, unknown>) => adminAgent.post("/api/v1/orders/bootstrap").send(body);
  const action = (orderId: string, act: string) => adminAgent.patch(`/api/v1/orders/${orderId}`).send({ action: act });

  const makeReadySale = async (
    smToken: string,
    fx: ProductFixture,
    opts: { travelers?: Array<{ firstName: string; lastName: string; birthDate?: string }> } = {},
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
      .send({ quoteId: quote.id, serviceDate: date, travelers: opts.travelers ?? [] })
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

  /** Синтетический OrderRequested (contract-level): без Reverse Marketplace,
   *  как failure-injection, но с валидным составом. Возвращает eventId. */
  const injectOrderRequested = async (acquisitionSource: string): Promise<string> => {
    const ev = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Sale",
        aggregateId: `sale-synth-${stamp}-${acquisitionSource}`,
        eventType: DomainEvents.OrderRequested,
        payload: {
          version: 1,
          saleId: `sale-synth-${stamp}-${acquisitionSource}`,
          saleCode: `SAL-SYNTH-${stamp}`,
          checkoutId: `co-synth-${stamp}`,
          checkoutCode: `CO-SYNTH-${stamp}`,
          quoteId: `q-synth-${stamp}`,
          customerId: null,
          reservationId: null,
          reservationIds: [`rsv-synth-${stamp}`],
          items: [
            {
              productId: `p-synth-${stamp}`,
              productCode: `P-SYNTH-${stamp}`,
              productTitle: "Synthetic",
              productType: "TOUR",
              tariffId: `t-synth-${stamp}`,
              tariffCode: "T-SYNTH",
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
          acquisitionSource,
          serviceDate: FUTURE(),
        } as Prisma.InputJsonValue,
        status: "PENDING",
        retryable: true,
      },
      select: { id: true },
    });
    syntheticOrderRequestedIds.push(ev.id);
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
    eventBus = app.get(EventBusService);
    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      const bookings = await prisma.booking.findMany({ where: { orderId: { in: created.orders } }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length > 0) {
        await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingCreated' AND "aggregateId" = ANY($1)`, bookingIds);
        await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingStatusChanged' AND "aggregateId" = ANY($1)`, bookingIds);
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderFulfilled','OrderReadyForBooking','OrderClosed','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (syntheticOrderRequestedIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."InboxEvent" WHERE "eventId" = ANY($1)`, syntheticOrderRequestedIds);
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "id" = ANY($1)`, syntheticOrderRequestedIds);
    }
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`,
        created.sales,
      );
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" = '${CONSUMER_ID}' AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
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

  // ── 1. Canonical DIRECT flow: Checkout → Sale → OrderRequested → Order ──

  it("1. canonical DIRECT flow: source frozen через Checkout → Sale → OrderRequested → Order", async () => {
    const sm = await createStaff("s25b_dir", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25b_dir");
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }],
    });
    const checkout = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: ctx.intent.id } });
    expect(checkout.acquisitionSource).toBe("DIRECT");

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(sale.acquisitionSource).toBe("DIRECT"); // frozen при создании Sale, не пересчитан

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.acquisitionSource).toBe("DIRECT"); // из payload (frozen snapshot Sale)

    const reqEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: "OrderRequested", payload: { path: ["saleId"], equals: ctx.sale.id } },
    });
    expect((reqEvent.payload as { acquisitionSource: string }).acquisitionSource).toBe("DIRECT");
  });

  // ── 2. Client cannot forge acquisitionSource ──

  it("2. forged acquisitionSource в bootstrap body отклоняется (server-derived DIRECT)", async () => {
    const buyer = await registerBuyer("s25b_forge");
    const fx = await createProduct("s25b_forge");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      acquisitionSource: "MARKETPLACE", // forged — whitelist DTO срезает
      submittedAt: "2020-01-01T00:00:00.000Z",
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.acquisitionSource).toBe("DIRECT"); // server-derived, не forged
    expect(order.submittedAt!.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });

  // ── 3. Bootstrap semantics: server-assisted DIRECT, не fabricated ──

  it("3. bootstrap Order: acquisitionSource = DIRECT (internal-assisted entry, сервер), not null", async () => {
    const buyer = await registerBuyer("s25b_boot");
    const fx = await createProduct("s25b_boot");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.acquisitionSource).toBe("DIRECT");
    expect(order.saleId).toBeNull();
  });

  // ── 4. Lifecycle + 2.5A temporal actions preserve source ──

  it("4. lifecycle (confirm/complete/close) и temporal milestones не меняют acquisitionSource", async () => {
    const buyer = await registerBuyer("s25b_lc");
    const fx = await createProduct("s25b_lc");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" }],
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);

    const get = () => prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    for (const act of ["process", "confirm", "send", "complete", "close"] as const) {
      await action(orderId, act).expect(200);
      expect((await get()).acquisitionSource).toBe("DIRECT");
    }
    const final = await get();
    expect(final.status).toBe("CLOSED");
    expect(final.closedAt).not.toBeNull();
    expect(final.confirmedAt).not.toBeNull();
    expect(final.acquisitionSource).toBe("DIRECT");
  });

  // ── 5. Duplicate delivery preserves source ──

  it("5. duplicate redelivery OrderRequested → source не меняется", async () => {
    const sm = await createStaff("s25b_dup", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25b_dup");
    const ctx = await makeReadySale(sm.accessToken, fx);
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.acquisitionSource).toBe("DIRECT");

    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.acquisitionSource).toBe("DIRECT");
    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
  });

  // ── 6. Unknown acquisition value rejected at event boundary ──

  it("6. unknown acquisitionSource → событие FAILED, никакого Order", async () => {
    const evId = await injectOrderRequested("HACKED_SOURCE");
    const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: evId } });
    expect(ev.status).toBe("FAILED");
    // Никакого Order по синтетическому saleId.
    const order = await prisma.order.findFirst({
      where: { saleId: `sale-synth-${stamp}-HACKED_SOURCE` },
    });
    expect(order).toBeNull();
  });

  // ── 7. BUYER_REQUEST propagation (contract-level, без Reverse Marketplace) ──

  it("7. BUYER_REQUEST (Roadmap Amendment) пропагируется в Order; Reverse Marketplace runtime ограничен Step 2.2A", async () => {
    const evId = await injectOrderRequested("BUYER_REQUEST");
    const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: evId } });
    expect(ev.status).toBe("PUBLISHED");
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: `sale-synth-${stamp}-BUYER_REQUEST` } });
    created.orders.push(order.id);
    expect(order.acquisitionSource).toBe("BUYER_REQUEST");
    // Reverse Marketplace runtime ограничен approved steps (ADR-0012): schema
    // существует; BuyerRequest (2.2B) + SellerCapability (2.2A) есть, но
    // matching/distribution/Proposal сущностей НЕТ. Будущие — Step 2.2C+.
    const reverseTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'reverse' ORDER BY table_name`,
    );
    expect(reverseTables.map((r) => r.table_name)).toEqual([
      "BuyerRequest",
      "BuyerRequestHistory",
      "SellerCapability",
      "SellerCapabilityHistory",
    ]);
  });

  // ── 8. Booking propagation: acquisitionSource копируется из Order ──

  it("8. send → Booking.acquisitionSource = Order.acquisitionSource (READ-only, ADR-0001)", async () => {
    const buyer = await registerBuyer("s25b_bkg");
    const fx = await createProduct("s25b_bkg");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" }],
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.acquisitionSource).toBe("DIRECT");
    const bookings = await prisma.booking.findMany({ where: { orderId } });
    expect(bookings.length).toBeGreaterThan(0);
    for (const b of bookings) {
      expect(b.acquisitionSource).toBe("DIRECT"); // frozen из Order
    }
  });

  // ── 9. Legacy/null semantics: строки до 2.5B — NULL без backfill ──

  it("9. legacy Order/Booking (до 2.5B) с NULL acquisitionSource остаются валидными, без backfill", async () => {
    const legacyOrder = await prisma.order.create({
      data: { code: `ORD-LEG25B-${stamp}`, number: `TH-LEG25B-${stamp}`, customerId: null, status: "NEW", amount: new Prisma.Decimal(10) },
      select: { id: true },
    });
    created.orders.push(legacyOrder.id);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: legacyOrder.id } });
    expect(row.acquisitionSource).toBeNull();

    const legacyBooking = await prisma.booking.create({
      data: { code: `BKG-LEG25B-${stamp}`, orderId: legacyOrder.id, productId: "p-legacy", status: "NEW", amount: 0 },
      select: { id: true },
    });
    const brow = await prisma.booking.findUniqueOrThrow({ where: { id: legacyBooking.id } });
    expect(brow.acquisitionSource).toBeNull();
  });

  // ── 10. No side effects / PII ──

  it("10. create-путь: no BookingRequested/Payment side effects; события без PII", async () => {
    const sm = await createStaff("s25b_iso", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25b_iso");
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingRequested", aggregateId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: { contains: "Payment" } } })).toBe(0);

    const createdEv = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    expect(JSON.stringify(createdEv.payload)).not.toMatch(/passport|firstName|lastName/);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(JSON.stringify(hist)).not.toMatch(/passport|firstName|lastName/);
    // acquisitionSource в payload — не PII, просто классификация.
    const reqEv = await prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: "OrderRequested", payload: { path: ["saleId"], equals: ctx.sale.id } },
    });
    expect((reqEv.payload as { acquisitionSource: string }).acquisitionSource).toBe("DIRECT");
  });

  // ── 11. Concurrent duplicate OrderRequested → один Order, один source ──

  it("11. concurrent duplicate delivery → один Order, один acquisitionSource (без drift)", async () => {
    const sm = await createStaff("s25b_cc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25b_cc");
    const ctx = await makeReadySale(sm.accessToken, fx);
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const first = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = $1`, first.id);
    await prisma.order.delete({ where: { id: first.id } });
    await prisma.inboxEvent.deleteMany({ where: { consumerId: CONSUMER_ID, eventId: r.orderRequestedEventId } });
    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });

    await Promise.all([eventBus.publishPending(), eventBus.publishPending()]);

    const orders = await prisma.order.findMany({ where: { saleId: ctx.sale.id } });
    expect(orders).toHaveLength(1);
    const order = orders[0];
    created.orders.push(order.id);
    expect(order.acquisitionSource).toBe("DIRECT");
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.id, eventType: "OrderCreated" } })).toBe(1);
  });

  // ── 12. Duplicate BookingRequested delivery → одна Booking, source без изменений ──

  it("12. duplicate BookingRequested → одна Booking, acquisitionSource стабилен", async () => {
    const buyer = await registerBuyer("s25b_dbkg");
    const fx = await createProduct("s25b_dbkg");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Дина", lastName: "Алиева", birthDate: "1989-09-09", passportNumber: "P9998877" }],
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);

    const bookings = await prisma.booking.findMany({ where: { orderId } });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].acquisitionSource).toBe("DIRECT");
    const reqEvent = await prisma.outboxEvent.findFirstOrThrow({ where: { eventType: "BookingRequested", aggregateId: orderId } });

    // Повторная доставка (reset inbox + PENDING).
    await prisma.inboxEvent.deleteMany({ where: { consumerId: "booking-requested-consumer", eventId: reqEvent.id } });
    await prisma.outboxEvent.update({ where: { id: reqEvent.id }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    const after = await prisma.booking.findMany({ where: { orderId } });
    expect(after).toHaveLength(1); // guard existing>0 + inbox dedup
    expect(after[0].acquisitionSource).toBe("DIRECT");
  });

  // ── 13. Booking lifecycle НЕ меняет acquisitionSource (immutable snapshot) ──

  it("13. Booking status-переход не перезаписывает acquisitionSource", async () => {
    const buyer = await registerBuyer("s25b_bimm");
    const fx = await createProduct("s25b_bimm");
    const res = await bootstrapOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Камран", lastName: "Мамедов", birthDate: "1985-11-11", passportNumber: "P5554433" }],
    }).expect(201);
    const orderId = (res.body.order as { id: string }).id;
    created.orders.push(orderId);
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);

    const booking = await prisma.booking.findFirstOrThrow({ where: { orderId } });
    expect(booking.acquisitionSource).toBe("DIRECT");

    // send (NEW → SENT_TO_SUPPLIER) — только status/version, source не трогается.
    const r = await adminAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" });
    expect([200, 409]).toContain(r.status);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.acquisitionSource).toBe("DIRECT");
  });
});
