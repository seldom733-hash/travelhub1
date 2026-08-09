/**
 * E2E Phase 1 Step 1.5 — Public Catalog Read Foundation (26 обязательных
 * доказательств §22).
 *
 * Главный invariant:
 *   PUBLIC → только approved + PUBLISHED version
 *   PUBLIC ✕ DRAFT / ProductDraft N+1 / SUBMITTED / IN_REVIEW / moderation snapshot
 *   PUBLIC ✕ staged (DRAFT) media / storage keys / private S3 info / internal Partner/CRM
 *
 * Storage: изолированный test MinIO (test/e2e.minio.ts), bucket *-test.
 * Test DB: изолированная (test/e2e.env.ts) — dev/prod не затрагиваются.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import sharp from "sharp";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { Prisma } from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { ProductStatus, ProductType, RoleCode } from "../src/generated/prisma/enums";
import { startTestMinIO, stopTestMinIO } from "./e2e.minio";

interface PublicMediaRow {
  id: string;
  status: string;
  isPrimary: boolean;
}

interface PublicProductCardRow {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  type: string;
  category: { id: string; slug: string; title: string } | null;
  primaryImage: { id: string; thumbUrl: string; largeUrl: string } | null;
  priceFrom: string | null;
  currency: string | null;
  pricingUnit: string;
  availabilitySummary: { availableFrom: string | null; datesCount: number; totalSlots: number; totalBooked: number; totalReserved: number } | null;
  /** Step 1.11: seller-safe проекция (никогда raw CRM Partner). */
  seller: {
    publicId: string;
    displayName: string | null;
    visibilityMode: string;
    verified: boolean;
    memberSince: string;
    countryCode: string | null;
    cityCode: string | null;
  } | null;
  publishedAt: string;
}

interface PublicDetailRow {
  product: {
    id: string;
    code: string;
    slug: string;
    title: string;
    description: string | null;
    type: string;
    category: { id: string; slug: string; title: string } | null;
    attributes: Record<string, unknown> | null;
    tariffs: Array<{ id: string; name: string; price: string; currency: string }>;
    priceFrom: string | null;
    currency: string | null;
    pricingUnit: string;
    availability: { availableFrom: string | null; datesCount: number; totalSlots: number; totalBooked: number; totalReserved: number } | null;
    seller: {
      publicId: string;
      displayName: string | null;
      visibilityMode: string;
      verified: boolean;
      memberSince: string;
      countryCode: string | null;
      cityCode: string | null;
    } | null;
    publishedAt: string;
    version: number;
  };
  media: PublicMediaRow[];
}

const jpeg = () =>
  sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 20, g: 160, b: 90 } } })
    .jpeg()
    .toBuffer();

