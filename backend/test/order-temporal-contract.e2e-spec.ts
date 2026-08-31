/**
 * E2E PHASE 2 STEP 2.5A — Order Temporal Contract.
 *
 * Покрывает (§18 implementation prompt + Roadmap 2.5A):
 *  - submittedAt на canonical OrderRequested-пути и test-fixture (server-owned);
 *  - Step 2.6: production create-route отсутствует (POST /orders/bootstrap → 404) —
 *    forged milestone-поля невозможны (никакого HTTP-create DTO);
 *  - confirmedAt/fulfilledAt/closedAt/cancelledAt — по фактическим переходам
 *    (confirm/complete/close/cancel), атомарно с CAS-переходом статуса;
 *  - createdAt остаётся persistence time (не overloaded lifecycle field);
 *  - duplicate/concurrent delivery не меняют milestone;
 *  - failure rollback не оставляет ложного milestone;
 *  - legacy rows (NULL milestones) валидны без backfill;
 *  - OrderCreated/history semantics не изменены; no Booking/Payment/hold-dup;
 *  - nullable customer: BUYER own-scope безопасен.
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
import { BookingStatus } from "../src/generated/prisma/enums";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";
import { IdsService } from "../src/shared/ids.service";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

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

describe("Phase 2 Step 2.5A — Order Temporal Contract (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let eventBus: EventBusService;
  let ids: IdsService;

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
  // STRICT REVIEW 2.5A: event-ids, созданные тестами напрямую (для честной
  // уборки inbox/outbox в общий e2e DB — никаких утечек глобальных counts).
  const directEventIds: string[] = [];
  const bookingStatusEventIds: string[] = [];

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
      .send({ type: "TOUR", title: `S25A ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };
  const fixtureOrder = (body: FixtureOrderInput) => createFixtureOrder(prisma, ids, eventBus, body);
  // Step 2.6 negative: удалённый production-маршрут должен отвечать 404.
  const bootstrapOrder = (body: Record<string, unknown>) => adminAgent.post("/api/v1/orders/bootstrap").send(body);
  const action = (orderId: string, act: string, token?: string) => {
    const a = token ? agent(token) : adminAgent;
    return a.patch(`/api/v1/orders/${orderId}`).send({ action: act });
  };

  /** Полный fixture до Sale (НЕ complete): ISSUED Quote + Checkout (terms/date) + Sale OPEN. */
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);
    ids = app.get(IdsService);
    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      // Booking side effects (send → BookingRequested consumer): bookings, их
      // события и inbox строки booking-консьюмера.
      const bookings = await prisma.booking.findMany({ where: { orderId: { in: created.orders } }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length > 0) {
        // STRICT REVIEW 2.5A: убираем и BookingStatusChanged-строки reconcile-теста.
        await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingStatusChanged' AND "aggregateId" = ANY($1)`, bookingIds);
        await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingCreated' AND "aggregateId" = ANY($1)`, bookingIds);
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, created.orders);
      // STRICT REVIEW 2.5A: canonical lifecycle-факты reconcile/action-тестов
      // (иначе утечка в общий e2e DB при полном serial прогоне).
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderFulfilled','OrderReadyForBooking','OrderClosed','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    // Inbox строки потребителей на наши напрямую созданные события — до удаления
    // самих outbox-строк (сначала inbox, потом outbox, чтобы не было dangling).
    if (directEventIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."InboxEvent" WHERE "eventId" = ANY($1)`, directEventIds);
    }
    if (bookingStatusEventIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."InboxEvent" WHERE "eventId" = ANY($1)`, bookingStatusEventIds);
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "id" = ANY($1)`, bookingStatusEventIds);
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

  // ── 1. Canonical Order: submittedAt server-owned, createdAt = persistence ──

  it("1. canonical Order: submittedAt установлен при создании, createdAt — persistence time; прочие milestones NULL", async () => {
    const sm = await createStaff("s25a_sub", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_sub");
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }],
    });
    const before = new Date();
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    expect(order.submittedAt).not.toBeNull();
    expect(order.submittedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
    expect(order.createdAt).toBeInstanceOf(Date);
    // createdAt — persistence time (≈ now), НЕ перегруженный lifecycle-факт.
    expect(Math.abs(order.submittedAt!.getTime() - order.createdAt.getTime())).toBeLessThan(10_000);
    // Milestones ещё не произошли — NULL (не «0», не «creation time»).
    expect(order.confirmedAt).toBeNull();
    expect(order.fulfilledAt).toBeNull();
    expect(order.closedAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.orderRequestedEventId).toBe(r.orderRequestedEventId);
  });

  // ── 2. Bootstrap: submittedAt server-owned; forged milestone отклоняется ──

  it("2. Step 2.6: производственный create-маршрут удалён (404); milestone-поля серверные, forge невозможен", async () => {
    const buyer = await registerBuyer("s25a_boot");
    const customerId = buyer.user.customerId!;
    const fx = await createProduct("s25a_boot");

    // Production bootstrap-путь удалён — классический forged payload → 404.
    await bootstrapOrder({
      customerId,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      submittedAt: "2020-01-01T00:00:00.000Z",
      confirmedAt: "2020-01-01T00:00:00.000Z",
      fulfilledAt: "2020-01-01T00:00:00.000Z",
      closedAt: "2020-01-01T00:00:00.000Z",
      cancelledAt: "2020-01-01T00:00:00.000Z",
    }).expect(404);
    expect(await prisma.order.count({ where: { customerId } })).toBe(0);

    // Test-only fixture (server-owned, НЕ HTTP): submittedAt — реальное время,
    // никакой клиентский DTO не может подставить forged milestone.
    const res = await fixtureOrder({
      customerId,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
    });
    created.orders.push(res.order.id);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.order.id } });
    expect(order.submittedAt).not.toBeNull();
    expect(order.submittedAt!.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
    expect(order.confirmedAt).toBeNull();
    expect(order.fulfilledAt).toBeNull();
    expect(order.closedAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.saleId).toBeNull(); // fixture ≠ canonical (нет Sales-цепочки)
  });

  // ── 3. Lifecycle: milestones по фактическим переходам ──

  it("3. lifecycle: confirm→confirmedAt, complete→fulfilledAt, close→closedAt (атомарно с CAS)", async () => {
    const buyer = await registerBuyer("s25a_lc");
    const fx = await createProduct("s25a_lc");
    const res = await fixtureOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: "1991-02-02", passportNumber: "P1234567" }],
    });
    const orderId = res.order.id;
    created.orders.push(orderId);

    const get = () => prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect((await get()).submittedAt).not.toBeNull();

    await action(orderId, "process").expect(200);
    const afterProcess = await get();
    expect(afterProcess.confirmedAt).toBeNull();

    await action(orderId, "confirm").expect(200);
    const afterConfirm = await get();
    expect(afterConfirm.status).toBe("READY_FOR_BOOKING");
    expect(afterConfirm.confirmedAt).not.toBeNull();

    await action(orderId, "send").expect(200);
    const afterSend = await get();
    expect(afterSend.status).toBe("SENT_TO_BOOKING");
    // Не-достигнутые milestones остаются NULL.
    expect(afterSend.fulfilledAt).toBeNull();
    expect(afterSend.closedAt).toBeNull();

    await action(orderId, "complete").expect(200);
    const afterComplete = await get();
    expect(afterComplete.status).toBe("FULFILLED");
    expect(afterComplete.fulfilledAt).not.toBeNull();
    // Immutable: подтверждённый milestone не перезаписывается более поздними.
    expect(afterComplete.confirmedAt).toEqual(afterConfirm.confirmedAt);

    await action(orderId, "close").expect(200);
    const afterClose = await get();
    expect(afterClose.status).toBe("CLOSED");
    expect(afterClose.closedAt).not.toBeNull();
    expect(afterClose.fulfilledAt).toEqual(afterComplete.fulfilledAt);
    expect(afterClose.confirmedAt).toEqual(afterConfirm.confirmedAt);
    expect(afterClose.cancelledAt).toBeNull();
  });

  it("4. cancel → cancelledAt; повторный cancel → 409 (immutable milestone)", async () => {
    const buyer = await registerBuyer("s25a_cx");
    const fx = await createProduct("s25a_cx");
    const res = await fixtureOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
    });
    const orderId = res.order.id;
    created.orders.push(orderId);

    await action(orderId, "cancel").expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
    expect(order.cancelledAt).not.toBeNull();
    // Повторный cancel невозможен lifecycle-ом → 409, milestone не меняется.
    await action(orderId, "cancel").expect(409);
    const again = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(again.cancelledAt).toEqual(order.cancelledAt);
  });

  // ── 5-6. Idempotency: duplicate/concurrent delivery не меняют milestone ──

  it("5. duplicate redelivery OrderRequested → milestone не меняется", async () => {
    const sm = await createStaff("s25a_dup", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_dup");
    const ctx = await makeReadySale(sm.accessToken, fx);
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    const firstSubmitted = order.submittedAt;

    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.submittedAt).toEqual(firstSubmitted);
    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
  });

  it("6. concurrent duplicate delivery → один Order, milestone установлен", async () => {
    const sm = await createStaff("s25a_conc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_conc");
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
    expect(order.submittedAt).not.toBeNull();
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.id, eventType: "OrderCreated" } })).toBe(1);
  });

  // ── 7. Failure atomicity: нет Order ⟹ нет ложного milestone ──

  it("7. failure rollback → никакого Order/ложного milestone", async () => {
    const sm = await createStaff("s25a_fail", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_fail");
    const ctx = await makeReadySale(sm.accessToken, fx);

    const checkout = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: ctx.intent.id } });
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: ctx.quote.id }, include: { items: true } });
    const reservations = await prisma.availabilityReservation.findMany({
      where: { sourceSaleId: ctx.sale.id },
      orderBy: { createdAt: "asc" },
    });
    const createdEvent = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Sale",
        aggregateId: ctx.sale.id,
        eventType: DomainEvents.OrderRequested,
        payload: {
          version: 1,
          saleId: ctx.sale.id,
          saleCode: ctx.sale.code,
          checkoutId: ctx.intent.id,
          checkoutCode: ctx.intent.code,
          quoteId: ctx.quote.id,
          customerId: null,
          reservationId: reservations[0]?.id ?? null,
          reservationIds: reservations.map((r) => r.id),
          items: quote.items.map((it) => ({
            productId: it.productId,
            productCode: it.productCode,
            productTitle: it.productTitle,
            productType: "TOUR",
            tariffId: it.tariffId,
            tariffCode: it.tariffCode,
            quantity: it.quantity,
            unitPrice: String(it.unitPrice),
            amount: "-5", // невалидный money → отказ ДО создания Order
          })),
          currency: checkout.currency,
          subtotal: String(checkout.subtotal),
          discountType: String(checkout.discountType),
          discountValue: null,
          discountAmount: checkout.discountAmount ? String(checkout.discountAmount) : null,
          total: String(checkout.total),
          paymentScheme: "FULL_PREPAYMENT",
          prepaymentType: null,
          prepaymentValue: null,
          initialAmount: String(checkout.total),
          remainingAmount: "0",
          acquisitionSource: "DIRECT",
          serviceDate: ctx.date,
        } as Prisma.InputJsonValue,
        status: "PENDING",
        retryable: true,
      },
      select: { id: true },
    });
    const eventId = createdEvent.id;
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
    // Никакой строки с milestone для этого sale.
    const milestoneRows = await prisma.order.findMany({
      where: { saleId: ctx.sale.id, OR: [{ submittedAt: { not: null } }, { confirmedAt: { not: null } }] },
    });
    expect(milestoneRows).toHaveLength(0);
  });

  // ── 8. Legacy rows: NULL milestones валидны, без backfill ──

  it("8. legacy row (до миграции) с NULL milestones остаётся валидной, без backfill", async () => {
    // Прямая вставка legacy-строки (как строка, созданная до Step 2.5A).
    const legacy = await prisma.order.create({
      data: {
        code: `ORD-LEG-${stamp}`,
        referenceNumber: "MKT-ORD-000001",
        number: `TH-LEG-${stamp}`,
        customerId: null,
        status: "NEW",
        amount: new Prisma.Decimal(10),
      },
      select: { id: true },
    });
    created.orders.push(legacy.id);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(row.submittedAt).toBeNull();
    expect(row.confirmedAt).toBeNull();
    expect(row.cancelledAt).toBeNull();
    expect(row.fulfilledAt).toBeNull();
    expect(row.closedAt).toBeNull();
  });

  // ── 9. Events/history + isolation ──

  it("9. OrderCreated/history semantics сохранены; no Booking/Payment; hold не дублируется", async () => {
    const sm = await createStaff("s25a_iso", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_iso");
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    const createdEv = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    const p = createdEv.payload as { orderId: string; code: string; number: string; customerId: string | null; amount: string; currency: string };
    expect(p.orderId).toBe(order.id);
    expect(p.code).toBe(order.code);
    expect(p.number).toBe(order.number);
    expect(p.customerId).toBeNull();
    expect(p.amount).toBe(ctx.intent.total);
    expect(p.currency).toBe("USD");
    // История без PII, action=created.
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.map((h) => h.action)).toEqual(["created"]);
    expect(JSON.stringify(hist)).not.toMatch(/passport|firstName|lastName/);

    // Isolation: no Booking, no BookingRequested, hold ровно один (без дублей).
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingRequested", aggregateId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: { contains: "Payment" } } })).toBe(0);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
  });

  // ── 10. Nullable customer / IDOR regression ──

  it("10. nullable customer: BUYER own-scope не видит canonical Order; staff read работает", async () => {
    const sm = await createStaff("s25a_idor", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25a_idor");
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(order.customerId).toBeNull();

    // BUYER: собственные заказы пусты (null-customer Order невидим — не wildcard).
    const buyer = await registerBuyer("s25a_buy");
    const own = (await agent(buyer.accessToken).get("/api/v1/account/orders").expect(200)).body as { items: Array<{ id?: string }>; total: number };
    expect(own.items.some((i) => i.id === order.id)).toBe(false);
    // BUYER не имеет internal order.read.
    await agent(buyer.accessToken).get(`/api/v1/orders/${order.id}`).expect(403);
    // Staff (SALES_MANAGER) читает заказ.
    const staffRead = (await agent(sm.accessToken).get(`/api/v1/orders/${order.id}`).expect(200)).body as { id: string; submittedAt: string | null };
    expect(staffRead.id).toBe(order.id);
    expect(staffRead.submittedAt).not.toBeNull();
  });

  // ── 11. Duplicate confirm: 409, confirmedAt immutable ──

  it("11. duplicate confirm → 409; confirmedAt не перезаписывается", async () => {
    const buyer = await registerBuyer("s25a_cf2");
    const fx = await createProduct("s25a_cf2");
    const res = await fixtureOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Игорь", lastName: "Соколов", birthDate: "1988-03-03", passportNumber: "P7654321" }],
    });
    const orderId = res.order.id;
    created.orders.push(orderId);

    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    const first = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(first.confirmedAt).not.toBeNull();

    // Повторный confirm невозможен lifecycle-ом (READY_FOR_BOOKING ∉ from) → 409.
    await action(orderId, "confirm").expect(409);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.confirmedAt).toEqual(first.confirmedAt);
    expect(after.status).toBe("READY_FOR_BOOKING");
    // History — ровно один confirm-факт.
    const confirms = await prisma.orderHistory.count({ where: { orderId, action: "confirm" } });
    expect(confirms).toBe(1);
  });

  // ── 12. Cancel vs close race: ровно один терминальный milestone ──

  it("12. concurrent cancel vs close (FULFILLED) → ровно один терминальный факт, никаких обоих", async () => {
    const buyer = await registerBuyer("s25a_race");
    const fx = await createProduct("s25a_race");
    const res = await fixtureOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Мария", lastName: "Ким", birthDate: "1992-04-04", passportNumber: "P1112223" }],
    });
    const orderId = res.order.id;
    created.orders.push(orderId);
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);
    await action(orderId, "complete").expect(200);
    const pre = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(pre.status).toBe("FULFILLED");
    expect(pre.fulfilledAt).not.toBeNull();

    // Два независимых агента → конкурентные терминальные переходы.
    const [cancelRes, closeRes] = await Promise.allSettled([
      action(orderId, "cancel"),
      action(orderId, "close"),
    ]);
    const statuses = [cancelRes, closeRes]
      .map((r) => (r.status === "fulfilled" ? r.value.status : (r.reason as { status?: number }).status))
      .sort();
    expect(statuses).toEqual([200, 409]); // ровно один победитель, один проигравший

    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Терминальность: ровно ОДИН из CANCELLED/CLOSED и ровно один milestone.
    expect(["CANCELLED", "CLOSED"]).toContain(after.status);
    expect(after.cancelledAt !== null || after.closedAt !== null).toBe(true);
    expect(after.cancelledAt !== null && after.closedAt !== null).toBe(false);
    // Не-терминальные milestones не затронуты.
    expect(after.fulfilledAt).toEqual(pre.fulfilledAt);
    expect(after.confirmedAt).not.toBeNull();
    // History — ровно один терминальный факт.
    const terminalFacts = await prisma.orderHistory.count({
      where: { orderId, action: { in: ["cancel", "close"] } },
    });
    expect(terminalFacts).toBe(1);
  });

  // ── 13. Reconcile: PARTIALLY_FULFILLED НЕ ставит fulfilledAt; FULFILLED — ставит; replay immutable ──

  it("13. reconcile: PARTIALLY_FULFILLED → fulfilledAt NULL; FULFILLED (все брони terminal) → set; replay не меняет", async () => {
    const buyer = await registerBuyer("s25a_rec");
    const fx = await createProduct("s25a_rec");
    const res = await fixtureOrder({
      customerId: buyer.user.customerId!,
      items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }],
      travelers: [{ firstName: "Олег", lastName: "Гусейнов", birthDate: "1990-07-07", passportNumber: "P3334445" }],
    });
    const orderId = res.order.id;
    created.orders.push(orderId);
    await action(orderId, "process").expect(200);
    await action(orderId, "confirm").expect(200);
    await action(orderId, "send").expect(200);

    // `send` создаёт настоящую бронь через BookingRequested consumer (status NEW).
    const auto = await prisma.booking.findFirstOrThrow({ where: { orderId } });
    // Вторая бронь напрямую — как вторая услуга заказа.
    const b2 = await prisma.booking.create({
      data: { code: `BKG-${stamp}-r2`, referenceNumber: "MKT-BKG-000001", orderId, productId: fx.productId, status: BookingStatus.AWAITING_CONFIRMATION, amount: 50 },
      select: { id: true },
    });

    const emitStatus = async (bookingId: string, from: string, to: string): Promise<string> => {
      const ev = await prisma.outboxEvent.create({
        data: {
          aggregateType: "Booking",
          aggregateId: bookingId,
          eventType: DomainEvents.BookingStatusChanged,
          payload: { bookingId, code: `BKG-${stamp}`, referenceNumber: "MKT-BKG-000001", orderId, productId: fx.productId, from, to } as Prisma.InputJsonValue,
          status: "PENDING",
          retryable: true,
        },
        select: { id: true },
      });
      bookingStatusEventIds.push(ev.id);
      await eventBus.publishPending();
      return ev.id;
    };

    // Одна бронь CONFIRMED, вторая не-terminal → PARTIALLY_FULFILLED, НЕ fulfilledAt.
    await prisma.booking.update({ where: { id: auto.id }, data: { status: BookingStatus.CONFIRMED } });
    await emitStatus(auto.id, "NEW", "CONFIRMED");
    const partial = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(partial.status).toBe("PARTIALLY_FULFILLED");
    expect(partial.fulfilledAt).toBeNull(); // PARTIALLY_FULFILLED ≠ full fulfillment

    // ВСЕ брони заказа terminal (COMPLETED) → FULFILLED + fulfilledAt.
    await prisma.booking.updateMany({ where: { orderId }, data: { status: BookingStatus.COMPLETED } });
    const ev2 = await emitStatus(b2.id, "AWAITING_CONFIRMATION", "COMPLETED");
    const full = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(full.status).toBe("FULFILLED");
    expect(full.fulfilledAt).not.toBeNull();
    const firstFulfilledAt = full.fulfilledAt;
    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId, eventType: "OrderFulfilled" } })).toBe(1);

    // Replay того же события: inbox reset + PENDING → доставка повторяется,
    // но Order уже FULFILLED → early return; milestone не перезаписывается,
    // OrderFulfilled не дублируется.
    await prisma.inboxEvent.deleteMany({ where: { consumerId: "order-booking-consumer", eventId: ev2 } });
    await prisma.outboxEvent.update({ where: { id: ev2 }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    const replayed = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(replayed.fulfilledAt).toEqual(firstFulfilledAt);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId, eventType: "OrderFulfilled" } })).toBe(1);
  });
});
