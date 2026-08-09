/**
 * E2E Phase 1 Step 1.4 REVIEW FIXES — change proposal (draft/version N+1) + DB invariant.
 *
 * FIX 1 (change proposal PUBLISHED Product) — 10 доказательств:
 *  1. PUBLISHED N остаётся неизменным после начала редактирования (live title/version);
 *  2. PARTNER меняет title/description/attributes в N+1 (draft);
 *  3. изменения N+1 отсутствуют в published representation до approve;
 *  4. submit snapshot содержит N+1 (effective content + targetVersion + draftVersion);
 *  5. request_changes → published N сохраняется;
 *  6. reject → published N сохраняется;
 *  7. approve → published становится N+1 (атомарно, с content);
 *  8. content + media одной proposal публикуются согласованно;
 *  9. другой PARTNER не может создать/edit proposal (403);
 * 10. submitted proposal нельзя silent-edit (content PATCH + media write → 409).
 *
 * FIX 2 (единый DB invariant активной moderation submission):
 *  - raw SQL: вставить для одного Product две активные submission с РАЗНЫМИ active
 *    statuses (SUBMITTED + IN_REVIEW) → БД физически отклоняет вторую (23505),
 *    partial unique index ModerationSubmission_one_active_per_product.
 *
 * Storage: изолированный test MinIO; Test DB: изолированная.
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

interface DraftView {
  id: string;
  title: string;
  description: string | null;
  version: number;
}

interface SubmissionView {
  id: string;
  productId: string;
  productVersion: number;
  draftVersion: number | null;
  status: string;
  snapshot?: {
    product: { version: number; targetVersion: number; title: string; description: string | null; changeProposal: boolean; draftVersion: number | null; attributes: Record<string, unknown> | null };
    media: MediaRow[];
    primaryMediaId: string | null;
  } | null;
}

const jpeg = () =>
  sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 60, g: 40, b: 200 } } })
    .jpeg()
    .toBuffer();

describe("Phase 1 Step 1.4 review fixes — Change Proposal + active-submission DB invariant (e2e)", () => {
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
  let partner1Id: string;
  let catId: string;

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

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `CP Partner 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;
    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `CP Partner 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);

    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `cppartner1${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body;
    created.users.push(u1.id);
    partner1Agent = await agent((await login(`cppartner1${stamp}`, "partnerpass123")).accessToken);

    const u2 = (await adminAgent.post("/api/v1/users").send({ username: `cppartner2${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body;
    created.users.push(u2.id);
    partner2Agent = await agent((await login(`cppartner2${stamp}`, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `cpmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    modAgent = await agent((await login(`cpmod${stamp}`, "modpass123")).accessToken);

    // Категория с media policy (minImages=1, primaryImageRequired) для publish-переходов.
    const slug = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `CP ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    catId = cat.id;
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({
          categoryId: cat.id,
          attributes: [{ key: "days", type: "integer" }],
          mediaRequirements: { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg", "image/png"] },
        })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
    await stopTestMinIO();
  });

  /** Создать PUBLISHED Product партнёра (submit + approve через модерацию). */
  async function createPublishedProduct(title: string, agent = partner1Agent) {
    const res = await agent.post("/api/v1/products").send({ type: "TOUR", title, categoryId: catId, attributes: { days: 3 } }).expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    const up = (await agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "p.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    expect(up.media[0].isPrimary).toBe(true);
    const sub = (await agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);
    return product;
  }

  /** PATCH change proposal N+1 от PARTNER (title/description/attributes). */
  async function editProposal(productId: string, title: string, description: string, attributes: Record<string, unknown> = { days: 5 }) {
    return (await partner1Agent
      .patch(`/api/v1/products/${productId}`)
      .send({ title, description, attributes })
      .expect(200)).body as { product: { title: string; version: number }; draft: DraftView; changeProposal: boolean };
  }

  it("1. PUBLISHED N остаётся неизменным после начала редактирования (live title/version)", async () => {
    const product = await createPublishedProduct(`CP1 N ${stamp}`);
    const before = (await modAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as { title: string; version: number; status: string };

    const patched = await editProposal(product.id, `CP1 N+1 ${stamp}`, "proposal description");

    // Live approved N НЕ изменился; draft N+1 появился.
    expect(patched.product.title).toBe(before.title);
    expect(patched.product.version).toBe(before.version);
    expect(patched.changeProposal).toBe(true);
    expect(patched.draft.title).toBe(`CP1 N+1 ${stamp}`);
  });

  it("2. PARTNER меняет title/description/attributes в N+1 (draft отдельно от live)", async () => {
    const product = await createPublishedProduct(`CP2 N ${stamp}`);
    const patched = await editProposal(product.id, `CP2 N+1 ${stamp}`, "new long description", { days: 9 });

    expect(patched.draft.title).toBe(`CP2 N+1 ${stamp}`);
    expect(patched.draft.description).toBe("new long description");
    const get = (await partner1Agent.get(`/api/v1/products/${product.id}`).expect(200)).body as { title: string; draft: DraftView & { attributes: Record<string, unknown> } | null };
    expect(get.draft?.title).toBe(`CP2 N+1 ${stamp}`);
    expect(get.draft?.attributes).toEqual({ days: 9 });
    expect(get.title).toBe(`CP2 N ${stamp}`); // live N
  });

  it("3. изменения N+1 отсутствуют в published representation до approve", async () => {
    const product = await createPublishedProduct(`CP3 N ${stamp}`);
    await editProposal(product.id, `CP3 N+1 ${stamp}`, "not public yet");

    // Public read: live approved N (старый title/description).
    const pub = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { title: string; description: string | null };
    };
    expect(pub.product.title).toBe(`CP3 N ${stamp}`);
    expect(pub.product.description).toBeNull();
  });

  it("4. submit snapshot содержит N+1 (title/description/attributes + targetVersion + draftVersion)", async () => {
    const product = await createPublishedProduct(`CP4 N ${stamp}`);
    await editProposal(product.id, `CP4 N+1 ${stamp}`, "snapshot content", { days: 7 });

    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    const detail = (await modAgent.get(`/api/v1/moderation/submissions/${sub.id}`).expect(200)).body as SubmissionView;

    expect(detail.snapshot?.product.changeProposal).toBe(true);
    expect(detail.snapshot?.product.draftVersion).toBe(1);
    expect(detail.snapshot?.product.title).toBe(`CP4 N+1 ${stamp}`);
    expect(detail.snapshot?.product.description).toBe("snapshot content");
    expect(detail.snapshot?.product.attributes).toEqual({ days: 7 });
    expect(detail.snapshot?.product.targetVersion).toBe(detail.productVersion + 1);
    expect(detail.draftVersion).toBe(1);
  });

  it("5. request_changes → published N сохраняется (live не меняется)", async () => {
    const product = await createPublishedProduct(`CP5 N ${stamp}`);
    const patched = await editProposal(product.id, `CP5 N+1 ${stamp}`, "rc");
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent
      .post(`/api/v1/moderation/submissions/${sub.id}/request-changes`)
      .send({ reasonCode: "MISLEADING_CONTENT", comment: "поправьте" })
      .expect(201);

    // Public N прежний; live прежний; draft сохранён (PARTNER продолжает править).
    const pub = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { title: string } };
    expect(pub.product.title).toBe(`CP5 N ${stamp}`);
    expect(patched.product.version).toBeGreaterThanOrEqual(1);
    const get = (await partner1Agent.get(`/api/v1/products/${product.id}`).expect(200)).body as { title: string; draft: DraftView | null };
    expect(get.title).toBe(`CP5 N ${stamp}`);
    expect(get.draft?.title).toBe(`CP5 N+1 ${stamp}`);
  });

  it("6. reject → published N сохраняется (live не меняется, draft сохранён)", async () => {
    const product = await createPublishedProduct(`CP6 N ${stamp}`);
    await editProposal(product.id, `CP6 N+1 ${stamp}`, "rej");
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "INVALID_PRICE_OR_TERMS", comment: "x" }).expect(201);

    const pub = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { title: string } };
    expect(pub.product.title).toBe(`CP6 N ${stamp}`);
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.title).toBe(`CP6 N ${stamp}`);
    // Draft сохранён — PARTNER может править и re-submit (e2e 17-18 уже покрывают re-submit).
    const draft = await prisma.productDraft.findUnique({ where: { productId: product.id } });
    expect(draft?.title).toBe(`CP6 N+1 ${stamp}`);
  });

  it("7. approve → published становится N+1 (атомарно, content применён, draft удалён)", async () => {
    const product = await createPublishedProduct(`CP7 N ${stamp}`);
    await editProposal(product.id, `CP7 N+1 ${stamp}`, "approved content", { days: 11 });
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);

    // Public = N+1.
    const pub = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { title: string; description: string; version: number; attributes: Record<string, unknown> };
    };
    expect(pub.product.title).toBe(`CP7 N+1 ${stamp}`);
    expect(pub.product.description).toBe("approved content");
    expect(pub.product.attributes).toEqual({ days: 11 });
    // Draft удалён; live version N+1.
    expect(await prisma.productDraft.findUnique({ where: { productId: product.id } })).toBeNull();
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.version).toBe(sub.productVersion + 1);
    expect(row.status).toBe("PUBLISHED");
  });

  it("8. content + media одной proposal публикуются согласованно", async () => {
    const product = await createPublishedProduct(`CP8 N ${stamp}`);
    const pubBefore = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[] };
    const mediaBefore = pubBefore.media.map((m) => m.id);

    // Одна proposal: content (draft) + новая media (DRAFT).
    await editProposal(product.id, `CP8 N+1 ${stamp}`, "media+content", { days: 4 });
    const up = (await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "new.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    expect(up.media[0].status).toBe("DRAFT");
    // Public до approve: старые media + старый контент.
    const pubMid = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { media: MediaRow[]; product: { title: string } };
    expect(pubMid.media.map((m) => m.id)).toEqual(mediaBefore);
    expect(pubMid.product.title).toBe(`CP8 N ${stamp}`);

    // Submit + approve → content AND media публикуются вместе.
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    expect(sub.snapshot?.media.some((m) => m.id === up.media[0].id && m.status === "DRAFT")).toBe(true);
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);

    const pubAfter = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      media: MediaRow[];
      product: { title: string };
    };
    expect(pubAfter.product.title).toBe(`CP8 N+1 ${stamp}`);
    expect(pubAfter.media.map((m) => m.id)).toContain(up.media[0].id);
  });

  it("9. другой PARTNER не может создать/edit proposal (403)", async () => {
    const product = await createPublishedProduct(`CP9 N ${stamp}`);
    // Чужой PARTNER 2: PATCH published Product партнёра 1 → 403 (object scope), draft не создаётся.
    await partner2Agent.patch(`/api/v1/products/${product.id}`).send({ title: "Hack N+1" }).expect(403);
    expect(await prisma.productDraft.findUnique({ where: { productId: product.id } })).toBeNull();
  });

  it("10. submitted proposal нельзя silent-edit (content PATCH + media write → 409)", async () => {
    const product = await createPublishedProduct(`CP10 N ${stamp}`);
    await editProposal(product.id, `CP10 N+1 ${stamp}`, "frozen");
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    expect(sub.status).toBe("SUBMITTED");

    // Content PATCH submitted proposal → 409.
    await partner1Agent.patch(`/api/v1/products/${product.id}`).send({ title: "Silent hack" }).expect(409);
    // Media write → 409 (freeze при активной submission).
    await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "h.jpg", contentType: "image/jpeg" }).expect(409);

    // Draft revision не изменилась.
    const draft = await prisma.productDraft.findUniqueOrThrow({ where: { productId: product.id } });
    expect(draft.version).toBe(1);
    // Live N неизменен.
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.title).toBe(`CP10 N ${stamp}`);
  });

  // ── FIX 2: единый DB invariant активной moderation submission ─────────────

  it("FIX2. БД физически отклоняет вторую активную submission одного Product (SUBMITTED + IN_REVIEW)", async () => {
    const product = await createPublishedProduct(`FIX2 ${stamp}`);

    // Прямой SQL (в обход app-логики): вставляем активную SUBMITTED submission.
    const insertSubmitted = `INSERT INTO "catalog"."ModerationSubmission"
      (id, "productId", "productVersion", status, "isActiveSubmission", snapshot, "updatedAt")
      VALUES ($1, $2, 1, 'SUBMITTED', true, '{}'::jsonb, now())`;
    await prisma.$executeRawUnsafe(insertSubmitted, `fix2-sub-${stamp}`, product.id);

    // Вторая активная с ДРУГИМ active status (IN_REVIEW) → DB partial unique index
    // ModerationSubmission_one_active_per_product обязан отклонить (23505).
    const insertInReview = `INSERT INTO "catalog"."ModerationSubmission"
      (id, "productId", "productVersion", status, "isActiveSubmission", snapshot, "updatedAt")
      VALUES ($1, $2, 1, 'IN_REVIEW', true, '{}'::jsonb, now())`;
    let rejected: unknown;
    try {
      await prisma.$executeRawUnsafe(insertInReview, `fix2-ir-${stamp}`, product.id);
    } catch (err) {
      rejected = err;
    }

    expect(rejected).toBeTruthy();
    const err = rejected as { code?: string; meta?: { code?: string }; message?: string };
    const errorText = `${String(err?.code ?? "")} ${String(err?.meta?.code ?? "")} ${String(err?.message ?? "")}`;
    expect(errorText).toMatch(/23505|P2002|UniqueViolation|unique constraint/i);

    // В базе осталась ровно одна активная submission.
    const active = await prisma.moderationSubmission.count({ where: { productId: product.id, isActiveSubmission: true } });
    expect(active).toBe(1);

    // Cleanup прямых вставок.
    await prisma.moderationSubmission.deleteMany({ where: { id: { startsWith: `fix2-${stamp}` } } });
  });

  it("FIX2b. start-review не создаёт вторую активную (SUB) — единый инвариант держит очередь", async () => {
    const product = await createPublishedProduct(`FIX2b ${stamp}`);
    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as SubmissionView;
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/start-review`).expect(201);
    const active = await prisma.moderationSubmission.count({ where: { productId: product.id, isActiveSubmission: true } });
    expect(active).toBe(1);
  });
});
