/**
 * E2E PHASE 1 STEP 1.10 — Partner Registration & Onboarding.
 *
 * Инвариант: Partner selling capabilities ⇒ approved onboarding ⇒ valid
 * User.partnerId ⇒ existing CRM Partner. Регистрация ≠ approval ≠ Product
 * moderation ≠ Payment/KYC.
 *
 * Покрытие (Step 1.10 §30 + §29 security):
 *   1.  public partner registration → User (PARTNER) + PartnerApplication (DRAFT);
 *   2.  forged role/partnerId/status в partner-register → 422;
 *   3.  no selling access after signup: pending POST /products → 403, list → пусто;
 *   4.  DRAFT создан; own read;
 *   5.  own DRAFT update (version CAS); stale version → 409;
 *   6.  IDOR: applicant не видит очередь/чужие заявки (403); userId → 422;
 *   7.  submit: валидация (terms/legalName COMPANY) → 422; ок → SUBMITTED;
 *   8.  submitted read-only (PATCH → 409);
 *   9-10. review queue: видна ревьюеру, недоступна заявителю;
 *   11. start review → IN_REVIEW;
 *   12. self-approval denied (service-level, multi-role defense);
 *   13-15. approve → CRM Partner create + User.partnerId == Partner.id + Cabinet;
 *   16. rejected: no selling access;
 *   17-18. request changes → редактируемо → re-submit;
 *   19. retry approve — no duplicate Partner (idempotent);
 *   20. concurrent approve/reject — one winner;
 *   21. duplicate business identity (registrationNumber) → reuse, no duplicate;
 *   22. ambiguous brand name — НЕ merge (разные Partner);
 *   23. forged partnerId в PATCH application → 422;
 *   24. legacy PARTNER (createStaff + partnerId) не сломан.
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
import { PartnerOnboardingService } from "../src/security/partner/partner-onboarding.service";
import { ForbiddenError } from "../src/shared/errors";
import { RoleCode } from "../src/generated/prisma/enums";

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; partnerId: string | null; permissions: string[] };
}

interface AppView {
  id: string;
  code: string;
  userId: string;
  status: string;
  applicantType: string;
  brandName: string;
  country: string;
  contactEmail: string;
  registrationNumber: string | null;
  legalName: string | null;
  version: number;
  editable: boolean;
  submittedAt: string | null;
  decisionReason: string | null;
  history: { action: string; to: string | null; comment: string | null }[];
}

describe("Phase 1 Step 1.10 — Partner Registration & Onboarding (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let onboarding: PartnerOnboardingService;

  const stamp = Date.now();
  const created = { users: [] as string[], applications: [] as string[], partners: [] as string[], products: [] as string[] };

  const registerPartner = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/api/v1/auth/partner-register").send(body);

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  /** Валидный минимальный body публичной регистрации. */
  const validBody = (prefix: string, overrides: Record<string, unknown> = {}) => ({
    email: `${prefix}${stamp}@test.local`,
    password: "partnerpass123",
    firstName: "Парт",
    lastName: "Нёров",
    applicantType: "INDIVIDUAL",
    brandName: `Brand ${prefix}`,
    country: "AZ",
    contactEmail: `${prefix}${stamp}@test.local`,
    termsAccepted: true,
    ...overrides,
  });

  const getOwnApp = async (token: string): Promise<AppView> => {
    const res = await agent(token).get("/api/v1/partner/application").expect(200);
    return res.body as AppView;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    onboarding = app.get(PartnerOnboardingService);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partnerApplication.deleteMany({ where: { id: { in: created.applications } } });
    await app.close();
  });

  const trackUser = (id: string) => created.users.push(id);
  const trackApp = (id: string) => created.applications.push(id);
  const trackPartner = (id: string) => created.partners.push(id);
  const trackProduct = (id: string) => created.products.push(id);

  // ── 1-4. Registration → DRAFT, no selling access ───────────────────────────

  it("1. public partner registration: User (PARTNER, ACTIVE) + PartnerApplication (DRAFT)", async () => {
    const res = await registerPartner(validBody("p1")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    expect(session.user.role).toBe(RoleCode.PARTNER);
    expect(session.user.partnerId).toBeNull(); // НЕ активирован

    const row = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(row.partnerId).toBeNull();

    const appRow = await prisma.partnerApplication.findFirstOrThrow({ where: { userId: session.user.id } });
    trackApp(appRow.id);
    expect(appRow.status).toBe("DRAFT");
    expect(appRow.brandName).toBe(`Brand p1`);
    expect(appRow.contactEmail).toBe(`p1${stamp}@test.local`);
    expect(appRow.termsAccepted).toBe(true);
    expect(appRow.code).toMatch(/^APP-\d{8}$/);
  });

  it("2. forged role/partnerId/status/permissions в partner-register → 422", async () => {
    const cases: Record<string, unknown>[] = [
      validBody("r1", { role: "ADMIN" }),
      validBody("r2", { partnerId: "PAR-00000001" }),
      validBody("r3", { customerId: "CUS-00000001" }),
      validBody("r4", { status: "ACTIVE" }),
      validBody("r5", { permissions: ["admin"] }),
      validBody("r6", { roleCode: "OPERATOR" }),
    ];
    for (const body of cases) {
      await registerPartner(body).expect(422);
    }
  });

  it("2b. terms required: termsAccepted=false → 422", async () => {
    await registerPartner(validBody("t1", { termsAccepted: false })).expect(422);
    await registerPartner(validBody("t2", { termsAccepted: undefined })).expect(400);
  });

  it("3. no selling access after signup: pending applicant POST /products → 403; GET /products → пусто", async () => {
    const res = await registerPartner(validBody("p3")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const a = agent(session.accessToken);
    await a.post("/api/v1/products").send({ type: "TOUR", title: "No sale yet" }).expect(403);
    const list = (await a.get("/api/v1/products").expect(200)).body as { items: unknown[] };
    expect(list.items).toEqual([]); // НЕ unrestricted список чужих продуктов
    // Editor-schema (ACTIVE Category Schema) — не selling access: доступна PARTNER
    // и до approve (нужна для формы; Product create при этом заблокирован).
    await a.get("/api/v1/partner/categories/tours/schema").expect(200);
  });

  // ── 5-6. Own DRAFT edit + IDOR ─────────────────────────────────────────────

  it("5. own DRAFT update (version CAS); stale version → 409", async () => {
    const res = await registerPartner(validBody("p5")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const a = agent(session.accessToken);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);

    const updated = (
      await a
        .patch("/api/v1/partner/application")
        .send({ brandName: "Brand p5 v2", website: "https://example.com", version: app0.version })
        .expect(200)
    ).body as AppView;
    expect(updated.brandName).toBe("Brand p5 v2");
    expect(updated.version).toBe(app0.version + 1);

    // Stale edit (старая версия) → 409.
    await a.patch("/api/v1/partner/application").send({ brandName: "Stale edit", version: app0.version }).expect(409);
  });

  it("6. IDOR: заявитель не видит очередь и чужие заявки; userId/partnerId → 422", async () => {
    const a = (await registerPartner(validBody("p6a")).expect(201)).body as Session;
    const b = (await registerPartner(validBody("p6b")).expect(201)).body as Session;
    trackUser(a.user.id);
    trackUser(b.user.id);
    const appA = await getOwnApp(a.accessToken);
    trackApp(appA.id);
    const agentA = agent(a.accessToken);

    // Очередь и review-деталь — только reviewer (403 для заявителя).
    await agentA.get("/api/v1/partner/onboarding/review").expect(403);
    await agentA.get(`/api/v1/partner/onboarding/review/${appA.id}`).expect(403);
    await agentA.post(`/api/v1/partner/onboarding/review/${appA.id}/approve`).send({}).expect(403);
    await agentA.post(`/api/v1/partner/onboarding/review/${appA.id}/reject`).send({ reason: "x" }).expect(403);

    // Mass-assignment / подмена identity в own PATCH → 422.
    const appB = await getOwnApp(b.accessToken);
    trackApp(appB.id);
    await agent(a.accessToken)
      .patch("/api/v1/partner/application")
      .send({ userId: b.user.id, version: appA.version })
      .expect(422);
    await agent(a.accessToken)
      .patch("/api/v1/partner/application")
      .send({ partnerId: "PAR-00000099", version: appA.version })
      .expect(422);
    await agent(a.accessToken).patch("/api/v1/partner/application").send({ status: "APPROVED", version: appA.version }).expect(422);
    await agent(a.accessToken).patch("/api/v1/partner/application").send({ applicantType: "COMPANY", version: appA.version }).expect(422);
    // Чужая заявка не отдаётся через own endpoint (own-scope).
    const own = (await agent(a.accessToken).get("/api/v1/partner/application").expect(200)).body as AppView;
    expect(own.id).toBe(appA.id);
    expect(own.id).not.toBe(appB.id);
  });

  // ── 7-8. Submit + read-only ────────────────────────────────────────────────

  it("7. submit: COMPANY без legalName → 422; валидный → SUBMITTED", async () => {
    const company = (await registerPartner(validBody("p7c", { applicantType: "COMPANY", legalName: undefined })).expect(201)).body as Session;
    trackUser(company.user.id);
    const companyApp = await getOwnApp(company.accessToken);
    trackApp(companyApp.id);
    await agent(company.accessToken).post("/api/v1/partner/application/submit").expect(422); // COMPANY требует legalName

    const ind = (await registerPartner(validBody("p7i")).expect(201)).body as Session;
    trackUser(ind.user.id);
    const indApp = await getOwnApp(ind.accessToken);
    trackApp(indApp.id);
    const submitted = (
      await agent(ind.accessToken).post("/api/v1/partner/application/submit").expect(201)
    ).body as AppView;
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).toBeTruthy();
    void companyApp;
  });

  it("8. submitted read-only: PATCH → 409; повторный submit → 409", async () => {
    const res = await registerPartner(validBody("p8")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const a = agent(session.accessToken);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await a.post("/api/v1/partner/application/submit").expect(201);
    await a.patch("/api/v1/partner/application").send({ brandName: "Submitted edit", version: app0.version + 1 }).expect(409);
    await a.post("/api/v1/partner/application/submit").expect(409);
  });

  // ── 9-12. Review queue + self-approval ─────────────────────────────────────

  it("9. review queue: SUBMITTED заявка видна ревьюеру (ADMIN)", async () => {
    const res = await registerPartner(validBody("p9")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const queue = (await agent(admin.accessToken).get("/api/v1/partner/onboarding/review").expect(200)).body as {
      items: { id: string; userId: string; status: string }[];
    };
    const mine = queue.items.find((i) => i.userId === session.user.id);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe("SUBMITTED");
  });

  it("10. заявитель не может видеть очередь (403) — проверено в тесте 6", () => {
    expect(true).toBe(true); // см. тест 6 (IDOR)
  });

  it("11. start review: SUBMITTED → IN_REVIEW", async () => {
    const res = await registerPartner(validBody("p11")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    const detail = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201)).body as { status: string; reviewedByUsername: string };
    expect(detail.status).toBe("IN_REVIEW");
    expect(detail.reviewedByUsername).toBe("admin");

    // Повторный start тем же ревьюером — retry-safe.
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);
  });

  it("12. self-approval denied (даже multi-role: reviewer.id == applicant.id)", async () => {
    const res = await registerPartner(validBody("p12")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);
    const admin = await login("admin", "admin123");
    await agent(admin.accessToken).post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);

    // Service-level defense: ревьюер = сам заявитель (много-ролевой сценарий).
    const applicantAsReviewer = {
      id: session.user.id,
      username: session.user.username,
      role: RoleCode.ADMIN as string,
      permissions: ["partner.onboarding.review"],
      partnerId: null,
    };
    await expect(onboarding.approveApplication(app0.id, applicantAsReviewer as never, undefined)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  // ── 13-15. Approve → CRM Partner + User.partnerId + Cabinet ───────────────

  it("13-15. approve: создаёт CRM Partner, User.partnerId == Partner.id, партнёр получает Cabinet", async () => {
    const res = await registerPartner(validBody("p13")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);
    const decided = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/approve`).send({ reason: "Документы ок" }).expect(201)).body as {
      status: string;
      partnerId: string;
      partnerCreated: boolean;
    };
    expect(decided.status).toBe("APPROVED");
    expect(decided.partnerCreated).toBe(true);

    // CRM Partner существует, ключ — contactEmail.
    const partner = await prisma.partner.findUniqueOrThrow({ where: { id: decided.partnerId } });
    trackPartner(partner.id);
    expect(partner.contactEmail).toBe(`p13${stamp}@test.local`);
    expect(partner.name).toBe("Brand p13");

    // User.partnerId == Partner.id (invariant).
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.partnerId).toBe(partner.id);

    // Application APPROVED + decisionReason сохранён + history.
    const appRow = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app0.id } });
    expect(appRow.status).toBe("APPROVED");
    expect(appRow.decisionReason).toBe("Документы ок");
    const history = await prisma.partnerApplicationHistory.findMany({ where: { applicationId: app0.id } });
    expect(history.some((h) => h.action === "approved")).toBe(true);

    // Approved Partner → full Cabinet: create Product.
    const product = (
      await agent(session.accessToken).post("/api/v1/products").send({ type: "TOUR", title: "Cabinet tour" }).expect(201)
    ).body as { product: { id: string; partnerId: string | null } };
    trackProduct(product.product.id);
    expect(product.product.partnerId).toBe(partner.id);
    const list = (await agent(session.accessToken).get("/api/v1/products").expect(200)).body as { items: { id: string }[] };
    expect(list.items.some((p) => p.id === product.product.id)).toBe(true);
  });

  // ── 16-18. Reject / Request changes / re-submit ────────────────────────────

  it("16. rejected: no selling access (403), причина сохранена", async () => {
    const res = await registerPartner(validBody("p16")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);
    // Reject без reason → 422.
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/reject`).send({ reason: "" }).expect(400);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/reject`).send({}).expect(400);
    const rejected = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/reject`).send({ reason: "Нет лицензии" }).expect(201)).body as { status: string };
    expect(rejected.status).toBe("REJECTED");

    const row = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app0.id } });
    expect(row.decisionReason).toBe("Нет лицензии");
    await agent(session.accessToken).post("/api/v1/products").send({ type: "TOUR", title: "Nope" }).expect(403);
    // Повторный reject — retry-safe.
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/reject`).send({ reason: "дубль" }).expect(201);
  });

  it("17-18. request changes: открывает редактирование → правка → re-submit", async () => {
    const res = await registerPartner(validBody("p17")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);
    const rc = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/request-changes`).send({ reason: "Уточните страну" }).expect(201)).body as { status: string };
    expect(rc.status).toBe("CHANGES_REQUESTED");

    // CHANGES_REQUESTED снова редактируемо (с актуальной версией).
    const cur = await getOwnApp(session.accessToken);
    const updated = (await agent(session.accessToken).patch("/api/v1/partner/application").send({ country: "GE", version: cur.version }).expect(200)).body as AppView;
    expect(updated.country).toBe("GE");

    // Re-submit работает.
    const resubmitted = (await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201)).body as AppView;
    expect(resubmitted.status).toBe("SUBMITTED");
    // История сохраняется (решение review не потеряно).
    const history = await prisma.partnerApplicationHistory.findMany({ where: { applicationId: app0.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["created", "submitted", "review_started", "changes_requested", "updated", "submitted"]));
  });

  // ── 19-20. Idempotency / concurrency ───────────────────────────────────────

  it("19. retry approve — no duplicate Partner (idempotent no-op)", async () => {
    const res = await registerPartner(validBody("p19")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);
    const first = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/approve`).send({}).expect(201)).body as { partnerId: string };
    trackPartner(first.partnerId);

    const before = await prisma.partner.count({ where: { contactEmail: `p19${stamp}@test.local` } });
    const retry = (await a.post(`/api/v1/partner/onboarding/review/${app0.id}/approve`).send({}).expect(201)).body as { alreadyApproved: boolean; partnerId: string };
    expect(retry.alreadyApproved).toBe(true);
    expect(retry.partnerId).toBe(first.partnerId);
    const after = await prisma.partner.count({ where: { contactEmail: `p19${stamp}@test.local` } });
    expect(after).toBe(before); // дубликат невозможен
  });

  it("20. concurrent approve/reject — only one final decision wins", async () => {
    const res = await registerPartner(validBody("p20")).expect(201);
    const session = res.body as Session;
    trackUser(session.user.id);
    const app0 = await getOwnApp(session.accessToken);
    trackApp(app0.id);
    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${app0.id}/start`).expect(201);

    const [approveRes, rejectRes] = await Promise.all([
      a.post(`/api/v1/partner/onboarding/review/${app0.id}/approve`).send({}).catch((e) => e),
      a.post(`/api/v1/partner/onboarding/review/${app0.id}/reject`).send({ reason: "конкурент" }).catch((e) => e),
    ]);
    const statuses = [approveRes.status, rejectRes.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]); // ровно один победитель

    const row = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app0.id } });
    const winner = approveRes.status === 201 ? "APPROVED" : "REJECTED";
    expect(row.status).toBe(winner);
    if (row.status === "APPROVED") {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
      expect(user.partnerId).not.toBeNull();
      if (user.partnerId) trackPartner(user.partnerId);
    } else {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
      expect(user.partnerId).toBeNull();
    }
  });

  // ── 21-22. Deterministic business identity / no merge ─────────────────────

  it("21. duplicate business identity (registrationNumber): второй approve link'ит существующий Partner (без дубликата)", async () => {
    const regNo = `REG-${stamp}`;
    const mk = async (prefix: string) => {
      const res = await registerPartner(
        validBody(prefix, { applicantType: "COMPANY", legalName: `LLC ${prefix}`, registrationNumber: regNo }),
      ).expect(201);
      const session = res.body as Session;
      trackUser(session.user.id);
      const app0 = await getOwnApp(session.accessToken);
      trackApp(app0.id);
      await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);
      return { session, appId: app0.id };
    };
    const x1 = await mk("p21a");
    const x2 = await mk("p21b");

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    const d1 = (await a.post(`/api/v1/partner/onboarding/review/${x1.appId}/start`).then(() => a.post(`/api/v1/partner/onboarding/review/${x1.appId}/approve`).send({}).expect(201))).body as { partnerId: string };
    trackPartner(d1.partnerId);
    const d2 = (await a.post(`/api/v1/partner/onboarding/review/${x2.appId}/start`).then(() => a.post(`/api/v1/partner/onboarding/review/${x2.appId}/approve`).send({}).expect(201))).body as { partnerId: string };
    expect(d2.partnerId).toBe(d1.partnerId); // reuse, не дубликат

    const count = await prisma.partner.count({ where: { registrationNumber: regNo } });
    expect(count).toBe(1);
    const u2 = await prisma.user.findUniqueOrThrow({ where: { id: x2.session.user.id } });
    expect(u2.partnerId).toBe(d1.partnerId);
  });

  it("22. ambiguous brand name — НЕ merge (разные Partner, без guessing)", async () => {
    const mk = async (prefix: string) => {
      const res = await registerPartner(
        validBody(prefix, { brandName: "Same Brand", applicantType: "COMPANY", legalName: `LLC ${prefix}`, registrationNumber: `RG2-${prefix}-${stamp}` }),
      ).expect(201);
      const session = res.body as Session;
      trackUser(session.user.id);
      const app0 = await getOwnApp(session.accessToken);
      trackApp(app0.id);
      await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);
      return app0.id;
    };
    const appA = await mk("p22a");
    const appB = await mk("p22b");

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    const da = (await a.post(`/api/v1/partner/onboarding/review/${appA}/start`).then(() => a.post(`/api/v1/partner/onboarding/review/${appA}/approve`).send({}).expect(201))).body as { partnerId: string };
    const db = (await a.post(`/api/v1/partner/onboarding/review/${appB}/start`).then(() => a.post(`/api/v1/partner/onboarding/review/${appB}/approve`).send({}).expect(201))).body as { partnerId: string };
    trackPartner(da.partnerId);
    trackPartner(db.partnerId);
    expect(da.partnerId).not.toBe(db.partnerId); // brand name не является ключом
  });

  // ── 24. Legacy PARTNER ─────────────────────────────────────────────────────

  it("24. legacy PARTNER (createStaff + partnerId) не сломан", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    // Существующий CRM Partner (ручной, CRM Center).
    const partner = (await adminAgent.post("/api/v1/partners").send({ name: "Legacy Partner Co" }).expect(201)).body as { id: string };
    trackPartner(partner.id);

    const legacyUser = (await adminAgent
      .post("/api/v1/users")
      .send({
        username: `legacypartner${stamp}`,
        password: "partnerpass123",
        roleCode: RoleCode.PARTNER,
        partnerId: partner.id,
      })
      .expect(201)).body as { id: string };
    trackUser(legacyUser.id);

    const session = await login(`legacypartner${stamp}`, "partnerpass123");
    expect(session.user.partnerId).toBe(partner.id);

    // Нет заявки (legacy) — own endpoint возвращает пусто (null/{}), не ломается.
    const ownApp = (await agent(session.accessToken).get("/api/v1/partner/application").expect(200)).body as Record<string, unknown> | null;
    expect(ownApp === null || Object.keys(ownApp).length === 0).toBe(true);

    // Полный доступ к Cabinet: create Product.
    const product = (await agent(session.accessToken).post("/api/v1/products").send({ type: "TOUR", title: "Legacy tour" }).expect(201)).body as {
      product: { id: string; partnerId: string | null };
    };
    trackProduct(product.product.id);
    expect(product.product.partnerId).toBe(partner.id);
  });

  // ── Аудит ──────────────────────────────────────────────────────────────────

  it("аудит: lifecycle-команды пишутся в AuditLog", async () => {
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: ["auth.partner_register", "partner_application.created", "partner_application.submitted", "partner_application.approved", "partner.created_or_linked", "user.partner_linked"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    expect(logs.some((l) => l.action === "auth.partner_register")).toBe(true);
    expect(logs.some((l) => l.action === "partner_application.created")).toBe(true);
    expect(logs.some((l) => l.action === "partner_application.submitted")).toBe(true);
    expect(logs.some((l) => l.action === "partner_application.approved")).toBe(true);
    expect(logs.some((l) => l.action === "partner.created_or_linked")).toBe(true);
    expect(logs.some((l) => l.action === "user.partner_linked")).toBe(true);
  });
});
