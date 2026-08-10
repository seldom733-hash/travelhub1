/**
 * E2E PHASE 2 STEP 2.3A — Checkout / Commercial Intent Foundation (§79/§80).
 *
 *  1.  anonymous → 401 (все checkout endpoints);
 *  2.  RBAC matrix: BUYER/PARTNER/MODERATOR/FINANCE/ANALYST/MARKETER/OPERATOR → 403;
 *      SALES_MANAGER — write+read; DIRECTOR — read только (write → 403);
 *  3.  create authoritative context из ISSUED Quote: frozen totals == Quote totals,
 *      code CKT-*, acquisitionSource=DIRECT (server-derived), travelers/date;
 *  4.  forged price/totals/currency/source/options → 422 (frontend не источник цены);
 *  5.  binding-price: DRAFT Quote → 422; expired Quote → 422; revalidate НЕ
 *      reprices (тариф меняется в Catalog — total intent не меняется);
 *  6.  customer scope: default из Quote, override валидируется (invalid → 422);
 *  7.  travelers: replace-all, будущий/невалидный birthDate → 422, max 50;
 *  8.  service date: прошлая/невалидная → 422, update работает;
 *  9.  availability read-only: AVAILABLE / UNAVAILABLE / NOT_CONFIGURED по фактам
 *      catalog.Availability; БЕЗ записи capacity (slotsReserved/slotsBooked не
 *      меняются); semantics "checked, not reserved";
 * 10.  CAS: stale expectedVersion → 409; concurrent мутации → ровно один успех;
 * 11.  cancel: терминал (повторный cancel → 422), мутации после cancel → 422;
 * 12.  history/audit: created → travelers_changed → service_date_changed →
 *      availability_checked → cancelled; без PII; audit entries;
 * 13.  изоляция: Order/Booking/Payment не создаются; outbox без OrderRequested
 *      (дельта); Sale остаётся OPEN (не completed);
 * 13b. CKT canonical ID: 20 параллельных create → 20 уникальных кодов
 *      (BusinessSequence atomic, §6/§36.1);
 * 14.  privacy + error model: без email/phone/requestId в entity responses;
 *      404/409/422 с requestId и без stack/Prisma SQL.
 */

import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { Prisma, RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: {
    id: string;
    role: string;
    email: string | null;
    customerId: string | null;
    partnerId: string | null;
    permissions: string[];
  };
}

interface ProductFixture {
  productId: string;
  tariffId: string;
  tariffPrice: string;
}

