/**
 * E2E PHASE 1 STEP 1.11 — Public Seller Identity & Anti-Disintermediation.
 *
 * Инварианты:
 *  - Marketplace публикует seller-safe проекцию (PublicSellerProfile), НЕ raw CRM Partner;
 *  - default для нового Partner — ANONYMOUS (консервативно);
 *  - PARTNER предлагает, MODERATOR решает (alias/brand/hide); PARTNER не self-approve,
 *    не сам переключает visibilityMode;
 *  - изменения публикуются ТОЛЬКО через APPROVED proposal (no silent overwrite);
 *  - Product content сканируется детерминированным anti-disintermediation детектором
 *    (email/URL/phone/messenger/QR → submit блокируется);
 *  - reason codes EXTERNAL_CONTACT_INFO / EXTERNAL_BOOKING_LINK /
 *    QR_CODE_OR_CONTACT_MEDIA / DISINTERMEDIATION_ATTEMPT фиксируются в решениях.
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

interface SellerView {
  id: string;
  publicId: string;
  partnerId: string;
  status: string;
  visibilityMode: string;
  publicDisplayName: string | null;
  publicDescription: string | null;
  countryCode: string | null;
  cityCode: string | null;
  systemCountryCode: string | null;
  verified: boolean;
  memberSince: string;
  approvedAt: string | null;
  approvedByUsername: string | null;
  version: number;
}

interface ProposalView {
  id: string;
  code: string;
  profileId: string;
  status: string;
  version: number;
  requestedDisplayName: string | null;
  requestedDescription: string | null;
  requestedCityCode: string | null;
  profileCountryCode: string | null;
  requestedVisibilityMode: string;
  approvedVisibilityMode: string | null;
  submittedAt: string | null;
  decisionReason: string | null;
}

interface PublicSeller {
  publicId: string;
  displayName: string | null;
  visibilityMode: string;
  verified: boolean;
  memberSince: string;
  countryCode: string | null;
  cityCode: string | null;
}

describe("Phase 1 Step 1.11 — Public Seller Identity & Anti-Disintermediation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], applications: [] as string[], partners: [] as string[], products: [] as string[], categories: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let partner2Agent: ReturnType<typeof request.agent>;
  let partner1Id: string;
  let lightCatId: string;
  let publishedProductId: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const publicDetail = (idOrSlug: string) => request(app.getHttpServer()).get(`/api/v1/public/products/${idOrSlug}`);
  const publicList = () => request(app.getHttpServer()).get("/api/v1/public/products");

  const getOwnSeller = async (): Promise<{ profile: SellerView | null; latestProposal: ProposalView | null }> => {
    const res = await partnerAgent.get("/api/v1/partner/seller-profile").expect(200);
    return res.body as { profile: SellerView | null; latestProposal: ProposalView | null };
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

    // ── MODERATOR ────────────────────────────────────────────────────────────
    const mod = (await adminAgent.post("/api/v1/users").send({ username: `sellmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR }).expect(201)).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`sellmod${stamp}`, "modpass123")).accessToken);

    // ── Лёгкая категория: media не обязательна (без MinIO в этом spec) ───────
    const slug = `sell-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Sell ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }], mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false } })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    lightCatId = cat.id;

    // ── Партнёр через ПОЛНЫЙ onboarding flow (PartnerCreated → profile via event) ──
    const email = `seller1${stamp}@test.local`;
    const reg = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email,
          password: "partnerpass123",
          firstName: "Прода",
          lastName: "Вец",
          applicantType: "INDIVIDUAL",
          brandName: `Sell Partner 1 ${stamp}`,
          country: "AZ",
          contactEmail: email,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg.user.id);

    partnerAgent = await agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await partnerAgent.get("/api/v1/partner/application").expect(200)).body as { id: string; status: string };
    created.applications.push(appRow.id);
    await partnerAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId = queue.items[0].id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId}/approve`).send({ reason: "ok" }).expect(201)).body as { status: string; partnerId: string };
    expect(approved.status).toBe("APPROVED");
    partner1Id = approved.partnerId;
    created.partners.push(partner1Id);

    // ── Второй партнёр (для IDOR) ─────────────────────────────────────────────
    const email2 = `seller2${stamp}@test.local`;
    const reg2 = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/partner-register")
        .send({
          email: email2,
          password: "partnerpass123",
          firstName: "Втор",
          lastName: "Ой",
          applicantType: "INDIVIDUAL",
          brandName: `Sell Partner 2 ${stamp}`,
          country: "GE",
          contactEmail: email2,
          termsAccepted: true,
        })
        .expect(201)
    ).body as { user: { id: string } };
    created.users.push(reg2.user.id);
    partner2Agent = await agent((await login(email2, "partnerpass123")).accessToken);
    const appRow2 = (await partner2Agent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    created.applications.push(appRow2.id);
    await partner2Agent.post("/api/v1/partner/application/submit").expect(201);
    const queue2 = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const appId2 = queue2.items[0].id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${appId2}/start`).expect(201);
    const approved2 = (await adminAgent.post(`/api/v1/partner/onboarding/review/${appId2}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved2.partnerId);

    // ── Продукт партнёра 1: create → submit → approve → PUBLISHED ────────────
    const prod = (
      await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `Sell Product ${stamp}`, categoryId: lightCatId, attributes: { days: 3 } }).expect(201)
    ).body.product as { id: string };
    created.products.push(prod.id);
    await partnerAgent.post(`/api/v1/products/${prod.id}/submit-moderation`).expect(201);
    const subs = (await modAgent.get("/api/v1/moderation/submissions").expect(200)).body as { items: Array<{ id: string; productId: string }> };
    const sub = subs.items.find((s) => s.productId === prod.id)!;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);
    publishedProductId = prod.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  // ── 1–4: консервативный default + seller-safe public projection ──────────

  it("1. profile создан событийно: ANONYMOUS, verified, SELL-* publicId (не partnerId)", async () => {
    const { profile } = await getOwnSeller();
    expect(profile).not.toBeNull();
    expect(profile!.visibilityMode).toBe("ANONYMOUS");
    expect(profile!.status).toBe("APPROVED");
    expect(profile!.verified).toBe(true);
    expect(profile!.publicId).toMatch(/^SELL-\d{8}$/);
    expect(profile!.publicId).not.toBe(partner1Id);
    expect(profile!.publicDisplayName).toBeNull();
    // FIX 2: профиль с рождения несёт системную country identity (AZ из заявки),
    // cityCode пуст. Locale в API отсутствует — только коды.
    expect(profile!.systemCountryCode).toBe("AZ");
    expect(profile!.countryCode).toBe("AZ");
    expect(profile!.cityCode).toBeNull();
  });

  it("2. raw CRM legalName/phone/email/website отсутствуют в публичном контракте; ANONYMOUS → generic (displayName null)", async () => {
    const detail = (await publicDetail(publishedProductId).expect(200)).body as {
      product: { seller: PublicSeller | null; [k: string]: unknown };
    };
    expect(detail.product.seller).not.toBeNull();
    expect(detail.product.seller!.visibilityMode).toBe("ANONYMOUS");
    expect(detail.product.seller!.displayName).toBeNull(); // generic label рендерит фронтенд
    expect(detail.product.seller!.verified).toBe(true);
    // FIX 2: география — коды (AZ системная, cityCode пока нет); labels нет.
    expect(detail.product.seller!.countryCode).toBe("AZ");
    expect(detail.product.seller!.cityCode).toBeNull();

    const raw = JSON.stringify(detail);
    expect(raw).not.toContain("legalName");
    expect(raw).not.toContain("taxId");
    expect(raw).not.toContain("registrationNumber");
    expect(raw).not.toContain("phone");
    expect(raw).not.toContain("website");
    expect(raw).not.toContain("whatsapp");
    expect(raw).not.toContain("partnerId");
    expect(raw).not.toContain(`Sell Partner 1 ${stamp}`);
    expect(raw).not.toContain("contactEmail");
  });

  it("3. card также отдаёт seller-safe projection", async () => {
    const list = (await publicList().expect(200)).body as { items: Array<{ id: string; seller: PublicSeller | null }> };
    const card = list.items.find((c) => c.id === publishedProductId)!;
    expect(card.seller?.visibilityMode).toBe("ANONYMOUS");
    expect(card.seller?.displayName).toBeNull();
    expect(card.seller?.publicId).toMatch(/^SELL-/);
  });

  // ── 5–8: proposal lifecycle, публикация только после approve ──────────────

  it("4. proposal не публикуется до approve (public остаётся ANONYMOUS)", async () => {
    const prop = (
      await partnerAgent
        .post("/api/v1/partner/seller-profile/proposals")
        .send({ publicDisplayName: "Alias Smoke", publicDescription: "Описание продавца" })
        .expect(201)
    ).body as ProposalView;
    expect(prop.status).toBe("DRAFT");
    expect(prop.requestedVisibilityMode).toBe("VERIFIED_ALIAS");
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);

    const detail = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller } };
    expect(detail.product.seller.visibilityMode).toBe("ANONYMOUS");
    expect(detail.product.seller.displayName).toBeNull();
  });

  it("5. MODERATOR review: start → approve VERIFIED_ALIAS → alias становится публичным", async () => {
    const queue = (await modAgent.get("/api/v1/seller-profiles/proposals").expect(200)).body as { items: ProposalView[] };
    const prop = queue.items.find((p) => p.requestedDisplayName === "Alias Smoke")!;
    expect(prop.status).toBe("SUBMITTED");
    await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/start-review`).expect(201);
    const approved = (await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/approve`).send({ approvedVisibilityMode: "VERIFIED_ALIAS" }).expect(201)).body as ProposalView;
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedVisibilityMode).toBe("VERIFIED_ALIAS");

    const { profile } = await getOwnSeller();
    expect(profile!.visibilityMode).toBe("VERIFIED_ALIAS");
    expect(profile!.publicDisplayName).toBe("Alias Smoke");
    expect(profile!.approvedByUsername).toBe(`sellmod${stamp}`);

    const detail = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller } };
    expect(detail.product.seller.visibilityMode).toBe("VERIFIED_ALIAS");
    expect(detail.product.seller.displayName).toBe("Alias Smoke");
  });

  it("6. PUBLIC_BRAND выдаёт только MODERATOR (approve_brand); публикуется бренд", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: `Brand ${stamp}` }).expect(201)
    ).body as ProposalView;
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);

    // PARTNER не может сам выдать PUBLIC_BRAND (нет approve_brand) → 403.
    await partnerAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/approve`).send({ approvedVisibilityMode: "PUBLIC_BRAND" }).expect(403);

    await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/start-review`).expect(201);
    const approved = (await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/approve`).send({ approvedVisibilityMode: "PUBLIC_BRAND" }).expect(201)).body as ProposalView;
    expect(approved.approvedVisibilityMode).toBe("PUBLIC_BRAND");

    const detail = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller } };
    expect(detail.product.seller.visibilityMode).toBe("PUBLIC_BRAND");
    expect(detail.product.seller.displayName).toBe(`Brand ${stamp}`);
    // Даже PUBLIC_BRAND не раскрывает контакты/юр. данные.
    const raw = JSON.stringify(detail);
    expect(raw).not.toContain("phone");
    expect(raw).not.toContain("contactEmail");
  });

  it("7. PARTNER не может сам переключить visibilityMode (forged requestedVisibilityMode игнорируется)", async () => {
    const prop = (
      await partnerAgent
        .post("/api/v1/partner/seller-profile/proposals")
        .send({ publicDisplayName: "X", requestedVisibilityMode: "PUBLIC_BRAND" })
        .expect(201)
    ).body as ProposalView;
    // DTO whitelist срезает forged поле; сервис хардкодит VERIFIED_ALIAS.
    expect(prop.requestedVisibilityMode).toBe("VERIFIED_ALIAS");
  });

  // ── 9–12: security/IDOR ───────────────────────────────────────────────────

  it("8. PARTNER не может править чужой proposal (IDOR → 403)", async () => {
    const prop = (
      await partner2Agent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: "Other" }).expect(201)
    ).body as ProposalView;
    await partnerAgent.patch(`/api/v1/partner/seller-profile/proposals/${prop.id}`).send({ publicDisplayName: "hacked" }).expect(403);
    // Свой — можно.
    await partner2Agent.patch(`/api/v1/partner/seller-profile/proposals/${prop.id}`).send({ publicDisplayName: "Other v2" }).expect(200);
  });

  it("9. MODERATOR не получает CRM edit rights (POST /partners → 403)", async () => {
    await modAgent.post("/api/v1/partners").send({ name: "Mod Hack" }).expect(403);
  });

  it("10. PARTNER не может self-approve (approve endpoint → 403)", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: "Self" }).expect(201)
    ).body as ProposalView;
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);
    await partnerAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/approve`).send({}).expect(403);
  });

  it("11. hide → идентичность скрыта (seller=null); unhide → снова публична", async () => {
    await modAgent.post(`/api/v1/seller-profiles/${partner1Id}/hide`).expect(201);
    const hidden = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller | null } };
    expect(hidden.product.seller).toBeNull();

    await modAgent.post(`/api/v1/seller-profiles/${partner1Id}/unhide`).expect(201);
    const shown = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller } };
    expect(shown.product.seller).not.toBeNull();
    expect(shown.product.seller.visibilityMode).toBe("PUBLIC_BRAND");
  });

  it("12. hidden/unpublished profile не светится: чужой PARTNER не видит чужие proposal (own-scope)", async () => {
    const mine = (await partnerAgent.get("/api/v1/partner/seller-profile/proposals").expect(200)).body as ProposalView[];
    const other = (await partner2Agent.get("/api/v1/partner/seller-profile/proposals").expect(200)).body as ProposalView[];
    for (const p of mine) expect(p.profileId).not.toBe(other[0]?.profileId);
    // Публичный контур не отдаёт partnerId — direct lookup по нему невозможен.
    const raw = JSON.stringify(await publicDetail(publishedProductId).expect(200));
    expect(raw).not.toContain(partner1Id);
  });

  // ── 23–27: geography независима от locale (FIX 2) ─────────────────────────

  async function proposeAndSubmit(input: Record<string, unknown>): Promise<ProposalView> {
    const prop = (await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send(input).expect(201)).body as ProposalView;
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);
    return prop;
  }

  it("23. город-код из справочника своей страны проходит; approve пишет коды (countryCode=AZ, cityCode=BAKU)", async () => {
    const prop = await proposeAndSubmit({ publicDisplayName: `Geo ${stamp}`, cityCode: "BAKU" });
    expect(prop.requestedCityCode).toBe("BAKU");
    expect(prop.profileCountryCode).toBe("AZ"); // система, не из proposal
    const queue = (await modAgent.get("/api/v1/seller-profiles/proposals").expect(200)).body as { items: ProposalView[] };
    const row = queue.items.find((p) => p.id === prop.id)!;
    await modAgent.post(`/api/v1/seller-profiles/proposals/${row.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/seller-profiles/proposals/${row.id}/approve`).send({ approvedVisibilityMode: "VERIFIED_ALIAS" }).expect(201);

    const { profile } = await getOwnSeller();
    expect(profile!.countryCode).toBe("AZ");
    expect(profile!.cityCode).toBe("BAKU");
    const detail = (await publicDetail(publishedProductId).expect(200)).body as { product: { seller: PublicSeller } };
    expect(detail.product.seller.countryCode).toBe("AZ");
    expect(detail.product.seller.cityCode).toBe("BAKU");
  });

  it("24. cityCode чужой страны отклоняется (TBILISI — GE, партнёр AZ) → 422", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: `WrongCity ${stamp}`, cityCode: "TBILISI" }).expect(201)
    ).body as ProposalView;
    const res = await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(422);
    expect((res.body as { message: string }).message).toContain("TBILISI");
  });

  it("25. неизвестный cityCode отклоняется → 422", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: `NoCity ${stamp}`, cityCode: "NOWHERE" }).expect(201)
    ).body as ProposalView;
    const res = await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(422);
    expect((res.body as { message: string }).message).toContain("NOWHERE");
  });

  it("26. proposal не может подменить системную country identity (forged countryLabel/countryCode игнорируются)", async () => {
    // DTO whitelist срезает countryLabel/countryCode; сервис country не принимает вовсе.
    const prop = (
      await partnerAgent
        .post("/api/v1/partner/seller-profile/proposals")
        .send({ publicDisplayName: `ForgeCountry ${stamp}`, countryLabel: "RU", countryCode: "RU", cityCode: "MOSCOW" })
        .expect(201)
    ) as unknown as { body: ProposalView };
    expect(prop.body.requestedCityCode).toBe("MOSCOW");
    // MOSCOW принадлежит RU, а системная страна партнёра — AZ → submit 422.
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.body.id}/submit`).expect(422);

    // Системная identity не изменилась: партнёр AZ (RU-локали нет в API).
    const { profile } = await getOwnSeller();
    expect(profile!.systemCountryCode).toBe("AZ");
    expect(profile!.countryCode).toBe("AZ");
  });

  it("27. RU locale не превращает country в RU; идентичность — коды, labels в контракте отсутствуют", async () => {
    // Партнёр зарегистрирован с country=AZ. В публичном контракте есть только
    // коды (AZ/BAKU); локализованных labels (Россия/Азербайджан/Баку) нет вовсе —
    // их добавляет клиент по locale (RU/AZ/EN), не сервер.
    const raw = JSON.stringify((await publicDetail(publishedProductId).expect(200)).body);
    expect(raw).toContain('"countryCode":"AZ"');
    expect(raw).toContain('"cityCode":"BAKU"');
    for (const label of ["Россия", "Rusiya", "Russia", "Азербайджан", "Azərbaycan", "Azerbaijan", "Баку", "Bakı", "Baku", "locationLabel"]) {
      expect(raw).not.toContain(label);
    }
  });

  // ── 13–18: anti-disintermediation (deterministic text) ────────────────────

  async function expectSubmitBlocked(description: string): Promise<void> {
    const prod = (
      await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `Bad ${stamp} ${Math.random()}`, categoryId: lightCatId, attributes: { days: 1 }, description }).expect(201)
    ).body.product as { id: string };
    created.products.push(prod.id);
    const res = await partnerAgent.post(`/api/v1/products/${prod.id}/submit-moderation`).expect(422);
    expect((res.body as { message: string }).message).toContain("anti-disintermediation policy");
  }

  it("13. email в Product description → submit заблокирован (EXTERNAL_CONTACT_INFO)", async () => {
    await expectSubmitBlocked("Подробности: напишите на info@offplatform.com");
  });

  it("14. URL/домен → submit заблокирован", async () => {
    await expectSubmitBlocked("Сайт партнёра: https://www.example.org/tours");
  });

  it("15. phone-like → submit заблокирован", async () => {
    await expectSubmitBlocked("Телефон для связи: +7 999 123-45-67");
  });

  it("16. messenger/social → submit заблокирован (DISINTERMEDIATION_ATTEMPT)", async () => {
    await expectSubmitBlocked("Наш WhatsApp: wa.me/79990000000");
  });

  it("17. внешний booking-домен → submit заблокирован (EXTERNAL_BOOKING_LINK)", async () => {
    await expectSubmitBlocked("Бронируйте дешевле на booking.com/h123");
  });

  it("18. чистый контент проходит submit (нет false positive)", async () => {
    const prod = (
      await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `Clean ${stamp}`, categoryId: lightCatId, attributes: { days: 3 }, description: "Тур на 3 дня с завтраками, цена от 100.00 USD" }).expect(201)
    ).body.product as { id: string };
    created.products.push(prod.id);
    await partnerAgent.post(`/api/v1/products/${prod.id}/submit-moderation`).expect(201);
  });

  // ── 19–20: moderation reason codes ────────────────────────────────────────

  it("19. product moderation reject сохраняет reason EXTERNAL_CONTACT_INFO", async () => {
    const prod = (
      await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `Rej ${stamp}`, categoryId: lightCatId, attributes: { days: 1 } }).expect(201)
    ).body.product as { id: string };
    created.products.push(prod.id);
    await partnerAgent.post(`/api/v1/products/${prod.id}/submit-moderation`).expect(201);
    const subs = (await modAgent.get("/api/v1/moderation/submissions").expect(200)).body as { items: Array<{ id: string; productId: string }> };
    const sub = subs.items.find((s) => s.productId === prod.id)!;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);
    const rej = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "EXTERNAL_CONTACT_INFO", comment: "email в описании" }).expect(201)).body as { reasonCode: string };
    expect(rej.reasonCode).toBe("EXTERNAL_CONTACT_INFO");
  });

  it("20. seller proposal reject сохраняет reason DISINTERMEDIATION_ATTEMPT", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: "Disinter" }).expect(201)
    ).body as ProposalView;
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);
    await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/start-review`).expect(201);
    const rej = (
      await modAgent.post(`/api/v1/seller-profiles/proposals/${prop.id}/reject`).send({ reasonCode: "DISINTERMEDIATION_ATTEMPT", comment: "контакт в описании" }).expect(201)
    ).body as ProposalView;
    expect(rej.status).toBe("REJECTED");
    expect(rej.decisionReason).toBe("DISINTERMEDIATION_ATTEMPT");
  });

  it("21. seller description с контактом → proposal submit заблокирован", async () => {
    const prop = (
      await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ publicDisplayName: "Ok", publicDescription: "Пишите напрямую: +7 900 000-00-00" }).expect(201)
    ).body as ProposalView;
    const res = await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(422);
    expect((res.body as { message: string }).message).toContain("anti-disintermediation policy");
  });

  it("22. жёсткий JSON-чек: публичный контракт не содержит private CRM полей вообще", async () => {
    const raw = JSON.stringify(await publicDetail(publishedProductId).expect(200));
    for (const forbidden of ["legalName", "taxId", "registrationNumber", "contactEmail", "contactPhone", "address", "website", "whatsapp", "telegram", "social", "notes", "companyId", "inn", "partnerId"]) {
      expect(raw).not.toContain(forbidden);
    }
  });
});
