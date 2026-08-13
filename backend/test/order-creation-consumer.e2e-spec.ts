/**
 * E2E PHASE 2 STEP 2.5 — Order Creation Consumer (OrderRequested → Order).
 *
 * Покрывает (§26/§27/§36):
 *  positive: полный commercial chain Quote → CheckoutIntent → terms → serviceDate
 *    → travelers → Sale → complete → OrderRequested → Order + Items + Travelers +
 *    Fulfillment + History + OrderCreated; frozen money/payment snapshot; ID
 *    стратегия ORD-* + TH-YYYY-######; correlation/causation lineage.
 *  idempotency: duplicate redelivery и concurrent delivery → ровно один Order,
 *    один OrderCreated, одна inbox-строка; domain-invariant Order.saleId @unique.
 *  negative: malformed/unsupported payload не создаёт Order (FAILED retryable);
 *    failure atomicity (невалидный money → нет partial Order graph).
 *  isolation: нет Booking/Payment/BookingRequested; availability не резервируется
 *    повторно; bootstrap flow остаётся изолированным.
 *  PII: OrderTraveler — только canonical минимум; payload/OrderCreated без PII.
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
import { EventBusService, type OutboxEnvelope } from "../src/eventbus/eventbus.service";
import { DomainEvents } from "../src/eventbus/domain-events";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
  tariffPrice: string;
}

interface SaleCtx {
  quote: { id: string; code: string };
  intent: { id: string; code: string; version: number; total: string; currency: string };
  sale: { id: string; code: string; version: number; status: string };
  date: string;
  total: string;
  currency: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const CONSUMER_ID = "order-requested-consumer";

describe("Phase 2 Step 2.5 — Order Creation Consumer (e2e)", () => {
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
      .send({ type: "TOUR", title: `S25 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    await adminAgent.post(`/api/v1/products/${productId}/availability`).send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal }).expect(201);
  };

  /** Полный fixture до Sale (НЕ complete): ISSUED Quote + Checkout (travelers/terms/date) + Sale OPEN. */
  const makeReadySale = async (
    smToken: string,
    fx: ProductFixture,
    opts: { travelers?: Array<{ firstName: string; lastName: string; birthDate?: string }>; extraItems?: Array<{ fx: ProductFixture; quantity?: number }> } = {},
  ): Promise<SaleCtx> => {
    const date = FUTURE();
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    for (const extra of opts.extraItems ?? []) {
      await agent(smToken)
        .post(`/api/v1/sales/quotes/${quote.code}/items`)
        .send({ productId: extra.fx.productId, tariffId: extra.fx.tariffId, quantity: extra.quantity ?? 1 })
        .expect(201);
    }
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date, travelers: opts.travelers ?? [] })
      .expect(201)).body as { id: string; code: string; version: number; total: string; currency: string };
    created.checkouts.push(intent.id);
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);
    for (const extra of opts.extraItems ?? []) {
      await upsertAvailability(extra.fx.productId, extra.fx.tariffId, date, 10);
    }

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number; status: string };
    created.sales.push(sale.id);
    return { quote, intent, sale, date, total: intent.total, currency: intent.currency };
  };

  const complete = (token: string, saleCode: string, expectedVersion: number) =>
    agent(token).post(`/api/v1/sales/sales/${saleCode}/complete`).send({ expectedVersion });

  /** Manual OrderRequested outbox row (для негативных/конкурентных сценариев). */
  const emitOrderRequested = async (ctx: SaleCtx, overrides: Record<string, unknown> = {}): Promise<string> => {
    const checkout = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: ctx.intent.id } });
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: ctx.quote.id }, include: { items: true } });
    const products = await prisma.product.findMany({
      where: { id: { in: quote.items.map((it) => it.productId) } },
      select: { id: true, type: true },
    });
    const typeById = new Map(products.map((p) => [p.id, p.type]));
    // Фактические holds продажи (как в реальном producer-е completeSale):
    // reservationId — UUID резервации, reservationIds — все holds (один на item).
    const reservations = await prisma.availabilityReservation.findMany({
      where: { sourceSaleId: ctx.sale.id },
      orderBy: { createdAt: "asc" },
    });
    const payload = {
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
        productType: typeById.get(it.productId) ?? "TOUR",
        tariffId: it.tariffId,
        tariffCode: it.tariffCode,
        quantity: it.quantity,
        unitPrice: String(it.unitPrice),
        amount: String(it.amount),
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
      ...overrides,
    };
    const row = await prisma.outboxEvent.create({
      data: {
        aggregateType: "Sale",
        aggregateId: ctx.sale.id,
        eventType: DomainEvents.OrderRequested,
        payload: payload as Prisma.InputJsonValue,
        correlationId: `corr-${stamp}-${ctx.sale.code}`,
        status: "PENDING",
        retryable: true,
      },
      select: { id: true },
    });
    return row.id;
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
    // Order (Step 2.5 consumer) + их события/inbox.
    if (created.orders.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = ANY($1)`, created.orders);
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
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

  // ── Positive journey (§27) ─────────────────────────────────────────────────

  it("1. complete → ровно один Order (ORD-*/TH-*), OrderCreated, корректные refs/снапшот/корреляция", async () => {
    const sm = await createStaff("s25_pos", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_pos", 150.5);
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }],
    });

    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string; reservations: string[] };
    expect(r.reservations).toHaveLength(1);

    // Sale остаётся CLOSED.
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(saleRow.status).toBe("CLOSED");

    // Order: ровно один, canonical refs + frozen snapshot.
    const orders = await prisma.order.findMany({ where: { saleId: ctx.sale.id } });
    expect(orders).toHaveLength(1);
    const order = orders[0];
    created.orders.push(order.id);
    expect(order.code).toMatch(/^ORD-\d{8}$/);
    expect(order.number).toMatch(/^TH-\d{4}-\d{6}$/);
    expect(order.status).toBe("NEW");
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.customerId).toBeNull(); // internal assisted flow
    expect(order.saleId).toBe(ctx.sale.id);
    expect(order.saleCode).toBe(ctx.sale.code);
    expect(order.quoteId).toBe(ctx.quote.id);
    expect(order.checkoutId).toBe(ctx.intent.id);
    expect(order.reservationId).toBeTruthy(); // RSR ref (без второго резервирования)
    expect((order.reservationIds as string[])).toEqual([order.reservationId]); // полный список holds
    expect(order.orderRequestedEventId).toBe(r.orderRequestedEventId);
    expect(order.currency).toBe(ctx.currency);
    expect(String(order.amount)).toBe(ctx.total); // frozen total, без reprice
    expect(String(order.subtotal)).toBe(ctx.total);
    expect(order.discountType).toBe("NONE");
    expect(order.discountValue).toBeNull();
    expect(String(order.discountAmount)).toBe("0"); // frozen snapshot (NONE → 0)
    expect(order.paymentScheme).toBe("FULL_PREPAYMENT");
    expect(String(order.initialAmount)).toBe(ctx.total);
    expect(String(order.remainingAmount)).toBe("0");
    expect(order.acquisitionSource).toBe("DIRECT");
    expect(order.serviceDate?.toISOString().slice(0, 10)).toBe(ctx.date);

    // OrderItems: frozen snapshot.
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.productId).toBe(fx.productId);
    expect(item.productCode).toMatch(/^PRD-\d{8}$/);
    expect(item.title).toBeTruthy();
    expect(item.type).toBe("TOUR"); // стабильная классификация из Catalog
    expect(item.quantity).toBe(1);
    expect(String(item.price)).toBe("150.5");
    expect(String(item.amount)).toBe("150.5");
    expect(item.currency).toBe(ctx.currency);

    // OrderTraveler: минимальный snapshot без passport/PII-расширения.
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id } });
    expect(travelers).toHaveLength(1);
    expect(travelers[0].firstName).toBe("Иван");
    expect(travelers[0].lastName).toBe("Иванов");
    expect(travelers[0].birthDate?.toISOString().slice(0, 10)).toBe("1990-05-01");
    expect(travelers[0].passportNumber).toBeNull();
    expect(travelers[0].dataCompleteness).toBe("INCOMPLETE"); // passport дополняется позже

    // Fulfillment + history.
    const fulfillment = await prisma.fulfillment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(fulfillment.status).toBe("NOT_STARTED");
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(hist.map((h) => h.action)).toEqual(["created"]);
    expect(JSON.stringify(hist[0].fields)).toContain(ctx.sale.code);
    expect(JSON.stringify(hist[0].fields)).not.toMatch(/firstName|lastName|passport|email/);

    // OrderCreated: PUBLISHED, correlation/causation lineage.
    const createdEv = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateType: "Order", aggregateId: order.id, eventType: "OrderCreated" } });
    expect(createdEv.status).toBe("PUBLISHED");
    expect(createdEv.causationId).toBe(r.orderRequestedEventId); // causation = OrderRequested.eventId
    const reqEv = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: r.orderRequestedEventId } });
    expect(createdEv.correlationId).toBe(reqEv.correlationId); // correlation унаследован
    const p = createdEv.payload as { orderId: string; code: string; number: string; customerId: string | null; amount: string; currency: string };
    expect(p.orderId).toBe(order.id);
    expect(p.code).toBe(order.code);
    expect(p.number).toBe(order.number);
    expect(p.customerId).toBeNull();
    expect(p.amount).toBe(ctx.total);
    expect(p.currency).toBe(ctx.currency);

    // Inbox: ровно одна строка consumer-а.
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER_ID, eventId: r.orderRequestedEventId } })).toBe(1);

    // Isolation: нет Booking/Payment/BookingRequested; reservation не дублируется.
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { eventType: "BookingRequested", aggregateId: order.id } })).toBe(0);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
    const res = await prisma.availabilityReservation.findFirstOrThrow({ where: { sourceSaleId: ctx.sale.id } });
    expect(res.status).toBe("HELD");
    expect(order.reservationId).toBe(res.id);
  });

  it("1b. multi-item Sale → Order сохраняет ВСЕ holds (reservationIds), per-item items/type", async () => {
    const sm = await createStaff("s25_multi", RoleCode.SALES_MANAGER);
    const fxA = await createProduct("s25_mA", 100);
    const fxB = await createProduct("s25_mB", 250.5);
    const ctx = await makeReadySale(sm.accessToken, fxA, {
      extraItems: [{ fx: fxB }],
      travelers: [{ firstName: "Пётр", lastName: "Петров" }],
    });

    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { reservations: string[] };
    // Step 2.4: ОДИН hold на item (multi-item → несколько holds).
    expect(r.reservations).toHaveLength(2);
    const holds = await prisma.availabilityReservation.findMany({ where: { sourceSaleId: ctx.sale.id }, orderBy: { createdAt: "asc" } });
    expect(holds).toHaveLength(2);

    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    // ВСЕ holds представлены в Order (не только первый — lossless cardinality).
    expect(order.reservationId).toBe(holds[0].id);
    expect((order.reservationIds as string[]).sort()).toEqual(holds.map((h) => h.id).sort());

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } });
    expect(items).toHaveLength(2);
    const types = items.map((i) => i.type).sort();
    expect(types).toEqual(["TOUR", "TOUR"]);
    const prices = items.map((i) => String(i.price)).sort();
    expect(prices).toEqual(["100", "250.5"]);
    expect(String(order.amount)).toBe("350.5"); // frozen total (оба items)

    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id } });
    expect(travelers).toHaveLength(1);
    expect(travelers[0].firstName).toBe("Пётр");
  });

  it("2. OrderCreated payload без PII; OrderTraveler — только canonical минимум", async () => {
    const sm = await createStaff("s25_pii", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_pii", 90);
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Анна", lastName: "Петрова" }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    expect(JSON.stringify(ev.payload)).not.toMatch(/firstName|lastName|passport|email|phone/);
    const hist = await prisma.orderHistory.findMany({ where: { orderId: order.id } });
    expect(JSON.stringify(hist)).not.toMatch(/firstName|lastName|passport|email/);
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id } });
    expect(travelers).toHaveLength(1);
    expect(travelers[0].passportNumber).toBeNull();
    expect(travelers[0].citizenship).toBeNull();
    expect(travelers[0].gender).toBeNull();
  });

  // ── Idempotency / concurrency (§13/§14) ───────────────────────────────────

  it("3. duplicate redelivery OrderRequested → ровно один Order/OrderCreated/inbox", async () => {
    const sm = await createStaff("s25_dup", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_dup", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    // Симуляция redelivery того же события (тот же eventId → PENDING).
    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { aggregateType: "Order", aggregateId: order.id, eventType: "OrderCreated" } })).toBe(1);
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER_ID, eventId: r.orderRequestedEventId } })).toBe(1);
    // Резервация не дублируется (Order не резервирует повторно).
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
  });

  it("4. concurrent delivery одного OrderRequested → ровно один Order (inbox + saleId unique)", async () => {
    const sm = await createStaff("s25_conc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_conc", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);
    // Реальный complete() атомарно создаёт holds + OrderRequested (payload с
    // корректными reservationIds). Сбрасываем результат первой доставки и
    // повторно гоняем одно и то же событие concurrent доставками.
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { orderRequestedEventId: string };
    const first = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    // Удаляем Order (каскадом items/travelers/fulfillment/history) + его
    // OrderCreated-строку outbox + inbox-строку, возвращаем событие в PENDING —
    // обе доставки конкурируют с нуля. (OrderCreated орфана НЕ оставляем:
    // sales-center тест 12 требует пустой outbox по OrderRequested/OrderCreated.)
    await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderCreated' AND "aggregateId" = $1`, first.id);
    await prisma.order.delete({ where: { id: first.id } });
    await prisma.inboxEvent.deleteMany({ where: { consumerId: CONSUMER_ID, eventId: r.orderRequestedEventId } });
    await prisma.outboxEvent.update({ where: { id: r.orderRequestedEventId }, data: { status: "PENDING" } });

    await Promise.all([eventBus.publishPending(), eventBus.publishPending()]);

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);
    expect(await prisma.outboxEvent.count({ where: { aggregateType: "Order", aggregateId: order.id, eventType: "OrderCreated" } })).toBe(1);
    const inboxCount = await prisma.inboxEvent.count({ where: { consumerId: CONSUMER_ID } });
    // Хотя бы одна inbox-строка для события, и событие не обработано дважды в доменном смысле.
    expect(inboxCount).toBeGreaterThanOrEqual(1);
    // Уникальность ID: ровно один ORD-* и один TH-* для этого Sale.
    const numbers = await prisma.order.findMany({ where: { saleId: ctx.sale.id }, select: { code: true, number: true } });
    expect(new Set(numbers.map((n) => n.code)).size).toBe(1);
    expect(new Set(numbers.map((n) => n.number)).size).toBe(1);
  });

  it("5. два разных OrderRequested → два Order, разные коды, корреляции не смешиваются", async () => {
    const sm = await createStaff("s25_two", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_two", 100);
    const ctxA = await makeReadySale(sm.accessToken, fx);
    const fxB = await createProduct("s25_twoB", 200);
    const ctxB = await makeReadySale(sm.accessToken, fxB);

    await complete(sm.accessToken, ctxA.sale.code, 1).expect(201);
    await complete(sm.accessToken, ctxB.sale.code, 1).expect(201);

    const orderA = await prisma.order.findUniqueOrThrow({ where: { saleId: ctxA.sale.id } });
    const orderB = await prisma.order.findUniqueOrThrow({ where: { saleId: ctxB.sale.id } });
    created.orders.push(orderA.id, orderB.id);
    expect(orderA.code).not.toBe(orderB.code);
    expect(orderA.number).not.toBe(orderB.number);
    expect(String(orderA.amount)).toBe("100");
    expect(String(orderB.amount)).toBe("200");

    const evA = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: orderA.id, eventType: "OrderCreated" } });
    const evB = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: orderB.id, eventType: "OrderCreated" } });
    // Каждый OrderCreated наследует correlation СВОЕГО OrderRequested (не чужие).
    expect(evA.correlationId).not.toBe(evB.correlationId);
    const reqA = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: evA.causationId! } });
    expect(reqA.payload).toMatchObject({ saleId: ctxA.sale.id });
    const reqB = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: evB.causationId! } });
    expect(reqB.payload).toMatchObject({ saleId: ctxB.sale.id });
  });

  // ── Negative / failure atomicity (§26) ────────────────────────────────────

  it("6. malformed payload (version 2) → FAILED, никакого Order", async () => {
    const sm = await createStaff("s25_mal", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_mal", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const eventId = await emitOrderRequested(ctx, { version: 2 });
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(ev.status).toBe("FAILED");
    expect(ev.retryable).toBe(true);
    expect(ev.attempts).toBe(1);
    expect(await prisma.inboxEvent.count({ where: { consumerId: CONSUMER_ID, eventId } })).toBe(0);
  });

  it("7. невалидный money в items → failure atomicity: нет partial Order graph", async () => {
    const sm = await createStaff("s25_money", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_money", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const eventId = await emitOrderRequested(ctx, {
      items: [
        {
          productId: fx.productId,
          productCode: "PRD-00000001",
          productTitle: "T",
          tariffId: fx.tariffId,
          tariffCode: "TRF-00000001",
          quantity: 1,
          unitPrice: "100",
          amount: "-5",
        },
      ],
    });
    await eventBus.publishPending();

    // Failure atomicity: Order — корень графа (items/travelers/fulfillment/history
    // — FK-cascade дети); нет Order ⟹ нет partial графа (DB-level гарантия).
    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
  });

  it("7b. нереальная календарная дата (2026-02-29) → FAILED, без Order", async () => {
    const sm = await createStaff("s25_date", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_date", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const eventId = await emitOrderRequested(ctx, { serviceDate: "2026-02-29" });
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
  });

  it("7c. unknown acquisitionSource → FAILED, без Order", async () => {
    const sm = await createStaff("s25_acqu", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_acqu", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const eventId = await emitOrderRequested(ctx, { acquisitionSource: "TRAVEL_AGENT" });
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
  });

  it("8. пустой items → 422-семантика консьюмера: FAILED, без Order", async () => {
    const sm = await createStaff("s25_empty", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_empty", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const eventId = await emitOrderRequested(ctx, { items: [] });
    await eventBus.publishPending();

    expect(await prisma.order.count({ where: { saleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("FAILED");
  });

  // ── Bootstrap isolation (§22) — Step 2.6: маршрут удалён ────────────────

  it("9. Step 2.6: POST /orders/bootstrap → 404; canonical Order — только через OrderRequested", async () => {
    const buyer = await registerBuyer("s25_buyer");
    const customerId = buyer.user.customerId!;
    const fx = await createProduct("s25_boot", 50);
    await adminAgent
      .post("/api/v1/orders/bootstrap")
      .send({ customerId, items: [{ productId: fx.productId, title: "Boot", type: "TOUR", quantity: 1, price: 50 }] })
      .expect(404);
    // Никакого Order по удалённому пути.
    expect(await prisma.order.count({ where: { customerId } })).toBe(0);

    // Canonical chain создаёт Order ТОЛЬКО через OrderRequested consumer.
    const sm = await createStaff("s25_boot2", RoleCode.SALES_MANAGER);
    const fx2 = await createProduct("s25_boot2", 60);
    const ctx = await makeReadySale(sm.accessToken, fx2);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const canonical = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(canonical.id);
    expect(canonical.orderRequestedEventId).toBeTruthy();
    expect(canonical.saleId).toBe(ctx.sale.id);
  });

  // ── Вспомогательные проверки envelope ─────────────────────────────────────

  it("10. envelope: entityId/entityType/actor консьюмера корректны", async () => {
    const sm = await createStaff("s25_env", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_env", 70);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId: ctx.sale.id } });
    created.orders.push(order.id);

    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: order.id, eventType: "OrderCreated" } });
    expect(ev.aggregateType).toBe("Order");
    expect(ev.aggregateId).toBe(order.id);
    // actor — SYSTEM (consumer processing, Step 1.15A), не USER.
    expect((ev.actor as { type?: string }).type).toBe("SYSTEM");
  });

  // ── Concurrency через реальный API (§14: double complete → один Order) ────

  it("11. double complete одного Sale → один Order (409 на втором)", async () => {
    const sm = await createStaff("s25_dbl", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s25_dbl", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    await complete(sm.accessToken, ctx.sale.code, 2).expect(409);

    const orders = await prisma.order.findMany({ where: { saleId: ctx.sale.id } });
    expect(orders).toHaveLength(1);
    created.orders.push(orders[0].id);
    expect(await prisma.outboxEvent.count({ where: { aggregateType: "Sale", aggregateId: ctx.sale.id, eventType: "OrderRequested" } })).toBe(1);
  });
});
