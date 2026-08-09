/**
 * E2E Phase 1 Step 1.13A — Temporal & Analytics Readiness Foundation.
 *
 * Покрывает §30 e2e-чеклист по НОВЫМ temporal-контрактам (остальное — уже в
 * существующих suite, см. отчёт):
 *   1. Category entity time: createdAt при create, PATCH title → updatedAt (не createdAt).
 *   2. CategorySchema lifecycle timestamps: activate → activatedAt; superseded
 *      ACTIVE → deprecatedAt; deprecate → deprecatedAt; re-activate DEPRECATED → 409;
 *      seed v1 ACTIVE несёт activatedAt (реальный переход, не updatedAt).
 *   3. Product temporal timeline: createdAt <= publishedAt; Product PATCH НЕ меняет
 *      publishedAt (§5/#5); повторный publish без DRAFT media — idempotent skip
 *      (publishedAt не перезаписывается).
 *   4. Null semantics: DRAFT schema → activatedAt/deprecatedAt = null (milestone
 *      ещё не происходил), НЕ fake timestamp.
 *   5. legacy Order/Booking: никаких fake milestone колонок (confirmedAt/cancelledAt/paidAt).
 *   6. no-fake-backfill (§29): legacy-подобные строки (raw SQL, без temporal
 *      timestamps) остаются NULL после повторного seed/reconciliation.
 *
 * Test DB: изолированная (test/e2e.env.ts) — dev/prod не затрагиваются.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { CatalogService } from "../src/modules/catalog/catalog.service";
import { RoleCode } from "../src/generated/prisma/enums";

interface CategoryRow {
  id: string;
  slug: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface SchemaRow {
  id: string;
  categoryId: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  activatedAt: string | null;
  deprecatedAt: string | null;
}

interface ProductRow {
  id: string;
  status: string;
  version: number;
  publishedAt: string | null;
}

describe("Phase 1 Step 1.13A — Temporal readiness (e2e)", () => {
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
    return res.body as { accessToken: string };
  };
  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;

  const categoryIdBySlug = async (slug: string): Promise<string> => {
    const res = await adminAgent.get("/api/v1/categories").expect(200);
    const found = (res.body as CategoryRow[]).find((c) => c.slug === slug);
    if (!found) throw new Error(`Canonical category '${slug}' not seeded`);
    return found.id;
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
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.categorySchema.deleteMany({ where: { id: { in: created.schemas } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });

    // Test hygiene (jest size-order flake): этот spec активировал СВОЮ версию schema
    // поверх канонического seed v1 (flights), оставив категорию без ACTIVE schema.
    // Восстанавливаем seed-состояние (v1 → ACTIVE), чтобы последующие suite
    // (partner-schema-read/moderation) видели ACTIVE каноническую схему.
    const cat = await prisma.category.findUnique({ where: { slug: "flights" }, select: { id: true } });
    if (cat) {
      const activeCount = await prisma.categorySchema.count({ where: { categoryId: cat.id, status: "ACTIVE" } });
      if (activeCount === 0) {
        const seed = await prisma.categorySchema.findFirst({
          where: { categoryId: cat.id },
          orderBy: { version: "asc" },
          select: { id: true, createdAt: true },
        });
        if (seed) {
          // Не выдумываем activation time (§24) — seed v1 уже несёт реальный
          // activatedAt (test DB создаётся свежим каждым прогоном).
          await prisma.categorySchema.update({ where: { id: seed.id }, data: { status: "ACTIVE", deprecatedAt: null } });
        }
      }
    }

    await app.close();
  });

  it("1. Category entity time: create → createdAt; PATCH title → updatedAt растёт, createdAt не меняется", async () => {
    const cat = (
      await adminAgent.post("/api/v1/categories").send({ title: `Temporal Cat ${stamp}`, slug: `temporal-${stamp}` }).expect(201)
    ).body as CategoryRow;
    created.categories.push(cat.id);
    expect(cat.createdAt).toBeTruthy();
    expect(new Date(cat.createdAt!).toISOString().endsWith("Z")).toBe(true);

    const patched = (
      await adminAgent.patch(`/api/v1/categories/${cat.id}`).send({ title: `Temporal Cat Renamed ${stamp}` }).expect(200)
    ).body as CategoryRow;
    expect(patched.title).toBe(`Temporal Cat Renamed ${stamp}`);
    expect(patched.createdAt).toBe(cat.createdAt);
    expect(patched.updatedAt).toBeTruthy();
    expect(new Date(patched.updatedAt!).getTime()).toBeGreaterThanOrEqual(new Date(patched.createdAt!).getTime());
  });

  it("2. seed: каноническая категория несёт createdAt; seed ACTIVE schema v1 несёт activatedAt", async () => {
    const toursId = await categoryIdBySlug("tours");
    const cat = (await adminAgent.get("/api/v1/categories").expect(200)).body as CategoryRow[];
    const tours = cat.find((c) => c.id === toursId)!;
    // Seed устанавливает createdAt при создании (Step 1.13A) — не NULL-фейк.
    expect(tours.createdAt).toBeTruthy();

    const schemas = (await adminAgent.get(`/api/v1/category-schemas?categoryId=${toursId}`).expect(200)).body as SchemaRow[];
    const v1 = schemas.find((s) => s.version === 1)!;
    expect(v1.status).toBe("ACTIVE");
    expect(v1.activatedAt).toBeTruthy();
    expect(v1.deprecatedAt).toBeNull();
  });

  it("3. CategorySchema lifecycle timestamps: DRAFT → null; activate → activatedAt; superseded → deprecatedAt; deprecate → deprecatedAt; re-activate → 409", async () => {
    const flightsId = await categoryIdBySlug("flights");
    const draft = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: flightsId, attributes: [{ key: "flightNumber", type: "string" }] })
        .expect(201)
    ).body as SchemaRow;
    created.schemas.push(draft.id);
    // Null semantics (§24): milestone ещё не происходил → null, НЕ fake.
    expect(draft.status).toBe("DRAFT");
    expect(draft.activatedAt).toBeNull();
    expect(draft.deprecatedAt).toBeNull();

    // activate → activatedAt (реальный переход, не updatedAt).
    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/activate`).expect(201);
    const active = (await adminAgent.get(`/api/v1/category-schemas/${draft.id}`).expect(200)).body as SchemaRow;
    expect(active.status).toBe("ACTIVE");
    expect(active.activatedAt).toBeTruthy();
    expect(active.deprecatedAt).toBeNull();

    // superseded: v1 (ACTIVE) этой категории → DEPRECATED с deprecatedAt.
    const schemas = (await adminAgent.get(`/api/v1/category-schemas?categoryId=${flightsId}`).expect(200)).body as SchemaRow[];
    const v1 = schemas.find((s) => s.version === 1)!;
    expect(v1.status).toBe("DEPRECATED");
    expect(v1.deprecatedAt).toBeTruthy();

    // deprecate активной → deprecatedAt.
    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/deprecate`).expect(201);
    const dep = (await adminAgent.get(`/api/v1/category-schemas/${draft.id}`).expect(200)).body as SchemaRow;
    expect(dep.status).toBe("DEPRECATED");
    expect(dep.deprecatedAt).toBeTruthy();
    expect(new Date(dep.deprecatedAt!).getTime()).toBeGreaterThanOrEqual(new Date(dep.activatedAt!).getTime());

    // re-activate DEPRECATED → 409 (хронология не ломается).
    await adminAgent.post(`/api/v1/category-schemas/${draft.id}/activate`).expect(409);
  });

  it("4. Product temporal timeline: createdAt <= publishedAt; PATCH НЕ выдумывает publishedAt; повторный publish без DRAFT media — idempotent skip (#5)", async () => {
    // Категория БЕЗ media-требований (publish не требует изображений) — temporal-тест
    // не должен зависеть от media pipeline.
    const slug = `temporal-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `Temporal ${stamp}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }] })
        .expect(201)
    ).body as { id: string };
    created.schemas.push(schema.id);
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);

    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `Temporal Product ${stamp}`, categoryId: cat.id, attributes: { days: 3 } })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const fresh = (await adminAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as ProductRow & { createdAt: string };
    expect(fresh.createdAt).toBeTruthy();

    // PATCH DRAFT не проставляет publishedAt (милстоун публикации — только publish).
    await adminAgent.patch(`/api/v1/products/${product.id}`).send({ title: `Temporal Product edited ${stamp}` }).expect(200);
    const draft = (await adminAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as ProductRow;
    expect(draft.status).toBe("DRAFT");
    expect(draft.publishedAt).toBeNull();

    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const published = (await adminAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as ProductRow;
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();
    expect(new Date(published.publishedAt!).getTime()).toBeGreaterThanOrEqual(new Date(fresh.createdAt).getTime());

    const publishedAtBefore = published.publishedAt;

    // Повторный publish без DRAFT media — idempotent skip: publishedAt не перезаписан.
    const rep = (await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201)).body as { skipped?: boolean };
    expect(rep.skipped).toBe(true);
    const afterRepublish = (await adminAgent.get(`/api/v1/products/${product.id}`).expect(200)).body as ProductRow;
    expect(afterRepublish.publishedAt).toBe(publishedAtBefore);

    // §5/#5 (live publish timestamp не затирается обычным PATCH): прямой PATCH
    // PUBLISHED продукта структурно запрещён (409) — live N меняется только через
    // change-proposal N+1 (change-proposal.e2e проверяет, что publishedAt live N
    // не меняется до нового approve).
    await adminAgent.patch(`/api/v1/products/${product.id}`).send({ title: "Silent hack" }).expect(409);
  });

  it("5. legacy Order/Booking: честные timestamps только (createdAt/serviceDate), без fake milestone (confirmedAt/cancelledAt/paidAt)", async () => {
    // Контракт read-model Buyer Cabinet уже проверен в buyer-cabinet.e2e; здесь —
    // DB-level инвариант: legacy Order/Booking не имеют milestone-колонок.
    const orderCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema='order' AND table_name='Order'
    `;
    const orderNames = orderCols.map((r) => r.column_name);
    expect(orderNames).toContain("createdAt");
    expect(orderNames).toContain("updatedAt");
    expect(orderNames).not.toContain("confirmedAt");
    expect(orderNames).not.toContain("cancelledAt");
    expect(orderNames).not.toContain("paidAt");

    const bookingCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema='booking' AND table_name='Booking'
    `;
    const bookingNames = bookingCols.map((r) => r.column_name);
    expect(bookingNames).toContain("createdAt");
    expect(bookingNames).not.toContain("confirmedAt");
    expect(bookingNames).not.toContain("cancelledAt");
  });

  it("6. no-fake-backfill: legacy-подобные строки (raw SQL, без temporal timestamps) остаются NULL после seed/reconciliation (§29)", async () => {
    // Pre-migration-like legacy Category: существовала ДО temporal-миграции →
    // createdAt/updatedAt физически отсутствовали (сейчас nullable → NULL).
    const legacyCatId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "catalog"."Category" ("id", "code", "slug", "title", "status")
      VALUES (${legacyCatId}, ${`CAT-LG-${stamp}`}, ${`legacy-temporal-${stamp}`}, ${`Legacy ${stamp}`}, 'ACTIVE')
    `;
    created.categories.push(legacyCatId);

    // Pre-migration-like ACTIVE CategorySchema: без activatedAt/deprecatedAt.
    const legacySchemaId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "catalog"."CategorySchema"
        ("id", "categoryId", "version", "status", "attributes", "createdAt", "updatedAt")
      VALUES
        (${legacySchemaId}, ${legacyCatId}, 1, 'ACTIVE', ${JSON.stringify([])}::jsonb, ${new Date()}, ${new Date()})
    `;
    created.schemas.push(legacySchemaId);

    // Повторный seed (startup reconciliation, onModuleInit уже отработал в beforeAll)
    // НЕ должен заполнять legacy-строки fake timestamps (§11: newly-created-by-seed
    // получает timestamps; legacy row, существовавшая до миграции, — НЕТ).
    const catalog = app.get(CatalogService);
    await (catalog as unknown as { seedCanonicalCategories(): Promise<void> }).seedCanonicalCategories();

    const legacyCat = await prisma.category.findUniqueOrThrow({
      where: { id: legacyCatId },
      select: { createdAt: true, updatedAt: true },
    });
    expect(legacyCat.createdAt).toBeNull();
    expect(legacyCat.updatedAt).toBeNull();

    const legacySchema = await prisma.categorySchema.findUniqueOrThrow({
      where: { id: legacySchemaId },
      select: { status: true, activatedAt: true, deprecatedAt: true },
    });
    expect(legacySchema.status).toBe("ACTIVE");
    expect(legacySchema.activatedAt).toBeNull();
    expect(legacySchema.deprecatedAt).toBeNull();
  });
});
