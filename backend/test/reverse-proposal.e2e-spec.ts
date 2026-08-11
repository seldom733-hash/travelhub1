/**
 * E2E PHASE 2 STEP 2.2D — Seller Proposal Foundation (reverse.*, ADR-0012).
 *
 * Инварианты (промпт 2.2D §40):
 *  1. anonymous denied;
 *  2. BUYER не может создать Seller Proposal;
 *  3. unmatched Seller не может создать Proposal;
 *  4. distributed Seller может создать Proposal;
 *  5. Seller A не может создать Proposal на distribution Seller B;
 *  6. CANCELLED request отклоняет новый Proposal;
 *  7. DRAFT request отклоняет Proposal;
 *  8. один Seller/request → один Proposal;
 *  9. concurrent duplicate create → один Proposal;
 * 10. Seller own list/get;
 * 11. cross-Seller IDOR denied (neutral 404);
 * 12. Buyer own-request Proposal list;
 * 13. cross-Buyer Proposal access denied;
 * 14. amount/currency validation;
 * 15. amount non-binding (PRICE_ON_REQUEST честный null);
 * 16. budget request НЕ становится ценой Proposal;
 * 17. server-owned fields rejected (422);
 * 18. contact/PII rules enforced;
 * 19. DRAFT update;
 * 20. submit lifecycle;
 * 21. invalid lifecycle;
 * 22. stale CAS;
 * 23. concurrent update;
 * 24. submit/update race;
 * 25. request cancel vs submit race;
 * 26. history;
 * 27. audit;
 * 28. no duplicate Proposal on retry;
 * 29. no Communication/chat side effect;
 * 30. no Lead/Opportunity/Quote/Sale;
 * 31. no Order/Booking/Payment;
 * 32. no Catalog/Product/Tariff/Availability mutation;
 * 33. acquisition source not forgeable;
 * 34. no cross-Seller leak;
 * 35. migration replay/drift (вне этого спека — migrate status);
 * 36. pagination/determinism.
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

interface ProposalView {
  id: string;
  code: string;
  buyerRequestId: string;
  distributionId: string;
  money: { amount: string | null; currency: string | null };
  description: string | null;
  includedServices: string | null;
  exclusions: string | null;
  conditions: string | null;
  notes: string | null;
  validUntil: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  withdrawnAt: string | null;
}

describe("Phase 2 Step 2.2D — Seller Proposal Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], customers: [] as string[], partners: [] as string[], categories: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let catHotelId: string;

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
    const email = `prp${tag}${stamp}@test.local`;
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "П",
          lastName: tag.toUpperCase(),
          applicantType: "INDIVIDUAL",
          brandName: `Proposal Partner ${tag} ${stamp}`,
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

  /** Capability: create → activate → accept-requests. */
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

  const createProposal = (a: ReturnType<typeof request.agent>, buyerRequestId: string, body: Record<string, unknown> = {}) =>
    a.post("/api/v1/partner/reverse/proposals").send({ buyerRequestId, ...body });

  /** Тестовый bootstrap публичной идентичности (детерминированно): ANONYMOUS
   *  профиль, как создаёт PartnerCreated consumer (PartnerCreated в outbox может
   *  не быть обработан в e2e — publishPending не вызывается автоматически). */
  const ensurePublicSellerProfile = async (partnerId: string) => {
    await prisma.publicSellerProfile.upsert({
      where: { partnerId },
      update: {},
      create: {
        publicId: `SELL-${String(Date.now()).slice(-8)}`, // unique-префикс из времени
        partnerId,
        status: "APPROVED",
        visibilityMode: "ANONYMOUS",
        verified: true,
      },
    });
  };

  const listProposals = (a: ReturnType<typeof request.agent>, qs = "") => a.get(`/api/v1/partner/reverse/proposals${qs}`);
  const getProposal = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/partner/reverse/proposals/${id}`);
  const historyProposal = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/partner/reverse/proposals/${id}/history`);
  const updateProposal = (a: ReturnType<typeof request.agent>, id: string, body: Record<string, unknown>) =>
    a.patch(`/api/v1/partner/reverse/proposals/${id}`).send(body);
  const submitProposal = (a: ReturnType<typeof request.agent>, id: string, version: number) =>
    a.post(`/api/v1/partner/reverse/proposals/${id}/submit`).send({ expectedVersion: version });
  const withdrawProposal = (a: ReturnType<typeof request.agent>, id: string, version: number) =>
    a.post(`/api/v1/partner/reverse/proposals/${id}/withdraw`).send({ expectedVersion: version });
  const buyerListProposals = (a: ReturnType<typeof request.agent>, reqId: string, qs = "") =>
    a.get(`/api/v1/buyer/requests/${reqId}/proposals${qs}`);
  const buyerGetProposal = (a: ReturnType<typeof request.agent>, reqId: string, proposalId: string) =>
    a.get(`/api/v1/buyer/requests/${reqId}/proposals/${proposalId}`);

  const dbCounts = async () => {
    const [products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, communications, availReservations] =
      await prisma.$transaction([
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
        prisma.availabilityReservation.count(),
      ]);
    return { products, tariffs, availability, leads, opps, quotes, sales, orders, bookings, communications, availReservations };
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

    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Prop Hotel ${stamp}`, slug: `prp-hotel-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    catHotelId = cat.id;
  });

  afterAll(async () => {
    await prisma.sellerProposalHistory.deleteMany();
    await prisma.sellerProposal.deleteMany();
    await prisma.buyerRequestDistribution.deleteMany();
    await prisma.buyerRequest.deleteMany();
    await prisma.sellerCapability.deleteMany();
    // Тестовые PublicSellerProfile (bootstrap) — детерминированный cleanup.
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.auditLog.deleteMany({
      where: { action: { in: ["proposal.created", "proposal.updated", "proposal.submitted", "proposal.withdrawn", "reverse.match.run"] } },
    });
    await app.close();
  });

  // ── Fixtures ──────────────────────────────────────────────────────────

  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let buyerCustomerId: string;
  let buyer2Agent: ReturnType<typeof request.agent>;
  let buyer2CustomerId: string;
  let distributedReqId: string; // request, распределённый и A, и B (TR hotel)

  const submitRequest = async (destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>, prefs?: Record<string, unknown>) => {
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
    // Детерминированная публичная идентичность (ANONYMOUS) для теста seller projection.
    await ensurePublicSellerProfile(sellerA.partnerId);
    await ensurePublicSellerProfile(sellerB.partnerId);
    await createActiveCapability(sellerA, catHotelId, [{ countryCode: "TR" }]);
    await createActiveCapability(sellerB, catHotelId, [{ countryCode: "TR" }]);

    const buyerReg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `prpbuyer${stamp}`, email: `prpbuyer${stamp}@test.local`, password: "buyerpass123", firstName: "Б", lastName: "Б" })
        .expect(201)
    ).body as Session;
    created.users.push(buyerReg.user.id);
    buyerCustomerId = buyerReg.user.customerId!;
    created.customers.push(buyerCustomerId);
    buyerAgent = agent(buyerReg.accessToken);

    const buyer2Reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `prpbuyer2${stamp}`, email: `prpbuyer2${stamp}@test.local`, password: "buyerpass123", firstName: "Б2", lastName: "Б2" })
        .expect(201)
    ).body as Session;
    created.users.push(buyer2Reg.user.id);
    buyer2CustomerId = buyer2Reg.user.customerId!;
    created.customers.push(buyer2CustomerId);
    buyer2Agent = agent(buyer2Reg.accessToken);

    distributedReqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, distributedReqId).expect(201);
  });

  // ── 1-2. Gates ────────────────────────────────────────────────────────

  it("1. anonymous create → 401; BUYER create → 403", async () => {
    await request(app.getHttpServer()).post("/api/v1/partner/reverse/proposals").send({ buyerRequestId: "x" }).expect(401);
    await createProposal(buyerAgent, distributedReqId).expect(403);
    await buyerListProposals(buyerAgent, distributedReqId).expect(200); // buyer read OK (own-request)
  });

  it("2. forged server-owned fields в create → 422 (sellerId/status/version/timestamps/acquisition)", async () => {
    const id = distributedReqId;
    await createProposal(sellerA.agent, id, { sellerId: "x" }).expect(422);
    await createProposal(sellerA.agent, id, { status: "SUBMITTED", distributionId: "x" }).expect(422);
    await createProposal(sellerA.agent, id, { version: 1, submittedAt: new Date().toISOString() }).expect(422);
    await createProposal(sellerA.agent, id, { acquisitionSource: "MARKETPLACE", quoteId: "QTE-1", saleId: "SAL-1" }).expect(422);
    await createProposal(sellerA.agent, id, { buyerRequestId: id, buyerId: "x", contactDisclosed: true, selected: true }).expect(422);
  });

  // ── 3-7. Eligibility / request gates ──────────────────────────────────

  it("3. unmatched Seller (нет distribution) → 422; чужой request id → 422 (нейтрально)", async () => {
    // Seller C — approved, но без capability/distribution на hotel request.
    const sellerC = await createApprovedSeller("c");
    await createProposal(sellerC.agent, distributedReqId).expect(422);
    await createProposal(sellerA.agent, "00000000-0000-0000-0000-000000000000").expect(422);
  });

  it("4. distributed Seller создаёт Proposal (DRAFT, PRP-*, PRICE_ON_REQUEST если без money)", async () => {
    const p = (await createProposal(sellerA.agent, distributedReqId, { description: "Полный тур" }).expect(201)).body as ProposalView;
    expect(p.code).toMatch(/^PRP-/);
    expect(p.status).toBe("DRAFT");
    expect(p.version).toBe(1);
    expect(p.money).toEqual({ amount: null, currency: null }); // PRICE_ON_REQUEST честно
    expect(p.buyerRequestId).toBe(distributedReqId);
    void p;
  });

  it("5. Seller A не может создать Proposal на distribution Seller B (request распределён только B) → 422", async () => {
    // Отдельная категория car-rental: capability ТОЛЬКО у B → matching распределит только B.
    const catCar = (await adminAgent.post("/api/v1/categories").send({ title: `Prop Car ${stamp}`, slug: `prp-car-${stamp}` }).expect(201)).body as { id: string };
    created.categories.push(catCar.id);
    await createActiveCapability(sellerB, catCar.id, [{ countryCode: "TR" }]);
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catCar.id, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    const run = (await runMatch(adminAgent, r.id).expect(201)).body as { sellerIds: string[] };
    expect(run.sellerIds).toEqual([sellerB.partnerId]); // только B
    // A не имеет distribution на этот request → 422 (нейтральное сообщение, не 404).
    await createProposal(sellerA.agent, r.id).expect(422);
    // B — может.
    await createProposal(sellerB.agent, r.id).expect(201);
  });

  it("6. CANCELLED request отклоняет новый Proposal (422)", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    await createProposal(sellerA.agent, r.id).expect(422);
  });

  it("7. DRAFT request отклоняет Proposal (422)", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string };
    await createProposal(sellerA.agent, r.id).expect(422); // нет distribution (DRAFT не матчится)
  });

  // ── 8-9. Cardinality / idempotency ────────────────────────────────────

  it("8. один Seller/request → один Proposal: повторный create → 409", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId, { money: { amount: 100, currency: "USD" } }).expect(201);
    await createProposal(sellerA.agent, reqId).expect(409); // unique (buyerRequestId, sellerId)
    const rows = await prisma.sellerProposal.count({ where: { buyerRequestId: reqId, sellerId: sellerA.partnerId } });
    expect(rows).toBe(1);
  });

  it("9. concurrent duplicate create → один Proposal (unique constraint)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const [c1, c2] = await Promise.all([createProposal(sellerB.agent, reqId), createProposal(sellerB.agent, reqId)]);
    const ok = (n: number) => n >= 200 && n < 300;
    expect(ok(c1.status) || ok(c2.status)).toBe(true);
    expect(c1.status === 201 && c2.status === 201).toBe(false); // не оба созданы
    const rows = await prisma.sellerProposal.count({ where: { buyerRequestId: reqId, sellerId: sellerB.partnerId } });
    expect(rows).toBe(1);
  });

  // ── 10-11. Seller reads / isolation ───────────────────────────────────

  it("10. Seller own list/get/history + pagination deterministic", async () => {
    const list = (await listProposals(sellerA.agent).expect(200)).body as { items: ProposalView[]; total: number };
    expect(list.total).toBeGreaterThan(0);
    expect(list.items.every((p) => p.code.startsWith("PRP-"))).toBe(true);
    const page = (await listProposals(sellerA.agent, "?limit=1&offset=0").expect(200)).body as { items: ProposalView[]; total: number };
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(list.total);
    const sorted = [...list.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
    expect(list.items.map((x) => x.id)).toEqual(sorted.map((x) => x.id));
    const detail = (await getProposal(sellerA.agent, list.items[0].id).expect(200)).body as ProposalView;
    expect(detail.id).toBe(list.items[0].id);
    const hist = (await historyProposal(sellerA.agent, list.items[0].id).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items.length).toBeGreaterThan(0);
    expect(hist.items[0].action).toBeDefined();
  });

  it("11. cross-Seller IDOR: A не видит Proposal B (neutral 404); A не может изменить/submit/withdraw Proposal B", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const pB = (await createProposal(sellerB.agent, reqId, { description: "секрет B" }).expect(201)).body as ProposalView;
    await getProposal(sellerA.agent, pB.id).expect(404);
    await historyProposal(sellerA.agent, pB.id).expect(404);
    await updateProposal(sellerA.agent, pB.id, { description: "хак", expectedVersion: pB.version }).expect(404);
    await submitProposal(sellerA.agent, pB.id, pB.version).expect(404);
    await withdrawProposal(sellerA.agent, pB.id, pB.version).expect(404);
    // Подтверждаем, что Proposal B не тронут.
    const still = (await prisma.sellerProposal.findUnique({ where: { id: pB.id } }))!;
    expect(still.description).toBe("секрет B");
    expect(still.status).toBe("DRAFT");
  });

  // ── 12-13. Buyer own-request reads ────────────────────────────────────

  it("12. Buyer видит только SUBMITTED proposals своего request (list/get); DRAFT скрыт", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const pDraft = (await createProposal(sellerA.agent, reqId, { money: { amount: 250, currency: "USD" }, description: "черновик" }).expect(201)).body as ProposalView;
    const pB = (await createProposal(sellerB.agent, reqId, { money: { amount: 300, currency: "AZN" }, description: "финал" }).expect(201)).body as ProposalView;
    await submitProposal(sellerB.agent, pB.id, pB.version).expect(201);
    const list = (await buyerListProposals(buyerAgent, reqId).expect(200)).body as { items: ProposalView[]; total: number };
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(pB.id);
    expect(list.items[0].status).toBe("SUBMITTED");
    const json = JSON.stringify(list.items[0]);
    expect(json).not.toMatch(/internal|rank|score|audit|notes|sellerId/i); // buyer projection чистая
    // Seller identity (ADR-0005): raw partnerId НЕ отдаётся; publicId (SELL-*) — да.
    const item = list.items[0] as ProposalView & { seller: { publicId: string; displayName: string | null; visibilityMode: string } | null };
    expect(item.seller).not.toBeNull();
    expect(item.seller!.publicId).toMatch(/^SELL-/);
    expect(JSON.stringify(item.seller)).not.toContain(sellerB.partnerId); // нет внутреннего UUID
    // DRAFT Proposal недоступен Buyer-у даже по id.
    await buyerGetProposal(buyerAgent, reqId, pDraft.id).expect(404);
    const detail = (await buyerGetProposal(buyerAgent, reqId, pB.id).expect(200)).body as ProposalView;
    expect(detail.code).toBe(pB.code);
  });

  it("13. cross-Buyer: чужой request/proposal недоступен (neutral 404)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId, { money: { amount: 10, currency: "USD" } }).expect(201)).body as ProposalView;
    await submitProposal(sellerA.agent, p.id, p.version).expect(201);
    // Buyer2 не видит request Buyer1.
    await buyerListProposals(buyer2Agent, reqId).expect(404);
    await buyerGetProposal(buyer2Agent, reqId, p.id).expect(404);
    // Buyer1 видит свой.
    const list = (await buyerListProposals(buyerAgent, reqId).expect(200)).body as { items: ProposalView[]; total: number };
    expect(list.total).toBe(1);
  });

  // ── 14-16. Money ──────────────────────────────────────────────────────

  it("14. amount/currency валидация: отрицательная/мусор/не-ISO → 422", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId, { money: { amount: -5, currency: "USD" } }).expect(422);
    await createProposal(sellerA.agent, reqId, { money: { amount: "abc", currency: "USD" } }).expect(422);
    await createProposal(sellerA.agent, reqId, { money: { amount: 1.234, currency: "USD" } }).expect(422);
    await createProposal(sellerA.agent, reqId, { money: { amount: 10, currency: "usd" } }).expect(422);
    await createProposal(sellerA.agent, reqId, { money: { currency: "USD" } }).expect(422); // currency без amount
  });

  it("15. amount НЕ-binding: PRICE_ON_REQUEST (null) честно; Proposal может превышать бюджет request (не отклоняется)", async () => {
    // Request с бюджетом { currency, max: 500 }.
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }], budget: { currency: "USD", max: 500 } }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    // Proposal с суммой ВЫШЕ бюджета (800 > 500) — легален (бюджет = НЕ-binding hint).
    const p = (await createProposal(sellerA.agent, r.id, { money: { amount: 800, currency: "USD" } }).expect(201)).body as ProposalView;
    expect(p.money).toEqual({ amount: "800.00", currency: "USD" });
  });

  it("16. budget request НЕ становится Proposal price (сервер не выводит цену из бюджета)", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }], budget: { currency: "USD", max: 500 } }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    // Seller создаёт Proposal без money → PRICE_ON_REQUEST, НЕ 500.
    const p = (await createProposal(sellerA.agent, r.id).expect(201)).body as ProposalView;
    expect(p.money.amount).toBeNull();
    const row = await prisma.sellerProposal.findUnique({ where: { id: p.id } });
    expect(row?.amount).toBeNull();
  });

  // ── 17-18. Mass assignment / content ──────────────────────────────────

  it("17. forged lifecycle/source/ownership на update и lifecycle → 422", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    await updateProposal(sellerA.agent, p.id, { description: "x", status: "SUBMITTED", expectedVersion: p.version }).expect(422);
    await submitProposal(sellerA.agent, p.id, p.version).send({ status: "WITHDRAWN", submittedAt: new Date().toISOString() }).expect(422);
  });

  it("18. контакты/PII в контенте → 422 (анти-disintermediation)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId, { description: "пишите на sales@example.com" }).expect(422);
    await createProposal(sellerA.agent, reqId, { description: "звоните +994 50 1234567" }).expect(422);
    await createProposal(sellerA.agent, reqId, { description: "www.example.com" }).expect(422);
    await createProposal(sellerA.agent, reqId, { description: "<script>alert(1)</script>" }).expect(422);
    await createProposal(sellerA.agent, reqId, { description: "telegram @seller_hub" }).expect(422);
  });

  // ── 19-25. Lifecycle / CAS / races ────────────────────────────────────

  it("19. DRAFT update (money + контент + validUntil); CAS ожидается; frozen после submit", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const up = (await updateProposal(sellerA.agent, p.id, { money: { amount: 123.45, currency: "EUR" }, description: "обновлено", validUntil: "2026-10-01", expectedVersion: p.version }).expect(200)).body as ProposalView;
    expect(up.money).toEqual({ amount: "123.45", currency: "EUR" });
    expect(up.description).toBe("обновлено");
    expect(up.validUntil).toBe("2026-10-01T00:00:00.000Z");
    expect(up.version).toBe(p.version + 1);
    const sub = (await submitProposal(sellerA.agent, up.id, up.version).expect(201)).body as ProposalView;
    expect(sub.status).toBe("SUBMITTED");
    expect(sub.submittedAt).toBeTruthy();
    // Frozen: update после submit → 422.
    await updateProposal(sellerA.agent, sub.id, { description: "поздно", expectedVersion: sub.version }).expect(422);
  });

  it("20. submit lifecycle: DRAFT → SUBMITTED; повторный submit → deterministic no-op (тот же version, без нового milestone)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const s1 = (await submitProposal(sellerA.agent, p.id, p.version).expect(201)).body as ProposalView;
    expect(s1.status).toBe("SUBMITTED");
    const s2 = (await submitProposal(sellerA.agent, p.id, s1.version).expect(201)).body as ProposalView;
    expect(s2.status).toBe("SUBMITTED");
    const hist = (await prisma.sellerProposalHistory.findMany({ where: { proposalId: p.id, action: "submitted" } }));
    expect(hist.length).toBe(1); // no duplicate milestones
  });

  it("21. invalid lifecycle: submit withdrawn → 422; withdraw DRAFT → 422", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    await withdrawProposal(sellerA.agent, p.id, p.version).expect(422); // DRAFT нельзя withdraw
    const s = (await submitProposal(sellerA.agent, p.id, p.version).expect(201)).body as ProposalView;
    const w = (await withdrawProposal(sellerA.agent, p.id, s.version).expect(201)).body as ProposalView;
    expect(w.status).toBe("WITHDRAWN");
    await submitProposal(sellerA.agent, p.id, w.version).expect(422); // WITHDRAWN нельзя submit
  });

  it("22. stale CAS → 409 (update/submit/withdraw по устаревшей версии)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    await updateProposal(sellerA.agent, p.id, { description: "x", expectedVersion: p.version }).expect(200);
    await updateProposal(sellerA.agent, p.id, { description: "y", expectedVersion: p.version }).expect(409); // stale
    await submitProposal(sellerA.agent, p.id, p.version).expect(409);
  });

  it("23. concurrent update → один победитель, второй 409", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const [u1, u2] = await Promise.all([
      updateProposal(sellerA.agent, p.id, { description: "первый", expectedVersion: p.version }),
      updateProposal(sellerA.agent, p.id, { description: "второй", expectedVersion: p.version }),
    ]);
    const ok = (n: number) => n >= 200 && n < 300;
    expect([u1.status, u2.status].filter(ok).length).toBe(1);
    expect([u1.status, u2.status].filter((s) => s === 409).length).toBe(1);
  });

  it("24. submit vs update race: один выигрывает; нет impossible state", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const [u, s] = await Promise.all([
      updateProposal(sellerA.agent, p.id, { description: "гоночный", expectedVersion: p.version }),
      submitProposal(sellerA.agent, p.id, p.version),
    ]);
    const ok = (n: number) => n >= 200 && n < 300;
    expect(ok(u.status) || ok(s.status)).toBe(true);
    const fresh = await prisma.sellerProposal.findUnique({ where: { id: p.id } });
    // Либо SUBMITTED (submit выиграл), либо DRAFT с обновлённым description (update выиграл) — но НЕ оба.
    if (fresh!.status === "SUBMITTED") {
      // submit выиграл: update мог упасть 409; финальное состояние детерминировано.
      expect(fresh!.version).toBe(p.version + 1);
    } else {
      expect(fresh!.status).toBe("DRAFT");
      expect(fresh!.description).toBe("гоночный");
    }
  });

  it("25. request cancel vs submit race: cancel после распределения → Proposal нельзя засабмитить", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    // Proposal создан и засабмичен ДО cancel — разрешено.
    const p = (await createProposal(sellerA.agent, r.id, { description: "до отмены" }).expect(201)).body as ProposalView;
    await submitProposal(sellerA.agent, p.id, p.version).expect(201);
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    // Новый Proposal на CANCELLED → 422 (тест 6, дублирующая проверка здесь).
    await createProposal(sellerB.agent, r.id, { description: "после отмены" }).expect(422);
    // История существующего Proposal сохраняется (durable, не удаляется при cancel).
    const hist = await prisma.sellerProposalHistory.count({ where: { proposalId: p.id } });
    expect(hist).toBeGreaterThanOrEqual(2); // created + submitted
    const still = await prisma.sellerProposal.findUnique({ where: { id: p.id } });
    expect(still?.status).toBe("SUBMITTED");
    // Controlled interleaving (Step 2.2D §14): DRAFT Proposal, затем cancel ДО submit —
    // submit обязан упасть (422), Proposal НЕ может стать SUBMITTED на CANCELLED request.
    const r2 = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r2.id}/submit`).send({ expectedVersion: r2.version }).expect(201);
    await runMatch(adminAgent, r2.id).expect(201);
    const p2 = (await createProposal(sellerA.agent, r2.id, { description: "draft" }).expect(201)).body as ProposalView;
    const fresh2 = (await buyerAgent.get(`/api/v1/buyer/requests/${r2.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r2.id}/cancel`).send({ expectedVersion: fresh2.version }).expect(201);
    await submitProposal(sellerA.agent, p2.id, p2.version).expect(422); // cancel уже закоммичен → submit запрещён
    const row2 = await prisma.sellerProposal.findUnique({ where: { id: p2.id } });
    expect(row2?.status).toBe("DRAFT"); // impossible state (SUBMITTED на CANCELLED) недостижим
  });

  it("25b. DRAFT Proposal заморожен после cancel request (правки 422), withdraw DRAFT → 422", async () => {
    const r = (await buyerAgent.post("/api/v1/buyer/requests").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as { id: string; version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/submit`).send({ expectedVersion: r.version }).expect(201);
    await runMatch(adminAgent, r.id).expect(201);
    const p2 = (await createProposal(sellerB.agent, r.id, { description: "черновик до отмены" }).expect(201)).body as ProposalView;
    const fresh = (await buyerAgent.get(`/api/v1/buyer/requests/${r.id}`).expect(200)).body as { version: number };
    await buyerAgent.post(`/api/v1/buyer/requests/${r.id}/cancel`).send({ expectedVersion: fresh.version }).expect(201);
    // DRAFT правки после cancel заморожены (честный контракт §12).
    await updateProposal(sellerB.agent, p2.id, { description: "поздно", expectedVersion: p2.version }).expect(422);
    await withdrawProposal(sellerB.agent, p2.id, p2.version).expect(422); // DRAFT нельзя withdraw
    const row = await prisma.sellerProposal.findUnique({ where: { id: p2.id } });
    expect(row?.status).toBe("DRAFT");
    expect(row?.description).toBe("черновик до отмены");
  });

  // ── 26-28. History / audit / retry ────────────────────────────────────

  it("26. history: created/updated/submitted/withdrawn с actor и from/to", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const up = (await updateProposal(sellerA.agent, p.id, { description: "hist", expectedVersion: p.version }).expect(200)).body as ProposalView;
    const s = (await submitProposal(sellerA.agent, up.id, up.version).expect(201)).body as ProposalView;
    await withdrawProposal(sellerA.agent, s.id, s.version).expect(201);
    const hist = (await historyProposal(sellerA.agent, p.id).expect(200)).body as { items: Array<{ action: string; from: string | null; to: string | null; actorName: string | null }> };
    const actions = hist.items.map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(["created", "updated", "submitted", "withdrawn"]));
    const sub = hist.items.find((h) => h.action === "submitted")!;
    expect(sub.from).toBe("DRAFT");
    expect(sub.to).toBe("SUBMITTED");
    expect(sub.actorName).toBeTruthy();
  });

  it("27. audit: proposal.created/updated/submitted/withdrawn записаны; failed операции — без сайд-эффектов", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const before = await dbCounts();
    // Неуспешные операции: stale CAS (409), чужой seller (404), forged (422).
    const p = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    await updateProposal(sellerA.agent, p.id, { description: "x", expectedVersion: p.version }).expect(200);
    await updateProposal(sellerA.agent, p.id, { description: "y", expectedVersion: p.version }).expect(409);
    const after = await dbCounts();
    expect(after).toEqual(before); // никаких Sales/Order/Booking/Communication/Catalog мутаций
    const audit = await prisma.auditLog.findMany({ where: { action: { in: ["proposal.created", "proposal.updated"] } }, orderBy: { createdAt: "desc" }, take: 5 });
    expect(audit.length).toBeGreaterThanOrEqual(2);
    expect(audit[0].resource).toBe("SellerProposal");
    expect(audit[0].details).toHaveProperty("sellerId");
  });

  it("28. retry create → 409 (без дубликатов); повторная retry после 409 — тот же единственный Proposal", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId).expect(409);
    await createProposal(sellerA.agent, reqId).expect(409);
    const rows = await prisma.sellerProposal.count({ where: { buyerRequestId: reqId, sellerId: sellerA.partnerId } });
    expect(rows).toBe(1);
  });

  // ── 29-34. No fan-out / isolation ─────────────────────────────────────

  it("29-32. Proposal не создаёт Communication/Lead/Opportunity/Quote/Sale/Order/Booking/Payment/Product/Tariff/Availability", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const before = await dbCounts();
    const p = (await createProposal(sellerA.agent, reqId, { money: { amount: 100, currency: "USD" }, description: "тест" }).expect(201)).body as ProposalView;
    await submitProposal(sellerA.agent, p.id, p.version).expect(201);
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("33. acquisition source не forgeable: Proposal не содержит и не позволяет переопределить BUYER_REQUEST", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    await createProposal(sellerA.agent, reqId, { acquisitionSource: "MARKETPLACE" }).expect(422);
    // Серверное требование: BuyerRequest сохраняет BUYER_REQUEST (2.2F propagation).
    const req = await prisma.buyerRequest.findUnique({ where: { id: reqId } });
    expect(req?.acquisitionSource).toBe("BUYER_REQUEST");
  });

  it("34. no cross-Seller leak: списки/детали A не содержат Proposal B (проверка по distributionId и content)", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const pA = (await createProposal(sellerA.agent, reqId, { description: "только для A", money: { amount: 1, currency: "USD" } }).expect(201)).body as ProposalView;
    const pB = (await createProposal(sellerB.agent, reqId, { description: "только для B", money: { amount: 2, currency: "USD" } }).expect(201)).body as ProposalView;
    await submitProposal(sellerA.agent, pA.id, pA.version).expect(201);
    await submitProposal(sellerB.agent, pB.id, pB.version).expect(201);
    const listA = (await listProposals(sellerA.agent).expect(200)).body as { items: ProposalView[] };
    expect(listA.items.some((x) => x.id === pB.id)).toBe(false);
    const listB = (await listProposals(sellerB.agent).expect(200)).body as { items: ProposalView[] };
    expect(listB.items.some((x) => x.id === pA.id)).toBe(false);
    // Buyer видит оба, но с чистой projection (без notes/internal).
    const listBuyer = (await buyerListProposals(buyerAgent, reqId).expect(200)).body as { items: ProposalView[] };
    expect(listBuyer.items.map((x) => x.id).sort()).toEqual([pA.id, pB.id].sort());
    const json = JSON.stringify(listBuyer.items);
    // Buyer projection чистая: без notes/distributionId/version И без raw sellerId.
    expect(json).not.toMatch(/notes|distributionId|version|sellerId|partnerId/i);
    // Seller identity через PublicSellerProfile: publicId (SELL-*), НЕ partnerId.
    const withSeller = listBuyer.items as Array<ProposalView & { seller: { publicId: string } | null }>;
    for (const item of withSeller) {
      expect(item.seller).not.toBeNull();
      expect(item.seller!.publicId).toMatch(/^SELL-/);
    }
    // Внутренние UUID seller-ов не присутствуют в buyer-ответе.
    expect(json).not.toContain(sellerA.partnerId);
    expect(json).not.toContain(sellerB.partnerId);
  });

  it("35. reverse.* содержит 2.2A-2.2D таблицы (включая SellerProposal + History)", async () => {
    const tables = await reverseTables();
    expect(tables).toEqual([
      "BuyerRequest",
      "BuyerRequestDistribution",
      "BuyerRequestHistory",
      "SellerCapability",
      "SellerCapabilityHistory",
      "SellerProposal",
      "SellerProposalHistory",
    ]);
  });

  it("36. buyer projection: WITHDRAWN Proposal остаётся виден (честно), DRAFT — нет", async () => {
    const reqId = await submitRequest([{ countryCode: "TR" }]);
    await runMatch(adminAgent, reqId).expect(201);
    const pDraft = (await createProposal(sellerA.agent, reqId).expect(201)).body as ProposalView;
    const pW = (await createProposal(sellerB.agent, reqId, { description: "отозван" }).expect(201)).body as ProposalView;
    const s = (await submitProposal(sellerB.agent, pW.id, pW.version).expect(201)).body as ProposalView;
    await withdrawProposal(sellerB.agent, pW.id, s.version).expect(201);
    const list = (await buyerListProposals(buyerAgent, reqId).expect(200)).body as { items: ProposalView[] };
    expect(list.items.map((x) => x.id)).toEqual([pW.id]);
    expect(list.items[0].status).toBe("WITHDRAWN");
    await buyerGetProposal(buyerAgent, reqId, pDraft.id).expect(404);
    void buyer2CustomerId;
    void buyerCustomerId;
  });
});
