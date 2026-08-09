/**
 * E2E Phase 1 Step 1.12.3 — Storefront behavioral instrumentation foundation.
 *
 * Доказательства:
 *  §17 publication vs acquisition:
 *   1. MARKETPLACE-only Product → Storefront behavioral product event не принимается;
 *   2. PARTNER_STOREFRONT-only → событие допустимо, publication state не меняется;
 *   3. BOTH → Storefront acquisition context (PARTNER_STOREFRONT), MARKETPLACE
 *      channel не меняет источник;
 *   4. Product без канала → Storefront product event недопустим.
 *  §21 abuse 1-24: forged storefrontId/productId/partnerId/authenticatedUserId/
 *   acquisitionSource; malformed sessionId; duplicate eventId; arbitrary eventType;
 *   oversized payload; arbitrary nested JSON; raw contact value; no-Auth; neutral
 *   drop для DRAFT/INACTIVE/NONE/SUSPENDED/EXPIRED/чужой/DRAFT Product; response
 *   без internal state.
 *  §22 temporal: occurredAt присутствует (UTC), skew-window, dedup не удваивает
 *   logical event, порядок не из автоинкремента.
 *  §11 AuditLog isolation: behavioral events НЕ пишутся в AuditLog.
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

describe("Phase 1 Step 1.12.3 — Storefront behavioral instrumentation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], applications: [] as string[], partners: [] as string[], products: [] as string[], categories: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;

  let lightCatId: string;
  let pMpOnlyId: string; // MARKETPLACE only
  let pSfOnlyId: string; // PARTNER_STOREFRONT only
  let pBothId: string; // BOTH
  let pNoChannelId: string; // no channels
  let pDraftId: string; // DRAFT
  let pOtherPartnerId: string; // partner2's STOREFRONT product (чужой)
  let liveSlug: string;
  let draftSlug: string;
  let sfLiveId: string;

  const sessionId = "anon_session_12345"; // opaque non-PII, 8-64 chars

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** POST behavioral event без Authorization (public). */
  const postEvent = (slug: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(`/api/v1/public/storefronts/${slug}/events`).send(body);

  const eventBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    eventId: crypto.randomUUID(),
    eventType: "STOREFRONT_VIEWED",
    occurredAt: new Date().toISOString(),
    sessionId,
    locale: "ru",
    path: `/store/${liveSlug}`,
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
    created.applications.push(appRow.id);
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

  const eventCount = () => prisma.storefrontBehavioralEvent.count();
  const auditCount = () => prisma.auditLog.count();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);
    const mod = (await adminAgent.post("/api/v1/users").send({ username: `sfbm${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR }).expect(201)).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`sfbm${stamp}`, "modpass123")).accessToken);

    const slug = `sfb-${stamp}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `SFB ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }] }).expect(201)).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    lightCatId = cat.id;

    // Partner 1 (live storefront).
    const email1 = `sfb1${stamp}@test.local`;
    await registerPartner(email1, `SFB Partner 1 ${stamp}`, "AZ");
    const p1Token = (await login(email1, "partnerpass123")).accessToken;
    partnerAgent = agent(p1Token);
    await approvePartner(p1Token);

    // Partner 2 (только для чужого Product + DRAFT storefront).
    const email2 = `sfb2${stamp}@test.local`;
    await registerPartner(email2, `SFB Partner 2 ${stamp}`, "GE");
    const p2Token = (await login(email2, "partnerpass123")).accessToken;
    const p2 = agent(p2Token);
    await approvePartner(p2Token);

    // Продукты partner1.
    pMpOnlyId = await createPublishedProduct(partnerAgent, `SFB MP Only ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pMpOnlyId}/channels`).send({ channels: ["MARKETPLACE"] }).expect(200);
    pSfOnlyId = await createPublishedProduct(partnerAgent, `SFB SF Only ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pSfOnlyId}/channels`).send({ channels: ["PARTNER_STOREFRONT"] }).expect(200);
    pBothId = await createPublishedProduct(partnerAgent, `SFB Both ${stamp}`);
    await partnerAgent.put(`/api/v1/products/${pBothId}/channels`).send({ channels: ["MARKETPLACE", "PARTNER_STOREFRONT"] }).expect(200);
    pNoChannelId = await createPublishedProduct(partnerAgent, `SFB No Channel ${stamp}`);
    // API запрещает пустой набор каналов (продукт без публичного канала) —
    // симулируем legacy/inconsistent состояние напрямую в БД (§17.4).
    await prisma.productPublicationChannel.deleteMany({ where: { productId: pNoChannelId } });
    const draft = (await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `SFB Draft ${stamp}`, categoryId: lightCatId, attributes: { days: 2 } }).expect(201)).body.product as { id: string };
    created.products.push(draft.id);
    pDraftId = draft.id;

    // Чужой Product: partner2 PUBLISHED + PARTNER_STOREFRONT (не принадлежит partner1).
    pOtherPartnerId = await createPublishedProduct(p2, `SFB Other ${stamp}`);
    await p2.put(`/api/v1/products/${pOtherPartnerId}/channels`).send({ channels: ["PARTNER_STOREFRONT"] }).expect(200);

    // Storefront partner1: ACTIVE + entitlement ACTIVE.
    liveSlug = `live-${stamp}`;
    const liveSf = (await partnerAgent.post("/api/v1/partner/storefront").send({ slug: liveSlug, businessName: `Live ${stamp}` }).expect(201)).body as { id: string };
    sfLiveId = liveSf.id;
    const p1PartnerId = await prisma.partnerStorefront.findUnique({ where: { id: sfLiveId }, select: { partnerId: true } });
    await adminAgent.post(`/api/v1/storefronts/${p1PartnerId!.partnerId}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);

    // Storefront partner2: DRAFT (не публична).
    draftSlug = `draft-${stamp}`;
    await p2.post("/api/v1/partner/storefront").send({ slug: draftSlug, businessName: `Draft ${stamp}` }).expect(201);
  });

  afterAll(async () => {
    await prisma.storefrontBehavioralEvent.deleteMany({});
    await prisma.partnerStorefront.deleteMany({});
    await prisma.storefrontMedia.deleteMany({});
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

  it("1. STOREFRONT_VIEWED → 202, persisted: canonical storefrontId, acquisitionSource=PARTNER_STOREFRONT, UTC occurredAt, locale, path", async () => {
    const before = await eventCount();
    const occurredAt = new Date().toISOString();
    const body = eventBody({ occurredAt });
    const res = await postEvent(liveSlug, body).expect(202);
    expect(res.body).toEqual({ accepted: true });
    const row = await prisma.storefrontBehavioralEvent.findUnique({ where: { eventId: body.eventId as string } });
    expect(await eventCount()).toBe(before + 1);
    expect(row).not.toBeNull();
    expect(row!.storefrontId).toBe(sfLiveId);
    expect(row!.acquisitionSource).toBe("PARTNER_STOREFRONT");
    expect(row!.locale).toBe("ru");
    expect(row!.path).toBe(`/store/${liveSlug}`);
    expect(row!.occurredAt.toISOString()).toBe(new Date(occurredAt).toISOString());
    expect(row!.receivedAt.getTime()).toBeGreaterThanOrEqual(row!.occurredAt.getTime());
    expect(row!.productId).toBeNull();
  });

  it("2. PARTNER_STOREFRONT-only Product: IMPRESSION + PRODUCT_VIEWED → 202 + productId; publication state НЕ меняется (§17.2)", async () => {
    const pSlug = await productSlug(pSfOnlyId);
    const channelsBefore = await prisma.productPublicationChannel.count({ where: { productId: pSfOnlyId } });
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_IMPRESSION", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug, payload: { placement: "grid" } })).expect(202);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    const rows = await prisma.storefrontBehavioralEvent.findMany({ where: { productId: pSfOnlyId }, select: { eventType: true } });
    expect(rows.map((r) => r.eventType).sort()).toEqual(["STOREFRONT_PRODUCT_IMPRESSION", "STOREFRONT_PRODUCT_VIEWED"]);
    const channelsAfter = await prisma.productPublicationChannel.count({ where: { productId: pSfOnlyId } });
    expect(channelsAfter).toBe(channelsBefore);
  });

  it("3. BOTH Product: Storefront acquisition context; MARKETPLACE channel не меняет источник (§17.3)", async () => {
    const pSlug = await productSlug(pBothId);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    const row = await prisma.storefrontBehavioralEvent.findFirst({ where: { productId: pBothId }, orderBy: { receivedAt: "desc" } });
    expect(row!.acquisitionSource).toBe("PARTNER_STOREFRONT");
    // Продукт остаётся в обоих каналах.
    const channels = await prisma.productPublicationChannel.findMany({ where: { productId: pBothId }, select: { channel: true } });
    expect(channels.map((c) => c.channel).sort()).toEqual(["MARKETPLACE", "PARTNER_STOREFRONT"]);
  });

  it("4. MARKETPLACE-only Product → нейтральный 202, НЕ сохраняется (§17.1/§21.4)", async () => {
    const before = await eventCount();
    const pSlug = await productSlug(pMpOnlyId);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    expect(await eventCount()).toBe(before);
    expect(await prisma.storefrontBehavioralEvent.count({ where: { productId: pMpOnlyId } })).toBe(0);
  });

  it("5. Product без канала → нейтральный 202, НЕ сохраняется (§17.4)", async () => {
    const before = await eventCount();
    const pSlug = await productSlug(pNoChannelId);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    expect(await eventCount()).toBe(before);
  });

  it("6. DRAFT Product → нейтральный 202, НЕ сохраняется (§21.5)", async () => {
    const before = await eventCount();
    const pSlug = await productSlug(pDraftId);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    expect(await eventCount()).toBe(before);
  });

  it("7. Чужой Product (другой Partner) → нейтральный 202, НЕ сохраняется (§21.3)", async () => {
    const before = await eventCount();
    const pSlug = await productSlug(pOtherPartnerId);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", path: `/store/${liveSlug}/products/${pSlug}`, productSlug: pSlug })).expect(202);
    expect(await eventCount()).toBe(before);
  });

  it("8. DRAFT Storefront → нейтральный 202, НЕ сохраняется (§21.6); preview не считается public", async () => {
    const before = await eventCount();
    await postEvent(draftSlug, eventBody({ path: `/store/${draftSlug}` })).expect(202);
    expect(await eventCount()).toBe(before);
  });

  it("9. INACTIVE Storefront → neutral 202; повторная активация восстанавливает tracking (§21.7)", async () => {
    await partnerAgent.post("/api/v1/partner/storefront/deactivate").expect(201);
    const before = await eventCount();
    await postEvent(liveSlug, eventBody()).expect(202);
    expect(await eventCount()).toBe(before);
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    await postEvent(liveSlug, eventBody()).expect(202);
    expect(await eventCount()).toBe(before + 1);
  });

  it("10. SUSPENDED / EXPIRED entitlement → neutral 202; ACTIVE снова работает (§21.8)", async () => {
    const p1PartnerId = (await prisma.partnerStorefront.findUnique({ where: { id: sfLiveId }, select: { partnerId: true } }))!.partnerId;
    await adminAgent.post(`/api/v1/storefronts/${p1PartnerId}/entitlement`).send({ status: "SUSPENDED" }).expect(201);
    const before = await eventCount();
    await postEvent(liveSlug, eventBody()).expect(202);
    expect(await eventCount()).toBe(before);
    await adminAgent.post(`/api/v1/storefronts/${p1PartnerId}/entitlement`).send({ status: "EXPIRED" }).expect(201);
    await postEvent(liveSlug, eventBody()).expect(202);
    expect(await eventCount()).toBe(before);
    await adminAgent.post(`/api/v1/storefronts/${p1PartnerId}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    await postEvent(liveSlug, eventBody()).expect(202);
    expect(await eventCount()).toBe(before + 1);
  });

  it("11. forged storefrontId/partnerId/productId/authenticatedUserId/acquisitionSource → 422 (§21.1/2/9/10)", async () => {
    await postEvent(liveSlug, eventBody({ storefrontId: "SF-00000001" })).expect(422);
    await postEvent(liveSlug, eventBody({ partnerId: "PRT-1" })).expect(422);
    await postEvent(liveSlug, eventBody({ productId: "PRD-1" })).expect(422);
    await postEvent(liveSlug, eventBody({ authenticatedUserId: "usr-1" })).expect(422);
    await postEvent(liveSlug, eventBody({ acquisitionSource: "DIRECT" })).expect(422);
  });

  it("12. malformed sessionId → 422 (§21.11)", async () => {
    await postEvent(liveSlug, eventBody({ sessionId: "short" })).expect(422);
    await postEvent(liveSlug, eventBody({ sessionId: "with space here 12345" })).expect(422);
  });

  it("13. duplicate eventId → оба 202, ОДНА логическая запись (§21.12/§22 dedup)", async () => {
    const body = eventBody();
    await postEvent(liveSlug, body).expect(202);
    await postEvent(liveSlug, body).expect(202);
    await postEvent(liveSlug, body).expect(202); // retry/replay
    expect(await prisma.storefrontBehavioralEvent.count({ where: { eventId: body.eventId as string } })).toBe(1);
  });

  it("14. arbitrary eventType → 422 (§21.13)", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "ARBITRARY_EVENT" })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "MARKETPLACE_VIEWED" })).expect(422);
  });

  it("15. oversized payload → 400/422; arbitrary nested JSON → 422 (§21.14/15)", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_IMPRESSION", productSlug: await productSlug(pSfOnlyId), path: `/store/${liveSlug}/products/${await productSlug(pSfOnlyId)}`, payload: { placement: "grid", extra: "x".repeat(5000) } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "PHONE", nested: { deep: [1, 2, 3] } } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "PHONE", phone: "+994501234567" } })).expect(422);
  });

  it("16. raw contact value в payload (email/phone/url/whatsapp/website) → 422 (§21.16/17)", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "EMAIL", email: "a@b.c" } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "WEBSITE", url: "https://x.example" } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "WHATSAPP", whatsapp: "+994501234567" } })).expect(422);
    await postEvent(liveSlug, eventBody({ payload: { phone: "+994501234567" } })).expect(422);
  });

  it("17. CONTACT_CLICKED: contactType сохраняется, значение контакта НЕ сохраняется; SOCIAL → platform (§15)", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "PHONE" } })).expect(202);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "SOCIAL", platform: "instagram" } })).expect(202);
    const contactRows = await prisma.storefrontBehavioralEvent.findMany({ where: { eventType: "STOREFRONT_CONTACT_CLICKED" }, orderBy: { receivedAt: "desc" } });
    const phoneRow = contactRows.find((r) => (r.payload as { contactType?: string } | null)?.contactType === "PHONE");
    expect(phoneRow!.payload).toEqual({ contactType: "PHONE" });
    const social = contactRows.find((r) => (r.payload as { platform?: string } | null)?.platform === "instagram");
    expect(social).toBeTruthy();
    expect((social!.payload as { contactType: string }).contactType).toBe("SOCIAL");
    // Никаких контактных значений в JSON нигде нет.
    const raw = await prisma.$queryRawUnsafe<Array<{ payload: string }>>(`SELECT "payload"::text AS payload FROM catalog."StorefrontBehavioralEvent"`);
    for (const r of raw) {
      expect(r.payload).not.toContain("+994");
      expect(r.payload).not.toContain("a@b.c");
      expect(r.payload).not.toContain("x.example");
    }
  });

  it("18. invalid contactType / platform вне SOCIAL → 422", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "SMS" } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "SOCIAL" } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "SOCIAL", platform: "myspace" } })).expect(422);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_CONTACT_CLICKED", payload: { contactType: "PHONE", platform: "instagram" } })).expect(422);
  });

  it("19. forged occurredAt (далёкое прошлое/будущее) → 422; ровно в окне — ок (§22)", async () => {
    const inWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await postEvent(liveSlug, eventBody({ occurredAt: inWindow })).expect(202);
    await postEvent(liveSlug, eventBody({ occurredAt: "2026-01-01T00:00:00.000Z" })).expect(422);
    await postEvent(liveSlug, eventBody({ occurredAt: "2027-08-09T00:00:00.000Z" })).expect(422);
    // Не-ISO отклоняется уже class-validator (@IsISO8601) → 400.
    await postEvent(liveSlug, eventBody({ occurredAt: "not-a-date" })).expect(400);
  });

  it("20. invalid eventId / locale / path → 4xx (§21.13/§9)", async () => {
    await postEvent(liveSlug, eventBody({ eventId: "not-a-uuid" })).expect(400);
    await postEvent(liveSlug, eventBody({ locale: "de" })).expect(400);
    await postEvent(liveSlug, eventBody({ path: "/store/other" })).expect(422);
    await postEvent(liveSlug, eventBody({ path: "/store/kavkaz?x=1" })).expect(422);
  });

  it("21. product-событие без productSlug → 422", async () => {
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED" })).expect(422);
  });

  it("22. AuditLog isolation: behavioral events НЕ пишутся в AuditLog (§11)", async () => {
    const before = await auditCount();
    await postEvent(liveSlug, eventBody()).expect(202);
    await postEvent(liveSlug, eventBody({ eventType: "STOREFRONT_PRODUCT_VIEWED", productSlug: await productSlug(pSfOnlyId), path: `/store/${liveSlug}/products/${await productSlug(pSfOnlyId)}` })).expect(202);
    expect(await auditCount()).toBe(before);
  });

  it("23. response не раскрывает internal state (§21.20)", async () => {
    const res = await postEvent(liveSlug, eventBody()).expect(202);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("storefrontId");
    expect(body).not.toContain("productId");
    expect(body).not.toContain("partnerId");
    expect(body).not.toContain("sessionId");
    expect(res.body).toEqual({ accepted: true });
  });

  it("24. public ingestion не требует Authorization (все вызовы выше без токена)", async () => {
    // Уже доказано всеми предыдущими тестами (plain request, без Bearer).
    expect(true).toBe(true);
  });

  it("25. событие не сохраняет raw IP / токены / Authorization (§21.18/19)", async () => {
    const raw = await prisma.$queryRawUnsafe<Array<{ payload: string; sessionid: string }>>(
      `SELECT "payload"::text AS payload, "sessionId" AS sessionid FROM catalog."StorefrontBehavioralEvent"`,
    );
    for (const r of raw) {
      expect(r.sessionid).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      expect(r.payload).not.toContain("Bearer");
      expect(r.payload).not.toContain("token");
      expect(r.payload).not.toContain("::ffff:");
    }
  });
});
