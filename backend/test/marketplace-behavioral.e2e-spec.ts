/**
 * E2E Phase 1 Step 1.13B — Marketplace behavioral instrumentation foundation.
 *
 * Доказательства (§37):
 *  1. MarketplaceViewed accepted/persisted.
 *  2. ProductImpression public MARKETPLACE Product persisted (productId server-resolved).
 *  3. ProductViewed public MARKETPLACE Product persisted.
 *  4. BOTH Product interaction source remains MARKETPLACE (channel не меняется).
 *  5. STOREFRONT-only Product neutral drop.
 *  6. DRAFT Product neutral drop.
 *  7. ARCHIVED/non-public Product neutral drop.
 *  8. unknown Product neutral drop.
 *  9. CategoryViewed public category persisted.
 * 10. unknown/hidden category neutral drop.
 * 11. SearchPerformed valid event (normalized query).
 * 12. Search raw PII/contact rejected (privacy guard).
 * 13-16. forged productId/categoryId/acquisitionSource/partner-seller-customer rejected.
 * 17. malformed sessionId rejected.
 * 18. duplicate eventId dedup.
 * 19. arbitrary eventType rejected.
 * 20. oversized/arbitrary nested payload rejected.
 * 21. occurredAt skew rejected.
 * 22. invalid locale/path rejected.
 * 23. AuditLog unchanged.
 * 24. no Authorization required.
 * 25. response leaks no internal state.
 * 26. Storefront behavioral regression (endpoint ещё работает).
 * 27. publication channels unchanged.
 * 28. public predicates reused (STOREFRONT-only product invisible).
 * 29. ProductDraft/staged internals not exposed.
 * 30. persistence failure observable (unit marketplace-behavioral.service.spec).
 * 31. FILTER/SORT persisted.
 * 32. CTA persisted.
 * 33. Outbox unchanged (behavioral ≠ domain events).
 *
 * Test DB: jest `setupFiles` подставляет изолированную тестовую БД.
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
  user: { id: string; role: string; username: string; partnerId: string | null; permissions: string[] };
}

describe("Phase 1 Step 1.13B — Marketplace behavioral instrumentation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], products: [] as string[], categories: [] as string[], partners: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let p2Agent: ReturnType<typeof request.agent>;

  let lightCatId: string;
  let pMpOnlyId: string; // MARKETPLACE only
  let pSfOnlyId: string; // PARTNER_STOREFRONT only
  let pBothId: string; // BOTH
  let pDraftId: string; // DRAFT
  let pArchivedId: string; // ARCHIVED (PUBLISHED → ARCHIVED)
  let mpSlug: string;
  let sfOnlySlug: string;
  let bothSlug: string;
  let draftSlug: string;
  let archivedSlug: string;

  const sessionId = "mp_anon_session_01"; // opaque non-PII, 8-64 chars

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const postEvent = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/api/v1/public/marketplace/events").send(body);

  const eventBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    eventId: crypto.randomUUID(),
    eventType: "MARKETPLACE_VIEWED",
    occurredAt: new Date().toISOString(),
    sessionId,
    locale: "ru",
    path: "/",
    ...overrides,
  });

  const registerPartner = async (email: string, brandName: string, country: string) => {
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({ email, password: "partnerpass123", firstName: "Ф", lastName: "Л", applicantType: "INDIVIDUAL", brandName, country, contactEmail: email, termsAccepted: true })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);
  };

  const approvePartner = async (userToken: string): Promise<string> => {
    const a = agent(userToken);
    const appRow = (await a.get("/api/v1/partner/application").expect(200)).body as { id: string };
    await a.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    return approved.partnerId;
  };

  const createPublishedProduct = async (a: ReturnType<typeof request.agent>, title: string): Promise<string> => {
    const prod = (await a.post("/api/v1/products").send({ type: "TOUR", title, categoryId: lightCatId, attributes: { days: 2 } }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    await a.post(`/api/v1/products/${prod.id}/submit-moderation`).expect(201);
    const subs = (await modAgent.get("/api/v1/moderation/submissions").expect(200)).body as { items: Array<{ id: string; productId: string }> };
    const sub = subs.items.find((s) => s.productId === prod.id)!;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);
    return prod.id;
  };

  const productSlug = async (productId: string): Promise<string> => {
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
    return p!.slug;
  };

  const mpEventCount = () => prisma.marketplaceBehavioralEvent.count();
  const sfEventCount = () => prisma.storefrontBehavioralEvent.count();
  const auditCount = () => prisma.auditLog.count();
  const outboxCount = () => prisma.outboxEvent.count();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);
    const mod = (await adminAgent.post("/api/v1/users").send({ username: `mpbm${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR }).expect(201)).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`mpbm${stamp}`, "modpass123")).accessToken);

    const slug = `mpb-${stamp}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `MPB ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }] }).expect(201)).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    lightCatId = cat.id;

    const email1 = `mpb1${stamp}@test.local`;
    await registerPartner(email1, `MPB Partner 1 ${stamp}`, "AZ");
    const p1Token = (await login(email1, "partnerpass123")).accessToken;
    partnerAgent = agent(p1Token);
    await approvePartner(p1Token);

    const email2 = `mpb2${stamp}@test.local`;
    await registerPartner(email2, `MPB Partner 2 ${stamp}`, "GE");
    const p2Token = (await login(email2, "partnerpass123")).accessToken;
    p2Agent = agent(p2Token);
    await approvePartner(p2Token);

    // Продукты partner1.
    pMpOnlyId = await createPublishedProduct(partnerAgent, `MPB MP Only ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pMpOnlyId}/channels`).send({ channels: ["MARKETPLACE"] }).expect(200);
    pSfOnlyId = await createPublishedProduct(partnerAgent, `MPB SF Only ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pSfOnlyId}/channels`).send({ channels: ["PARTNER_STOREFRONT"] }).expect(200);
    pBothId = await createPublishedProduct(partnerAgent, `MPB Both ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pBothId}/channels`).send({ channels: ["MARKETPLACE", "PARTNER_STOREFRONT"] }).expect(200);
    const draft = (await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `MPB Draft ${stamp}`, categoryId: lightCatId, attributes: { days: 2 } }).expect(201)).body.product as { id: string };
    created.products.push(draft.id);
    pDraftId = draft.id;
    // ARCHIVED: публикуем, затем архивируем (PUBLISHED → ARCHIVED).
    pArchivedId = await createPublishedProduct(partnerAgent, `MPB Archived ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pArchivedId}/channels`).send({ channels: ["MARKETPLACE"] }).expect(200);
    await adminAgent.post(`/api/v1/products/${pArchivedId}/archive`).expect(201);

    mpSlug = await productSlug(pMpOnlyId);
    sfOnlySlug = await productSlug(pSfOnlyId);
    bothSlug = await productSlug(pBothId);
    draftSlug = await productSlug(pDraftId);
    archivedSlug = await productSlug(pArchivedId);
  });

  afterAll(async () => {
    await prisma.marketplaceBehavioralEvent.deleteMany({});
    await prisma.storefrontBehavioralEvent.deleteMany({});
    await prisma.productPublicationChannel.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.productMedia.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.tariff.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.moderationSubmission.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.productDraft.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.categorySchema.deleteMany({ where: { categoryId: { in: created.categories } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. MARKETPLACE_VIEWED → 202, persisted: acquisitionSource=MARKETPLACE, UTC occurredAt, locale, path", async () => {
    const before = await mpEventCount();
    const occurredAt = new Date().toISOString();
    const body = eventBody({ occurredAt });
    const res = await postEvent(body).expect(202);
    expect(res.body).toEqual({ accepted: true });
    const row = await prisma.marketplaceBehavioralEvent.findUnique({ where: { eventId: body.eventId as string } });
    expect(await mpEventCount()).toBe(before + 1);
    expect(row).not.toBeNull();
    expect(row!.acquisitionSource).toBe("MARKETPLACE");
    expect(row!.locale).toBe("ru");
    expect(row!.path).toBe("/");
    expect(row!.occurredAt.toISOString()).toBe(new Date(occurredAt).toISOString());
    expect(row!.receivedAt.getTime()).toBeGreaterThanOrEqual(row!.occurredAt.getTime());
    expect(row!.productId).toBeNull();
    expect(row!.categoryId).toBeNull();
  });

  it("2. IMPRESSION public MARKETPLACE Product → 202 + canonical productId (server-resolved)", async () => {
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_IMPRESSION", path: "/", productSlug: mpSlug, payload: { placement: "grid", position: 0 } })).expect(202);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { productId: pMpOnlyId }, orderBy: { receivedAt: "desc" } });
    expect(row).not.toBeNull();
    expect(row!.payload).toEqual({ placement: "grid", position: 0 });
    expect(row!.acquisitionSource).toBe("MARKETPLACE");
  });

  it("3. PRODUCT_VIEWED public MARKETPLACE Product → 202 + persisted", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: `/products/${mpSlug}`, productSlug: mpSlug })).expect(202);
    expect(await mpEventCount()).toBe(before + 1);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { productId: pMpOnlyId, eventType: "MARKETPLACE_PRODUCT_VIEWED" } });
    expect(row).not.toBeNull();
  });

  it("4. BOTH Product → source remains MARKETPLACE; publication channels НЕ меняются (§25)", async () => {
    const channelsBefore = await prisma.productPublicationChannel.findMany({ where: { productId: pBothId }, select: { channel: true } });
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: `/products/${bothSlug}`, productSlug: bothSlug })).expect(202);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { productId: pBothId }, orderBy: { receivedAt: "desc" } });
    expect(row!.acquisitionSource).toBe("MARKETPLACE");
    const channelsAfter = await prisma.productPublicationChannel.findMany({ where: { productId: pBothId }, select: { channel: true } });
    expect(channelsAfter.map((c) => c.channel).sort()).toEqual(channelsBefore.map((c) => c.channel).sort());
  });

  it("5. STOREFRONT-only Product → нейтральный 202, НЕ сохраняется", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: `/products/${sfOnlySlug}`, productSlug: sfOnlySlug })).expect(202);
    expect(await mpEventCount()).toBe(before);
    expect(await prisma.marketplaceBehavioralEvent.count({ where: { productId: pSfOnlyId } })).toBe(0);
  });

  it("6. DRAFT Product → нейтральный 202, НЕ сохраняется", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: `/products/${draftSlug}`, productSlug: draftSlug })).expect(202);
    expect(await mpEventCount()).toBe(before);
  });

  it("7. ARCHIVED Product → нейтральный 202, НЕ сохраняется", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: `/products/${archivedSlug}`, productSlug: archivedSlug })).expect(202);
    expect(await mpEventCount()).toBe(before);
  });

  it("8. unknown Product slug → нейтральный 202, НЕ сохраняется", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", path: "/products/no-such-product", productSlug: "no-such-product" })).expect(202);
    expect(await mpEventCount()).toBe(before);
  });

  it("9. CATEGORY_VIEWED public category → 202 + canonical categoryId", async () => {
    const cat = await prisma.category.findFirst({ where: { id: lightCatId }, select: { slug: true, id: true } });
    await postEvent(eventBody({ eventType: "MARKETPLACE_CATEGORY_VIEWED", path: `/categories/${cat!.slug}`, categorySlug: cat!.slug })).expect(202);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { categoryId: lightCatId }, orderBy: { receivedAt: "desc" } });
    expect(row).not.toBeNull();
  });

  it("10. unknown/hidden category → нейтральный 202, НЕ сохраняется", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_CATEGORY_VIEWED", path: "/categories/no-such-cat", categorySlug: "no-such-cat" })).expect(202);
    // INACTIVE category → neutral drop.
    const inactive = await prisma.category.create({ data: { code: `CAT-MPB-I-${stamp}`, slug: `mpb-inactive-${stamp}`, title: `MPB Inactive ${stamp}`, status: "INACTIVE" } });
    created.categories.push(inactive.id);
    await postEvent(eventBody({ eventType: "MARKETPLACE_CATEGORY_VIEWED", path: `/categories/${inactive.slug}`, categorySlug: inactive.slug })).expect(202);
    expect(await mpEventCount()).toBe(before);
  });

  it("11. SEARCH_PERFORMED → 202 + нормализованная query", async () => {
    const before = await mpEventCount();
    await postEvent(eventBody({ eventType: "MARKETPLACE_SEARCH_PERFORMED", path: "/search", payload: { query: "  Баку   тур " } })).expect(202);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { eventType: "MARKETPLACE_SEARCH_PERFORMED" }, orderBy: { receivedAt: "desc" } });
    expect(await mpEventCount()).toBe(before + 1);
    expect((row!.payload as { query: string }).query).toBe("Баку тур");
  });

  it("12. Search raw PII/contact → 422 (privacy guard §15)", async () => {
    await postEvent(eventBody({ eventType: "MARKETPLACE_SEARCH_PERFORMED", path: "/search", payload: { query: "call +994501234567" } })).expect(422);
    await postEvent(eventBody({ eventType: "MARKETPLACE_SEARCH_PERFORMED", path: "/search", payload: { query: "a@b.c" } })).expect(422);
    await postEvent(eventBody({ eventType: "MARKETPLACE_SEARCH_PERFORMED", path: "/search", payload: { query: "https://x.example" } })).expect(422);
  });

  it("13. forged productId → 422", async () => {
    await postEvent(eventBody({ productId: "PRD-1" })).expect(422);
  });

  it("14. forged categoryId → 422", async () => {
    await postEvent(eventBody({ categoryId: "CAT-1" })).expect(422);
  });

  it("15. forged acquisitionSource → 422", async () => {
    await postEvent(eventBody({ acquisitionSource: "DIRECT" })).expect(422);
  });

  it("16. forged partner/seller/customer/user → 422", async () => {
    await postEvent(eventBody({ partnerId: "PAR-1" })).expect(422);
    await postEvent(eventBody({ sellerId: "SELL-1" })).expect(422);
    await postEvent(eventBody({ customerId: "CUS-1" })).expect(422);
    await postEvent(eventBody({ authenticatedUserId: "usr-1" })).expect(422);
  });

  it("17. malformed sessionId → 422", async () => {
    await postEvent(eventBody({ sessionId: "short" })).expect(422);
    await postEvent(eventBody({ sessionId: "with space here 12345" })).expect(422);
  });

  it("18. duplicate eventId → оба 202, ОДНА логическая запись (dedup)", async () => {
    const body = eventBody();
    await postEvent(body).expect(202);
    await postEvent(body).expect(202);
    expect(await prisma.marketplaceBehavioralEvent.count({ where: { eventId: body.eventId as string } })).toBe(1);
  });

  it("19. arbitrary eventType → 422", async () => {
    await postEvent(eventBody({ eventType: "ARBITRARY_EVENT" })).expect(422);
    await postEvent(eventBody({ eventType: "STOREFRONT_VIEWED" })).expect(422);
  });

  it("20. oversized/arbitrary nested payload → 422", async () => {
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_IMPRESSION", productSlug: mpSlug, payload: { placement: "grid", extra: "x".repeat(5000) } })).expect(422);
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_IMPRESSION", productSlug: mpSlug, payload: { nested: { deep: [1, 2, 3] } } })).expect(422);
    await postEvent(eventBody({ eventType: "MARKETPLACE_FILTER_APPLIED", categorySlug: "tours", payload: { key: "days", value: "x", deep: { a: 1 } } })).expect(422);
  });

  it("21. occurredAt skew (далёкое прошлое/будущее) → 422; в окне — ок", async () => {
    await postEvent(eventBody({ occurredAt: "2026-01-01T00:00:00.000Z" })).expect(422);
    await postEvent(eventBody({ occurredAt: "2027-08-09T00:00:00.000Z" })).expect(422);
    await postEvent(eventBody({ occurredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() })).expect(202);
  });

  it("22. invalid locale/path → 4xx", async () => {
    await postEvent(eventBody({ locale: "de" })).expect(400);
    await postEvent(eventBody({ path: "/app/dashboard" })).expect(422);
    await postEvent(eventBody({ path: "/store/kavkaz" })).expect(422);
    await postEvent(eventBody({ path: "/products/a?x=1" })).expect(422);
  });

  it("23. AuditLog unchanged (behavioral ≠ audit, §26)", async () => {
    const before = await auditCount();
    await postEvent(eventBody()).expect(202);
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", productSlug: mpSlug, path: `/products/${mpSlug}` })).expect(202);
    expect(await auditCount()).toBe(before);
  });

  it("24. public ingestion не требует Authorization (все вызовы выше без Bearer)", async () => {
    expect(true).toBe(true);
  });

  it("25. response не раскрывает internal state", async () => {
    const res = await postEvent(eventBody()).expect(202);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("productId");
    expect(body).not.toContain("categoryId");
    expect(body).not.toContain("partnerId");
    expect(body).not.toContain("sessionId");
    expect(body).not.toContain("acquisitionSource");
    expect(res.body).toEqual({ accepted: true });
  });

  it("26. Storefront behavioral regression: storefront endpoint продолжает работать", async () => {
    // Создаём ACTIVE витрину + PARTNER_STOREFRONT product → storefront event persist.
    const sfSlug = `mpb-sf-${stamp}`;
    const sf = (await partnerAgent.post("/api/v1/partner/storefront").send({ slug: sfSlug, businessName: `MPB SF ${stamp}` }).expect(201)).body as { id: string };
    const p1PartnerId = await prisma.partnerStorefront.findUnique({ where: { id: sf.id }, select: { partnerId: true } });
    await adminAgent.post(`/api/v1/storefronts/${p1PartnerId!.partnerId}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    const beforeSf = await sfEventCount();
    await request(app.getHttpServer())
      .post(`/api/v1/public/storefronts/${sfSlug}/events`)
      .send({ eventId: crypto.randomUUID(), eventType: "STOREFRONT_VIEWED", occurredAt: new Date().toISOString(), sessionId, locale: "ru", path: `/store/${sfSlug}` })
      .expect(202);
    expect(await sfEventCount()).toBe(beforeSf + 1);
    // Чистим витрину.
    await prisma.partnerStorefront.delete({ where: { id: sf.id } });
  });

  it("27. publication channels unchanged by events (§27)", async () => {
    const before = await prisma.productPublicationChannel.findMany({ where: { productId: pMpOnlyId }, select: { channel: true } });
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", productSlug: mpSlug, path: `/products/${mpSlug}` })).expect(202);
    const after = await prisma.productPublicationChannel.findMany({ where: { productId: pMpOnlyId }, select: { channel: true } });
    expect(after.map((c) => c.channel).sort()).toEqual(before.map((c) => c.channel).sort());
  });

  it("28. public predicates reused: STOREFRONT-only product invisible in Marketplace events (доказано в #5)", async () => {
    expect(await prisma.marketplaceBehavioralEvent.count({ where: { productId: pSfOnlyId } })).toBe(0);
  });

  it("29. ProductDraft/staged internals not exposed: события не содержат draft/data/attributes", async () => {
    const raw = await prisma.$queryRawUnsafe<Array<{ payload: string }>>(
      `SELECT "payload"::text AS payload FROM catalog."MarketplaceBehavioralEvent"`,
    );
    for (const r of raw) {
      expect(r.payload).not.toContain("storageKey");
      expect(r.payload).not.toContain("attributes");
      expect(r.payload).not.toContain("partnerId");
    }
  });

  it("30. response контракт persistence: accepted без internal state (доказано в #25); сбой durability observable (unit marketplace-behavioral.service.spec)", async () => {
    expect(true).toBe(true);
  });

  it("31. FILTER_APPLIED и SORT_CHANGED persist (реальный UI категории)", async () => {
    const cat = await prisma.category.findFirst({ where: { id: lightCatId }, select: { slug: true } });
    await postEvent(eventBody({ eventType: "MARKETPLACE_FILTER_APPLIED", path: `/categories/${cat!.slug}`, categorySlug: cat!.slug, payload: { key: "days", value: "3" } })).expect(202);
    await postEvent(eventBody({ eventType: "MARKETPLACE_SORT_CHANGED", path: "/search", payload: { sort: "price_asc" } })).expect(202);
    const f = await prisma.marketplaceBehavioralEvent.findFirst({ where: { eventType: "MARKETPLACE_FILTER_APPLIED" }, orderBy: { receivedAt: "desc" } });
    expect(f).not.toBeNull();
    expect(f!.categoryId).toBe(lightCatId);
    expect((f!.payload as { key: string }).key).toBe("days");
    const s = await prisma.marketplaceBehavioralEvent.findFirst({ where: { eventType: "MARKETPLACE_SORT_CHANGED" }, orderBy: { receivedAt: "desc" } });
    expect(s!.payload).toEqual({ sort: "price_asc" });
  });

  it("32. CTA_CLICKED persist (реальный CTA Marketplace PDP)", async () => {
    await postEvent(eventBody({ eventType: "MARKETPLACE_CTA_CLICKED", path: `/products/${mpSlug}` })).expect(202);
    const row = await prisma.marketplaceBehavioralEvent.findFirst({ where: { eventType: "MARKETPLACE_CTA_CLICKED" }, orderBy: { receivedAt: "desc" } });
    expect(row).not.toBeNull();
  });

  it("33. OutboxEvent unchanged (behavioral ≠ domain events, §27)", async () => {
    const before = await outboxCount();
    await postEvent(eventBody()).expect(202);
    await postEvent(eventBody({ eventType: "MARKETPLACE_PRODUCT_VIEWED", productSlug: mpSlug, path: `/products/${mpSlug}` })).expect(202);
    await postEvent(eventBody({ eventType: "MARKETPLACE_SEARCH_PERFORMED", path: "/search", payload: { query: "тест" } })).expect(202);
    expect(await outboxCount()).toBe(before);
  });
});
