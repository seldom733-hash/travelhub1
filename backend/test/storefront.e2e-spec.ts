/**
 * E2E PHASE 1 STEP 1.12.1 (+ REVIEW FIXES) + STEP 1.12.2 — Partner Storefront:
 * foundation, commercial model boundary (entitlement), publication channels,
 * business identity, structured contacts, branding/media, preview.
 *
 * Инварианты:
 *  - explicit provisioning; lifecycle DRAFT → ACTIVE → INACTIVE; ownership только
 *    из actor.partnerId; slug normalized/immutable; race → controlled 409;
 *  - entitlement boundary: PUBLIC activation требует ACTIVE; SUSPENDED/EXPIRED
 *    скрывают публичную витрину (neutral 404) без удаления данных;
 *  - publication channels отделены от lifecycle; Marketplace показывает только
 *    MARKETPLACE-enabled; Storefront — только PARTNER_STOREFRONT-enabled;
 *  - Step 1.12.2: Storefront business identity (businessName + structured contacts
 *    + branding) — Storefront-owned; публикуется ТОЛЬКО в Storefront-контексте
 *    (ACTIVE + entitled); Marketplace (Card/PDP/search) показывает только
 *    PublicSellerProfile projection — contacts/businessName туда не попадают;
 *  - media: private storage, own-scope upload, стабильный public URL только при
 *    ACTIVE+entitled, staged/private не публичны, storage details отсутствуют;
 *  - preview: owner-only signed URL, не публикует витрину; чужой Partner → deny;
 *  - anti-disintermediation Marketplace не ослаблен; аудит; temporal поля.
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
import { startTestMinIO, stopTestMinIO } from "./e2e.minio";

/** 1×1 PNG — валидное изображение для MediaProcessor (sharp). */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; partnerId: string | null; permissions: string[] };
}

interface StorefrontView {
  id: string;
  code: string;
  partnerId: string;
  slug: string;
  status: string;
  entitlementStatus: string;
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  defaultLocale: string;
  countryCode: string | null;
  cityCode: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
  socialLinks: Array<{ platform: string; url: string }> | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  media: Array<{ id: string; kind: string; mimeType: string; width: number | null; height: number | null; createdAt: string }>;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
}

interface PublicStorefront {
  id: string;
  code: string;
  slug: string;
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  defaultLocale: string;
  countryCode: string | null;
  cityCode: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
  socialLinks: Array<{ platform: string; url: string }> | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  media: Array<{ id: string; kind: string; url: string }>;
  seller: { publicId: string; displayName: string | null; visibilityMode: string; verified: boolean } | null;
  activatedAt: string;
}