describe("Phase 2 Step 2.3A — Checkout / Commercial Intent Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    availability: string[];
    auditLogs: string[];
  } = { users: [], customers: [], products: [], quotes: [], checkouts: [], sales: [], availability: [], auditLogs: [] };

  const register = (body: Record<string, unknown>) => request(app.getHttpServer()).post("/api/v1/auth/register").send(body);

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const registerBuyer = async (tag: string): Promise<Session> => {
    const res = await register({
      username: `${tag}${stamp}`,
      email: `${tag}${stamp}@test.local`,
      password: "buyerpass123",
      firstName: "Покупатель",
      lastName: tag.toUpperCase(),
    }).expect(201);
    const session = res.body as Session;
    created.users.push(session.user.id);
    if (session.user.customerId) created.customers.push(session.user.customerId);
    return session;
  };

  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, password);
  };

  /** Календарная дата +2 дня (UTC) — безопасно в будущем относительно now. */
  const futureDate = (days = 2) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const pastDate = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  /** Продукт + тариф (admin). */
  const createProduct = async (tag: string, price = 100, quantity = 1): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `Checkout ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };

  /**
   * Availability строка (admin; product+tariff+date unique). API принимает только
   * slotsTotal (booked/reserved = 0); booked/reserved для фикстур ставим через
   * prisma напрямую (тестовая манипуляция catalog-фактами).
   */
  const upsertAvailability = async (productId: string, tariffId: string, date: string, slotsTotal: number, extra?: { booked?: number; reserved?: number }) => {
    const res = await adminAgent
      .post(`/api/v1/products/${productId}/availability`)
      .send({ tariffId, date: `${date}T00:00:00.000Z`, slotsTotal })
      .expect(201);
    const row = res.body as { id: string };
    created.availability.push(row.id);
    if (extra && (extra.booked !== undefined || extra.reserved !== undefined)) {
      return prisma.availability.update({
        where: { id: row.id },
        data: { ...(extra.booked !== undefined ? { slotsBooked: extra.booked } : {}), ...(extra.reserved !== undefined ? { slotsReserved: extra.reserved } : {}) },
      });
    }
    return row;
  };

  /** ISSUED Quote (1 item + commercial + optional travelers). */
  const issueQuote = async (smToken: string, fx: ProductFixture, opts: { quantity?: number; travelers?: Array<{ firstName: string; lastName: string; birthDate?: string }>; validUntilDays?: number } = {}) => {
    const quantity = opts.quantity ?? 1;
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + (opts.validUntilDays ?? 30) * 86400000).toISOString() })
      .expect(200);
    if (opts.travelers) {
      await agent(smToken).put(`/api/v1/sales/quotes/${quote.code}/travelers`).send({ travelers: opts.travelers }).expect(200);
    }
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    return quote;
  };

  const createIntent = (token: string, body: Record<string, unknown>) => agent(token).post("/api/v1/sales/checkouts").send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    // Порядок важен: CheckoutIntent → Sale → Quote (FK Restrict) → product
    // (cascade availability/tariffs) → customers/users.
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
    await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    if (created.availability.length > 0) {
      await prisma.availability.deleteMany({ where: { id: { in: created.availability } } });
    }
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Anonymous ──────────────────────────────────────────────────────────

  it("1. anonymous → 401 на всех checkout endpoints", async () => {
    const paths = [
      ["get", "/api/v1/sales/checkouts"],
      ["post", "/api/v1/sales/checkouts"],
      ["get", "/api/v1/sales/checkouts/CKT-00000001"],
      ["get", "/api/v1/sales/checkouts/CKT-00000001/history"],
      ["put", "/api/v1/sales/checkouts/CKT-00000001/travelers"],
      ["put", "/api/v1/sales/checkouts/CKT-00000001/service-date"],
      ["post", "/api/v1/sales/checkouts/CKT-00000001/revalidate"],
      ["post", "/api/v1/sales/checkouts/CKT-00000001/cancel"],
    ] as const;
    for (const [method, path] of paths) {
      await request(app.getHttpServer())[method](path).send({}).expect(401);
    }
  });

  // ── 2. RBAC matrix ────────────────────────────────────────────────────────

  it("2. RBAC: не-владельцы → 403; SALES_MANAGER read+write; DIRECTOR read only", async () => {
    const buyer = await registerBuyer("ck_buyer");
    const partner = await createStaff("ck_partner", RoleCode.PARTNER, "partnerpass123");
    const mod = await createStaff("ck_mod", RoleCode.MODERATOR);
    const finance = await createStaff("ck_finance", RoleCode.FINANCE);
    const analyst = await createStaff("ck_analyst", RoleCode.ANALYST);
    const marketer = await createStaff("ck_marketer", RoleCode.MARKETER);
    const operator = await createStaff("ck_operator", RoleCode.OPERATOR);
    const sm = await createStaff("ck_sm", RoleCode.SALES_MANAGER);
    const director = await createStaff("ck_director", RoleCode.DIRECTOR);

    for (const who of [buyer, partner, mod, finance, analyst, marketer, operator]) {
      await agent(who.accessToken).get("/api/v1/sales/checkouts").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: "x" }).expect(403);
      await agent(who.accessToken).get("/api/v1/sales/checkouts/CKT-00000001").expect(403);
    }

    // SALES_MANAGER: read + write доступны (список пуст или разрешён).
    await agent(sm.accessToken).get("/api/v1/sales/checkouts").expect(200);
    // DIRECTOR: read 200, write → 403 (нет sales.checkout.write).
    await agent(director.accessToken).get("/api/v1/sales/checkouts").expect(200);
    await agent(director.accessToken).post("/api/v1/sales/checkouts").send({ quoteId: "x" }).expect(403);

    // Reconciliation: permissions в сессии.
    expect(sm.user.permissions).toContain("sales.checkout.read");
    expect(sm.user.permissions).toContain("sales.checkout.write");
    expect(director.user.permissions).toContain("sales.checkout.read");
    expect(director.user.permissions).not.toContain("sales.checkout.write");
    expect(finance.user.permissions).not.toContain("sales.checkout.read");
    expect(analyst.user.permissions).not.toContain("sales.checkout.read");
  });

  // ── 3. Create authoritative context ───────────────────────────────────────

  it("3. create: frozen totals из ISSUED Quote, DIRECT source, travelers/date, availability checked", async () => {
    const sm = await createStaff("ck_create", RoleCode.SALES_MANAGER);
    const fx = await createProduct("create", 100);
    const quote = await issueQuote(sm.accessToken, fx, { quantity: 2, travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-10" }] });

    const serviceDate = futureDate();
    const res = await createIntent(sm.accessToken, {
      quoteId: quote.id,
      serviceDate,
      travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-10" }],
    }).expect(201);
    const body = res.body as {
      id: string;
      code: string;
      quoteCode: string;
      status: string;
      version: number;
      currency: string;
      subtotal: string;
      discountAmount: string | null;
      total: string;
      serviceDate: string | null;
      acquisitionSource: string;
      quoteExpired: boolean;
      priceAuthoritative: boolean;
      travelers: Array<{ firstName: string; lastName: string; birthDate: string | null }>;
      availability: { state: string; semantics: string; items: unknown[] };
    };
    created.checkouts.push(body.id);
    expect(body.code).toMatch(/^CKT-\d{8}$/);
    expect(body.quoteCode).toBe(quote.code);
    expect(body.status).toBe("ACTIVE");
    expect(body.version).toBe(1);
    expect(body.currency).toBe("USD");
    // Decimal(12,2) сериализуется через decimal.js String(): 200 (без хвостовых нулей).
    expect(body.subtotal).toBe("200"); // 100 * 2 (backend-computed в Quote)
    expect(body.discountAmount).toBe("0"); // NONE → 0 (frozen из Quote)
    expect(body.total).toBe("200");
    expect(body.serviceDate).toBe(serviceDate);
    expect(body.acquisitionSource).toBe("DIRECT"); // server-derived, internal-assisted
    expect(body.quoteExpired).toBe(false);
    expect(body.priceAuthoritative).toBe(true);
    expect(body.travelers).toHaveLength(1);
    expect(body.travelers[0].firstName).toBe("Иван");
    expect(body.travelers[0].birthDate).toBe("1990-05-10T00:00:00.000Z");
    // Availability: дата без capacity-строки → честный NOT_CONFIGURED (не ошибка).
    expect(body.availability.state).toBe("CHECKED_NOT_RESERVED");
    expect(body.availability.semantics).toContain("not reserved");
    expect(body.availability.items).toHaveLength(1);
    expect(body.availability.items[0]).toMatchObject({ level: "NOT_CONFIGURED", required: 2 });
  });

  // ── 4. Forged money/source/options → 422 ──────────────────────────────────

  it("4. forged price/totals/currency/source/options → 422 (frontend не источник цены)", async () => {
    const sm = await createStaff("ck_forge", RoleCode.SALES_MANAGER);
    const fx = await createProduct("forge", 80);
    const quote = await issueQuote(sm.accessToken, fx);

    const forge: Array<Record<string, unknown>> = [
      { total: "1.00" },
      { subtotal: "1.00" },
      { currency: "EUR" },
      { discountAmount: "0.00" },
      { discountValue: "10" },
      { discountType: "FIXED" },
      { acquisitionSource: "MARKETPLACE" },
      { options: [{ id: "opt1", quantity: 1 }] },
      { status: "CANCELLED" },
      { code: "CKT-FAKE" },
      { version: 5 },
      { createdById: "hacker" },
      { price: "1.00" },
      { unitPrice: "1.00" },
      { amount: "1.00" },
      { fee: "1.00" },
      { tax: "1.00" },
      { availability: "available" },
      { capacity: 1 },
    ];
    for (const extra of forge) {
      await createIntent(sm.accessToken, { quoteId: quote.id, ...extra }).expect(422);
    }
    // Traveler-item forged fields → 422.
    await createIntent(sm.accessToken, {
      quoteId: quote.id,
      travelers: [{ firstName: "A", lastName: "B", id: "t1", createdAt: "2026-01-01T00:00:00Z" }],
    }).expect(422);
  });

  // ── 5. Binding-price semantics ────────────────────────────────────────────

  it("5. binding-price: DRAFT/expired Quote → 422; revalidate НЕ reprices при изменении тарифа", async () => {
    const sm = await createStaff("ck_bind", RoleCode.SALES_MANAGER);
    const fx = await createProduct("bind", 120);
    const quote = await issueQuote(sm.accessToken, fx);
    const detail = (await agent(sm.accessToken).get(`/api/v1/sales/quotes/${quote.code}`).expect(200)).body as { total: string };

    // DRAFT quote → 422.
    const draftQuote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string };
    created.quotes.push(draftQuote.id);
    await createIntent(sm.accessToken, { quoteId: draftQuote.id }).expect(422);

    // Expired quote → 422.
    await prisma.quote.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await createIntent(sm.accessToken, { quoteId: quote.id }).expect(422);
    // Восстанавливаем (для reprice-теста).
    await prisma.quote.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() + 30 * 86400000) } });

    // Binding-price: изменение цены тарифа в Catalog НЕ меняет intent total.
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; code: string; total: string; version: number };
    created.checkouts.push(intent.id);
    expect(intent.total).toBe(detail.total);
    await prisma.tariff.update({ where: { id: fx.tariffId }, data: { price: new Prisma.Decimal("999.00") } });
    const revalidated = (await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: intent.version }).expect(201)).body as { total: string };
    expect(revalidated.total).toBe(detail.total); // frozen, без reprice

    // FIXED discount propagation (§80 item 11): frozen discount chain целиком.
    const fx2 = await createProduct("bindfix", 100);
    const q2 = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(q2.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${q2.code}/items`).send({ productId: fx2.productId, tariffId: fx2.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${q2.code}/commercial`)
      .send({ discountType: "FIXED", discountValue: "30", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${q2.code}/issue`).expect(201);
    const discounted = (await createIntent(sm.accessToken, { quoteId: q2.id }).expect(201)).body as {
      id: string;
      subtotal: string;
      discountType: string;
      discountValue: string | null;
      discountAmount: string | null;
      total: string;
    };
    created.checkouts.push(discounted.id);
    expect(discounted).toMatchObject({
      subtotal: "100",
      discountType: "FIXED",
      discountValue: "30",
      discountAmount: "30",
      total: "70",
    });
  });

  // ── 5b. Failure atomicity (§57) ───────────────────────────────────────────

  it("5b. failure-atomicity: неудачные create не оставляют частичных строк (intent/travelers/history)", async () => {
    const sm = await createStaff("ck_atomic", RoleCode.SALES_MANAGER);
    const fx = await createProduct("atomic", 90);
    const quote = await issueQuote(sm.accessToken, fx);

    const baseline = {
      intents: await prisma.checkoutIntent.count({ where: { quoteId: quote.id } }),
      travelers: await prisma.checkoutIntentTraveler.count(),
      history: await prisma.checkoutIntentHistory.count(),
    };

    // Серия неудачных create: business-валидация выполняется ДО транзакции
    // (ни один из этих случаев не должен создать intent/travelers/history).
    await createIntent(sm.accessToken, { quoteId: quote.id, travelers: [{ firstName: "A", lastName: "B", birthDate: "2099-01-01" }] }).expect(422); // future birthDate
    await createIntent(sm.accessToken, { quoteId: quote.id, customerId: "cus-missing" }).expect(422); // несуществующий customer
    await createIntent(sm.accessToken, { quoteId: quote.id, total: "1.00" }).expect(422); // forged money

    expect(await prisma.checkoutIntent.count({ where: { quoteId: quote.id } })).toBe(baseline.intents);
    expect(await prisma.checkoutIntentTraveler.count()).toBe(baseline.travelers);
    expect(await prisma.checkoutIntentHistory.count()).toBe(baseline.history);

    // Успешный create атомарен: intent + travelers + history появляются вместе.
    const ok = (await createIntent(sm.accessToken, { quoteId: quote.id, travelers: [{ firstName: "Иван", lastName: "Иванов" }] }).expect(201)).body as { id: string };
    created.checkouts.push(ok.id);
    expect(await prisma.checkoutIntent.count({ where: { quoteId: quote.id } })).toBe(baseline.intents + 1);
    expect(await prisma.checkoutIntentTraveler.count({ where: { checkoutIntentId: ok.id } })).toBe(1);
    expect(await prisma.checkoutIntentHistory.count({ where: { checkoutIntentId: ok.id } })).toBe(1); // created
  });

  // ── 6. Customer scope ─────────────────────────────────────────────────────

  it("6. customer scope: default из Quote; override валидируется (invalid → 422)", async () => {
    const sm = await createStaff("ck_cus", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("ck_cus_b");
    const fx = await createProduct("cus", 50);
    const quote = (await agent(sm.accessToken).post("/api/v1/sales/quotes").send({ customerId: buyer.user.customerId }).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: 1 }).expect(201);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    // Default: customer наследуется из Quote.
    const d1 = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; customerId: string | null };
    created.checkouts.push(d1.id);
    expect(d1.customerId).toBe(buyer.user.customerId);

    // Override: существующий Customer → OK (staff-assisted business reference).
    const other = await registerBuyer("ck_cus_other");
    const d2 = (await createIntent(sm.accessToken, { quoteId: quote.id, customerId: other.user.customerId }).expect(201)).body as { id: string; customerId: string | null };
    created.checkouts.push(d2.id);
    expect(d2.customerId).toBe(other.user.customerId);

    // Override invalid / чужой несуществующий → 422 (existence validation).
    await createIntent(sm.accessToken, { quoteId: quote.id, customerId: "cus-does-not-exist" }).expect(422);
  });

  // ── 7. Travelers ──────────────────────────────────────────────────────────

  it("7. travelers: replace-all; будущий/невалидный birthDate → 422; max 50 → 422", async () => {
    const sm = await createStaff("ck_trav", RoleCode.SALES_MANAGER);
    const fx = await createProduct("trav", 60);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; version: number; code: string };
    created.checkouts.push(intent.id);

    const put = (body: Record<string, unknown>) => agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send(body);

    // Replace-all.
    const upd = (await put({ travelers: [{ firstName: "Анна", lastName: "Петрова" }], expectedVersion: 1 }).expect(200)).body as {
      version: number;
      travelers: Array<{ firstName: string; lastName: string }>;
    };
    expect(upd.version).toBe(2);
    expect(upd.travelers).toHaveLength(1);
    expect(upd.travelers[0].firstName).toBe("Анна");

    // Очистка (пустой массив) — допустима.
    const cleared = (await put({ travelers: [], expectedVersion: 2 }).expect(200)).body as { travelers: unknown[] };
    expect(cleared.travelers).toHaveLength(0);

    // Валидация. DTO (class-validator) → 400 для не-ISO8601/пустых значений;
    // сервисная валидация (date-only/future) → 422.
    await put({ travelers: [{ firstName: "A", lastName: "B", birthDate: "2099-01-01" }], expectedVersion: 3 }).expect(422); // future (сервис)
    await put({ travelers: [{ firstName: "A", lastName: "B", birthDate: "1990-13-40" }], expectedVersion: 3 }).expect(400); // invalid calendar (DTO)
    await put({ travelers: [{ firstName: "A", lastName: "B", birthDate: "1990-05-10T10:00:00Z" }], expectedVersion: 3 }).expect(422); // not date-only (сервис)
    await put({ travelers: [{ firstName: "", lastName: "B" }], expectedVersion: 3 }).expect(400); // empty name (DTO)
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ firstName: `N${i}`, lastName: "X" }));
    await put({ travelers: tooMany, expectedVersion: 3 }).expect(400); // > 50 (DTO ArrayMaxSize)

    // Forged keys в traveler-item → 422.
    await put({ travelers: [{ firstName: "A", lastName: "B", version: 9 }], expectedVersion: 3 }).expect(422);
  });

  // ── 8. Service date ───────────────────────────────────────────────────────

  it("8. service date: прошлая/невалидная → 422; update работает + availability пересчитана", async () => {
    const sm = await createStaff("ck_date", RoleCode.SALES_MANAGER);
    const fx = await createProduct("date", 70);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
      availability: { state: string; items: unknown[] };
    };
    created.checkouts.push(intent.id);
    expect(intent.availability.state).toBe("NOT_SPECIFIED"); // без даты — честно

    const put = (body: Record<string, unknown>) => agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send(body);

    await put({ serviceDate: pastDate(), expectedVersion: 1 }).expect(422);
    await put({ serviceDate: "not-a-date", expectedVersion: 1 }).expect(422);
    await put({ serviceDate: "2026-02-30", expectedVersion: 1 }).expect(422);

    // Availability row для этой даты (slotsTotal=2, booked=1) → available=1; qty=1 → AVAILABLE.
    const date = futureDate();
    await upsertAvailability(fx.productId, fx.tariffId, date, 2, { booked: 1 });
    const upd = (await put({ serviceDate: date, expectedVersion: 1 }).expect(200)).body as {
      version: number;
      serviceDate: string;
      availability: { state: string; items: Array<{ level: string; availableSlots: number }> };
    };
    expect(upd.version).toBe(2);
    expect(upd.serviceDate).toBe(date);
    expect(upd.availability.state).toBe("CHECKED_NOT_RESERVED");
    expect(upd.availability.items[0]).toMatchObject({ level: "AVAILABLE", availableSlots: 1 });
  });

  // ── 9. Availability read-only semantics ───────────────────────────────────

  it("9. availability: AVAILABLE/UNAVAILABLE/NOT_CONFIGURED по фактам; capacity НЕ записывается", async () => {
    const sm = await createStaff("ck_avail", RoleCode.SALES_MANAGER);
    const fx = await createProduct("avail", 90);
    const quote = await issueQuote(sm.accessToken, fx, { quantity: 2 });
    const date = futureDate();

    // AVAILABLE: slotsTotal=5, booked=1 → available=4 >= 2.
    await upsertAvailability(fx.productId, fx.tariffId, date, 5, { booked: 1 });
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id, serviceDate: date }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
      availability: { state: string; items: Array<{ level: string; availableSlots: number; required: number }> };
    };
    created.checkouts.push(intent.id);
    expect(intent.availability.items[0]).toMatchObject({ level: "AVAILABLE", availableSlots: 4, required: 2 });

    // UNAVAILABLE: другой день, capacity исчерпан (available=1 < 2).
    const date2 = futureDate(3);
    await upsertAvailability(fx.productId, fx.tariffId, date2, 2, { booked: 1 }); // available = 1 < 2
    const bad = (await createIntent(sm.accessToken, { quoteId: quote.id, serviceDate: date2 }).expect(201)).body as {
      id: string;
      availability: { items: Array<{ level: string; availableSlots: number }> };
    };
    created.checkouts.push(bad.id);
    expect(bad.availability.items[0]).toMatchObject({ level: "UNAVAILABLE", availableSlots: 1 });

    // NOT_CONFIGURED: дата без capacity-строки.
    const none = (await createIntent(sm.accessToken, { quoteId: quote.id, serviceDate: futureDate(5) }).expect(201)).body as {
      id: string;
      availability: { items: Array<{ level: string; availableSlots: number | null }> };
    };
    created.checkouts.push(none.id);
    expect(none.availability.items[0]).toMatchObject({ level: "NOT_CONFIGURED", availableSlots: null });

    // No capacity writes: slotsReserved/slotsBooked не изменились после
    // create/revalidate (read-only, ADR-0001).
    const row = await prisma.availability.findFirstOrThrow({ where: { productId: fx.productId, tariffId: fx.tariffId, date: new Date(`${date}T00:00:00.000Z`) } });
    const before = { booked: row.slotsBooked, reserved: row.slotsReserved };
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: intent.version }).expect(201);
    const after = await prisma.availability.findFirstOrThrow({ where: { id: row.id } });
    expect(after.slotsBooked).toBe(before.booked);
    expect(after.slotsReserved).toBe(before.reserved);
  });

  // ── 10. CAS ───────────────────────────────────────────────────────────────

  it("10. CAS: stale expectedVersion → 409; concurrent мутации → ровно один успех", async () => {
    const sm = await createStaff("ck_cas", RoleCode.SALES_MANAGER);
    const fx = await createProduct("cas", 110);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);

    // Stale version → 409.
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [{ firstName: "A", lastName: "B" }], expectedVersion: 99 }).expect(409);
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: futureDate(), expectedVersion: 99 }).expect(409);
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: 99 }).expect(409);
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: 99 }).expect(409);

    // Concurrent travelers updates (одинаковый expectedVersion) → один 200, один 409.
    const results = await Promise.allSettled([
      agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [{ firstName: "A1", lastName: "B1" }], expectedVersion: 1 }),
      agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [{ firstName: "A2", lastName: "B2" }], expectedVersion: 1 }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const hist = await prisma.checkoutIntentHistory.findMany({ where: { checkoutIntentId: intent.id, action: "travelers_changed" } });
    expect(hist).toHaveLength(1); // ровно один travelers-fact
  });

  // ── 11. Cancel ────────────────────────────────────────────────────────────

  it("11. cancel: терминальный переход; повторный cancel и мутации после cancel → 422", async () => {
    const sm = await createStaff("ck_cancel", RoleCode.SALES_MANAGER);
    const fx = await createProduct("cancel", 130);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);

    const cancelled = (await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: 1 }).expect(201)).body as {
      status: string;
      cancelledAt: string;
      version: number;
    };
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.version).toBe(2);

    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: 2 }).expect(422); // терминал
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [], expectedVersion: 2 }).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: futureDate(), expectedVersion: 2 }).expect(422);
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: 2 }).expect(422);
  });

  // ── 12. History/audit ─────────────────────────────────────────────────────

  it("12. history: created → travelers_changed → service_date_changed → availability_checked → cancelled; без PII; audit", async () => {
    const sm = await createStaff("ck_hist", RoleCode.SALES_MANAGER);
    const fx = await createProduct("hist", 140);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);

    const v1 = (await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [{ firstName: "Иван", lastName: "Иванов" }], expectedVersion: 1 }).expect(200)).body as { version: number };
    const v2 = (await agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: futureDate(), expectedVersion: v1.version }).expect(200)).body as { version: number };
    const v3 = (await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: v2.version }).expect(201)).body as { version: number };
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: v3.version }).expect(201);

    const hist = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}/history`).expect(200)).body as {
      items: Array<{ action: string; actorId: string | null }>;
    };
    expect(hist.items.map((h) => h.action)).toEqual(["created", "travelers_changed", "service_date_changed", "availability_checked", "cancelled"]);
    for (const h of hist.items) expect(h.actorId).toBe(sm.user.id);

    // No PII в history fields (raw body/traveler names не сохраняются).
    const rows = await prisma.checkoutIntentHistory.findMany({ where: { checkoutIntentId: intent.id } });
    for (const r of rows) {
      expect(JSON.stringify(r.fields ?? {})).not.toContain("Иванов");
    }

    // Audit entries.
    const audits = await prisma.auditLog.findMany({ where: { resource: "CheckoutIntent", resourceId: intent.id } });
    expect(audits.map((a) => a.action).sort()).toEqual(
      ["sales.checkout.created", "sales.checkout.travelers_changed", "sales.checkout.service_date_changed", "sales.checkout.revalidated", "sales.checkout.cancelled"].sort(),
    );
    for (const a of audits) created.auditLogs.push(a.id);
  });

  // ── 13. Isolation ─────────────────────────────────────────────────────────

  it("13. изоляция: нет Order/Booking/Payment/OrderRequested; Sale остаётся OPEN (не completed)", async () => {
    const sm = await createStaff("ck_iso", RoleCode.SALES_MANAGER);
    const fx = await createProduct("iso", 150);
    const quote = await issueQuote(sm.accessToken, fx);

    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();
    // Shared-DB isolation (serial e2e): дельта ДО создания intent — checkout не
    // создаёт НОВЫХ OrderRequested/OrderCreated/BookingRequested/BookingCreated-
    // строк (не global zero; чужие спеки чистят свои outbox-строки, но порядок
    // readdir на Windows не гарантирован). BookingCreated включён для консистент-
    // ности с quote-спекой (child событие с aggregateId=bookingId).
    const outboxBefore = await prisma.outboxEvent.count({ where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } } });

    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id, serviceDate: futureDate() }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/revalidate`).send({ expectedVersion: intent.version }).expect(201);

    // Sale по тому же Quote — создаётся OPEN и НЕ завершается checkout-ом.
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: quote.id }).expect(201)).body as { id: string; code: string; status: string };
    created.sales.push(sale.id);
    expect(sale.status).toBe("OPEN");
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(saleRow.status).toBe("OPEN");

    expect(await prisma.order.count()).toBe(ordersBefore);
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    // Никаких Payment/Finance side effects (модели payment отсутствуют — см. schema).
    const outboxAfter = await prisma.outboxEvent.count({ where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } } });
    expect(outboxAfter).toBe(outboxBefore);
  });

  // ── 13b. CKT canonical ID concurrency (§6/§36.1) ───────────────────────────

  it("13b. CKT: 20 параллельных create → 20 уникальных кодов (BusinessSequence atomic)", async () => {
    const sm = await createStaff("ck_conc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("conc", 200);
    const quote = await issueQuote(sm.accessToken, fx);

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => createIntent(sm.accessToken, { quoteId: quote.id }).expect(201)),
    );
    const codes = responses.map((r) => String((r.body as { code: string }).code));
    expect(new Set(codes).size).toBe(20);
    for (const c of codes) expect(c).toMatch(/^CKT-\d{8}$/);
    for (const r of responses) created.checkouts.push(String((r.body as { id: string }).id));
  });

  // ── 14. Privacy + error model ─────────────────────────────────────────────

  it("14. privacy + error model: без PII в entity responses; 404/409/422 с requestId и без stack", async () => {
    const sm = await createStaff("ck_privacy", RoleCode.SALES_MANAGER);
    const fx = await createProduct("priv", 160);
    const quote = await issueQuote(sm.accessToken, fx);
    const intent = (await createIntent(sm.accessToken, { quoteId: quote.id, travelers: [{ firstName: "Приватный", lastName: "Клиент" }] }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
    };
    created.checkouts.push(intent.id);

    const detail = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as Record<string, unknown>;
    const raw = JSON.stringify(detail);
    for (const bad of ["email", "phone", "password", "passport", "requestId", "correlationId"]) {
      expect(raw.toLowerCase()).not.toContain(bad);
    }

    // 404.
    const notFound = (await agent(sm.accessToken).get("/api/v1/sales/checkouts/CKT-99999999").expect(404)).body as { requestId?: string };
    expect(notFound.requestId).toBeTruthy();

    // 409 (stale) + 422 (forged) — requestId, без stack/Prisma.
    const conflict = (await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: 99 }).expect(409)).body as { requestId?: string };
    expect(conflict.requestId).toBeTruthy();
    const invalid = (await createIntent(sm.accessToken, { quoteId: quote.id, total: "1.00" }).expect(422)).body as { requestId?: string };
    expect(invalid.requestId).toBeTruthy();
    for (const body of [notFound, conflict, invalid]) {
      expect(JSON.stringify(body)).not.toMatch(/PrismaClient|at Object\.|at .*\.js:/);
    }
  });
});
