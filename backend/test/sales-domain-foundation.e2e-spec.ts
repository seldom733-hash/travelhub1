/**
 * E2E PHASE 2 STEP 2.1 — Sales Domain Foundation (canonical LED-/OPP-/QTE-/SAL-*).
 *
 * Покрывает §49–§52, §55:
 *  1.  anonymous /api/v1/sales/* → 401;
 *  2.  SALES_MANAGER create Lead → LED-*, DTO whitelist, temporal честность;
 *  3.  Opportunity (с leadId) → OPP-*; Quote (opportunityId/productId) → QTE-*;
 *      Sale (opportunityId/quoteId) → SAL-*;
 *  4.  forged fields (code/status/version/createdById/customerId-as-authority) → 422;
 *  5.  invalid refs (fake customerId/leadId/productId/user) → 422;
 *  6.  lifecycle: валидные переходы + невалидные/терминальные → 422; CAS-защита
 *      двойного перехода (повтор retry не создаёт дубликат milestone/history);
 *      REVIEW FIX 1: Sale без transition-команды (close-endpoint 404, история только created);
 *  7.  history + AuditLog присутствуют (без PII/body);
 *  8.  Sale НЕ создаёт Order/Booking (изоляция §46); behavioral event НЕ создаёт
 *      Lead (изоляция §45); REVIEW FIX 2: assignedToId только internal staff;
 *  9.  concurrency: 20 параллельных create на каждый prefix → 20 уникальных кодов;
 * 10.  role gates: BUYER/PARTNER/MODERATOR → 403; pagination; neutral 404.
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

interface Session {
  accessToken: string;
  user: {
    id: string;
    role: string;
    email: string | null;
    customerId: string | null;
    partnerId: string | null;
    permissions: string[];
  };
}

describe("Phase 2 Step 2.1 — Sales Domain Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let salesBeforeBoot: { leads: number; opportunities: number; quotes: number; sales: number };

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    products: string[];
    leads: string[];
    opportunities: string[];
    quotes: string[];
    sales: string[];
    auditLogs: string[];
  } = { users: [], customers: [], products: [], leads: [], opportunities: [], quotes: [], sales: [], auditLogs: [] };

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    // §invariant: boot не создаёт Sales-сущности (нет startup backfill).
    // Проверяем ДЕЛЬТОЙ (count до boot vs после), а не абсолютным нулём:
    // e2e-БД общая, другие спеки могут легально оставить Sales-строки, а порядок
    // запуска спеков на Windows нестабилен — абсолютный 0 был бы транзиентным
    // флейком того же класса, что communication.e2e (727/728).
    prisma = moduleRef.get(PrismaService);
    salesBeforeBoot = {
      leads: await prisma.lead.count(),
      opportunities: await prisma.opportunity.count(),
      quotes: await prisma.quote.count(),
      sales: await prisma.sale.count(),
    };
    await app.init();

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
    await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    await prisma.quoteHistory.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.opportunityHistory.deleteMany({ where: { opportunityId: { in: created.opportunities } } });
    await prisma.opportunity.deleteMany({ where: { id: { in: created.opportunities } } });
    await prisma.leadHistory.deleteMany({ where: { leadId: { in: created.leads } } });
    await prisma.lead.deleteMany({ where: { id: { in: created.leads } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.products } }, { aggregateId: { in: created.customers } }] },
    });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Auth gate + no startup backfill ─────────────────────────────────────

  it("1. anonymous /api/v1/sales/* → 401; нет startup backfill (count не растёт при boot)", async () => {
    for (const p of ["leads", "opportunities", "quotes", "sales"]) {
      await request(app.getHttpServer()).get(`/api/v1/sales/${p}`).expect(401);
      await request(app.getHttpServer()).post(`/api/v1/sales/${p}`).send({}).expect(401);
    }
    // ДЕЛЬТА (до boot vs сейчас), а не абсолютный 0 — см. beforeAll.
    expect(await prisma.lead.count()).toBe(salesBeforeBoot.leads);
    expect(await prisma.opportunity.count()).toBe(salesBeforeBoot.opportunities);
    expect(await prisma.quote.count()).toBe(salesBeforeBoot.quotes);
    expect(await prisma.sale.count()).toBe(salesBeforeBoot.sales);
  });

  // ── 2-5. Create + canonical prefixes + DTO whitelist + relations ───────────

  it("2. SALES_MANAGER create Lead → LED-*, DTO whitelist, temporal честность", async () => {
    const sm = await createStaff("sales_sm", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("sales_cus");

    const res = await agent(sm.accessToken)
      .post("/api/v1/sales/leads")
      .send({ name: "Интерес к Кавказу", customerId: buyer.user.customerId, assignedToId: sm.user.id })
      .expect(201);
    const lead = res.body as Record<string, unknown>;
    created.leads.push(String(lead.id));

    expect(String(lead.code)).toMatch(/^LED-\d{8}$/);
    expect(lead.name).toBe("Интерес к Кавказу");
    expect(lead.customerId).toBe(buyer.user.customerId);
    expect(lead.assignedToId).toBe(sm.user.id);
    expect(lead.status).toBe("NEW");
    expect(lead.version).toBe(1);
    // DTO whitelist: без internal/correlation полей.
    expect(lead).not.toHaveProperty("requestId");
    expect(lead).not.toHaveProperty("correlationId");
    expect(lead).not.toHaveProperty("causationId");
    expect(lead).not.toHaveProperty("history");
    // Temporal: ISO UTC, createdAt == реальное время (не backfill).
    expect(String(lead.createdAt)).toMatch(/Z$/);
    expect(Date.parse(String(lead.createdAt))).toBeGreaterThan(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("3. Opportunity/Quote/Sale создаются с canonical refs и префиксами OPP-/QTE-/SAL-", async () => {
    const sm = await createStaff("sales_sm2", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("sales_cus2");

    const lead = (
      await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "Лидер", customerId: buyer.user.customerId }).expect(201)
    ).body as { id: string; code: string };
    created.leads.push(lead.id);

    const opp = (
      await agent(sm.accessToken)
        .post("/api/v1/sales/opportunities")
        .send({ title: "Тур Кавказ — июль", leadId: lead.id, customerId: buyer.user.customerId })
        .expect(201)
    ).body as { id: string; code: string; leadId: string | null };
    created.opportunities.push(opp.id);
    expect(opp.code).toMatch(/^OPP-\d{8}$/);
    expect(opp.leadId).toBe(lead.id);

    const product = (
      await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Sales Quote Product ${stamp}`, tariffs: [{ name: "S", price: 90 }] }).expect(201)
    ).body.product as { id: string };
    created.products.push(product.id);

    const quote = (
      await agent(sm.accessToken)
        .post("/api/v1/sales/quotes")
        .send({ customerId: buyer.user.customerId, opportunityId: opp.id, productId: product.id })
        .expect(201)
    ).body as { id: string; code: string; opportunityId: string | null; productId: string | null; status: string };
    created.quotes.push(quote.id);
    expect(quote.code).toMatch(/^QTE-\d{8}$/);
    expect(quote.opportunityId).toBe(opp.id);
    expect(quote.productId).toBe(product.id);
    expect(quote.status).toBe("DRAFT");

    const sale = (
      await agent(sm.accessToken)
        .post("/api/v1/sales/sales")
        .send({ customerId: buyer.user.customerId, opportunityId: opp.id, quoteId: quote.id })
        .expect(201)
    ).body as { id: string; code: string; opportunityId: string | null; quoteId: string | null; status: string };
    created.sales.push(sale.id);
    expect(sale.code).toMatch(/^SAL-\d{8}$/);
    expect(sale.opportunityId).toBe(opp.id);
    expect(sale.quoteId).toBe(quote.id);
    expect(sale.status).toBe("OPEN");
  });

  // ── 4. Forged fields / mass assignment ─────────────────────────────────────

  it("4. forged поля (code/status/version/createdById/actor/correlation) → 422; whitelist junk → 400", async () => {
    const sm = await createStaff("sales_forge", RoleCode.SALES_MANAGER);

    await agent(sm.accessToken)
      .post("/api/v1/sales/leads")
      .send({
        name: "x",
        code: "LED-99999999",
        status: "QUALIFIED",
        version: 99,
        createdById: "someone-else",
        actorId: "someone-else",
        correlationId: "forged",
        requestId: "forged",
      })
      .expect(422);

    // Whitelist: payload без обязательных полей → 400.
    await agent(sm.accessToken).post("/api/v1/sales/leads").send({ zzJunk: "junk", customerId: "cus-fake" }).expect(400);

    // Junk-ключ при валидном payload молча срезается (whitelist), forged — невозможны.
    const ok = (
      await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "junk stripped", zzJunk: { evil: true } }).expect(201)
    ).body as { id: string };
    created.leads.push(ok.id);

    // Transition: forbidden keys (включая business-поля) → 422.
    const lead = (await agent(sm.accessToken).get("/api/v1/sales/leads").expect(200)).body as { items: Array<{ code: string; id: string }> };
    const target = lead.items[0];
    await agent(sm.accessToken)
      .post(`/api/v1/sales/leads/${target.code}/transition`)
      .send({ status: "QUALIFIED", version: 1, actorId: "x", customerId: "x" })
      .expect(422);
  });

  // ── 5. Invalid cross-domain refs → 422 ─────────────────────────────────────

  it("5. invalid refs (fake customerId/leadId/productId/user) → 422", async () => {
    const sm = await createStaff("sales_refs", RoleCode.SALES_MANAGER);

    await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "x", customerId: "cus-does-not-exist" }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "x", assignedToId: "usr-does-not-exist" }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: "x", leadId: "led-does-not-exist" }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/quotes").send({ productId: "prd-does-not-exist" }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/sales").send({ opportunityId: "opp-does-not-exist" }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: "qte-does-not-exist" }).expect(422);

    // REVIEW FIX 2: assignedToId должен быть internal staff (не BUYER/PARTNER).
    const buyerForAssign = await registerBuyer("sales_assign");
    await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "x", assignedToId: buyerForAssign.user.id }).expect(422);
    await agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: "x", assignedToId: buyerForAssign.user.id }).expect(422);
  });

  // ── 6. Lifecycle transitions + CAS ─────────────────────────────────────────

  it("6. lifecycle: валидные переходы; невалидные/терминальные → 422; CAS защищает от двойного перехода", async () => {
    const sm = await createStaff("sales_life", RoleCode.SALES_MANAGER);

    // Lead: NEW → QUALIFIED (ок); повторный QUALIFIED → 422 (детерминированный).
    const lead = (
      await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "Lifecycle Lead" }).expect(201)
    ).body as { id: string; code: string; version: number; status: string };
    created.leads.push(lead.id);

    const qualified = (
      await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(201)
    ).body as { status: string; version: number };
    expect(qualified.status).toBe("QUALIFIED");
    expect(qualified.version).toBe(lead.version + 1);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(422);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "DISQUALIFIED" }).expect(422);

    // CAS: одновременный двойной transition → один 201, другой 409 (не дублирует milestone).
    const lead2 = (
      await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "CAS Lead" }).expect(201)
    ).body as { id: string; code: string; version: number };
    created.leads.push(lead2.id);
    const results = await Promise.allSettled([
      agent(sm.accessToken).post(`/api/v1/sales/leads/${lead2.code}/transition`).send({ status: "QUALIFIED" }),
      agent(sm.accessToken).post(`/api/v1/sales/leads/${lead2.code}/transition`).send({ status: "QUALIFIED" }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    // Ровно один победитель; второй — 409 (CAS при конкурентном read) ЛИБО 422
    // (запрос сериализовался и увидел уже применённый переход — детерминированный
    // terminal/transition-guard). В обоих случаях milestone ровно один (ниже).
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    const loser = statuses.filter((s) => s !== 201);
    expect(loser).toHaveLength(1);
    expect(loser[0] === 409 || loser[0] === 422).toBe(true);
    const h = await prisma.leadHistory.findMany({ where: { leadId: lead2.id, action: "status_changed" } });
    expect(h).toHaveLength(1); // ровно один milestone, никаких дубликатов

    // Opportunity: NEW → OPEN → WON; NEW → WON запрещён; WON терминален.
    const opp = (
      await agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: "Lifecycle OPP" }).expect(201)
    ).body as { id: string; code: string };
    created.opportunities.push(opp.id);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "WON" }).expect(422);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "OPEN" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "WON" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "LOST" }).expect(422);

    // Quote: DRAFT → ISSUED (Step 2.3: ISSUE требует состав + validUntil); повтор → 422.
    const product = (
      await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Quote Lifecycle ${stamp}`, tariffs: [{ name: "Std", price: 90 }] }).expect(201)
    ).body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    const quote = (
      await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)
    ).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: tariff.id, quantity: 2 }).expect(201);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() }).expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(422);

    // REVIEW FIX 1: Sale в Step 2.1 не имеет transition-команды — статус OPEN
    // при создании; «Sale completion → OrderRequested» — Step 2.4. Close-
    // endpoint не существует (404), история Sale — только created.
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({}).expect(201)).body as { id: string; code: string; status: string };
    created.sales.push(sale.id);
    expect(sale.status).toBe("OPEN");
    await agent(sm.accessToken).post(`/api/v1/sales/sales/${sale.code}/close`).expect(404);
    const saleHistory = await prisma.saleHistory.findMany({ where: { saleId: sale.id } });
    expect(saleHistory.map((h) => h.action)).toEqual(["created"]);
  });

  // ── 7. History + Audit ─────────────────────────────────────────────────────

  it("7. history (audit by default) + AuditLog пишутся без PII/body; retry не дублирует", async () => {
    const sm = await createStaff("sales_hist", RoleCode.SALES_MANAGER);

    const lead = (
      await agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: "History Lead" }).expect(201)
    ).body as { id: string; code: string };
    created.leads.push(lead.id);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(201);

    const history = await prisma.leadHistory.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.action)).toEqual(["created", "status_changed"]);
    expect(history[1].from).toBe("NEW");
    expect(history[1].to).toBe("QUALIFIED");
    expect(history[1].actorName).toBeTruthy();
    expect(history[1].actorId).toBe(sm.user.id);

    const audits = await prisma.auditLog.findMany({
      where: { resource: "Lead", resourceId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((a) => a.action)).toEqual(["sales.lead.created", "sales.lead.status_changed"]);
    // Audit без PII/body: details содержат только code/status refs.
    expect(JSON.stringify(audits[0].details ?? {})).not.toContain("History Lead");
    for (const a of audits) created.auditLogs.push(a.id);
  });

  // ── 8. Isolation: Sale ≠ Order/Booking; behavioral ≠ Lead ─────────────────

  it("8. Sale НЕ создаёт Order/Booking; behavioral event НЕ создаёт Lead", async () => {
    const sm = await createStaff("sales_iso", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("sales_iso_cus");

    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();
    const leadsBefore = await prisma.lead.count();
    // Shared-DB isolation: Step 2.4 e2e законно публикует OrderRequested —
    // сравниваем ДО/ПОСЛЕ создания Sale, а не абсолютный 0.
    const orderEventsBefore = await prisma.outboxEvent.count({
      where: { eventType: { in: ["OrderRequested", "OrderCreated"] } },
    });

    const sale = (
      await agent(sm.accessToken)
        .post("/api/v1/sales/sales")
        .send({ customerId: buyer.user.customerId })
        .expect(201)
    ).body as { id: string; code: string };
    created.sales.push(sale.id);

    // Sale (OPEN) не создаёт Order/Booking и не публикует OrderRequested.
    expect(await prisma.order.count()).toBe(ordersBefore);
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: { in: ["OrderRequested", "OrderCreated"] } },
      }),
    ).toBe(orderEventsBefore);

    // Behavioral event (Marketplace view) → 202, но НЕ создаёт Lead.
    await request(app.getHttpServer())
      .post("/api/v1/public/marketplace/events")
      .send({
        eventId: crypto.randomUUID(),
        eventType: "MARKETPLACE_VIEWED",
        occurredAt: new Date().toISOString(),
        sessionId: "anon-session-x",
        locale: "en",
        path: "/search",
      })
      .expect(202);
    expect(await prisma.lead.count()).toBe(leadsBefore);
  });

  // ── 9. Concurrency: canonical codes ────────────────────────────────────────

  it("9. concurrency: 20 параллельных create на каждый prefix → 20 уникальных кодов", async () => {
    const sm = await createStaff("sales_conc", RoleCode.SALES_MANAGER);

    const leads = await Promise.all(
      Array.from({ length: 20 }, (_, i) => agent(sm.accessToken).post("/api/v1/sales/leads").send({ name: `Conc Lead ${i}` }).expect(201)),
    );
    const leadCodes = leads.map((r) => String((r.body as { code: string }).code));
    expect(new Set(leadCodes).size).toBe(20);
    for (const c of leadCodes) expect(c).toMatch(/^LED-\d{8}$/);
    for (const r of leads) created.leads.push(String((r.body as { id: string }).id));

    const opps = await Promise.all(
      Array.from({ length: 20 }, (_, i) => agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: `Conc OPP ${i}` }).expect(201)),
    );
    const oppCodes = opps.map((r) => String((r.body as { code: string }).code));
    expect(new Set(oppCodes).size).toBe(20);
    for (const c of oppCodes) expect(c).toMatch(/^OPP-\d{8}$/);
    for (const r of opps) created.opportunities.push(String((r.body as { id: string }).id));

    const quotes = await Promise.all(
      Array.from({ length: 20 }, () => agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)),
    );
    const quoteCodes = quotes.map((r) => String((r.body as { code: string }).code));
    expect(new Set(quoteCodes).size).toBe(20);
    for (const c of quoteCodes) expect(c).toMatch(/^QTE-\d{8}$/);
    for (const r of quotes) created.quotes.push(String((r.body as { id: string }).id));

    const sales = await Promise.all(
      Array.from({ length: 20 }, () => agent(sm.accessToken).post("/api/v1/sales/sales").send({}).expect(201)),
    );
    const saleCodes = sales.map((r) => String((r.body as { code: string }).code));
    expect(new Set(saleCodes).size).toBe(20);
    for (const c of saleCodes) expect(c).toMatch(/^SAL-\d{8}$/);
    for (const r of sales) created.sales.push(String((r.body as { id: string }).id));

    // Никакой P2002 наружу (все 201), количество строк точно 20.
    expect(await prisma.lead.count({ where: { code: { in: leadCodes } } })).toBe(20);
    expect(await prisma.opportunity.count({ where: { code: { in: oppCodes } } })).toBe(20);
    expect(await prisma.quote.count({ where: { code: { in: quoteCodes } } })).toBe(20);
    expect(await prisma.sale.count({ where: { code: { in: saleCodes } } })).toBe(20);
  });

  // ── 10. Role gates + pagination + neutral 404 ──────────────────────────────

  it("10. role gates: BUYER/PARTNER/MODERATOR → 403; pagination; neutral 404", async () => {
    const buyer = await registerBuyer("sales_role_b");
    const mod = await createStaff("sales_role_m", RoleCode.MODERATOR);
    const partner = await createStaff("sales_role_p", RoleCode.PARTNER, "partnerpass123");

    for (const who of [buyer, mod, partner]) {
      await agent(who.accessToken).get("/api/v1/sales/leads").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/leads").send({ name: "x" }).expect(403);
      await agent(who.accessToken).get("/api/v1/sales/opportunities").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/sales").send({}).expect(403);
    }

    // Несуществующий код → neutral 404 (без раскрытия деталей).
    await agent((await createStaff("sales_404", RoleCode.SALES_MANAGER)).accessToken).get("/api/v1/sales/leads/LED-99999999").expect(404);

    // Pagination: детерминированный порядок, total, cap 50.
    const page1 = (await agent((await createStaff("sales_page", RoleCode.SALES_MANAGER)).accessToken).get("/api/v1/sales/leads?page=1&pageSize=5").expect(200)).body as {
      items: Array<{ code: string; createdAt: string }>;
      total: number;
      hasMore: boolean;
      pageSize: number;
    };
    expect(page1.items.length).toBeGreaterThan(0);
    expect(page1.items.length).toBeLessThanOrEqual(5);
    expect(page1.pageSize).toBe(5);
    expect(typeof page1.total).toBe("number");
    expect(typeof page1.hasMore).toBe("boolean");
    await agent((await createStaff("sales_page2", RoleCode.SALES_MANAGER)).accessToken).get("/api/v1/sales/leads?pageSize=999").expect(400);
  });
});
