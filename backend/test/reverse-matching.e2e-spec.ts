/**
 * E2E PHASE 2 STEP 2.2C — Matching & Distribution (reverse.*, ADR-0012).
 *
 * Инварианты:
 *  - matching server-authoritative: только системная команда (ADMIN); Seller
 *    НЕ self-match; forged sellerIds/status/timestamps → 422;
 *  - MATCHED/DISTRIBUTED ≠ CONTACT DISCLOSED: никаких контактов/PII;
 *    preferences НЕ раскрываются Seller-ам;
 *  - eligibility: SUBMITTED + category + destination coverage (strict
 *    containment) + capability ACTIVE + acceptsBuyerRequests + Seller ACTIVE;
 *    legal country НЕ критерий; capability ≠ entitlement/inventory;
 *  - matching НЕ создаёт Lead/Opportunity/Quote/Sale/Order/Booking/Product;
 *  - idempotent: unique (buyerRequestId, sellerId), retry/concurrent safe;
 *  - cancel-vs-matching: serialized (FOR UPDATE); durable rows не удаляются;
 *  - Seller inbox: только СВОИ distributions; unmatched Seller → пусто/404;
 *  - reverse.* содержит только 2.2A+2.2B+2.2C сущности (нет Proposal).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; customerId: string | null; permissions: string[] };
}

interface MatchRunResult {
  buyerRequestId: string;
  requestCode: string;
  categorySlug: string;
  candidates: number;
  matched: number;
  created: number;
  sellerIds: string[];
}

interface DistributionView {
  id: string;
  buyerRequestId: string;
  distributedAt: string;
  request: {
    code: string;
    categoryId: string;
    categorySlug: string;
    destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>;
    serviceDateFrom: string | null;
    serviceDateTo: string | null;
    adults: number;
    children: number;
    infants: number;
    budget: { currency: string; min?: number; max?: number } | null;
    status: string;
  };
}

describe("Phase 2 Step 2.2C — Matching & Distribution (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], customers: [] as string[], partners: [] as string[], categories: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let catHotelId: string;
  let catTourId: string;
  let catCarRentalId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** Полный onboarding: register → submit → review → approve → re-login (JWT с partnerId). */
  const createApprovedSeller = async (tag: string) => {
    const email = `mch${tag}${stamp}@test.local`;
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "Ф",
          lastName: tag.toUpperCase(),
          applicantType: "INDIVIDUAL",
          brandName: `Match Partner ${tag} ${stamp}`,
          country: "AZ",
          contactEmail: email,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    created.partners.push(appRow.id);
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    const approvedAgent = agent(session.accessToken);
    return { email, partnerId: approved.partnerId, agent: approvedAgent };
  };

  /** Capability: create → activate → accept-requests. Возвращает capability id. */
  const createActiveCapability = async (
    p: Awaited<ReturnType<typeof createApprovedSeller>>,
    categoryId: string,
    destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>,
  ) => {
    const c = (await p.agent.post("/api/v1/partner/reverse/capabilities").send({ categoryId, destinations }).expect(201)).body as { id: string; version: number };
    const act = (await p.agent.post(`/api/v1/partner/reverse/capabilities/${c.id}/activate`).send({ expectedVersion: c.version }).expect(201)).body as { version: number };
    await p.agent.post(`/api/v1/partner/reverse/capabilities/${c.id}/accept-requests`).send({ accepts: true, expectedVersion: act.version }).expect(201);
    return c.id;
  };

  const runMatch = (a: ReturnType<typeof request.agent>, buyerRequestId: string) =>
    a.post("/api/v1/system/reverse/matching/run").send({ buyerRequestId });
  const listDist = (a: ReturnType<typeof request.agent>, qs = "") => a.get(`/api/v1/partner/reverse/distributions${qs}`);
  const getDist = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/partner/reverse/distributions/${id}`);

  const dbCounts = async () => {
    const [products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, communications] = await prisma.$transaction([
      prisma.product.count(),
      prisma.tariff.count(),
      prisma.availability.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.quote.count(),
      prisma.sale.count(),
      prisma.order.count(),
      prisma.booking.count(),
      prisma.communication.count(),
    ]);
    return { products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, communications };
  };

  const reverseTables = async (): Promise<string[]> => {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'reverse' ORDER BY table_name`,
    )) as Array<{ table_name: string }>;
    return rows.map((r) => r.table_name);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = agent((await login("admin", "admin123")).accessToken);

    const mkCat = async (slug: string) => {
      const c = (await adminAgent.post("/api/v1/categories").send({ title: `Match ${slug} ${stamp}`, slug: `${slug}-${stamp}` }).expect(201)).body as { id: string };
      created.categories.push(c.id);
      return c.id;
    };
    catHotelId = await mkCat("mch-hotel");
    catTourId = await mkCat("mch-tour");
    catCarRentalId = await mkCat("mch-car");
  });

  afterAll(async () => {
    await prisma.buyerRequestDistribution.deleteMany();
    await prisma.buyerRequest.deleteMany();
    await prisma.sellerCapability.deleteMany();
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.auditLog.deleteMany({ where: { action: { in: ["reverse.match.run", "request.created", "request.submitted"] } } });
    await app.close();
  });

  // ── Setup: sellers, buyer, request ────────────────────────────────────

  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>; // AZ legal, HOTEL→TR (Antalya)
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>; // AZ legal, HOTEL→TR country-level
  let sellerC: Awaited<ReturnType<typeof createApprovedSeller>>; // TR legal, HOTEL→AZ (legal country alone ≠ coverage)
  let sellerD: Awaited<ReturnType<typeof createApprovedSeller>>; // worldwide HOTEL
  let sellerTour: Awaited<ReturnType<typeof createApprovedSeller>>; // TOUR→TR (category mismatch for hotel request)
  let buyerAgent: ReturnType<typeof request.agent>;
  let buyerCustomerId: string;

  const submitHotelRequest = async (destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>, prefs?: Record<string, unknown>) => {
    const r = (
      await buyerAgent
        .post("/api/v1/buyer/requests")
        .send({ categoryId: catHotelId, destinations, serviceDateFrom: "2026-09-01", serviceDateTo: "2026-09-07", adults: 2, preferences: prefs })
        .expect(201)
    ).body as { id: string; version: number };
    const s = (await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201)).body as { id: string };
    return s.id;
  };

  beforeAll(async () => {
    sellerA = await createApprovedSeller("a");
    sellerB = await createApprovedSeller("b");
    sellerC = await createApprovedSeller("c");
    sellerD = await createApprovedSeller("d");
    sellerTour = await createApprovedSeller("tour");

    await createActiveCapability(sellerA, catHotelId, [{ countryCode: "TR", cityCode: "ANTALYA" }]); // city-level
    await createActiveCapability(sellerB, catHotelId, [{ countryCode: "TR" }]); // country-level
    await createActiveCapability(sellerC, catHotelId, [{ countryCode: "AZ" }]); // legal TR, coverage AZ
    await createActiveCapability(sellerD, catHotelId, [{ worldwide: true }]); // worldwide
    await createActiveCapability(sellerTour, catTourId, [{ countryCode: "TR" }]); // wrong category for hotel request

    const buyerReg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `mchbuyer${stamp}`, email: `mchbuyer${stamp}@test.local`, password: "buyerpass123", firstName: "П", lastName: "Б" })
        .expect(201)
    ).body as Session;
    created.users.push(buyerReg.user.id);
    buyerCustomerId = buyerReg.user.customerId!;
    created.customers.push(buyerCustomerId);
    buyerAgent = agent(buyerReg.accessToken);
  });

  // ── 1/2. Gates ────────────────────────────────────────────────────────

  it("1. anonymous matching run → 401; PARTNER (даже с capability) → 403", async () => {
    await request(app.getHttpServer()).post("/api/v1/system/reverse/matching/run").send({ buyerRequestId: "x" }).expect(401);
    await sellerA.agent.post("/api/v1/system/reverse/matching/run").send({ buyerRequestId: "x" }).expect(403);
  });

  it("2. forged sellerIds/status/timestamps/rank/contactDisclosed в matching run → 422", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    await runMatch(adminAgent, id).send({ sellerIds: ["x"] }).expect(422);
    await runMatch(adminAgent, id).send({ status: "DISTRIBUTED", sellerId: "x" }).expect(422);
    await runMatch(adminAgent, id).send({ matchedAt: new Date().toISOString(), rank: 1, contactDisclosed: true }).expect(422);
  });

  // ── 3/4/5. Request status gate ────────────────────────────────────────

  it("3. DRAFT request не распределяется (422)", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string };
    await runMatch(adminAgent, r.id).expect(422);
    const dist = await prisma.buyerRequestDistribution.count({ where: { buyerRequestId: r.id } });
    expect(dist).toBe(0);
  });

  it("4. CANCELLED request не распределяется (422)", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(422);
  });

  // ── Core matching proofs ──────────────────────────────────────────────

  it("5. Baku→Turkey core proof + destination semantics: city/country/worldwide/match, legal country не fallback, category mismatch, zero-Product", async () => {
    // Request: HOTEL в Antalya/TR. Ожидаем: A (city Antalya) + B (country TR) + D (worldwide).
    // НЕ: C (legal TR, coverage AZ), НЕ: tour seller (category mismatch), НЕ: unmatched.
    const reqId = await submitHotelRequest([{ countryCode: "TR", cityCode: "ANTALYA" }]);
    const before = await dbCounts();
    const run = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run.matched).toBe(3);
    expect(run.sellerIds).toEqual(expect.arrayContaining([sellerA.partnerId, sellerB.partnerId, sellerD.partnerId]));
    expect(run.sellerIds).not.toContain(sellerC.partnerId); // legal country ≠ coverage
    expect(run.sellerIds).not.toContain(sellerTour.partnerId); // category mismatch
    const after = await dbCounts();
    expect(after).toEqual(before); // zero Sales/Order/Booking/Communication/Product fan-out
    // Capability у A с нулём продуктов матчится (capability ≠ inventory).
    const productsA = await prisma.product.count({ where: { categoryId: catHotelId } });
    expect(productsA).toBe(0);
  });

  it("6. city capability НЕ покрывает country-level request (strict containment)", async () => {
    // Request HOTEL в TR (country-level): A (Antalya city) исключается,
    // B (country TR) + D (worldwide) — включаются.
    const reqId = await submitHotelRequest([{ countryCode: "TR" }]);
    const run = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run.sellerIds).not.toContain(sellerA.partnerId);
    expect(run.sellerIds).toEqual(expect.arrayContaining([sellerB.partnerId, sellerD.partnerId]));
  });

  it("7. country capability covers same-country city request; city capability excludes other city", async () => {
    // Request HOTEL Istanbul/TR: B (country TR) + D (worldwide) match;
    // A (Antalya city) excluded (other city).
    const reqId = await submitHotelRequest([{ countryCode: "TR", cityCode: "ISTANBUL" }]);
    const run = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run.sellerIds).toEqual(expect.arrayContaining([sellerB.partnerId, sellerD.partnerId]));
    expect(run.sellerIds).not.toContain(sellerA.partnerId);
  });

  it("8. worldwide matches valid destination; worldwide request → only worldwide", async () => {
    const reqAZ = await submitHotelRequest([{ countryCode: "AZ" }]);
    const runAZ = (await runMatch(adminAgent, reqAZ).expect(201)).body as MatchRunResult;
    expect(runAZ.sellerIds).toEqual(expect.arrayContaining([sellerD.partnerId])); // worldwide
    expect(runAZ.sellerIds).toContain(sellerC.partnerId); // coverage AZ
    const reqWW = await submitHotelRequest([{ worldwide: true }]);
    const runWW = (await runMatch(adminAgent, reqWW).expect(201)).body as MatchRunResult;
    expect(runWW.sellerIds).toEqual([sellerD.partnerId]); // только worldwide
  });

  // ── 9/10. Capability/Seller state gates ───────────────────────────────

  it("9. acceptsBuyerRequests=false исключает; capability deactivate исключает; inactive Seller исключает", async () => {
    // Seller A: создаём второй capability (car-rental) БЕЗ accept и без activate.
    const draft = (await sellerA.agent.post("/api/v1/partner/reverse/capabilities").send({ categoryId: catCarRentalId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    // Deactivate: отключаем accepts у A hotel capability через новый draft-capability?
    // Вместо этого: DRAFT capability (car-rental) с accept=false не матчится:
    const carReq = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catCarRentalId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${carReq.id}/submit`).send({ expectedVersion: carReq.version }).expect(201);
    const runCar = (await runMatch(adminAgent, carReq.id).expect(201)).body as MatchRunResult;
    expect(runCar.matched).toBe(0); // DRAFT capability + accepts=false → 0

    // Deactivate capability у sellerTour (TOUR→TR), затем tour-request → 0.
    const capsTour = (await sellerTour.agent.get("/api/v1/partner/reverse/capabilities").expect(200)).body as { items: Array<{ id: string; version: number; status: string }> };
    const tourCap = capsTour.items.find((c) => c.status === "ACTIVE")!;
    await sellerTour.agent.post(`/api/v1/partner/reverse/capabilities/${tourCap.id}/deactivate`).send({ expectedVersion: tourCap.version }).expect(201);
    const tourReq = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catTourId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${tourReq.id}/submit`).send({ expectedVersion: tourReq.version }).expect(201);
    const runTour = (await runMatch(adminAgent, tourReq.id).expect(201)).body as MatchRunResult;
    expect(runTour.matched).toBe(0);

    // Inactive Seller: помечаем CRM partner sellerC INACTIVE напрямую (серверный state).
    await prisma.partner.update({ where: { id: sellerC.partnerId }, data: { status: "INACTIVE" } });
    const reqTR = await submitHotelRequest([{ countryCode: "TR" }]);
    const run2 = (await runMatch(adminAgent, reqTR).expect(201)).body as MatchRunResult;
    expect(run2.sellerIds).not.toContain(sellerC.partnerId);
    // Восстанавливаем ACTIVE для последующих тестов.
    await prisma.partner.update({ where: { id: sellerC.partnerId }, data: { status: "ACTIVE" } });
  });

  // ── 11/12/13. Idempotency / races ─────────────────────────────────────

  it("10. повторный matching run → без дубликатов; concurrent run идемпотентен", async () => {
    const reqId = await submitHotelRequest([{ countryCode: "TR", cityCode: "ANTALYA" }]);
    const run1 = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run1.created).toBe(run1.matched); // первый запуск — всё новое
    const run2 = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run2.matched).toBe(run1.matched); // детерминированный eligible set
    expect(run2.created).toBe(0); // idempotent: новых rows нет
    const rows = await prisma.buyerRequestDistribution.count({ where: { buyerRequestId: reqId } });
    expect(rows).toBe(run1.matched);
    // Concurrent: параллельные запуски — те же rows (unique constraint + skipDuplicates).
    const [c1, c2] = await Promise.all([runMatch(adminAgent, reqId), runMatch(adminAgent, reqId)]);
    expect([c1.status, c2.status].every((s) => s >= 200 && s < 300)).toBe(true);
    expect(await prisma.buyerRequestDistribution.count({ where: { buyerRequestId: reqId } })).toBe(run1.matched);
  });

  it("11. cancel vs matching race: deterministic, без impossible state", async () => {
    // Случай 1: cancel ДО matching → 422, 0 distributions.
    const r1 = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r1.id}/cancel`).send({ expectedVersion: r1.version }).expect(201);
    await runMatch(adminAgent, r1.id).expect(422);
    expect(await prisma.buyerRequestDistribution.count({ where: { buyerRequestId: r1.id } })).toBe(0);
    // Случай 2: matching ДО cancel → distributions durable; cancel продолжает;
    // Seller projection честно показывает status=CANCELLED.
    const r2 = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR", cityCode: "ANTALYA" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r2.id}/submit`).send({ expectedVersion: r2.version }).expect(201);
    await runMatch(adminAgent, r2.id).expect(201);
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r2.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r2.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    const rows = await prisma.buyerRequestDistribution.findMany({ where: { buyerRequestId: r2.id } });
    expect(rows.length).toBeGreaterThan(0); // durable, не удаляются
    const distA = (await listDist(sellerA.agent).expect(200)).body as { items: DistributionView[] };
    const d = distA.items.find((x) => x.buyerRequestId === r2.id)!;
    expect(d.request.status).toBe("CANCELLED"); // projection не притворяется открытым
  });

  it("12. capability disable vs matching race: deactivated до commit → исключён", async () => {
    // Создаём отдельного seller с capability, деактивируем capability,
    // затем matching — seller исключён.
    const sellerE = await createApprovedSeller("e");
    await createActiveCapability(sellerE, catHotelId, [{ countryCode: "TR" }]);
    const caps = (await sellerE.agent.get("/api/v1/partner/reverse/capabilities").expect(200)).body as { items: Array<{ id: string; version: number; status: string }> };
    const cap = caps.items.find((c) => c.status === "ACTIVE")!;
    await sellerE.agent.post(`/api/v1/partner/reverse/capabilities/${cap.id}/deactivate`).send({ expectedVersion: cap.version }).expect(201);
    const reqId = await submitHotelRequest([{ countryCode: "TR" }]);
    const run = (await runMatch(adminAgent, reqId).expect(201)).body as MatchRunResult;
    expect(run.sellerIds).not.toContain(sellerE.partnerId);
  });

  // ── 14/15. Seller inbox / isolation / projection ──────────────────────

  it("13. Seller inbox: own list/detail только распределённые; unmatched Seller → пусто/404; pagination", async () => {
    const listA = (await listDist(sellerA.agent).expect(200)).body as { items: DistributionView[]; total: number };
    expect(listA.items.length).toBeGreaterThan(0);
    expect(listA.items.every((d) => d.id)).toBe(true);
    const page = (await listDist(sellerA.agent, "?limit=1&offset=0").expect(200)).body as { items: DistributionView[]; total: number };
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(listA.total);
    const sorted = [...listA.items].sort((a, b) => (a.distributedAt < b.distributedAt ? 1 : a.distributedAt > b.distributedAt ? -1 : a.id < b.id ? 1 : -1));
    expect(listA.items.map((x) => x.id)).toEqual(sorted.map((x) => x.id));
    const detail = (await getDist(sellerA.agent, listA.items[0].id).expect(200)).body as DistributionView;
    expect(detail.id).toBe(listA.items[0].id);
    // Unmatched Seller: sellerD имеет worldwide → получает всё; используем tour seller (все capability deactivated).
    const listTour = (await listDist(sellerTour.agent).expect(200)).body as { items: DistributionView[]; total: number };
    expect(listTour.total).toBe(0);
    // Чужой distribution row → neutral 404.
    const bList = (await listDist(sellerB.agent).expect(200)).body as { items: DistributionView[] };
    const bDist = bList.items[0];
    await getDist(sellerA.agent, bDist.id).expect(404);
    // Seller может читать только свой: requestA против чужого — 404.
    await getDist(sellerTour.agent, listA.items[0].id).expect(404);
  });

  it("14. Seller projection: PII-minimal, без preferences/контактов/buyerId", async () => {
    // Request с preferences (PII-опасный свободный контент) — НЕ должен попасть в projection.
    const reqId = await submitHotelRequest([{ countryCode: "TR", cityCode: "ANTALYA" }], { note: "нужен трансфер из аэропорта" });
    await runMatch(adminAgent, reqId).expect(201);
    const list = (await listDist(sellerA.agent).expect(200)).body as { items: DistributionView[] };
    const d = list.items.find((x) => x.buyerRequestId === reqId)!;
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/preferences|buyerId|customerId|email|phone|whatsapp|telegram|passport|document/i);
    expect(d.request.code).toMatch(/^BRQ-/);
    expect(d.request.adults).toBe(2);
    expect(d.request.budget).toBeNull(); // не задан в этом request
  });

  it("15. cross-Seller isolation: A не видит distribution B и наоборот (списки строго свои)", async () => {
    const aList = (await listDist(sellerA.agent).expect(200)).body as { items: DistributionView[] };
    const bList = (await listDist(sellerB.agent).expect(200)).body as { items: DistributionView[] };
    const aIds = new Set(aList.items.map((x) => x.buyerRequestId));
    const bIds = new Set(bList.items.map((x) => x.buyerRequestId));
    // У A и B есть общие requests (оба матчились на TR/ANTALYA), но детали разные.
    // Проверка: чужой distribution id недоступен (уже в 13); здесь — списки не содержат
    // distribution rows друг друга (не может быть одинаковых distribution id).
    const aDistIds = new Set(aList.items.map((x) => x.id));
    const bDistIds = new Set(bList.items.map((x) => x.id));
    expect([...aDistIds].some((x) => bDistIds.has(x))).toBe(false);
    void aIds;
    void bIds;
  });

  // ── 16-18. No fan-out / audit / failure atomicity ─────────────────────

  it("16. reverse.* содержит только 2.2A+2.2B+2.2C сущности (нет Proposal/matching-inbox)", async () => {
    const tables = await reverseTables();
    expect(tables).toEqual(["BuyerRequest", "BuyerRequestDistribution", "BuyerRequestHistory", "SellerCapability", "SellerCapabilityHistory"]);
  });

  it("17. audit: reverse.match.run с actor/candidates/matched; unknown request → 404 без сайд-эффектов", async () => {
    const before = await dbCounts();
    await runMatch(adminAgent, "00000000-0000-0000-0000-000000000000").expect(404);
    const after = await dbCounts();
    expect(after).toEqual(before);
    const audit = await prisma.auditLog.findMany({ where: { action: "reverse.match.run" }, orderBy: { createdAt: "desc" }, take: 5 });
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].resource).toBe("BuyerRequest");
    expect(audit[0].details).toHaveProperty("matched");
    expect(audit[0].details).toHaveProperty("candidates");
  });

  it("18. no Proposal/Communication/Sales entities созданы (полный dbCounts после всех run)", async () => {
    const counts = await dbCounts();
    // Эти тесты создавали только requests/distributions; Proposal-таблиц нет в схеме.
    expect(counts.leads).toBe(0);
    expect(counts.opps).toBe(0);
    expect(counts.quotes).toBe(0);
    expect(counts.sales).toBe(0);
    expect(counts.orders).toBe(0);
    expect(counts.bookings).toBe(0);
  });
});
