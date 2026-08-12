/**
 * PHASE 1 STEP 1.8D — Commercial Restrictions / Overrides Foundation (e2e).
 *
 * Покрытие §21 (60 обязательств, сгруппировано): lifecycle (CRS-*), own-scope/
 * RBAC/IDOR, stop-sell (price ≠ availability), min-stay/max-stay, advance-
 * booking (UTC date-only), CTA/CTD, precedence DATE > PERIOD > BASE,
 * equal-specificity conflict 422, archived ignored, pricing composition,
 * Quote freeze (post-ISSUE Seller-edit не инвалидирует), restrictionSnapshot
 * provenance, availability separation (0 holds), concurrency (CAS + advisory
 * lock), forbidden/time-slot keys, category gate (DD-028), public priceFrom
 * eligible-set policy (fully-stop-sold / advance-window excluded).
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

interface RestrictionRow {
  id: string;
  code: string;
  tariffId: string;
  scope: string;
  commercialPeriodId: string | null;
  startDate: string | null;
  endDate: string | null;
  type: string;
  value: number | null;
  status: string;
  version: number;
}

interface QuoteItemRow {
  unitPrice: string;
  serviceDate: string | null;
  restrictionSnapshot: Array<{ type: string; value: number | null; source: string; code: string | null }> | null;
}

describe("Phase 1 Step 1.8D — Commercial Restrictions & Overrides foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; partners: string[]; categories: string[]; tariffs: string[]; periods: string[]; restrictions: string[]; quotes: string[] } = {
    users: [],
    products: [],
    partners: [],
    categories: [],
    tariffs: [],
    periods: [],
    restrictions: [],
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
  let buyerAgent: ReturnType<typeof request.agent>;
  let smAgent: ReturnType<typeof request.agent>;

  let hotelCatId: string;
  let tourCatId: string;
  let transferCatId: string;

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
    seller1Agent = await agent(await mkPartner(`CR Seller 1 ${stamp}`, `cr_seller1_${stamp}`));
    seller2Agent = await agent(await mkPartner(`CR Seller 2 ${stamp}`, `cr_seller2_${stamp}`));

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `cr_mod_${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body as { id: string };
    created.users.push(mod.id);
    modAgent = await agent((await login(`cr_mod_${stamp}`, "modpass123")).accessToken);

    const buyer = (await adminAgent.post("/api/v1/users").send({ username: `cr_buyer_${stamp}`, password: "buyerpass123", roleCode: RoleCode.BUYER })).body as { id: string };
    created.users.push(buyer.id);
    buyerAgent = await agent((await login(`cr_buyer_${stamp}`, "buyerpass123")).accessToken);

    const sm = (await adminAgent.post("/api/v1/users").send({ username: `cr_sm_${stamp}`, password: "staffpass123", roleCode: RoleCode.SALES_MANAGER })).body as { id: string };
    created.users.push(sm.id);
    smAgent = await agent((await login(`cr_sm_${stamp}`, "staffpass123")).accessToken);

    hotelCatId = await createCategory(`cr-hotel-${stamp}`, {
      attributes: [{ key: "roomType", label: "Room type", type: "enum", options: ["standard", "premium"] }],
      tariffRules: {
        allowedBases: ["PER_NIGHT"],
        allowedRestrictions: ["STOP_SELL", "MIN_STAY", "ADVANCE_BOOKING", "CLOSED_TO_ARRIVAL", "CLOSED_TO_DEPARTURE"],
      },
    });
    // DD-028 gate: tour — ТОЛЬКО stop-sell/advance; MIN_STAY/CTA/CTD unsupported → 422.
    tourCatId = await createCategory(`cr-tour-${stamp}`, {
      attributes: [{ key: "packageClass", label: "Class", type: "enum", options: ["standard", "premium"] }],
      tariffRules: { allowedBases: ["PER_PERSON"], allowedRestrictions: ["STOP_SELL", "ADVANCE_BOOKING"] },
    });
    // DD-028 §63: transfer — только STOP_SELL/ADVANCE_BOOKING (никаких forced
    // min-stay/CTA/CTD без явного разрешения категории).
    transferCatId = await createCategory(`cr-transfer-${stamp}`, {
      attributes: [{ key: "vehicleType", label: "Vehicle type", type: "enum", options: ["sedan", "minivan"] }],
      tariffRules: { allowedBases: ["PER_TRIP"], allowedRestrictions: ["STOP_SELL", "ADVANCE_BOOKING"] },
    });
  });

  afterAll(async () => {
    await prisma.checkoutIntent.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.commercialRestrictionHistory.deleteMany({ where: { restriction: { tariffId: { in: created.tariffs } } } });
    await prisma.commercialRestriction.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.commercialPeriodHistory.deleteMany({ where: { period: { tariffId: { in: created.tariffs } } } });
    await prisma.commercialPeriod.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.tariffHistory.deleteMany({ where: { tariffId: { in: created.tariffs } } });
    await prisma.tariff.deleteMany({ where: { id: { in: created.tariffs } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
  });

  async function createCategory(slug: string, config: { attributes: unknown[]; tariffRules?: Record<string, unknown> }): Promise<string> {
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `CR Cat ${slug}`, slug }).expect(201)).body as { id: string };
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

  async function createPlan(ag: ReturnType<typeof request.agent>, productId: string, body: Record<string, unknown>, expected = 201): Promise<{ id: string; code: string; price: string }> {
    const res = await ag.post(`/api/v1/products/${productId}/tariffs`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const plan = res.body as { id: string; code: string; price: string };
    created.tariffs.push(plan.id);
    return plan;
  }

  async function createPeriod(ag: ReturnType<typeof request.agent>, tariffId: string, body: Record<string, unknown>, expected = 201): Promise<{ id: string; code: string }> {
    const res = await ag.post(`/api/v1/tariffs/${tariffId}/commercial-periods`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const period = res.body as { id: string; code: string };
    created.periods.push(period.id);
    return period;
  }

  async function createRestriction(ag: ReturnType<typeof request.agent>, tariffId: string, body: Record<string, unknown>, expected = 201): Promise<RestrictionRow> {
    const res = await ag.post(`/api/v1/tariffs/${tariffId}/commercial-restrictions`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return res.body as never;
    const r = res.body as RestrictionRow;
    created.restrictions.push(r.id);
    return r;
  }

  async function newQuote(): Promise<{ id: string; code: string }> {
    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    return quote;
  }

  async function addItem(quoteCode: string, body: Record<string, unknown>, expected = 201): Promise<QuoteItemRow | null> {
    const res = await smAgent.post(`/api/v1/sales/quotes/${quoteCode}/items`).send(body);
    expect(res.status).toBe(expected);
    if (expected !== 201) return null;
    const detail = res.body as { items: QuoteItemRow[] };
    return detail.items[detail.items.length - 1];
  }

  const D = { start: "2026-12-01", end: "2027-02-28", date1: "2027-01-10", date2: "2027-01-15", date3: "2027-01-20" };
  const dPlus = (n: number) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n)).toISOString().slice(0, 10);
  };

  // ── 1-7: lifecycle ────────────────────────────────────────────────────────

  it("1. create DATE-scope STOP_SELL (CRS-*, ACTIVE, version 1); stop-sell не трогает price", async () => {
    const product = await createProduct(seller1Agent, `CR1 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Lifecycle", price: 100, priceBasis: "PER_NIGHT" });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    expect(r.code).toMatch(/^CRS-\d{8}$/);
    expect(r.tariffId).toBe(plan.id);
    expect(r.type).toBe("STOP_SELL");
    expect(r.status).toBe("ACTIVE");
    expect(r.version).toBe(1);
    // price сохранён (stop-sell ≠ удаление цены).
    const tariff = (await seller1Agent.get(`/api/v1/products/${product.id}/tariffs`).expect(200)).body as { items: Array<{ id: string; price: string }> };
    expect(tariff.items.find((t) => t.id === plan.id)?.price).toBe("100.00");
  });

  it("2. list own / get / history / update (version-CAS) / archive / activate", async () => {
    const product = await createProduct(seller1Agent, `CR2 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Lifecycle2", price: 100, priceBasis: "PER_NIGHT" });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "MIN_STAY", value: 2, startDate: D.date1, endDate: D.date1 });
    const list = (await seller1Agent.get(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).expect(200)).body as { items: RestrictionRow[]; total: number };
    expect(list.total).toBe(1);
    const got = (await seller1Agent.get(`/api/v1/commercial-restrictions/${r.id}`).expect(200)).body as RestrictionRow;
    expect(got.code).toBe(r.code);
    const hist = (await seller1Agent.get(`/api/v1/commercial-restrictions/${r.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items[0].action).toBe("created");

    const upd = (await seller1Agent.patch(`/api/v1/commercial-restrictions/${r.id}`).send({ value: 3 }).expect(200)).body as RestrictionRow;
    expect(upd.value).toBe(3);
    expect(upd.version).toBe(2);
    // Параллельные PATCH: (a) один 409 при перекрытии, либо (b) оба 200 при
    // сериализации поверх свежих данных — никогда слепой lost-update (см. тест 16).
    const [c1, c2] = await Promise.allSettled([
      seller1Agent.patch(`/api/v1/commercial-restrictions/${r.id}`).send({ value: 4 }),
      seller1Agent.patch(`/api/v1/commercial-restrictions/${r.id}`).send({ value: 5 }),
    ]);
    const st = [c1.status === "fulfilled" ? c1.value.status : -1, c2.status === "fulfilled" ? c2.value.status : -1];
    expect(st.every((s) => s === 200 || s === 409)).toBe(true);
    const fin = (await seller1Agent.get(`/api/v1/commercial-restrictions/${r.id}`).expect(200)).body as RestrictionRow;
    expect([4, 5]).toContain(fin.value);
    expect(fin.version).toBeGreaterThanOrEqual(3);

    const archived = (await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201)).body as RestrictionRow;
    expect(archived.status).toBe("ARCHIVED");
    await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201); // idempotent
    const reactivated = (await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/activate`).expect(201)).body as RestrictionRow;
    expect(reactivated.status).toBe("ACTIVE");
    const hist2 = (await seller1Agent.get(`/api/v1/commercial-restrictions/${r.id}/history`).expect(200)).body as { items: Array<{ action: string }> };
    const actions = hist2.items.map((h) => h.action).sort();
    expect(actions).toContain("created");
    expect(actions).toContain("updated");
    expect(actions).toContain("archived");
    expect(actions).toContain("activated");
  });

  it("3. equal-specificity duplicate rejected 422 (DATE same date; PERIOD same period)", async () => {
    const product = await createProduct(seller1Agent, `CR3 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "NoDup", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.start, endDate: D.end, price: 120 });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 }, 422);
    await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "MIN_STAY", value: 2, commercialPeriodId: period.id });
    await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "MIN_STAY", value: 3, commercialPeriodId: period.id }, 422);
    const count = await prisma.commercialRestriction.count({ where: { tariffId: plan.id } });
    expect(count).toBe(2); // только 1 DATE stop-sell + 1 PERIOD min-stay
  });

  // ── 8-14: ownership / RBAC / IDOR ────────────────────────────────────────

  it("4. IDOR: foreign create/list/patch → 403; BUYER → 403; MODERATOR → 403; ADMIN → 201", async () => {
    const p1 = await createProduct(seller1Agent, `CR4A Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan1 = await createPlan(seller1Agent, p1.id, { name: "Plan A", price: 100, priceBasis: "PER_NIGHT" });
    const r1 = await createRestriction(seller1Agent, plan1.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });

    await seller2Agent.post(`/api/v1/tariffs/${plan1.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date2, endDate: D.date2 }).expect(403);
    await seller2Agent.get(`/api/v1/tariffs/${plan1.id}/commercial-restrictions`).expect(403);
    await seller2Agent.patch(`/api/v1/commercial-restrictions/${r1.id}`).send({ value: 5 }).expect(403);
    await seller2Agent.get(`/api/v1/commercial-restrictions/${r1.id}/history`).expect(403); // history IDOR
    await buyerAgent.post(`/api/v1/tariffs/${plan1.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date2, endDate: D.date2 }).expect(403);
    await modAgent.post(`/api/v1/tariffs/${plan1.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date2, endDate: D.date2 }).expect(403);
    // staff/ADMIN: create по текущей permission-модели (catalog.product.write).
    await adminAgent.post(`/api/v1/tariffs/${plan1.id}/commercial-restrictions`).send({ scope: "DATE", type: "ADVANCE_BOOKING", value: 3, startDate: D.date2, endDate: D.date2 }).expect(201);
    // MODERATOR не получает rate_plan.publish (archive) — 403.
    await modAgent.post(`/api/v1/commercial-restrictions/${r1.id}/archive`).expect(403);
  });

  it("5. forged ownership/system/quote/time fields → 422 (mass assignment)", async () => {
    const product = await createProduct(seller1Agent, `CR5 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Forge", price: 100, priceBasis: "PER_NIGHT" });
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1, tariffId: "forge", partnerId: "forge", status: "ARCHIVED", version: 99 }).expect(422);
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1, holdIds: ["x"] }).expect(422);
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1, timeSlot: "10:00" }).expect(422);
    await seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1, timezone: "Asia/Baku" }).expect(422);
    const count = await prisma.commercialRestriction.count({ where: { tariffId: plan.id } });
    expect(count).toBe(0);
  });

  // ── 15-18: stop-sell semantics ───────────────────────────────────────────

  it("6. price + capacity + stop-sell → Quote 422; архив stop-sell → снова bindable (remove restores)", async () => {
    const product = await createProduct(seller1Agent, `CR6 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "StopSell", price: 100, priceBasis: "PER_NIGHT" });
    const quote = await newQuote();
    await addItem(quote.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 });
    // ── stop-sell: 422 даже при существующей цене ──
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 }, 422);
    // ── удаление/архив stop-sell восстанавливает eligibility ──
    await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201);
    const q3 = await newQuote();
    await addItem(q3.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 });
  });

  // ── 19-22: min stay ──────────────────────────────────────────────────────

  it("7. base minStay: below → 422; exact → 201; без durationDays (minStay>1) → 422 fail-closed", async () => {
    const product = await createProduct(seller1Agent, `CR7 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "MinStay", price: 100, priceBasis: "PER_NIGHT", restrictions: { minStay: 2 } });
    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 1 }, 422);
    const q2 = await newQuote();
    const item = await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 2 });
    expect(item?.restrictionSnapshot).toContainEqual({ type: "MIN_STAY", value: 2, source: "BASE", code: null });
    const q3 = await newQuote();
    await addItem(q3.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 }, 422);
  });

  it("8. scoped override precedence: DATE MIN_STAY > PERIOD MIN_STAY > base; narrower wins", async () => {
    const product = await createProduct(seller1Agent, `CR8 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Prec", price: 100, priceBasis: "PER_NIGHT", restrictions: { minStay: 1 } });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.start, endDate: D.end, price: 120 });
    await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "MIN_STAY", value: 3, commercialPeriodId: period.id });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "MIN_STAY", value: 5, startDate: D.date1, endDate: D.date1 });

    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 4 }, 422); // DATE 5 wins
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 5 }); // exact DATE min
    const q3 = await newQuote();
    await addItem(q3.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date2, durationDays: 2 }, 422); // PERIOD 3 wins (no DATE row)
    const q4 = await newQuote();
    await addItem(q4.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date2, durationDays: 3 }); // exact PERIOD min
  });

  // ── 23-26: advance booking ───────────────────────────────────────────────

  it("9. advance-booking: слишком близкая дата → 422; boundary → allowed; DATE-scope override per date", async () => {
    const product = await createProduct(seller1Agent, `CR9 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Advance", price: 100, priceBasis: "PER_NIGHT", restrictions: { advanceBookingDays: 10 } });
    const near = dPlus(5);
    const boundary = dPlus(10);
    const far = dPlus(20);
    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: near }, 422);
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: boundary }); // inclusive boundary
    const q3 = await newQuote();
    await addItem(q3.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: far });

    // DATE-scope ADVANCE_BOOKING=30 override на одну дату (base 10 → 30).
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "ADVANCE_BOOKING", value: 30, startDate: far, endDate: far });
    const q4 = await newQuote();
    await addItem(q4.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: far }, 422); // 20 < 30
    const q5 = await newQuote();
    await addItem(q5.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: boundary }); // unaffected
  });

  // ── 27-30: CTA / CTD ─────────────────────────────────────────────────────

  it("10. CTA: start-дата blocked → 422; interior CTA диапазона НЕ блокирует; PERIOD-attached CTA", async () => {
    const product = await createProduct(seller1Agent, `CR10 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "CTA", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.start, endDate: D.end, price: 120 });
    await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "CLOSED_TO_ARRIVAL", commercialPeriodId: period.id });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "CLOSED_TO_ARRIVAL", startDate: D.date2, endDate: D.date2 });

    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 }, 422); // периодный CTA
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date2 }, 422); // DATE CTA
    // Interior CTA (не start): start=D.date1 (без DATE CTA на нём) + duration 7 → CTA на D.date2 — interior → НЕ блокирует.
    const q3 = await newQuote();
    await addItem(q3.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 7 }, 422); // периодный CTA всё равно блокирует
  });

  it("11. CTD: departure-дата blocked → 422; CTD требует durationDays (fail-closed); CTD unsupported category → 422", async () => {
    const product = await createProduct(seller1Agent, `CR11 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "CTD", price: 100, priceBasis: "PER_NIGHT" });
    // departure = start + duration - 1: start 2027-01-14 + 2 days = 2027-01-15 = D.date2 → blocked.
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "CLOSED_TO_DEPARTURE", startDate: D.date2, endDate: D.date2 });
    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: "2027-01-14", durationDays: 2 }, 422);
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 1 }); // departure D.date1 → ok
    // CTD без durationDays → fail-closed 422 (base closedToDeparture).
    const p2 = await createProduct(seller1Agent, `CR11B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan2 = await createPlan(seller1Agent, p2.id, { name: "CTDbase", price: 100, priceBasis: "PER_NIGHT", restrictions: { closedToDeparture: true } });
    const q3 = await newQuote();
    await addItem(q3.code, { productId: p2.id, tariffId: plan2.id, quantity: 1, serviceDate: D.date1 }, 422);
    // Transfer категория с узким allowlist (только STOP_SELL/ADVANCE_BOOKING):
    // MIN_STAY/CTA/CTD → 422 на entity и на base-метаданные (DD-028 §63).
    const transfer = await createProduct(seller1Agent, `CR11D Transfer ${stamp}`, transferCatId, { vehicleType: "sedan" });
    const tplan2 = await createPlan(seller1Agent, transfer.id, { name: "TransferPlan", price: 35, priceBasis: "PER_TRIP" });
    await createRestriction(seller1Agent, tplan2.id, { scope: "DATE", type: "MIN_STAY", value: 2, startDate: D.date1, endDate: D.date1 }, 422);
    await createRestriction(seller1Agent, tplan2.id, { scope: "DATE", type: "CLOSED_TO_ARRIVAL", startDate: D.date1, endDate: D.date1 }, 422);
    await createRestriction(seller1Agent, tplan2.id, { scope: "DATE", type: "ADVANCE_BOOKING", value: 2, startDate: D.date1, endDate: D.date1 }); // разрешён
    await seller1Agent.post(`/api/v1/products/${transfer.id}/tariffs`).send({ name: "BadTrans", price: 35, priceBasis: "PER_TRIP", restrictions: { closedToDeparture: true } }).expect(422);
    // unsupported dimension категории: CTD на tour → 422 (DD-028).
    const tour = await createProduct(seller1Agent, `CR11C Tour ${stamp}`, tourCatId, { packageClass: "standard" });
    const tplan = await createPlan(seller1Agent, tour.id, { name: "TourPlan", price: 90, priceBasis: "PER_PERSON" });
    await createRestriction(seller1Agent, tplan.id, { scope: "DATE", type: "CLOSED_TO_DEPARTURE", startDate: D.date1, endDate: D.date1 }, 422);
    await seller1Agent.post(`/api/v1/products/${tour.id}/tariffs`).send({ name: "BadBase", price: 90, priceBasis: "PER_PERSON", restrictions: { minStay: 2 } }).expect(422);
  });

  // ── 31-36: precedence / ambiguity ────────────────────────────────────────

  it("12. archived restriction ignored (resolver); equal-specificity contradiction 422; insertion order irrelevant", async () => {
    const product = await createProduct(seller1Agent, `CR12 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Arch", price: 100, priceBasis: "PER_NIGHT" });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 }, 422);
    await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201);
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 }); // архив игнорируется
  });

  // ── 37-41: pricing composition ───────────────────────────────────────────

  it("13. restriction НЕ меняет числовую цену; POR-план может иметь restriction (inert); missing price не становится POR", async () => {
    const product = await createProduct(seller1Agent, `CR13 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "PriceComp", price: 100, priceBasis: "PER_NIGHT" });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "ADVANCE_BOOKING", value: 0, startDate: D.date1, endDate: D.date1 });
    const q = await newQuote();
    const item = await addItem(q.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1 });
    expect(item?.unitPrice).toBe("100");
    // POR: restriction допустима (inert до FIXED), но числовой quote по-прежнему 422.
    const p2 = await createProduct(seller1Agent, `CR13B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const por = await createPlan(seller1Agent, p2.id, { name: "POR", price: 100, pricingMode: "PRICE_ON_REQUEST", priceBasis: "PER_NIGHT" });
    await createRestriction(seller1Agent, por.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    const q2 = await newQuote();
    await addItem(q2.code, { productId: p2.id, tariffId: por.id, quantity: 1, serviceDate: D.date1 }, 422);
  });

  // ── 42-46: quote freeze ──────────────────────────────────────────────────

  it("14. pre-binding violation блокирует Quote; restrictionSnapshot provenance; post-ISSUE Seller-edit не инвалидирует frozen Quote", async () => {
    const product = await createProduct(seller1Agent, `CR14 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Freeze", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.start, endDate: D.end, price: 190 });
    await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "MIN_STAY", value: 2, commercialPeriodId: period.id });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date3, endDate: D.date3 });

    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 1 }, 422); // min-stay violation
    const q2 = await newQuote();
    const item = await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 2 });
    expect(item?.unitPrice).toBe("190"); // period price
    expect(item?.serviceDate).toBe(D.date1);
    expect(item?.restrictionSnapshot).toEqual(
      expect.arrayContaining([
        { type: "MIN_STAY", value: 2, source: "PERIOD", code: expect.stringMatching(/^CRS-\d{8}$/) },
      ]),
    );

    // ISSUE + checkout intent (binding).
    await smAgent.put(`/api/v1/sales/quotes/${q2.code}/commercial`).send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() }).expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${q2.code}/issue`).expect(201);
    const intent = (await smAgent.post(`/api/v1/sales/checkouts`).send({ quoteId: q2.id }).expect(201)).body as { code: string; version: number };
    // Seller добавляет stop-sell + меняет min-stay ПОСЛЕ ISSUE → frozen Quote не
    // пере-резолвится/не инвалидируется (1.8C §44 freeze; никакого re-read).
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    await seller1Agent.patch(`/api/v1/commercial-periods/${period.id}`).send({ price: 250 }).expect(200);
    const frozen = (await smAgent.get(`/api/v1/sales/quotes/${q2.code}`).expect(200)).body as { items: QuoteItemRow[] };
    expect(frozen.items[0].unitPrice).toBe("190");
    expect(frozen.items[0].serviceDate).toBe(D.date1);
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: D.date1, expectedVersion: intent.version }).expect(200);
  });

  // ── 47-50: availability separation ───────────────────────────────────────

  it("14B. range stop-sell (§42): interior stop-sold дата блокирует multi-day Quote; activate под ARCHIVED периодом → conflict", async () => {
    const product = await createProduct(seller1Agent, `CR14B Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "RangeStop", price: 100, priceBasis: "PER_NIGHT" });
    const period = await createPeriod(seller1Agent, plan.id, { startDate: D.start, endDate: D.end, price: 120 });
    // STOP_SELL на interior-дату диапазона (не start).
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date2, endDate: D.date2 });
    const q1 = await newQuote();
    await addItem(q1.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 6 }, 422); // 01-10..01-15 включает interior stop (01-15)
    const q2 = await newQuote();
    await addItem(q2.code, { productId: product.id, tariffId: plan.id, quantity: 1, serviceDate: D.date1, durationDays: 1 }); // только start → ok

    // activate PERIOD-restriction под ARCHIVED периодом → conflict (STRICT §51).
    const rp = await createRestriction(seller1Agent, plan.id, { scope: "PERIOD", type: "MIN_STAY", value: 2, commercialPeriodId: period.id });
    await adminAgent.post(`/api/v1/commercial-restrictions/${rp.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-periods/${period.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-restrictions/${rp.id}/activate`).expect(409);
    // DATE restriction не зависит от периода — activate ок.
    const rd = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date3, endDate: D.date3 });
    await adminAgent.post(`/api/v1/commercial-restrictions/${rd.id}/archive`).expect(201);
    await adminAgent.post(`/api/v1/commercial-restrictions/${rd.id}/activate`).expect(201);
  });

  it("15. restriction CRUD создаёт/освобождает ноль AvailabilityReservation holds (не inventory-счётчик)", async () => {
    const product = await createProduct(seller1Agent, `CR15 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Avail", price: 100, priceBasis: "PER_NIGHT" });
    const holdsBefore = await prisma.availabilityReservation.count({ where: { productId: product.id } });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    const afterCreate = await prisma.availabilityReservation.count({ where: { productId: product.id } });
    expect(afterCreate).toBe(holdsBefore);
    await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201);
    const afterArchive = await prisma.availabilityReservation.count({ where: { productId: product.id } });
    expect(afterArchive).toBe(holdsBefore);
  });

  // ── 51-53: concurrency ───────────────────────────────────────────────────

  it("16. CAS: параллельные PATCH — один winner, ни одного молчаливого lost-update", async () => {
    const product = await createProduct(seller1Agent, `CR16 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "CAS", price: 100, priceBasis: "PER_NIGHT" });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "ADVANCE_BOOKING", value: 2, startDate: D.date1, endDate: D.date1 });
    expect(r.version).toBe(1);
    const [a, b] = await Promise.allSettled([
      seller1Agent.patch(`/api/v1/commercial-restrictions/${r.id}`).send({ value: 5 }),
      seller1Agent.patch(`/api/v1/commercial-restrictions/${r.id}`).send({ value: 7 }),
    ]);
    const statuses = [a.status === "fulfilled" ? a.value.status : -1, b.status === "fulfilled" ? b.value.status : -1];
    const success = statuses.filter((s) => s === 200).length;
    expect(success).toBeGreaterThanOrEqual(1);
    const got = (await seller1Agent.get(`/api/v1/commercial-restrictions/${r.id}`).expect(200)).body as RestrictionRow;
    expect(got.version).toBeGreaterThanOrEqual(2);
  });

  it("17. concurrent duplicate create (same date) — детерминированный один успех / один 422 (advisory lock)", async () => {
    const product = await createProduct(seller1Agent, `CR17 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Race", price: 100, priceBasis: "PER_NIGHT" });
    const [a, b] = await Promise.allSettled([
      seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 }),
      seller1Agent.post(`/api/v1/tariffs/${plan.id}/commercial-restrictions`).send({ scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 }),
    ]);
    const statuses = [a.status === "fulfilled" ? a.value.status : -1, b.status === "fulfilled" ? b.value.status : -1].sort();
    expect(statuses).toEqual([201, 422]);
    const count = await prisma.commercialRestriction.count({ where: { tariffId: plan.id } });
    expect(count).toBe(1);
    const history = await prisma.commercialRestrictionHistory.count({ where: { restriction: { tariffId: plan.id }, action: "created" } });
    expect(history).toBe(1); // без дубликата audit/history успеха
  });

  // ── 54-60: regression boundaries ─────────────────────────────────────────

  it("18. public Catalog DTO: никаких restriction/audit/internal полей", async () => {
    const product = await createProduct(seller1Agent, `CR18 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "Public", price: 100, priceBasis: "PER_NIGHT" });
    await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const detail = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: Record<string, unknown> };
    const raw = JSON.stringify(detail);
    expect(raw).not.toContain("restrictionSnapshot");
    expect(raw).not.toContain("commercialRestrictions");
    expect(raw).not.toContain("createdById");
    expect(raw).not.toContain("archivedAt");
    expect(raw).not.toContain("CRS-");
  });

  it("19. priceFrom: полностью stop-sold DATE_OVERRIDE не рекламируется; archive → возвращается (JS + SQL sort)", async () => {
    const product = await createProduct(seller1Agent, `CR19 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "FromN", price: 100, priceBasis: "PER_NIGHT" });
    // DATE_OVERRIDE дешевле base (50) на D.date1.
    const ov = await createPeriod(seller1Agent, plan.id, { kind: "DATE_OVERRIDE", startDate: D.date1, endDate: D.date1, price: 50 });
    const r = await createRestriction(seller1Agent, plan.id, { scope: "DATE", type: "STOP_SELL", startDate: D.date1, endDate: D.date1 });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const blocked = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { priceFrom: string | null } };
    expect(blocked.product.priceFrom).toBe("100.00"); // stop-sold 50 не рекламируется

    await adminAgent.post(`/api/v1/commercial-restrictions/${r.id}/archive`).expect(201);
    const unblocked = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { priceFrom: string | null } };
    expect(unblocked.product.priceFrom).toBe("50.00");

    // SQL sort path — тот же eligible-set.
    const list = (await request(app.getHttpServer()).get(`/api/v1/public/products?sort=price_asc&pageSize=50`).expect(200)).body as { items: Array<{ id: string; priceFrom: string | null }> };
    expect(list.items.find((i) => i.id === product.id)?.priceFrom).toBe("50.00");
  });

  it("20. priceFrom: период целиком в advance-window не рекламируется (JS + SQL)", async () => {
    const product = await createProduct(seller1Agent, `CR20 Hotel ${stamp}`, hotelCatId, { roomType: "standard" });
    const plan = await createPlan(seller1Agent, product.id, { name: "FromNA", price: 100, priceBasis: "PER_NIGHT", restrictions: { advanceBookingDays: 30 } });
    // Период [dPlus(5)..dPlus(15)] — весь внутри advance-window 30 дней → не candidate.
    await createPeriod(seller1Agent, plan.id, { startDate: dPlus(5), endDate: dPlus(15), price: 40 });
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const detail = (await request(app.getHttpServer()).get(`/api/v1/public/products/${product.id}`).expect(200)).body as { product: { priceFrom: string | null } };
    expect(detail.product.priceFrom).toBe("100.00");
    const list = (await request(app.getHttpServer()).get(`/api/v1/public/products?sort=price_asc&pageSize=50`).expect(200)).body as { items: Array<{ id: string; priceFrom: string | null }> };
    expect(list.items.find((i) => i.id === product.id)?.priceFrom).toBe("100.00");
  });
});
