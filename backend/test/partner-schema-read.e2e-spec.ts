/**
 * E2E Phase 1 Step 1.8 (clarification) — Partner-safe ACTIVE Category Schema read.
 *
 * PARTNER НЕ получает внутреннее `catalog.category_schema.read` (internal/admin
 * schema management) — только отдельное право
 * `catalog.category_schema.read_active_for_product_edit` и отдельный read-contract
 * `GET /api/v1/partner/categories/:slug/schema` для dynamic Product form/editor.
 *
 * Доказательства:
 *   1. PARTNER читает ACTIVE schema → 200 (только editor-данные, без admin/audit-полей);
 *   2. PARTNER не имеет `catalog.category_schema.read` (permissions + internal endpoint 403);
 *   3. PARTNER не может читать DRAFT schema (нет ACTIVE → 404; internal read → 403; обход ?version= → 422);
 *   4. PARTNER не может читать DEPRECATED schema (только DEPRECATED → 404; internal read → 403);
 *   5. PARTNER не может менять schema (create/patch/activate/deprecate → 403);
 *   6. BUYER → denied (403);
 *   7. anonymous → denied (401);
 *   8. dynamic Product form строится через Partner-safe endpoint (schema → POST /products 201).
 *
 * Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную тестовую
 * БД (TEST_DATABASE_URL) — dev-БД не используется.
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

interface EditorAttribute {
  key: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  pattern?: string;
}

interface EditorContract {
  category: { id: string; code: string; slug: string; title: string };
  schema: {
    id: string;
    version: number;
    status: "ACTIVE";
    attributes: EditorAttribute[];
    availability: Record<string, unknown> | null;
    tariffRules: Record<string, unknown> | null;
    mediaRequirements: { minImages?: number; maxImages?: number; primaryImageRequired?: boolean; allowedMediaTypes?: string[]; videoAllowed?: boolean } | null;
    pdpSections: string[] | null;
  };
}

describe("Phase 1 Step 1.8 — Partner ACTIVE Category Schema read (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; partners: string[]; products: string[]; categories: string[]; schemas: string[] } = {
    users: [],
    partners: [],
    products: [],
    categories: [],
    schemas: [],
  };
  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; permissions: string[] } };
  };

  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let moderatorAgent: ReturnType<typeof request.agent>;
  let partnerAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let partnerId: string;
  let partnerPermissions: string[];

  /** Заполнение валидного значения attribute по типу из editor-контракта. */
  const sampleValue = (def: EditorAttribute): unknown => {
    switch (def.type) {
      case "integer":
      case "number":
        return def.min ?? 1;
      case "boolean":
        return true;
      case "enum":
        return def.options?.[0] ?? "unknown";
      case "date":
        return "2026-12-31";
      default:
        return "test-value";
    }
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

    // CRM Partner (владелец продукта) для PARTNER-пользователя.
    const crmPartner = (await adminAgent.post("/api/v1/partners").send({ name: `Schema Partner ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(crmPartner.id);
    partnerId = crmPartner.id;

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `editschema_mod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    moderatorAgent = await agent((await login(`editschema_mod${stamp}`, "modpass123")).accessToken);

    const partner = (
      await adminAgent.post("/api/v1/users").send({ username: `editschema_partner${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId })
    ).body;
    created.users.push(partner.id);
    const partnerLogin = await login(`editschema_partner${stamp}`, "partnerpass123");
    partnerPermissions = partnerLogin.user.permissions;
    partnerAgent = await agent(partnerLogin.accessToken);

    const buyer = (await adminAgent.post("/api/v1/users").send({ username: `editschema_buyer${stamp}`, password: "buypass123", roleCode: RoleCode.BUYER })).body;
    created.users.push(buyer.id);
    buyerAgent = await agent((await login(`editschema_buyer${stamp}`, "buypass123")).accessToken);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.categorySchema.deleteMany({ where: { id: { in: created.schemas } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  it("1. PARTNER читает ACTIVE schema → 200 (только editor-данные, без admin/audit-полей)", async () => {
    const res = await partnerAgent.get("/api/v1/partner/categories/tours/schema").expect(200);
    const body = res.body as EditorContract;
    expect(body.category.slug).toBe("tours");
    expect(body.category.id).toBeTruthy();
    expect(body.category.code).toMatch(/^CAT-/);
    expect(body.schema.status).toBe("ACTIVE");
    expect(body.schema.version).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.schema.attributes)).toBe(true);
    expect(body.schema.attributes.length).toBeGreaterThan(0);
    for (const def of body.schema.attributes) {
      expect(typeof def.key).toBe("string");
      expect(typeof def.type).toBe("string");
    }
    expect(Array.isArray(body.schema.pdpSections)).toBe(true);

    // Нет утечки internal/admin/audit полей и raw Prisma-объекта.
    // status="ACTIVE" — часть контракта (какая версия активна), а НЕ admin-метаданные.
    const json = JSON.stringify(body);
    expect(json).not.toContain("createdById");
    expect(json).not.toContain("createdBy");
    expect(json).not.toContain("createdAt");
    expect(json).not.toContain("updatedAt");
    expect(json).not.toContain("versioned");
    expect(json).not.toContain("storageKey");
  });

  it("1b. media/availability/tariff requirements отдаются (accommodation schema)", async () => {
    const body = (await partnerAgent.get("/api/v1/partner/categories/accommodation/schema").expect(200)).body as EditorContract;
    // canonical accommodation: minImages=5, primaryImageRequired=true (Step 1.1 seed).
    expect(body.schema.mediaRequirements?.minImages).toBe(5);
    expect(body.schema.mediaRequirements?.primaryImageRequired).toBe(true);
    // Контракт хранит availability/tariffRules как конфигурацию (может быть null — не обязателен).
    expect("availability" in body.schema).toBe(true);
    expect("tariffRules" in body.schema).toBe(true);
  });

  it("2. PARTNER не имеет catalog.category_schema.read (только read_active_for_product_edit)", async () => {
    expect(partnerPermissions).toContain("catalog.category_schema.read_active_for_product_edit");
    expect(partnerPermissions).not.toContain("catalog.category_schema.read");
    // Внутренний internal schema endpoint закрыт для PARTNER.
    await partnerAgent.get("/api/v1/category-schemas").expect(403);
    await partnerAgent.get("/api/v1/category-schemas/some-id").expect(403);
  });

  it("3. PARTNER не может читать DRAFT schema (404) и не обходит через ?version= (422)", async () => {
    // Свежая категория только с DRAFT schema (не активирована).
    const cat = (
      await adminAgent.post("/api/v1/categories").send({ title: `Draft Only ${stamp}`, slug: `draftonly-${stamp}` }).expect(201)
    ).body as { id: string; slug: string };
    created.categories.push(cat.id);
    const draft = (
      await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "draftAttr", type: "string", required: true }] }).expect(201)
    ).body as { id: string; status: string };
    created.schemas.push(draft.id);
    expect(draft.status).toBe("DRAFT");

    // Нет ACTIVE → neutral 404.
    await partnerAgent.get(`/api/v1/partner/categories/${cat.slug}/schema`).expect(404);
    // Внутренний read конкретной DRAFT схемы закрыт для PARTNER.
    await partnerAgent.get(`/api/v1/category-schemas/${draft.id}`).expect(403);
    // Обход версии через query → deny (422).
    await partnerAgent.get("/api/v1/partner/categories/tours/schema?version=1").expect(422);
    await partnerAgent.get("/api/v1/partner/categories/tours/schema?schemaId=abc").expect(422);
  });

  it("4. PARTNER не может читать DEPRECATED schema (только DEPRECATED → 404)", async () => {
    const cat = (
      await adminAgent.post("/api/v1/categories").send({ title: `Deprec ${stamp}`, slug: `deprecatedonly-${stamp}` }).expect(201)
    ).body as { id: string; slug: string };
    created.categories.push(cat.id);

    const v1 = (await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "a", type: "string" }] }).expect(201)).body as { id: string };
    created.schemas.push(v1.id);
    await adminAgent.post(`/api/v1/category-schemas/${v1.id}/activate`).expect(201);

    const v2 = (await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "b", type: "integer" }] }).expect(201)).body as { id: string };
    created.schemas.push(v2.id);
    // activate v2 → v1 становится DEPRECATED.
    await adminAgent.post(`/api/v1/category-schemas/${v2.id}/activate`).expect(201);

    // deprecate v2 → у категории больше НЕТ ACTIVE схемы.
    await adminAgent.post(`/api/v1/category-schemas/${v2.id}/deprecate`).expect(201);

    // Только DEPRECATED → neutral 404.
    await partnerAgent.get(`/api/v1/partner/categories/${cat.slug}/schema`).expect(404);
    // Внутренний read DEPRECATED схемы закрыт для PARTNER.
    await partnerAgent.get(`/api/v1/category-schemas/${v2.id}`).expect(403);
  });

  it("5. PARTNER не может менять schema (create/patch/activate/deprecate → 403)", async () => {
    await partnerAgent.post("/api/v1/category-schemas").send({ categoryId: "x", attributes: [] }).expect(403);
    await partnerAgent.patch("/api/v1/category-schemas/some-id").send({ attributes: [] }).expect(403);
    await partnerAgent.post("/api/v1/category-schemas/some-id/activate").expect(403);
    await partnerAgent.post("/api/v1/category-schemas/some-id/deprecate").expect(403);
  });

  it("6. BUYER не получает partner-editor schema (403)", async () => {
    await buyerAgent.get("/api/v1/partner/categories/tours/schema").expect(403);
    await buyerAgent.get("/api/v1/category-schemas").expect(403);
  });

  it("7. anonymous не получает partner-editor schema (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/partner/categories/tours/schema").expect(401);
    await request(app.getHttpServer()).get("/api/v1/category-schemas").expect(401);
  });

  it("8. dynamic Product form строится через Partner-safe endpoint (schema → POST /products 201)", async () => {
    // Форма: контракт даёт category.id + attributes (тип/required/options/min/max).
    const contract = (await partnerAgent.get("/api/v1/partner/categories/tours/schema").expect(200)).body as EditorContract;

    const attributes: Record<string, unknown> = {};
    for (const def of contract.schema.attributes) {
      if (def.required) attributes[def.key] = sampleValue(def);
    }

    const res = await partnerAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `Partner Editor Product ${stamp}`, categoryId: contract.category.id, attributes })
      .expect(201);
    const product = res.body.product as { id: string; categoryId: string; categorySchemaId: string; partnerId: string; attributes: Record<string, unknown> };
    created.products.push(product.id);
    expect(product.categoryId).toBe(contract.category.id);
    expect(product.categorySchemaId).toBe(contract.schema.id);
    expect(product.partnerId).toBe(partnerId); // ownership берётся из актора, не из body
    // attributes прошли валидацию по ACTIVE схеме (обязательные заполнены из контракта).
    expect(product.attributes).toBeTruthy();
  });

  it("9. MODERATOR использует СВОИ существующие contracts (НЕ partner editor contract)", async () => {
    // MODERATOR не имеет partner-права → 403; свои moderation-read endpoints сохранены.
    await moderatorAgent.get("/api/v1/partner/categories/tours/schema").expect(403);
    const res = await moderatorAgent.get("/api/v1/products?status=COMPLETE").expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
