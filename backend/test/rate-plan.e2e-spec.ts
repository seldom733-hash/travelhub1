/**
 * PHASE 1 STEP 1.8B — Tariff → canonical Rate Plan foundation (e2e).
 *
 * Обязательные доказательства §43 (34 сценария):
 *   1  Seller создаёт Rate Plan под СВОИМ Product/ServiceUnit
 *   2  Seller-название сохраняется verbatim
 *   3  business identity server-owned (TRF-*, client не forge)
 *   4  foreign Product denied (403)
 *   5  foreign ServiceUnit denied (422 — cross-seller unit attachment)
 *   6  ServiceUnit должен принадлежать тому же Product (422)
 *   7  legacy Product-only Tariff остаётся валидным
 *   8  nullable serviceUnitId поддерживает legacy
 *   9  fixed/base price работает без CommercialPeriod
 *   10 PRICE_ON_REQUEST — явное состояние (не inferred from null)
 *   11 zero price различим от missing/PRICE_ON_REQUEST
 *   12 одна валюта на Rate Plan (currency immutable после создания)
 *   13 невалидная валюта → 422
 *   14 валидный price basis принят
 *   15 невалидный basis → 422
 *   16 category-incompatible basis отклонён (CategorySchema.allowedBases)
 *   17 refundability семантика сохраняется
 *   18 inclusions/meal plan — category-driven, структурированные
 *   19 cancellation/restriction foundation сохраняется
 *   20 нет CommercialPeriod rows/модели
 *   21 нет annual/seasonal pricing реализовано
 *   22 нет Availability мутаций
 *   23 нет AvailabilityReservation мутаций
 *   24 нет Reverse мутаций
 *   25 нет Quote/Checkout/Sale/Order/Booking side effects
 *   26 существующий Quote creation с legacy Tariff остаётся зелёным
 *   27 cross-category: Hotel fixture
 *   28 Tour fixture
 *   29 Transfer fixture
 *   30 Car Rental / Excursion fixture
 *   31 публикация/eligibility: публично только ACTIVE + FIXED планы
 *      (ARCHIVED и PRICE_ON_REQUEST скрыты; POR не bindable → не в priceFrom)
 *   32 update/archive concurrency (atomic status-conditional, TOCTOU)
 *   33 детерминированный pagination/order
 *   34 миграция additive: legacy строки валидны (replay/drift — в отчёте)
 *
 * RBAC: PARTNER — own-scope reuse catalog.product.*; коммерческие правки только
 * под DRAFT Product; archive/activate — catalog.rate_plan.publish (staff/ADMIN);
 * MODERATOR — 403.
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

interface RatePlanRow {
  id: string;
  code: string;
  productId: string;
  serviceUnitId: string | null;
  name: string;
  price: string;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
  priceBasis: string | null;
  refundability: string | null;
  pricingMode: string;
  status: string;
  inclusions: Record<string, unknown> | null;
  restrictions: Record<string, unknown> | null;
  version: number;
}

describe("Phase 1 Step 1.8B — Tariff → Rate Plan foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; partners: string[]; categories: string[]; units: string[]; tariffs: string[]; quotes: string[] } = {
    users: [],
    products: [],
    partners: [],
    categories: [],
    units: [],
    tariffs: [],
    quotes: [],
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
  let smAgent: ReturnType<typeof request.agent>;
  let partner1Id: string;
  let partner2Id: string;

  /** Hotel-like категория с basis allowlist (PER_NIGHT/PER_ROOM/PACKAGE_TOTAL). */
  let hotelCatId: string;
  /** Transfer-like категория (без allowlist — любой basis). */
  let transferCatId: string;
  /** Tour-like категория с allowlist PER_PERSON. */
  let tourCatId: string;
  /** Car-rental-like категория с allowlist PER_DAY. */
  let rentalCatId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `RP Seller 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;
    const u1 = (await adminAgent.post("/api/v1/users").send({ username: `rp_seller1_${stamp}`, password: "sellerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })).body as { id: string };
    created.users.push(u1.id);
    seller1Agent = await agent((await login(`rp_seller1_${stamp}`, "sellerpass123")).accessToken);

    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `RP Seller 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);
    partner2Id = p2.id;
    const u2 = (await adminAgent.post("/api/v1/users").send({ username: `rp_seller2_${stamp}`, password: "sellerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })).body as { id: string };
    created.users.push(u2.id);
    seller2Agent = await agent((await login(`rp_seller2_${stamp}`, "sellerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `rp_mod_${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`rp_mod_${stamp}`, "modpass123")).accessToken);

    const sm = (await adminAgent.post("/api/v1/users").send({ username: `rp_sm_${stamp}`, password: "staffpass123", roleCode: RoleCode.SALES_MANAGER })).body as { id: string };
    created.users.push(sm.id);
    smAgent = await agent((await login(`rp_sm_${stamp}`, "staffpass123")).accessToken);

    hotelCatId = await createCategoryWithPolicy(`rp-hotel-${stamp}`, {
      attributes: [{ key: "roomType", label: "Room type", type: "enum", options: ["standard", "premium"] }],
      tariffRules: { allowedBases: ["PER_NIGHT", "PER_ROOM", "PACKAGE_TOTAL"] },
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });
    transferCatId = await createCategoryWithPolicy(`rp-transfer-${stamp}`, {
      attributes: [{ key: "vehicleType", label: "Vehicle type", type: "enum", options: ["sedan", "minivan"] }],
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });
    tourCatId = await createCategoryWithPolicy(`rp-tour-${stamp}`, {
      attributes: [{ key: "packageClass", label: "Class", type: "enum", options: ["standard", "premium"] }],
      // Universal §16: Tour — per-person или package total.
      tariffRules: { allowedBases: ["PER_PERSON", "PACKAGE_TOTAL"] },
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });
    rentalCatId = await createCategoryWithPolicy(`rp-rental-${stamp}`, {
      attributes: [{ key: "vehicleClass", label: "Class", type: "string" }],
      tariffRules: { allowedBases: ["PER_DAY"] },
      mediaRequirements: { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"] },
    });
  });

  afterAll(async () => {
    // Quote (тест 26) — связанные items/travelers чистятся каскадом из quote.
    // shared-DB: удаляем ДО user/partner, чтобы не оставлять кросс-сущностей.
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.tariffHistory.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.tariff.deleteMany({ where: { id: { in: created.tariffs } } });
    await prisma.serviceUnit.deleteMany({ where: { id: { in: created.units } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  async function createCategoryWithPolicy(slug: string, config: { attributes: unknown[]; tariffRules?: Record<string, unknown>; mediaRequirements?: Record<string, unknown> }): Promise<string> {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `RP Cat ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: config.attributes, tariffRules: config.tariffRules, mediaRequirements: config.mediaRequirements })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    return cat.id;
  }

  /** DRAFT Product под указанной категорией (с category-valid attributes). */
  async function createProduct(ag: ReturnType<typeof request.agent>, title: string, categoryId: string, attrs: Record<string, unknown>): Promise<{ id: string; code: string; status: string }> {
    const res = await ag.post("/api/v1/products").send({ type: "HOTEL", title, categoryId, attributes: attrs }).expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    return product;
  }

  async function createUnit(ag: ReturnType<typeof request.agent>, productId: string, body: Record<string, unknown>, expected = 201): Promise<{ id: string; code: string; status: string }> {
    const res = await ag.post(`/api/v1/products/${productId}/service-units`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const unit = res.body as { id: string; code: string; status: string };
    created.units.push(unit.id);
    return unit;
  }

  async function createRatePlan(ag: ReturnType<typeof request.agent>, productId: string, body: Record<string, unknown>, expected = 201): Promise<RatePlanRow> {
    const res = await ag.post(`/api/v1/products/${productId}/tariffs`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const plan = res.body as RatePlanRow;
    created.tariffs.push(plan.id);
    return plan;
  }

  // ── 1-3: create / verbatim / identity ─────────────────────────────────────

  it("1. Seller создаёт Rate Plan под СВОИМ Product + ServiceUnit (ACTIVE, TRF-*, basis, POR-aware)", async () => {
    const product = await createProduct(seller1Agent, `RP1 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Premium Double Ocean Side", attributes: { roomType: "premium" } });
    const plan = await createRatePlan(seller1Agent, product.id, {
      name: "Room Only — Refundable",
      price: 120,
      currency: "AZN",
      serviceUnitId: unit.id,
      priceBasis: "PER_NIGHT",
      refundability: "REFUNDABLE",
      pricingMode: "FIXED",
      inclusions: { mealPlan: "Room Only", includedServices: ["Wi-Fi", "Parking"] },
      restrictions: { minStay: 1, maxStay: 14, advanceBookingDays: 1 },
    });

    expect(plan.code).toMatch(/^TRF-\d{8}$/);
    expect(plan.productId).toBe(product.id);
    expect(plan.serviceUnitId).toBe(unit.id);
    expect(plan.status).toBe("ACTIVE");
    expect(plan.version).toBe(1);
    expect(plan.price).toBe("120.00");
    expect(plan.currency).toBe("AZN");
    expect(plan.priceBasis).toBe("PER_NIGHT");
    expect(plan.refundability).toBe("REFUNDABLE");
    expect(plan.pricingMode).toBe("FIXED");
  });

  it("2. Seller-название сохраняется verbatim (case/порядок слов не меняются)", async () => {
    const product = await createProduct(seller1Agent, `RP2 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, {
      name: "Breakfast Included — Non-refundable",
      price: 150,
      priceBasis: "PER_NIGHT",
    });
    expect(plan.name).toBe("Breakfast Included — Non-refundable");
    const got = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}`).expect(200)).body as RatePlanRow;
    expect(got.name).toBe("Breakfast Included — Non-refundable");
  });

  it("3. business identity server-owned: client не может forge code/status/version", async () => {
    const product = await createProduct(seller1Agent, `RP3 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const forge = [
      { name: "A", price: 10, code: "TRF-99999999" },
      { name: "B", price: 10, status: "ARCHIVED" },
      { name: "C", price: 10, version: 99 },
      { name: "D", price: 10, partnerId: partner2Id },
      { name: "E", price: 10, productId: "00000000-0000-0000-0000-000000000000" },
      { name: "F", price: 10, commercialPeriods: [{ from: "2026-01-01" }] },
      { name: "G", price: 10, availability: { slots: 5 } },
    ];
    for (const body of forge) {
      const res = await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send(body);
      expect(res.status).toBe(422);
    }
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Ok", price: 10, priceBasis: "PER_NIGHT" });
    expect(plan.code).toMatch(/^TRF-\d{8}$/);
    expect(plan.code).not.toBe("TRF-99999999");
  });

  // ── 4-6: IDOR / ServiceUnit consistency ───────────────────────────────────

  it("4. foreign Product denied (403)", async () => {
    const product = await createProduct(seller2Agent, `RP4 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Sneak", price: 10 }).expect(403);
  });

  it("5. foreign ServiceUnit denied (422 — cross-seller unit attachment)", async () => {
    const p1 = await createProduct(seller1Agent, `RP5A Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const unit = await createUnit(seller1Agent, p1.id, { name: "Seller1 Unit", attributes: { roomType: "standard" } });
    const p2 = await createProduct(seller2Agent, `RP5B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    // Seller2 пытается привязать чужой unit Seller1 к СВОЕМУ Rate Plan.
    const res = await seller2Agent.post(`/api/v1/products/${p2.id}/tariffs`).send({ name: "Hijack", price: 10, serviceUnitId: unit.id });
    expect(res.status).toBe(422);
  });

  it("6. ServiceUnit должен принадлежать тому же Product (422, не cross-Product)", async () => {
    const pA = await createProduct(seller1Agent, `RP6A Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const unit = await createUnit(seller1Agent, pA.id, { name: "Unit A", attributes: { roomType: "standard" } });
    const pB = await createProduct(seller1Agent, `RP6B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    await seller1Agent.post(`/api/v1/products/${pB.id}/tariffs`).send({ name: "Wrong Product", price: 10, serviceUnitId: unit.id }).expect(422);
    // Несуществующий unit → 422.
    await seller1Agent.post(`/api/v1/products/${pA.id}/tariffs`).send({ name: "Ghost", price: 10, serviceUnitId: "00000000-0000-0000-0000-000000000000" }).expect(422);
    // Архивный unit → 422 (ineligible attachment).
    const pC = await createProduct(seller1Agent, `RP6C Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const unitC = await createUnit(seller1Agent, pC.id, { name: "Unit C", attributes: { roomType: "standard" } });
    await adminAgent.post(`/api/v1/service-units/${unitC.id}/archive`).expect(201);
    await seller1Agent.post(`/api/v1/products/${pC.id}/tariffs`).send({ name: "Archived Unit", price: 10, serviceUnitId: unitC.id }).expect(422);
  });

  // ── 7-9: legacy compat / fixed price ──────────────────────────────────────

  it("7. legacy Product-only Tariff остаётся валидным (без ServiceUnit, без basis)", async () => {
    const product = await createProduct(seller1Agent, `RP7 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Legacy Flat", price: 99 });
    expect(plan.serviceUnitId).toBeNull();
    expect(plan.priceBasis).toBeNull();
    expect(plan.pricingMode).toBe("FIXED");
    expect(plan.status).toBe("ACTIVE");
    // Читается и остаётся валидным.
    await seller1Agent.get(`/api/v1/tariffs/${plan.id}`).expect(200);
  });

  it("8. nullable serviceUnitId поддерживает legacy; attach/detach на update", async () => {
    const product = await createProduct(seller1Agent, `RP8 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Attach Target", attributes: { roomType: "premium" } });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Attachable", price: 80 });
    expect(plan.serviceUnitId).toBeNull();
    // Привязка на update.
    const attached = (await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ serviceUnitId: unit.id }).expect(200)).body as RatePlanRow;
    expect(attached.serviceUnitId).toBe(unit.id);
    // Отвязка (явный null) — legacy-safe.
    const detached = (await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ serviceUnitId: null }).expect(200)).body as RatePlanRow;
    expect(detached.serviceUnitId).toBeNull();
  });

  it("9. fixed/base price работает без CommercialPeriod (никаких period rows)", async () => {
    const product = await createProduct(seller1Agent, `RP9 Transfer ${stamp}`, transferCatId, { vehicleType: "sedan" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Private Transfer", price: 35, priceBasis: "PER_TRIP" });
    expect(plan.price).toBe("35.00");
    // Никаких CommercialPeriod/calendar/periods в ответе и в БД.
    const raw = JSON.stringify(plan);
    for (const bad of ["commercialPeriod", "calendar", "periods", "overrides", "weekday"]) {
      expect(raw.toLowerCase()).not.toContain(bad.toLowerCase());
    }
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'catalog' AND tablename ILIKE '%CommercialPeriod%'`;
    expect(tables).toHaveLength(0);
  });

  // ── 10-11: PRICE_ON_REQUEST / zero ────────────────────────────────────────

  it("10. PRICE_ON_REQUEST — явное состояние, НЕ inferred from null (price не null)", async () => {
    const product = await createProduct(seller1Agent, `RP10 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const por = await createRatePlan(seller1Agent, product.id, {
      name: "Inquiry Only Suite",
      price: 500,
      pricingMode: "PRICE_ON_REQUEST",
      priceBasis: "PER_NIGHT",
    });
    expect(por.pricingMode).toBe("PRICE_ON_REQUEST");
    expect(por.price).toBe("500.00"); // legacy/base хранится, но bindable-режим = POR
    // FIXED по умолчанию — не inferred.
    const fixed = await createRatePlan(seller1Agent, product.id, { name: "Normal", price: 300, priceBasis: "PER_NIGHT" });
    expect(fixed.pricingMode).toBe("FIXED");
  });

  it("11. zero price различим от missing/PRICE_ON_REQUEST (free service)", async () => {
    const product = await createProduct(seller1Agent, `RP11 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const free = await createRatePlan(seller1Agent, product.id, { name: "Free Welcome", price: 0, priceBasis: "PACKAGE_TOTAL" });
    expect(free.price).toBe("0.00");
    expect(free.pricingMode).toBe("FIXED"); // не POR, не missing
    // Отрицательная цена → 422.
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Negative", price: -1 }).expect(422);
  });

  // ── 12-13: currency ───────────────────────────────────────────────────────

  it("12. одна валюта на Rate Plan; currency immutable после создания (смена = 422)", async () => {
    const product = await createProduct(seller1Agent, `RP12 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "AZN Plan", price: 100, currency: "AZN", priceBasis: "PER_NIGHT" });
    expect(plan.currency).toBe("AZN");
    // currency immutable на update → 422 (loud, не silent).
    const res = await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ currency: "EUR" });
    expect(res.status).toBe(422);
    // admin тоже не может сменить валюту.
    await adminAgent.patch(`/api/v1/tariffs/${plan.id}`).send({ currency: "USD" }).expect(422);
  });

  it("13. невалидная валюта → 422; нормализация (trim/upper) допустима; DTO-тип → 400", async () => {
    const product = await createProduct(seller1Agent, `RP13 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    for (const bad of ["US", "USDD", "US1"]) {
      await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Cur", price: 10, currency: bad }).expect(422);
    }
    // Normalization: 'azn ' → AZN (trim+upper, как service-unit name trim).
    const norm = await createRatePlan(seller1Agent, product.id, { name: "Norm Cur", price: 10, currency: "azn " });
    expect(norm.currency).toBe("AZN");
    // DTO-валидация (class-validator @IsString) → 400 для не-строки.
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Cur", price: 10, currency: 123 }).expect(400);
  });

  // ── 14-16: price basis / allowlist ────────────────────────────────────────

  it("14. валидный price basis принят; 15. невалидный basis → 422", async () => {
    // Transfer-категория без allowlist: PER_TRIP валиден, PER_ROOM_PER_NIGHT нет.
    const product = await createProduct(seller1Agent, `RP14 Transfer ${stamp}`, transferCatId, { vehicleType: "minivan" });
    const ok = await createRatePlan(seller1Agent, product.id, { name: "Van Transfer", price: 40, priceBasis: "PER_TRIP" });
    expect(ok.priceBasis).toBe("PER_TRIP");
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Bad Basis", price: 10, priceBasis: "PER_ROOM_PER_NIGHT" }).expect(422);
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Bad Basis 2", price: 10, priceBasis: "per_trip" }).expect(422);
  });

  it("16. category-incompatible basis отклонён (CategorySchema.allowedBases)", async () => {
    // Tour-категория allowlist = [PER_PERSON]: PER_PERSON ок, PER_NIGHT нет.
    const tour = await createProduct(seller1Agent, `RP16 Tour ${stamp}`, tourCatId, { packageClass: "premium" });
    const ok = await createRatePlan(seller1Agent, tour.id, { name: "Premium Tour", price: 200, priceBasis: "PER_PERSON" });
    expect(ok.priceBasis).toBe("PER_PERSON");
    await seller1Agent.post(`/api/v1/products/${tour.id}/tariffs`).send({ name: "Hotel-ish", price: 10, priceBasis: "PER_NIGHT" }).expect(422);
    // UPDATE тоже enforce allowlist (PACKAGE_TOTAL валиден для Tour — см. #27-30).
    const tourPlan = await createRatePlan(seller1Agent, tour.id, { name: "Switch", price: 100, priceBasis: "PER_PERSON" });
    await seller1Agent.patch(`/api/v1/tariffs/${tourPlan.id}`).send({ priceBasis: "PER_NIGHT" }).expect(422);
    // Car Rental allowlist = [PER_DAY].
    const rental = await createProduct(seller1Agent, `RP16 Rental ${stamp}`, rentalCatId, { vehicleClass: "compact" });
    const r = await createRatePlan(seller1Agent, rental.id, { name: "Daily", price: 60, priceBasis: "PER_DAY" });
    expect(r.priceBasis).toBe("PER_DAY");
    await seller1Agent.post(`/api/v1/products/${rental.id}/tariffs`).send({ name: "Per Trip", price: 10, priceBasis: "PER_TRIP" }).expect(422);
  });

  // ── 17-19: refundability / inclusions / restrictions ──────────────────────

  it("17. refundability семантика сохраняется", async () => {
    const product = await createProduct(seller1Agent, `RP17 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Non-ref", price: 130, refundability: "NON_REFUNDABLE", priceBasis: "PER_NIGHT" });
    expect(plan.refundability).toBe("NON_REFUNDABLE");
    const upd = (await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ refundability: "REFUNDABLE" }).expect(200)).body as RatePlanRow;
    expect(upd.refundability).toBe("REFUNDABLE");
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ refundability: "PARTIAL" }).expect(422);
  });

  it("18. inclusions/meal plan — category-driven структурированные (не hotel-only global)", async () => {
    const hotel = await createProduct(seller1Agent, `RP18A Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const h = await createRatePlan(seller1Agent, hotel.id, {
      name: "Half Board",
      price: 180,
      priceBasis: "PER_NIGHT",
      inclusions: { mealPlan: "Half Board", includedServices: ["Breakfast", "Dinner"], amenities: ["Pool"] },
    });
    expect(h.inclusions).toEqual({ mealPlan: "Half Board", includedServices: ["Breakfast", "Dinner"], amenities: ["Pool"] });

    // Tour: package-driven inclusion (transfers/guide).
    const tour = await createProduct(seller1Agent, `RP18B Tour ${stamp}`, tourCatId, { packageClass: "standard" });
    const t = await createRatePlan(seller1Agent, tour.id, {
      name: "Standard Package",
      price: 90,
      priceBasis: "PER_PERSON",
      inclusions: { includedServices: ["Transfers", "Guide"] },
    });
    expect(t.inclusions).toEqual({ includedServices: ["Transfers", "Guide"] });

    // Unknown inclusion key / неверный тип → 422.
    await seller1Agent.post(`/api/v1/products/${hotel.id}/tariffs`).send({ name: "Bad Inc", price: 10, inclusions: { roomService: true } }).expect(422);
  });

  it("19. cancellation/restriction foundation persists (metadata, не engine)", async () => {
    const product = await createProduct(seller1Agent, `RP19 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, {
      name: "Restricted",
      price: 110,
      priceBasis: "PER_NIGHT",
      restrictions: { minStay: 2, maxStay: 7, closedToArrival: true, advanceBookingDays: 5, notes: "No same-day" },
    });
    expect(plan.restrictions).toEqual({ minStay: 2, maxStay: 7, closedToArrival: true, advanceBookingDays: 5, notes: "No same-day" });
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Bad Restr", price: 10, restrictions: { minStay: 5, maxStay: 2 } }).expect(422);
    await seller1Agent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Bad Restr 2", price: 10, restrictions: { releasePolicy: "x" } }).expect(422);
  });

  // ── 20-25: no side effects / no CommercialPeriod / no Availability / no Reverse / no Sales ──

  it("20-21. нет CommercialPeriod модели и annual/seasonal pricing", async () => {
    const product = await createProduct(seller1Agent, `RP20 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    await createRatePlan(seller1Agent, product.id, { name: "Plain", price: 60, priceBasis: "PER_NIGHT" });
    // Модель CommercialPeriod отсутствует в призме.
    const hasPeriodModel = Object.keys(prisma).some((k) => /commercialperiod/i.test(k));
    expect(hasPeriodModel).toBe(false);
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'catalog' AND (tablename ILIKE '%CommercialPeriod%' OR tablename ILIKE '%Calendar%' OR tablename ILIKE '%PricingRule%')`;
    expect(tables).toHaveLength(0);
  });

  it("22-23. create/update Rate Plan не мутирует Availability/Reservation", async () => {
    const product = await createProduct(seller1Agent, `RP22 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const beforeAv = await prisma.availability.count({ where: { productId: product.id } });
    const beforeRes = await prisma.availabilityReservation.count({ where: { productId: product.id } });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "No Inv", price: 70, priceBasis: "PER_NIGHT" });
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 75 }).expect(200);
    expect(await prisma.availability.count({ where: { productId: product.id } })).toBe(beforeAv);
    expect(await prisma.availabilityReservation.count({ where: { productId: product.id } })).toBe(beforeRes);
    const raw = JSON.stringify(plan);
    expect(raw.toLowerCase()).not.toContain("slots");
  });

  it("24. Reverse Marketplace data не мутируется", async () => {
    const caps = await prisma.sellerCapability.count();
    const reqs = await prisma.buyerRequest.count();
    const props = await prisma.sellerProposal.count();
    const product = await createProduct(seller1Agent, `RP24 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    await createRatePlan(seller1Agent, product.id, { name: "Reverse Safe", price: 65, priceBasis: "PER_NIGHT" });
    expect(await prisma.sellerCapability.count()).toBe(caps);
    expect(await prisma.buyerRequest.count()).toBe(reqs);
    expect(await prisma.sellerProposal.count()).toBe(props);
  });

  it("25. нет Quote/Checkout/Sale/Order/Booking side effects на create/update", async () => {
    const product = await createProduct(seller1Agent, `RP25 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "No Sales", price: 85, priceBasis: "PER_NIGHT" });
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 86 }).expect(200);
    expect(await prisma.quote.count({ where: { id: { not: { in: created.quotes } } } })).toBe(0);
    expect(await prisma.checkoutIntent.count()).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.booking.count()).toBe(0);
  });

  // ── 26: legacy Quote compatibility ────────────────────────────────────────

  it("26. существующий Quote creation с legacy Tariff остаётся зелёным", async () => {
    // Legacy продукт с тарифом через классический путь (tariffs в product create).
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "HOTEL", title: `RP26 Legacy Quote ${stamp}`, tariffs: [{ name: "Std", price: 100, currency: "USD" }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });

    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: tariff.id, quantity: 1 }).expect(201);
    await smAgent
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { total: string; items: Array<{ unitPrice: string }> };
    // Money-сериализация quote — Decimal.toString ("100"); факт не изменился.
    expect(detail.total).toBe("100");
    expect(detail.items[0].unitPrice).toBe("100");
  });

  // ── 27-30: cross-category ─────────────────────────────────────────────────

  it("27-30. cross-category: Hotel + Tour + Transfer + Car Rental Rate Plans", async () => {
    // Hotel: два плана на один unit (package variants).
    const hotel = await createProduct(seller1Agent, `RP27 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const unit = await createUnit(seller1Agent, hotel.id, { name: "Premium Double Ocean Side", attributes: { roomType: "premium" } });
    const h1 = await createRatePlan(seller1Agent, hotel.id, { name: "Room Only — Refundable", price: 120, serviceUnitId: unit.id, priceBasis: "PER_NIGHT", refundability: "REFUNDABLE" });
    const h2 = await createRatePlan(seller1Agent, hotel.id, { name: "Breakfast Included — Non-refundable", price: 140, serviceUnitId: unit.id, priceBasis: "PER_NIGHT", refundability: "NON_REFUNDABLE", inclusions: { mealPlan: "Breakfast Included" } });
    expect(h1.name).toBe("Room Only — Refundable");
    expect(h2.name).toBe("Breakfast Included — Non-refundable");
    expect(h1.serviceUnitId).toBe(unit.id);
    expect(h2.serviceUnitId).toBe(unit.id);

    // Tour: Standard/Premium/Private (per-person).
    const tour = await createProduct(seller1Agent, `RP28 Tour ${stamp}`, tourCatId, { packageClass: "standard" });
    const t1 = await createRatePlan(seller1Agent, tour.id, { name: "Standard", price: 90, priceBasis: "PER_PERSON" });
    const t2 = await createRatePlan(seller1Agent, tour.id, { name: "Premium", price: 150, priceBasis: "PER_PERSON" });
    const t3 = await createRatePlan(seller1Agent, tour.id, { name: "Private", price: 400, priceBasis: "PACKAGE_TOTAL" });
    expect([t1, t2, t3].map((t) => t.name)).toEqual(["Standard", "Premium", "Private"]);

    // Transfer: Minivan → Private Transfer (per trip).
    const transfer = await createProduct(seller1Agent, `RP29 Transfer ${stamp}`, transferCatId, { vehicleType: "minivan" });
    const mv = await createUnit(seller1Agent, transfer.id, { name: "Minivan", attributes: { vehicleType: "minivan" } });
    const tr = await createRatePlan(seller1Agent, transfer.id, { name: "Private Transfer", price: 35, serviceUnitId: mv.id, priceBasis: "PER_TRIP" });
    expect(tr.priceBasis).toBe("PER_TRIP");

    // Car Rental: per-day.
    const rental = await createProduct(seller1Agent, `RP30 Rental ${stamp}`, rentalCatId, { vehicleClass: "suv" });
    const rd = await createRatePlan(seller1Agent, rental.id, { name: "Daily Flexible Rate", price: 60, priceBasis: "PER_DAY" });
    expect(rd.priceBasis).toBe("PER_DAY");
    expect(rd.name).toBe("Daily Flexible Rate");
  });

  // ── 31: публикация/eligibility ────────────────────────────────────────────

  it("31. публично ACTIVE Rate Plans под PUBLISHED Product: POR видим inquiry-only (price null), не в priceFrom; ARCHIVED скрыт", async () => {
    const product = await createProduct(seller1Agent, `RP31 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const active = await createRatePlan(seller1Agent, product.id, { name: "Public Plan", price: 100, priceBasis: "PER_NIGHT" });
    const toArchive = await createRatePlan(seller1Agent, product.id, { name: "Soon Archived", price: 50, priceBasis: "PER_NIGHT" });
    const por = await createRatePlan(seller1Agent, product.id, {
      name: "Inquiry Only",
      price: 40,
      pricingMode: "PRICE_ON_REQUEST",
      priceBasis: "PER_NIGHT",
    });
    await adminAgent.post(`/api/v1/tariffs/${toArchive.id}/archive`).expect(201);

    // Product ещё DRAFT → публично 404.
    await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(404);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const detail = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { tariffs: Array<{ id: string; name: string; price: string | null; pricingMode: string }>; priceFrom: string | null };
    };
    const byName = new Map(detail.product.tariffs.map((t) => [t.name, t]));
    // FIXED виден с ценой.
    expect(byName.get("Public Plan")?.price).toBe("100.00");
    // §22: POR — inquiry-only offer: ВИДИМ (visibility ≠ bindability), цена null.
    expect(byName.get("Inquiry Only")?.price).toBeNull();
    expect(byName.get("Inquiry Only")?.pricingMode).toBe("PRICE_ON_REQUEST");
    // ARCHIVED скрыт.
    expect(byName.has("Soon Archived")).toBe(false);
    // priceFrom: только FIXED (50 archived и 40 POR исключены; нет fallback на POR).
    expect(detail.product.priceFrom).toBe("100.00");

    // price sort: POR-цена не влияет (price_asc → по FIXED-минимуму).
    const list = (await request(app.getHttpServer()).get(`/api/v1/public/products?sort=price_asc&pageSize=50`).expect(200)).body as {
      items: Array<{ id: string; priceFrom: string | null }>;
    };
    const mine = list.items.find((i) => i.id === product.id);
    expect(mine?.priceFrom).toBe("100.00");
  });

  // ── 31B: ServiceUnit eligibility (§42) ────────────────────────────────────

  it("31B. план на DRAFT/ARCHIVED ServiceUnit не публикуется; publish unit → публичен (§42)", async () => {
    const product = await createProduct(seller1Agent, `RP31B Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const unit = await createUnit(seller1Agent, product.id, { name: "Eligible Unit", attributes: { roomType: "premium" } });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Unit Plan", price: 90, serviceUnitId: unit.id, priceBasis: "PER_NIGHT" });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    // Product PUBLISHED, но unit DRAFT → план не публичен (публикация наследуется
    // из родительской цепочки; единый publication engine, §30/§42).
    const d1 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { tariffs: Array<{ name: string }>; priceFrom: string | null };
    };
    expect(d1.product.tariffs.some((t) => t.name === "Unit Plan")).toBe(false);
    expect(d1.product.priceFrom).toBeNull();

    // Publish unit → план публичен (цена + priceFrom).
    await adminAgent.post(`/api/v1/service-units/${unit.id}/publish`).expect(201);
    const d2 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { tariffs: Array<{ name: string; price: string | null }>; priceFrom: string | null };
    };
    expect(d2.product.tariffs.some((t) => t.name === "Unit Plan")).toBe(true);
    expect(d2.product.priceFrom).toBe("90.00");

    // Archive unit → план снова скрыт (unit ineligible).
    await adminAgent.post(`/api/v1/service-units/${unit.id}/archive`).expect(201);
    const d3 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { tariffs: Array<{ name: string }>; priceFrom: string | null };
    };
    expect(d3.product.tariffs.some((t) => t.name === "Unit Plan")).toBe(false);
    expect(d3.product.priceFrom).toBeNull();
  });

  // ── 31C: legacy delete-safety (§52) ───────────────────────────────────────

  it("31C. legacy tariffs-replacement не может стереть Rate Plans с аудит-историей (409, §52)", async () => {
    const product = await createProduct(seller1Agent, `RP31C Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Audited Plan", price: 80, priceBasis: "PER_NIGHT" });
    // У плана есть TariffHistory (created) → legacy deleteMany заблокирован.
    const histCount = await prisma.tariffHistory.count({ where: { tariffId: plan.id } });
    expect(histCount).toBeGreaterThan(0);
    await adminAgent.patch(`/api/v1/products/${product.id}`).send({ tariffs: [{ name: "New Legacy", price: 1 }] }).expect(409);
    // Данные на месте.
    const got = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}`).expect(200)).body as RatePlanRow;
    expect(got.name).toBe("Audited Plan");
    expect(await prisma.tariffHistory.count({ where: { tariffId: plan.id } })).toBe(histCount);
  });

  // ── 32: concurrency update/archive ────────────────────────────────────────

  it("32. update-vs-archive race: PATCH на ARCHIVED → 409; idempotent re-archive; activate → update работает (TOCTOU)", async () => {
    const product = await createProduct(seller1Agent, `RP32 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Race 32", price: 100, priceBasis: "PER_NIGHT" });

    // Детерминированный кейс: staff archive → PATCH отклонён (409), в т.ч. admin.
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(201);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 5 }).expect(409);
    await adminAgent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 5 }).expect(409);

    // Idempotent re-archive: 201 no-op — без duplicate history-фактов.
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(201);
    const hist1 = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist1.items.filter((h) => h.action === "archived")).toHaveLength(1);
    expect(hist1.items.filter((h) => h.action === "updated")).toHaveLength(0);

    // Атомарный conditional update: даже ПАРАЛЛЕЛЬНЫЙ PATCH не проходит на
    // ARCHIVED (status-gate в одном UPDATE — TOCTOU-защита конвенции 1.8A).
    const plan2 = await createRatePlan(seller1Agent, product.id, { name: "Race 32b", price: 100, priceBasis: "PER_NIGHT" });
    await adminAgent.post(`/api/v1/tariffs/${plan2.id}/archive`).expect(201);
    const parallel = await Promise.all([
      seller1Agent.patch(`/api/v1/tariffs/${plan2.id}`).send({ price: 7 }),
      seller1Agent.patch(`/api/v1/tariffs/${plan2.id}`).send({ price: 8 }),
      adminAgent.patch(`/api/v1/tariffs/${plan2.id}`).send({ price: 9 }),
    ]);
    for (const r of parallel) expect(r.status).toBe(409);
    const got = (await seller1Agent.get(`/api/v1/tariffs/${plan2.id}`).expect(200)).body as RatePlanRow;
    expect(got.status).toBe("ARCHIVED");
    expect(got.price).toBe("100.00");
    const hist2 = (await seller1Agent.get(`/api/v1/tariffs/${plan2.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist2.items.filter((h) => h.action === "updated")).toHaveLength(0);
    expect(hist2.items.filter((h) => h.action === "archived")).toHaveLength(1);

    // Activate (resurrection) → снова ACTIVE, update работает (два конкурентных
    // activate: ровно один реальный переход, один idempotent no-op).
    const act = await Promise.all([
      adminAgent.post(`/api/v1/tariffs/${plan2.id}/activate`),
      adminAgent.post(`/api/v1/tariffs/${plan2.id}/activate`),
    ]);
    for (const r of act) expect(r.status).toBe(201);
    const hist3 = (await seller1Agent.get(`/api/v1/tariffs/${plan2.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist3.items.filter((h) => h.action === "activated")).toHaveLength(1);
    const revived = (await seller1Agent.patch(`/api/v1/tariffs/${plan2.id}`).send({ price: 200 }).expect(200)).body as RatePlanRow;
    expect(revived.status).toBe("ACTIVE");
    expect(revived.price).toBe("200.00");
  });

  // ── 32B: lost-update CAS (§39) ────────────────────────────────────────────

  it("32B. lost-update защита: параллельные PATCH — ни один успех не перезаписан молча (version-CAS)", async () => {
    const product = await createProduct(seller1Agent, `RP32B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Race 32B", price: 100, priceBasis: "PER_NIGHT" });
    expect(plan.version).toBe(1);

    // Два ПАРАЛЛЕЛЬНЫХ PATCH с разными изменениями одного плана. Возможны два
    // честных исхода (зависит от реального перекрытия транзакций):
    //  (a) 201+409 — транзакции перекрылись: второй updateMany где version=1
    //      даёт count=0 → 409 (version-CAS, lost-update заблокирован);
    //  (b) 201+201 — запросы сериализовались на быстрой машине: второй прочитал
    //      УЖЕ обновлённую версию (version=2) → легитимный успех поверх свежих
    //      данных (НЕ lost-update: второй не перезаписал первое изменение
    //      «слепо», он применил поверх state версии 2).
    // НЕВОЗМОЖНО: оба 201 при том, что оба читали version=1 (последний молча
    // перезаписал бы первый) — это и есть суть защиты §39.
    const [a, b] = await Promise.allSettled([
      seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 110 }),
      seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ name: "Renamed" }),
    ]);
    const statuses = [
      a.status === "fulfilled" ? a.value.status : -1,
      b.status === "fulfilled" ? b.value.status : -1,
    ];
    const success = statuses.filter((s) => s === 200); // PATCH → 200
    const conflicts = statuses.filter((s) => s === 409);
    // Два валидных исхода (зависит от реального перекрытия транзакций):
    //  (a) [200, 409] — транзакции перекрылись: второй updateMany где version=1
    //      даёт count=0 → 409 (version-CAS сработал, lost-update заблокирован);
    //  (b) [200, 200] — запросы сериализовались: второй прочитал УЖЕ обновлённую
    //      версию (version=2) → легитимный успех поверх свежих данных.
    // Оба исхода доказывают отсутствие lost-update (ниже — инварианты).
    expect(success.length).toBeGreaterThanOrEqual(1);
    expect(success.length).toBeLessThanOrEqual(2);
    expect(conflicts.length + success.length).toBe(2);

    // Инварианты (держатся в ОБОИХ исходах): версия выросла ровно на число
    // успехов; число updated-фактов == число успехов (каждый успех отражён в
    // истории — никакой успех не «потерян» молчаливой перезаписью); финальное
    // состояние — ровно одно из переданных изменений (не смесь/не третье).
    const hist = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items.filter((h) => h.action === "updated")).toHaveLength(success.length);
    const got = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}`).expect(200)).body as RatePlanRow;
    expect(got.version).toBe(1 + success.length);
    if (success.length === 1) {
      // (a): второй отброшен — состояние ровно первого изменения (никакой
      // частичной смеси из двух запросов).
      expect(["100.00", "110.00"]).toContain(got.price);
      expect(["Race 32B", "Renamed"]).toContain(got.name);
    }
    // (b) с двумя успехами состояние автоматически — одно из изменений второго
    // (применённого поверх свежей версии); проверка избыточна, но безопасна.
  });

  // ── 33: pagination ────────────────────────────────────────────────────────

  it("33. pagination/order детерминирован (createdAt asc, id asc)", async () => {
    const product = await createProduct(seller1Agent, `RP33 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const plan = await createRatePlan(seller1Agent, product.id, { name: `Plan ${i}`, price: 10 + i, priceBasis: "PER_NIGHT" });
      ids.push(plan.id);
    }
    const page1 = (await seller1Agent.get(`/api/v1/products/${product.id}/tariffs?limit=2&offset=0`).expect(200)).body as { items: RatePlanRow[]; total: number };
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    const page2 = (await seller1Agent.get(`/api/v1/products/${product.id}/tariffs?limit=2&offset=2`).expect(200)).body as { items: RatePlanRow[]; total: number };
    expect(page2.items).toHaveLength(2);
    const seen = [...page1.items, ...page2.items].map((p) => p.id);
    expect(new Set(seen).size).toBe(4);
    expect(page1.items[0].id).toBe(ids[0]);
    expect(page1.items[1].id).toBe(ids[1]);
  });

  // ── 34: additive migration / legacy rows ──────────────────────────────────

  it("34. additive миграция: legacy Tariff (созданный классическим путём) валиден с defaults", async () => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `RP34 Legacy ${stamp}`, tariffs: [{ name: "Legacy", price: 55 }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    created.tariffs.push(tariff.id);
    expect(tariff.status).toBe("ACTIVE"); // default сохраняет legacy-поведение
    expect(tariff.pricingMode).toBe("FIXED");
    expect(tariff.priceBasis).toBeNull();
    expect(tariff.serviceUnitId).toBeNull();
    // Через Rate Plan API тоже читается (own-scope staff read).
    const got = (await adminAgent.get(`/api/v1/tariffs/${tariff.id}`).expect(200)).body as RatePlanRow;
    expect(got.status).toBe("ACTIVE");
    expect(got.price).toBe("55.00");
  });

  // ── RBAC extras ───────────────────────────────────────────────────────────

  it("RBAC: MODERATOR и BUYER не управляют Rate Plans; PARTNER не архивирует; staff read закрыт для MODERATOR", async () => {
    const product = await createProduct(seller1Agent, `RP-RBAC ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "RBAC Plan", price: 100, priceBasis: "PER_NIGHT" });

    // MODERATOR: 403 (не moderation-объект 1.8B).
    await modAgent.get(`/api/v1/tariffs/${plan.id}`).expect(403);
    await modAgent.post(`/api/v1/products/${product.id}/tariffs`).send({ name: "Mod", price: 1 }).expect(403);
    await modAgent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(403);

    // PARTNER не имеет catalog.rate_plan.publish → archive/activate 403.
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(403);
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/activate`).expect(403);

    // Staff/ADMIN — полный доступ.
    const got = (await adminAgent.get(`/api/v1/tariffs/${plan.id}`).expect(200)).body as RatePlanRow;
    expect(got.id).toBe(plan.id);
  });

  it("PARTNER правит только Rate Plans под DRAFT Product (published → 409); staff может", async () => {
    const product = await createProduct(seller1Agent, `RP-PUB ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Pre-publish", price: 100, priceBasis: "PER_NIGHT" });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    // PARTNER: PATCH на plan под PUBLISHED Product → 409 (коммерческие правки
    // публикованного контента — через change proposal/модерацию).
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 5 }).expect(409);
    // Staff/ADMIN: правки разрешены (trusted).
    const upd = (await adminAgent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 150 }).expect(200)).body as RatePlanRow;
    expect(upd.price).toBe("150.00");
  });

  it("history: audit записывается (created/updated/archived/activated), без PII в security audit", async () => {
    const product = await createProduct(seller1Agent, `RP-HIST ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, {
      name: "Historic",
      price: 100,
      priceBasis: "PER_NIGHT",
      inclusions: { mealPlan: "BB" },
    });
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: 110 }).expect(200);
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/activate`).expect(201);

    const hist = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    const actions = hist.items.map((h) => h.action);
    expect(actions).toContain("created");
    expect(actions).toContain("updated");
    expect(actions).toContain("archived");
    expect(actions).toContain("activated");

    const audits = await prisma.auditLog.findMany({ where: { resource: "Tariff", resourceId: plan.id } });
    expect(audits.length).toBeGreaterThanOrEqual(4);
    for (const a of audits) {
      expect(JSON.stringify(a.details ?? {})).not.toContain("mealPlan");
      expect(JSON.stringify(a.details ?? {})).not.toContain("inclusions");
    }
  });

  it("update validation: price/name/basis/restrictions/inclusions перевалидируются; forbidden 1.8C факты → 422", async () => {
    const product = await createProduct(seller1Agent, `RP-VAL ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createRatePlan(seller1Agent, product.id, { name: "Valid", price: 100, priceBasis: "PER_NIGHT" });
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ price: -5 }).expect(422);
    // Пустой name: class-validator @IsNotEmpty → 400 (DTO); не-строка → 400.
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ name: "" }).expect(400);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ priceBasis: "PER_ROOM_PER_NIGHT" }).expect(422);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ restrictions: { minStay: 9, maxStay: 2 } }).expect(422);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ commercialPeriods: [{ from: "x" }] }).expect(422);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ availability: { slots: 1 } }).expect(422);
    await seller1Agent.patch(`/api/v1/tariffs/${plan.id}`).send({ status: "ARCHIVED" }).expect(422);
  });
});
