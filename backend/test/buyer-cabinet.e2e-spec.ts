/**
 * E2E Phase 1 Step 1.13 — Buyer Cabinet Foundation.
 *
 * Проверяет §27 (required backend tests):
 *  1.  anonymous /account/* → 401 (auth gate);
 *  2.  BUYER own profile 200 + own-scope права Buyer Cabinet;
 *  3.  forged customerId (query) rejected/ignored — own-scope сохраняется;
 *  4.  BUYER A не видит records B (IDOR: /account/orders, /account/bookings);
 *  5.  PARTNER denied Buyer-only endpoint (403);
 *  6.  MODERATOR denied (403);
 *  7.  account projection исключает CRM internal fields (точный whitelist ключей);
 *  8.  Orders own-scope: BUYER видит ТОЛЬКО свои заказы (реальные records);
 *  9.  Bookings own-scope: через Order relation (реальные records);
 *  10. Payments/Documents/Support — controlled empty contract (available:false);
 *  11. no fake data: empty-секции не содержат выдуманных records;
 *  12. temporal fields: createdAt/serviceDate canonical, НЕ updatedAt;
 *  14. public Marketplace regression: anonymous и залогиненный BUYER видят
 *      /public/products (public API, без internal endpoints).
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
import { RoleCode } from "../src/generated/prisma/enums";
import { IdsService } from "../src/shared/ids.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

interface BuyerSession {
  accessToken: string;
  user: {
    id: string;
    role: string;
    status: string;
    email: string | null;
    customerId: string | null;
    permissions: string[];
  };
}

describe("Phase 1 Step 1.13 — Buyer Cabinet Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: { users: string[]; customers: string[]; products: string[]; orders: string[] } = {
    users: [],
    customers: [],
    products: [],
    orders: [],
  };

  const register = (body: Record<string, unknown>) => request(app.getHttpServer()).post("/api/v1/auth/register").send(body);

  const login = async (username: string, password: string): Promise<BuyerSession> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as BuyerSession;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** Регистрирует BUYER, трекает User+связанный Customer для cleanup, возвращает сессию. */
  const registerBuyer = async (tag: string): Promise<BuyerSession> => {
    const res = await register({
      username: `${tag}${stamp}`,
      email: `${tag}${stamp}@test.local`,
      password: "buyerpass123",
      firstName: "Покупатель",
      lastName: tag.toUpperCase(),
    }).expect(201);
    const session = res.body as BuyerSession;
    created.users.push(session.user.id);
    // User→Customer без каскада (межсхемные FK запрещены): Customer чистим явно.
    if (session.user.customerId) created.customers.push(session.user.customerId);
    return session;
  };

  /** Создаёт staff-роль (PARTNER/MODERATOR/...) через ADMIN /users. */
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (
      await adminAgent
        .post("/api/v1/users")
        .send({ username: `${tag}${stamp}`, password, roleCode })
        .expect(201)
    ).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
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

  // Step 2.6: test-only fixture вместо удалённого POST /orders/bootstrap.
  const fixtureOrder = (body: FixtureOrderInput) => createFixtureOrder(prisma, ids, eventBus, body);

  afterAll(async () => {
    // Очистка в обратном порядке зависимостей.
    await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    // Shared-DB isolation (STRICT REVIEW 2.5B): child BookingCreated имеет
    // aggregateId = bookingId (НЕ orderId) — вычищаем по payload.orderId.
    if (created.orders.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: { eventType: "BookingCreated", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) },
      });
    }
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.orders } }, { aggregateId: { in: created.products } }, { aggregateId: { in: created.customers } }] },
    });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Auth gate ────────────────────────────────────────────────────────────

  it("1. anonymous /account/* → 401 (auth gate, §27.1)", async () => {
    for (const path of ["orders", "bookings", "payments", "documents", "support"]) {
      await request(app.getHttpServer()).get(`/api/v1/account/${path}`).expect(401);
    }
  });

  // ── 2. BUYER own profile + permission matrix ────────────────────────────────

  it("2. BUYER own profile 200 + own-scope Buyer Cabinet permissions (§27.2)", async () => {
    const buyer = await registerBuyer("cab_a");
    const me = (await agent(buyer.accessToken).get("/api/v1/account/profile").expect(200)).body as {
      user: { id: string; role: string; customerId: string | null };
    };
    expect(me.user.id).toBe(buyer.user.id);
    expect(me.user.role).toBe("BUYER");
    expect(me.user.customerId).toBeTruthy();

    const p = buyer.user.permissions;
    for (const perm of ["account.profile.read", "account.profile.update", "account.order.read_own", "account.booking.read_own", "account.payment.read_own", "account.document.read_own", "account.support.read_own"]) {
      expect(p).toContain(perm);
    }
    // Internal read-контракты BUYER не выдаются (§15).
    expect(p).not.toContain("order.read");
    expect(p).not.toContain("booking.read");
    expect(p).not.toContain("crm.customer.read");
    expect(p).not.toContain("finance.payment.read");
  });

  // ── 3-4. Forged customerId + IDOR ───────────────────────────────────────────

  it("3-4. forged customerId ignored; BUYER A не видит Order/Booking B (§27.3-4, §14)", async () => {
    const buyerA = await registerBuyer("cab_idor_a");
    const buyerB = await registerBuyer("cab_idor_b");
    const aAgent = agent(buyerA.accessToken);

    // Product + Order для покупателя B (test-fixture, Step 2.6).
    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Cab IDOR ${stamp}`, tariffs: [{ name: "S", price: 120 }] })
        .expect(201)
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const orderB = (
      await fixtureOrder({
        customerId: buyerB.user.customerId,
        items: [{ productId: product.id, title: product.title, type: "TOUR", price: 120 }],
      })
    ).order;
    created.orders.push(orderB.id);

    // A не видит заказ B, даже подставив его customerId в query.
    const withForged = (
      await aAgent
        .get(`/api/v1/account/orders?customerId=${encodeURIComponent(buyerB.user.customerId ?? "")}`)
        .expect(200)
    ).body as { items: unknown[]; total: number };
    expect(withForged.total).toBe(0);
    expect(withForged.items).toHaveLength(0);

    const plain = (await aAgent.get("/api/v1/account/orders").expect(200)).body as { total: number };
    expect(plain.total).toBe(0);

    // Bookings аналогично (у B заказ ещё не ушёл в Booking — пусто у обоих).
    const forgedBookings = (
      await aAgent
        .get(`/api/v1/account/bookings?customerId=${encodeURIComponent(buyerB.user.customerId ?? "")}`)
        .expect(200)
    ).body as { total: number };
    expect(forgedBookings.total).toBe(0);
  });

  // ── 5-6. PARTNER / MODERATOR denied ─────────────────────────────────────────

  it("5-6. PARTNER/MODERATOR/ADMIN → 403: кабинет by design BUYER-only, явный role-gate (§27.5-6, §5)", async () => {
    const partner = await createStaff("cab_partner", RoleCode.PARTNER, "partnerpass123");
    const mod = await createStaff("cab_mod", RoleCode.MODERATOR);

    for (const path of ["orders", "bookings", "payments", "documents", "support"]) {
      await agent(partner.accessToken).get(`/api/v1/account/${path}`).expect(403);
      await agent(mod.accessToken).get(`/api/v1/account/${path}`).expect(403);
    }
    // ADMIN (ALL_PERMISSIONS) НЕ «получает пусто из-за отсутствия customerId» —
    // строгий role-gate: кабинет только BUYER → явный 403 (§5 REVIEW FIX).
    for (const path of ["orders", "bookings", "payments", "documents", "support"]) {
      await adminAgent.get(`/api/v1/account/${path}`).expect(403);
    }
    // Профиль (Step 1.9 own-scope) остаётся доступен authenticated любой роли.
    await adminAgent.get("/api/v1/account/profile").expect(200);
  });

  // ── 7-9 + 12. Own-scope real records, projection, temporal semantics ────────

  it("7-9+12. BUYER видит СВОИ заказы и бронирования: real records, точная projection, canonical timestamps (§27.7-9, §13)", async () => {
    const buyer = await registerBuyer("cab_own");
    const bAgent = agent(buyer.accessToken);

    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Cab Own ${stamp}`, tariffs: [{ name: "S", price: 250 }] })
        .expect(201)
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const order = (
      await fixtureOrder({
        customerId: buyer.user.customerId,
        serviceDate: "2026-10-01T00:00:00.000Z",
        items: [{ productId: product.id, title: product.title, type: "TOUR", price: 250 }],
        travelers: [{ firstName: "Покупатель", lastName: "CAB", passportNumber: "P1234567" }],
      })
    ).order;
    created.orders.push(order.id);
    expect(order.code).toMatch(/^ORD-\d{8}$/);

    // ── Orders: own-scope + projection whitelist ──────────────────────────────
    const ordersRes = (await bAgent.get("/api/v1/account/orders").expect(200)).body as {
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
    expect(ordersRes.total).toBe(1);
    expect(ordersRes.page).toBe(1);
    expect(ordersRes.hasMore).toBe(false);
    const own = ordersRes.items[0];
    expect(own.code).toBe(order.code);
    // Точная projection (§7, §19): только whitelist, БЕЗ internal/CRM/audit полей.
    // Step 2.8A: +serviceTime/serviceTimeZone (authorized frozen temporal facts,
    // order-level; OrderItem наследует — item projection без дублей).
    expect(Object.keys(own).sort()).toEqual(
      ["amount", "code", "createdAt", "currency", "id", "items", "number", "paymentStatus", "serviceDate", "serviceTime", "serviceTimeZone", "status"].sort(),
    );
    expect(own).not.toHaveProperty("customerId");
    expect(own).not.toHaveProperty("updatedAt");
    expect(own).not.toHaveProperty("version");
    expect(own).not.toHaveProperty("createdBy");
    expect(own).not.toHaveProperty("updatedBy");
    // Temporal semantics (§13): createdAt — canonical created, serviceDate — service.
    expect(Number.isNaN(Date.parse(String(own.createdAt)))).toBe(false);
    expect(String(own.serviceDate)).toContain("2026-10-01");
    // items projection.
    const item = (own.items as Array<Record<string, unknown>>)[0];
    expect(Object.keys(item).sort()).toEqual(["amount", "id", "price", "productCode", "quantity", "serviceDate", "title"].sort());
    expect(item).not.toHaveProperty("productId");

    // ── Bookings: own-scope через Order relation ──────────────────────────────
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "confirm" }).expect(200);
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(200);

    const bookingsRes = (await bAgent.get("/api/v1/account/bookings").expect(200)).body as {
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
    expect(bookingsRes.total).toBe(1);
    expect(bookingsRes.hasMore).toBe(false);
    const booking = bookingsRes.items[0];
    expect(String(booking.code)).toMatch(/^BKG-\d{8}$/);
    expect(booking.orderCode).toBe(order.code);
    expect(booking.currency).toBe("USD");
    expect(booking).not.toHaveProperty("updatedAt");
    expect(booking).not.toHaveProperty("productId");
    expect(Number.isNaN(Date.parse(String(booking.createdAt)))).toBe(false);
  });

  // ── 8. Pagination: page/pageSize/hasMore, cap, no silent truncation ────────

  it("8. Orders pagination: page/pageSize/hasMore, cap 50, forged params игнорируются (§8)", async () => {
    const buyer = await registerBuyer("cab_page");
    const bAgent = agent(buyer.accessToken);

    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Cab Page ${stamp}`, tariffs: [{ name: "S", price: 100 }] })
        .expect(201)
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    // Два заказа одного покупателя.
    for (let i = 0; i < 2; i++) {
      const o = (
        await fixtureOrder({
          customerId: buyer.user.customerId,
          items: [{ productId: product.id, title: `${product.title} #${i}`, type: "TOUR", price: 100 }],
        })
      ).order;
      created.orders.push(o.id);
    }

    const p1 = (await bAgent.get("/api/v1/account/orders?page=1&pageSize=1").expect(200)).body as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
    expect(p1.total).toBe(2);
    expect(p1.items).toHaveLength(1);
    expect(p1.hasMore).toBe(true);

    const p2 = (await bAgent.get("/api/v1/account/orders?page=2&pageSize=1").expect(200)).body as { hasMore: boolean; items: unknown[] };
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);

    const p3 = (await bAgent.get("/api/v1/account/orders?page=3&pageSize=1").expect(200)).body as { items: unknown[]; total: number };
    expect(p3.items).toHaveLength(0);
    expect(p3.total).toBe(2); // total честный, не «как будто все показаны»

    // pageSize > cap → 400 (DTO), forged customerId игнорируется (whitelist).
    await bAgent.get("/api/v1/account/orders?pageSize=999").expect(400);
    const forged = (await bAgent
      .get(`/api/v1/account/orders?page=1&pageSize=1&customerId=${encodeURIComponent(buyer.user.customerId ?? "")}`)
      .expect(200)).body as { total: number };
    expect(forged.total).toBe(2); // scope не меняется
  });

  // ── 10-11. Controlled empty contracts ───────────────────────────────────────

  it("10-11. Payments/Documents/Support: controlled empty contract, БЕЗ fake records (§27.10-11, §5/§9/§10/§11)", async () => {
    const buyer = await registerBuyer("cab_empty");
    const bAgent = agent(buyer.accessToken);

    for (const path of ["payments", "documents", "support"]) {
      const res = (await bAgent.get(`/api/v1/account/${path}`).expect(200)).body as {
        items: unknown[];
        total: number;
        available: boolean;
      };
      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.available).toBe(false);
    }
  });

  // ── 14. Public Marketplace regression ───────────────────────────────────────

  it("14. public Marketplace regression: anonymous и залогиненный BUYER — public API (§27.17, §17)", async () => {
    const buyer = await registerBuyer("cab_public");
    // Anonymous: публичный каталог работает.
    const anon = await request(app.getHttpServer()).get("/api/v1/public/products").expect(200);
    expect(Array.isArray(anon.body.items)).toBe(true);
    // Залогиненный BUYER: тот же public контракт (token не переключает на internal).
    const authed = await agent(buyer.accessToken).get("/api/v1/public/products").expect(200);
    expect(Array.isArray(authed.body.items)).toBe(true);
    // BUYER не имеет internal catalog read (public контур — единственный).
    await agent(buyer.accessToken).get("/api/v1/products").expect(403);
  });
});
