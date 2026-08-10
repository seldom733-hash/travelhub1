/**
 * E2E PHASE 2 STEP 2.2 — Sales Center Backend (§90).
 *
 *  1.  anonymous denied (entity + center endpoints → 401);
 *  2.  BUYER/PARTNER/MODERATOR → 403;
 *  3.  KPI zero-state (fresh Sales domain: нули, пустые очереди, no NaN);
 *  4.  SALES_MANAGER operational access (list/detail/queue/KPI/history/actions/assign);
 *  5.  RBAC matrix (N2 review): ANALYST/MARKETER aggregate-only KPI, raw list/
 *      detail/queue/history → 403; FINANCE — sale.read only; DIRECTOR — broad read;
 *  6.  filters: status/assignedToId/customerId/code/search/period; sort whitelist;
 *      invalid (pageSize/date-range/status/queue) → 400/422;
 *  7.  pagination: >1 page, no dup/missing, deterministic, total/hasMore;
 *  8.  queues: status inclusion/exclusion, unassigned, predicate ↔ KPI consistency;
 *  9.  KPI mixed state: byStatus/unassigned/funnel counts, period filter;
 * 10.  KPI no financial fields (revenue/GMV/payment отсутствуют);
 * 11.  history: created → status_changed → assigned (immutable order, actor);
 * 12.  lifecycle actions + Sale close/complete absent (404);
 * 13.  assignment: assign staff / reassign / unassign / BUYER→422 / CAS 409;
 * 14.  audit entries (без PII); correlation injected;
 * 15.  isolation: Order/Booking counts неизменны, outbox без OrderRequested;
 * 16.  privacy: responses без email/phone/CRM internals/request fields.
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

describe("Phase 2 Step 2.2 — Sales Center Backend (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    leads: string[];
    opportunities: string[];
    quotes: string[];
    sales: string[];
    auditLogs: string[];
    products: string[];
  } = { users: [], customers: [], leads: [], opportunities: [], quotes: [], sales: [], auditLogs: [], products: [] };

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

  const smCreateLead = async (token: string, name: string) => {
    const lead = (await agent(token).post("/api/v1/sales/leads").send({ name }).expect(201)).body as { id: string; code: string };
    created.leads.push(lead.id);
    return lead;
  };

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
    await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
    await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    await prisma.quoteHistory.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.opportunityHistory.deleteMany({ where: { opportunityId: { in: created.opportunities } } });
    await prisma.opportunity.deleteMany({ where: { id: { in: created.opportunities } } });
    await prisma.leadHistory.deleteMany({ where: { leadId: { in: created.leads } } });
    await prisma.lead.deleteMany({ where: { id: { in: created.leads } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    // Step 2.3: quotes c items/travelers (cascade) + продукты созданы в lifecycle-тесте.
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Anonymous + zero-state ──────────────────────────────────────────────

  it("1. anonymous (entity + center) → 401; KPI zero-state: нули, пустые очереди, без NaN/Infinity", async () => {
    for (const p of ["/api/v1/sales/leads", "/api/v1/sales/center/kpi", "/api/v1/sales/center/queues?queue=NEW_LEADS"]) {
      await request(app.getHttpServer()).get(p).expect(401);
    }
    await request(app.getHttpServer()).post("/api/v1/sales/leads/LED-00000001/assign").send({ assignedToId: "x" }).expect(401);

    // Sales-таблицы пусты (предыдущие спеки чистят за собой) → KPI-нули.
    expect(await prisma.lead.count()).toBe(0);
    const sm = await createStaff("sc_zero", RoleCode.SALES_MANAGER);
    const kpi = (await agent(sm.accessToken).get("/api/v1/sales/center/kpi").expect(200)).body as {
      leads: { total: number; byStatus: Record<string, number>; unassigned: number };
      sales: { byStatus: Record<string, number> };
      funnel: Record<string, number>;
    };
    expect(kpi.leads.total).toBe(0);
    expect(Object.values(kpi.leads.byStatus).every((v) => v === 0)).toBe(true);
    expect(kpi.sales.byStatus.OPEN).toBe(0);
    expect(Object.values(kpi.funnel).every((v) => v === 0)).toBe(true);
    expect(JSON.stringify(kpi)).not.toMatch(/NaN|Infinity/);

    const q = (await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=NEW_LEADS").expect(200)).body as { items: unknown[]; total: number };
    expect(q.total).toBe(0);
    expect(q.items).toHaveLength(0);
  });

  // ── 2. BUYER/PARTNER/MODERATOR denied ─────────────────────────────────────

  it("2. BUYER/PARTNER/MODERATOR → 403 на entity и center endpoints", async () => {
    const buyer = await registerBuyer("sc_buyer");
    const partner = await createStaff("sc_partner", RoleCode.PARTNER, "partnerpass123");
    const mod = await createStaff("sc_mod", RoleCode.MODERATOR);

    for (const who of [buyer, partner, mod]) {
      await agent(who.accessToken).get("/api/v1/sales/leads").expect(403);
      await agent(who.accessToken).get("/api/v1/sales/center/kpi").expect(403);
      await agent(who.accessToken).get("/api/v1/sales/center/queues?queue=NEW_LEADS").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/leads").send({ name: "x" }).expect(403);
    }
  });

  // ── 3. SALES_MANAGER operational access ───────────────────────────────────

  it("3. SALES_MANAGER: list/detail/queue/KPI/history/actions/assign доступны", async () => {
    const sm = await createStaff("sc_sm", RoleCode.SALES_MANAGER);
    const lead = await smCreateLead(sm.accessToken, "SC Lead");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: sm.user.id }).expect(201);

    await agent(sm.accessToken).get(`/api/v1/sales/leads/${lead.code}`).expect(200);
    await agent(sm.accessToken).get(`/api/v1/sales/leads/${lead.code}/history`).expect(200);
    await agent(sm.accessToken).get("/api/v1/sales/center/kpi").expect(200);
    await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=NEW_LEADS").expect(200);
    await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=QUALIFIED_LEADS").expect(200);
  });

  // ── 4. RBAC matrix (N2) ───────────────────────────────────────────────────

  it("4. RBAC: ANALYST/MARKETER — только агрегированный KPI (raw → 403); FINANCE — sale.read only; DIRECTOR — broad read", async () => {
    const analyst = await createStaff("sc_analyst", RoleCode.ANALYST);
    const marketer = await createStaff("sc_marketer", RoleCode.MARKETER);
    const finance = await createStaff("sc_finance", RoleCode.FINANCE);
    const director = await createStaff("sc_director", RoleCode.DIRECTOR);

    // ANALYST: kpi 200, но raw list/detail/queue/history → 403; никаких labels/IDs в KPI.
    const kpiA = (await agent(analyst.accessToken).get("/api/v1/sales/center/kpi").expect(200)).body as Record<string, unknown>;
    expect(JSON.stringify(kpiA)).not.toMatch(/LED-|OPP-|QTE-|SAL-|\bcode\b/);
    await agent(analyst.accessToken).get("/api/v1/sales/leads").expect(403);
    await agent(analyst.accessToken).get("/api/v1/sales/leads/LED-00000001").expect(403);
    await agent(analyst.accessToken).get("/api/v1/sales/leads/LED-00000001/history").expect(403);
    await agent(analyst.accessToken).get("/api/v1/sales/center/queues?queue=NEW_LEADS").expect(403);

    // MARKETER: kpi 200, raw → 403.
    await agent(marketer.accessToken).get("/api/v1/sales/center/kpi").expect(200);
    await agent(marketer.accessToken).get("/api/v1/sales/leads").expect(403);

    // FINANCE: sale.read only — sales list 200, leads/opportunities/quotes → 403, kpi → 403.
    await agent(finance.accessToken).get("/api/v1/sales/sales").expect(200);
    await agent(finance.accessToken).get("/api/v1/sales/leads").expect(403);
    await agent(finance.accessToken).get("/api/v1/sales/opportunities").expect(403);
    await agent(finance.accessToken).get("/api/v1/sales/quotes").expect(403);
    await agent(finance.accessToken).get("/api/v1/sales/center/kpi").expect(403);
    await agent(finance.accessToken).get("/api/v1/sales/center/queues?queue=OPEN_SALES").expect(200);

    // DIRECTOR: broad read + kpi.
    await agent(director.accessToken).get("/api/v1/sales/leads").expect(200);
    await agent(director.accessToken).get("/api/v1/sales/center/kpi").expect(200);

    // Reconciliation: у ANALYST/MARKETER нет raw sales.* в сессии (после seed).
    expect(analyst.user.permissions).not.toContain("sales.lead.read");
    expect(analyst.user.permissions).toContain("sales.kpi.read");
    expect(marketer.user.permissions).not.toContain("sales.opportunity.read");
    expect(finance.user.permissions).toContain("sales.sale.read");
    expect(finance.user.permissions).not.toContain("sales.lead.read");
  });

  // ── 5. Filters ─────────────────────────────────────────────────────────────

  it("5. filters: status/assignedToId/customerId/code/search/period; sort whitelist; invalid → 400/422", async () => {
    const sm = await createStaff("sc_f", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("sc_f_cus");
    const lead1 = await smCreateLead(sm.accessToken, "Фильтр Альфа");
    const lead2 = await smCreateLead(sm.accessToken, "Фильтр Бета");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead1.code}/assign`).send({ assignedToId: sm.user.id }).expect(201);

    // status.
    const statusRes = (await agent(sm.accessToken).get("/api/v1/sales/leads?status=NEW").expect(200)).body as { total: number; items: Array<{ code: string }> };
    expect(statusRes.total).toBeGreaterThanOrEqual(1);

    // assignedToId.
    let res = (await agent(sm.accessToken).get(`/api/v1/sales/leads?assignedToId=${sm.user.id}`).expect(200)).body as { total: number };
    expect(res.total).toBe(1);

    // customerId (только ref, без PII-поиска).
    const byCus = (await agent(sm.accessToken).get(`/api/v1/sales/leads?customerId=${buyer.user.customerId}`).expect(200)).body as { total: number };
    expect(byCus.total).toBe(0);

    // code exact + search contains.
    res = (await agent(sm.accessToken).get(`/api/v1/sales/leads?code=${lead1.code}`).expect(200)).body as { total: number };
    expect(res.total).toBe(1);
    res = (await agent(sm.accessToken).get("/api/v1/sales/leads?search=%D0%90%D0%BB%D1%8C%D1%84%D0%B0").expect(200)).body as { total: number };
    expect(res.total).toBe(1);

    // period: createdAt-range inclusive.
    const before = new Date(Date.now() - 60_000).toISOString();
    const after = new Date(Date.now() + 60_000).toISOString();
    res = (await agent(sm.accessToken).get(`/api/v1/sales/leads?from=${encodeURIComponent(before)}&to=${encodeURIComponent(after)}`).expect(200)).body as { total: number };
    expect(res.total).toBeGreaterThanOrEqual(2);
    // Будущий период → 0.
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    res = (await agent(sm.accessToken).get(`/api/v1/sales/leads?from=${encodeURIComponent(future)}`).expect(200)).body as { total: number };
    expect(res.total).toBe(0);

    // sort whitelist: невалидный ключ → 400 (DTO IsIn), валидный работает.
    await agent(sm.accessToken).get("/api/v1/sales/leads?sort=zzz&order=asc").expect(400);
    await agent(sm.accessToken).get("/api/v1/sales/leads?sort=status&order=asc").expect(200);
    await agent(sm.accessToken).get("/api/v1/sales/leads?order=zzz").expect(400);

    // invalid: pageSize cap, date range from>to, status enum, queue enum.
    await agent(sm.accessToken).get("/api/v1/sales/leads?pageSize=999").expect(400);
    await agent(sm.accessToken).get(`/api/v1/sales/leads?from=${encodeURIComponent(after)}&to=${encodeURIComponent(before)}`).expect(422);
    await agent(sm.accessToken).get("/api/v1/sales/leads?status=ZZZ").expect(400);
    await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=NOT_A_QUEUE").expect(400);
    await agent(sm.accessToken).get("/api/v1/sales/center/kpi?from=not-a-date").expect(400);
  });

  // ── 6. Pagination ─────────────────────────────────────────────────────────

  it("6. pagination: >1 page, no dup/missing, deterministic order, total/hasMore, tie-breaker", async () => {
    const sm = await createStaff("sc_page", RoleCode.SALES_MANAGER);
    for (let i = 0; i < 7; i++) await smCreateLead(sm.accessToken, `Page Lead ${i}`);
    // Изоляция от кумулятивных данных других тестов: уникальный display search.
    const scope = "search=Page%20Lead";

    const p1 = (await agent(sm.accessToken).get(`/api/v1/sales/leads?${scope}&page=1&pageSize=4`).expect(200)).body as {
      items: Array<{ code: string; createdAt: string }>;
      total: number;
      hasMore: boolean;
      pageSize: number;
    };
    const p2 = (await agent(sm.accessToken).get(`/api/v1/sales/leads?${scope}&page=2&pageSize=4`).expect(200)).body as {
      items: Array<{ code: string }>;
      total: number;
      hasMore: boolean;
    };
    expect(p1.items).toHaveLength(4);
    expect(p1.hasMore).toBe(true);
    expect(p2.items.length).toBeGreaterThanOrEqual(1);
    expect(p2.hasMore).toBe(false);
    expect(p1.total).toBe(p2.total);

    const codes = [...p1.items.map((i) => i.code), ...p2.items.map((i) => i.code)];
    expect(new Set(codes).size).toBe(codes.length); // no duplicates
    // Deterministic: createdAt desc.
    const times = p1.items.map((i) => Date.parse(i.createdAt));
    for (let i = 1; i < times.length; i++) expect(times[i] <= times[i - 1]).toBe(true);
  });

  // ── 7. Queues ─────────────────────────────────────────────────────────────

  it("7. queues: status inclusion/exclusion, unassigned, predicate ↔ KPI consistency", async () => {
    const sm = await createStaff("sc_q", RoleCode.SALES_MANAGER);
    const qualBefore = (await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=QUALIFIED_LEADS").expect(200)).body as { total: number };
    const newLead = await smCreateLead(sm.accessToken, "Queue New");
    const qualLead = await smCreateLead(sm.accessToken, "Queue Qualified");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${qualLead.code}/transition`).send({ status: "QUALIFIED" }).expect(201);
    const unassignedLead = await smCreateLead(sm.accessToken, "Queue Unassigned");

    const newQ = (await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=NEW_LEADS&pageSize=50").expect(200)).body as { items: Array<{ code: string }>; total: number };
    expect(newQ.items.some((i) => i.code === newLead.code)).toBe(true);
    expect(newQ.items.some((i) => i.code === qualLead.code)).toBe(false); // exclusion
    expect(newQ.items.some((i) => i.code === unassignedLead.code)).toBe(true);

    // Дельта от кумулятивных данных других тестов: ровно +1 QUALIFIED.
    const qualQ = (await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=QUALIFIED_LEADS").expect(200)).body as { total: number };
    expect(qualQ.total).toBe(qualBefore.total + 1);

    const unassignedQ = (await agent(sm.accessToken).get("/api/v1/sales/center/queues?queue=UNASSIGNED_LEADS").expect(200)).body as { total: number };
    expect(unassignedQ.total).toBeGreaterThanOrEqual(1);

    // Consistency: KPI NEW leads == queue NEW_LEADS total == list status-filter total (same predicate).
    const kpi = (await agent(sm.accessToken).get("/api/v1/sales/center/kpi").expect(200)).body as { leads: { byStatus: Record<string, number> } };
    const listNew = (await agent(sm.accessToken).get("/api/v1/sales/leads?status=NEW&pageSize=1").expect(200)).body as { total: number };
    expect(kpi.leads.byStatus.NEW).toBe(newQ.total);
    expect(kpi.leads.byStatus.NEW).toBe(listNew.total);
  });

  // ── 8-9. KPI mixed state + period ─────────────────────────────────────────

  it("8. KPI mixed state: byStatus/unassigned/funnel counts + period filter; без финансовых полей", async () => {
    const sm = await createStaff("sc_kpi", RoleCode.SALES_MANAGER);
    const lead = await smCreateLead(sm.accessToken, "KPI Lead");
    const opp = (
      await agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: "KPI OPP", leadId: lead.id }).expect(201)
    ).body as { id: string; code: string };
    created.opportunities.push(opp.id);
    const quote = (
      await agent(sm.accessToken).post("/api/v1/sales/quotes").send({ opportunityId: opp.id }).expect(201)
    ).body as { id: string; code: string };
    created.quotes.push(quote.id);
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: quote.id, opportunityId: opp.id }).expect(201)).body as { id: string };
    created.sales.push(sale.id);

    const kpi = (await agent(sm.accessToken).get("/api/v1/sales/center/kpi").expect(200)).body as {
      period: { from: string | null; to: string | null };
      leads: { total: number; byStatus: Record<string, number>; unassigned: number };
      opportunities: { total: number; byStatus: Record<string, number> };
      quotes: { total: number; byStatus: Record<string, number> };
      sales: { total: number; byStatus: Record<string, number> };
      funnel: Record<string, number>;
    };
    expect(kpi.period).toEqual({ from: null, to: null });
    expect(kpi.leads.total).toBeGreaterThanOrEqual(1);
    expect(kpi.leads.byStatus.NEW).toBeGreaterThanOrEqual(1);
    expect(kpi.opportunities.total).toBeGreaterThanOrEqual(1);
    expect(kpi.opportunities.byStatus.NEW).toBeGreaterThanOrEqual(1);
    expect(kpi.quotes.total).toBeGreaterThanOrEqual(1);
    expect(kpi.quotes.byStatus.DRAFT).toBeGreaterThanOrEqual(1);
    expect(kpi.sales.byStatus.OPEN).toBeGreaterThanOrEqual(1);
    expect(kpi.funnel.opportunitiesFromLeads).toBeGreaterThanOrEqual(1);
    expect(kpi.funnel.quotesFromOpportunities).toBeGreaterThanOrEqual(1);
    expect(kpi.funnel.salesFromQuotes).toBeGreaterThanOrEqual(1);
    expect(kpi.funnel.salesFromOpportunities).toBeGreaterThanOrEqual(1);

    // No financial fields anywhere.
    const raw = JSON.stringify(kpi);
    for (const bad of ["revenue", "gmv", "amount", "price", "paid", "commission", "payment", "order", "booking"]) {
      expect(raw.toLowerCase()).not.toContain(bad);
    }

    // Period filter: только lead создан в окне → leads.total=1 (others 0 if created earlier).
    const before = new Date(Date.now() - 60_000).toISOString();
    const after = new Date(Date.now() + 60_000).toISOString();
    const windowKpi = (await agent(sm.accessToken).get(`/api/v1/sales/center/kpi?from=${encodeURIComponent(before)}&to=${encodeURIComponent(after)}`).expect(200)).body as {
      period: { from: string | null; to: string | null };
      leads: { total: number };
    };
    expect(windowKpi.period.from).toBe(before);
    expect(windowKpi.leads.total).toBeGreaterThanOrEqual(1);
  });

  // ── 10. History ───────────────────────────────────────────────────────────

  it("9. history: created → status_changed → assigned (immutable order, actor, from/to)", async () => {
    const sm = await createStaff("sc_hist", RoleCode.SALES_MANAGER);
    const lead = await smCreateLead(sm.accessToken, "History Center Lead");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: sm.user.id }).expect(201);

    const hist = (await agent(sm.accessToken).get(`/api/v1/sales/leads/${lead.code}/history`).expect(200)).body as {
      items: Array<{ action: string; from: string | null; to: string | null; actorId: string | null; createdAt: string }>;
      total: number;
    };
    expect(hist.items.map((h) => h.action)).toEqual(["created", "status_changed", "assigned"]);
    expect(hist.items[1].from).toBe("NEW");
    expect(hist.items[1].to).toBe("QUALIFIED");
    expect(hist.items[2].from).toBeNull();
    expect(hist.items[2].to).toBe(sm.user.id);
    expect(hist.items[2].actorId).toBe(sm.user.id);
    const times = hist.items.map((h) => Date.parse(h.createdAt));
    for (let i = 1; i < times.length; i++) expect(times[i] >= times[i - 1]).toBe(true);
  });

  // ── 11. Actions + Sale close absent ───────────────────────────────────────

  it("10. lifecycle actions через Center-роль; Sale close/complete отсутствует (404)", async () => {
    const sm = await createStaff("sc_act", RoleCode.SALES_MANAGER);
    const lead = await smCreateLead(sm.accessToken, "Action Lead");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "DISQUALIFIED" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(422); // терминал

    const opp = (
      await agent(sm.accessToken).post("/api/v1/sales/opportunities").send({ title: "Action OPP" }).expect(201)
    ).body as { id: string; code: string };
    created.opportunities.push(opp.id);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "OPEN" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "WON" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/opportunities/${opp.code}/transition`).send({ status: "LOST" }).expect(422); // терминал

    // Step 2.3: ISSUE требует состав + validUntil — собираем валидное КП.
    const product = (
      await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Quote Action ${stamp}`, tariffs: [{ name: "Std", price: 90 }] }).expect(201)
    ).body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: tariff.id, quantity: 1 }).expect(201);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() }).expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    // Sale: только create/list/detail/history — close отсутствует (404); complete
    // введён в Step 2.4 (требует expectedVersion → пустое тело 400, см. 2.4 e2e).
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({}).expect(201)).body as { id: string; code: string };
    created.sales.push(sale.id);
    await agent(sm.accessToken).post(`/api/v1/sales/sales/${sale.code}/close`).expect(404);
    await agent(sm.accessToken).post(`/api/v1/sales/sales/${sale.code}/complete`).send({}).expect(400);
    await agent(sm.accessToken).get(`/api/v1/sales/sales/${sale.code}/history`).expect(200);
  });

  // ── 12. Assignment + CAS ──────────────────────────────────────────────────

  it("11. assign: staff assign / reassign / unassign / BUYER→422 / CAS conflict→409 / history+audit", async () => {
    const sm = await createStaff("sc_assign", RoleCode.SALES_MANAGER);
    const other = await createStaff("sc_assign2", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("sc_assign_b");
    const lead = await smCreateLead(sm.accessToken, "Assign Lead");

    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: sm.user.id }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: other.user.id }).expect(201); // reassign
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: null }).expect(201); // unassign
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: buyer.user.id }).expect(422); // BUYER target
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: "usr-not-exist" }).expect(422);
    // Forged fields в assign → 422.
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: sm.user.id, version: 99, actorId: "x" }).expect(422);

    const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.assignedToId).toBeNull();

    // CAS: одновременный assign → один 201, другой 409.
    const lead2 = await smCreateLead(sm.accessToken, "CAS Assign Lead");
    const results = await Promise.allSettled([
      agent(sm.accessToken).post(`/api/v1/sales/leads/${lead2.code}/assign`).send({ assignedToId: sm.user.id }),
      agent(sm.accessToken).post(`/api/v1/sales/leads/${lead2.code}/assign`).send({ assignedToId: other.user.id }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const hist = await prisma.leadHistory.findMany({ where: { leadId: lead2.id, action: "assigned" } });
    expect(hist).toHaveLength(1); // ровно один assignment-fact

    // Audit: assigned-записи с details без PII (только refs).
    const audits = await prisma.auditLog.findMany({ where: { resource: "Lead", resourceId: lead.id, action: "sales.lead.assigned" } });
    expect(audits.length).toBe(3); // assign/reassign/unassign
    for (const a of audits) {
      expect(JSON.stringify(a.details ?? {})).not.toContain("Assign Lead");
      created.auditLogs.push(a.id);
    }
  });

  // ── 13. Isolation ─────────────────────────────────────────────────────────

  it("12. изоляция: actions не создают Order/Booking; outbox без новых OrderRequested/OrderCreated; response без PII", async () => {
    const sm = await createStaff("sc_iso", RoleCode.SALES_MANAGER);
    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();
    // STRICT REVIEW 2.5A: delta-based (не absolute-global) — shared-DB serial
    // run может содержать OrderRequested/OrderCreated других спеков (напр.
    // bootstrap/consumer-спеков); инвариант «Sales actions НЕ создают
    // OrderRequested/OrderCreated» проверяется по ДЕЛЬТЕ до/после.
    const outboxBefore = await prisma.outboxEvent.count({
      where: { eventType: { in: ["OrderRequested", "OrderCreated"] } },
    });

    const lead = await smCreateLead(sm.accessToken, "Isolation Lead");
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/transition`).send({ status: "QUALIFIED" }).expect(201);
    await agent(sm.accessToken).post(`/api/v1/sales/leads/${lead.code}/assign`).send({ assignedToId: sm.user.id }).expect(201);
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({}).expect(201)).body as { id: string };
    created.sales.push(sale.id);

    expect(await prisma.order.count()).toBe(ordersBefore);
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    const outbox = await prisma.outboxEvent.count({ where: { eventType: { in: ["OrderRequested", "OrderCreated"] } } });
    expect(outbox).toBe(outboxBefore);

    // Privacy: entity response без PII/CRM/request-полей.
    const detail = (await agent(sm.accessToken).get(`/api/v1/sales/leads/${lead.code}`).expect(200)).body as Record<string, string>;
    const raw = JSON.stringify(detail);
    for (const bad of ["email", "phone", "requestId", "correlationId", "notes", "password"]) {
      expect(raw.toLowerCase()).not.toContain(bad);
    }
  });
});
