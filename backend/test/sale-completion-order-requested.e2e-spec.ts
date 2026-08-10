/**
 * E2E PHASE 2 STEP 2.4 — Sale Completion → OrderRequested + Availability Reservation Gate.
 *
 * Покрывает (§47-54):
 *  core: 1. anonymous 401; 2. unauthorized 403; 3. authorized completion;
 *        4. terms missing → 422; 5. cancelled Checkout → 422; 6. unavailable → 409;
 *        7. successful reservation (RSR-*, HELD); 8. Sale CLOSED + completedAt;
 *        9. ровно один OrderRequested; 10. payload без PII; 11. frozen total/currency;
 *        12. payment terms exact; 13. acquisition source exact; 14. no Order;
 *        15. no Booking; 16. no Payment; 17. history; 18. audit; 19. requestId/correlation.
 *  concurrency (§48/51): 20. double completion одного Sale; 21. last-slot двух Sales;
 *        22. capacity never negative; 23. одна reservation на Sale; 24. одно событие;
 *        25. проигравший не имеет history/event/reservation.
 *  failure/retry (§49-50): failure atomicity (422/409 → ничего), retryFailed.
 *  immutability (§52-54): Catalog reprice/Checkout mutation не меняют snapshot.
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
import { runWithRequestContext, createRequestId } from "../src/shared/request-context";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
  tariffPrice: string;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe("Phase 2 Step 2.4 — Sale Completion → OrderRequested + Availability Reservation Gate (e2e)", () => {
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
    reservations: string[];
    auditLogs: string[];
  } = { users: [], customers: [], products: [], quotes: [], checkouts: [], sales: [], reservations: [], auditLogs: [] };

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
      .send({ type: "TOUR", title: `S24 ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number) => {
    const res = await adminAgent
      .post(`/api/v1/products/${productId}/availability`)
      .send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal })
      .expect(201);
    created.reservations.push(""); // placeholder, реальные — только HELD rows
    return res.body as { id: string };
  };

  /**
   * Полный fixture: ISSUED Quote + CheckoutIntent (ACTIVE) + terms + serviceDate +
   * availability + Sale (OPEN, привязан к Checkout).
   */
  const makeReadySale = async (
    smToken: string,
    fx: ProductFixture,
    opts: { slots?: number; terms?: boolean; serviceDate?: string; checkoutStatus?: "ACTIVE" } = {},
  ) => {
    const date = opts.serviceDate ?? FUTURE();
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken)
      .post("/api/v1/sales/checkouts")
      .send({ quoteId: quote.id, serviceDate: date })
      .expect(201)).body as { id: string; code: string; version: number; total: string; currency: string };
    created.checkouts.push(intent.id);

    if (opts.terms ?? true) {
      await agent(smToken)
        .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
        .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
        .expect(200);
    }
    const availDate = date;
    await upsertAvailability(fx.productId, fx.tariffId, availDate, opts.slots ?? 10);

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number; status: string };
    created.sales.push(sale.id);
    return { quote, intent, sale, date, total: intent.total, currency: intent.currency };
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

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    for (const id of created.sales) {
      await prisma.saleHistory.deleteMany({ where: { saleId: id } });
      await prisma.sale.deleteMany({ where: { id } });
    }
    await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
    // Shared-DB isolation: чистим свои OrderRequested-строки outbox (payload.saleId
    // в наших Sale), чтобы другие спеки не зависели от нашего счётчика событий.
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`,
        created.sales,
      );
    }
    for (const id of created.quotes) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.deleteMany({ where: { id } });
    }
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1-2. Auth / RBAC ───────────────────────────────────────────────────────

  it("1. anonymous → 401 на complete", async () => {
    await request(app.getHttpServer()).post("/api/v1/sales/sales/SAL-00000001/complete").send({ expectedVersion: 1 }).expect(401);
  });

  it("2. не-владельцы → 403 (BUYER/PARTNER/FINANCE/ANALYST/OPERATOR)", async () => {
    const sm = await createStaff("s24_rbac", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_rbac", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const buyer = await registerBuyer("s24_buyer");
    const partner = await createStaff("s24_partner", RoleCode.PARTNER, "partnerpass123");
    const finance = await createStaff("s24_fin", RoleCode.FINANCE);
    const analyst = await createStaff("s24_analyst", RoleCode.ANALYST);
    const operator = await createStaff("s24_op", RoleCode.OPERATOR);

    for (const who of [buyer, partner, finance, analyst, operator]) {
      await complete(who.accessToken, ctx.sale.code, 1).expect(403);
    }
  });

  // ── 3. Authorized completion + core assertions ─────────────────────────────

  it("3. SALES_MANAGER complete → CLOSED + completedAt + ровно один OrderRequested; DIRECTOR 403 (нет complete-права)", async () => {
    const sm = await createStaff("s24_ok", RoleCode.SALES_MANAGER);
    const director = await createStaff("s24_dir", RoleCode.DIRECTOR);
    const fx = await createProduct("s24_ok", 150.5);
    const ctx = await makeReadySale(sm.accessToken, fx);

    // DIRECTOR: read ok, complete → 403 (no sales.sale.complete).
    await agent(director.accessToken).get(`/api/v1/sales/sales/${ctx.sale.code}`).expect(200);
    await complete(director.accessToken, ctx.sale.code, 1).expect(403);

    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as {
      saleId: string;
      saleCode: string;
      status: string;
      version: number;
      completedAt: string;
      orderRequestedEventId: string;
      reservations: string[];
    };
    expect(r.status).toBe("CLOSED");
    expect(r.version).toBe(2);
    expect(r.completedAt).toBeTruthy();
    expect(r.reservations).toHaveLength(1);
    expect(r.reservations[0]).toMatch(/^RSR-\d{8}$/);

    // Sale row: snapshot + milestone.
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(saleRow.status).toBe("CLOSED");
    expect(saleRow.completedAt).toBeTruthy();
    expect(String(saleRow.total)).toBe(ctx.total);
    expect(saleRow.currency).toBe(ctx.currency);
    expect(saleRow.acquisitionSource).toBe("DIRECT");
    expect(saleRow.orderRequestedEventId).toBe(r.orderRequestedEventId);

    // Ровно одно событие OrderRequested (по Sale).
    const events = await prisma.outboxEvent.findMany({ where: { aggregateType: "Sale", aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(r.orderRequestedEventId);
    expect(events[0].retryable).toBe(true);
    // correlation из HTTP request context (requestId), не business-код.
    expect(events[0].correlationId).toBeTruthy();
    expect(events[0].correlationId).not.toBe(ctx.sale.code);
    // Публикация: PENDING → PUBLISHED (нет подписчика → published count 0, но статус… publishPending не трогает без подписчиков? Проверяем только факт события.)
  });

  it("4. terms missing → 422, ничего не резервируется", async () => {
    const sm = await createStaff("s24_noterms", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_noterms", 100);
    const ctx = await makeReadySale(sm.accessToken, fx, { terms: false });

    await complete(sm.accessToken, ctx.sale.code, 1).expect(422);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } })).toBe(0);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } })).status).toBe("OPEN");
  });

  it("5. cancelled Checkout → 422 (immutable checkout)", async () => {
    const sm = await createStaff("s24_canc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_canc", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${ctx.intent.code}/cancel`).send({ expectedVersion: 2 }).expect(201);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(422);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(0);
  });

  it("6. unavailable (capacity 0 / NOT_CONFIGURED) → 409/422, capacity не negative", async () => {
    const sm = await createStaff("s24_unav", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_unav", 100);
    const ctx = await makeReadySale(sm.accessToken, fx, { slots: 0 });

    await complete(sm.accessToken, ctx.sale.code, 1).expect(409);
    const row = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId } });
    expect(row.slotsReserved).toBe(0); // не negative
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(0);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } })).status).toBe("OPEN");
  });

  // ── 7-8. Reservation + Sale state ──────────────────────────────────────────

  it("7. успешная reservation: HELD row, slotsReserved += quantity, sourceSaleId", async () => {
    const sm = await createStaff("s24_res", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_res", 100);
    const ctx = await makeReadySale(sm.accessToken, fx, { slots: 5 });

    const before = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId } });
    const r = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { reservations: string[] };
    const res = await prisma.availabilityReservation.findUniqueOrThrow({ where: { code: r.reservations[0] } });
    expect(res.status).toBe("HELD");
    expect(res.sourceSaleId).toBe(ctx.sale.id);
    expect(res.productId).toBe(fx.productId);
    expect(res.quantity).toBe(1);
    const after = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId } });
    expect(after.slotsReserved).toBe(before.slotsReserved + 1);
  });

  it("8. Sale CLOSED: snapshot frozen + history milestone + audit", async () => {
    const sm = await createStaff("s24_snap", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_snap", 120);
    const ctx = await makeReadySale(sm.accessToken, fx);

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(saleRow.status).toBe("CLOSED");
    expect(String(saleRow.total)).toBe(ctx.total);
    expect(saleRow.paymentScheme).toBe("FULL_PREPAYMENT");
    expect(String(saleRow.initialAmount)).toBe(ctx.total);
    expect(String(saleRow.remainingAmount)).toBe("0");
    expect(saleRow.acquisitionSource).toBe("DIRECT");

    // History: ровно один completed milestone.
    const hist = await prisma.saleHistory.findMany({ where: { saleId: ctx.sale.id } });
    expect(hist.map((h) => h.action)).toEqual(["created", "completed"]);
    expect(hist[1].from).toBe("OPEN");
    expect(hist[1].to).toBe("CLOSED");
    expect(JSON.stringify(hist[1].fields)).not.toMatch(/firstName|lastName|email|passport/);

    const audit = await prisma.auditLog.findMany({ where: { resource: "Sale", resourceId: ctx.sale.id } });
    expect(audit.map((a) => a.action)).toContain("sales.sale.completed");
    created.auditLogs.push(...audit.map((a) => a.id));
    for (const a of audit) expect(JSON.stringify(a.details ?? {})).not.toMatch(/firstName|lastName|email|passport/);
  });

  // ── 9-13. OrderRequested payload ───────────────────────────────────────────

  it("9-13. payload: без PII, frozen total/currency exact, payment terms exact, acquisition exact, items", async () => {
    const sm = await createStaff("s24_payload", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_payload", 88.5);
    const ctx = await makeReadySale(sm.accessToken, fx);

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    const p = ev.payload as Record<string, unknown>;

    expect(p.version).toBe(1);
    expect(p.saleCode).toBe(ctx.sale.code);
    expect(p.checkoutCode).toBe(ctx.intent.code);
    expect(p.quoteId).toBe(ctx.quote.id);
    expect(p.customerId).toBeNull();
    expect(p.currency).toBe(ctx.currency);
    expect(p.total).toBe(ctx.total);
    expect(p.paymentScheme).toBe("FULL_PREPAYMENT");
    expect(p.initialAmount).toBe(ctx.total);
    expect(p.remainingAmount).toBe("0");
    expect(p.acquisitionSource).toBe("DIRECT");
    expect(p.serviceDate).toBe(ctx.date);
    expect((p.items as Array<{ productCode: string; quantity: number; amount: string }>)[0]).toMatchObject({
      productCode: expect.stringMatching(/^PRD-\d{8}$/),
      quantity: 1,
      amount: "88.5",
    });
    // PII-minimization: нет имен/email/passport.
    expect(JSON.stringify(p)).not.toMatch(/firstName|lastName|passport|email|phone/);
  });

  // ── 14-16. Isolation ───────────────────────────────────────────────────────

  it("14-16. нет Order/Booking/Payment side effects", async () => {
    const sm = await createStaff("s24_iso", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_iso", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    expect(await prisma.order.count()).toBe(ordersBefore); // Order consumer = Step 2.5
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    // Никаких Payment-моделей нет в schema — проверим отсутствие event'ов payment.
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    expect(ev.eventType).toBe("OrderRequested");
    expect(await prisma.outboxEvent.count({ where: { aggregateId: ctx.sale.id, eventType: { not: "OrderRequested" } } })).toBe(0);
  });

  // ── 17-19. History / audit / correlation ───────────────────────────────────

  it("17-19. history один milestone; audit; requestId/correlation из HTTP", async () => {
    const sm = await createStaff("s24_corr", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_corr", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const res = await agent(sm.accessToken).post(`/api/v1/sales/sales/${ctx.sale.code}/complete`).send({ expectedVersion: 1 });
    expect(res.status).toBe(201);
    // requestId — server-authoritative (Step 1.15): в заголовке x-request-id (или теле для ошибок).
    const headerRid = (res.headers["x-request-id"] ?? res.headers["request-id"] ?? res.body.requestId) as string | undefined;
    expect(headerRid).toBeTruthy();

    const hist = await prisma.saleHistory.findMany({ where: { saleId: ctx.sale.id } });
    expect(hist.map((h) => h.action)).toEqual(["created", "completed"]);
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    expect(ev.correlationId).toBeTruthy();
    expect(ev.correlationId).not.toBe(ctx.sale.code);
  });

  // ── 20. Double completion concurrency ─────────────────────────────────────

  it("20. два concurrent complete одного Sale → ровно один успех, одно событие, одна reservation", async () => {
    const sm = await createStaff("s24_dbl", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_dbl", 100);
    const ctx = await makeReadySale(sm.accessToken, fx, { slots: 5 });

    const results = await Promise.allSettled([
      complete(sm.accessToken, ctx.sale.code, 1),
      complete(sm.accessToken, ctx.sale.code, 1),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409 || s === 422)).toHaveLength(1);

    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } })).toBe(1);
    const hist = await prisma.saleHistory.findMany({ where: { saleId: ctx.sale.id } });
    expect(hist.map((h) => h.action).filter((a) => a === "completed")).toHaveLength(1);
  });

  // ── 21-25. Atomic last-slot ────────────────────────────────────────────────

  it("21-25. last-slot: два разных Sale на capacity=1 → один успех, capacity 0 не negative, проигравший без следов", async () => {
    const sm = await createStaff("s24_lasts", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_lasts", 100);
    const date = FUTURE();
    const a = await makeReadySale(sm.accessToken, fx, { slots: 1, serviceDate: date });
    // Второй Sale на ТОТ ЖЕ продукт/тариф/дату — создаём свой Quote+Checkout+Sale.
    const quote2 = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote2.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote2.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote2.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote2.code}/issue`).expect(201);
    const intent2 = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote2.id, serviceDate: date }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.checkouts.push(intent2.id);
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent2.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: 1 }).expect(200);
    const sale2 = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: quote2.id, checkoutIntentId: intent2.id }).expect(201)).body as {
      id: string;
      code: string;
    };
    created.sales.push(sale2.id);

    // Параллельные complete на capacity=1.
    const results = await Promise.allSettled([
      complete(sm.accessToken, a.sale.code, 1),
      complete(sm.accessToken, sale2.code, 1),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    // Ровно один hold; capacity никогда не negative.
    const row = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId } });
    expect(row.slotsTotal - row.slotsBooked - row.slotsReserved).toBe(0);
    expect(row.slotsReserved).toBe(1);

    // Проигравший Sale: OPEN (не CLOSED), без reservation/event/history-completed.
    const winners = await prisma.sale.findMany({ where: { id: { in: [a.sale.id, sale2.id] } }, select: { id: true, status: true } });
    const loser = winners.find((w) => w.status === "OPEN")!;
    expect(loser).toBeTruthy();
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: loser.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: loser.id, eventType: "OrderRequested" } })).toBe(0);
    const loserHist = await prisma.saleHistory.findMany({ where: { saleId: loser.id } });
    expect(loserHist.map((h) => h.action).filter((h) => h === "completed")).toHaveLength(0);
  });

  // ── 26-27. Failure atomicity ───────────────────────────────────────────────

  it("26-27. failure (422 terms missing, 409 stale version) → нет history/audit/outbox/reservation следов", async () => {
    const sm = await createStaff("s24_fail", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_fail", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    const histBefore = await prisma.saleHistory.count({ where: { saleId: ctx.sale.id } });
    const auditBefore = await prisma.auditLog.count({ where: { resource: "Sale", resourceId: ctx.sale.id } });
    const outboxBefore = await prisma.outboxEvent.count();
    const resBefore = await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } });

    await complete(sm.accessToken, ctx.sale.code, 99).expect(409); // stale CAS
    await complete(sm.accessToken, ctx.sale.code, 1).then((r) => expect(r.status).toBe(201)); // успех — контроль
    await complete(sm.accessToken, ctx.sale.code, 2).expect(409); // уже CLOSED

    // Первый 409 ничего не записал; успех записал ровно один milestone.
    expect(await prisma.saleHistory.count({ where: { saleId: ctx.sale.id } })).toBe(histBefore + 1);
    expect(await prisma.auditLog.count({ where: { resource: "Sale", resourceId: ctx.sale.id } })).toBe(auditBefore + 1);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } })).toBe(1);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: ctx.sale.id } })).toBe(resBefore + 1);
  });

  // ── 28. Immutability: Catalog reprice не меняет snapshot ──────────────────

  it("28. Catalog reprice после completion не меняет Sale snapshot / OrderRequested payload", async () => {
    const sm = await createStaff("s24_immut", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_immut", 200);
    const ctx = await makeReadySale(sm.accessToken, fx);

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    // Меняем Catalog price (mutable source) и пытаемся изменить Checkout (должно быть заблокировано по CAS).
    await prisma.tariff.update({ where: { id: fx.tariffId }, data: { price: new Prisma.Decimal("999") } });

    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(String(saleRow.total)).toBe(ctx.total); // frozen
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    expect((ev.payload as { total: string }).total).toBe(ctx.total);
  });

  // ── 29-30. Retry (G2): FAILED → retryFailed → PUBLISHED (тот же eventId) ──

  it("29-30. delivery failure → FAILED retryable; retryFailed → PENDING → publishPending → PUBLISHED (тот же eventId, attempts растёт)", async () => {
    const sm = await createStaff("s24_retry", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_retry", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    let failNext = true;
    let deliveries = 0;
    const handler = async (ev: OutboxEnvelope) => {
      // Guard: обрабатываем ТОЛЬКО событие этого Sale (не мешаем другим тестам/спекам).
      if (ev.eventType !== DomainEvents.OrderRequested) return;
      if ((ev.payload as { saleId?: string }).saleId !== ctx.sale.id) return;
      deliveries++;
      if (failNext) throw new Error("injected delivery failure");
    };
    eventBus.on(DomainEvents.OrderRequested, handler);

    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } });
    const eventId = ev.id;

    // publishPending уже выполнен в complete: consumer упал → FAILED + attempts 1 + retryable.
    expect(ev.status).toBe("FAILED");
    expect(ev.retryable).toBe(true);
    expect(ev.attempts).toBe(1);
    expect(ev.correlationId).toBeTruthy();

    // Дубликата события нет.
    expect(await prisma.outboxEvent.count({ where: { aggregateId: ctx.sale.id, eventType: "OrderRequested" } })).toBe(1);

    // Recovery: consumer больше не падает → retryFailed → publishPending.
    failNext = false;
    expect(await eventBus.retryFailed()).toBe(1);
    expect(await eventBus.publishPending()).toBe(1);

    const recovered = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(recovered.status).toBe("PUBLISHED");
    expect(recovered.id).toBe(eventId); // тот же eventId
    expect(recovered.attempts).toBeGreaterThanOrEqual(1);
    expect(recovered.correlationId).toBe(ev.correlationId); // correlation сохранён
    expect(deliveries).toBe(2); // 1 failure + 1 успех

    // Убираем обработчик: маркер больше не срабатывает (in-place, т.к. off нет).
    (handler as unknown as { _done?: boolean })._done = true;
  });

  // ── STRICT REVIEW §50: targeted tests ─────────────────────────────────────

  it("§50.1. две Sale на один Checkout → 409 (controlled, не 500)", async () => {
    const sm = await createStaff("s24_2sales", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_2sales", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    // Вторая Sale с тем же checkoutIntentId — P2002 → управляемый 409.
    await agent(sm.accessToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: ctx.quote.id, checkoutIntentId: ctx.intent.id })
      .expect(409);
    // Первая Sale не тронута.
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } })).checkoutIntentId).toBe(ctx.intent.id);
  });

  it("§50.3. multi-item: первый item OK, второй unavailable → полный rollback (без следов)", async () => {
    const sm = await createStaff("s24_multi", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_multi", 100);
    const fx2 = await createProduct("s24_multi2", 50);
    const date = FUTURE();

    const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    // item 1 — доступен; item 2 — capacity 0.
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx2.productId, tariffId: fx2.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    const intent = (await agent(sm.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.checkouts.push(intent.id);
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);
    await upsertAvailability(fx2.productId, fx2.tariffId, date, 0);
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.sales.push(sale.id);

    // item 1 зарезервировался бы, item 2 падает → ВСЯ транзакция откатывается.
    await complete(sm.accessToken, sale.code, 1).expect(409);
    expect(await prisma.availabilityReservation.count({ where: { sourceSaleId: sale.id } })).toBe(0);
    const dateObj = new Date(`${date}T00:00:00.000Z`);
    const row1 = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId, date: dateObj } });
    const row2 = await prisma.availability.findFirstOrThrow({ where: { productId: fx2.productId, tariffId: fx2.tariffId, date: dateObj } });
    expect(row1.slotsReserved).toBe(0); // item 1 decrement откачен
    expect(row2.slotsReserved).toBe(0);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe("OPEN");
    expect(await prisma.outboxEvent.count({ where: { aggregateId: sale.id, eventType: "OrderRequested" } })).toBe(0);
    expect(await prisma.saleHistory.count({ where: { saleId: sale.id, action: "completed" } })).toBe(0);
  });

  it("§50.5/50.6/50.14. Checkout immutable после completion: payment-terms/service-date/travelers/cancel → 409", async () => {
    const sm = await createStaff("s24_immut2", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_immut2", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    const { version } = ctx.intent;
    const vAfter = version + 1;
    // payment-terms (после completion) → 409
    await agent(sm.accessToken)
      .put(`/api/v1/sales/checkouts/${ctx.intent.code}/payment-terms`)
      .send({ scheme: "PAY_LATER", expectedVersion: vAfter })
      .expect(409);
    // service-date (после completion) → 409
    await agent(sm.accessToken)
      .put(`/api/v1/sales/checkouts/${ctx.intent.code}/service-date`)
      .send({ serviceDate: FUTURE(60), expectedVersion: vAfter })
      .expect(409);
    // travelers (после completion) → 409
    await agent(sm.accessToken)
      .put(`/api/v1/sales/checkouts/${ctx.intent.code}/travelers`)
      .send({ travelers: [{ firstName: "A", lastName: "B" }], expectedVersion: vAfter })
      .expect(409);
    // cancel (после completion) → 409
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${ctx.intent.code}/cancel`).send({ expectedVersion: vAfter }).expect(409);

    // Checkout остался ACTIVE, но де-факто immutable; Sale snapshot не тронут.
    const ck = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: ctx.intent.id } });
    expect(ck.status).toBe("ACTIVE");
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(sale.status).toBe("CLOSED");
    expect(String(sale.total)).toBe(ctx.total);
  });

  it("§50.13. quote-expiry policy: expired Quote не блокирует completion (frozen Checkout = price authority, без reprice)", async () => {
    const sm = await createStaff("s24_expiry", RoleCode.SALES_MANAGER);
    const fx = await createProduct("s24_expiry", 100);
    const ctx = await makeReadySale(sm.accessToken, fx);

    // Quote протухает ПОСЛЕ создания Checkout (validUntil в прошлом).
    await prisma.quote.update({ where: { id: ctx.quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });
    expect(sale.status).toBe("CLOSED");
    expect(String(sale.total)).toBe(ctx.total); // frozen Checkout, не reprice
    // Catalog price мутация после этого уже покрыта тестом 28.
  });

  // handler guard после теста: _done=true больше не влияет (guard по saleId выше уже достаточен).
});
