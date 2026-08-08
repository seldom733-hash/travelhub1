/**
 * E2E Phase 1 Step 1.1 — Category Schema foundation.
 *
 * Доказательства (требование Step 1.1 §12):
 *   1. канонические категории (Master 1.5) + ACTIVE schema v1 засеяны; media — конфигурация;
 *   2. Product принимает валидные category-specific attributes;
 *   3. невалидный тип attribute отклоняется (422);
 *   4. неизвестный attribute отклоняется (422);
 *   5. обязательный attribute проверяется (422);
 *   6. PARTNER/MODERATOR не могут изменять Category Schema (RBAC);
 *   7. изменение schema не удаляет существующий Product (snapshot версии);
 *   8. media requirements сохраняются, media functionality отсутствует;
 *   9. новая категория добавляется без новой Product entity/таблицы;
 *   10. lifecycle schema: DRAFT → PATCH → ACTIVE → DEPRECATED (повторная активация — 409).
 *
 * Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную
 * тестовую БД (TEST_DATABASE_URL) до импорта AppModule — dev-БД не используется.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";

interface SchemaRow {
  id: string;
  categoryId: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  attributes: Array<{ key: string; type: string; required?: boolean; options?: string[] }>;
  mediaRequirements?: { minImages?: number; maxImages?: number; primaryImageRequired?: boolean; allowedMediaTypes?: string[]; videoAllowed?: boolean };
  pdpSections?: string[];
}

describe("Phase 1 Step 1.1 — Category Schema foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; categories: string[]; schemas: string[] } = {
    users: [],
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

  const categoryIdBySlug = async (slug: string): Promise<string> => {
    const res = await adminAgent.get("/api/v1/categories").expect(200);
    const found = (res.body as Array<{ id: string; slug: string }>).find((c) => c.slug === slug);
    if (!found) throw new Error(`Canonical category '${slug}' not seeded`);
    return found.id;
  };

  const activeSchema = async (categoryId: string): Promise<SchemaRow> => {
    const schemas = (await adminAgent.get(`/api/v1/category-schemas?categoryId=${categoryId}`).expect(200)).body as SchemaRow[];
    const active = schemas.find((s) => s.status === "ACTIVE");
    if (!active) throw new Error("No ACTIVE schema");
    return active;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const mod = (
      await adminAgent.post("/api/v1/users").send({ username: `catschemamod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })
    ).body;
    created.users.push(mod.id);
    moderatorAgent = await agent((await login(`catschemamod${stamp}`, "modpass123")).accessToken);

    const partner = (
      await adminAgent.post("/api/v1/users").send({ username: `catschemapartner${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER })
    ).body;
    created.users.push(partner.id);
    partnerAgent = await agent((await login(`catschemapartner${stamp}`, "partnerpass123")).accessToken);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.categorySchema.deleteMany({ where: { id: { in: created.schemas } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. канонические категории и ACTIVE schema v1 засеяны (media — только конфигурация)", async () => {
    const categories = (await adminAgent.get("/api/v1/categories").expect(200)).body as Array<{ slug: string }>;
    const slugs = categories.map((c) => c.slug);
    for (const s of ["tours", "accommodation", "excursions", "transfers", "car-rental", "flights", "rail", "cruises", "guides", "visa-services"]) {
      expect(slugs).toContain(s);
    }

    const accId = await categoryIdBySlug("accommodation");
    const active = await activeSchema(accId);
    expect(active.version).toBe(1);
    const checkIn = active.attributes.find((d) => d.key === "checkIn");
    expect(checkIn).toBeTruthy();
    expect(checkIn!.type).toBe("time");
    expect(checkIn!.required).toBe(true);
    expect(active.mediaRequirements?.minImages).toBe(5);
    expect(active.mediaRequirements?.primaryImageRequired).toBe(true);
    expect(Array.isArray(active.pdpSections)).toBe(true);

    // media endpoints отсутствуют (Step 1.2 не реализован) → 404
    await adminAgent.post("/api/v1/products/some-id/media").send({}).expect(404);
  });

  it("2. Product принимает валидные category-specific attributes (Accommodation)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    const res = await adminAgent
      .post("/api/v1/products")
      .send({
        type: "HOTEL",
        title: `CatSchema Hotel ${stamp}`,
        categoryId: accId,
        attributes: { checkIn: "14:00", checkOut: "12:00", roomType: "deluxe", mealPlan: "bed_breakfast", amenities: "pool, wifi", starRating: 4 },
      })
      .expect(201);
    const product = res.body.product;
    created.products.push(product.id);
    expect(product.categoryId).toBe(accId);
    expect(product.categorySchemaId).toBeTruthy();
    expect(product.attributes.checkIn).toBe("14:00");
    expect(product.attributes.starRating).toBe(4);
  });

  it("3. невалидный тип attribute отклоняется (422)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    await adminAgent
      .post("/api/v1/products")
      .send({
        type: "HOTEL",
        title: `Bad type ${stamp}`,
        categoryId: accId,
        attributes: { checkIn: 123, checkOut: "12:00", roomType: "standard", starRating: 4 },
      })
      .expect(422);
  });

  it("4. неизвестный attribute отклоняется (422)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    await adminAgent
      .post("/api/v1/products")
      .send({
        type: "HOTEL",
        title: `Unknown attr ${stamp}`,
        categoryId: accId,
        attributes: { checkIn: "14:00", checkOut: "12:00", roomType: "standard", starRating: 4, hacker: "x" },
      })
      .expect(422);
  });

  it("5. обязательный attribute проверяется (422)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    await adminAgent
      .post("/api/v1/products")
      .send({
        type: "HOTEL",
        title: `Missing required ${stamp}`,
        categoryId: accId,
        attributes: { checkOut: "12:00", roomType: "standard" },
      })
      .expect(422);
  });

  it("6. PARTNER не может изменять Category Schema; MODERATOR — только чтение (RBAC)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    await partnerAgent.post("/api/v1/category-schemas").send({ categoryId: accId, attributes: [] }).expect(403);
    await partnerAgent.patch("/api/v1/category-schemas/some-id").send({ attributes: [] }).expect(403);
    await partnerAgent.post("/api/v1/category-schemas/some-id/activate").expect(403);
    await partnerAgent.get("/api/v1/category-schemas").expect(403);

    await moderatorAgent.post("/api/v1/category-schemas").send({ categoryId: accId, attributes: [] }).expect(403);
    await moderatorAgent.patch("/api/v1/category-schemas/some-id").send({ attributes: [] }).expect(403);
    await moderatorAgent.get("/api/v1/category-schemas").expect(200);
  });

  it("7. изменение schema не удаляет существующий Product (snapshot версии)", async () => {
    const accId = await categoryIdBySlug("accommodation");
    const draft = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({
          categoryId: accId,
          attributes: [
            { key: "checkIn", type: "time", required: true },
            { key: "checkOut", type: "time" },
          ],
          mediaRequirements: { minImages: 10, maxImages: 50, primaryImageRequired: true },
          pdpSections: ["overview", "gallery"],
        })
        .expect(201)
    ).body as SchemaRow;
    created.schemas.push(draft.id);
    expect(draft.status).toBe("DRAFT");
    expect(draft.version).toBe(2);

    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/activate`).expect(201);

    // Существующий продукт (тест 2) жив и ссылается на прежнюю версию schema (v1).
    const product = (await adminAgent.get(`/api/v1/products/${created.products[0]}`).expect(200)).body;
    expect(product.status).toBe("DRAFT");
    expect(product.categorySchema.version).toBe(1);
    expect(product.attributes.starRating).toBe(4);

    // §5-контракт: правка исторического продукта (с эхо categoryId, как делает UI)
    // валидируется по его схеме-снапшоту v1, а не по новой ACTIVE v2
    // (в v2 нет roomType/starRating — без фикса был бы 422 "Unknown attribute").
    const echoed = (
      await adminAgent.patch(`/api/v1/products/${created.products[0]}`).send({ title: `CatSchema Hotel updated ${stamp}`, categoryId: accId }).expect(200)
    ).body;
    expect(echoed.categorySchemaId).toBe(product.categorySchemaId);
    expect(echoed.attributes.starRating).toBe(4);

    const list = await adminAgent.get("/api/v1/products").expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });

  it("8. media requirements сохраняются; media functionality отсутствует", async () => {
    const toursId = await categoryIdBySlug("tours");
    const draft = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({
          categoryId: toursId,
          attributes: [{ key: "days", type: "integer" }],
          mediaRequirements: { minImages: 3, maxImages: 15, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: true },
        })
        .expect(201)
    ).body as SchemaRow;
    created.schemas.push(draft.id);

    const patched = (
      await adminAgent
        .patch(`/api/v1/category-schemas/${draft.id}`)
        .send({
          attributes: [{ key: "days", type: "integer", required: true }],
          mediaRequirements: { minImages: 4, maxImages: 12, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg", "image/png"], videoAllowed: false },
        })
        .expect(200)
    ).body as SchemaRow;
    expect(patched.mediaRequirements?.minImages).toBe(4);
    expect(patched.mediaRequirements?.videoAllowed).toBe(false);

    // media endpoints не существуют
    await adminAgent.post(`/api/v1/products/${created.products[0]}/media`).send({}).expect(404);
  });

  it("9. новая категория добавляется без новой Product entity/таблицы", async () => {
    const cat = (await moderatorAgent.post("/api/v1/categories").send({ title: `Diving ${stamp}`, slug: `diving-${stamp}` }).expect(201)).body as { id: string; slug: string };
    created.categories.push(cat.id);
    expect(cat.slug).toBe(`diving-${stamp}`);

    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({
          categoryId: cat.id,
          attributes: [
            { key: "depth", label: "Max depth (m)", type: "number", required: true },
            { key: "certification", type: "enum", options: ["open-water", "advanced"] },
          ],
        })
        .expect(201)
    ).body as SchemaRow;
    created.schemas.push(schema.id);
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);

    // Тот же универсальный Product: создаётся по той же модели/таблице
    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `Diving Trip ${stamp}`, categoryId: cat.id, attributes: { depth: 30, certification: "advanced" } })
        .expect(201)
    ).body.product;
    created.products.push(product.id);
    expect(product.categoryId).toBe(cat.id);
    expect(product.attributes.depth).toBe(30);

    // и валидация по новой schema работает
    await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Bad Diving ${stamp}`, categoryId: cat.id, attributes: { depth: "deep" } }).expect(422);
  });

  it("11. custom Category: slug обязателен, стабилен и уникален (title не источник identity)", async () => {
    // без slug → 400 (validation error)
    await moderatorAgent.post("/api/v1/categories").send({ title: "No Slug" }).expect(400);
    // невалидный slug → 422 (service validation)
    await moderatorAgent.post("/api/v1/categories").send({ title: "Bad Slug", slug: "Bad Slug!" }).expect(422);

    // валидный slug → 201
    const cat = (
      await moderatorAgent.post("/api/v1/categories").send({ title: "Safari", slug: `safari-${stamp}` }).expect(201)
    ).body as { id: string; slug: string; title: string };
    created.categories.push(cat.id);
    expect(cat.slug).toBe(`safari-${stamp}`);

    // изменение title → slug остаётся прежним
    const updated = (
      await moderatorAgent.patch(`/api/v1/categories/${cat.id}`).send({ title: "Safari Tours" }).expect(200)
    ).body as { id: string; slug: string; title: string };
    expect(updated.title).toBe("Safari Tours");
    expect(updated.slug).toBe(`safari-${stamp}`);

    // duplicate slug → 409 (conflict)
    await moderatorAgent.post("/api/v1/categories").send({ title: "Other Safari", slug: `safari-${stamp}` }).expect(409);
  });

  it("10. lifecycle schema: DRAFT → PATCH → ACTIVE → DEPRECATED; повторная активация — 409", async () => {
    const flightsId = await categoryIdBySlug("flights");
    const draft = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: flightsId, attributes: [{ key: "flightNumber", type: "string" }] })
        .expect(201)
    ).body as SchemaRow;
    created.schemas.push(draft.id);
    expect(draft.version).toBe(2);
    expect(draft.status).toBe("DRAFT");

    await adminAgent.patch(`/api/v1/category-schemas/${draft.id}`).send({ attributes: [{ key: "flightNumber", type: "string", required: true }] }).expect(200);

    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/activate`).expect(201);
    expect((await adminAgent.get(`/api/v1/category-schemas/${draft.id}`).expect(200)).body.status).toBe("ACTIVE");

    // v1 категории flights теперь DEPRECATED (одна ACTIVE на категорию)
    const schemas = (await adminAgent.get(`/api/v1/category-schemas?categoryId=${flightsId}`).expect(200)).body as SchemaRow[];
    expect(schemas.find((s) => s.version === 1)?.status).toBe("DEPRECATED");

    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/deprecate`).expect(201);
    expect((await adminAgent.get(`/api/v1/category-schemas/${draft.id}`).expect(200)).body.status).toBe("DEPRECATED");

    // Активация DEPRECATED → 409
    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/activate`).expect(409);
  });
});
