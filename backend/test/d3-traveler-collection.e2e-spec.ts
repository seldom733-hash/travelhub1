/**
 * PHASE 3 — PRE-STEP 3.12 — D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION (e2e)
 *
 * Покрывает (§14–§20 промпта):
 *  1. PIN at termsAcceptedAt: Order создаётся с pinnedRequirements (effective
 *     snapshot), termsAcceptedAt, travelerCount (canonical count из checkout);
 *  2. SNAPSHOT IMMUTABILITY: изменение Product policy (birthDate OPTIONAL →
 *     REQUIRED) НЕ меняет уже принятый checkout (старый Order остаётся OPTIONAL),
 *     новый checkout → REQUIRED (hard gate §3/§14);
 *  3. REQUIRED/OPTIONAL/NOT_REQUESTED semantics: NOT_REQUESTED поля не хранятся,
 *     REQUIRED валидируется сервером при завершении, OPTIONAL сохраняется;
 *  4. save → refresh → resume: частичный save персистится, GET возвращает данные;
 *  5. MULTI-TRAVELER: 2 Travelers, Traveler2 с недостающим REQUIRED полем →
 *     final confirmation DENIED; после дополнения → travelerDataCompletedAt →
 *     final confirm OK → один Order → ровно 2 OrderTraveler → одна Booking →
 *     ровно 2 Passenger (данные из confirmed OrderTraveler, passportExpiry включён);
 *  6. final confirmation gate + idempotency: duplicate final-confirm → 409,
 *     мутация после final confirm → 409, никакого дубля Order;
 *  7. CROSS-TENANT / PII: BUYER → 403 на D3 endpoints; SALES_MANAGER видит
 *     redacted PII (passport/birthDate null) и не может мутировать (403);
 *     PARTNER (одобренный, чужой тенант) → 403 (RBAC: у PARTNER нет order.*);
 *  8. NO-REQUEST FLOW: canonical chain не создаёт Request; legacy Order без
 *     D3-полей → pinned null, submission до acceptance → 422, final confirm → 422;
 *  9. Invalid date → 422 (birthDate format).
 *
 * Продукты создаёт одобренный PARTNER (Step 3.6B: Product обязан иметь
 * Partner owner). Цепочка продаж — canonical: Quote → CheckoutIntent →
 * Sale → complete → OrderRequested → Order (consumer).
 *
 * Тестовая БД: e2e-isolated-env (per-suite PG isolation, suffix "test").
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

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

interface ProductFixture {
  productId: string;
  tariffId: string;
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
const PAST = (years = 30) => new Date(Date.now() - years * 365 * 86400000).toISOString().slice(0, 10);

describe("Phase 3 Pre-Step 3.12 D3 — Traveler Collection + Order/Booking Population (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
    requests: string[];
  } = { users: [], customers: [], partners: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], requests: [] };

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

  /** Полный onboarding одобренного партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    // Username партнёра = email в lowercase (auth канонизирует username) —
    // логин идёт по тому же lowercase-username.
    const email = `d3p${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D3 Partner ${tag} ${stamp}`,
        country: "AZ",
        contactEmail: email,
        termsAccepted: true,
      })
      .expect(201);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    created.users.push(session.user.id);
    return { partnerId: approved.partnerId, token: session.accessToken, agent: agent(session.accessToken) };
  };

  const createProduct = async (seller: Seller, tag: string, opts: { type?: string; price?: number; travelerRequirements?: Record<string, string> | null } = {}): Promise<ProductFixture> => {
    const res = await seller.agent
      .post("/api/v1/products")
      .send({
        type: opts.type ?? "TOUR",
        title: `D3 ${tag} ${stamp}`,
        tariffs: [{ name: "Std", price: opts.price ?? 100 }],
        ...(opts.travelerRequirements !== undefined ? { travelerRequirements: opts.travelerRequirements } : {}),
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

  /** Полный fixture до Sale (НЕ complete): ISSUED Quote + Checkout (travelers/terms/date) + Sale OPEN. */
  const makeReadySale = async (
    smToken: string,
    fx: ProductFixture,
    opts: { travelers?: Array<{ firstName: string; lastName: string; birthDate?: string }> } = {},
  ): Promise<SaleCtx> => {
    const date = FUTURE();
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
      .send({ quoteId: quote.id, serviceDate: date, travelers: opts.travelers ?? [] })
      .expect(201)).body as { id: string; code: string; version: number; total: string; currency: string };
    created.checkouts.push(intent.id);
    await agent(smToken)
      .put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`)
      .send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version })
      .expect(200);
    await upsertAvailability(fx.productId, fx.tariffId, date, 10);

    const sale = (await agent(smToken)
      .post("/api/v1/sales/sales")
      .send({ quoteId: quote.id, checkoutIntentId: intent.id })
      .expect(201)).body as { id: string; code: string; version: number; status: string };
    created.sales.push(sale.id);
    return { quote, intent, sale, date, total: intent.total, currency: intent.currency };
  };

  const complete = (token: string, saleCode: string, expectedVersion: number) =>
    agent(token).post(`/api/v1/sales/sales/${saleCode}/complete`).send({ expectedVersion });

  const orderFor = async (saleId: string) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { saleId } });
    created.orders.push(order.id);
    return order;
  };

  const getTravelers = (token: string, orderId: string) => agent(token).get(`/api/v1/orders/${orderId}/travelers`);
  const patchTraveler = (token: string, orderId: string, travelerId: string, body: Record<string, unknown>) =>
    agent(token).patch(`/api/v1/orders/${orderId}/travelers/${travelerId}`).send(body);
  const validateCompletion = (token: string, orderId: string) => agent(token).post(`/api/v1/orders/${orderId}/validate-completion`);
  const finalConfirm = (token: string, orderId: string) => agent(token).post(`/api/v1/orders/${orderId}/final-confirm`);
  const orderAction = (token: string, orderId: string, action: string) => agent(token).patch(`/api/v1/orders/${orderId}`).send({ action });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      // Bookings (passengers/history — FK cascade) + их outbox/inbox.
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Booking" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE ("eventType" = 'BookingCreated' AND "payload"->>'orderId' = ANY($1))`,
        created.orders,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderCreated','OrderReadyForBooking','OrderFulfilled','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
    }
    if (created.sales.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'OrderRequested' AND "payload"->>'saleId' = ANY($1)`, created.sales);
      const salesRows = await prisma.sale.findMany({ where: { id: { in: created.sales } }, select: { orderRequestedEventId: true } });
      const reqEventIds = salesRows.map((s) => s.orderRequestedEventId).filter((e): e is string => !!e);
      if (reqEventIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "events"."InboxEvent" WHERE "consumerId" = 'order-requested-consumer' AND "eventId" = ANY($1)`,
          reqEventIds,
        );
      }
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
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
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } }); // PartnerApplication cascade
    await app.close();
  });

  // ── §3/§14: PIN at termsAcceptedAt + legacy NULL Product → defaults ────────

  it("1. PIN: Order получает pinnedRequirements/termsAcceptedAt/travelerCount; legacy NULL Product → ProductType defaults", async () => {
    const seller = await createApprovedSeller("pin");
    const sm = await createStaff("d3_pin", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_pin"); // TOUR, travelerRequirements = NULL
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: PAST() }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);

    // D3 §3: pinned effective requirements (TOUR defaults — Product NULL → defaults).
    expect(order.termsAcceptedAt).not.toBeNull();
    expect(order.travelerCount).toBe(1);
    const pinned = order.pinnedRequirements as Record<string, string>;
    expect(pinned.firstName).toBe("REQUIRED");
    expect(pinned.lastName).toBe("REQUIRED");
    expect(pinned.birthDate).toBe("OPTIONAL");
    expect(pinned.citizenship).toBe("NOT_REQUESTED");
    expect(pinned.gender).toBe("NOT_REQUESTED");
    expect(pinned.passportNumber).toBe("NOT_REQUESTED");
    expect(pinned.passportExpiry).toBe("NOT_REQUESTED");

    // API отдаёт тот же snapshot (DB = API).
    const op = await createStaff("d3_pinop", RoleCode.OPERATOR);
    const view = (await getTravelers(op.accessToken, order.id).expect(200)).body as {
      pinnedRequirements: Record<string, string>;
      termsAcceptedAt: string;
      travelerCount: number;
      travelers: unknown[];
    };
    expect(view.pinnedRequirements).toEqual(pinned);
    expect(view.travelerCount).toBe(1);
    expect(view.travelers).toHaveLength(1);
  });

  // ── §14: HARD IMMUTABILITY ────────────────────────────────────────────────

  it("2. Product policy birthDate OPTIONAL→REQUIRED не меняет принятый checkout; новый checkout → REQUIRED", async () => {
    const seller = await createApprovedSeller("imm");
    const sm = await createStaff("d3_imm", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_imm", { travelerRequirements: { birthDate: "OPTIONAL" } });
    const ctxA = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Анна", lastName: "Петрова" }],
    });
    await complete(sm.accessToken, ctxA.sale.code, 1).expect(201);
    const orderA = await orderFor(ctxA.sale.id);
    expect((orderA.pinnedRequirements as Record<string, string>).birthDate).toBe("OPTIONAL");

    // 4. Product policy меняется: birthDate → REQUIRED (владелец-PARTNER
    //    правит свой DRAFT-продукт через update_own_draft).
    await seller.agent
      .patch(`/api/v1/products/${fx.productId}`)
      .send({ travelerRequirements: { birthDate: "REQUIRED" } })
      .expect(200);

    // 5. Старый принятый checkout НЕ меняется (pinned snapshot immutable).
    const op = await createStaff("d3_immop", RoleCode.OPERATOR);
    const viewA = (await getTravelers(op.accessToken, orderA.id).expect(200)).body as { pinnedRequirements: Record<string, string> };
    expect(viewA.pinnedRequirements.birthDate).toBe("OPTIONAL");

    // 6. Новый checkout → REQUIRED (effective = новая Product policy).
    const ctxB = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Борис", lastName: "Сидоров" }],
    });
    await complete(sm.accessToken, ctxB.sale.code, 1).expect(201);
    const orderB = await orderFor(ctxB.sale.id);
    expect((orderB.pinnedRequirements as Record<string, string>).birthDate).toBe("REQUIRED");
  });

  // ── §9: NOT_REQUESTED minimization + §13: save → refresh → resume ─────────

  it("3. NOT_REQUESTED поля не сохраняются; частичный save персистится (resume); invalid date → 422", async () => {
    const seller = await createApprovedSeller("min");
    const sm = await createStaff("d3_min", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_min"); // TOUR: citizenship/passport NOT_REQUESTED
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов" }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    const traveler = await prisma.orderTraveler.findFirstOrThrow({ where: { orderId: order.id } });

    const op = await createStaff("d3_minop", RoleCode.OPERATOR);

    // Попытка сохранить NOT_REQUESTED чувствительные поля — отбрасываются (минимизация).
    await patchTraveler(op.accessToken, order.id, traveler.id, { citizenship: "AZ", passportNumber: "P1234567" }).expect(200);
    const after = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: traveler.id } });
    expect(after.citizenship).toBeNull();
    expect(after.passportNumber).toBeNull();

    // Частичный save OPTIONAL (birthDate) → персистится; GET (refresh/resume) возвращает.
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: PAST() }).expect(200);
    const view = (await getTravelers(op.accessToken, order.id).expect(200)).body as {
      travelers: Array<{ id: string; birthDate: string | null; dataCompleteness: string }>;
    };
    expect(view.travelers).toHaveLength(1);
    expect(view.travelers[0].birthDate?.slice(0, 10)).toBe(PAST());
    // TOUR: firstName/lastName REQUIRED уже присутствуют из checkout → COMPLETE.
    expect(view.travelers[0].dataCompleteness).toBe("COMPLETE");

    // Invalid date → 422 (формат YYYY-MM-DD, server-side).
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: "not-a-date" }).expect(422);
  });

  // ── §15: MULTI-TRAVELER + completion + final gate + Booking/Passenger ─────

  it("4. MULTI-TRAVELER: Traveler2 с недостающим REQUIRED → final confirm denied; после дополнения → 1 Order + 2 OrderTraveler + 1 Booking + 2 Passenger", async () => {
    const seller = await createApprovedSeller("mt");
    const sm = await createStaff("d3_mt", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_mt", {
      type: "FLIGHT", // REQUIRED: firstName/lastName/birthDate/citizenship/passportNumber/passportExpiry
    });
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [
        { firstName: "Иван", lastName: "Иванов", birthDate: PAST() },
        { firstName: "Пётр", lastName: "Петров", birthDate: PAST(35) },
      ],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    expect(order.travelerCount).toBe(2);

    const op = await createStaff("d3_mtop", RoleCode.OPERATOR);
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } });
    expect(travelers).toHaveLength(2);
    const t1 = travelers[0];
    const t2 = travelers[1];

    // Traveler1: все REQUIRED заполнены → COMPLETE.
    await patchTraveler(op.accessToken, order.id, t1.id, {
      citizenship: "RU",
      passportNumber: "RU1000001",
      passportExpiry: FUTURE(1000),
    }).expect(200);

    // Traveler2: passportExpiry (REQUIRED для FLIGHT) отсутствует → INCOMPLETE.
    await patchTraveler(op.accessToken, order.id, t2.id, {
      citizenship: "AZ",
      passportNumber: "AZ2000002",
    }).expect(200);
    let t2row = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2row.dataCompleteness).toBe("INCOMPLETE");

    // Completion validation → false; final confirm → 422 (denied).
    const incomplete = (await validateCompletion(op.accessToken, order.id).expect(201)).body as { complete: boolean };
    expect(incomplete.complete).toBe(false);
    await finalConfirm(op.accessToken, order.id).expect(422);

    // Traveler2 дополнен (passportExpiry) → COMPLETE → travelerDataCompletedAt → final confirm OK.
    await patchTraveler(op.accessToken, order.id, t2.id, {
      passportExpiry: FUTURE(900),
    }).expect(200);
    t2row = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2row.dataCompleteness).toBe("COMPLETE");

    const completed = (await validateCompletion(op.accessToken, order.id).expect(201)).body as { complete: boolean; travelerDataCompletedAt: string | null };
    expect(completed.complete).toBe(true);
    expect(completed.travelerDataCompletedAt).not.toBeNull();
    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderRow.travelerDataCompletedAt).not.toBeNull();

    const confirmRes = (await finalConfirm(op.accessToken, order.id).expect(201)).body as { orderId: string; finalConfirmedAt: string };
    expect(confirmRes.finalConfirmedAt).toBeTruthy();
    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderAfter.finalConfirmedAt).not.toBeNull();
    // finalConfirmedAt ≠ termsAcceptedAt (два разных события).
    expect(orderAfter.finalConfirmedAt!.getTime()).toBeGreaterThanOrEqual(orderAfter.termsAcceptedAt!.getTime());

    // ── §17: duplicate final confirm → 409; мутация после final confirm → 409 ─
    await finalConfirm(op.accessToken, order.id).expect(409);
    await patchTraveler(op.accessToken, order.id, t1.id, { gender: "M" }).expect(409);
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);

    // ── §11: Booking/Passenger через existing mechanism (process → confirm → send) ─
    await orderAction(op.accessToken, order.id, "process").expect(200);
    await orderAction(op.accessToken, order.id, "confirm").expect(200);
    await orderAction(op.accessToken, order.id, "send").expect(200);

    const bookings = await prisma.booking.findMany({ where: { orderId: order.id } });
    expect(bookings).toHaveLength(1); // V1: 1 Order = 1 Booking (один item)
    const passengers = await prisma.passenger.findMany({ where: { bookingId: bookings[0].id }, orderBy: { id: "asc" } });
    expect(passengers).toHaveLength(2); // ровно 2 Passenger = 2 confirmed OrderTraveler
    const t1After = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: t1.id } });
    const names = passengers.map((p) => p.firstName).sort();
    expect(names).toEqual(["Иван", "Пётр"]);
    const passIvan = passengers.find((p) => p.firstName === "Иван")!;
    expect(passIvan.passportNumber).toBe(t1After.passportNumber);
    expect(passIvan.passportExpiry?.toISOString().slice(0, 10)).toBe(t1After.passportExpiry!.toISOString().slice(0, 10));
    const passPetr = passengers.find((p) => p.firstName === "Пётр")!;
    expect(passPetr.passportNumber).toBe("AZ2000002");
    // Passenger из confirmed OrderTraveler (не Customer/Product), passportExpiry включён.
    expect(passPetr.passportExpiry).not.toBeNull();
  });

  it("5. Concurrent final-confirm → ровно один победитель, один Order", async () => {
    const seller = await createApprovedSeller("conc");
    const sm = await createStaff("d3_conc", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_conc"); // TOUR: firstName/lastName REQUIRED (уже есть)
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Ольга", lastName: "Орлова" }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    const op = await createStaff("d3_conop", RoleCode.OPERATOR);
    const traveler = await prisma.orderTraveler.findFirstOrThrow({ where: { orderId: order.id } });
    // Данные туриста сохраняются (collection flow) → traveler COMPLETE.
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: PAST() }).expect(200);
    await validateCompletion(op.accessToken, order.id).expect(201);

    const results = await Promise.allSettled([finalConfirm(op.accessToken, order.id), finalConfirm(op.accessToken, order.id)]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : 0));
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);
  });

  // ── §16: CROSS-TENANT / PII ───────────────────────────────────────────────

  it("6. BUYER → 403; чужой PARTNER → 403; SALES_MANAGER видит redacted PII и не мутирует (403)", async () => {
    const seller = await createApprovedSeller("secA");
    const sm = await createStaff("d3_sec", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_sec");
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: PAST() }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    const traveler = await prisma.orderTraveler.findFirstOrThrow({ where: { orderId: order.id } });
    const op = await createStaff("d3_secop", RoleCode.OPERATOR);
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: PAST() }).expect(200);

    // BUYER — нет order.read вообще.
    const buyer = await registerBuyer("d3_buyer");
    await getTravelers(buyer.accessToken, order.id).expect(403);
    await patchTraveler(buyer.accessToken, order.id, traveler.id, { citizenship: "AZ" }).expect(403);
    await finalConfirm(buyer.accessToken, order.id).expect(403);

    // Чужой одобренный PARTNER (Partner B) — у PARTNER нет order.* (rbac-partner-scope).
    const sellerB = await createApprovedSeller("secB");
    await getTravelers(sellerB.token, order.id).expect(403);
    await patchTraveler(sellerB.token, order.id, traveler.id, { citizenship: "RU" }).expect(403);
    await finalConfirm(sellerB.token, order.id).expect(403);

    // SALES_MANAGER: order.read есть → GET 200, но PII redacted (birthDate null);
    // мутации (order.edit_noncritical) — 403.
    const view = (await getTravelers(sm.accessToken, order.id).expect(200)).body as {
      travelers: Array<{ firstName: string; lastName: string; birthDate: string | null; passportNumber: string | null }>;
    };
    expect(view.travelers[0].firstName).toBe("Иван");
    expect(view.travelers[0].birthDate).toBeNull();
    expect(view.travelers[0].passportNumber).toBeNull();
    await patchTraveler(sm.accessToken, order.id, traveler.id, { citizenship: "RU" }).expect(403);
    await finalConfirm(sm.accessToken, order.id).expect(403);
  });

  // ── §12: NO-REQUEST FLOW + legacy ─────────────────────────────────────────

  it("7. canonical chain — no-Request flow; legacy Order без D3-полей — submission до acceptance → 422, final confirm → 422", async () => {
    const seller = await createApprovedSeller("noreq");
    const sm = await createStaff("d3_noreq", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_noreq");
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов" }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);

    // No-Request flow: Orders создаются без Request (пре-Order inquiry не обязателен).
    expect(await prisma.request.count({ where: { convertedOrderId: order.id } })).toBe(0);

    // Legacy Order (до D3, без pinned/termsAcceptedAt): GET pinned → null;
    // traveler submission before acceptance → 422; final confirm → 422.
    const legacy = await prisma.order.create({
      data: {
        code: `ORD-LEG${stamp}`,
        number: `TH-2026-${stamp}`,
        referenceNumber: `MKT-ORD-${stamp}`,
        commerceSequence: String(stamp),
        customerId: null,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency: "AZN",
        amount: new Prisma.Decimal(1),
        paidAmount: new Prisma.Decimal(0),
        version: 1,
        // D3-поля отсутствуют (termsAcceptedAt/pinnedRequirements/travelerCount = NULL)
      },
    });
    created.orders.push(legacy.id);
    const legacyTraveler = await prisma.orderTraveler.create({
      data: { orderId: legacy.id, firstName: "Старый", lastName: "Клиент", dataCompleteness: "INCOMPLETE", version: 1 },
    });

    const op = await createStaff("d3_legop", RoleCode.OPERATOR);
    const legacyView = (await getTravelers(op.accessToken, legacy.id).expect(200)).body as { pinnedRequirements: unknown; termsAcceptedAt: unknown };
    expect(legacyView.pinnedRequirements).toBeNull();
    expect(legacyView.termsAcceptedAt).toBeNull();

    await patchTraveler(op.accessToken, legacy.id, legacyTraveler.id, { citizenship: "RU" }).expect(422);
    await finalConfirm(op.accessToken, legacy.id).expect(422);
  });

  // ── SR §16: BOOKING ELIGIBILITY — hard gate ──────────────────────────────

  it("9. Booking НЕ может начаться до final confirmation (confirm/send на traveler-bearing Order → отклонено)", async () => {
    const seller = await createApprovedSeller("sr_elig");
    const sm = await createStaff("d3_srelig", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_srelig"); // TOUR, count=1
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: PAST() }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    expect(order.travelerCount).toBe(1);

    const op = await createStaff("d3_sreligop", RoleCode.OPERATOR);
    // Данные собраны (COMPLETE), НО final confirmation ещё не выполнена.
    const traveler = await prisma.orderTraveler.findFirstOrThrow({ where: { orderId: order.id } });
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: PAST() }).expect(200);

    // process — операционная обработка возможна (Order существует как commerce root).
    await orderAction(op.accessToken, order.id, "process").expect(200);
    // confirm (READY_FOR_BOOKING) ДО final confirmation → 422 (hard gate SR §16).
    await orderAction(op.accessToken, order.id, "confirm").expect(422);
    // send (BookingRequested) ДО final confirmation: READY_FOR_BOOKING недостижим,
    // прямой send из IN_PROCESSING → 409 (status machine) — Booking невозможен.
    await orderAction(op.accessToken, order.id, "send").expect(409);
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.id, eventType: "BookingRequested" } })).toBe(0);

    // После final confirmation (данные уже COMPLETE) → confirm/send разрешены.
    await finalConfirm(op.accessToken, order.id).expect(201);
    await orderAction(op.accessToken, order.id, "confirm").expect(200);
    await orderAction(op.accessToken, order.id, "send").expect(200);
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(1);
  });

  // ── SR §4: termsAcceptedAt = РЕАЛЬНЫЙ acceptance instant (не processing time) ─

  it("10. termsAcceptedAt == Sale.completedAt (acceptance), frozen через OrderRequested payload", async () => {
    const seller = await createApprovedSeller("sr_acc");
    const sm = await createStaff("d3_sracc", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_sracc", {
      travelerRequirements: { birthDate: "REQUIRED", citizenship: "NOT_REQUESTED" },
    });
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Анна", lastName: "Петрова", birthDate: PAST() }],
    });
    const completed = (await complete(sm.accessToken, ctx.sale.code, 1).expect(201)).body as { completedAt: string };
    const order = await orderFor(ctx.sale.id);
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: ctx.sale.id } });

    // Order.termsAcceptedAt = реальный acceptance instant (Sale.completedAt), НЕ now consumer-а.
    expect(order.termsAcceptedAt!.getTime()).toBe(saleRow.completedAt!.getTime());
    expect(new Date(completed.completedAt).getTime()).toBe(order.termsAcceptedAt!.getTime());
    // Snapshot заморожен в payload (acceptance) → Order.pinned совпадает с override.
    expect((order.pinnedRequirements as Record<string, string>).birthDate).toBe("REQUIRED");
    expect((order.pinnedRequirements as Record<string, string>).citizenship).toBe("NOT_REQUESTED");
  });

  // ── §17: Idempotency через реальный API (duplicate final confirm) ────────

  it("8. повторный final-confirm после успеха → 409 (no duplicate commerce root)", async () => {
    const seller = await createApprovedSeller("dup");
    const sm = await createStaff("d3_dup", RoleCode.SALES_MANAGER);
    const fx = await createProduct(seller, "d3_dup");
    const ctx = await makeReadySale(sm.accessToken, fx, {
      travelers: [{ firstName: "Иван", lastName: "Иванов" }],
    });
    await complete(sm.accessToken, ctx.sale.code, 1).expect(201);
    const order = await orderFor(ctx.sale.id);
    const op = await createStaff("d3_dupop", RoleCode.OPERATOR);
    const traveler = await prisma.orderTraveler.findFirstOrThrow({ where: { orderId: order.id } });
    await patchTraveler(op.accessToken, order.id, traveler.id, { birthDate: PAST() }).expect(200);
    await validateCompletion(op.accessToken, order.id).expect(201);

    await finalConfirm(op.accessToken, order.id).expect(201);
    await finalConfirm(op.accessToken, order.id).expect(409);
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);
    expect(await prisma.orderHistory.count({ where: { orderId: order.id, action: "final_confirm" } })).toBe(1);
  });
});