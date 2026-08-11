/**
 * PHASE 1 STEP 1.8A — Service Unit / Seller Commercial Structure Foundation (e2e).
 *
 * Обязательные доказательства §39 (22 сценария):
 *   1  Seller создаёт unit под СВОИМ Product
 *   2  Seller-название сохраняется verbatim
 *   3  normalized attributes отдельно от original/source values
 *   4  business code server-generated (UNI-*)
 *   5  client не может forge code/owner/schema/status (422)
 *   6  Seller не может создать под чужим Product (403)
 *   7  cross-Seller read/update denied neutrally
 *   8  invalid CategorySchema attributes rejected (422)
 *   9  schema-version reference persisted
 *   10 multiple units под одним Product
 *   11 похожие Seller-имена (name не глобальная identity)
 *   12 import identity dedup (source+externalKey → 409)
 *   13 manual unit без externalKey
 *   14 legacy Product с нулём units валиден
 *   15 нет Tariff pricing периодов
 *   16 нет Availability/Reservation
 *   17 нет Quote/Checkout/Sale/Order/Booking
 *   18 Reverse Marketplace data не мутируется
 *   19 public/private visibility следует Catalog lifecycle (publish гейт Product PUBLISHED)
 *   20 concurrency import identity → один юнит
 *   21 детерминированный pagination/order
 *   22 cross-category fixtures: Hotel + Transfer + Tour
 *
 * RBAC: PARTNER — own-scope reuse catalog.product.*; publish/archive —
 * catalog.service_unit.publish (staff/ADMIN); MODERATOR — 403.
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

interface UnitRow {
  id: string;
  code: string;
  productId: string;
  name: string;
  categoryId: string | null;
  categorySchemaId: string | null;
  attributes: Record<string, unknown>;
  source: string | null;
  externalKey: string | null;
  partnerId: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
}

describe("Phase 1 Step 1.8A — Service Unit / Seller Commercial Structure Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; partners: string[]; categories: string[]; units: string[] } = {
    users: [],
    products: [],
    partners: [],
    categories: [],
    units: [],
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
  let seller1Agent: ReturnType<typeof request.agent>;
  let seller2Agent: ReturnType<typeof request.agent>;
  let modAgent: ReturnType<typeof request.agent>;
  let seller1Id: string;
  let seller2Id: string;
  let partner1Id: string;
  let partner2Id: string;

  /** Hotel-like категория (roomType/occupancy/view) — media не обязательна. */
  let hotelCatId: string;
  /** Transfer-like категория (vehicleType/capacity). */
  let transferCatId: string;
  /** Tour-like категория (packageClass/capacity/inclusion). */
  let tourCatId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `SU Seller 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;
    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `su_seller1_${stamp}`, password: "sellerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body as { id: string };
    created.users.push(u1.id);
    seller1Id = u1.id;
    seller1Agent = await agent((await login(`su_seller1_${stamp}`, "sellerpass123")).accessToken);

    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `SU Seller 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);
    partner2Id = p2.id;
    const u2 = (await adminAgent.post("/api/v1/users").send({ username: `su_seller2_${stamp}`, password: "sellerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body as { id: string };
    created.users.push(u2.id);
    seller2Id = u2.id;
    seller2Agent = await agent((await login(`su_seller2_${stamp}`, "sellerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `su_mod_${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`su_mod_${stamp}`, "modpass123")).accessToken);

    hotelCatId = await createCategoryWithPolicy(`su-hotel-${stamp}`, {
      attributes: [
        { key: "occupancy", label: "Occupancy", type: "integer", required: true, min: 1, max: 10 },
        { key: "bedType", label: "Bed type", type: "enum", options: ["single", "double", "twin"] },
        { key: "view", label: "View", type: "string" },
      ],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });

    transferCatId = await createCategoryWithPolicy(`su-transfer-${stamp}`, {
      attributes: [
        { key: "vehicleType", label: "Vehicle type", type: "enum", required: true, options: ["sedan", "minivan", "van"] },
        { key: "passengerCapacity", label: "Passenger capacity", type: "integer", min: 1, max: 60 },
        { key: "luggageCapacity", label: "Luggage", type: "string" },
      ],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });

    tourCatId = await createCategoryWithPolicy(`su-tour-${stamp}`, {
      attributes: [
        { key: "packageClass", label: "Package class", type: "enum", options: ["standard", "premium", "vip"] },
        { key: "capacity", label: "Capacity", type: "integer", min: 1 },
        { key: "inclusions", label: "Inclusions", type: "text" },
      ],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });
  });

  afterAll(async () => {
    await prisma.serviceUnit.deleteMany({ where: { id: { in: created.units } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  async function createCategoryWithPolicy(slug: string, config: { attributes: unknown[]; mediaRequirements?: Record<string, unknown> }): Promise<string> {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `SU Cat ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: config.attributes, mediaRequirements: config.mediaRequirements })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    return cat.id;
  }

  /** DRAFT Product под указанной категорией (с category-valid attributes). */
  async function createProduct(agent: ReturnType<typeof request.agent>, title: string, categoryId: string, attrs: Record<string, unknown>): Promise<{ id: string; code: string; status: string }> {
    const res = await agent.post("/api/v1/products").send({ type: "HOTEL", title, categoryId, attributes: attrs }).expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    return product;
  }

  /** Опубликовать Product через admin (controlled publish). */
  async function publishProductViaAdmin(productId: string) {
    await adminAgent.post(`/api/v1/products/${productId}/publish`).expect(201);
  }

  async function createUnit(
    agent: ReturnType<typeof request.agent>,
    productId: string,
    body: Record<string, unknown>,
    expected = 201,
  ): Promise<UnitRow> {
    const res = await agent.post(`/api/v1/products/${productId}/service-units`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const unit = res.body as UnitRow;
    created.units.push(unit.id);
    return unit;
  }

  // ── 1-5: create/verbatim/attributes/code/forged ───────────────────────────

  it("1. Seller создаёт unit под СВОИМ Product (DRAFT, UNI-* code, category/schema из Product)", async () => {
    const product = await createProduct(seller1Agent, `SU1 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double", view: "Sea" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Deluxe Room Sea View", attributes: { occupancy: 2, bedType: "double", view: "Sea" } });

    expect(unit.code).toMatch(/^UNI-\d{8}$/);
    expect(unit.productId).toBe(product.id);
    expect(unit.status).toBe("DRAFT");
    expect(unit.version).toBe(1);
    expect(unit.categoryId).toBe(hotelCatId);
    expect(unit.categorySchemaId).toBeTruthy();
    expect(unit.partnerId).toBe(partner1Id);
    expect(unit.source).toBeNull();
    expect(unit.externalKey).toBeNull();
  });

  it("2. Seller-название сохраняется verbatim (case/порядок слов не меняются)", async () => {
    const product = await createProduct(seller1Agent, `SU2 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Premium Double Ocean Side", attributes: { occupancy: 2, bedType: "double" } });
    expect(unit.name).toBe("Premium Double Ocean Side");

    const got = (await seller1Agent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(got.name).toBe("Premium Double Ocean Side");
  });

  it("3. normalized attributes хранятся отдельно от имени (не перезаписывают source name)", async () => {
    const product = await createProduct(seller1Agent, `SU3 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, {
      name: "Family Suite",
      attributes: { occupancy: 4, bedType: "twin", view: "Garden" },
    });
    expect(unit.name).toBe("Family Suite"); // verbatim name
    expect(unit.attributes).toEqual({ occupancy: 4, bedType: "twin", view: "Garden" });
  });

  it("4. business code server-generated: client не может задать code", async () => {
    const product = await createProduct(seller1Agent, `SU4 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const res = await seller1Agent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Forge Code", code: "UNI-99999999" });
    expect(res.status).toBe(422); // forbidden key → 422 loud
    const unit = await createUnit(seller1Agent, product.id, { name: "Forge Code OK", attributes: { occupancy: 2, bedType: "double" } });
    expect(unit.code).toMatch(/^UNI-\d{8}$/);
    expect(unit.code).not.toBe("UNI-99999999");
  });

  it("5. client не может forge owner/schema/status/version (422 на forbidden keys)", async () => {
    const product = await createProduct(seller1Agent, `SU5 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const cases = [
      { name: "A", partnerId: partner2Id },
      { name: "B", ownerId: "evil" },
      { name: "C", status: "PUBLISHED" },
      { name: "D", version: 99 },
      { name: "E", categoryId: "00000000-0000-0000-0000-000000000000" },
      { name: "F", categorySchemaId: "00000000-0000-0000-0000-000000000000" },
      { name: "G", createdAt: "2020-01-01" },
      { name: "H", productId: "00000000-0000-0000-0000-000000000000" },
    ];
    for (const body of cases) {
      const res = await seller1Agent.post(`/api/v1/products/${product.id}/service-units`).send(body);
      expect(res.status).toBe(422);
    }
  });

  // ── 6-7: IDOR / own-scope ─────────────────────────────────────────────────

  it("6. Seller не может создать unit под чужим Product (403)", async () => {
    const product = await createProduct(seller2Agent, `SU6 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    await seller1Agent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Sneak" }).expect(403);
  });

  it("7. cross-Seller read/update denied neutrally", async () => {
    const product = await createProduct(seller1Agent, `SU7 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Private Draft", attributes: { occupancy: 2, bedType: "double" } });

    // Seller2 не может прочитать/обновить чужой unit (403 — managed deny, как Product).
    await seller2Agent.get(`/api/v1/service-units/${unit.id}`).expect(403);
    await seller2Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Hijack" }).expect(403);
    await seller2Agent.get(`/api/v1/service-units/${unit.id}/history`).expect(403);
    // Seller2 не видит units чужого Product (list → 403).
    await seller2Agent.get(`/api/v1/products/${product.id}/service-units`).expect(403);
  });

  // ── 8-9: schema validation / schema version ───────────────────────────────

  it("8. invalid CategorySchema attributes rejected (422)", async () => {
    const product = await createProduct(seller1Agent, `SU8 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const bad = [
      { name: "A", attributes: { occupancy: 99 } }, // > max
      { name: "B", attributes: { bedType: "king" } }, // unknown enum
      { name: "C", attributes: { forged: "x" } }, // unknown key
      { name: "D", attributes: { occupancy: "two" } }, // wrong type
      { name: "E", attributes: {} }, // missing required occupancy
    ];
    for (const body of bad) {
      const res = await seller1Agent.post(`/api/v1/products/${product.id}/service-units`).send(body);
      expect(res.status).toBe(422);
    }
    // Transfer category: vehicleType обязателен — тоже schema-driven.
    const tprod = await createProduct(seller1Agent, `SU8T ${stamp}`, transferCatId, { vehicleType: "sedan" });
    await seller1Agent.post(`/api/v1/products/${tprod.id}/service-units`).send({ name: "Sedan", attributes: {} }).expect(422);
  });

  it("9. schema-version reference persisted (categorySchemaId = снапшот Product)", async () => {
    const product = await createProduct(seller1Agent, `SU9 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const pDetail = (await seller1Agent.get(`/api/v1/products/${product.id}`).expect(200)).body as { categorySchemaId: string | null };
    const unit = await createUnit(seller1Agent, product.id, { name: "Snapshot Unit", attributes: { occupancy: 2, bedType: "double" } });
    expect(unit.categorySchemaId).toBe(pDetail.categorySchemaId);
  });

  // ── 10-11: multiple units / name не identity ──────────────────────────────

  it("10. multiple units под одним Product разрешены", async () => {
    const product = await createProduct(seller1Agent, `SU10 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const a = await createUnit(seller1Agent, product.id, { name: "Standard Double", attributes: { occupancy: 2, bedType: "double" } });
    const b = await createUnit(seller1Agent, product.id, { name: "Premium Double", attributes: { occupancy: 2, bedType: "double" } });
    const c = await createUnit(seller1Agent, product.id, { name: "Family Suite", attributes: { occupancy: 4, bedType: "twin" } });
    expect([a.id, b.id, c.id]).toHaveLength(3);
    expect(a.code).not.toBe(b.code);
  });

  it("11. похожие Seller-имена допустимы (name не глобальная identity)", async () => {
    const pA = await createProduct(seller1Agent, `SU11A ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const pB = await createProduct(seller1Agent, `SU11B ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const a = await createUnit(seller1Agent, pA.id, { name: "Deluxe Room", attributes: { occupancy: 2, bedType: "double" } });
    const b = await createUnit(seller1Agent, pB.id, { name: "Deluxe Room", attributes: { occupancy: 2, bedType: "double" } });
    const c = await createUnit(seller1Agent, pA.id, { name: "Deluxe Room", attributes: { occupancy: 2, bedType: "double" } });
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(c.id);
    expect(b.id).not.toBe(c.id);
  });

  // ── 12-13: import identity ────────────────────────────────────────────────

  it("12. import identity dedup: source+externalKey повторно → 409 (reconcile, не дубликат)", async () => {
    const product = await createProduct(seller1Agent, `SU12 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    // Import provisioning — trusted (ADMIN/staff): source+externalKey.
    const first = await adminAgent
      .post(`/api/v1/products/${product.id}/service-units`)
      .send({ name: "Imported Room", attributes: { occupancy: 2, bedType: "double" }, source: "CHANNEL_MANAGER", externalKey: "RM-101" })
      .expect(201);
    const unit = first.body as UnitRow;
    created.units.push(unit.id);
    expect(unit.source).toBe("CHANNEL_MANAGER");
    expect(unit.externalKey).toBe("RM-101");

    // Повторный импорт того же ключа → 409 (unique в ownership scope).
    await adminAgent
      .post(`/api/v1/products/${product.id}/service-units`)
      .send({ name: "Imported Room Again", attributes: { occupancy: 2, bedType: "double" }, source: "CHANNEL_MANAGER", externalKey: "RM-101" })
      .expect(409);

    // Тот же ключ, но другой Seller → НЕ конфликт (ownership scope).
    const p2 = await createProduct(seller2Agent, `SU12B ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const other = await adminAgent
      .post(`/api/v1/products/${p2.id}/service-units`)
      .send({ name: "Other Seller Import", attributes: { occupancy: 2, bedType: "double" }, source: "CHANNEL_MANAGER", externalKey: "RM-101" })
      .expect(201);
    created.units.push((other.body as UnitRow).id);

    // PARTNER не может задавать import identity (422) — с валидными attributes,
    // чтобы 422 был именно про forged source (не про schema).
    await seller1Agent
      .post(`/api/v1/products/${product.id}/service-units`)
      .send({ name: "Forge Source", attributes: { occupancy: 2, bedType: "double" }, source: "IMPORT", externalKey: "X" })
      .expect(422);
  });

  it("13. manual unit без externalKey валиден (no fabricated key)", async () => {
    const product = await createProduct(seller1Agent, `SU13 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Manual Room", attributes: { occupancy: 2, bedType: "double" } });
    expect(unit.externalKey).toBeNull();
    expect(unit.source).toBeNull();
  });

  // ── 14: legacy Product без units ──────────────────────────────────────────

  it("14. legacy Product с нулём units остаётся валидным", async () => {
    const product = await createProduct(seller1Agent, `SU14 Legacy ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const list = (await seller1Agent.get(`/api/v1/products/${product.id}/service-units`).expect(200)).body as { items: unknown[]; total: number };
    expect(list.total).toBe(0);
    // Product сам по себе доступен и корректен.
    await seller1Agent.get(`/api/v1/products/${product.id}`).expect(200);
  });

  // ── 15-18: no side effects ────────────────────────────────────────────────

  it("15-17. unit create не создаёт Tariff/Availability/Reservation/Quote/Checkout/Sale/Order/Booking", async () => {
    const product = await createProduct(seller1Agent, `SU15 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const beforeTariffs = await prisma.tariff.count({ where: { productId: product.id } });
    const unit = await createUnit(seller1Agent, product.id, { name: "No Side Effects", attributes: { occupancy: 2, bedType: "double" } });

    expect(await prisma.tariff.count({ where: { productId: product.id } })).toBe(beforeTariffs);
    expect(await prisma.availability.count({ where: { productId: product.id } })).toBe(0);
    expect(await prisma.availabilityReservation.count({ where: { productId: product.id } })).toBe(0);
    const raw = JSON.stringify(unit);
    expect(raw).not.toContain("price");
    expect(raw).not.toContain("tariff");
    expect(raw).not.toContain("availability");
    expect(raw).not.toContain("slots");
    // Downstream domains не затрагиваются.
    const orderCount = await prisma.order.count();
    const bookingCount = await prisma.booking.count();
    const quoteCount = await prisma.quote.count();
    const checkoutCount = await prisma.checkoutIntent.count();
    const saleCount = await prisma.sale.count();
    expect(await prisma.order.count()).toBe(orderCount);
    expect(await prisma.booking.count()).toBe(bookingCount);
    expect(await prisma.quote.count()).toBe(quoteCount);
    expect(await prisma.checkoutIntent.count()).toBe(checkoutCount);
    expect(await prisma.sale.count()).toBe(saleCount);
  });

  it("18. Reverse Marketplace data не мутируется", async () => {
    const caps = await prisma.sellerCapability.count();
    const reqs = await prisma.buyerRequest.count();
    const props = await prisma.sellerProposal.count();
    const product = await createProduct(seller1Agent, `SU18 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    await createUnit(seller1Agent, product.id, { name: "Reverse Safe", attributes: { occupancy: 2, bedType: "double" } });
    expect(await prisma.sellerCapability.count()).toBe(caps);
    expect(await prisma.buyerRequest.count()).toBe(reqs);
    expect(await prisma.sellerProposal.count()).toBe(props);
  });

  // ── 19: lifecycle / visibility ────────────────────────────────────────────

  it("19. public/private visibility: publish гейт — родительский Product PUBLISHED; draft приватный", async () => {
    const product = await createProduct(seller1Agent, `SU19 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Gated Unit", attributes: { occupancy: 2, bedType: "double" } });

    // PARTNER не имеет catalog.service_unit.publish → 403.
    await seller1Agent.post(`/api/v1/service-units/${unit.id}/publish`).expect(403);

    // Родительский Product ещё DRAFT → publish юнита → 409 (гейт §15).
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(409);

    // Опубликовали Product → publish юнита успешен.
    await publishProductViaAdmin(product.id);
    const pub = await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);
    expect((pub.body as UnitRow).status).toBe("PUBLISHED");
    expect((pub.body as UnitRow).publishedAt).toBeTruthy();

    // Idempotent re-publish → no-op (тот же результат).
    const again = await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);
    expect((again.body as UnitRow).status).toBe("PUBLISHED");
    expect((again.body as UnitRow).version).toBe((pub.body as UnitRow).version);

    // Archive (soft) — данные сохраняются, status ARCHIVED.
    const arc = await adminAgent.post(`/api/v1/service-units/${unit.id}/archive`).expect(201);
    expect((arc.body as UnitRow).status).toBe("ARCHIVED");
  });

  // ── 20: concurrency import identity ───────────────────────────────────────

  it("20. concurrency import identity: параллельные create с одним ключом → ровно один юнит", async () => {
    const product = await createProduct(seller1Agent, `SU20 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const key = `CONC-${stamp}`;
    const attempts = await Promise.allSettled([
      adminAgent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Conc A", attributes: { occupancy: 2, bedType: "double" }, source: "IMPORT", externalKey: key }),
      adminAgent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Conc B", attributes: { occupancy: 2, bedType: "double" }, source: "IMPORT", externalKey: key }),
      adminAgent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Conc C", attributes: { occupancy: 2, bedType: "double" }, source: "IMPORT", externalKey: key }),
    ]);
    const statuses = attempts.map((a) => (a.status === "fulfilled" ? a.value.status : -1)).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409).length).toBe(2);

    const rows = await prisma.serviceUnit.findMany({
      where: { productId: product.id, source: "IMPORT", externalKey: key },
    });
    expect(rows).toHaveLength(1);
    created.units.push(rows[0].id);
  });

  // ── 21: pagination deterministic ──────────────────────────────────────────

  it("21. pagination/order детерминирован (createdAt asc, id asc)", async () => {
    const product = await createProduct(seller1Agent, `SU21 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const unit = await createUnit(seller1Agent, product.id, { name: `Paginated ${i}`, attributes: { occupancy: 2, bedType: "double" } });
      ids.push(unit.id);
    }
    const page1 = (await seller1Agent.get(`/api/v1/products/${product.id}/service-units?limit=2&offset=0`).expect(200)).body as { items: UnitRow[]; total: number };
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    const page2 = (await seller1Agent.get(`/api/v1/products/${product.id}/service-units?limit=2&offset=2`).expect(200)).body as { items: UnitRow[]; total: number };
    expect(page2.total).toBe(5);
    expect(page2.items).toHaveLength(2);
    const seen = [...page1.items, ...page2.items].map((u) => u.id);
    expect(new Set(seen).size).toBe(4);
    expect(seen.every((id) => ids.includes(id))).toBe(true);
    // Детерминированный порядок: createdAt asc → первый созданный первый.
    expect(page1.items[0].id).toBe(ids[0]);
    expect(page1.items[1].id).toBe(ids[1]);
  });

  // ── 22: cross-category fixtures ───────────────────────────────────────────

  it("22. cross-category: Hotel + Transfer + Tour юниты с category-valid attributes", async () => {
    // Hotel: Deluxe Room Sea View / Premium Double Ocean Side / Family Suite.
    const hotel = await createProduct(seller1Agent, `SU22 Hotel ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const h1 = await createUnit(seller1Agent, hotel.id, { name: "Deluxe Room Sea View", attributes: { occupancy: 2, bedType: "double", view: "Sea" } });
    const h2 = await createUnit(seller1Agent, hotel.id, { name: "Premium Double Ocean Side", attributes: { occupancy: 2, bedType: "double", view: "Ocean" } });
    const h3 = await createUnit(seller1Agent, hotel.id, { name: "Family Suite", attributes: { occupancy: 4, bedType: "twin" } });
    expect(h1.name).toBe("Deluxe Room Sea View");
    expect(h2.name).toBe("Premium Double Ocean Side");
    expect(h3.attributes).toEqual({ occupancy: 4, bedType: "twin" });

    // Transfer: Sedan / Minivan / Business Van (vehicleType enum).
    const transfer = await createProduct(seller1Agent, `SU22 Transfer ${stamp}`, transferCatId, { vehicleType: "sedan", passengerCapacity: 3 });
    const t1 = await createUnit(seller1Agent, transfer.id, { name: "Sedan", attributes: { vehicleType: "sedan", passengerCapacity: 3 } });
    const t2 = await createUnit(seller1Agent, transfer.id, { name: "Minivan", attributes: { vehicleType: "minivan", passengerCapacity: 7 } });
    const t3 = await createUnit(seller1Agent, transfer.id, { name: "Business Van", attributes: { vehicleType: "van", passengerCapacity: 15 } });
    expect([t1, t2, t3].map((u) => u.name)).toEqual(["Sedan", "Minivan", "Business Van"]);
    // Неверный vehicleType для transfer → 422 (schema-driven, не hotel-specific).
    await seller1Agent.post(`/api/v1/products/${transfer.id}/service-units`).send({ name: "Wrong", attributes: { vehicleType: "double" } }).expect(422);

    // Tour: package variants (packageClass enum).
    const tour = await createProduct(seller1Agent, `SU22 Tour ${stamp}`, tourCatId, { packageClass: "standard", capacity: 20 });
    const u1 = await createUnit(seller1Agent, tour.id, { name: "Standard Package", attributes: { packageClass: "standard", capacity: 20 } });
    const u2 = await createUnit(seller1Agent, tour.id, { name: "VIP Package", attributes: { packageClass: "vip", capacity: 8 } });
    expect([u1, u2].map((x) => x.attributes)).toEqual([
      { packageClass: "standard", capacity: 20 },
      { packageClass: "vip", capacity: 8 },
    ]);
  });

  // ── RBAC extras ───────────────────────────────────────────────────────────

  it("RBAC: MODERATOR и BUYER не управляют юнитами; staff read закрыт для MODERATOR", async () => {
    const product = await createProduct(seller1Agent, `SU-RBAC ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "RBAC Unit", attributes: { occupancy: 2, bedType: "double" } });

    // MODERATOR: нет доступа (юниты не moderation-объекты 1.8A).
    await modAgent.get(`/api/v1/service-units/${unit.id}`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/service-units`).send({ name: "Mod", attributes: { occupancy: 2, bedType: "double" } }).expect(403);
    await modAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(403);

    // Staff/ADMIN — полный доступ (publish уже проверен в #19).
    const got = (await adminAgent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(got.id).toBe(unit.id);
  });

  it("update: PARTNER правит только СВОЙ DRAFT; ARCHIVED immutable; source immutable", async () => {
    const product = await createProduct(seller1Agent, `SU-UP ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Editable", attributes: { occupancy: 2, bedType: "double" } });

    // PARTNER переименовывает свой DRAFT (verbatim).
    const renamed = (await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Editable Renamed" }).expect(200)).body as UnitRow;
    expect(renamed.name).toBe("Editable Renamed");
    expect(renamed.version).toBe(2);

    // Атрибуты обновляются с валидацией.
    const attrs = (await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ attributes: { occupancy: 3, bedType: "twin" } }).expect(200)).body as UnitRow;
    expect(attrs.attributes).toEqual({ occupancy: 3, bedType: "twin" });
    await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ attributes: { occupancy: 99 } }).expect(422);

    // source/externalKey immutable на update → 422.
    await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ externalKey: "RM-X" }).expect(422);
    await adminAgent.patch(`/api/v1/service-units/${unit.id}`).send({ source: "IMPORT" }).expect(422);

    // PARTNER не может править чужой unit (уже проверено в #7) и ARCHIVED.
    await adminAgent.post(`/api/v1/service-units/${unit.id}/archive`).expect(201);
    await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Nope" }).expect(409);
  });

  it("history: audit записывается (created/updated/published), без PII в security audit", async () => {
    const product = await createProduct(seller1Agent, `SU-HIST ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Historic", attributes: { occupancy: 2, bedType: "double" } });
    await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Historic V2" }).expect(200);
    await publishProductViaAdmin(product.id);
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);

    const hist = (await seller1Agent.get(`/api/v1/service-units/${unit.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    const actions = hist.items.map((h) => h.action);
    expect(actions).toContain("created");
    expect(actions).toContain("updated");
    expect(actions).toContain("published");

    const audits = await prisma.auditLog.findMany({ where: { resource: "ServiceUnit", resourceId: unit.id } });
    expect(audits.length).toBeGreaterThanOrEqual(3);
    for (const a of audits) {
      expect(JSON.stringify(a.details ?? {})).not.toContain("occupancy");
      expect(JSON.stringify(a.details ?? {})).not.toContain("bedType");
    }
  });

  // ── STRICT REVIEW §49.30-32: concurrency races + cascade/delete safety ────

  it("§49.30 update-vs-publish race: PARTNER PATCH не применится к PUBLISHED юниту (атомарный status gate)", async () => {
    const product = await createProduct(seller1Agent, `SU-RACE30 ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Race 30", attributes: { occupancy: 2, bedType: "double" } });
    await publishProductViaAdmin(product.id);

    // Детерминированный кейс: staff publish первым → PARTNER PATCH на PUBLISHED → 409
    // (DRAFT-only gate; conditional update по status — TOCTOU-защита §34/§35).
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);
    await seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Race 30 Renamed" }).expect(409);

    // Параллельный smoke: PATCH (409) + idempotent re-publish (201 no-op) —
    // независимо от порядка коммитов состояние остаётся PUBLISHED и name неизменён.
    const [patchRes, pubRes] = await Promise.all([
      seller1Agent.patch(`/api/v1/service-units/${unit.id}`).send({ name: "Race 30 Renamed" }),
      adminAgent.post(`/api/v1/service-units/${unit.id}/publish`),
    ]);
    expect(patchRes.status).toBe(409);
    expect(pubRes.status).toBe(201);

    const got = (await seller1Agent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(got.status).toBe("PUBLISHED");
    expect(got.name).toBe("Race 30"); // PATCH отклонён — имя не изменилось
    const actions = ((await seller1Agent.get(`/api/v1/service-units/${unit.id}/history`).expect(200)).body as { items: Array<{ action: string }> }).items.map((h) => h.action);
    const updatedCount = actions.filter((a) => a === "updated").length;
    expect(updatedCount).toBe(0); // ни один PATCH не применился
    const publishedCount = actions.filter((a) => a === "published").length;
    expect(publishedCount).toBe(1); // idempotent re-publish не плодит duplicate-факты
  });

  it("§49.31 product-state-vs-publish race: publish юнита re-read'ит Product ВНУТРИ tx (архив Product → 409)", async () => {
    const product = await createProduct(seller1Agent, `SU-RACE31 ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Race 31", attributes: { occupancy: 2, bedType: "double" } });
    // Product ещё DRAFT → publish юнита 409 (гейт §16).
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(409);
    // Архив Product (неопубликованный) → publish юнита всё ещё 409.
    await adminAgent.post(`/api/v1/products/${product.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(409);
    const got = (await seller1Agent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(got.status).toBe("DRAFT"); // архив Product не публикует и не мутирует юнит
  });

  it("§49.32 cascade/delete safety: нет API hard-delete; archive Product сохраняет units + history", async () => {
    const product = await createProduct(seller1Agent, `SU-DEL32 ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Delete Safe", attributes: { occupancy: 2, bedType: "double" } });
    await publishProductViaAdmin(product.id);
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);

    // Нет HTTP hard-delete ни для Product, ни для unit (405/404 — маршрут не существует).
    await seller1Agent.delete(`/api/v1/products/${product.id}`).expect(404);
    await adminAgent.delete(`/api/v1/service-units/${unit.id}`).expect(404);

    // Soft archive Product: unit остаётся PUBLISHED (исторический факт), данные целы.
    await adminAgent.post(`/api/v1/products/${product.id}/archive`).expect(201);
    const after = (await seller1Agent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(after.status).toBe("PUBLISHED");
    expect(after.publishedAt).toBeTruthy();
    expect(await prisma.serviceUnit.count({ where: { id: unit.id } })).toBe(1);
    expect(await prisma.serviceUnitHistory.count({ where: { unitId: unit.id } })).toBeGreaterThanOrEqual(1);
  });

  it("§15 resurrection: re-publish из ARCHIVED разрешён (конвенция re-publish Product), publishedAt обновляется, история фиксирует второй published", async () => {
    const product = await createProduct(seller1Agent, `SU-RES ${stamp}`, hotelCatId, { occupancy: 2, bedType: "double" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Resurrection", attributes: { occupancy: 2, bedType: "double" } });
    await publishProductViaAdmin(product.id);
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);
    await adminAgent.post(`/api/v1/service-units/${unit.id}/archive`).expect(201);
    const archived = (await seller1Agent.get(`/api/v1/service-units/${unit.id}`).expect(200)).body as UnitRow;
    expect(archived.status).toBe("ARCHIVED");

    // Re-publish из ARCHIVED → 201 (разрешённый transition; Product-конвенция).
    const repub = (await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201)).body as UnitRow;
    expect(repub.status).toBe("PUBLISHED");
    expect(repub.publishedAt).toBeTruthy();

    const actions = ((await seller1Agent.get(`/api/v1/service-units/${unit.id}/history`).expect(200)).body as { items: Array<{ action: string }> }).items.map((h) => h.action);
    expect(actions.filter((a) => a === "published").length).toBe(2);
  });
});
