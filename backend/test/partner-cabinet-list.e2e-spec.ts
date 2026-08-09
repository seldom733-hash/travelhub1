/**
 * E2E Phase 1 Step 1.8 — Partner Cabinet: extended product list for My Products.
 *
 * Backend `GET /api/v1/products` (PARTNER read_own) теперь возвращает:
 *   - server-side own-scope (только свои Product; cross-partner отсутствуют);
 *   - category {id, slug, title};
 *   - thumbnail (primary PUBLISHED media; null для DRAFT без публикации);
 *   - moderation (ПОСЛЕДНЯЯ submission продукта: status/isActive/…);
 *   - priceFrom/currency (min тариф);
 *   - updatedAt.
 * Плюс server-side фильтры: categoryId, lifecycle filter
 * (draft/in_moderation/changes_requested/published/archived) и sort.
 *
 * Ключевое доказательство: filter=changes_requested семантически равен
 * «последняя submission продукта = CHANGES_REQUESTED» (DISTINCT ON SQL) — продукт,
 * который сначала получил CHANGES_REQUESTED, а потом был повторно отправлен и
 * REJECTED, НЕ должен попадать в этот фильтр (без false positives).
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

interface ListItem {
  id: string;
  code: string;
  title: string;
  status: string;
  category: { id: string; slug: string; title: string } | null;
  thumbnail: { id: string; mimeType: string; width: number | null; height: number | null } | null;
  moderation: { status: string; isActive: boolean; reasonCode: string | null; comment: string | null; submittedAt: string; decidedAt: string | null } | null;
  priceFrom: string | null;
  currency: string | null;
  updatedAt: string;
}

const jpeg = () =>
  sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 60, g: 40, b: 200 } } })
    .jpeg()
    .toBuffer();

describe("Phase 1 Step 1.8 — Partner Cabinet product list (e2e)", () => {
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
    return res.body as { accessToken: string };
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
  let catId: string;

  /** Создать DRAFT Product партнёра (с валидными category attributes). */
  async function createDraft(title: string, agent = partner1Agent) {
    const res = await agent.post("/api/v1/products").send({ type: "TOUR", title, categoryId: catId, attributes: { days: 3 } }).expect(201);
    const product = res.body.product as { id: string; code: string };
    created.products.push(product.id);
    return product;
  }

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

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `PL Partner 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `plp1${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body;
    created.users.push(u1.id);
    partner1Agent = await agent((await login(`plp1${stamp}`, "partnerpass123")).accessToken);

    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `PL Partner 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);
    const u2 = (await adminAgent.post("/api/v1/users").send({ username: `plp2${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body;
    created.users.push(u2.id);
    partner2Agent = await agent((await login(`plp2${stamp}`, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `plmod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    modAgent = await agent((await login(`plmod${stamp}`, "modpass123")).accessToken);

    // Категория с ACTIVE schema БЕЗ media/tariff/availability требований — submit
    // и approve проходят без media (тест фокусируется на списке, не на publish).
    const slug = `pl-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `PL ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    catId = cat.id;
    const schema = (
      await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer", required: true }] }).expect(201)
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

  const list = async (qs = "", agent = partner1Agent) => {
    const res = await agent.get(`/api/v1/products${qs}`).expect(200);
    return res.body as { items: ListItem[]; total: number; page: number; pageSize: number };
  };

  it("1. own-scope + новые поля (category, moderation, priceFrom, currency, updatedAt)", async () => {
    const product = await createDraft(`PL1 own ${stamp}`);
    // Тариф для priceFrom.
    await partner1Agent
      .patch(`/api/v1/products/${product.id}`)
      .send({ tariffs: [{ name: "Basic", price: 100 }, { name: "Premium", price: 250 }] })
      .expect(200);

    const { items, total } = await list("?pageSize=100");
    const mine = items.find((i) => i.id === product.id);
    expect(mine).toBeTruthy();
    expect(mine!.category?.id).toBe(catId);
    expect(mine!.category?.slug).toBeTruthy();
    expect(mine!.priceFrom).toBe("100");
    expect(mine!.currency).toBe("USD");
    expect(mine!.thumbnail).toBeNull(); // DRAFT без media
    expect(mine!.moderation).toBeNull(); // ещё не отправлялся
    expect(typeof mine!.updatedAt).toBe("string");
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("2. cross-partner exclusion: PARTNER2 не видит продукты PARTNER1", async () => {
    const before = await list("?pageSize=100", partner2Agent);
    const p1count = await list("?pageSize=100", partner1Agent);
    const own = await createDraft(`PL2 own ${stamp}`);
    const after = await list("?pageSize=100", partner2Agent);
    expect(after.items.some((i) => i.id === own.id)).toBe(false);
    // Кол-во у partner2 не изменилось от создания продукта partner1.
    expect(after.total).toBe(before.total);
    expect(p1count.total).toBeGreaterThan(before.total);
  });

  it("3. categoryId filter (server-side)", async () => {
    await createDraft(`PL3 filtered ${stamp}`);
    const { items } = await list(`?categoryId=${catId}&pageSize=100`);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.category?.id === catId)).toBe(true);
    // Другая (несуществующая) категория → пусто.
    const other = await list("?categoryId=00000000-0000-0000-0000-000000000000");
    expect(other.total).toBe(0);
  });

  it("4. filter=draft / published / archived", async () => {
    const draft = await createDraft(`PL4 draft ${stamp}`);
    const { items: drafts } = await list("?filter=draft&pageSize=100");
    expect(drafts.some((i) => i.id === draft.id)).toBe(true);

    // DRAFT → submit → approve → PUBLISHED.
    const sub = (await partner1Agent.post(`/api/v1/products/${draft.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);
    const { items: published } = await list("?filter=published&pageSize=100");
    const pub = published.find((i) => i.id === draft.id);
    expect(pub?.status).toBe("PUBLISHED");
    expect(pub?.moderation?.status).toBe("APPROVED");

    // Admin архивирует (PARTNER не имеет publish/archive) → filter=archived.
    await adminAgent.post(`/api/v1/products/${draft.id}/archive`).expect(201);
    const { items: archived } = await list("?filter=archived&pageSize=100");
    expect(archived.some((i) => i.id === draft.id)).toBe(true);
  });

  it("5. filter=in_moderation (активная submission)", async () => {
    const product = await createDraft(`PL5 active ${stamp}`);
    await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201);

    const { items } = await list("?filter=in_moderation&pageSize=100");
    const mine = items.find((i) => i.id === product.id);
    expect(mine).toBeTruthy();
    expect(mine!.moderation?.isActive).toBe(true);
    expect(mine!.moderation?.status).toBe("SUBMITTED");
  });

  it("6. filter=changes_requested — ТОЧНАЯ семантика «последняя submission = CHANGES_REQUESTED»", async () => {
    // A: submit → request_changes → последняя = CHANGES_REQUESTED (DRAFT, released).
    const a = await createDraft(`PL6 A ${stamp}`);
    let sub = (await partner1Agent.post(`/api/v1/products/${a.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/request-changes`).send({ reasonCode: "INCOMPLETE_CONTENT" }).expect(201);

    // B: submit → request_changes → ПОВТОРНЫЙ submit → reject.
    //    История B содержит CHANGES_REQUESTED, но ПОСЛЕДНЯЯ submission = REJECTED.
    const b = await createDraft(`PL6 B ${stamp}`);
    sub = (await partner1Agent.post(`/api/v1/products/${b.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/request-changes`).send({ reasonCode: "INCOMPLETE_CONTENT" }).expect(201);
    sub = (await partner1Agent.post(`/api/v1/products/${b.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/reject`).send({ reasonCode: "INVALID_PRICE_OR_TERMS", comment: "x" }).expect(201);

    const { items } = await list("?filter=changes_requested&pageSize=100");
    const ids = items.map((i) => i.id);
    expect(ids).toContain(a.id); // последняя = CHANGES_REQUESTED → в фильтре
    expect(ids).not.toContain(b.id); // последняя = REJECTED → НЕ в фильтре (нет false positive)
  });

  it("7. sort=title_asc / updated_asc", async () => {
    await createDraft(`PL7 Zeta ${stamp}`);
    await createDraft(`PL7 Alpha ${stamp}`);
    const { items } = await list("?sort=title_asc&pageSize=100");
    const titles = items.map((i) => i.title);
    const sorted = [...titles].sort((x, y) => x.localeCompare(y));
    expect(titles).toEqual(sorted);

    const { items: byUpdated } = await list("?sort=updated_asc&pageSize=100");
    const times = byUpdated.map((i) => i.updatedAt);
    expect(times).toEqual([...times].sort());
  });

  it("8. thumbnail появляется после publish (primary PUBLISHED media)", async () => {
    const product = await createDraft(`PL8 thumb ${stamp}`);
    await partner1Agent.post(`/api/v1/products/${product.id}/media`).attach("files", await jpeg(), { filename: "p.jpg", contentType: "image/jpeg" }).expect(201);
    // DRAFT media → thumbnail ещё null.
    expect((await list(`?search=PL8 thumb`)).items[0]?.thumbnail).toBeNull();

    const sub = (await partner1Agent.post(`/api/v1/products/${product.id}/submit-moderation`).expect(201)).body as { id: string };
    await modAgent.post(`/api/v1/moderation/submissions/${sub.id}/approve`).expect(201);

    const after = (await list(`?search=PL8 thumb`)).items[0];
    expect(after?.thumbnail).toBeTruthy();
    expect(after?.thumbnail?.mimeType).toBe("image/jpeg");
    expect(after?.moderation?.status).toBe("APPROVED");
  });
});
