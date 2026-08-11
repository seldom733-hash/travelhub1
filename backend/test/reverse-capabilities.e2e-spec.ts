/**
 * E2E PHASE 2 STEP 2.2A — Seller Commercial Capabilities & Destination Coverage
 * (reverse.*, ADR-0012).
 *
 * Инварианты:
 *  - ownership ТОЛЬКО из actor.partnerId (сервер); forged sellerId/серверные
 *    поля → 422; чужой capability по id → neutral 404 (анти-энумерация);
 *  - legal/registration country (AZ/Baku) НЕ определяет coverage: Seller из AZ
 *    объявляет HOTEL → TR/Turkey; coverage не переписывается и не подставляется;
 *  - один capability на (seller, категорию) — duplicate → controlled 409;
 *  - CAS (version): stale expectedVersion → 409; concurrent → один победитель;
 *  - lifecycle DRAFT → ACTIVE → INACTIVE (re-activate), no-op при том же
 *    состоянии; timestamps — реальные переходы;
 *  - acceptsBuyerRequests: безопасный default false; enable/disable НЕ создаёт
 *    BuyerRequest/Lead/Opportunity/Quote/Sale и НЕ даёт entitlement;
 *  - capability ≠ inventory: НИКАКИХ side effects на Product/Tariff/Availability/
 *    Reservation; reverse.* содержит approved 2.2A-2.2D сущности;
 *  - audit history по каждому meaningful mutation; события НЕ эмитятся.
 *
 * Test DB: изолированная (e2e.env.ts) — dev-БД не используется.
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
  user: { id: string; role: string; username: string; email: string | null; partnerId: string | null; permissions: string[] };
}

interface CapabilityView {
  id: string;
  code: string;
  sellerId: string;
  categoryId: string;
  categorySlug: string;
  destinations: Array<{ countryCode?: string; cityCode?: string; worldwide?: boolean }>;
  acceptsBuyerRequests: boolean;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
}

describe("Phase 2 Step 2.2A — Seller Commercial Capabilities (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = {
    users: [] as string[],
    applications: [] as string[],
    partners: [] as string[],
    categories: [] as string[],
    capabilities: [] as string[],
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let partner2Agent: ReturnType<typeof request.agent>;
  let pendingAgent: ReturnType<typeof request.agent>;

  let partner1Id: string;
  let partner2Id: string;
  let catHotelId: string;
  let catTourId: string;
  let catTransferId: string;
  let catWorldwideId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const listCaps = (a: ReturnType<typeof request.agent>, qs = "") => a.get(`/api/v1/partner/reverse/capabilities${qs}`);
  const getCap = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/partner/reverse/capabilities/${id}`);
  const capHistory = (a: ReturnType<typeof request.agent>, id: string) => a.get(`/api/v1/partner/reverse/capabilities/${id}/history`);
  const createCap = (a: ReturnType<typeof request.agent>, body: Record<string, unknown>) =>
    a.post("/api/v1/partner/reverse/capabilities").send(body);
  const patchCap = (a: ReturnType<typeof request.agent>, id: string, body: Record<string, unknown>) =>
    a.patch(`/api/v1/partner/reverse/capabilities/${id}`).send(body);
  const setAccepts = (a: ReturnType<typeof request.agent>, id: string, body: Record<string, unknown>) =>
    a.post(`/api/v1/partner/reverse/capabilities/${id}/accept-requests`).send(body);
  const activateCap = (a: ReturnType<typeof request.agent>, id: string, v: number) =>
    a.post(`/api/v1/partner/reverse/capabilities/${id}/activate`).send({ expectedVersion: v });
  const deactivateCap = (a: ReturnType<typeof request.agent>, id: string, v: number) =>
    a.post(`/api/v1/partner/reverse/capabilities/${id}/deactivate`).send({ expectedVersion: v });

  const registerPartner = async (email: string, brandName: string, country: string) => {
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "Ф",
          lastName: "Л",
          applicantType: "INDIVIDUAL",
          brandName,
          country,
          contactEmail: email,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);
    return reg.user.id;
  };

  const approvePartner = async (userToken: string): Promise<string> => {
    const a = agent(userToken);
    const appRow = (await a.get("/api/v1/partner/application").expect(200)).body as { id: string };
    created.applications.push(appRow.id);
    await a.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    return approved.partnerId;
  };

  const makeCategory = async (slug: string, title: string): Promise<string> => {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    return cat.id;
  };

  const dbCounts = async () => {
    const [products, tariffs, availability, reservations, leads, opps, quotes, sales] = await prisma.$transaction([
      prisma.product.count(),
      prisma.tariff.count(),
      prisma.availability.count(),
      prisma.availabilityReservation.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.quote.count(),
      prisma.sale.count(),
    ]);
    return { products, tariffs, availability, reservations, leads, opps, quotes, sales };
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

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const buyer = (await adminAgent.post("/api/v1/users").send({ username: `rcbuy${stamp}`, password: "buypass123", roleCode: RoleCode.BUYER }).expect(201)).body as { id: string };
    created.users.push(buyer.id);
    buyerAgent = await agent((await login(`rcbuy${stamp}`, "buypass123")).accessToken);

    // Категории (Catalog остаётся владельцем taxonomy; capability только ссылается).
    catHotelId = await makeCategory(`rc-hotel-${stamp}`, `RC Hotel ${stamp}`);
    catTourId = await makeCategory(`rc-tour-${stamp}`, `RC Tour ${stamp}`);
    catTransferId = await makeCategory(`rc-transfer-${stamp}`, `RC Transfer ${stamp}`);
    catWorldwideId = await makeCategory(`rc-world-${stamp}`, `RC Worldwide ${stamp}`);

    // Seller 1 — AZ/Baku (legal location), объявляет coverage Turkey (TR).
    const email1 = `rc1${stamp}@test.local`;
    await registerPartner(email1, `RC Partner 1 ${stamp}`, "AZ");
    partnerAgent = await agent((await login(email1, "partnerpass123")).accessToken);
    partner1Id = await approvePartner((await login(email1, "partnerpass123")).accessToken);

    // Seller 2 — GE.
    const email2 = `rc2${stamp}@test.local`;
    await registerPartner(email2, `RC Partner 2 ${stamp}`, "GE");
    partner2Agent = await agent((await login(email2, "partnerpass123")).accessToken);
    partner2Id = await approvePartner((await login(email2, "partnerpass123")).accessToken);

    // Pending PARTNER (partnerId=null).
    const emailP = `rcp${stamp}@test.local`;
    await registerPartner(emailP, `RC Pending ${stamp}`, "RU");
    pendingAgent = await agent((await login(emailP, "partnerpass123")).accessToken);
  });

  afterAll(async () => {
    await prisma.sellerCapability.deleteMany({ where: { sellerId: { in: created.partners } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    // Outbox-гигиена: PartnerCreated (onboarding flow) этих партнёров.
    await prisma.outboxEvent.deleteMany({ where: { eventType: "PartnerCreated", aggregateId: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.auditLog.deleteMany({ where: { resource: "SellerCapability" } });
    await app.close();
  });

  // ── Gates / RBAC ──────────────────────────────────────────────────────

  it("1. anonymous denied (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/partner/reverse/capabilities").expect(401);
    await request(app.getHttpServer()).post("/api/v1/partner/reverse/capabilities").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(401);
  });

  it("2. Buyer denied from Seller capability mutation (403)", async () => {
    await buyerAgent.post("/api/v1/partner/reverse/capabilities").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(403);
    await buyerAgent.get("/api/v1/partner/reverse/capabilities").expect(403);
  });

  it("3. pending PARTNER (partnerId=null) denied (403)", async () => {
    await pendingAgent.post("/api/v1/partner/reverse/capabilities").send({ categoryId: catHotelId, destinations: [{ countryCode: "TR" }] }).expect(403);
  });

  // ── Create + legal-location isolation ─────────────────────────────────

  it("4. authorized Seller create → DRAFT, code CAP-, ownership = actor.partnerId; AZ Seller → Turkey coverage, никакого implicit AZ", async () => {
    const before = await dbCounts();
    const res = await createCap(partnerAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }, { countryCode: "TR", cityCode: "ANTALYA" }] }).expect(201);
    const cap = res.body as CapabilityView;
    created.capabilities.push(cap.id);
    expect(cap.code).toMatch(/^CAP-\d{8}$/);
    expect(cap.status).toBe("DRAFT");
    expect(cap.sellerId).toBe(partner1Id);
    expect(cap.categorySlug).toBe(`rc-hotel-${stamp}`);
    expect(cap.acceptsBuyerRequests).toBe(false);
    expect(cap.activatedAt).toBeNull();
    // Coverage — ровно TR (страна юридической регистрации AZ НЕ подставляется).
    expect(cap.destinations).toEqual([
      { countryCode: "TR" },
      { countryCode: "TR", cityCode: "ANTALYA" },
    ]);
    expect(cap.destinations.some((d) => d.countryCode === "AZ")).toBe(false);
    // Capability ≠ inventory: никаких Catalog/Sales side effects.
    const after = await dbCounts();
    expect(after).toEqual(before);
  });

  it("5. multi-capability Seller: HOTEL→TR, TOUR→TR, TRANSFER→GE без перезаписи", async () => {
    const cap2 = (await createCap(partnerAgent, { categoryId: catTourId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as CapabilityView;
    const cap3 = (await createCap(partnerAgent, { categoryId: catTransferId, destinations: [{ countryCode: "GE", cityCode: "TBILISI" }] }).expect(201)).body as CapabilityView;
    created.capabilities.push(cap2.id, cap3.id);
    expect(cap2.categoryId).toBe(catTourId);
    expect(cap3.categoryId).toBe(catTransferId);
    const list = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[]; total: number };
    expect(list.total).toBe(3);
    expect(list.items.map((c) => c.categoryId).sort()).toEqual([catHotelId, catTourId, catTransferId].sort());
    // Каждая capability сохранила своё покрытие.
    expect(list.items.find((c) => c.id === cap2.id)!.destinations).toEqual([{ countryCode: "TR" }]);
    expect(list.items.find((c) => c.id === cap3.id)!.destinations).toEqual([{ countryCode: "GE", cityCode: "TBILISI" }]);
  });

  it("6. list/get own scope; read model возвращает Turkey coverage", async () => {
    const list = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[]; total: number };
    expect(list.total).toBe(3);
    const hotel = list.items.find((c) => c.categoryId === catHotelId)!;
    const one = (await getCap(partnerAgent, hotel.id).expect(200)).body as CapabilityView;
    expect(one.destinations).toEqual([{ countryCode: "TR" }, { countryCode: "TR", cityCode: "ANTALYA" }]);
  });

  // ── IDOR / forged fields ──────────────────────────────────────────────

  it("7. cross-Seller IDOR: A не читает capability B (neutral 404); A не мутирует B", async () => {
    const bCap = (await createCap(partner2Agent, { categoryId: catTourId, destinations: [{ countryCode: "TR" }] }).expect(201)).body as CapabilityView;
    created.capabilities.push(bCap.id);
    await getCap(partnerAgent, bCap.id).expect(404);
    await capHistory(partnerAgent, bCap.id).expect(404);
    await patchCap(partnerAgent, bCap.id, { destinations: [{ countryCode: "DE" }], expectedVersion: 1 }).expect(404);
    await activateCap(partnerAgent, bCap.id, 1).expect(404);
  });

  it("8. forged sellerId / серверные поля в create и PATCH → 422", async () => {
    await createCap(partnerAgent, { categoryId: catTourId, destinations: [{ countryCode: "TR" }], sellerId: partner2Id }).expect(422);
    await createCap(partnerAgent, { categoryId: catTourId, destinations: [{ countryCode: "TR" }], partnerId: partner2Id, status: "ACTIVE", version: 99, acceptsBuyerRequests: true, code: "CAP-99999999" }).expect(422);
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catHotelId)!;
    // PATCH: categoryId immutable + server-owned → 422.
    await patchCap(partnerAgent, cap.id, { categoryId: catTransferId, destinations: [{ countryCode: "TR" }], expectedVersion: cap.version }).expect(422);
    await patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "TR" }], expectedVersion: cap.version, status: "ACTIVE", sellerId: partner2Id }).expect(422);
    // Невалидные destinations → 422 (до CAS).
    await patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "tr" }], expectedVersion: cap.version }).expect(422);
    // DTO-уровень (пустой массив): ValidationPipe → 400.
    await createCap(partnerAgent, { categoryId: catTourId, destinations: [] }).expect(400);
  });

  it("9. accepts requests: безопасный default; enable/disable (CAS), без side effects и без entitlement", async () => {
    const before = await dbCounts();
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catHotelId)!;
    expect(cap.acceptsBuyerRequests).toBe(false);

    const on = (await setAccepts(partnerAgent, cap.id, { accepts: true, expectedVersion: cap.version }).expect(201)).body as CapabilityView;
    expect(on.acceptsBuyerRequests).toBe(true);
    expect(on.version).toBe(cap.version + 1);
    // No-op при том же значении — без мутации/версии.
    const again = (await setAccepts(partnerAgent, cap.id, { accepts: true, expectedVersion: on.version }).expect(201)).body as CapabilityView;
    expect(again.version).toBe(on.version);

    const off = (await setAccepts(partnerAgent, cap.id, { accepts: false, expectedVersion: again.version }).expect(201)).body as CapabilityView;
    expect(off.acceptsBuyerRequests).toBe(false);
    expect(off.version).toBe(again.version + 1);

    // enable/disable НЕ создаёт BuyerRequest/Lead/Opportunity/Quote/Sale/Product.
    const after = await dbCounts();
    expect(after).toEqual(before);
    // Capability ≠ entitlement: у capability НЕТ entitlement-поля (проекция whitelist).
    expect((cap as unknown as Record<string, unknown>).entitlementStatus).toBeUndefined();
    expect((on as unknown as Record<string, unknown>).entitlementStatus).toBeUndefined();
  });

  it("10. lifecycle: activate → ACTIVE + activatedAt; deactivate → INACTIVE + deactivatedAt; re-activate; no-op при том же состоянии", async () => {
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catTourId)!;

    const active = (await activateCap(partnerAgent, cap.id, cap.version).expect(201)).body as CapabilityView;
    expect(active.status).toBe("ACTIVE");
    expect(active.activatedAt).not.toBeNull();
    expect(active.deactivatedAt).toBeNull();

    const noop = (await activateCap(partnerAgent, cap.id, active.version).expect(201)).body as CapabilityView;
    expect(noop.status).toBe("ACTIVE");
    expect(noop.version).toBe(active.version); // no-op без мутации

    const inactive = (await deactivateCap(partnerAgent, cap.id, noop.version).expect(201)).body as CapabilityView;
    expect(inactive.status).toBe("INACTIVE");
    expect(inactive.deactivatedAt).not.toBeNull();

    const reactivated = (await activateCap(partnerAgent, cap.id, inactive.version).expect(201)).body as CapabilityView;
    expect(reactivated.status).toBe("ACTIVE");
    expect(reactivated.activatedAt).not.toBeNull();

    // DRAFT → deactivate — invalid transition (422).
    const hotel = own.items.find((c) => c.categoryId === catHotelId)!;
    await deactivateCap(partnerAgent, hotel.id, hotel.version).expect(422);
  });

  it("11. CAS: stale expectedVersion → 409; контент не мутируется", async () => {
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catHotelId)!;
    await patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "DE" }], expectedVersion: cap.version + 100 }).expect(409);
    await setAccepts(partnerAgent, cap.id, { accepts: true, expectedVersion: cap.version + 100 }).expect(409);
    await activateCap(partnerAgent, cap.id, cap.version + 100).expect(409);
  });

  it("12. concurrent update → один победитель (два PATCH с одной expectedVersion)", async () => {
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catHotelId)!;
    const v = cap.version;
    const [r1, r2] = await Promise.all([
      patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "DE" }], expectedVersion: v }),
      patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "US" }], expectedVersion: v }),
    ]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const winner = r1.status === 200 ? (r1.body as CapabilityView) : (r2.body as CapabilityView);
    expect(winner.version).toBe(v + 1);
    expect(winner.destinations[0].countryCode).toBe(r1.status === 200 ? "DE" : "US");
  });

  it("13. duplicate semantics: (seller, category) — controlled 409, не ambiguous", async () => {
    const res = await createCap(partnerAgent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] });
    expect(res.status).toBe(409);
    const res2 = await createCap(partner2Agent, { categoryId: catHotelId, destinations: [{ countryCode: "TR" }] });
    expect(res2.status).toBe(201); // другой Seller — легально
    created.capabilities.push((res2.body as CapabilityView).id);
  });

  it("14. history/audit: created/updated/accepts/lifecycle с actor и before/after", async () => {
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catTransferId)!;
    const h = (await capHistory(partnerAgent, cap.id).expect(200)).body as { items: Array<{ action: string; from: string | null; to: string | null; actorId: string | null; fields: unknown }> };
    expect(h.items.length).toBeGreaterThanOrEqual(1);
    expect(h.items.some((x) => x.action === "created")).toBe(true);
    expect(h.items[0].actorId).not.toBeNull();
    // AuditLog записан.
    const audit = await prisma.auditLog.count({ where: { resource: "SellerCapability", resourceId: cap.id } });
    expect(audit).toBeGreaterThanOrEqual(1);
  });

  // ── Isolation proofs ──────────────────────────────────────────────────

  it("15/16/17. capability ≠ inventory & ≠ Sales: 0 side effects; reverse.* содержит только approved 2.2A/2.2B сущности", async () => {
    const before = await dbCounts();
    await createCap(partner2Agent, { categoryId: catTransferId, destinations: [{ worldwide: true }] }).expect(201); // B
    const after = await dbCounts();
    expect(after).toEqual(before);
    const tables = await reverseTables();
    // Step 2.2C добавил BuyerRequestDistribution (легитимная эволюция).
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

  it("18. worldwide coverage — эксклюзивная запись (валидация); не создаётся как fake country", async () => {
    await createCap(partnerAgent, { categoryId: catWorldwideId, destinations: [{ worldwide: true }, { countryCode: "TR" }] }).expect(422);
    await createCap(partnerAgent, { categoryId: catWorldwideId, destinations: [{ countryCode: "WW" }] }).expect(422);
    const ok = (await createCap(partnerAgent, { categoryId: catWorldwideId, destinations: [{ worldwide: true }] }).expect(201)).body as CapabilityView;
    created.capabilities.push(ok.id);
    expect(ok.destinations).toEqual([{ worldwide: true }]);
  });

  it("19. failure atomicity: неудачный CAS не оставляет history/версию/audit", async () => {
    const own = (await listCaps(partnerAgent).expect(200)).body as { items: CapabilityView[] };
    const cap = own.items.find((c) => c.categoryId === catTransferId)!;
    const historyBefore = await prisma.sellerCapabilityHistory.count({ where: { capabilityId: cap.id } });
    const auditBefore = await prisma.auditLog.count({ where: { resource: "SellerCapability", resourceId: cap.id } });
    await patchCap(partnerAgent, cap.id, { destinations: [{ countryCode: "FR" }], expectedVersion: cap.version + 50 }).expect(409);
    const historyAfter = await prisma.sellerCapabilityHistory.count({ where: { capabilityId: cap.id } });
    expect(historyAfter).toBe(historyBefore);
    // Неудачная CAS не оставляет success-audit (транзакция откачена целиком).
    const auditAfter = await prisma.auditLog.count({ where: { resource: "SellerCapability", resourceId: cap.id } });
    expect(auditAfter).toBe(auditBefore);
    const fresh = (await getCap(partnerAgent, cap.id).expect(200)).body as CapabilityView;
    expect(fresh.version).toBe(cap.version);
    expect(fresh.destinations).toEqual([{ countryCode: "GE", cityCode: "TBILISI" }]);
  });

  it("20. pagination: deterministic order + total", async () => {
    const page = (await listCaps(partnerAgent, "?limit=2&offset=0").expect(200)).body as { items: CapabilityView[]; total: number };
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(page.total).toBeGreaterThanOrEqual(3);
    const all = (await listCaps(partnerAgent, "?limit=100").expect(200)).body as { items: CapabilityView[] };
    // Детерминированный порядок: createdAt desc, id desc.
    const sorted = [...all.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
    expect(all.items.map((c) => c.id)).toEqual(sorted.map((c) => c.id));
  });
});
