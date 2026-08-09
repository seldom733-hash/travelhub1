/**
 * E2E Phase 1 Step 1.3 — Product Ownership & PARTNER Object Scope.
 *
 * Инвариант: PARTNER читает/изменяет ТОЛЬКО свои Product/ProductMedia;
 * MODERATOR — только moderation read; ADMIN — только через explicit permissions;
 * ownership берётся из actor context и НЕ может быть подменён через body/query.
 *
 * Доказательства (Step 1.3 §22) + IDOR/security (§24):
 *   1-2.  partnerId ставится backend-ом; body partnerId игнорируется (forge);
 *   3-4.  PARTNER A видит свой Product; PARTNER B не видит A в list;
 *   12.   list count/pagination PARTNER не учитывает чужие Product;
 *   5-11. PARTNER B не может GET/PATCH/upload/preview/delete/set-primary/reorder
 *         Product A (+ cross-product mediaId → 404);
 *   13-16. MODERATOR: read/preview разрешены, write (PATCH/upload/replace/delete) — 403;
 *   17-18. ADMIN: explicit permission операции + ownership override аудитируется (actor/reason);
 *   19.   PARTNER не может напрямую publish;
 *   20.   ownership нельзя обойти через body partnerId (create + PATCH);
 *   21.   ProductMedia ownership наследуется от Product;
 *   §18   legacy/unowned (partnerId null) Product не виден PARTNER и не привязывается;
 *   §24   suspended actor → 401; permission-only (read) не даёт write;
 *   FIX1  update_own_draft = только DRAFT: PARTNER edit DRAFT → 200; COMPLETE/REVIEWED/
 *         PUBLISHED → 409; ADMIN сохраняет полный lifecycle (staff edit post-submit → 200);
 *   FIX2  MODERATOR без catalog.product.publish: direct publish/archive → 403;
 *         moderation-read (product/preview) сохранены;
 *   FIX3  BUYER без catalog.product.read: internal/draft Product недоступен (403).
 *
 * Test DB: изолированная (Step 1.0); media storage: изолированный MinIO (Step 1.2).
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
  type: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  status: string;
  originalFileName: string;
  createdAt: string;
}

interface ProductRow {
  id: string;
  code: string;
  title: string;
  status: string;
  partnerId: string | null;
}

async function makeJpegBuffer(width = 200, height = 120): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } })
    .jpeg()
    .toBuffer();
}

describe("Phase 1 Step 1.3 — Product Ownership & PARTNER Object Scope (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; partners: string[]; products: string[]; media: string[] } = {
    users: [],
    partners: [],
    products: [],
    media: [],
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
  let partnerAAgent: ReturnType<typeof request.agent>;
  let partnerBAgent: ReturnType<typeof request.agent>;
  let moderatorAgent: ReturnType<typeof request.agent>;
  let salesAgent: ReturnType<typeof request.agent>;

  let partnerAId: string;
  let partnerBId: string;
  let productA: ProductRow;
  let productB: ProductRow;
  let productAdmin: ProductRow;
  let productOverride: ProductRow;
  let mediaA: MediaRow;

  const partnerAName = `scope-partner-a-${stamp}`;
  const partnerBName = `scope-partner-b-${stamp}`;
  const partnerAUser = `scopepartnera${stamp}`;
  const partnerBUser = `scopepartnerb${stamp}`;

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

    // ── Org: два Partner (crm.*) ─────────────────────────────────────────────
    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: partnerAName }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partnerAId = p1.id;
    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: partnerBName }).expect(201)).body as { id: string };
    created.partners.push(p2.id);
    partnerBId = p2.id;

    // ── Users: PARTNER A/B, MODERATOR, SALES_MANAGER ─────────────────────────
    const uA = (await adminAgent.post("/api/v1/users").send({ username: partnerAUser, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body;
    created.users.push(uA.id);
    partnerAAgent = await agent((await login(partnerAUser, "partnerpass123")).accessToken);

    const uB = (await adminAgent.post("/api/v1/users").send({ username: partnerBUser, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body;
    created.users.push(uB.id);
    partnerBAgent = await agent((await login(partnerBUser, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `scopemod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    moderatorAgent = await agent((await login(`scopemod${stamp}`, "modpass123")).accessToken);

    const sales = (await adminAgent.post("/api/v1/users").send({ username: `scopesales${stamp}`, password: "salespass123", roleCode: RoleCode.SALES_MANAGER })).body;
    created.users.push(sales.id);
    salesAgent = await agent((await login(`scopesales${stamp}`, "salespass123")).accessToken);

    // ── Products: owned A / owned B / system-owned (admin, partnerId null) ────
    productA = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Scope A ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(productA.id);
    productB = (await partnerBAgent.post("/api/v1/products").send({ type: "TOUR", title: `Scope B ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(productB.id);
    productAdmin = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Scope Admin ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(productAdmin.id);

    // ── Admin ownership override (explicit partnerId) ────────────────────────
    productOverride = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Scope Override ${stamp}`, partnerId: p1.id, ownershipReason: "Onboarding partner A" })
        .expect(201)
    ).body.product as ProductRow;
    created.products.push(productOverride.id);

    // ── Media: один upload в product A (владелец = partner A) ────────────────
    const jpeg = await makeJpegBuffer();
    const up = (await partnerAAgent
      .post(`/api/v1/products/${productA.id}/media`)
      .attach("files", jpeg, { filename: "scope.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    mediaA = up.media[0];
    created.media.push(mediaA.id);
  });

  afterAll(async () => {
    await prisma.productMedia.deleteMany({ where: { id: { in: created.media } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
    await stopTestMinIO();
  });

  it("1-2. ownership ставится backend-ом; body partnerId PARTNER игнорируется (forge)", async () => {
    expect(productA.partnerId).toBe(partnerAId);
    expect(productB.partnerId).toBe(partnerBId);

    // PARTNER A пытается подменить ownership в body → сервер берёт scope из актора.
    const forged = (
      await partnerAAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Scope Forge ${stamp}`, partnerId: partnerBId })
        .expect(201)
    ).body.product as ProductRow;
    created.products.push(forged.id);
    expect(forged.partnerId).toBe(partnerAId); // НЕ partnerBId
  });

  it("3-4+12. list server-side scoped: PARTNER A видит только свои; count/total не учитывает чужие", async () => {
    const listA = (await partnerAAgent.get("/api/v1/products?pageSize=100").expect(200)).body as {
      items: ProductRow[];
      total: number;
    };
    const idsA = listA.items.map((p) => p.id);
    expect(idsA).toContain(productA.id);
    expect(idsA).toContain(productOverride.id); // admin override → тоже партнёр A
    expect(idsA).not.toContain(productB.id); // чужой PARTNER B
    expect(idsA).not.toContain(productAdmin.id); // unowned/system
    // productA + forged (тест 1) + productOverride — БЕЗ productB/productAdmin
    expect(listA.total).toBe(3);

    const listB = (await partnerBAgent.get("/api/v1/products?pageSize=100").expect(200)).body as { items: ProductRow[]; total: number };
    expect(listB.items.map((p) => p.id)).toContain(productB.id);
    expect(listB.items.map((p) => p.id)).not.toContain(productA.id);
    expect(listB.total).toBe(1);

    // pagination count leakage: total на page 2 тоже scoped
    const page2 = (await partnerAAgent.get("/api/v1/products?page=2&pageSize=1").expect(200)).body as { items: ProductRow[]; total: number };
    expect(page2.total).toBe(3);
    expect(page2.items.length).toBe(1);
  });

  it("5. IDOR: PARTNER B не может GET Product A по ID (403)", async () => {
    await partnerBAgent.get(`/api/v1/products/${productA.id}`).expect(403);
  });

  it("6. PARTNER B не может PATCH Product A (403)", async () => {
    await partnerBAgent.patch(`/api/v1/products/${productA.id}`).send({ title: "Hack A" }).expect(403);
  });

  it("7. PARTNER B не может upload media Product A (403)", async () => {
    await partnerBAgent
      .post(`/api/v1/products/${productA.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "hack.jpg", contentType: "image/jpeg" })
      .expect(403);
  });

  it("8. PARTNER B не может preview media Product A (signed URL чужого media, 403)", async () => {
    await partnerBAgent.post(`/api/v1/products/${productA.id}/media/${mediaA.id}/preview`).send({}).expect(403);
  });

  it("9. PARTNER B не может delete media Product A (403)", async () => {
    await partnerBAgent.delete(`/api/v1/products/${productA.id}/media/${mediaA.id}`).expect(403);
  });

  it("10. PARTNER B не может set-primary Product A (403)", async () => {
    await partnerBAgent.post(`/api/v1/products/${productA.id}/media/${mediaA.id}/set-primary`).expect(403);
  });

  it("11. PARTNER B не может reorder media Product A (403)", async () => {
    await partnerBAgent.post(`/api/v1/products/${productA.id}/media/reorder`).send({ orderedIds: [mediaA.id] }).expect(403);
  });

  it("21. cross-product mediaId: media чужого Product недоступен даже владельцу своего", async () => {
    // mediaB создаём под product B (владелец — partner B).
    const upB = (await partnerBAgent
      .post(`/api/v1/products/${productB.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "b.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    created.media.push(upB.media[0].id);

    // partner A (владелец product A) обращается к mediaId продукта B через route product A → 404.
    await partnerAAgent.delete(`/api/v1/products/${productA.id}/media/${upB.media[0].id}`).expect(404);
  });

  it("§24 availability read server-side scoped: свой — 200, чужой — 403", async () => {
    // ADMIN (catalog.availability.write) создаёт availability на product A
    // (Step 1.3 fix: MODERATOR больше НЕ имеет availability.write — только moderation).
    await adminAgent
      .post(`/api/v1/products/${productA.id}/availability`)
      .send({ date: "2026-12-31", slotsTotal: 5 })
      .expect(201);
    // MODERATOR не может писать availability (нет права) — 403.
    await moderatorAgent
      .post(`/api/v1/products/${productA.id}/availability`)
      .send({ date: "2027-01-01", slotsTotal: 5 })
      .expect(403);
    const own = (await partnerAAgent.get(`/api/v1/products/${productA.id}/availability`).expect(200)).body as unknown[];
    expect(own.length).toBe(1);
    // PARTNER B (read_own проходит guard, но object scope в сервисе блокирует) → 403.
    await partnerBAgent.get(`/api/v1/products/${productA.id}/availability`).expect(403);
  });

  it("13. MODERATOR может читать Product для moderation (read_for_moderation)", async () => {
    await moderatorAgent.get(`/api/v1/products/${productA.id}`).expect(200);
    await moderatorAgent.get(`/api/v1/products/${productB.id}`).expect(200);
    await moderatorAgent.get("/api/v1/products?pageSize=100").expect(200);
  });

  it("14. MODERATOR может preview media (read_for_moderation)", async () => {
    const preview = (await moderatorAgent.post(`/api/v1/products/${productA.id}/media/${mediaA.id}/preview`).send({}).expect(201)).body as {
      url: string;
      expiresIn: number;
    };
    expect(preview.expiresIn).toBe(300);
    expect(preview.url).toContain("X-Amz-Signature");
  });

  it("15. MODERATOR не может PATCH Product content (403)", async () => {
    await moderatorAgent.patch(`/api/v1/products/${productA.id}`).send({ title: "Mod edit" }).expect(403);
  });

  it("16. MODERATOR не может upload/replace/delete media (403)", async () => {
    await moderatorAgent
      .post(`/api/v1/products/${productA.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "m.jpg", contentType: "image/jpeg" })
      .expect(403);
    await moderatorAgent.post(`/api/v1/products/${productA.id}/media/${mediaA.id}/replace`).attach("file", await makeJpegBuffer(), { filename: "m2.jpg", contentType: "image/jpeg" }).expect(403);
    await moderatorAgent.delete(`/api/v1/products/${productA.id}/media/${mediaA.id}`).expect(403);
    await moderatorAgent.patch(`/api/v1/products/${productA.id}/media/${mediaA.id}`).send({ caption: "mod" }).expect(403);
  });

  it("17. ADMIN действует через explicit permissions (read + write)", async () => {
    await adminAgent.get(`/api/v1/products/${productA.id}`).expect(200);
    const patched = (await adminAgent.patch(`/api/v1/products/${productA.id}`).send({ title: `Scope A admin ${stamp}` }).expect(200)).body as {
      partnerId: string | null;
    };
    expect(patched.partnerId).toBe(partnerAId); // partnerId не меняется админом без override
  });

  it("18. admin ownership override аудитируется (actor + reason)", async () => {
    expect(productOverride.partnerId).toBe(partnerAId);
    const history = await prisma.productHistory.findMany({
      where: { productId: productOverride.id, action: "ownership.override" },
      orderBy: { createdAt: "asc" },
    });
    expect(history.length).toBe(1);
    expect(history[0].actorName).toBe("admin");
    const fields = history[0].fields as { partnerId?: string; reason?: string };
    expect(fields.partnerId).toBe(partnerAId);
    expect(fields.reason).toBe("Onboarding partner A");
  });

  it("19. PARTNER не может напрямую publish Product (403)", async () => {
    await partnerAAgent.post(`/api/v1/products/${productA.id}/publish`).expect(403);
    await partnerAAgent.post(`/api/v1/products/${productA.id}/archive`).expect(403);
  });

  it("20. ownership нельзя обойти через body: PATCH с forged partnerId не меняет owner", async () => {
    // UpdateProductDto НЕ содержит partnerId → whitelist отбрасывает (stripped).
    const after = (
      await partnerAAgent.patch(`/api/v1/products/${productA.id}`).send({ title: `Scope A forged ${stamp}`, partnerId: partnerBId }).expect(200)
    ).body as { partnerId: string | null };
    expect(after.partnerId).toBe(partnerAId);
  });

  it("§18 legacy/unowned: Product с partnerId null не виден PARTNER и не привязывается", async () => {
    expect(productAdmin.partnerId).toBeNull();
    await adminAgent.get(`/api/v1/products/${productAdmin.id}`).expect(200); // system-owned read
    const listA = (await partnerAAgent.get("/api/v1/products?pageSize=100").expect(200)).body as { items: ProductRow[] };
    expect(listA.items.map((p) => p.id)).not.toContain(productAdmin.id);
  });

  it("§24 permission-only bypass: staff read (catalog.product.read) не даёт media write", async () => {
    await salesAgent.get("/api/v1/products?pageSize=100").expect(200); // read разрешён
    await salesAgent
      .post(`/api/v1/products/${productA.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "s.jpg", contentType: "image/jpeg" })
      .expect(403); // нет media прав
  });

  // ── Step 1.3 review fixes ────────────────────────────────────────────────────

  it("FIX1a. PARTNER edit DRAFT → allowed; ownership сохраняется", async () => {
    const p = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1a ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(p.id);
    expect(p.status).toBe("DRAFT");
    const after = (await partnerAAgent.patch(`/api/v1/products/${p.id}`).send({ title: `Fix1a edited ${stamp}` }).expect(200)).body as {
      title: string;
      partnerId: string | null;
    };
    expect(after.title).toContain("Fix1a edited");
    expect(after.partnerId).toBe(partnerAId);
  });

  it("FIX1b. PARTNER edit COMPLETE/REVIEWED → 409; PUBLISHED → change proposal draft (200, live N не меняется)", async () => {
    // COMPLETE (post-submit) — прямая правка запрещена (re-moderation required).
    const complete = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1b-complete ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(complete.id);
    await prisma.product.update({ where: { id: complete.id }, data: { status: "COMPLETE" } });
    await partnerAAgent.patch(`/api/v1/products/${complete.id}`).send({ title: "Hack" }).expect(409);

    // REVIEWED — запрещено.
    const reviewed = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1b-reviewed ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(reviewed.id);
    await prisma.product.update({ where: { id: reviewed.id }, data: { status: "REVIEWED" } });
    await partnerAAgent.patch(`/api/v1/products/${reviewed.id}`).send({ title: "Hack" }).expect(409);

    // Step 1.4 review fix 1: PUBLISHED → PARTNER готовит change proposal N+1 через draft
    // (live approved N НЕ изменяется: 200, live title/version прежние, draft появился).
    const published = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1b-published ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(published.id);
    await adminAgent.post(`/api/v1/products/${published.id}/publish`).expect(201);
    const patchRes = (await partnerAAgent.patch(`/api/v1/products/${published.id}`).send({ title: `Fix1b N+1 ${stamp}` }).expect(200)).body as {
      product: { title: string; version: number; partnerId: string | null };
      draft: { title: string };
      changeProposal: boolean;
    };
    // live N не изменился; draft содержит N+1.
    expect(patchRes.product.title).toBe(`Fix1b-published ${stamp}`);
    expect(patchRes.product.version).toBeGreaterThan(0);
    expect(patchRes.draft.title).toBe(`Fix1b N+1 ${stamp}`);
    expect(patchRes.changeProposal).toBe(true);

    // Ownership корректен после правок (live + draft принадлежат партнёру).
    for (const id of [complete.id, reviewed.id, published.id]) {
      const row = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(row.partnerId).toBe(partnerAId);
    }
    // Draft не несёт собственный ownership — наследует через Product (live owner не меняется).
    const draftRow = await prisma.productDraft.findUniqueOrThrow({ where: { productId: published.id } });
    expect(draftRow.title).toBe(`Fix1b N+1 ${stamp}`);
    const prodRow = await prisma.product.findUniqueOrThrow({ where: { id: published.id } });
    expect(prodRow.partnerId).toBe(partnerAId);
    expect(prodRow.title).toBe(`Fix1b-published ${stamp}`); // live N неизменен
  });

  it("FIX1c. ADMIN (staff) может править post-submit состояния (полный lifecycle сохранён)", async () => {
    const p = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1c ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(p.id);
    await prisma.product.update({ where: { id: p.id }, data: { status: "REVIEWED" } });
    const patched = (await adminAgent.patch(`/api/v1/products/${p.id}`).send({ title: `Fix1c admin ${stamp}` }).expect(200)).body as {
      partnerId: string | null;
    };
    expect(patched.partnerId).toBe(partnerAId);
  });

  it("FIX1d. PARTNER не может прямо мутировать PUBLISHED media живого продукта (409); staging DRAFT — разрешён", async () => {
    // Свежий продукт PARTNER A + media; ADMIN публикует (controlled transition) → media PUBLISHED.
    const p = (await partnerAAgent.post("/api/v1/products").send({ type: "TOUR", title: `Fix1d ${stamp}` }).expect(201)).body.product as ProductRow;
    created.products.push(p.id);
    const up = (await partnerAAgent
      .post(`/api/v1/products/${p.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "live.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);
    await adminAgent.post(`/api/v1/products/${p.id}/publish`).expect(201);

    // Прямые live-мутации PUBLISHED media → 409 (re-moderation required).
    await partnerAAgent.patch(`/api/v1/products/${p.id}/media/${mediaId}`).send({ caption: "hack" }).expect(409);
    await partnerAAgent.delete(`/api/v1/products/${p.id}/media/${mediaId}`).expect(409);
    await partnerAAgent.post(`/api/v1/products/${p.id}/media/${mediaId}/set-primary`).expect(409);
    await partnerAAgent.post(`/api/v1/products/${p.id}/media/reorder`).send({ orderedIds: [mediaId] }).expect(409);

    // Санкционированный staging-путь сохранён: PARTNER может загрузить НОВУЮ DRAFT media
    // на опубликованный продукт (публикуется только через controlled re-publish).
    const staged = (await partnerAAgent
      .post(`/api/v1/products/${p.id}/media`)
      .attach("files", await makeJpegBuffer(), { filename: "draft.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    created.media.push(staged.media[0].id);
    expect(staged.media[0].status).toBe("DRAFT");

    // Ownership продукта не изменился.
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.partnerId).toBe(partnerAId);
  });

  it("FIX2. MODERATOR не может direct publish/archive (403); moderation-read сохранены", async () => {
    await moderatorAgent.post(`/api/v1/products/${productA.id}/publish`).expect(403);
    await moderatorAgent.post(`/api/v1/products/${productA.id}/archive`).expect(403);
    // moderation-read сохранены.
    await moderatorAgent.get(`/api/v1/products/${productA.id}`).expect(200);
    const preview = (await moderatorAgent.post(`/api/v1/products/${productA.id}/media/${mediaA.id}/preview`).send({}).expect(201)).body as {
      url: string;
    };
    expect(preview.url).toContain("X-Amz-Signature");
  });

  it("FIX3. BUYER не может читать internal/draft Product (403)", async () => {
    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `scopebuyer${stamp}`, email: `scopebuyer${stamp}@test.local`, password: "buyerpass123", fullName: "Buyer Scope" })
      .expect(201);
    created.users.push(reg.body.user.id);
    const buyer = reg.body.user as { permissions: string[] };
    expect(buyer.permissions).not.toContain("catalog.product.read");

    const buyerAgent = await agent(reg.body.accessToken);
    await buyerAgent.get("/api/v1/products").expect(403);
    await buyerAgent.get(`/api/v1/products/${productA.id}`).expect(403);
    await buyerAgent.get(`/api/v1/products/${productA.id}/media`).expect(403);
  });

  it("§24 suspended actor: LOCKED пользователь не может войти (401)", async () => {
    const locked = (await adminAgent.post("/api/v1/users").send({ username: `scopelocked${stamp}`, password: "lockedpass123", roleCode: RoleCode.PARTNER, partnerId: partnerBId })).body;
    created.users.push(locked.id);
    await adminAgent.patch(`/api/v1/users/${locked.id}/status`).send({ status: "LOCKED" }).expect(200);
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: `scopelocked${stamp}`, password: "lockedpass123" }).expect(401);
  });
});