describe("Phase 1 Step 1.12.1 + 1.12.2 — Partner Storefront (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = {
    users: [] as string[],
    applications: [] as string[],
    partners: [] as string[],
    products: [] as string[],
    categories: [] as string[],
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let partner2Agent: ReturnType<typeof request.agent>;
  let pendingAgent: ReturnType<typeof request.agent>;
  let noPidAgent: ReturnType<typeof request.agent>;

  let partner1Id: string;
  let partner2Id: string;
  let lightCatId: string;
  let p1PublishedId: string;
  let p1Published2Id: string;
  let p1SfOnlyId: string;
  let p1DraftId: string;
  let p1ArchivedId: string;
  let p2PublishedId: string;
  let sf1Id: string;
  let sfLogoId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const ownStorefront = (a: ReturnType<typeof request.agent>) => a.get("/api/v1/partner/storefront");
  const publicStorefront = (slug: string) => request(app.getHttpServer()).get(`/api/v1/public/storefronts/${slug}`);
  const publicSfProducts = (slug: string, qs = "") => request(app.getHttpServer()).get(`/api/v1/public/storefronts/${slug}/products${qs}`);
  const publicSfProductDetail = (slug: string, productSlug: string) =>
    request(app.getHttpServer()).get(`/api/v1/public/storefronts/${slug}/products/${productSlug}`);
  const publicSfMedia = (slug: string, mediaId: string) => request(app.getHttpServer()).get(`/api/v1/public/storefronts/${slug}/media/${mediaId}`);
  const marketplaceProducts = (qs = "") => request(app.getHttpServer()).get(`/api/v1/public/products${qs}`);
  const marketplaceDetail = (idOrSlug: string) => request(app.getHttpServer()).get(`/api/v1/public/products/${idOrSlug}`);

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

  const setChannels = (a: ReturnType<typeof request.agent>, productId: string, channels: string[]) =>
    a.put(`/api/v1/products/${productId}/channels`).send({ channels });

  beforeAll(async () => {
    await startTestMinIO();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `sfmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR }).expect(201)).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`sfmod${stamp}`, "modpass123")).accessToken);

    const buyer = (await adminAgent.post("/api/v1/users").send({ username: `sfbuy${stamp}`, password: "buypass123", roleCode: RoleCode.BUYER }).expect(201)).body as { id: string };
    created.users.push(buyer.id);
    buyerAgent = await agent((await login(`sfbuy${stamp}`, "buypass123")).accessToken);

    const slug = `sf-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `SF ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }], mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false } })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    lightCatId = cat.id;

    const email1 = `sf1${stamp}@test.local`;
    await registerPartner(email1, `SF Partner 1 ${stamp}`, "AZ");
    partnerAgent = await agent((await login(email1, "partnerpass123")).accessToken);
    partner1Id = await approvePartner((await login(email1, "partnerpass123")).accessToken);

    const email2 = `sf2${stamp}@test.local`;
    await registerPartner(email2, `SF Partner 2 ${stamp}`, "GE");
    partner2Agent = await agent((await login(email2, "partnerpass123")).accessToken);
    partner2Id = await approvePartner((await login(email2, "partnerpass123")).accessToken);

    const emailP = `sfp${stamp}@test.local`;
    await registerPartner(emailP, `SF Pending ${stamp}`, "RU");
    pendingAgent = await agent((await login(emailP, "partnerpass123")).accessToken);

    const noPid = (await adminAgent.post("/api/v1/users").send({ username: `sfnopid${stamp}`, password: "nopid123", roleCode: RoleCode.PARTNER }).expect(201)).body as { id: string };
    created.users.push(noPid.id);
    noPidAgent = await agent((await login(`sfnopid${stamp}`, "nopid123")).accessToken);

    // Продукты (default канал — MARKETPLACE).
    p1PublishedId = await createPublishedProduct(partnerAgent, `SF Live ${stamp}`);
    p1Published2Id = await createPublishedProduct(partnerAgent, `SF Live 2 ${stamp}`);
    p2PublishedId = await createPublishedProduct(partner2Agent, `SF Other ${stamp}`);

    await setChannels(partnerAgent, p1PublishedId, ["MARKETPLACE", "PARTNER_STOREFRONT"]).expect(200);
    await setChannels(partnerAgent, p1Published2Id, ["MARKETPLACE", "PARTNER_STOREFRONT"]).expect(200);

    p1SfOnlyId = await createPublishedProduct(partnerAgent, `SF Storefront Only ${stamp}`);
    await setChannels(partnerAgent, p1SfOnlyId, ["PARTNER_STOREFRONT"]).expect(200);

    const draft = (await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `SF Draft ${stamp}`, categoryId: lightCatId, attributes: { days: 1 } }).expect(201)).body.product as { id: string };
    created.products.push(draft.id);
    p1DraftId = draft.id;

    const arch = (await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `SF Arch ${stamp}`, categoryId: lightCatId, attributes: { days: 1 } }).expect(201)).body.product as { id: string };
    created.products.push(arch.id);
    await partnerAgent.post(`/api/v1/products/${arch.id}/submit-moderation`).expect(201);
    const subsArch = (await modAgent.get("/api/v1/moderation/submissions").expect(200)).body as { items: Array<{ id: string; productId: string }> };
    const subArch = subsArch.items.find((s) => s.productId === arch.id)!;
    await modAgent.post(`/api/v1/moderation/submissions/${subArch.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/moderation/submissions/${subArch.id}/approve`).expect(201);
    await adminAgent.post(`/api/v1/products/${arch.id}/archive`).expect(201);
    p1ArchivedId = arch.id;

    // ProductDraft N+1 (change proposal) на опубликованном: live N остаётся
    await partnerAgent.patch(`/api/v1/products/${p1PublishedId}`).send({ title: `SF N+1 draft ${stamp}` }).expect(200);

    // Staged (DRAFT) media на опубликованном продукте — не должна протекать в public
    await prisma.productMedia.create({
      data: {
        productId: p1PublishedId,
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: 100,
        width: 10,
        height: 10,
        sortOrder: 5,
        isPrimary: true,
        status: "DRAFT",
        originalFileName: "staged.jpg",
        originalStorageKey: `sf-staged-${stamp}`,
        largeStorageKey: `sf-staged-lg-${stamp}`,
        thumbnailStorageKey: `sf-staged-th-${stamp}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.storefrontMedia.deleteMany({ where: { storefrontId: sf1Id } });
    await prisma.productMedia.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.partnerStorefront.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.auditLog.deleteMany({ where: { resource: "PartnerStorefront" } });
    await app.close();
    await stopTestMinIO();
  });

  // ── Provisioning & lifecycle ─────────────────────────────────────────────

  it("1. no auto-provisioning: approved PARTNER без витрины → GET 404; явный POST → DRAFT (entitlement NONE); countryCode системная", async () => {
    await ownStorefront(partnerAgent).expect(404);
    const res = await partnerAgent.post("/api/v1/partner/storefront").send({ slug: `live-${stamp}`, businessName: "Кавказ Тур", tagline: "Tag", description: "Desc" }).expect(201);
    const sf = res.body as StorefrontView;
    expect(sf.status).toBe("DRAFT");
    expect(sf.entitlementStatus).toBe("NONE");
    expect(sf.code).toMatch(/^SF-\d{8}$/);
    expect(sf.slug).toBe(`live-${stamp}`);
    expect(sf.partnerId).toBe(partner1Id);
    expect(sf.businessName).toBe("Кавказ Тур");
    // countryCode — системная identity из crm.Partner (заявка AZ), НЕ из body.
    expect(sf.countryCode).toBe("AZ");
    expect(sf.activatedAt).toBeNull();
    expect(sf.media).toEqual([]);
    sf1Id = sf.id;
  });

  it("2. forged countryCode/partnerId/ownerId/status/entitlementStatus/activatedAt в create → 422", async () => {
    await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `forged-${stamp}`, partnerId: partner1Id }).expect(422);
    await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `forged2-${stamp}`, ownerId: partner1Id }).expect(422);
    await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `forged3-${stamp}`, status: "ACTIVE" }).expect(422);
    await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `forged4-${stamp}`, entitlementStatus: "ACTIVE" }).expect(422);
    // countryCode — системная (FIX 2 / Step 1.12.2): body НЕ security source.
    await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `forged5-${stamp}`, countryCode: "DE" }).expect(422);
  });

  it("3. второй storefront того же Partner → 409 (DB unique partnerId; общий P2002-парсер)", async () => {
    const res = await partnerAgent.post("/api/v1/partner/storefront").send({ slug: `second-${stamp}` }).expect(409);
    expect((res.body as { message: string }).message).toContain("already exists");
  });

  it("4. duplicate slug (другой Partner) → 409 (controlled conflict, не raw 500)", async () => {
    const res = await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `live-${stamp}` }).expect(409);
    expect((res.body as { message: string }).message).toContain("already taken");
  });

  it("5. reserved slug → 422", async () => {
    const res = await partner2Agent.post("/api/v1/partner/storefront").send({ slug: "admin" }).expect(422);
    expect((res.body as { message: string }).message).toContain("reserved");
  });

  it("6. invalid slug → 422 (URL-safety/path traversal)", async () => {
    for (const bad of ["../admin", "a/b", "a.b", "привет-мир"]) {
      const res = await partner2Agent.post("/api/v1/partner/storefront").send({ slug: bad }).expect(422);
      expect((res.body as { message: string }).message).toContain("URL-safe");
    }
  });

  it("7. pending PARTNER (partnerId=null) → 403", async () => {
    await pendingAgent.post("/api/v1/partner/storefront").send({ slug: `pend-${stamp}` }).expect(403);
    await ownStorefront(pendingAgent).expect(403);
  });

  it("8. PARTNER без partnerId (сломанная связь) → controlled deny 403", async () => {
    await noPidAgent.post("/api/v1/partner/storefront").send({ slug: `nopid-${stamp}` }).expect(403);
  });

  it("9. BUYER → 403; MODERATOR → 403; ADMIN → 403 (partner-own контракт)", async () => {
    await buyerAgent.post("/api/v1/partner/storefront").send({ slug: `buy-${stamp}` }).expect(403);
    await modAgent.post("/api/v1/partner/storefront").send({ slug: `mod-${stamp}` }).expect(403);
    await adminAgent.post("/api/v1/partner/storefront").send({ slug: `adm-${stamp}` }).expect(403);
  });

  it("10. anonymous management → 401", async () => {
    await request(app.getHttpServer()).get("/api/v1/partner/storefront").expect(401);
    await request(app.getHttpServer()).post("/api/v1/partner/storefront").send({ slug: "x" }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/partner/storefront/activate").expect(401);
  });

  it("11. IDOR: PARTNER B не видит/не правит витрину A (own-scope) → 404", async () => {
    await ownStorefront(partner2Agent).expect(404);
    await partner2Agent.patch("/api/v1/partner/storefront").send({ tagline: "hacked" }).expect(404);
    await partner2Agent.post("/api/v1/partner/storefront/activate").expect(404);
    await partner2Agent.post("/api/v1/partner/storefront/deactivate").expect(404);
  });

  it("12. PATCH slug → 422 (immutable)", async () => {
    const res = await partnerAgent.patch("/api/v1/partner/storefront").send({ slug: "renamed" }).expect(422);
    expect((res.body as { message: string }).message).toContain("Forbidden field(s)");
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.slug).toBe(`live-${stamp}`);
  });

  it("13. anti-disintermediation: контакт в businessName/tagline/description → 422 на PATCH и create", async () => {
    const res1 = await partnerAgent.patch("/api/v1/partner/storefront").send({ businessName: "Кавказ Тур +7 999 123-45-67" }).expect(422);
    expect((res1.body as { message: string }).message).toContain("anti-disintermediation policy");
    const res2 = await partnerAgent.patch("/api/v1/partner/storefront").send({ description: "Напишите нам напрямую: info@off.com" }).expect(422);
    expect((res2.body as { message: string }).message).toContain("anti-disintermediation policy");
    const res3 = await partner2Agent.post("/api/v1/partner/storefront").send({ slug: `bad-${stamp}`, description: "booking.com/h123" }).expect(422);
    expect((res3.body as { message: string }).message).toContain("anti-disintermediation policy");
  });

  // ── Business identity / contacts / branding (Step 1.12.2 §3/§4/§5) ───────

  it("14. own business identity update: businessName + contacts + branding + cityCode (канонический справочник)", async () => {
    const res = await partnerAgent
      .patch("/api/v1/partner/storefront")
      .send({
        businessName: "Кавказ Тур",
        tagline: "Горы Кавказа",
        description: "Официальная витрина партнёра",
        defaultLocale: "az",
        cityCode: "BAKU", // AZ-страна partner1 → BAKU валиден
        publicPhone: "+994 50 123 45 67",
        publicEmail: "hello@kavkaz.example",
        websiteUrl: "https://kavkaz.example",
        whatsapp: "+994501234567",
        socialLinks: [{ platform: "instagram", url: "https://instagram.com/kavkaz" }],
        heroHeading: "Путешествия по Кавказу",
        heroSubheading: "Индивидуальные туры",
        themePreset: "forest",
      })
      .expect(200);
    const sf = res.body as StorefrontView;
    expect(sf.businessName).toBe("Кавказ Тур");
    expect(sf.cityCode).toBe("BAKU");
    expect(sf.countryCode).toBe("AZ");
    expect(sf.publicEmail).toBe("hello@kavkaz.example");
    expect(sf.websiteUrl).toBe("https://kavkaz.example");
    expect(sf.socialLinks).toEqual([{ platform: "instagram", url: "https://instagram.com/kavkaz" }]);
    expect(sf.heroHeading).toBe("Путешествия по Кавказу");
    expect(sf.themePreset).toBe("forest");
  });

  it("15. contact validation: невалидный email/phone/URL/whatsapp/platform → 422; город чужой страны → 422", async () => {
    await partnerAgent.patch("/api/v1/partner/storefront").send({ publicEmail: "not-an-email" }).expect(422);
    await partnerAgent.patch("/api/v1/partner/storefront").send({ publicPhone: "abc" }).expect(422);
    await partnerAgent.patch("/api/v1/partner/storefront").send({ websiteUrl: "javascript:alert(1)" }).expect(422);
    await partnerAgent.patch("/api/v1/partner/storefront").send({ whatsapp: "callme" }).expect(422);
    await partnerAgent.patch("/api/v1/partner/storefront").send({ socialLinks: [{ platform: "myspace", url: "https://x.example" }] }).expect(400);
    // TBILISI — Грузия (partner2), не AZ: город чужой страны для системной country AZ.
    const res = await partnerAgent.patch("/api/v1/partner/storefront").send({ cityCode: "TBILISI" }).expect(422);
    expect((res.body as { message: string }).message).toContain("belongs to");
    // неизвестный cityCode → 422
    await partnerAgent.patch("/api/v1/partner/storefront").send({ cityCode: "NOWHERE" }).expect(422);
  });

  it("16. PATCH countryCode → 422 (системная identity, locale-независима)", async () => {
    const res = await partnerAgent.patch("/api/v1/partner/storefront").send({ countryCode: "RU" }).expect(422);
    expect((res.body as { message: string }).message).toContain("Forbidden field(s)");
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.countryCode).toBe("AZ");
  });

  it("17. invalid defaultLocale → 400; invalid themePreset → 400", async () => {
    await partnerAgent.patch("/api/v1/partner/storefront").send({ defaultLocale: "de" }).expect(400);
    await partnerAgent.patch("/api/v1/partner/storefront").send({ themePreset: "hacked-css" }).expect(400);
  });

  it("18. public GET DRAFT → neutral 404 (создание не публикует автоматически)", async () => {
    await publicStorefront(`live-${stamp}`).expect(404);
  });

  // ── Entitlement boundary (REVIEW FIX 2) ──────────────────────────────────

  it("19. approved Partner БЕЗ entitlement: activate → 403; User/Partner status НЕ заменяют entitlement", async () => {
    const res = await partnerAgent.post("/api/v1/partner/storefront/activate").expect(403);
    expect((res.body as { message: string }).message).toContain("entitlement");
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.status).toBe("DRAFT");
    expect(sf.activatedAt).toBeNull();
  });

  it("20. admin grant entitlement ACTIVE (audited) → activate работает; повторный activate — no-op", async () => {
    await adminAgent.post(`/api/v1/storefronts/${partner1Id}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    const granted = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(granted.entitlementStatus).toBe("ACTIVE");
    expect(granted.status).toBe("DRAFT");

    const res = await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    const sf = res.body as StorefrontView;
    expect(sf.status).toBe("ACTIVE");
    expect(sf.activatedAt).not.toBeNull();
    const again = await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    expect((again.body as StorefrontView).status).toBe("ACTIVE");
  });

  it("21. public GET ACTIVE → 200: businessName/contacts/branding/география; whitelist без partnerId/CRM/entitlementStatus/storage", async () => {
    const res = await publicStorefront(`live-${stamp}`).expect(200);
    const sf = res.body as PublicStorefront;
    expect(sf.slug).toBe(`live-${stamp}`);
    expect(sf.businessName).toBe("Кавказ Тур");
    expect(sf.countryCode).toBe("AZ");
    expect(sf.cityCode).toBe("BAKU");
    expect(sf.publicPhone).toBe("+994 50 123 45 67");
    expect(sf.publicEmail).toBe("hello@kavkaz.example");
    expect(sf.websiteUrl).toBe("https://kavkaz.example");
    expect(sf.socialLinks).toEqual([{ platform: "instagram", url: "https://instagram.com/kavkaz" }]);
    expect(sf.themePreset).toBe("forest");
    expect(sf.activatedAt).not.toBeNull();
    const raw = JSON.stringify(sf);
    for (const forbidden of ["partnerId", "ownerId", "userId", "contactEmail", "contactPhone", "legalName", "taxId", "registrationNumber", "entitlementStatus", "createdById", "storageKey", "bucket", "X-Amz", "signed", "audit"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  // ── Storefront media (Step 1.12.2 §5/§6) ─────────────────────────────────

  it("22. media: upload LOGO own-scope → 201; DRAFT-витрина: public media 404; owner preview signed; чужой Partner preview deny", async () => {
    const res = await partnerAgent
      .post("/api/v1/partner/storefront/media/LOGO")
      .attach("file", PNG_1PX, "logo.png")
      .expect(201);
    const sf = res.body as StorefrontView;
    expect(sf.media.length).toBe(1);
    expect(sf.media[0].kind).toBe("LOGO");
    sfLogoId = sf.media[0].id;

    // Public bytes только ACTIVE + entitled: сейчас ACTIVE+entitled → 302 redirect.
    const pub = await publicSfMedia(`live-${stamp}`, sfLogoId).redirects(0).expect(302);
    expect((pub.headers.location as string).length).toBeGreaterThan(10);

    // Storage details отсутствуют в public JSON.
    const sfPublic = (await publicStorefront(`live-${stamp}`).expect(200)).body as PublicStorefront;
    expect(sfPublic.media).toEqual([{ id: sfLogoId, kind: "LOGO", url: `/api/v1/public/storefronts/${`live-${stamp}`}/media/${sfLogoId}` }]);
    expect(JSON.stringify(sfPublic)).not.toContain("storageKey");

    // Owner preview: signed URL (не публикует витрину, просто байты для владельца).
    const preview = await partnerAgent.get(`/api/v1/partner/storefront/media/${sfLogoId}/preview`).expect(200);
    expect((preview.body as { url: string }).url.length).toBeGreaterThan(10);

    // Чужой Partner (partner2) не получает preview/media чужой витрины (own-scope → 404).
    await partner2Agent.get(`/api/v1/partner/storefront/media/${sfLogoId}/preview`).expect(404);
  });

  it("23. media: чужой Partner upload/delete невозможен (404 own-scope); delete own → 200 и media пропадает из public", async () => {
    await partner2Agent.post("/api/v1/partner/storefront/media/LOGO").attach("file", PNG_1PX, "logo2.png").expect(404);
    await partner2Agent.delete("/api/v1/partner/storefront/media/LOGO").expect(404);
    const del = await partnerAgent.delete("/api/v1/partner/storefront/media/LOGO").expect(200);
    expect((del.body as StorefrontView).media.length).toBe(0);
    await publicSfMedia(`live-${stamp}`, sfLogoId).redirects(0).expect(404);
  });

  it("24. media: HERO upload → 201; replace того же kind обновляет запись (один файл на kind); invalid file → 422", async () => {
    const first = (await partnerAgent.post("/api/v1/partner/storefront/media/HERO").attach("file", PNG_1PX, "hero.png").expect(201)).body as StorefrontView;
    expect(first.media.some((m) => m.kind === "HERO")).toBe(true);
    const heroId = first.media.find((m) => m.kind === "HERO")!.id;
    const second = (await partnerAgent.post("/api/v1/partner/storefront/media/HERO").attach("file", PNG_1PX, "hero2.png").expect(201)).body as StorefrontView;
    const heroes = second.media.filter((m) => m.kind === "HERO");
    expect(heroes.length).toBe(1); // replace, не дубликат
    expect(heroes[0].id).toBe(heroId); // стабильный id/URL сохраняется при replace
    // Invalid file (не изображение) → 422.
    await partnerAgent.post("/api/v1/partner/storefront/media/LOGO").attach("file", Buffer.from("<svg onload=alert(1)></svg>"), "evil.svg").expect(422);
  });

  // ── Product scope + channels (REVIEW FIX 3/4) ─────────────────────────────

  it("25. products витрины: только PUBLISHED + PARTNER_STOREFRONT-enabled своего Partner", async () => {
    const list = (await publicSfProducts(`live-${stamp}`).expect(200)).body as { items: Array<{ id: string }>; total: number };
    const ids = list.items.map((i) => i.id);
    expect(ids).toContain(p1PublishedId);
    expect(ids).toContain(p1Published2Id);
    expect(ids).toContain(p1SfOnlyId);
    expect(ids).not.toContain(p2PublishedId);
    expect(ids).not.toContain(p1DraftId);
    expect(ids).not.toContain(p1ArchivedId);
    expect(list.total).toBe(3);
  });

  it("26. pagination: pageSize=1 → items=1, total по полному dataset=3, детерминированный порядок", async () => {
    const page1 = (await publicSfProducts(`live-${stamp}`, "?page=1&pageSize=1").expect(200)).body as { items: Array<{ id: string }>; total: number };
    const page2 = (await publicSfProducts(`live-${stamp}`, "?page=2&pageSize=1").expect(200)).body as { items: Array<{ id: string }>; total: number };
    expect(page1.items.length).toBe(1);
    expect(page1.total).toBe(3);
    expect(page2.items.length).toBe(1);
    expect(page2.total).toBe(3);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
  });

  it("27. чужой Product (MARKETPLACE-only другого Partner) через storefront → neutral 404", async () => {
    await publicSfProductDetail(`live-${stamp}`, p2PublishedId).expect(404);
  });

  it("28. DRAFT Product → 404; ARCHIVED Product → 404", async () => {
    await publicSfProductDetail(`live-${stamp}`, p1DraftId).expect(404);
    await publicSfProductDetail(`live-${stamp}`, p1ArchivedId).expect(404);
  });

  it("29. ProductDraft N+1 не утёк: storefront PDP показывает live N (не draft title)", async () => {
    const detail = (await publicSfProductDetail(`live-${stamp}`, p1PublishedId).expect(200)).body as { product: { title: string } };
    expect(detail.product.title).toBe(`SF Live ${stamp}`);
    expect(detail.product.title).not.toContain("N+1");
  });

  it("30. staged (DRAFT) media не утекла: storefront и Marketplace PDP media = []", async () => {
    const detail = (await publicSfProductDetail(`live-${stamp}`, p1PublishedId).expect(200)).body as { media: unknown[] };
    expect(detail.media.length).toBe(0);
    const mkt = (await marketplaceDetail(p1PublishedId).expect(200)).body as { media: unknown[] };
    expect(mkt.media.length).toBe(0);
  });

  // ── Marketplace isolation (Step 1.12.2 §4/§13) ───────────────────────────

  it("31. Marketplace projection НЕ содержит Storefront business identity/контакты (isolation = 0 leakage)", async () => {
    const detail = (await marketplaceDetail(p1PublishedId).expect(200)).body as {
      product: { seller: { displayName: string | null; visibilityMode: string } | null };
    };
    expect(detail.product.seller).not.toBeNull();
    const raw = JSON.stringify(detail);
    for (const forbidden of ["Кавказ Тур", "kavkaz", "publicPhone", "publicEmail", "contactEmail", "contactPhone", "websiteUrl", "whatsapp", "telegram", "heroHeading", "themePreset", "legalName", "taxId", "entitlementStatus", "storefront"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("32. seller identity (Step 1.11) остаётся Marketplace identity: PublicSellerProfile projection не изменён", async () => {
    const prop = (await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: "Alias Travel Co" }).expect(201)).body as { id: string };
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);
    const queue = (await modAgent.get("/api/v1/seller-profiles/proposals").expect(200)).body as { items: Array<{ id: string }> };
    const row = queue.items.find((p) => p.id === prop.id)!;
    await modAgent.post(`/api/v1/seller-profiles/proposals/${row.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/seller-profiles/proposals/${row.id}/approve`).send({ approvedVisibilityMode: "VERIFIED_ALIAS" }).expect(201);

    const mkt = (await marketplaceDetail(p1PublishedId).expect(200)).body as { product: { seller: { displayName: string | null; visibilityMode: string } | null } };
    expect(mkt.product.seller!.visibilityMode).toBe("VERIFIED_ALIAS");
    expect(mkt.product.seller!.displayName).toBe("Alias Travel Co");

    // Storefront businessName НЕ перезаписывается seller identity (раздельные identity).
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.businessName).toBe("Кавказ Тур");
    const pub = (await publicStorefront(`live-${stamp}`).expect(200)).body as PublicStorefront;
    expect(pub.businessName).toBe("Кавказ Тур");
  });

  // ── Lifecycle / concurrency / audit / temporal ───────────────────────────

  it("33. deactivate → INACTIVE + deactivatedAt; public → 404 (контакты/медиа недоступны); повторный deactivate — no-op", async () => {
    const heroId = ((await ownStorefront(partnerAgent).expect(200)).body as StorefrontView).media.find((m) => m.kind === "HERO")!.id;
    const res = await partnerAgent.post("/api/v1/partner/storefront/deactivate").expect(201);
    const sf = res.body as StorefrontView;
    expect(sf.status).toBe("INACTIVE");
    expect(sf.deactivatedAt).not.toBeNull();
    await publicStorefront(`live-${stamp}`).expect(404);
    await publicSfProducts(`live-${stamp}`).expect(404);
    // Медиа витрины в INACTIVE тоже публично недоступны (нейтральный 404).
    await publicSfMedia(`live-${stamp}`, heroId).redirects(0).expect(404);
    const again = await partnerAgent.post("/api/v1/partner/storefront/deactivate").expect(201);
    expect((again.body as StorefrontView).status).toBe("INACTIVE");
  });

  it("34. reactivate → ACTIVE, public снова 200, activatedAt обновлён, deactivatedAt null", async () => {
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    const pub = (await publicStorefront(`live-${stamp}`).expect(200)).body as PublicStorefront;
    expect(pub.businessName).toBe("Кавказ Тур");
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.status).toBe("ACTIVE");
    expect(sf.deactivatedAt).toBeNull();
    expect(new Date(sf.activatedAt!).getTime()).toBeGreaterThan(new Date(sf.createdAt).getTime());
  });

  it("35. temporal поля: PATCH меняет updatedAt, но не activatedAt/deactivatedAt", async () => {
    const before = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    await partnerAgent.patch("/api/v1/partner/storefront").send({ tagline: "Обновлённый тег" }).expect(200);
    const after = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(after.updatedAt).not.toBe(before.updatedAt);
    expect(after.activatedAt).toBe(before.activatedAt);
    expect(after.deactivatedAt).toBeNull();
  });

  it("36. concurrent create одного Partner → ровно одна витрина (race безопасен, controlled 409)", async () => {
    const [a, b] = await Promise.all([
      partner2Agent.post("/api/v1/partner/storefront").send({ slug: `race-${stamp}` }),
      partner2Agent.post("/api/v1/partner/storefront").send({ slug: `race-${stamp}` }),
    ]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([201, 409]);
    const view = (await ownStorefront(partner2Agent).expect(200)).body as StorefrontView;
    expect(view.partnerId).toBe(partner2Id);
    expect(view.entitlementStatus).toBe("NONE");
    expect(view.countryCode).toBe("GE"); // системная из заявки
  });

  it("37. audit lifecycle: created/updated/activated/deactivated + entitlement_changed + media_uploaded", async () => {
    const logs = await prisma.auditLog.findMany({ where: { resource: "PartnerStorefront", resourceId: sf1Id }, orderBy: { createdAt: "asc" } });
    const actions = logs.map((l) => l.action);
    for (const expected of ["storefront.created", "storefront.updated", "storefront.activated", "storefront.deactivated", "storefront.entitlement_changed", "storefront.media_uploaded"]) {
      expect(actions).toContain(expected);
    }
    const activated = logs.find((l) => l.action === "storefront.activated")!;
    const deactivated = logs.find((l) => l.action === "storefront.deactivated")!;
    expect((activated.details as { from: string; to: string }).to).toBe("ACTIVE");
    expect((deactivated.details as { from: string; to: string }).to).toBe("INACTIVE");
  });

  // ── Marketplace channel predicate + regression (REVIEW FIX 4) ─────────────

  it("38. Marketplace учитывает MARKETPLACE канал: BOTH и MARKETPLACE-only видны; STOREFRONT-only нет; total корректен", async () => {
    const list = (await marketplaceProducts().expect(200)).body as { items: Array<{ id: string }>; total: number };
    const ids = list.items.map((i) => i.id);
    expect(ids).toContain(p1PublishedId);
    expect(ids).toContain(p2PublishedId);
    expect(ids).not.toContain(p1SfOnlyId);
    expect(list.total).toBe(3);
    await marketplaceDetail(p1SfOnlyId).expect(404);
  });

  it("39. Marketplace search/pagination сохраняют корректность с учётом канала", async () => {
    const page = (await marketplaceProducts("?page=1&pageSize=1").expect(200)).body as { items: unknown[]; total: number };
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(3);
    const q = (await marketplaceProducts(`?q=Storefront%20Only`).expect(200)).body as { items: unknown[]; total: number };
    expect(q.total).toBe(0);
  });

  it("40. Partner Cabinet object scope не сломан", async () => {
    const mine = (await partnerAgent.get("/api/v1/products").expect(200)).body as { items: Array<{ id: string; partnerId: string | null }> };
    for (const p of mine.items) expect(p.partnerId).toBe(partner1Id);
    const other = (await partner2Agent.get("/api/v1/products").expect(200)).body as { items: Array<{ id: string; partnerId: string | null }> };
    for (const p of other.items) expect(p.partnerId).toBe(partner2Id);
  });

  it("41. channel mutation: own-scope, forged чужой product → 403, аудит channels.updated", async () => {
    const forged = await partnerAgent.put(`/api/v1/products/${p2PublishedId}/channels`).send({ channels: ["PARTNER_STOREFRONT"] });
    expect(forged.status).toBe(403);

    await setChannels(partnerAgent, p1SfOnlyId, ["MARKETPLACE", "PARTNER_STOREFRONT"]).expect(200);
    const list = (await marketplaceProducts().expect(200)).body as { items: Array<{ id: string }>; total: number };
    expect(list.items.map((i) => i.id)).toContain(p1SfOnlyId);
    expect(list.total).toBe(4);

    const hist = await prisma.productHistory.findFirst({ where: { productId: p1SfOnlyId, action: "channels.updated" }, orderBy: { createdAt: "desc" } });
    expect(hist).not.toBeNull();
    expect((hist!.fields as { channels: string[] }).channels).toEqual(["MARKETPLACE", "PARTNER_STOREFRONT"]);

    await partnerAgent.put(`/api/v1/products/${p1PublishedId}/channels`).send({ channels: ["MARKETPLACE", "BOGUS"] }).expect(400);
  });

  it("42. entitlement SUSPENDED → public 404 + media 404; EXPIRED → 404; повторный ACTIVE → public 200", async () => {
    await adminAgent.post(`/api/v1/storefronts/${partner1Id}/entitlement`).send({ status: "SUSPENDED" }).expect(201);
    await publicStorefront(`live-${stamp}`).expect(404);
    await publicSfProducts(`live-${stamp}`).expect(404);
    const sf = (await ownStorefront(partnerAgent).expect(200)).body as StorefrontView;
    expect(sf.status).toBe("ACTIVE");
    expect(sf.entitlementStatus).toBe("SUSPENDED");
    const heroId = sf.media.find((m) => m.kind === "HERO")!.id;
    await publicSfMedia(`live-${stamp}`, heroId).redirects(0).expect(404);

    await adminAgent.post(`/api/v1/storefronts/${partner1Id}/entitlement`).send({ status: "EXPIRED" }).expect(201);
    await publicStorefront(`live-${stamp}`).expect(404);

    const before = await prisma.auditLog.count({ where: { resource: "PartnerStorefront", resourceId: sf1Id, action: "storefront.entitlement_changed" } });
    await adminAgent.post(`/api/v1/storefronts/${partner1Id}/entitlement`).send({ status: "EXPIRED" }).expect(201);
    const after = await prisma.auditLog.count({ where: { resource: "PartnerStorefront", resourceId: sf1Id, action: "storefront.entitlement_changed" } });
    expect(after).toBe(before);

    await adminAgent.post(`/api/v1/storefronts/${partner1Id}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    await publicStorefront(`live-${stamp}`).expect(200);
  });

  it("43. partner2: MARKETPLACE-only Product отсутствует даже в собственной entitled ACTIVE витрине", async () => {
    await adminAgent.post(`/api/v1/storefronts/${partner2Id}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    await partner2Agent.post("/api/v1/partner/storefront/activate").expect(201);
    const list = (await publicSfProducts(`race-${stamp}`).expect(200)).body as { items: unknown[]; total: number };
    expect(list.total).toBe(0);
    await publicSfProductDetail(`race-${stamp}`, p2PublishedId).expect(404);
  });
});
