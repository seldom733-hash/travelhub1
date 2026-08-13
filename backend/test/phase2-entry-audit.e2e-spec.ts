/**
 * E2E PHASE 2 STEP 2.0 — PHASE 2 ENTRY AUDIT.
 *
 * Консолидированное доказательство контрактов входа в Phase 2 (НЕ будущих
 * features). Проверяет фактические boundary-контракты Phase 1:
 *  1. money representation (Decimal, без float-drift);
 *  2. legacy Payment absence (нет Payment entity; Order.paymentStatus/paidAmount
 *     НЕ выдаются за payment history; Buyer Payments = available:false);
 *  3. Order → Booking linkage (canonical customerId/orderId ссылки);
 *  4. Buyer own-scope (customerId server-derived; Buyer B не видит Order Buyer A);
 *  5. event correlation (root HTTP correlation server-authoritative в outbox);
 *  6. event dedup (Inbox unique consumerId+eventId — DB-level);
 *  7. behavioral/commercial separation (поведенческий event не создаёт Order/Sale);
 *  8. entitlement/subscription separation (нет billing/subscription модели;
 *     entitlement — enum NONE/ACTIVE/SUSPENDED/EXPIRED на Storefront);
 *  9. forged server-owned fields (customerId/acquisitionSource из body → 422);
 * 10. public/private isolation (anonymous private → 401; public neutral 404).
 *
 * Partner-scope / public-DTO-whitelist / lifecycle-хронология уже доказаны
 * выделенными suite (rbac-partner-scope, product-scope, storefront,
 * public-catalog, analytics-readiness) — здесь они цитируются, не дублируются.
 *
 * Test DB: изолированная (e2e.env.ts). MinIO не требуется (нет media-флоу).
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
import { createFixtureOrder } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; partnerId: string | null; customerId: string | null; permissions: string[] };
}

describe("Phase 2 Step 2.0 — Phase 2 entry audit (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;

  const stamp = Date.now();
  const created = { users: [] as string[], customers: [] as string[], orders: [] as string[], storefronts: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let buyerASession: Session;
  let buyerBSession: Session;
  let orderAId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const registerBuyer = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password: "buyerpass123", firstName: "И", lastName: "П" })
      .expect(201);
    const s = res.body as Session;
    created.users.push(s.user.id);
    created.customers.push(s.user.customerId!);
    return s;
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

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    buyerASession = await registerBuyer(`ar2a-${stamp}@test.local`);
    buyerBSession = await registerBuyer(`ar2b-${stamp}@test.local`);
  });

  afterAll(async () => {
    // Shared-DB isolation (STRICT REVIEW 2.5B): fixture-заказы эмитят
    // OrderCreated (causation=null) — чистим outbox + inbox своих заказов.
    if (created.orders.length > 0) {
      const orderEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: { in: created.orders } },
        select: { id: true },
      });
      const eventIds = orderEvents.map((e) => e.id);
      if (eventIds.length > 0) {
        await prisma.inboxEvent.deleteMany({ where: { eventId: { in: eventIds } } });
      }
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
    }
    await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.partnerStorefront.deleteMany({ where: { id: { in: created.storefronts } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await app.close();
  });

  // ── 1. Money representation ───────────────────────────────────────────────

  it("1. Money: Decimal(12,2) без float-drift (amount/paidAmount/price), currency companion", async () => {
    const order = await createFixtureOrder(prisma, ids, eventBus, {
      customerId: buyerASession.user.customerId,
      currency: "USD",
      items: [{ productId: "00000000-0000-0000-0000-000000000000", title: "Audit Tour", type: "TOUR", quantity: 1, price: 123.45 }],
    });
    created.orders.push(order.order.id);
    orderAId = order.order.id;
    // Decimal сериализуется строкой — точность сохранена, никакого float-drift
    expect(order.order.amount).toBe("123.45");
    expect(order.order.currency).toBe("USD");

    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderAId }, select: { amount: true, paidAmount: true, currency: true } });
    expect(row.amount.toString()).toBe("123.45");
    expect(Number(row.paidAmount)).toBe(0);
    // schema: все money-поля Decimal @db.Decimal(12,2) (Tariff.price/currency,
    // OrderItem.price/amount, Booking.amount) — float нигде не используется
    // (подтверждено инвентаризацией schema.prisma: строки 318, 1090-1091,
    // 1118-1120, 1211); здесь доказано на Order через test-fixture (Step 2.6).
  });

  // ── 2. Legacy Payment absence ─────────────────────────────────────────────

  it("2. Payment: нет Payment entity; paymentStatus/paidAmount — НЕ payment history; Buyer payments available:false", async () => {
    // Нет Prisma-делегата Payment/Refund/Settlement/Invoice
    const client = prisma as unknown as Record<string, unknown>;
    for (const m of ["payment", "refund", "settlement", "payout", "invoice", "subscription", "plan", "billing"]) {
      expect(client[m]).toBeUndefined();
    }
    // Representation — только поля на Order
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderAId }, select: { paymentStatus: true, paidAmount: true } });
    expect(order.paymentStatus).toBe("UNPAID");
    // Buyer Cabinet Payments — честный empty-state, не fake payment history
    const payments = (await agent(buyerASession.accessToken).get("/api/v1/account/payments").expect(200)).body as { available: boolean };
    expect(payments.available).toBe(false);
  });

  // ── 3. Order → Booking linkage ────────────────────────────────────────────

  it("3. Order → Booking linkage: Booking.orderId → Order.customerId (canonical refs)", async () => {
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-AUDIT-${stamp}`,
        orderId: orderAId,
        productId: "00000000-0000-0000-0000-000000000000",
        amount: 123.45,
      },
    });
    const linked = await prisma.order.findUniqueOrThrow({ where: { id: orderAId }, select: { customerId: true } });
    expect(linked.customerId).toBe(buyerASession.user.customerId);
    expect(booking.orderId).toBe(orderAId);
    await prisma.booking.deleteMany({ where: { id: booking.id } });
  });

  // ── 4. Buyer own-scope ────────────────────────────────────────────────────

  it("4. Buyer scope: customerId server-derived; Buyer B не видит Order Buyer A", async () => {
    const ownA = (await agent(buyerASession.accessToken).get("/api/v1/account/orders").expect(200)).body as { items: Array<{ id: string }>; total: number };
    expect(ownA.items.some((o) => o.id === orderAId)).toBe(true);
    const ownB = (await agent(buyerBSession.accessToken).get("/api/v1/account/orders").expect(200)).body as { items: Array<{ id: string }>; total: number };
    expect(ownB.items.some((o) => o.id === orderAId)).toBe(false);
  });

  // ── 5. Event correlation ──────────────────────────────────────────────────

  it("5. Correlation: root HTTP register → outbox CustomerCreated несёт server-authoritative correlationId", async () => {
    const buyerC = await registerBuyer(`ar2c-${stamp}@test.local`);
    const event = await prisma.outboxEvent.findFirst({
      where: { eventType: "CustomerCreated", aggregateId: buyerC.user.customerId! },
      orderBy: { createdAt: "desc" },
      select: { correlationId: true, causationId: true, actor: true },
    });
    expect(event).not.toBeNull();
    expect(event!.correlationId).not.toBeNull(); // root HTTP request correlation
    expect(event!.causationId).toBeNull(); // root-событие без родителя
  });

  // ── 6. Event dedup ────────────────────────────────────────────────────────

  it("6. Dedup: InboxEvent unique (consumerId, eventId) — DB-level; повторная вставка P2002", async () => {
    const key = `audit-${stamp}`;
    await prisma.inboxEvent.create({ data: { consumerId: key, eventId: `ev-${stamp}` } });
    let duplicate = false;
    try {
      await prisma.inboxEvent.create({ data: { consumerId: key, eventId: `ev-${stamp}` } });
    } catch (err) {
      duplicate = (err as { code?: string }).code === "P2002";
    }
    expect(duplicate).toBe(true);
    const count = await prisma.inboxEvent.count({ where: { consumerId: key } });
    expect(count).toBe(1);
    await prisma.inboxEvent.deleteMany({ where: { consumerId: key } });
  });

  // ── 7. Behavioral/commercial separation ───────────────────────────────────

  it("7. Behavioral ≠ commercial: MARKETPLACE_VIEWED не создаёт Order/Sale; источник server-authoritative", async () => {
    const ordersBefore = await prisma.order.count();
    const productsBefore = await prisma.product.count();
    await request(app.getHttpServer())
      .post("/api/v1/public/marketplace/events")
      .send({ eventType: "MARKETPLACE_VIEWED", eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), sessionId: `audit-session-${stamp}`, path: "/", locale: "ru" })
      .expect(202);
    expect(await prisma.order.count()).toBe(ordersBefore); // нет Order-побочного эффекта
    expect(await prisma.product.count()).toBe(productsBefore); // нет fake Product
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { sessionId: `audit-session-${stamp}` } });
    expect(row).not.toBeNull();
    expect(row!.acquisitionSource).toBe("MARKETPLACE"); // server-authoritative
  });

  // ── 8. Entitlement/subscription separation ────────────────────────────────

  it("8. Entitlement ≠ Subscription: нет billing-моделей; entitlementStatus — enum NONE/ACTIVE/SUSPENDED/EXPIRED", async () => {
    const sf = await prisma.partnerStorefront.create({
      data: {
        code: `SF-AUDIT-${stamp}`,
        partnerId: `partner-audit-${stamp}`,
        slug: `sf-audit-${stamp}`,
        status: "DRAFT",
        entitlementStatus: "NONE",
      },
      select: { id: true, status: true, entitlementStatus: true, activatedAt: true, activatedById: true },
    });
    created.storefronts.push(sf.id);
    expect(sf.status).toBe("DRAFT");
    expect(sf.entitlementStatus).toBe("NONE");
    expect(sf.activatedAt).toBeNull(); // lifecycle-моменты не выдумываются
    // поверхность enum (без создания Subscription/Plan/Trial)
    const e = (await prisma.$queryRawUnsafe(`SELECT unnest(enum_range(NULL::catalog."StorefrontEntitlementStatus"))::text AS v`)) as Array<{ v: string }>;
    expect(e.map((x) => x.v).sort()).toEqual(["ACTIVE", "EXPIRED", "NONE", "SUSPENDED"]);
    await prisma.partnerStorefront.deleteMany({ where: { id: { in: created.storefronts } } });
  });

  // ── 9. Forged server-owned fields ─────────────────────────────────────────

  it("9. Forged fields: customerId в register-body → 422; acquisitionSource в behavioral → 422", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: `ar2forged-${stamp}@test.local`, password: "buyerpass123", firstName: "И", lastName: "П", customerId: "forged-customer-id" })
      .expect(422);
    await request(app.getHttpServer())
      .post("/api/v1/public/marketplace/events")
      .send({ eventType: "MARKETPLACE_VIEWED", eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), sessionId: `audit-forged-${stamp}`, path: "/", locale: "ru", acquisitionSource: "DIRECT" })
      .expect(422);
  });

  // ── 10. Public/private isolation ──────────────────────────────────────────

  it("10. Isolation: anonymous private → 401; public neutral 404; public без Authorization", async () => {
    await request(app.getHttpServer()).get("/api/v1/partner/storefront").expect(401);
    await request(app.getHttpServer()).get("/api/v1/account/profile").expect(401);
    await request(app.getHttpServer()).get("/api/v1/public/storefronts/does-not-exist").expect(404);
    await request(app.getHttpServer()).get("/api/v1/public/products").expect(200); // public не требует auth
  });
});
