/**
 * E2E Phase 1 Step 1.4 — Moderation Workflow (29 обязательных доказательств §23).
 *
 *  1. PARTNER submit own valid DRAFT → success;
 *  2. PARTNER submit чужой Product → deny;
 *  3. invalid Product → validation error;
 *  4. required media отсутствует → validation error;
 *  5. submit создаёт immutable snapshot;
 *  6. submitted/in-review version нельзя silent-edit;
 *  7. MODERATOR видит queue;
 *  8. PARTNER не видит queue;
 *  9. start review → success;
 * 10. второй MODERATOR не перехватывает review;
 * 11. approve → controlled Catalog publish;
 * 12. MODERATOR direct publish → deny;
 * 13. approve фиксирует reviewer/decision/timestamp;
 * 14. reject требует reason;
 * 15. reject не удаляет Product;
 * 16. request_changes → PARTNER снова может edit;
 * 17. re-submit создаёт новый submission;
 * 18. старый submission сохраняется;
 * 19. MODERATOR не edit Product;
 * 20. MODERATOR не edit media;
 * 21. PARTNER не approve/reject/request_changes;
 * 22. self-moderation запрещена;
 * 23. published Product change не заменяет public version до нового approve;
 * 24. media change входит в новый snapshot;
 * 25. concurrent approve/approve → один result;
 * 26. concurrent approve/reject → один result;
 * 27. stale submission/version → conflict;
 * 28. audit/history записаны;
 * 29. предыдущий regression suite остаётся зелёным (запускается отдельно).
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
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import { startTestMinIO, stopTestMinIO } from "./e2e.minio";

interface MediaRow {
  id: string;
  status: string;
  isPrimary: boolean;
}

interface SubmissionView {
  id: string;
  productId: string;
  productCode: string;
  productTitle: string;
  productPartnerId: string | null;
  productCategoryId: string | null;
  productCategoryTitle: string | null;
  productVersion: number;
  status: string;
  submittedBy: { id: string | null; username: string | null };
  submittedAt: string;
  assignedModerator: { id: string | null; username: string | null };
  reviewStartedAt: string | null;
  decidedAt: string | null;
  reasonCode: string | null;
  comment: string | null;
  previousSubmissionId: string | null;
  ageMinutes: number;
  snapshot?: {
    product: { version: number; title: string; status: string };
    media: MediaRow[];
    primaryMediaId: string | null;
  } | null;
}

const jpeg = () =>
  sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 40, g: 120, b: 200 } } })
    .jpeg()
    .toBuffer();

describe("Phase 1 Step 1.4 — Moderation Workflow (e2e)", () => {
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
  let partner2Agent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let mod2Agent: ReturnType<typeof request.agent>;
  let partner1Id: string;
  let modId: string;

  /** Категория с политикой: minImages=1 + primary required + jpeg/png (mediaRequirements). */
  let mediaCatId: string;
  /** Категория с требованием tariffRules.required (для invalid-Product проверки). */
  let tariffCatId: string;

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

    // Партнёры + PARTNER-пользователи (как в product-media e2e).
    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `Mod Partner 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;
    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `Mod Partner 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);

    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `modpartner1${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body;
    created.users.push(u1.id);
    partner1Agent = await agent((await login(`modpartner1${stamp}`, "partnerpass123")).accessToken);

    const u2 = (await adminAgent.post("/api/v1/users").send({ username: `modpartner2${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body;
    created.users.push(u2.id);
    partner2Agent = await agent((await login(`modpartner2${stamp}`, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `modmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    modId = mod.id;
    modAgent = await agent((await login(`modmod${stamp}`, "modpass123")).accessToken);

    const mod2 = (await adminAgent.post("/api/v1/users").send({ username: `modmod2${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod2.id);
    mod2Agent = await agent((await login(`modmod2${stamp}`, "modpass123")).accessToken);

    // Категория "media": minImages=1, primaryImageRequired, jpeg/png — для valid submit.
    mediaCatId = await createCategoryWithPolicy({
      attributes: [{ key: "days", type: "integer" }],
      mediaRequirements: { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg", "image/png"] },
    });
    // Категория "tariff": tariffRules.required → Product без тарифов не проходит eligibility.
    tariffCatId = await createCategoryWithPolicy({
      attributes: [{ key: "days", type: "integer" }],
      tariffRules: { required: true, minTariffs: 1 },
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false },
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

  async function createCategoryWithPolicy(config: { attributes: unknown[]; mediaRequirements?: Record<string, unknown>; tariffRules?: Record<string, unknown> }): Promise<string> {
    const slug = `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Mod ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: config.attributes, mediaRequirements: config.mediaRequirements, tariffRules: config.tariffRules })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    return cat.id;
  }

  /** Draft Product от partnerAgent в категории с media policy (attributes + 1 jpeg). */
  async function createMediaCompleteProduct(agent: ReturnType<typeof request.agent>, title: string, categoryId: string) {
    const res = await agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title, categoryId, attributes: { days: 3 } })
      .expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    const up = (await agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "p.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    expect(up.media[0].isPrimary).toBe(true);
    return product;
  }

  /** Draft Product БЕЗ media (для proof 4: required media отсутствует → 422). */
  async function createNoMediaProduct(agent: ReturnType<typeof request.agent>, title: string, categoryId: string) {
    const res = await agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title, categoryId, attributes: { days: 3 } })
      .expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    return product;
  }

  // ── Proof 1: submit own valid DRAFT → success ─────────────────────────────

  it("1. PARTNER submit own valid DRAFT → success (SUBMITTED, snapshot/version)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Sub OK ${stamp}`, mediaCatId);
    const res = await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201);
    const sub = res.body as SubmissionView;

    expect(sub.status).toBe("SUBMITTED");
    expect(sub.productId).toBe(product.id);
    expect(sub.productVersion).toBeGreaterThanOrEqual(1);
    expect(sub.submittedBy.username).toBe(`modpartner1${stamp}`);
    expect(sub.snapshot?.product.version).toBe(sub.productVersion);
    expect(sub.snapshot?.media.length).toBe(1);
    expect(sub.snapshot?.primaryMediaId).toBeTruthy();
  });

  it("2. PARTNER submit чужой Product → deny (403)", async () => {
    const other = await createMediaCompleteProduct(partner2Agent, `Sub Other ${stamp}`, mediaCatId);
    await partner1Agent.post(`/api/v1/products/${other.id}/submit-moderation`).expect(403);
  });

  it("3. invalid Product (tariff policy не выполнена) → validation error (422)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Sub Invalid ${stamp}`, tariffCatId);
    await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(422);
  });

  it("4. required media отсутствует → validation error (422)", async () => {
    const product = await createNoMediaProduct(partner1Agent, `Sub NoMedia ${stamp}`, mediaCatId);
    await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(422);
  });

  // ── Proof 5-8: snapshot immutable / silent-edit / queue ────────────────────

  it("5. submit создаёт immutable snapshot (без storage keys; деталь повторяет версию)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Snap ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    const detail = (await modAgent.get(`/api/v1/moderation/submissions/${sub.id}`).expect(200)).body as SubmissionView;
    expect(detail.snapshot?.product.title).toBe(`Snap ${stamp}`);
    expect(detail.snapshot?.product.version).toBe(sub.productVersion);
    const raw = JSON.stringify(detail.snapshot);
    expect(raw).not.toContain("storageKey");
    expect(raw).not.toContain("originalStorageKey");
    expect(raw).not.toContain("thumbnailStorageKey");
  });

  it("6. submitted/in-review version нельзя silent-edit (PARTNER PATCH + media write → 409/deny)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `NoSilent ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    expect(sub.status).toBe("SUBMITTED");

    // PATCH проверяемой версии → 409 (только DRAFT редактируем PARTNER-ом).
    await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: "Silent hack" }).expect(409);
    // media write (upload новой) → заморожена при активной submission → 409.
    await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "h.jpg", contentType: "image/jpeg" }).expect(409);

    // Версия не изменилась (snapshot/версия проверяемой версии целы).
    const prod = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { version: number; title: string };
    expect(prod.version).toBe(sub.productVersion);
    expect(prod.title).toBe(`NoSilent ${stamp}`);
  });

  it("7. MODERATOR видит queue (список + детали; строка содержит partner/category/age)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Queue ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    const list = (await modAgent.get("/api/v1/moderation/submissions?pageSize=100").expect(200)).body as { items: SubmissionView[]; total: number };
    const row = list.items.find((s) => s.id === sub.id)!;
    expect(row).toBeTruthy();
    // §7: минимальные поля строки очереди — submissionId, productId, title, partner, category, submittedAt, status, assignedModerator, age.
    expect(row.productCode).toBeTruthy();
    expect(row.productPartnerId).toBe(partner1Id);
    expect(row.productCategoryId).toBe(mediaCatId);
    expect(row.productCategoryTitle).toBeTruthy();
    expect(row.submittedAt).toBeTruthy();
    expect(row.status).toBe("SUBMITTED");
    expect(row.ageMinutes).toBeGreaterThanOrEqual(0);
  });

  it("8. PARTNER не видит queue и чужой moderation result (403, IDOR)", async () => {
    await partner1Agent.get("/api/v1/moderation/submissions").expect(403);
    await partner1Agent.get("/api/v1/moderation/submissions/some-id").expect(403);
    // IDOR (spec §24): PARTNER не читает чужой moderation history по productId другого партнёра.
    const other = await createMediaCompleteProduct(partner2Agent, `ForeignHist ${stamp}`, mediaCatId);
    await partner1Agent.get(`/api/v1/products/${other.id}/moderation`).expect(403);
  });

  // ── Proof 9-10: start review / захват ─────────────────────────────────────

  it("9. start review → success (IN_REVIEW, reviewer + timestamp)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Review ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    const started = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201)).body as SubmissionView;
    expect(started.status).toBe("IN_REVIEW");
    expect(started.reviewStartedAt).toBeTruthy();
    expect(started.assignedModerator.username).toBe(`modmod${stamp}`);
  });

  it("10. второй MODERATOR не перехватывает активный review (409)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Steal ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);

    // Другой модератор пытается перехватить → 409 (controlled conflict, не silent).
    await mod2Agent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(409);
    // Тот же модератор повторно start-review → idempotent (201).
    const again = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201)).body as SubmissionView;
    expect(again.status).toBe("IN_REVIEW");
  });

  // ── Proof 11-13: approve → controlled publish ──────────────────────────────

  it("11. approve → controlled Catalog publish (PUBLISHED, media promoted, version N+1)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Approve ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);

    const approved = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201)).body as SubmissionView;
    expect(approved.status).toBe("APPROVED");

    // Catalog transition: product → PUBLISHED, media → PUBLISHED, version N+1.
    const prod = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { status: string; version: number };
    expect(prod.status).toBe("PUBLISHED");
    expect(prod.version).toBe(sub.productVersion + 1);
    const media = (await modAgent.get(`/api/v1/products/${product.id}/media`).expect(200)).body as MediaRow[];
    expect(media.every((m) => m.status === "PUBLISHED")).toBe(true);
    // Public read (PUBLISHED) работает: public PDP отдаёт published version N+1
    // (internal lifecycle status НЕ раскрывается — Step 1.5 public read-contract).
    const pub = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { version: number; title: string }; media: MediaRow[] };
    expect(pub.product.version).toBe(sub.productVersion + 1);
    expect(pub.product.title).toBe(`Approve ${stamp}`);
    expect(pub.media.length).toBeGreaterThan(0);
  });

  it("13. approve фиксирует reviewer/decision/timestamp", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Reviewer ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);

    const approved = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201)).body as SubmissionView;
    expect(approved.status).toBe("APPROVED");
    expect(approved.decidedAt).toBeTruthy();
    expect(approved.reviewStartedAt).toBeTruthy();
    expect(approved.assignedModerator.username).toBe(`modmod${stamp}`);
    expect(approved.productVersion).toBe(sub.productVersion);
  });

  it("12. MODERATOR direct publish → deny (403; нет catalog.product.publish)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `NoDirect ${stamp}`, mediaCatId);
    await modAgent.post(`/api/v1/products/${product.id}/publish`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/archive`).expect(403);
  });

  // ── Proof 14-18: reject / request_changes / re-submit ─────────────────────

  it("14. reject требует reason (400 без reasonCode; 422 invalid; OTHER требует comment)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Reject ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    // Без reasonCode → 400 (DTO).
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({}).expect(400);
    // Невалидный reasonCode → 422.
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "NOT_A_CODE" }).expect(422);
    // OTHER без comment → 422.
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "OTHER" }).expect(422);
    // Валидный reject → 201.
    const rejected = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "INCOMPLETE_CONTENT", comment: "нет описания" }).expect(201)).body as SubmissionView;
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.reasonCode).toBe("INCOMPLETE_CONTENT");
  });

  it("15. reject не удаляет Product (остаётся, возвращается в DRAFT)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `KeepProd ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "POLICY_VIOLATION", comment: "x" }).expect(201);

    const prod = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { status: string };
    expect(prod.status).toBe("DRAFT"); // released → снова редактируем
    expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it("16. request_changes → PARTNER снова может edit (DRAFT + PATCH 200)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `ChangeReq ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    const rc = (await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/request-changes`).send({ reasonCode: "MISLEADING_CONTENT", comment: "поправьте описание" }).expect(201)).body as SubmissionView;
    expect(rc.status).toBe("CHANGES_REQUESTED");

    // Product снова DRAFT → PARTNER может PATCH.
    const patched = (await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: `ChangeReq fixed ${stamp}` }).expect(200)).body as { status: string; version: number };
    expect(patched.status).toBe("DRAFT");
  });

  it("17+18. re-submit создаёт НОВУЮ submission (previousSubmissionId); старый сохраняется", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Resub ${stamp}`, mediaCatId);
    const sub1 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub1.id}/request-changes`).send({ reasonCode: "INCOMPLETE_CONTENT", comment: "fix" }).expect(201);

    // PARTNER правит после CHANGES_REQUESTED.
    await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ description: "исправлено" }).expect(200);
    // Новый submit → новая submission с previousSubmissionId.
    const sub2 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    expect(sub2.id).not.toBe(sub1.id);
    expect(sub2.previousSubmissionId).toBe(sub1.id);
    expect(sub2.productVersion).toBeGreaterThan(sub1.productVersion);

    // Старый submission сохраняется (immutable history, статус не меняется).
    const old = (await modAgent.get(`/api/v1/moderation/submissions/${sub1.id}`).expect(200)).body as SubmissionView;
    expect(old.status).toBe("CHANGES_REQUESTED");
    expect(old.productVersion).toBe(sub1.productVersion);
    expect(old.snapshot?.product.title).toBe(`Resub ${stamp}`);
  });

  // ── Proof 19-21: MODERATOR не редактирует; PARTNER не решает ──────────────

  it("19. MODERATOR не edit Product (403)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `ModNoEdit ${stamp}`, mediaCatId);
    await modAgent.patch(`/api/v1/products/${product.id}`).send({ title: "Hack" }).expect(403);
    await modAgent.post(`/api/v1/products`).send({ type: "TOUR", title: "Hack" }).expect(403);
  });

  it("20. MODERATOR не edit media (403)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `ModNoMedia ${stamp}`, mediaCatId);
    await modAgent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "h.jpg", contentType: "image/jpeg" }).expect(403);
    const media = (await partner1Agent.get(`/api/v1/products/${product.id}/media`).expect(200)).body as MediaRow[];
    await modAgent.patch(`/api/v1/products/${product.id}/media/${media[0].id}`).send({ caption: "Hack" }).expect(403);
    await modAgent.delete(`/api/v1/products/${product.id}/media/${media[0].id}`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/media/${media[0].id}/set-primary`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/media/${media[0].id}/replace`).attach("file", await jpeg(), { filename: "h.jpg", contentType: "image/jpeg" }).expect(403);
  });

  it("21. PARTNER не approve/reject/request_changes (403)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `PartnerNoDecide ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await partner1Agent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(403);
    await partner1Agent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "OTHER", comment: "x" }).expect(403);
    await partner1Agent.post(`/api/v1/moderation/submissions/${sub.id}/request-changes`).send({ reasonCode: "OTHER", comment: "x" }).expect(403);
    await partner1Agent.post(`/api/v1/moderation/submissions/${sub.id}/assign`).send({ moderatorId: modId }).expect(403);
  });

  // ── Proof 22: self-moderation ──────────────────────────────────────────────

  it("22. self-moderation запрещена (MODERATOR с partnerId == product.partnerId → 403)", async () => {
    // Модератор, который одновременно привязан к партнёру (много-ролевой сценарий).
    const u = (await adminAgent.post("/api/v1/users").send({ username: `selfmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR, partnerId: partner1Id })).body;
    created.users.push(u.id);
    const selfModAgent = await agent((await login(`selfmod${stamp}`, "modpass123")).accessToken);

    const product = await createMediaCompleteProduct(partner1Agent, `SelfMod ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    // Модератор того же партнёра не может принять решение по продукту своего партнёра.
    await selfModAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(403);
    await selfModAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "DUPLICATE", comment: "x" }).expect(403);
    // Продукт не затронут (submission осталась SUBMITTED).
    const still = (await modAgent.get(`/api/v1/moderation/submissions/${sub.id}`).expect(200)).body as SubmissionView;
    expect(still.status).toBe("SUBMITTED");
  });

  // ── Proof 23-24: published change не заменяет public version до approve ────

  it("23. published change не заменяет public version до нового approve (media DRAFT скрыта)", async () => {
    // 1) Публикуем через approve → public версия N.
    const product = await createMediaCompleteProduct(partner1Agent, `PubChange ${stamp}`, mediaCatId);
    const sub1 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub1.id}/approve`).expect(201);
    const pub1 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[] };
    const publishedBefore = pub1.media.map((m) => m.id);

    // 2) PARTNER добавляет новую media (DRAFT) — public version НЕ меняется.
    const up = (await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "new.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    expect(up.media[0].status).toBe("DRAFT");
    const pub2 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[] };
    expect(pub2.media.map((m) => m.id)).toEqual(publishedBefore); // старые только

    // 3) PARTNER submit change proposal (published N+1) — публичная N остаётся.
    const sub2 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    expect(sub2.productVersion).toBe(sub1.productVersion + 1);
    const pub3 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[] };
    expect(pub3.media.map((m) => m.id)).toEqual(publishedBefore);

    // 4) approve → public N+1 (новая media видна).
    await modAgent.post(`/api/v1/moderation/submissions/${sub2.id}/approve`).expect(201);
    const pub4 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[] };
    expect(pub4.media.map((m) => m.id)).toContain(up.media[0].id);
  });

  it("24. media change входит в новый snapshot (DRAFT media в snapshot submission)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `SnapMedia ${stamp}`, mediaCatId);
    const sub1 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub1.id}/approve`).expect(201);

    const up = (await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "n2.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const sub2 = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    const detail = (await modAgent.get(`/api/v1/moderation/submissions/${sub2.id}`).expect(200)).body as SubmissionView;
    expect(detail.snapshot?.media.some((m) => m.id === up.media[0].id && m.status === "DRAFT")).toBe(true);
  });

  // ── Proof 25-27: concurrency / stale ───────────────────────────────────────

  it("25. concurrent approve/approve → один результат (одна версия publish)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `ConcAA ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    const before = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { version: number };

    const outcomes = await Promise.allSettled([
      modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`),
      modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`),
    ]);
    const statuses = outcomes.map((o) => (o.status === "fulfilled" ? (o as PromiseFulfilledResult<{ status: number }>).value.status : -1));
    // Оба запроса доставлены; допустимые исходы: 201 (первый publish) + 201 (idempotent retry)
    // или 201 + 409 (CAS-проигрыш). Никаких 500.
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);

    const after = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { status: string; version: number };
    expect(after.status).toBe("PUBLISHED");
    // Ровно ОДИН publish: версия увеличилась ровно на 1.
    expect(after.version).toBe(before.version + 1);
  });

  it("26. concurrent approve/reject → один результат (один business-effect)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `ConcAR ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    const before = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { version: number; status: string };

    const outcomes = await Promise.allSettled([
      modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`),
      modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "DUPLICATE", comment: "x" }),
    ]);
    const statuses = outcomes.map((o) => (o.status === "fulfilled" ? (o as PromiseFulfilledResult<{ status: number }>).value.status : -1));
    expect(statuses.includes(201)).toBe(true);
    expect(statuses.includes(409)).toBe(true); // проигравший — controlled conflict

    // Ровно одно финальное решение.
    const finalSub = (await modAgent.get(`/api/v1/moderation/submissions/${sub.id}`).expect(200)).body as SubmissionView;
    expect(["APPROVED", "REJECTED"].includes(finalSub.status)).toBe(true);
    if (finalSub.status === "APPROVED") {
      expect(await afterVersion(product.id)).toBe(before.version + 1);
    }
  });

  it("27. stale submission/version → conflict (проверяемая версия изменилась)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Stale ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;

    // LIVE-версия меняется в обход review (staff/ADMIN lifecycle) → версия продукта > проверяемой.
    await adminAgent.patch(`/api/v1/products/${product.id}`).send({ title: `Stale edited ${stamp}` }).expect(200);
    const prod = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { version: number };
    expect(prod.version).toBeGreaterThan(sub.productVersion);

    // approve по устаревшей submission → 409 (нельзя опубликовать не-проверенную версию).
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(409);
    const still = (await modAgent.get(`/api/v1/moderation/submissions/${sub.id}`).expect(200)).body as SubmissionView;
    expect(still.status).toBe("SUBMITTED"); // решение не зафиксировано
  });

  // ── Proof 28: audit/history ────────────────────────────────────────────────

  it("28. audit/history записаны (ProductHistory + AuditLog)", async () => {
    const product = await createMediaCompleteProduct(partner1Agent, `Audit ${stamp}`, mediaCatId);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);

    // ProductHistory: moderation.submitted + publish (catalog transition).
    const history = await prisma.productHistory.findMany({ where: { productId: product.id } });
    const actions = history.map((h) => h.action);
    expect(actions).toContain("moderation.submitted");
    expect(actions).toContain("publish");

    // AuditLog: submission created / review started / approved.
    const audit = await prisma.auditLog.findMany({ where: { resourceId: sub.id } });
    const auditActions = audit.map((a) => a.action);
    expect(auditActions).toContain("moderation.submitted");
    expect(auditActions).toContain("moderation.review_started");
    expect(auditActions).toContain("moderation.approved");
  });

  /** Версия продукта (helper для 26). */
  async function afterVersion(productId: string): Promise<number> {
    const p = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { version: true } });
    return p.version;
  }
});
