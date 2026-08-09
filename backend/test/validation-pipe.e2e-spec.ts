/**
 * E2E — Production-equivalent ValidationPipe (STRICT REVIEW Step 1.12.2).
 *
 * Проблема, которую закрывает этот spec: production pipe в src/main.ts содержал
 * `transformOptions.enableImplicitConversion: true`, а e2e-спеки бутали AppModule
 * с `{ whitelist: true, transform: true }` без implicit-конверсии. implicit-
 * конверсия class-transformer портит DTO-поля `unknown[]`: каждый элемент-объект
 * молча превращается в Array-инстанс, данные ломаются ДО сервисной валидации,
 * и валидный payload отклоняется ложным 422 (`attributes[0] must be an object`).
 *
 * Этот spec бутает AppModule с `GLOBAL_VALIDATION_PIPE_OPTIONS` — ЕДИНЫМ
 * источником истины, который использует production src/main.ts. Если main.ts
 * снова получит implicit-конверсию (или опции разойдутся), тесты ниже упадут.
 *
 * Доказательства:
 *   1. POST /category-schemas с attributes = array-of-objects → 201, данные
 *      сохранены без повреждений (ключ/тип/options на месте);
 *   2. PATCH /category-schemas/:id с новым array-of-objects → 200;
 *   3. whitelist НЕ ослаблен: чужие/forged ключи вырезаются, валидный payload
 *      проходит.
 *
 * Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную
 * тестовую БД (TEST_DATABASE_URL) до импорта AppModule.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Production-equivalent ValidationPipe (array-of-objects DTOs)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created = { categories: [] as string[], schemas: [] as string[] };
  const slug = `pipecheck-${stamp}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    // ТЕ ЖЕ опции, что и в production src/main.ts (единый источник истины).
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    const token = (login.body as { accessToken: string }).accessToken;
    adminAgent = request.agent(app.getHttpServer());
    adminAgent.set("Authorization", `Bearer ${token}`);
  });

  afterAll(async () => {
    await prisma.categorySchema.deleteMany({ where: { id: { in: created.schemas } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await app.close();
  });

  it("1. POST /category-schemas с array-of-objects attributes → 201, данные не повреждены", async () => {
    const cat = await adminAgent.post("/api/v1/categories").send({ title: `Pipe Check ${stamp}`, slug }).expect(201);
    created.categories.push((cat.body as { id: string }).id);

    const schemaPayload = {
      categoryId: (cat.body as { id: string }).id,
      attributes: [
        { key: "duration", label: "Длительность", type: "integer", required: true, searchable: true, filterable: true, min: 1, max: 30 },
        { key: "guide", label: "Гид", type: "enum", options: ["yes", "no"] },
      ],
      pdpSections: ["overview", "itinerary"],
    };

    const res = await adminAgent.post("/api/v1/category-schemas").send(schemaPayload).expect(201);
    const schema = res.body as { id: string; attributes: Array<{ key: string; type: string; required?: boolean; options?: string[] }>; pdpSections?: string[] };
    created.schemas.push(schema.id);

    // Ключевое доказательство: элементы НЕ превратились в Array-инстансы
    // (при implicit-конверсии здесь был бы 422 `attributes[0] must be an object`).
    expect(schema.attributes).toHaveLength(2);
    expect(schema.attributes[0]).toMatchObject({ key: "duration", type: "integer", required: true, min: 1, max: 30 });
    expect(schema.attributes[1]).toMatchObject({ key: "guide", type: "enum", options: ["yes", "no"] });
    expect(schema.pdpSections).toEqual(["overview", "itinerary"]);
  });

  it("2. PATCH /category-schemas/:id с новым array-of-objects → 200", async () => {
    const cat = await adminAgent.post("/api/v1/categories").send({ title: `Pipe Check Patch ${stamp}`, slug: `${slug}-p` }).expect(201);
    created.categories.push((cat.body as { id: string }).id);

    const createRes = await adminAgent
      .post("/api/v1/category-schemas")
      .send({ categoryId: (cat.body as { id: string }).id, attributes: [{ key: "name", type: "string", required: true }] })
      .expect(201);
    const schemaId = (createRes.body as { id: string }).id;
    created.schemas.push(schemaId);

    const patched = await adminAgent
      .patch(`/api/v1/category-schemas/${schemaId}`)
      .send({ attributes: [{ key: "name", type: "string", required: true }, { key: "level", type: "enum", options: ["easy", "hard"] }] })
      .expect(200);
    const attrs = (patched.body as { attributes: Array<{ key: string; options?: string[] }> }).attributes;
    expect(attrs).toHaveLength(2);
    expect(attrs[1]).toMatchObject({ key: "level", options: ["easy", "hard"] });
  });

  it("3. whitelist НЕ ослаблен: forged/чужие ключи вырезаются, валидный payload проходит", async () => {
    const cat = await adminAgent.post("/api/v1/categories").send({ title: `Pipe Check WL ${stamp}`, slug: `${slug}-wl` }).expect(201);
    created.categories.push((cat.body as { id: string }).id);

    const res = await adminAgent
      .post("/api/v1/category-schemas")
      .send({
        categoryId: (cat.body as { id: string }).id,
        attributes: [{ key: "title", type: "string", required: true }],
        evil: "forged",
        partnerId: "P-fake",
        status: "ACTIVE",
      })
      .expect(201);
    const schema = res.body as { id: string; evil?: unknown; partnerId?: unknown; status: string };
    created.schemas.push(schema.id);
    expect(schema.evil).toBeUndefined();
    expect(schema.partnerId).toBeUndefined();
    expect(schema.status).toBe("DRAFT"); // lifecycle не подменён forged-полем
  });
});
