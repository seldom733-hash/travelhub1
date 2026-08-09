/**
 * E2E PHASE 1 STEP 1.18A — ANALYTICS READINESS GATE.
 *
 * Доказывает, что факты Phase 1 (Product / Moderation / Partner / Buyer /
 * Seller / Storefront / Behavioral) пригодны для будущей аналитики:
 *  - критические lifecycle transitions имеют real timestamps + actor (не updatedAt);
 *  - история циклов (storefront activate/deactivate, moderation resubmission)
 *    восстановима из immutable history/events/audit;
 *  - canonical IDs поддерживают joins; behavioural raw history стабильна для
 *    заявленных funnels; legacy unknown честно остаётся NULL;
 *  - privacy: в behavioral/event-фундаменте нет PII (email/phone/URL/contact values).
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

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; partnerId: string | null; customerId: string | null; permissions: string[] };
}

describe("Phase 1 Step 1.18A — Analytics readiness (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], applications: [] as string[], partners: [] as string[], products: [] as string[], categories: [] as string[], customers: [] as string[] };

  let adminAgent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let catId: string;
  let partnerId: string;
  let productId: string;
  let sub1Id: string;
  let sfId: string;
  let sfSlug: string;

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

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

  const submitForModeration = async (a: ReturnType<typeof request.agent>, pid: string): Promise<string> => {
    await a.post(`/api/v1/products/${pid}/submit-moderation`).expect(201);
    const subs = (await modAgent.get("/api/v1/moderation/submissions").expect(200)).body as { items: Array<{ id: string; productId: string }> };
    const sub = subs.items.find((s) => s.productId === pid)!;
    return sub.id;
  };

  const approveSubmission = async (subId: string) => {
    await modAgent.post(`/api/v1/moderation/submissions/${subId}/start-review`).expect(201);
    await modAgent.post(`/api/v1/moderation/submissions/${subId}/approve`).expect(201);
  };

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

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `ar-mod-${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR }).expect(201)).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`ar-mod-${stamp}`, "modpass123")).accessToken);

    const slug = `ar-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `AR ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }], mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false } })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    catId = cat.id;

    const email = `ar-${stamp}@test.local`;
    await registerPartner(email, `AR Partner ${stamp}`, "AZ");
    partnerAgent = await agent((await login(email, "partnerpass123")).accessToken);
    partnerId = await approvePartner((await login(email, "partnerpass123")).accessToken);
  });

  afterAll(async () => {
    if (sfId) await prisma.partnerStorefront.deleteMany({ where: { id: sfId } });
    await prisma.productMedia.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.auditLog.deleteMany({ where: { resource: "PartnerStorefront" } });
    await app.close();
    await stopTestMinIO();
  });

  // ── 1. Product create → moderate → publish chronology ─────────────────────

  it("1. Product chronology: createdAt <= submittedAt <= reviewStartedAt <= decidedAt <= publishedAt; history + event", async () => {
    const prod = (await partnerAgent.post("/api/v1/products").send({ type: "TOUR", title: `AR Chrono ${stamp}`, categoryId: catId, attributes: { days: 2 } }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    productId = prod.id;
    const t0 = Date.parse((await prisma.product.findUniqueOrThrow({ where: { id: prod.id }, select: { createdAt: true } })).createdAt.toISOString());

    sub1Id = await submitForModeration(partnerAgent, prod.id);

    const subRow1 = (await modAgent.get(`/api/v1/moderation/submissions/${sub1Id}`).expect(200)).body as { submittedAt: string; reviewStartedAt: string | null; decidedAt: string | null; submittedById: string | null };
    expect(Date.parse(subRow1.submittedAt)).toBeGreaterThanOrEqual(t0);

    await modAgent.post(`/api/v1/moderation/submissions/${sub1Id}/start-review`).expect(201);
    const subRow2 = (await modAgent.get(`/api/v1/moderation/submissions/${sub1Id}`).expect(200)).body as { submittedAt: string; reviewStartedAt: string; decidedAt: string | null };
    expect(Date.parse(subRow2.reviewStartedAt)).toBeGreaterThanOrEqual(Date.parse(subRow2.submittedAt));

    await modAgent.post(`/api/v1/moderation/submissions/${sub1Id}/approve`).expect(201);
    const subRow3 = (await modAgent.get(`/api/v1/moderation/submissions/${sub1Id}`).expect(200)).body as { decidedAt: string; status: string };
    expect(subRow3.status).toBe("APPROVED");

    const live = (await prisma.product.findUniqueOrThrow({ where: { id: prod.id }, select: { publishedAt: true, status: true, version: true } })) as { publishedAt: Date | null; status: string; version: number };
    expect(live.status).toBe("PUBLISHED");
    expect(live.publishedAt).not.toBeNull();
    expect(Date.parse(live.publishedAt!.toISOString())).toBeGreaterThanOrEqual(Date.parse(subRow3.decidedAt));

    // Immutable history chain: created → moderation.submitted → ... → publish
    const history = await prisma.productHistory.findMany({ where: { productId: prod.id }, orderBy: { createdAt: "asc" }, select: { action: true, createdAt: true } });
    const actions = history.map((h) => h.action);
    expect(actions).toContain("created");
    expect(actions).toContain("moderation.submitted");
    expect(actions).toContain("publish");
    for (let i = 1; i < history.length; i++) expect(Date.parse(history[i].createdAt.toISOString())).toBeGreaterThanOrEqual(Date.parse(history[i - 1].createdAt.toISOString()));

    // Canonical ProductPublished event (outbox) — atomic fact record
    const event = await prisma.outboxEvent.findFirst({ where: { eventType: "ProductPublished", aggregateId: prod.id }, select: { createdAt: true, payload: true, actor: true } });
    expect(event).not.toBeNull();
    expect(Date.parse(event!.createdAt.toISOString())).toBeGreaterThanOrEqual(Date.parse(subRow3.decidedAt));
    expect((event!.payload as Record<string, unknown>).productId).toBe(prod.id);
  });

  // ── 2. Change proposal / resubmission chain (previousSubmissionId) ────────

  it("2. Change proposal chronology: draft N+1 → submission 2 с previousSubmissionId; live version инкрементится", async () => {
    await partnerAgent.patch(`/api/v1/products/${productId}`).send({ title: `AR N+1 ${stamp}` }).expect(200);
    const draft = await prisma.productDraft.findUnique({ where: { productId: productId } });
    expect(draft).not.toBeNull();
    expect(draft!.version).toBeGreaterThanOrEqual(1);

    const sub2Id = await submitForModeration(partnerAgent, productId);
    expect(sub2Id).not.toBe(sub1Id);

    const sub2 = await prisma.moderationSubmission.findUniqueOrThrow({ where: { id: sub2Id }, select: { previousSubmissionId: true, draftVersion: true, submittedAt: true, productVersion: true } });
    expect(sub2.previousSubmissionId).toBe(sub1Id);
    expect(sub2.draftVersion).not.toBeNull();

    const sub1ts = (await prisma.moderationSubmission.findUniqueOrThrow({ where: { id: sub1Id }, select: { decidedAt: true } })).decidedAt;
    expect(Date.parse(sub2.submittedAt.toISOString())).toBeGreaterThanOrEqual(Date.parse(sub1ts!.toISOString()));

    await approveSubmission(sub2Id);
    const live = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { version: true, status: true } });
    expect(live.version).toBeGreaterThan(1);
    expect(live.status).toBe("PUBLISHED");
    const draftAfter = await prisma.productDraft.findUnique({ where: { productId: productId } });
    expect(draftAfter).toBeNull(); // approve применяет draft и удаляет его
  });

  // ── 3. Partner onboarding → approval chronology ───────────────────────────

  it("3. Partner chronology: submittedAt <= reviewedAt; PartnerCreated event; PublicSellerProfile.memberSince; User.partnerId", async () => {
    const appRow = (await prisma.partnerApplication.findFirst({ where: { userId: { in: created.users } }, orderBy: { createdAt: "desc" }, select: { id: true, submittedAt: true, reviewedAt: true, reviewedById: true } })) as { id: string; submittedAt: Date | null; reviewedAt: Date | null; reviewedById: string | null } | null;
    expect(appRow).not.toBeNull();
    expect(appRow!.submittedAt).not.toBeNull();
    expect(appRow!.reviewedAt).not.toBeNull();
    expect(appRow!.reviewedById).not.toBeNull();
    expect(Date.parse(appRow!.reviewedAt!.toISOString())).toBeGreaterThanOrEqual(Date.parse(appRow!.submittedAt!.toISOString()));

    const partnerEvent = await prisma.outboxEvent.findFirst({ where: { eventType: "PartnerCreated", aggregateId: partnerId }, select: { createdAt: true, payload: true } });
    expect(partnerEvent).not.toBeNull();
    const payload = partnerEvent!.payload as Record<string, unknown>;
    expect(payload.partnerId).toBe(partnerId);
    expect(payload.email ?? payload.contactEmail ?? payload.phone).toBeUndefined(); // PII-minimized

    // Catalog projection: PublicSellerProfile создаётся при PartnerCreated
    const profile = await prisma.publicSellerProfile.findUnique({ where: { partnerId }, select: { memberSince: true, visibilityMode: true, createdAt: true } });
    expect(profile).not.toBeNull();
    expect(profile!.visibilityMode).toBe("ANONYMOUS");

    // Привязка User.partnerId — canonical связь (не из body)
    const user = await prisma.user.findFirst({ where: { partnerId }, select: { partnerId: true, role: { select: { code: true } } } });
    expect(user?.partnerId).toBe(partnerId);
  });

  // ── 4. Seller proposal lifecycle ──────────────────────────────────────────

  it("4. Seller proposal chronology: submittedAt <= reviewedAt; approve → profile.approvedAt + approvedById + visibility", async () => {
    const prop = (await partnerAgent.post("/api/v1/partner/seller-profile/proposals").send({ requestedDisplayName: "Alias AR", requestedVisibilityMode: "VERIFIED_ALIAS" }).expect(201)).body as { id: string };
    await partnerAgent.post(`/api/v1/partner/seller-profile/proposals/${prop.id}/submit`).expect(201);
    const queue = (await modAgent.get("/api/v1/seller-profiles/proposals").expect(200)).body as { items: Array<{ id: string; requestedDisplayName: string | null }> };
    const p = queue.items.find((x) => x.id === prop.id)!;
    await modAgent.post(`/api/v1/seller-profiles/proposals/${p.id}/start-review`).expect(201);
    const approved = (await modAgent.post(`/api/v1/seller-profiles/proposals/${p.id}/approve`).send({ approvedVisibilityMode: "VERIFIED_ALIAS" }).expect(201)).body as { reviewedAt: string; status: string };
    expect(approved.status).toBe("APPROVED");

    const row = await prisma.publicSellerProfileProposal.findUniqueOrThrow({ where: { id: prop.id }, select: { submittedAt: true, reviewedAt: true, reviewedById: true } });
    expect(row.submittedAt).not.toBeNull();
    expect(row.reviewedAt).not.toBeNull();
    expect(row.reviewedById).not.toBeNull();
    expect(Date.parse(row.reviewedAt!.toISOString())).toBeGreaterThanOrEqual(Date.parse(row.submittedAt!.toISOString()));

    const profile = await prisma.publicSellerProfile.findUniqueOrThrow({ where: { partnerId }, select: { visibilityMode: true, approvedAt: true, approvedById: true } });
    expect(profile.visibilityMode).toBe("VERIFIED_ALIAS");
    expect(profile.approvedAt).not.toBeNull();
    expect(profile.approvedById).not.toBeNull();
  });

  // ── 5. Storefront cycle proof: activate/deactivate/activate + entitlement ─

  it("5. Storefront cycles восстановимы: activate→deactivate→activate + entitlement NONE→ACTIVE→SUSPENDED→ACTIVE через AuditLog", async () => {
    sfSlug = `ar-sf-${stamp}`;
    const sf = (await partnerAgent.post("/api/v1/partner/storefront").send({ slug: sfSlug, businessName: "AR Travel" }).expect(201)).body as { id: string; status: string };
    sfId = sf.id;
    expect(sf.status).toBe("DRAFT");

    // Entitlement NONE → ACTIVE (ADMIN command, audit from/to)
    await adminAgent.post(`/api/v1/storefronts/${partnerId}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    // DRAFT + ACTIVE → можно activate
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    const sfActive = (await prisma.partnerStorefront.findUniqueOrThrow({ where: { id: sfId }, select: { status: true, activatedAt: true, activatedById: true, deactivatedAt: true } }));
    expect(sfActive.status).toBe("ACTIVE");
    expect(sfActive.activatedAt).not.toBeNull();
    expect(sfActive.activatedById).not.toBeNull();

    // deactivate → INACTIVE + deactivatedAt
    await partnerAgent.post("/api/v1/partner/storefront/deactivate").expect(201);
    const sfInactive = (await prisma.partnerStorefront.findUniqueOrThrow({ where: { id: sfId }, select: { status: true, deactivatedAt: true } }));
    expect(sfInactive.status).toBe("INACTIVE");
    expect(sfInactive.deactivatedAt).not.toBeNull();

    // Повторная активация — новый цикл: activatedAt обновляется, audit хранит оба
    await partnerAgent.post("/api/v1/partner/storefront/activate").expect(201);
    const sfActive2 = (await prisma.partnerStorefront.findUniqueOrThrow({ where: { id: sfId }, select: { status: true, activatedAt: true } }));
    expect(sfActive2.status).toBe("ACTIVE");

    const audit = await prisma.auditLog.findMany({ where: { resource: "PartnerStorefront", resourceId: sfId, action: { in: ["storefront.activated", "storefront.deactivated"] } }, orderBy: { createdAt: "asc" }, select: { action: true, createdAt: true } });
    const actions = audit.map((a) => a.action);
    expect(actions).toEqual(["storefront.activated", "storefront.deactivated", "storefront.activated"]); // все циклы сохранены
    for (let i = 1; i < audit.length; i++) expect(Date.parse(audit[i].createdAt.toISOString())).toBeGreaterThanOrEqual(Date.parse(audit[i - 1].createdAt.toISOString()));

    // Entitlement sequence через AuditLog: NONE→ACTIVE→SUSPENDED→ACTIVE
    await adminAgent.post(`/api/v1/storefronts/${partnerId}/entitlement`).send({ status: "SUSPENDED" }).expect(201);
    await adminAgent.post(`/api/v1/storefronts/${partnerId}/entitlement`).send({ status: "ACTIVE" }).expect(201);
    const entAudit = await prisma.auditLog.findMany({ where: { resource: "PartnerStorefront", resourceId: sfId, action: "storefront.entitlement_changed" }, orderBy: { createdAt: "asc" }, select: { details: true, createdAt: true } });
    const transitions = entAudit.map((e) => `${(e.details as Record<string, unknown>).from}->${(e.details as Record<string, unknown>).to}`);
    expect(transitions).toEqual(["NONE->ACTIVE", "ACTIVE->SUSPENDED", "SUSPENDED->ACTIVE"]); // полная последовательность
  });

  // ── 6. Buyer/Customer creation chronology ─────────────────────────────────

  it("6. Buyer chronology: User.createdAt; CustomerCreated event; CustomerHistory(created); User.customerId == Customer.id", async () => {
    const email = `ar-buyer-${stamp}@test.local`;
    const reg = await request(app.getHttpServer()).post("/api/v1/auth/register").send({ email, password: "buyerpass123", firstName: "Иван", lastName: "Покупателев" }).expect(201);
    const session = reg.body as Session;
    created.users.push(session.user.id);
    expect(session.user.customerId).not.toBeNull();
    created.customers.push(session.user.customerId!);

    const custEvent = await prisma.outboxEvent.findFirst({ where: { eventType: "CustomerCreated" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, payload: true } });
    expect(custEvent).not.toBeNull();
    const payload = custEvent!.payload as Record<string, unknown>;
    expect(payload.customerId).toBe(session.user.customerId);
    expect(payload.email ?? payload.phone).toBeUndefined(); // PII-minimized

    const hist = await prisma.customerHistory.findFirst({ where: { customerId: session.user.customerId!, action: "created" }, select: { createdAt: true } });
    expect(hist).not.toBeNull();

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: session.user.customerId! }, select: { createdAt: true } });
    expect(Date.parse(cust.createdAt.toISOString())).toBeLessThanOrEqual(Date.parse(custEvent!.createdAt.toISOString()) + 5000);
  });

  // ── 7. Marketplace behavioral funnel ──────────────────────────────────────

  it("7. Marketplace funnel: viewed→search→impression→product_viewed в одной session; dedup; productId server-resolved", async () => {
    const sessionId = `ar-mp-session-${stamp}`;
    const base = { sessionId, locale: "ru", path: "/search" };
    const productSlug = (await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } })).slug;
    const now = Date.now();
    const events = [
      { eventType: "MARKETPLACE_VIEWED", occurredAt: new Date(now - 4000).toISOString(), path: "/search" },
      { eventType: "MARKETPLACE_SEARCH_PERFORMED", occurredAt: new Date(now - 3000).toISOString(), path: "/search" },
      { eventType: "MARKETPLACE_PRODUCT_IMPRESSION", occurredAt: new Date(now - 2000).toISOString(), productSlug },
      { eventType: "MARKETPLACE_PRODUCT_VIEWED", occurredAt: new Date(now - 1000).toISOString(), productSlug },
    ];
    for (const e of events) {
      await request(app.getHttpServer()).post("/api/v1/public/marketplace/events").send({ ...base, ...e, eventId: crypto.randomUUID() }).expect(202);
    }
    // dedup: повторная доставка того же eventId → 202, строка не удваивается
    const dupEventId = crypto.randomUUID();
    await request(app.getHttpServer()).post("/api/v1/public/marketplace/events").send({ ...base, ...events[3], eventId: dupEventId }).expect(202);
    await request(app.getHttpServer()).post("/api/v1/public/marketplace/events").send({ ...base, ...events[3], eventId: dupEventId }).expect(202);

    const rows = await prisma.marketplaceBehavioralEvent.findMany({ where: { sessionId }, orderBy: { occurredAt: "asc" }, select: { eventId: true, eventType: true, occurredAt: true, productId: true, acquisitionSource: true } });
    // 4 события + повторная доставка с тем же eventId (засчитана ровно один раз)
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.eventType)).toEqual(["MARKETPLACE_VIEWED", "MARKETPLACE_SEARCH_PERFORMED", "MARKETPLACE_PRODUCT_IMPRESSION", "MARKETPLACE_PRODUCT_VIEWED", "MARKETPLACE_PRODUCT_VIEWED"]);
    expect(new Set(rows.map((r) => r.eventId)).size).toBe(5); // все eventId уникальны
    expect(rows.filter((r) => r.eventId === dupEventId)).toHaveLength(1); // dedup: дубль не удвоился
    // occurredAt не убывает (дубль делит время оригинала); 4 distinct события строго возрастают
    for (let i = 1; i < rows.length; i++) expect(Date.parse(rows[i].occurredAt.toISOString())).toBeGreaterThanOrEqual(Date.parse(rows[i - 1].occurredAt.toISOString()));
    const distinct = rows.filter((r) => r.eventId !== dupEventId);
    for (let i = 1; i < distinct.length; i++) expect(Date.parse(distinct[i].occurredAt.toISOString())).toBeGreaterThan(Date.parse(distinct[i - 1].occurredAt.toISOString()));
    for (const r of rows) expect(r.acquisitionSource).toBe("MARKETPLACE"); // server-authoritative
    for (const r of rows.filter((x) => x.productId)) expect(r.productId).toBe(productId); // server-resolved from slug
  });

  // ── 8. Storefront behavioral funnel ───────────────────────────────────────

  it("8. Storefront funnel: viewed→impression→product_viewed→contact_clicked; contactType без contact value", async () => {
    // Продукт должен быть виден на Storefront (PARTNER_STOREFRONT channel)
    await partnerAgent.put(`/api/v1/products/${productId}/channels`).send({ channels: ["MARKETPLACE", "PARTNER_STOREFRONT"] }).expect(200);
    const productSlug = (await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { slug: true } })).slug;
    const sessionId = `ar-sf-session-${stamp}`;
    const now = Date.now();
    const events = [
      { eventType: "STOREFRONT_VIEWED", occurredAt: new Date(now - 4000).toISOString(), path: `/store/${sfSlug}` },
      { eventType: "STOREFRONT_PRODUCT_IMPRESSION", occurredAt: new Date(now - 3000).toISOString(), productSlug, path: `/store/${sfSlug}` },
      { eventType: "STOREFRONT_PRODUCT_VIEWED", occurredAt: new Date(now - 2000).toISOString(), productSlug, path: `/store/${sfSlug}/products/${productSlug}` },
      { eventType: "STOREFRONT_CONTACT_CLICKED", occurredAt: new Date(now - 1000).toISOString(), productSlug, path: `/store/${sfSlug}/products/${productSlug}`, payload: { contactType: "EMAIL" } },
    ];
    for (const e of events) {
      await request(app.getHttpServer()).post(`/api/v1/public/storefronts/${sfSlug}/events`).send({ ...{ sessionId, locale: "ru" }, ...e, eventId: crypto.randomUUID() }).expect(202);
    }
    const rows = await prisma.storefrontBehavioralEvent.findMany({ where: { sessionId }, orderBy: { occurredAt: "asc" }, select: { eventType: true, occurredAt: true, productId: true, acquisitionSource: true, payload: true, storefrontId: true } });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.eventType)).toEqual(["STOREFRONT_VIEWED", "STOREFRONT_PRODUCT_IMPRESSION", "STOREFRONT_PRODUCT_VIEWED", "STOREFRONT_CONTACT_CLICKED"]);
    for (let i = 1; i < rows.length; i++) expect(Date.parse(rows[i].occurredAt.toISOString())).toBeGreaterThan(Date.parse(rows[i - 1].occurredAt.toISOString()));
    for (const r of rows) {
      expect(r.storefrontId).toBe(sfId);
      expect(r.acquisitionSource).toBe("PARTNER_STOREFRONT");
    }
    const click = rows[3];
    expect((click.payload as Record<string, unknown>).contactType).toBe("EMAIL");
    expect(JSON.stringify(click.payload)).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); // контактное значение не хранится
  });

  // ── 9. Legacy NULL остаётся NULL ──────────────────────────────────────────

  it("9. Legacy NULL не фабрикуется: Category без createdAt остаётся NULL; DRAFT schema без activatedAt", async () => {
    const legacySlug = `ar-legacy-${stamp}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO catalog."Category" ("id", "code", "slug", "title", "status", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'CAT-LEGACY-${stamp}', '${legacySlug}', 'Legacy ${stamp}', 'ACTIVE', NULL, NULL)`,
    );
    const legacy = await prisma.category.findUnique({ where: { slug: legacySlug }, select: { createdAt: true, updatedAt: true } });
    expect(legacy?.createdAt).toBeNull();
    expect(legacy?.updatedAt).toBeNull();

    // Публичный read не триггерит backfill
    await request(app.getHttpServer()).get("/api/v1/public/categories").expect(200);
    const legacyAfter = await prisma.category.findUnique({ where: { slug: legacySlug }, select: { createdAt: true } });
    expect(legacyAfter?.createdAt).toBeNull();
    await prisma.category.deleteMany({ where: { slug: legacySlug } });

    // DRAFT schema: activatedAt == NULL до активации (milestone не происходил)
    const schema = await prisma.categorySchema.create({
      data: { categoryId: catId, version: 99, status: "DRAFT", attributes: { defs: [] }, activatedAt: null },
    });
    const draftSchema = await prisma.categorySchema.findUniqueOrThrow({ where: { id: schema.id }, select: { activatedAt: true } });
    expect(draftSchema.activatedAt).toBeNull();
    await prisma.categorySchema.deleteMany({ where: { id: schema.id } });
  });

  // ── 10. No PII в behavioral/event analytics foundation ───────────────────

  it("10. Privacy: forged email/phone/contact-значения отклоняются (422); behavioral payload не содержит PII", async () => {
    // Marketplace envelope с email — explicit deny
    await request(app.getHttpServer())
      .post("/api/v1/public/marketplace/events")
      .send({ eventType: "MARKETPLACE_VIEWED", eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), sessionId: `pii-${stamp}`, path: "/search", locale: "ru", email: "evil@example.com" })
      .expect(422);
    // Storefront payload с phone-значением — deny
    await request(app.getHttpServer())
      .post(`/api/v1/public/storefronts/${sfSlug}/events`)
      .send({ eventType: "STOREFRONT_CONTACT_CLICKED", eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), sessionId: `pii-${stamp}`, path: `/store/${sfSlug}`, locale: "ru", payload: { contactType: "EMAIL", phone: "+994501234567" } })
      .expect(422);

    const mpCount = await prisma.marketplaceBehavioralEvent.count({ where: { sessionId: `pii-${stamp}` } });
    const sfCount = await prisma.storefrontBehavioralEvent.count({ where: { sessionId: `pii-${stamp}` } });
    expect(mpCount).toBe(0);
    expect(sfCount).toBe(0);

    // Event-фундамент: поведенческие события не содержат contact values / tokens / IP
    const sfRows = await prisma.storefrontBehavioralEvent.findMany({ select: { payload: true } });
    const allPayloads = sfRows.map((r) => JSON.stringify(r.payload ?? {})).join("|");
    expect(allPayloads).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(allPayloads).not.toMatch(/(\+?\d[\d\s-]{8,})/);
    expect(allPayloads).not.toMatch(/password|token|authorization|bearer/i);
  });
});
