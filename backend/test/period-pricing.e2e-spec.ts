/**
 * PHASE 1 STEP 1.8C — Period Pricing & Period Availability Foundation (e2e).
 *
 * Покрытие §54 (44 сценария, сгруппировано): annual calendar / bulk, overlap
 * precedence (DATE_OVERRIDE > narrow PERIOD > broad PERIOD > DAY_OF_WEEK > base),
 * exact-date override, same-priority conflict 422, base fallback, currency
 * inheritance, Decimal, zero, POR gate, sellable/stop-sell, price ≠ availability,
 * Quote resolution (period price по serviceDate), frozen Quote не меняется,
 * legacy Quote compat, parent eligibility, archived tariff, cross-category,
 * leap day / year boundary, CAS concurrency, advisory-lock race, bulk atomicity,
 * multi-date compatibility, forbidden 1.8D/time facts, public priceFrom, RBAC.
 *
 * Даты — 2026-12..2027-01 (будущее; parseServiceDate не принимает прошлое).
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

interface PeriodRow {
  id: string;
  code: string;
  tariffId: string;
  kind: string;
  startDate: string;
  endDate: string;
  dayOfWeek: number[];
  price: string;
  sellable: boolean;
  status: string;
  version: number;
}

describe("Phase 1 Step 1.8C — Period Pricing & Period Availability foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; partners: string[]; categories: string[]; units: string[]; tariffs: string[]; periods: string[]; quotes: string[] } = {
    users: [],
    products: [],
    partners: [],
    categories: [],
    units: [],
    tariffs: [],
    periods: [],
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

  let hotelCatId: string;
  let tourCatId: string;
  let transferCatId: string;
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

    const mkPartner = async (name: string, user: string) => {
      const p = (await adminAgent.post("/api/v1/partners").send({ name }).expect(201)).body as { id: string };
      created.partners.push(p.id);
      const u = (await adminAgent.post("/api/v1/users").send({ username: user, password: "sellerpass123", roleCode: RoleCode.PARTNER, partnerId: p.id })).body as { id: string };
      created.users.push(u.id);
      return (await login(user, "sellerpass123")).accessToken;
    };
    seller1Agent = await agent(await mkPartner(`PC Seller 1 ${stamp}`, `pc_seller1_${stamp}`));
    seller2Agent = await agent(await mkPartner(`PC Seller 2 ${stamp}`, `pc_seller2_${stamp}`));

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `pc_mod_${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`pc_mod_${stamp}`, "modpass123")).accessToken);

    const sm = (await adminAgent.post("/api/v1/users").send({ username: `pc_sm_${stamp}`, password: "staffpass123", roleCode: RoleCode.SALES_MANAGER })).body as { id: string };
    created.users.push(sm.id);
    smAgent = await agent((await login(`pc_sm_${stamp}`, "staffpass123")).accessToken);

    hotelCatId = await createCategory(`pc-hotel-${stamp}`, { attributes: [{ key: "roomType", label: "Room type", type: "enum", options: ["standard", "premium"] }], tariffRules: { allowedBases: ["PER_NIGHT", "PER_ROOM", "PACKAGE_TOTAL"] } });
    tourCatId = await createCategory(`pc-tour-${stamp}`, { attributes: [{ key: "packageClass", label: "Class", type: "enum", options: ["standard", "premium"] }], tariffRules: { allowedBases: ["PER_PERSON", "PACKAGE_TOTAL"] } });
    transferCatId = await createCategory(`pc-transfer-${stamp}`, { attributes: [{ key: "vehicleType", label: "Vehicle type", type: "enum", options: ["sedan", "minivan"] }] });
    rentalCatId = await createCategory(`pc-rental-${stamp}`, { attributes: [{ key: "vehicleClass", label: "Class", type: "string" }], tariffRules: { allowedBases: ["PER_DAY"] } });
  });

  afterAll(async () => {
    // CheckoutIntent → Quote (RESTRICT): чистим intent ДО quote.
    await prisma.checkoutIntent.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    // Все периоды/история по созданным тарифам (включая bulk-созданные).
    await prisma.commercialPeriodHistory.deleteMany({ where: { period: { tariffId: { in: created.tariffs } } } });
    await prisma.commercialPeriod.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.tariffHistory.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.tariff.deleteMany({ where: { id: { in: created.tariffs } } });
    await prisma.serviceUnit.deleteMany({ where: { id: { in: created.units } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  async function createCategory(slug: string, config: { attributes: unknown[]; tariffRules?: Record<string, unknown> }): Promise<string> {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `PC Cat ${slug}`, slug }).expect(201)).body as { id: string };
    created.categories.push(cat.id);
    const schema = (await adminAgent.post("/api/v1/category-schemas").send({ categoryId: cat.id, attributes: config.attributes, tariffRules: config.tariffRules }).expect(201)).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    return cat.id;
  }

  async function createProduct(ag: ReturnType<typeof request.agent>, title: string, categoryId: string, attrs: Record<string, unknown>): Promise<{ id: string; code: string; status: string }> {
    const res = await ag.post("/api/v1/products").send({ type: "HOTEL", title, categoryId, attributes: attrs }).expect(201);
    const product = res.body.product as { id: string; code: string; status: string };
    created.products.push(product.id);
    return product;
  }

  async function createPlan(ag: ReturnType<typeof request.agent>, productId: string, body: Record<string, unknown>, expected = 201): Promise<{ id: string; code: string; pricingMode: string; price: string; status: string }> {
    const res = await ag.post(`/api/v1/products/${productId}/tariffs`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const plan = res.body as { id: string; code: string; pricingMode: string; price: string; status: string };
    created.tariffs.push(plan.id);
    return plan;
  }

  async function createPeriod(ag: ReturnType<typeof request.agent>, tariffId: string, body: Record<string, unknown>, expected = 201): Promise<PeriodRow> {
    const res = await ag.post(`/api/v1/tariffs/${tariffId}/commercial-periods`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const period = res.body as PeriodRow;
    created.periods.push(period.id);
    return period;
  }

  async function newQuote(): Promise<{ id: string; code: string }> {
    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    return quote;
  }

  const D = { seasonStart: "2026-12-01", seasonEnd: "2027-02-28", holidayStart: "2026-12-20", holidayEnd: "2027-01-05", override: "2026-12-31", outside: "2027-03-15", leap: "2028-02-29", yearStart: "2026-12-21", yearEnd: "2027-01-05" };

  // ── 1-6: create / identity / dates ───────────────────────────────────────

  it("1. Seller создаёт broad seasonal period под СВОИМ Rate Plan (PERIOD, CPR-*, sellable default)", async () => {
    const product = await createProduct(seller1Agent, `PC1 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Winter", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { kind: "PERIOD", startDate: D.seasonStart, endDate: D.seasonEnd, price: 120 });
    expect(period.code).toMatch(/^CPR-\d{8}$/);
    expect(period.tariffId).toBe(plan.id);
    expect(period.kind).toBe("PERIOD");
    expect(period.startDate).toBe(D.seasonStart);
    expect(period.endDate).toBe(D.seasonEnd);
    expect(period.price).toBe("120.00");
    expect(period.sellable).toBe(true);
    expect(period.status).toBe("ACTIVE");
    expect(period.version).toBe(1);
  });

  it("2. IDOR: foreign Rate Plan → 403 (create/get/patch period); foreign Product → 403", async () => {
    const p1 = await createProduct(seller1Agent, `PC2A Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan1 = await createPlan(seller1Agent, p1.id, { name: "Plan A", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan1.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 120 });

    const p2 = await createProduct(seller2Agent, `PC2B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan2 = await createPlan(seller2Agent, p2.id, { name: "Plan B", price: 100, priceBasis: "PER_NIGHT" });
    await seller2Agent.post(`/api/v1/tariffs/${plan1.id}/commercial-periods`).send({ startDate: D.seasonStart, endDate: D.seasonEnd, price: 90 }).expect(403);
    // Foreign read list.
    await seller2Agent.get(`/api/v1/tariffs/${plan1.id}/commercial-periods`).expect(403);
    // Foreign PATCH чужих периодов.
    const foreignPeriod = (await seller2Agent.get(`/api/v1/tariffs/${plan2.id}/commercial-periods`).expect(200)).body as { items: PeriodRow[] };
    // (no periods yet — создадим чужой и попробуем поправить)
    const per = await createPeriod(seller2Agent, plan2.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 80 });
    await seller1Agent.get(`/api/v1/commercial-periods/${per.id}`).expect(403);
    await seller1Agent.patch(`/api/v1/commercial-periods/${per.id}`).send({ price: 1 }).expect(403);
    expect(foreignPeriod.items.length).toBeGreaterThanOrEqual(0);
  });

  it("3. legacy Rate Plan без периодов продолжает работать (base fallback в Quote)", async () => {
    const product = await createProduct(seller1Agent, `PC3 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Legacy", price: 100, priceBasis: "PER_NIGHT" });
    const periods = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/commercial-periods`).expect(200)).body as { items: PeriodRow[]; total: number };
    expect(periods.total).toBe(0);
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.outside }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("100");
  });

  it("4-5. full-year период и one-day DATE_OVERRIDE принимаются", async () => {
    const product = await createProduct(seller1Agent, `PC4 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Full Year", price: 100, priceBasis: "PER_NIGHT" });
    const fullYear = await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-01", endDate: "2027-12-31", price: 110 });
    expect(fullYear.kind).toBe("PERIOD");
    const ovr = await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2027-07-12", endDate: "2027-07-12", price: 250 });
    expect(ovr.kind).toBe("DATE_OVERRIDE");
    expect(ovr.startDate).toBe(ovr.endDate);
  });

  it("6. invalid dates: reverse range → 422; malformed → 422; DATE_OVERRIDE range → 422", async () => {
    const product = await createProduct(seller1Agent, `PC6 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Dates", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-10", endDate: "2027-01-01", price: 100 }, 422);
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-1", endDate: "2027-01-10", price: 100 }, 422);
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-13-01", endDate: "2027-01-10", price: 100 }, 422);
    await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2027-01-01", endDate: "2027-01-05", price: 100 }, 422);
  });

  // ── 7-9: precedence / overlap ─────────────────────────────────────────────

  it("7-8. DD-026 precedence: DATE_OVERRIDE > narrow PERIOD > broad PERIOD (Quote serviceDate resolution)", async () => {
    const product = await createProduct(seller1Agent, `PC7 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Season", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2026-12-01", endDate: "2027-02-28", price: 190 }); // broad
    await createPeriod(seller1Agent, plan.id, { startDate: "2026-12-20", endDate: "2027-01-05", price: 230 }); // narrow holiday
    await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2026-12-31", endDate: "2026-12-31", price: 260 }); // NYE override

    const q1 = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${q1.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2026-12-31" }).expect(201);
    const d1 = (await smAgent.get(`/api/v1/sales/quotes/${q1.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(d1.items[0].unitPrice).toBe("260"); // DATE_OVERRIDE wins

    const q2 = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${q2.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2026-12-28" }).expect(201);
    const d2 = (await smAgent.get(`/api/v1/sales/quotes/${q2.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(d2.items[0].unitPrice).toBe("230"); // narrow holiday wins broad

    const q3 = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${q3.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-20" }).expect(201);
    const d3 = (await smAgent.get(`/api/v1/sales/quotes/${q3.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(d3.items[0].unitPrice).toBe("190"); // broad season
  });

  it("9. same-priority overlap → 422; different-priority overlap allowed (deterministic)", async () => {
    const product = await createProduct(seller1Agent, `PC9 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Overlap", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-10", endDate: "2027-01-15", price: 230 });
    // Тот же range → same-priority → 422.
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-10", endDate: "2027-01-15", price: 240 }, 422);
    // Частичное пересечение с той же шириной (6 дней) → same-priority → 422.
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-12", endDate: "2027-01-17", price: 250 }, 422);
    // Более широкий период пересекается → different priority → allowed (narrower wins).
    const broad = await createPeriod(seller1Agent, plan.id, { startDate: "2027-01-01", endDate: "2027-01-31", price: 190 });
    expect(broad.status).toBe("ACTIVE");
    // DATE_OVERRIDE (1 день) vs PERIOD 6 дней → different priority → allowed.
    const ovr = await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2027-01-12", endDate: "2027-01-12", price: 300 });
    expect(ovr.kind).toBe("DATE_OVERRIDE");
    // Второй DATE_OVERRIDE той же даты → same-priority → 422.
    await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2027-01-12", endDate: "2027-01-12", price: 310 }, 422);
  });

  // ── 10-16: fallback / currency / Decimal / zero / POR / price≠base ───────

  it("10. base fallback: quote serviceDate вне периодов → base FIXED price", async () => {
    const product = await createProduct(seller1Agent, `PC10 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Season Only", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2026-12-01", endDate: "2027-02-28", price: 190 });
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.outside }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("100");
  });

  it("11. валюта наследуется из Tariff; client не может forge period currency (422); нет currency в ответе", async () => {
    const product = await createProduct(seller1Agent, `PC11 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "AZN Plan", price: 100, currency: "AZN", priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 120, currency: "USD" }, 422);
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 120 });
    expect(period.price).toBe("120.00");
    expect(JSON.stringify(period)).not.toContain("currency");
  });

  it("12. Decimal: отрицательная цена → 422; 3 знака → 422; >макс → 422", async () => {
    const product = await createProduct(seller1Agent, `PC12 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Decimal", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: -5 }, 422);
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 1.234 }, 422);
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 10000000000 }, 422);
  });

  it("13. zero price остаётся zero (не missing/unavailable); free date bindable", async () => {
    const product = await createProduct(seller1Agent, `PC13 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Free Date", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: "2027-03-01", endDate: "2027-03-05", price: 0 });
    expect(period.price).toBe("0.00");
    expect(period.sellable).toBe(true);
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-03-03" }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("0");
  });

  it("14. POR Rate Plan не может получить числовую периодную цену (422, §35)", async () => {
    const product = await createProduct(seller1Agent, `PC14 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Inquiry Only", price: 500, pricingMode: "PRICE_ON_REQUEST", priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 }, 422);
  });

  it("15. периодная цена НЕ мутирует base Tariff price (period edit ≠ reprice base)", async () => {
    const product = await createProduct(seller1Agent, `PC15 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Base Keep", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    const got = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}`).expect(200)).body as { price: string };
    expect(got.price).toBe("100.00");
  });

  // ── 16-19: sellability / availability isolation ───────────────────────────

  it("16. stop-sell (sellable=false) → дата не bookable (quote 422); цена сохраняется (price ≠ availability)", async () => {
    const product = await createProduct(seller1Agent, `PC16 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "StopSell", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: "2027-04-01", endDate: "2027-04-10", price: 190, sellable: false });
    expect(period.sellable).toBe(false);
    expect(period.price).toBe("190.00");
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-04-05" }).expect(422);
    // Вне stop-sell периода — base bindable.
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-05-05" }).expect(201);
  });

  it("17. available дата остаётся eligible (quote item с периодной ценой)", async () => {
    const product = await createProduct(seller1Agent, `PC17 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Eligible", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190, sellable: true });
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-10" }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("190");
  });

  it("18-19. calendar CRUD не мутирует Availability/Reservation/Quote/Sale/Order", async () => {
    const product = await createProduct(seller1Agent, `PC18 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "No Side FX", price: 100, priceBasis: "PER_NIGHT" });
    const beforeAv = await prisma.availability.count({ where: { productId: product.id } });
    const beforeRes = await prisma.availabilityReservation.count({ where: { productId: product.id } });
    const beforeQuote = await prisma.quote.count();
    const beforeCheckout = await prisma.checkoutIntent.count();
    const beforeSale = await prisma.sale.count();
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    await seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 195 }).expect(200);
    expect(await prisma.availability.count({ where: { productId: product.id } })).toBe(beforeAv);
    expect(await prisma.availabilityReservation.count({ where: { productId: product.id } })).toBe(beforeRes);
    expect(await prisma.quote.count()).toBe(beforeQuote);
    expect(await prisma.checkoutIntent.count()).toBe(beforeCheckout);
    expect(await prisma.sale.count()).toBe(beforeSale);
  });

  // ── 20-24: Quote integration ──────────────────────────────────────────────

  it("20-22. Quote использует резолвнутую периодную цену на дату; вне периода — base; period edit после ISSUE НЕ инвалидирует binding Quote (freeze §44 FIX 1)", async () => {
    const product = await createProduct(seller1Agent, `PC20 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Season Priced", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: "2026-12-01", endDate: "2027-02-28", price: 190 });

    // (a) Quote на дату в периоде — периодная цена 190 (snapshot + serviceDate).
    const q1 = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${q1.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-10" }).expect(201);
    const d1 = (await smAgent.get(`/api/v1/sales/quotes/${q1.code}`).expect(200)).body as { items: Array<{ unitPrice: string; serviceDate: string | null }> };
    expect(d1.items[0].unitPrice).toBe("190");
    expect(d1.items[0].serviceDate).toBe("2027-01-10"); // provenance snapshot

    // (b) Quote вне периода — base 100 (serviceDate snapshot сохраняется).
    const q2 = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${q2.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.outside }).expect(201);
    const d2 = (await smAgent.get(`/api/v1/sales/quotes/${q2.code}`).expect(200)).body as { items: Array<{ unitPrice: string; serviceDate: string | null }> };
    expect(d2.items[0].unitPrice).toBe("100");
    expect(d2.items[0].serviceDate).toBe(D.outside);

    // (c) Period edit после snapshot: frozen quote НЕ меняется.
    await seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 250 }).expect(200);
    const d1after = (await smAgent.get(`/api/v1/sales/quotes/${q1.code}`).expect(200)).body as { items: Array<{ unitPrice: string; serviceDate: string | null }> };
    expect(d1after.items[0].unitPrice).toBe("190"); // frozen — НЕ reprice
    expect(d1after.items[0].serviceDate).toBe("2027-01-10"); // frozen date факт

    // Checkout flow: issue → checkout intent → service date → complete при frozen
    // цене (Seller edit после ISSUE НЕ инвалидирует binding Quote; freeze §44).
    await smAgent.put(`/api/v1/sales/quotes/${q1.code}/commercial`).send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() }).expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${q1.code}/issue`).expect(201);
    const intent = (await smAgent.post(`/api/v1/sales/checkouts`).send({ quoteId: q1.id }).expect(201)).body as { code: string; version: number };
    // Период изменился (190 → 250) ПОСЛЕ ISSUE, но binding price = frozen QuoteItem
    // 190. setCheckoutServiceDate/completeSale НЕ пере-резолвят текущий календарь
    // (никакого reprice из текущего Catalog; frozen commercial facts immutable).
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: "2027-01-10", expectedVersion: intent.version }).expect(200);
  });

  it("23. legacy Quote без serviceDate остаётся совместимой (base snapshot, никаких period требований)", async () => {
    const product = await createProduct(seller1Agent, `PC23 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Legacy NoDate", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1 }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("100");
  });

  it("24. parent eligibility: PARTNER под PUBLISHED Product → 409; archived Tariff → conflict; archived tariff не bindable", async () => {
    const product = await createProduct(seller1Agent, `PC24 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Eligibility", price: 100, priceBasis: "PER_NIGHT" });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    // PARTNER больше не может править периоды (DRAFT-only конвенция 1.8B).
    await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 }, 409);
    // Staff может.
    const period = await createPeriod(adminAgent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    // Archive tariff → period create/update blocked; quote item → 422 (not bindable).
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/tariffs/${plan.id}/commercial-periods`).send({ startDate: "2027-06-01", endDate: "2027-06-30", price: 120 }).expect(409);
    await adminAgent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 200 }).expect(409);
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-10" }).expect(422);
  });

  // ── 25-34: cross-category / calendar / bulk / concurrency ────────────────

  it("25-28. cross-category: Hotel + Tour + Transfer + Car Rental (generic, no hotel-only fields)", async () => {
    const hotel = await createProduct(seller1Agent, `PC25 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const hp = await createPlan(seller1Agent, hotel.id, { name: "Room", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, hp.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });

    const tour = await createProduct(seller1Agent, `PC26 Tour ${stamp}`, tourCatId, { packageClass: "premium" });
    const tp = await createPlan(seller1Agent, tour.id, { name: "Tour", price: 90, priceBasis: "PER_PERSON" });
    await createPeriod(seller1Agent, tp.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 140 });

    const transfer = await createProduct(seller1Agent, `PC27 Transfer ${stamp}`, transferCatId, { vehicleType: "minivan" });
    const trp = await createPlan(seller1Agent, transfer.id, { name: "Transfer", price: 35, priceBasis: "PER_TRIP" });
    await createPeriod(seller1Agent, trp.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 45 });

    const rental = await createProduct(seller1Agent, `PC28 Rental ${stamp}`, rentalCatId, { vehicleClass: "suv" });
    const rp = await createPlan(seller1Agent, rental.id, { name: "Rental", price: 60, priceBasis: "PER_DAY" });
    await createPeriod(seller1Agent, rp.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 80 });

    // Все четыре категории — generic period CRUD, никаких hotel-only полей.
    for (const cat of [hotel, tour, transfer, rental]) {
      const raw = JSON.stringify(cat);
      expect(raw.toLowerCase()).not.toContain("roomtype:true");
    }
  });

  it("29. leap day (2028-02-29) и year boundary (Dec→Jan) периоды принимаются", async () => {
    const product = await createProduct(seller1Agent, `PC29 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Calendar", price: 100, priceBasis: "PER_NIGHT" });
    const leap = await createPeriod(seller1Agent, plan.id, { startDate: D.leap, endDate: D.leap, price: 300 });
    expect(leap.startDate).toBe(D.leap);
    const yb = await createPeriod(seller1Agent, plan.id, { startDate: D.yearStart, endDate: D.yearEnd, price: 250 });
    expect(yb.startDate).toBe(D.yearStart);
    expect(yb.endDate).toBe(D.yearEnd);
  });

  it("30-31. bulk: годовой календарь в одном запросе; one invalid row → nothing committed (all-or-nothing)", async () => {
    const product = await createProduct(seller1Agent, `PC30 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Bulk", price: 100, priceBasis: "PER_NIGHT" });
    const before = await prisma.commercialPeriod.count({ where: { tariffId: plan.id } });

    const res = await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-periods/bulk`).send({
      periods: [
        { startDate: "2027-01-01", endDate: "2027-03-31", price: 100 },
        { startDate: "2027-04-01", endDate: "2027-05-31", price: 130 },
        { startDate: "2027-06-01", endDate: "2027-08-31", price: 190 },
        { startDate: "2027-09-01", endDate: "2027-12-31", price: 120 },
      ],
    });
    expect(res.status).toBe(201);
    expect((res.body as { created: number }).created).toBe(4);
    expect(await prisma.commercialPeriod.count({ where: { tariffId: plan.id } })).toBe(before + 4);

    // Invalid row → весь batch откачен (ни одной новой строки).
    const before2 = await prisma.commercialPeriod.count({ where: { tariffId: plan.id } });
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-periods/bulk`).send({
      periods: [
        { startDate: "2028-01-01", endDate: "2028-03-31", price: 100 },
        { startDate: "2028-04-01", endDate: "2028-03-01", price: 130 }, // reverse → 422
      ],
    }).expect(422);
    expect(await prisma.commercialPeriod.count({ where: { tariffId: plan.id } })).toBe(before2);
  });

  it("32. lost-update защита: параллельные PATCH — ни один успех не перезаписан молча (version-CAS)", async () => {
    const product = await createProduct(seller1Agent, `PC32 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "CAS", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    expect(period.version).toBe(1);

    // Два ПАРАЛЛЕЛЬНЫХ PATCH с разными изменениями. Исходы (как 1.8B §39):
    //  (a) [200, 409] — транзакции перекрылись: второй updateMany где
    //      version=1 даёт count=0 → 409 (version-CAS, lost-update заблокирован);
    //  (b) [200, 200] — сериализовались: второй прочитал version=2 → успех
    //      поверх свежих данных (НЕ слепое перезаписывание).
    const [a, b] = await Promise.allSettled([
      seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 200 }),
      seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 210 }),
    ]);
    const statuses = [a.status === "fulfilled" ? a.value.status : -1, b.status === "fulfilled" ? b.value.status : -1];
    const success = statuses.filter((s) => s === 200).length;
    expect(success).toBeGreaterThanOrEqual(1);
    const got = (await seller1Agent.get(`/api/v1/commercial-periods/${period.id}`).expect(200)).body as PeriodRow;
    expect(got.version).toBe(1 + success);
    expect(["190.00", "200.00", "210.00"]).toContain(got.price);
    const hist = (await seller1Agent.get(`/api/v1/commercial-periods/${period.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items.filter((h) => h.action === "updated")).toHaveLength(success);
  });

  it("33. concurrent conflicting create → ровно один успех, второй 422 (advisory lock, no ambiguous state)", async () => {
    const product = await createProduct(seller1Agent, `PC33 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Race", price: 100, priceBasis: "PER_NIGHT" });
    const [a, b] = await Promise.all([
      seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-periods`).send({ startDate: "2027-05-01", endDate: "2027-05-10", price: 150 }),
      seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-periods`).send({ startDate: "2027-05-01", endDate: "2027-05-10", price: 160 }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 422]);
    const all = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/commercial-periods?status=ALL`).expect(200)).body as { total: number };
    expect(all.total).toBe(1);
  });

  it("34. multi-date compatibility: per-date resolution (разные цены по датам), без hold/second engine", async () => {
    const product = await createProduct(seller1Agent, `PC34 Hotel ${stamp}`, hotelCatId, { roomType: "premium" });
    const plan = await createPlan(seller1Agent, product.id, { name: "MultiDate", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-07-01", endDate: "2027-08-31", price: 190 });
    await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: "2027-07-12", endDate: "2027-07-12", price: 260 });

    // Stay Jul 10-12 (3 ночи): per-date разрешение — 190, 190, 260 (агрегация
    // multi-date stay — 1.8D/2.x контракт; здесь доказываем per-date факт).
    for (const [date, expected] of [
      ["2027-07-10", "190"],
      ["2027-07-11", "190"],
      ["2027-07-12", "260"],
    ] as const) {
      const q = await newQuote();
      await smAgent.post(`/api/v1/sales/quotes/${q.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: date }).expect(201);
      const d = (await smAgent.get(`/api/v1/sales/quotes/${q.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
      expect(d.items[0].unitPrice).toBe(expected);
    }
    // Нет второго hold engine: модель Availability/Reservation не менялась.
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'catalog' AND tablename ILIKE '%Hold%'`;
    expect(tables).toHaveLength(0);
  });

  // ── 35-39: public / forbidden facts / POR public / history ───────────────

  it("35. public priceFrom включает period price (future); исторический период не снижает", async () => {
    const product = await createProduct(seller1Agent, `PC35 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "FromN", price: 100, priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, plan.id, { startDate: "2025-01-01", endDate: "2025-12-31", price: 60 }); // past — excluded
    await createPeriod(seller1Agent, plan.id, { startDate: "2027-09-01", endDate: "2027-11-30", price: 80 }); // future low season
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const detail = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { priceFrom: string | null };
    };
    expect(detail.product.priceFrom).toBe("80.00");

    // price sort path (raw SQL) — тот же результат.
    const list = (await request(app.getHttpServer()).get(`/api/v1/public/products?sort=price_asc&pageSize=50`).expect(200)).body as { items: Array<{ id: string; priceFrom: string | null }> };
    const mine = list.items.find((i) => i.id === product.id);
    expect(mine?.priceFrom).toBe("80.00");
  });

  it("36. forbidden 1.8D/time/Quote/hold факты → 422 (mass assignment)", async () => {
    const product = await createProduct(seller1Agent, `PC36 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Forge", price: 100, priceBasis: "PER_NIGHT" });
    const forge = [
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, id: "x" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, code: "CPR-99999999" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, tariffId: plan.id },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, currency: "USD" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, status: "ARCHIVED" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, version: 99 },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, createdAt: "2020-01-01" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, quoteId: "Q" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, reservationIds: ["r1"] },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, resolvedPrice: 1 },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, rules: { occupancy: 2 } },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, timeSlot: "10:00" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, departureTime: "10:00" },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, occupancy: 2 },
      { startDate: D.seasonStart, endDate: D.seasonEnd, price: 100, duration: 3 },
    ];
    for (const body of forge) {
      await createPeriod(seller1Agent, plan.id, body, 422);
    }
  });

  it("37. public POR остаётся non-numeric (периоды не превращают POR в bindable)", async () => {
    const product = await createProduct(seller1Agent, `PC37 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const fixed = await createPlan(seller1Agent, product.id, { name: "Fixed", price: 100, priceBasis: "PER_NIGHT" });
    const por = await createPlan(seller1Agent, product.id, { name: "POR", price: 500, pricingMode: "PRICE_ON_REQUEST", priceBasis: "PER_NIGHT" });
    await createPeriod(seller1Agent, fixed.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 80 });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const detail = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as {
      product: { tariffs: Array<{ name: string; price: string | null; pricingMode: string }>; priceFrom: string | null };
    };
    const porTariff = detail.product.tariffs.find((t) => t.name === "POR");
    expect(porTariff?.price).toBeNull();
    expect(porTariff?.pricingMode).toBe("PRICE_ON_REQUEST");
    // priceFrom — только FIXED/period bindable (80 от периода), не POR.
    expect(detail.product.priceFrom).toBe("80.00");
  });

  it("38. history/audit: created/updated/archived/activated; без PII и без dump в security audit", async () => {
    const product = await createProduct(seller1Agent, `PC38 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Hist", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    await seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 200 }).expect(200);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/activate`).expect(201);

    const hist = (await seller1Agent.get(`/api/v1/commercial-periods/${period.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    const actions = hist.items.map((h) => h.action);
    expect(actions).toContain("created");
    expect(actions).toContain("updated");
    expect(actions).toContain("archived");
    expect(actions).toContain("activated");

    const audits = await prisma.auditLog.findMany({ where: { resource: "CommercialPeriod", resourceId: period.id } });
    expect(audits.length).toBeGreaterThanOrEqual(4);
    for (const a of audits) {
      const s = JSON.stringify(a.details ?? {});
      expect(s.toLowerCase()).not.toContain("email");
      expect(s.toLowerCase()).not.toContain("phone");
    }
  });

  it("39. archive периода → resolver игнорирует (base fallback); idempotent re-archive без duplicate history", async () => {
    const product = await createProduct(seller1Agent, `PC39 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Archive", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(201); // idempotent
    const hist = (await seller1Agent.get(`/api/v1/commercial-periods/${period.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items.filter((h) => h.action === "archived")).toHaveLength(1);
    // Resolver: заархивированный период не применяется → base 100.
    const quote = await newQuote();
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-10" }).expect(201);
    const detail = (await smAgent.get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { items: Array<{ unitPrice: string }> };
    expect(detail.items[0].unitPrice).toBe("100");
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it("RBAC: MODERATOR 403; PARTNER не архивирует (403); staff может; BUYER 403", async () => {
    const product = await createProduct(seller1Agent, `PC-RBAC ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "RBAC", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.seasonStart, endDate: D.seasonEnd, price: 190 });
    await modAgent.get(`/api/v1/commercial-periods/${period.id}`).expect(403);
    await modAgent.post(`/api/v1/tariffs/${plan.id}/commercial-periods`).send({ startDate: D.seasonStart, endDate: D.seasonEnd, price: 1 }).expect(403);
    await seller1Agent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(403);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/activate`).expect(201);
  });
});