describe("Phase 1 Step 1.5 — Public Catalog Read Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; partners: string[]; categories: string[] } = {
    users: [],
    products: [],
    partners: [],
    categories: [],
  };
  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; partnerId: string | null; permissions: string[] } };
  };
  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let partner1Agent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let partner1Id: string;

  /** Категория с filterable attributes (days/language) + media policy (minImages 1). */
  let filterCatId: string;
  let filterCatSlug: string;
  /** Категория БЕЗ обязательной media (для архив/список проверок). */
  let lightCatId: string;
  let lightCatSlug: string;

  const publicGet = (path: string) => request(app.getHttpServer()).get(`/api/v1${path}`);
  const publicList = (query: Record<string, unknown> = {}) => publicGet("/public/products").query(query);
  const publicDetail = (idOrSlug: string) => publicGet(`/public/products/${idOrSlug}`);

  beforeAll(async () => {
    await startTestMinIO();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    // Step 1.5: qs (extended) query parser — вложенные f[days]=7 фильтры public catalog.
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: string) => void }).set("query parser", "extended");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `PubCat Partner 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;

    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `pubcatpartner${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body;
    created.users.push(u1.id);
    partner1Agent = await agent((await login(`pubcatpartner${stamp}`, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `pubcatmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    modAgent = await agent((await login(`pubcatmod${stamp}`, "modpass123")).accessToken);

    filterCatSlug = `pub-filter-${Date.now()}`;
    filterCatId = await createCategoryWithPolicy(filterCatSlug, {
      attributes: [
        { key: "days", label: "Days", type: "integer", required: true, min: 1, filterable: true },
        { key: "language", label: "Language", type: "enum", required: true, options: ["en", "ru", "az"], filterable: true },
        { key: "itinerary", label: "Itinerary", type: "text" },
      ],
      availability: { enabled: true, dateRequired: true },
      mediaRequirements: { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg", "image/png"] },
    });

    lightCatSlug = `pub-light-${Date.now()}`;
    lightCatId = await createCategoryWithPolicy(lightCatSlug, {
      attributes: [],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg", "image/png"] },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
    await stopTestMinIO();
  });

  async function createCategoryWithPolicy(slug: string, config: { attributes: unknown[]; availability?: Record<string, unknown>; mediaRequirements?: Record<string, unknown> }): Promise<string> {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `PubCat ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: config.attributes, availability: config.availability, mediaRequirements: config.mediaRequirements })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    return cat.id;
  }

  /** DRAFT Product (с 1 media, primary) в категории с media policy. */
  async function createDraftProduct(agent: ReturnType<typeof request.agent>, title: string, categoryId: string, attrs?: Record<string, unknown>, tariffs?: Array<{ name: string; price: number }>) {
    const res = await agent.post("/api/v1/products").send({ type: "TOUR", title, categoryId, attributes: attrs, tariffs }).expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    if (categoryId === filterCatId) {
      await agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "p.jpg", contentType: "image/jpeg" }).expect(201);
    }
    return product;
  }

  /** Опубликовать через admin (staff lifecycle, controlled publish). */
  async function publishViaAdmin(productId: string) {
    await adminAgent.post(`/api/v1/products/${productId}/publish`).expect(201);
  }

  /** Опубликовать через moderation approve (approved version N+1). */
  async function publishViaModeration(productId: string) {
    const sub = (await partner1Agent.post(`/api/v1/products/${productId}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);
  }

  // ── Proof 1-2: видимость PUBLISHED / невидимость DRAFT ────────────────────

  it("1. anonymous видит PUBLISHED (список + деталь)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub1 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const list = (await publicList().expect(200)).body as { items: PublicProductCardRow[]; total: number };
    expect(list.items.some((c) => c.id === product.id)).toBe(true);
    expect(list.total).toBeGreaterThanOrEqual(1);

    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(detail.product.id).toBe(product.id);
    expect(detail.product.slug).toBeTruthy();
    expect(detail.product.title).toBe(`Pub1 ${stamp}`);
  });

  it("2. DRAFT не виден (не в списке; прямой запрос → 404)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub2 Draft ${stamp}`, filterCatId, { days: 3, language: "en" });
    expect(product.status).toBe("DRAFT");

    const list = (await publicList().expect(200)).body as { items: PublicProductCardRow[] };
    expect(list.items.some((c) => c.id === product.id)).toBe(false);
    await publicDetail(product.id).expect(404);
  });

  // ── Proof 3: SUBMITTED / IN_REVIEW ────────────────────────────────────────

  it("3. SUBMITTED / IN_REVIEW не видны", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub3 Sub ${stamp}`, filterCatId, { days: 3, language: "en" });
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as { id: string };
    // IN_REVIEW.
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);

    const list = (await publicList().expect(200)).body as { items: PublicProductCardRow[] };
    expect(list.items.some((c) => c.id === product.id)).toBe(false);
    await publicDetail(product.id).expect(404);
  });

  // ── Proof 4-5: PUBLISHED N + draft N+1 → public N; approve → N+1 ──────────

  it("4. PUBLISHED N + ProductDraft N+1 → public N (draft не протекает, search не находит N+1)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub4 N ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaModeration(product.id);

    // PARTNER готовит change proposal N+1 (content).
    const draftTitle = `Pub4 N+1 ${stamp}`;
    const patched = (await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: draftTitle, description: "draft only description" }).expect(200)).body as {
      draft: { title: string; version: number };
    };
    expect(patched.draft.title).toBe(draftTitle);

    // Public по-прежнему N.
    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(detail.product.title).toBe(`Pub4 N ${stamp}`);
    expect(detail.product.description).toBeNull();

    // Search не находит draft content (N+1 title/description).
    const search = (await publicList({ q: draftTitle }).expect(200)).body as { items: PublicProductCardRow[]; total: number };
    expect(search.total).toBe(0);
    expect(JSON.stringify(search)).not.toContain(draftTitle);
  });

  it("5. approve N+1 → public N+1 (snapshot/approved version становится published)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub5 N ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaModeration(product.id);

    const draftTitle = `Pub5 N+1 ${stamp}`;
    await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: draftTitle, description: "approved N+1 description" }).expect(200);
    const sub2 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub2.id}/approve`).expect(201);

    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(detail.product.title).toBe(draftTitle);
    expect(detail.product.description).toBe("approved N+1 description");
  });

  // ── Proof 6-8: media — staged скрыта, published видна, нет storage keys ───

  it("6. staged (DRAFT) media не видны; published media видны", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub6 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const before = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(before.media.length).toBe(1);

    // PARTNER стейджит новую media (DRAFT) — public gallery не меняется.
    const up = (await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "staged.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: PublicMediaRow[] };
    expect(up.media[0].status).toBe("DRAFT");

    const after = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(after.media.map((m) => m.id)).toEqual(before.media.map((m) => m.id));
    expect(after.media.some((m) => m.id === up.media[0].id)).toBe(false);
  });

  it("7. published media — СТАБИЛЬНЫЙ public delivery URL в DTO (не signed S3 URL, FIX 1)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub7 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    expect(detail.media.length).toBe(1);
    const m = detail.media[0] as PublicMediaRow & { url: { thumb: string; large: string } };
    expect(m.url.thumb).toBe(`/api/v1/public/media/${m.id}/thumb`);
    expect(m.url.large).toBe(`/api/v1/public/media/${m.id}/large`);
    expect(JSON.stringify(detail)).not.toContain("http");
  });

  it("8. storage keys / secrets отсутствуют в любом public response", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub8 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const list = (await publicList().expect(200)).body;
    const detail = (await publicDetail(product.id).expect(200)).body;
    for (const body of [list, detail]) {
      const raw = JSON.stringify(body);
      // DB storage keys / credentials / internal поля никогда не публикуются.
      expect(raw).not.toContain("originalStorageKey");
      expect(raw).not.toContain("thumbnailStorageKey");
      expect(raw).not.toContain("largeStorageKey");
      expect(raw).not.toContain("secretAccessKey");
      expect(raw).not.toContain("accessKeyId");
      expect(raw).not.toContain("bucket");
      expect(raw).not.toContain("createdById");
      expect(raw).not.toContain("createdBy");
      // FIX 1: signed S3 параметры/endpoint/ключи в контракте отсутствуют.
      expect(raw).not.toContain("X-Amz");
      expect(raw).not.toContain("Signature");
      expect(raw).not.toContain("minio");
      expect(raw).not.toContain("9000");
      expect(raw).not.toContain(".webp");
      expect(raw).not.toContain("/original.");
    }
  });

  // ── Proof 9-10: list/total только published ───────────────────────────────

  it("9+10. list содержит только published; total = только published", async () => {
    const published: string[] = [];
    published.push((await createDraftProduct(partner1Agent, `Pub9a ${stamp}`, lightCatId)).id);
    published.push((await createDraftProduct(partner1Agent, `Pub9b ${stamp}`, lightCatId)).id);
    const draftId = (await createDraftProduct(partner1Agent, `Pub9 Draft ${stamp}`, lightCatId)).id;
    const subId = (await createDraftProduct(partner1Agent, `Pub9 Sub ${stamp}`, lightCatId)).id;
    for (const id of published) await publishViaAdmin(id);
    await partner1Agent.post(`/api/v1/products/${subId}/submit-moderation`).expect(201);

    // Scope по q — assertion не зависит от порядка других тестов/наполнения каталога.
    const list = (await publicList({ q: "Pub9", pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[]; total: number };
    expect(list.items.every((c) => c.id !== draftId && c.id !== subId)).toBe(true);
    expect(list.items.filter((c) => published.includes(c.id))).toHaveLength(2);
    expect(list.total).toBe(list.items.length); // total = только published (draft/sub не считаются)
  });

  // ── Proof 11-12: category / category-specific filters ─────────────────────

  it("11. category filter: ?category=<slug> возвращает только продукты категории", async () => {
    const a = await createDraftProduct(partner1Agent, `Pub11 A ${stamp}`, filterCatId, { days: 2, language: "ru" });
    const b = await createDraftProduct(partner1Agent, `Pub11 B ${stamp}`, lightCatId);
    await publishViaAdmin(a.id);
    await publishViaAdmin(b.id);

    const list = (await publicList({ category: filterCatSlug, pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(list.items.every((c) => c.category?.slug === filterCatSlug)).toBe(true);
    expect(list.items.some((c) => c.id === a.id)).toBe(true);
    expect(list.items.some((c) => c.id === b.id)).toBe(false);
  });

  it("12. category-specific filter: f[days]=7 + f[language]=en (по Category Schema)", async () => {
    const p7 = await createDraftProduct(partner1Agent, `Pub12 Seven ${stamp}`, filterCatId, { days: 7, language: "en" });
    const p3 = await createDraftProduct(partner1Agent, `Pub12 Three ${stamp}`, filterCatId, { days: 3, language: "ru" });
    await publishViaAdmin(p7.id);
    await publishViaAdmin(p3.id);

    const byDays = (await publicList({ category: filterCatSlug, f: { days: "7" } }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(byDays.items.map((c) => c.id)).toEqual([p7.id]);

    const byLang = (await publicList({ category: filterCatSlug, f: { days: "7", language: "en" } }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(byLang.items.map((c) => c.id)).toEqual([p7.id]);

    // Уникальная комбинация: days=3 + language=ru → только p3 (Pub11A имеет days=2).
    const byLangRu = (await publicList({ category: filterCatSlug, f: { days: "3", language: "ru" } }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(byLangRu.items.map((c) => c.id)).toEqual([p3.id]);

    // Невалидный фильтр → контролируемая 422.
    await publicList({ category: filterCatSlug, f: { days: "abc" } }).expect(422);
    // Фильтр без category → 422.
    await publicList({ f: { days: "7" } }).expect(422);
  });

  // ── Proof 13-14: sorting ───────────────────────────────────────────────────

  it("13. supported sorting: price_asc / price_desc / newest", async () => {
    const cheap = await createDraftProduct(partner1Agent, `Pub13 Cheap ${stamp}`, lightCatId, undefined, [{ name: "S", price: 100 }]);
    const pricey = await createDraftProduct(partner1Agent, `Pub13 Pricey ${stamp}`, lightCatId, undefined, [{ name: "L", price: 500 }]);
    await publishViaAdmin(cheap.id);
    await publishViaAdmin(pricey.id);

    const asc = (await publicList({ sort: "price_asc", category: lightCatSlug, pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(asc.items.findIndex((c) => c.id === cheap.id)).toBeLessThan(asc.items.findIndex((c) => c.id === pricey.id));

    const desc = (await publicList({ sort: "price_desc", category: lightCatSlug, pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(desc.items.findIndex((c) => c.id === cheap.id)).toBeGreaterThan(desc.items.findIndex((c) => c.id === pricey.id));

    const newest = (await publicList({ sort: "newest", category: lightCatSlug, pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[] };
    // publishedAt desc: Pricey опубликован позже (второй publish).
    expect(newest.items.findIndex((c) => c.id === pricey.id)).toBeLessThan(newest.items.findIndex((c) => c.id === cheap.id));
  });

  it("14. unsupported sorting → controlled 422", async () => {
    await publicList({ sort: "relevance" }).expect(422);
    await publicList({ sort: "bogus" }).expect(422);
  });

  // ── Proof 15: search не находит draft content ─────────────────────────────

  it("15. search находит только published (не draft content N+1)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub15 Live ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaModeration(product.id);

    const secretTitle = `Pub15 SecretDraft ${stamp}`;
    await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: secretTitle }).expect(200);

    const found = (await publicList({ q: "Pub15 Live" }).expect(200)).body as { items: PublicProductCardRow[]; total: number };
    expect(found.items.some((c) => c.id === product.id)).toBe(true);

    const notFound = (await publicList({ q: "SecretDraft" }).expect(200)).body as { total: number };
    expect(notFound.total).toBe(0);
  });

  // ── Proof 16-17: archive / lifecycle не раскрывается ─────────────────────

  it("16. archive скрывает Product из list/search и прямого PDP (404)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub16 ${stamp}`, lightCatId);
    await publishViaAdmin(product.id);
    expect((await publicDetail(product.id).expect(200)).body.product.title).toBe(`Pub16 ${stamp}`);

    await adminAgent.post(`/api/v1/products/${product.id}/archive`).expect(201);

    const list = (await publicList({ pageSize: 100 }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(list.items.some((c) => c.id === product.id)).toBe(false);
    await publicDetail(product.id).expect(404);
    const search = (await publicList({ q: "Pub16" }).expect(200)).body as { total: number };
    expect(search.total).toBe(0);
  });

  it("17. direct request не раскрывает внутренний lifecycle (единый 404 для DRAFT/SUBMITTED/ARCHIVED)", async () => {
    const draft = await createDraftProduct(partner1Agent, `Pub17 Draft ${stamp}`, lightCatId);
    const sub = await createDraftProduct(partner1Agent, `Pub17 Sub ${stamp}`, lightCatId);
    await partner1Agent.post(`/api/v1/products/${sub.id}/submit-moderation`).expect(201);

    const res1 = await publicDetail(draft.id).expect(404);
    const res2 = await publicDetail(sub.id).expect(404);
    expect(res1.body.message).toBe("Product not found");
    expect(res2.body.message).toBe("Product not found");
  });

  // ── Proof 18: seller-safe projection, raw CRM Partner absent (Step 1.11) ──

  it("18. raw CRM Partner не публикуется; без профиля seller=null, private fields отсутствуют", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub18 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    // Партнёр создан через admin CRM endpoint (без PublicSellerProfile) → идентичность
    // не показывается (seller=null), НЕ выводится raw CRM name.
    expect(detail.product.seller).toBeNull();
    expect(detail.product).not.toHaveProperty("provider");

    const raw = JSON.stringify(detail);
    expect(raw).not.toContain("PubCat Partner 1");
    expect(raw).not.toContain("partnerId");
    expect(raw).not.toContain("customerId");
    expect(raw).not.toContain("contact");
    expect(raw).not.toContain("companyId");
    expect(raw).not.toContain("inn");
    expect(raw).not.toContain("taxId");
    expect(raw).not.toContain("legalName");
    expect(raw).not.toContain("registrationNumber");
  });

  // ── Proof 19-21: RBAC isolation ────────────────────────────────────────────

  it("19. BUYER не получает internal catalog read, но видит public catalog", async () => {
    const buyerUsername = `pubcatbuyer${stamp}`;
    const reg = (await request(app.getHttpServer()).post("/api/v1/auth/register").send({ username: buyerUsername, email: `${buyerUsername}@test.local`, password: "buyerpass123", fullName: "Покупатель" }).expect(201)).body as {
      user: { id: string };
    };
    created.users.push(reg.user.id);
    const buyerAgent = await agent((await login(buyerUsername, "buyerpass123")).accessToken);

    // Internal /products закрыт для BUYER (нет catalog.product.read — Step 1.3 fix).
    await buyerAgent.get("/api/v1/products").expect(403);
    // Public catalog доступен.
    const list = (await buyerAgent.get("/api/v1/public/products").expect(200)).body as { items: unknown[] };
    expect(Array.isArray(list.items)).toBe(true);
  });

  it("20. anonymous не получает internal /products (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/products").expect(401);
    await request(app.getHttpServer()).get("/api/v1/products/some-id").expect(401);
  });

  it("21. anonymous не получает /moderation (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/moderation/submissions").expect(401);
  });

  // ── Proof 22: category API без internal schema fields ─────────────────────

  it("22. category API не отдаёт internal schema/admin fields", async () => {
    const cats = (await publicGet("/public/categories").expect(200)).body as Array<{ id: string; slug: string; title: string }>;
    expect(cats.some((c) => c.slug === filterCatSlug)).toBe(true);
    const rawCats = JSON.stringify(cats);
    expect(rawCats).not.toContain("status");
    expect(rawCats).not.toContain("code");
    expect(rawCats).not.toContain("attributes");
    expect(rawCats).not.toContain("createdById");

    const meta = (await publicGet(`/public/categories/${filterCatSlug}/filters`).expect(200)).body as {
      category: { id: string; slug: string; title: string };
      filters: Array<{ key: string; label: string; type: string; options?: string[]; min?: number }>;
      availability: { enabled: boolean; dateRequired: boolean } | null;
      sort: string[];
    };
    expect(meta.filters.map((f) => f.key)).toEqual(["days", "language"]);
    expect(meta.filters[0]).toEqual({ key: "days", label: "Days", type: "integer", min: 1 });
    expect(meta.filters[1]).toEqual({ key: "language", label: "Language", type: "enum", options: ["en", "ru", "az"] });
    expect(meta.availability).toEqual({ enabled: true, dateRequired: true });
    expect(meta.sort).toEqual(["newest", "price_asc", "price_desc"]);

    // Неизвестная категория → 404.
    await publicGet("/public/categories/no-such-cat").expect(404);
    await publicGet("/public/categories/no-such-cat/filters").expect(404);
  });

  // ── Proof 23: excessive pageSize controlled ───────────────────────────────

  it("23. excessive pageSize контролируется (clamp до 100, без 500)", async () => {
    const res = (await publicList({ pageSize: 1000 }).expect(200)).body as { items: unknown[]; pageSize: number };
    expect(res.pageSize).toBe(100);
    expect(Array.isArray(res.items)).toBe(true);
  });

  // ── Proof 24-25: DTO contracts ────────────────────────────────────────────

  it("24. Product Card DTO contract (точный набор public полей)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub24 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const list = (await publicList().expect(200)).body as { items: Array<Record<string, unknown>> };
    const card = list.items.find((c) => c.id === product.id)!;
    expect(Object.keys(card).sort()).toEqual(
      ["availabilitySummary", "category", "currency", "id", "priceFrom", "pricingUnit", "primaryImage", "seller", "publishedAt", "shortDescription", "slug", "title", "type"].sort(),
    );
  });

  it("25. PDP DTO contract (точный набор public полей, без internal)", async () => {
    const product = await createDraftProduct(partner1Agent, `Pub25 ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const detail = (await publicDetail(product.id).expect(200)).body as { product: Record<string, unknown>; media: Array<Record<string, unknown>> };
    expect(Object.keys(detail.product).sort()).toEqual(
      ["attributes", "availability", "category", "code", "currency", "description", "id", "priceFrom", "pricingUnit", "seller", "publishedAt", "slug", "tariffs", "title", "type", "version"].sort(),
    );
    expect(Object.keys(detail.media[0]).sort()).toEqual(
      ["altText", "caption", "height", "id", "isPrimary", "mimeType", "sortOrder", "type", "url", "width"].sort(),
    );
    const raw = JSON.stringify(detail);
    expect(raw).not.toContain("status");
    expect(raw).not.toContain("draft");
    expect(raw).not.toContain("moderation");
    expect(raw).not.toContain("snapshot");
  });

  // ── FIX 1 (review): Stable Public Media Delivery Contract ────────────────

  it("FIX1-1. published thumb/large доступны anonymous: stable URL → 302 redirect → bytes", async () => {
    const product = await createDraftProduct(partner1Agent, `Fix1a ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const detail = (await publicDetail(product.id).expect(200)).body as PublicDetailRow;
    const m = detail.media[0];

    for (const derivative of ["thumb", "large"] as const) {
      // Анонимный запрос стабильного URL → 302 redirect (delivery layer → signed URL).
      const stable = `/api/v1/public/media/${m.id}/${derivative}`;
      const redir = await request(app.getHttpServer()).get(stable).redirects(0).expect(302);
      const location = redir.headers.location as string;
      expect(location).toMatch(/^https?:\/\//);
      // Following redirect (fetch — реальный HTTP к тестовому MinIO) → bytes.
      const res = await fetch(location);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/webp");
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.length).toBeGreaterThan(100);
    }
  });

  it("FIX1-2. draft/staged media → нейтральный 404", async () => {
    const product = await createDraftProduct(partner1Agent, `Fix1b ${stamp}`, filterCatId, { days: 3, language: "en" });
    // DRAFT продукт + DRAFT media.
    const media = (await partner1Agent.get(`/api/v1/products/${product.id}/media`).expect(200)).body as PublicMediaRow[];
    expect(media[0].status).toBe("DRAFT");
    await request(app.getHttpServer()).get(`/api/v1/public/media/${media[0].id}/thumb`).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/public/media/${media[0].id}/large`).expect(404);
  });

  it("FIX1-3. media ProductDraft N+1 (staged DRAFT) недоступна до approve", async () => {
    const product = await createDraftProduct(partner1Agent, `Fix1c ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    // PARTNER стейджит media N+1 → DRAFT (change proposal ещё не одобрен).
    const up = (
      await partner1Agent
        .post(`/api/v1/products/${product.id}/media`)
        .attach("files", await jpeg(), { filename: "n1.jpg", contentType: "image/jpeg" })
        .expect(201)
    ).body as { media: PublicMediaRow[] };
    expect(up.media[0].status).toBe("DRAFT");
    const stagedId = up.media[0].id;

    await request(app.getHttpServer()).get(`/api/v1/public/media/${stagedId}/thumb`).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/public/media/${stagedId}/large`).expect(404);
  });

  it("FIX1-4. после approve N+1 stable URL выдаёт approved asset", async () => {
    const product = await createDraftProduct(partner1Agent, `Fix1d ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaModeration(product.id);

    // Стейдж N+1 media → DRAFT (недоступна до approve).
    const up = (
      await partner1Agent
        .post(`/api/v1/products/${product.id}/media`)
        .attach("files", await jpeg(), { filename: "n1.jpg", contentType: "image/jpeg" })
        .expect(201)
    ).body as { media: PublicMediaRow[] };
    const stagedId = up.media[0].id;
    await request(app.getHttpServer()).get(`/api/v1/public/media/${stagedId}/large`).expect(404);

    // Approve N+1 (change proposal включает media) → staged media становится PUBLISHED.
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);

    // Stable URL теперь отдаёт approved asset.
    const redir = await request(app.getHttpServer()).get(`/api/v1/public/media/${stagedId}/large`).redirects(0).expect(302);
    expect(redir.headers.location).toMatch(/^https?:\/\//);
  });

  it("FIX1-5. storage key и signed S3 URL не входят в Card/PDP contract", async () => {
    const product = await createDraftProduct(partner1Agent, `Fix1e ${stamp}`, filterCatId, { days: 3, language: "en" });
    await publishViaAdmin(product.id);

    const cardRaw = JSON.stringify((await publicList({ q: "Fix1e" }).expect(200)).body);
    const detailRaw = JSON.stringify((await publicDetail(product.id).expect(200)).body);
    for (const raw of [cardRaw, detailRaw]) {
      expect(raw).not.toContain("X-Amz");
      expect(raw).not.toContain("Signature");
      expect(raw).not.toContain("AWSAccessKeyId");
      expect(raw).not.toContain("minio");
      expect(raw).not.toContain(":9000");
      expect(raw).not.toContain(".webp");
      expect(raw).not.toContain("/original.");
      expect(raw).not.toContain("storageKey");
      expect(raw).not.toContain("https://");
    }
  });

  // ── FIX 2 (review): full-dataset server-side filtering/sorting ────────────

  it("FIX2. >5000 published: полный dataset без silent truncation (sort/filter/pagination/total корректны)", async () => {
    const bulkSlug = `pub-bulk-${stamp}`;
    const bulkCatId = await createCategoryWithPolicy(bulkSlug, {
      attributes: [{ key: "days", label: "Days", type: "integer", required: false, filterable: true }],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });

    // 5004 опубликованных продуктов — превышает прежний two-step scan ceiling (5000):
    // до FIX 2 это была бы контролируемая 422, но НЕкорректная для реального dataset.
    const bulkCount = 5004;
    const products: Array<{
      id: string;
      code: string;
      slug: string;
      title: string;
      type: ProductType;
      status: ProductStatus;
      version: number;
      publishedAt: Date;
      categoryId: string;
      attributes: Prisma.InputJsonValue;
    }> = [];
    for (let i = 0; i < bulkCount; i++) {
      products.push({
        id: `bulk-${stamp}-${i}`,
        code: `PRD-BULK-${stamp}-${i}`,
        slug: `bulk-${stamp}-${i}`,
        title: `Bulk ${i}`,
        type: "TOUR",
        status: "PUBLISHED",
        version: 1,
        publishedAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
        categoryId: bulkCatId,
        attributes: { days: i % 2 === 0 ? 7 : 3 },
      });
    }
    await prisma.product.createMany({ data: products });
    // REVIEW FIX 4: публичная видимость Marketplace требует MARKETPLACE channel.
    // Прямой createMany в тесте обязан сидировать канал так же, как сервис/backfill.
    await prisma.productPublicationChannel.createMany({
      data: products.map((p) => ({ id: `bulk-pc-${stamp}-${p.id}`, productId: p.id, channel: "MARKETPLACE" })),
    });
    await prisma.tariff.createMany({
      data: products.map((p, i) => ({
        id: `bulk-trf-${stamp}-${i}`,
        code: `TRF-BULK-${stamp}-${i}`,
        productId: p.id,
        name: "S",
        price: 100 + i, // детерминированный уникальный тариф → строгий порядок по цене
        currency: "USD",
      })),
    });
    created.products.push(...products.map((p) => p.id));

    // price_asc, страница 1: total = весь dataset, первый — минимальный тариф, строгий рост.
    const p1 = (await publicList({ category: bulkSlug, sort: "price_asc", pageSize: 100, page: 1 }).expect(200)).body as {
      items: PublicProductCardRow[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(p1.total).toBe(bulkCount);
    expect(p1.items).toHaveLength(100);
    expect(p1.items[0].priceFrom).toBe("100.00");
    for (let i = 1; i < p1.items.length; i++) {
      expect(Number(p1.items[i].priceFrom)).toBeGreaterThanOrEqual(Number(p1.items[i - 1].priceFrom));
    }

    // Последняя страница (50 полных + остаток) — без truncation.
    const last = (await publicList({ category: bulkSlug, sort: "price_asc", pageSize: 100, page: 51 }).expect(200)).body as {
      items: PublicProductCardRow[];
      total: number;
    };
    expect(last.items).toHaveLength(4); // 5004 - 50*100
    expect(last.total).toBe(bulkCount);

    // price_asc + attribute filter: полный filtered набор, никакой 422.
    const filt = (await publicList({ category: bulkSlug, sort: "price_asc", f: { days: "7" }, pageSize: 100 }).expect(200)).body as {
      items: PublicProductCardRow[];
      total: number;
    };
    expect(filt.total).toBe(bulkCount / 2);

    // newest + attribute filter, страница 2 — тоже серверно и без truncation.
    const newestF = (await publicList({ category: bulkSlug, sort: "newest", f: { days: "3" }, pageSize: 100, page: 2 }).expect(200)).body as {
      items: PublicProductCardRow[];
      total: number;
    };
    expect(newestF.total).toBe(bulkCount / 2);
    expect(newestF.items).toHaveLength(100);
  });

  // ── Extras: price representation / availability summary / available_from ──

  it("extra. priceFrom/currency/pricingUnit из Catalog tariffs; availability summary из строк Availability", async () => {
    const product = await createDraftProduct(partner1Agent, `PubExtra ${stamp}`, lightCatId, undefined, [
      { name: "S", price: 120.5 },
      { name: "L", price: 90 },
    ]);
    await publishViaAdmin(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/availability`).send({ date: "2026-09-15", slotsTotal: 10 }).expect(201);

    const card = (await publicList({ category: lightCatSlug, q: "PubExtra" }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(card.items[0].priceFrom).toBe("90.00");
    expect(card.items[0].currency).toBe("USD");
    expect(card.items[0].pricingUnit).toBe("unit");
    expect(card.items[0].availabilitySummary).toEqual({ availableFrom: "2026-09-15T00:00:00.000Z", datesCount: 1, totalSlots: 10, totalBooked: 0, totalReserved: 0 });

    // available_from фильтр по discovery-availability.
    const hit = (await publicList({ available_from: "2026-09-01" }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(hit.items.some((c) => c.id === product.id)).toBe(true);
    const miss = (await publicList({ available_from: "2026-10-01" }).expect(200)).body as { items: PublicProductCardRow[] };
    expect(miss.items.some((c) => c.id === product.id)).toBe(false);
  });
});
