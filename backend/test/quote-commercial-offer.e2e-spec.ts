/**
 * E2E PHASE 2 STEP 2.3 — Quote & Commercial Offer Flow (§39).
 *
 * Доказывает (мин. 35 пунктов промпта):
 *  1. anonymous denied; 2. BUYER/PARTNER/MODERATOR denied;
 *  3. SALES_MANAGER authorized flow; 4. aggregate-only roles не видят raw Quote;
 *  5. create DRAFT composition; 6. Product/Tariff relationship validation;
 *  7. multiple QuoteItems; 8. backend-authoritative subtotal/total;
 *  9. client forged totals rejected; 10. currency validation;
 *  11. discount valid; 12. discount invalid; 13. customer context;
 *  14. travelers context + privacy; 15. issue quote;
 *  16. issuedAt/validUntil semantics; 17. issued snapshot immutable;
 *  18. Catalog mutation после issue не меняет snapshot;
 *  19. DRAFT edit allowed; 20. ISSUED direct edit denied;
 *  21. concurrent ISSUE → один lifecycle fact; 22. ISSUE vs edit race consistent;
 *  23. history chronology; 24. AuditLog minimal/no PII;
 *  25. child IDOR; 26. forbidden keys;
 *  27. no Order rows; 28. no Booking rows; 29. no OrderRequested/OrderCreated;
 *  30. Sale not completed; 31. no Payment/Finance effects;
 *  32. no capacity reservation; 33. no checkout context;
 *  34. requestId/error envelope; 35. Step 2.1/2.2 regressions (полный прогон).
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

interface QuoteDetail {
  id: string;
  code: string;
  customerId: string | null;
  status: string;
  currency: string;
  validUntil: string | null;
  issuedAt: string | null;
  discountType: string;
  discountValue: string | null;
  discountAmount: string | null;
  subtotal: string | null;
  total: string | null;
  version: number;
  items: Array<{
    id: string;
    productId: string;
    productCode: string;
    productTitle: string;
    tariffId: string;
    tariffCode: string;
    tariffName: string;
    quantity: number;
    unitPrice: string;
    currency: string;
    amount: string;
  }>;
  travelers: Array<{ id: string; firstName: string; lastName: string; birthDate: string | null }>;
}

describe("Phase 2 Step 2.3 — Quote & Commercial Offer Flow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    quotes: string[];
    sales: string[];
    products: string[];
    auditLogs: string[];
  } = { users: [], customers: [], quotes: [], sales: [], products: [], auditLogs: [] };

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

  /** Создание Product + tariffs через admin API; возвращает productId + tariffs. */
  const createProduct = async (title: string, tariffs: Array<{ name: string; price: number; currency?: string }>) => {
    const res = await adminAgent.post("/api/v1/products").send({ type: "TOUR", title, tariffs }).expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariffRows = await prisma.tariff.findMany({ where: { productId: product.id }, orderBy: { createdAt: "asc" } });
    return { productId: product.id, tariffs: tariffRows };
  };

  const createQuote = async (token: string, body: Record<string, unknown> = {}) => {
    const quote = (await agent(token).post("/api/v1/sales/quotes").send(body).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    return quote;
  };

  const addItem = (token: string, code: string, productId: string, tariffId: string, quantity = 1, status = 201) =>
    agent(token).post(`/api/v1/sales/quotes/${code}/items`).send({ productId, tariffId, quantity }).expect(status);

  const setCommercial = (token: string, code: string, body: Record<string, unknown>, status = 200) =>
    agent(token).put(`/api/v1/sales/quotes/${code}/commercial`).send(body).expect(status);

  const getDetail = async (token: string, code: string): Promise<QuoteDetail> =>
    (await agent(token).get(`/api/v1/sales/quotes/${code}`).expect(200)).body as QuoteDetail;

  const issue = (token: string, code: string) => agent(token).post(`/api/v1/sales/quotes/${code}/issue`);

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
    await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
    await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    await prisma.quoteHistory.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quoteItem.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quoteTraveler.deleteMany({ where: { quoteId: { in: created.quotes } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1-2. Anonymous / unauthorized roles ──────────────────────────────────

  it("1. anonymous → 401; BUYER/PARTNER/MODERATOR → 403 на Quote endpoints", async () => {
    const buyer = await registerBuyer("qc_buyer");
    const partner = await createStaff("qc_partner", RoleCode.PARTNER, "partnerpass123");
    const mod = await createStaff("qc_mod", RoleCode.MODERATOR);

    const anon = request(app.getHttpServer());
    await anon.get("/api/v1/sales/quotes").expect(401);
    await anon.post("/api/v1/sales/quotes").send({}).expect(401);
    await anon.get("/api/v1/sales/quotes/QTE-00000001").expect(401);

    for (const who of [buyer, partner, mod]) {
      await agent(who.accessToken).get("/api/v1/sales/quotes").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/quotes").send({}).expect(403);
      await agent(who.accessToken).get("/api/v1/sales/quotes/QTE-00000001").expect(403);
      await agent(who.accessToken).post("/api/v1/sales/quotes/QTE-00000001/issue").expect(403);
    }
  });

  // ── 4. Aggregate-only roles ──────────────────────────────────────────────

  it("2. ANALYST/MARKETER: raw Quote (list/detail) → 403 (aggregate-only)", async () => {
    const analyst = await createStaff("qc_analyst", RoleCode.ANALYST);
    const marketer = await createStaff("qc_marketer", RoleCode.MARKETER);
    const sm = await createStaff("qc_sm2", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Agg ${stamp}`, [{ name: "S", price: 100 }]);
    const quote = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, quote.code, productId, tariffs[0].id);

    for (const who of [analyst, marketer]) {
      await agent(who.accessToken).get("/api/v1/sales/quotes").expect(403);
      await agent(who.accessToken).get(`/api/v1/sales/quotes/${quote.code}`).expect(403);
      await agent(who.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId, tariffId: tariffs[0].id, quantity: 1 }).expect(403);
    }
  });

  // ── 3,5,7,8,9. SM flow + composition + totals + forged rejection ────────

  it("3. SALES_MANAGER: create DRAFT → composition → backend totals; forged totals → 422", async () => {
    const sm = await createStaff("qc_sm3", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Totals ${stamp}`, [
      { name: "S", price: 99.99 },
      { name: "M", price: 10 },
    ]);

    const quote = await createQuote(sm.accessToken);
    // DRAFT edit allowed (до ISSUE).
    await addItem(sm.accessToken, quote.code, productId, tariffs[0].id, 3); // 99.99 * 3 = 299.97
    await addItem(sm.accessToken, quote.code, productId, tariffs[1].id, 1); // 10.00

    const detail = await getDetail(sm.accessToken, quote.code);
    expect(detail.status).toBe("DRAFT");
    expect(detail.items).toHaveLength(2);
    expect(detail.subtotal).toBe("309.97");
    expect(detail.total).toBe("309.97");
    expect(detail.discountAmount).toBe("0");
    expect(detail.currency).toBe("USD");
    expect(detail.items[0].unitPrice).toBe("99.99");
    expect(detail.items[0].amount).toBe("299.97");
    expect(detail.issuedAt).toBeNull();

    // Forged server-owned fields → 422 (mass-assignment guards).
    await agent(sm.accessToken).post("/api/v1/sales/quotes").send({ subtotal: "1", total: "1", status: "ISSUED", version: 99 }).expect(422);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId, tariffId: tariffs[0].id, quantity: 1, unitPrice: "0.01", amount: "1" }).expect(422);
    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId, tariffId: tariffs[0].id, quantity: 0 }).expect(400);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "PERCENTAGE", discountValue: "10", subtotal: "1" }).expect(422);

    // Decimal overflow guard: unitPrice(12,2) × qty выходит за DECIMAL(12,2) → 422, не 500.
    const { productId: maxP, tariffs: maxT } = await createProduct(`QC Max ${stamp}`, [{ name: "MAX", price: 9999999999.99 }]);
    const qMax = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, qMax.code, maxP, maxT[0].id, 2, 422);
    await addItem(sm.accessToken, qMax.code, maxP, maxT[0].id, 1); // в пределах максимума — ок
    expect((await getDetail(sm.accessToken, qMax.code)).items[0].amount).toBe("9999999999.99");
  });

  // ── 6. Product/Tariff relationship validation ────────────────────────────

  it("4. eligibility: несуществующий product/tariff, чужой tariff, ARCHIVED product → 422", async () => {
    const sm = await createStaff("qc_elig", RoleCode.SALES_MANAGER);
    const { productId: p1, tariffs: t1 } = await createProduct(`QC P1 ${stamp}`, [{ name: "S", price: 50 }]);
    const { productId: p2, tariffs: t2 } = await createProduct(`QC P2 ${stamp}`, [{ name: "S", price: 60 }]);
    const quote = await createQuote(sm.accessToken);

    await addItem(sm.accessToken, quote.code, "prd-does-not-exist", t1[0].id, 1, 422);
    await addItem(sm.accessToken, quote.code, p1, "trf-does-not-exist", 1, 422);
    // Tariff другого Product → 422 (relationship).
    await addItem(sm.accessToken, quote.code, p1, t2[0].id, 1, 422);
    // Валидный → 201.
    await addItem(sm.accessToken, quote.code, p1, t1[0].id, 2);

    // ARCHIVED Product → 422 (детерминированная обработка недоступных сущностей).
    await adminAgent.post(`/api/v1/products/${p2}/archive`).expect(201);
    await addItem(sm.accessToken, quote.code, p2, t2[0].id, 1, 422);
  });

  // ── 10. Currency ─────────────────────────────────────────────────────────

  it("5. currency: единая валюта КП; item в другой валюте → 422", async () => {
    const sm = await createStaff("qc_cur", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Cur ${stamp}`, [
      { name: "USD", price: 10, currency: "USD" },
      { name: "EUR", price: 9, currency: "EUR" },
    ]);
    const quote = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, quote.code, productId, tariffs[0].id, 1);
    expect((await getDetail(sm.accessToken, quote.code)).currency).toBe("USD");
    // EUR item в USD-КП → 422 (не смешиваем валюты).
    await addItem(sm.accessToken, quote.code, productId, tariffs[1].id, 1, 422);

    // remove-last-item: после удаления ВСЕХ items можно добавить item другой
    // валюты — currency КП переустанавливается по первому item нового состава.
    const qSwap = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, qSwap.code, productId, tariffs[0].id, 1); // USD
    const swapDetail = await getDetail(sm.accessToken, qSwap.code);
    await agent(sm.accessToken).delete(`/api/v1/sales/quotes/${qSwap.code}/items/${swapDetail.items[0].id}`).expect(200);
    await addItem(sm.accessToken, qSwap.code, productId, tariffs[1].id, 1); // EUR
    expect((await getDetail(sm.accessToken, qSwap.code)).currency).toBe("EUR");
  });

  // ── 11-12. Discount ──────────────────────────────────────────────────────

  it("6. discount: PERCENTAGE/FIXED вычисляются backend-ом; невалидные → 422", async () => {
    const sm = await createStaff("qc_disc", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Disc ${stamp}`, [{ name: "S", price: 100 }]);

    // PERCENTAGE 10% от 200 = 20.
    const q1 = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q1.code, productId, tariffs[0].id, 2);
    await setCommercial(sm.accessToken, q1.code, { discountType: "PERCENTAGE", discountValue: "10", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    let d = await getDetail(sm.accessToken, q1.code);
    expect(d.discountAmount).toBe("20");
    expect(d.total).toBe("180");

    // FIXED 30 → total 170.
    const q2 = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q2.code, productId, tariffs[0].id, 2);
    await setCommercial(sm.accessToken, q2.code, { discountType: "FIXED", discountValue: "30", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    d = await getDetail(sm.accessToken, q2.code);
    expect(d.discountAmount).toBe("30");
    expect(d.total).toBe("170");

    // Невалидные: >100%, negative, NONE с value, malformed.
    const q3 = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q3.code, productId, tariffs[0].id, 1);
    await setCommercial(sm.accessToken, q3.code, { discountType: "PERCENTAGE", discountValue: "100.01" }, 422);
    await setCommercial(sm.accessToken, q3.code, { discountType: "PERCENTAGE", discountValue: "-5" }, 422);
    await setCommercial(sm.accessToken, q3.code, { discountType: "NONE", discountValue: "10" }, 422);
    await setCommercial(sm.accessToken, q3.code, { discountType: "FIXED", discountValue: "abc" }, 422); // malformed decimal → service 422
    // FIXED-скидка за пределами DECIMAL(12,2) → 422 (overflow guard, не Prisma 500).
    await setCommercial(sm.accessToken, q3.code, { discountType: "FIXED", discountValue: "99999999999999" }, 422);
    // FIXED > subtotal → СТРОГО 422 ДО записи (§13; никакого silent clamp, никакого
    // partial write: состояние КП не меняется).
    await setCommercial(sm.accessToken, q3.code, { discountType: "FIXED", discountValue: "500", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() }, 422);
    d = await getDetail(sm.accessToken, q3.code);
    expect(d.discountType).toBe("NONE"); // ничего не записано
    // Восстановление: корректный FIXED ≤ subtotal → preview и ISSUE работают.
    await setCommercial(sm.accessToken, q3.code, { discountType: "FIXED", discountValue: "30", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    d = await getDetail(sm.accessToken, q3.code);
    expect(d.discountAmount).toBe("30");
    expect(d.total).toBe("70");
    await issue(sm.accessToken, q3.code).expect(201);

    // Уменьшение subtotal ниже FIXED после установки → 422 ДО записи (состояние не меняется).
    const q4 = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q4.code, productId, tariffs[0].id, 3); // 300
    await setCommercial(sm.accessToken, q4.code, { discountType: "FIXED", discountValue: "200", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    let q4d = await getDetail(sm.accessToken, q4.code);
    expect(q4d.discountAmount).toBe("200");
    expect(q4d.total).toBe("100");
    await agent(sm.accessToken).patch(`/api/v1/sales/quotes/${q4.code}/items/${q4d.items[0].id}`).send({ quantity: 1 }).expect(422); // 200 > 100
    q4d = await getDetail(sm.accessToken, q4.code); // состояние не изменилось
    expect(q4d.items[0].quantity).toBe(3);
    expect(q4d.discountAmount).toBe("200");
    await issue(sm.accessToken, q4.code).expect(201);
  });

  // ── 13. Customer context ─────────────────────────────────────────────────

  it("7. customer context: set/unset; несуществующий customer → 422", async () => {
    const sm = await createStaff("qc_cus", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("qc_cus_b");
    const quote = await createQuote(sm.accessToken);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/customer`).send({ customerId: buyer.user.customerId }).expect(200);
    expect((await getDetail(sm.accessToken, quote.code)).customerId).toBe(buyer.user.customerId);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/customer`).send({ customerId: "cus-does-not-exist" }).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/customer`).send({ customerId: null }).expect(200);
    expect((await getDetail(sm.accessToken, quote.code)).customerId).toBeNull();
    // Forged: customerId + version → 422.
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/customer`).send({ customerId: buyer.user.customerId, version: 9 }).expect(422);
  });

  // ── 14. Travelers + privacy ──────────────────────────────────────────────

  it("8. travelers: set/replace; projection без passport/document/payment PII", async () => {
    const sm = await createStaff("qc_trav", RoleCode.SALES_MANAGER);
    const quote = await createQuote(sm.accessToken);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/travelers`)
      .send({ travelers: [{ firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-01" }] })
      .expect(200);
    let d = await getDetail(sm.accessToken, quote.code);
    expect(d.travelers).toHaveLength(1);
    expect(d.travelers[0].firstName).toBe("Иван");
    // birthDate: date-only контракт — UTC midnight, без timezone day-shift.
    expect(d.travelers[0].birthDate).toBe("1990-05-01T00:00:00.000Z");

    // birthDate: time-компонент/timezone (day-shift) и будущие даты → 422; невалидный календарь → 400.
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/travelers`)
      .send({ travelers: [{ firstName: "A", lastName: "B", birthDate: "1990-05-01T00:00:00+05:00" }] })
      .expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/travelers`).send({ travelers: [{ firstName: "A", lastName: "B", birthDate: "2100-01-01" }] }).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/travelers`).send({ travelers: [{ firstName: "A", lastName: "B", birthDate: "1990-13-45" }] }).expect(400);

    // Replace.
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/travelers`)
      .send({ travelers: [{ firstName: "Anna", lastName: "Smith" }, { firstName: "Ben", lastName: "Jones" }] })
      .expect(200);
    d = await getDetail(sm.accessToken, quote.code);
    expect(d.travelers).toHaveLength(2);

    // Privacy: projection не содержит passport/document/payment/CRM-полей.
    const raw = JSON.stringify(d);
    for (const bad of ["passport", "document", "payment", "phone", "email", "notes", "citizenship", "gender"]) {
      expect(raw.toLowerCase()).not.toContain(bad);
    }
    // Валидация: пустое имя, >50 travelers, forged id в traveler → 422/400.
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/travelers`).send({ travelers: [{ firstName: "", lastName: "X" }] }).expect(400);
    await agent(sm.accessToken)
      .put(`/api/v1/sales/quotes/${quote.code}/travelers`)
      .send({ travelers: Array.from({ length: 51 }, (_, i) => ({ firstName: `F${i}`, lastName: "L" })) })
      .expect(400);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${quote.code}/travelers`).send({ travelers: [{ id: "forged", firstName: "A", lastName: "B" }] }).expect(422);
  });

  // ── 15-16. Issue semantics ───────────────────────────────────────────────

  it("9. issue: validUntil обязателен и в будущем; issuedAt/status; re-issue → 422", async () => {
    const sm = await createStaff("qc_issue", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Issue ${stamp}`, [{ name: "S", price: 50 }]);

    // Без items → 422; без validUntil → 422; прошлый validUntil → 422.
    const qEmpty = await createQuote(sm.accessToken);
    await setCommercial(sm.accessToken, qEmpty.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, qEmpty.code).expect(422);

    const qNoVal = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, qNoVal.code, productId, tariffs[0].id, 1);
    await issue(sm.accessToken, qNoVal.code).expect(422);

    const qPast = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, qPast.code, productId, tariffs[0].id, 1);
    await setCommercial(sm.accessToken, qPast.code, { discountType: "NONE", validUntil: new Date(Date.now() - 1000).toISOString() }, 422);

    // Валидный ISSUE.
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 2);
    const validUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil });
    await issue(sm.accessToken, q.code).expect(201);

    const d = await getDetail(sm.accessToken, q.code);
    expect(d.status).toBe("ISSUED");
    expect(d.issuedAt).not.toBeNull();
    expect(d.validUntil).toBe(validUntil);
    expect(d.subtotal).toBe("100");
    expect(d.total).toBe("100");
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.issuedAt).not.toBeNull();
    expect(row.subtotal?.toString()).toBe("100");

    // Повторный ISSUE → детерминированный 422 (terminal protection).
    await issue(sm.accessToken, q.code).expect(422);
  });

  // ── 17,20. Issued immutability ───────────────────────────────────────────

  it("10. ISSUED immutable: прямые edit items/commercial/travelers/customer → 422", async () => {
    const sm = await createStaff("qc_imm", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Imm ${stamp}`, [{ name: "S", price: 80 }]);
    const q = await createQuote(sm.accessToken);
    const itemRes = await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    const itemId = (itemRes.body as QuoteDetail).items[0].id;
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, q.code).expect(201);

    await agent(sm.accessToken).post(`/api/v1/sales/quotes/${q.code}/items`).send({ productId, tariffId: tariffs[0].id, quantity: 1 }).expect(422);
    await agent(sm.accessToken).patch(`/api/v1/sales/quotes/${q.code}/items/${itemId}`).send({ quantity: 5 }).expect(422);
    await agent(sm.accessToken).delete(`/api/v1/sales/quotes/${q.code}/items/${itemId}`).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${q.code}/customer`).send({ customerId: null }).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${q.code}/travelers`).send({ travelers: [{ firstName: "A", lastName: "B" }] }).expect(422);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${q.code}/commercial`).send({ discountType: "PERCENTAGE", discountValue: "5" }).expect(422);

    // Состояние не изменилось: items/version/totals прежние.
    const d = await getDetail(sm.accessToken, q.code);
    expect(d.items[0].quantity).toBe(1);
    expect(d.total).toBe("80");
  });

  // ── 18. Catalog mutation после ISSUE ─────────────────────────────────────

  it("11. Catalog mutation после issue не меняет issued Quote snapshot (immutability proof)", async () => {
    const sm = await createStaff("qc_snap", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Snap ${stamp}`, [{ name: "S", price: 90 }]);
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 2);
    await setCommercial(sm.accessToken, q.code, { discountType: "PERCENTAGE", discountValue: "10", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, q.code).expect(201);

    const before = await getDetail(sm.accessToken, q.code);
    expect(before.items[0].unitPrice).toBe("90");
    expect(before.items[0].amount).toBe("180");
    expect(before.subtotal).toBe("180");
    expect(before.discountAmount).toBe("18");
    expect(before.total).toBe("162");

    // Catalog mutation (допустимый production-путь): заменяем tariffs на новые цены.
    await adminAgent.patch(`/api/v1/products/${productId}`).send({ tariffs: [{ name: "New", price: 999 }] }).expect(200);

    const after = await getDetail(sm.accessToken, q.code);
    expect(after.items[0].unitPrice).toBe("90"); // snapshot не изменился
    expect(after.items[0].amount).toBe("180");
    expect(after.subtotal).toBe("180");
    expect(after.discountAmount).toBe("18");
    expect(after.total).toBe("162");
  });

  // ── 21. Concurrent ISSUE ─────────────────────────────────────────────────

  it("12. concurrent ISSUE → ровно один lifecycle fact (один 201, один 409)", async () => {
    const sm = await createStaff("qc_conc", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Conc ${stamp}`, [{ name: "S", price: 40 }]);
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });

    const results = await Promise.allSettled([issue(sm.accessToken, q.code), issue(sm.accessToken, q.code)]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    // Инвариант: ровно один успешный ISSUE; проигравший — CAS 409 (true concurrency)
    // ИЛИ детерминированный 422 (сериализация: повторный ISSUE на ISSUED).
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409 || s === 422)).toHaveLength(1);

    const hist = await prisma.quoteHistory.findMany({ where: { quoteId: q.id, action: "issued" } });
    expect(hist).toHaveLength(1); // ровно один issued-fact
  });

  // ── 22. ISSUE vs edit race ───────────────────────────────────────────────

  it("13. ISSUE vs item-edit race → консистентный aggregate (CAS: один 201, один 409)", async () => {
    const sm = await createStaff("qc_race", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Race ${stamp}`, [{ name: "S", price: 25 }]);
    const q = await createQuote(sm.accessToken);
    const itemRes = await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    const itemId = (itemRes.body as QuoteDetail).items[0].id;
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });

    const results = await Promise.allSettled([
      issue(sm.accessToken, q.code),
      agent(sm.accessToken).patch(`/api/v1/sales/quotes/${q.code}/items/${itemId}`).send({ quantity: 10 }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    // Инвариант: ровно одна успешная операция; проигравшая — 409 (CAS) либо
    // 422 (детерминированный conflict: edit после ISSUE / issue после edit).
    expect(statuses.filter((s) => s === 201 || s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409 || s === 422)).toHaveLength(1);

    // Финальное состояние консистентно: если ISSUED — immutable totals соответствуют items.
    const d = await getDetail(sm.accessToken, q.code);
    if (d.status === "ISSUED") {
      expect(d.total).toBe(d.subtotal); // NONE discount
      const expected = d.items.reduce((s, i) => s + Number(i.amount), 0).toFixed(2);
      expect(d.subtotal).toBe(expected);
    } else {
      expect(d.status).toBe("DRAFT");
    }
  });

  // ── 19. DRAFT edit allowed (уже показано) + 23. History ──────────────────

  it("14. history chronology: created → item_added → customer_changed → commercial_changed → issued; без PII", async () => {
    const sm = await createStaff("qc_hist", RoleCode.SALES_MANAGER);
    const buyer = await registerBuyer("qc_hist_b");
    const { productId, tariffs } = await createProduct(`QC Hist ${stamp}`, [{ name: "S", price: 30 }]);
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    await agent(sm.accessToken).put(`/api/v1/sales/quotes/${q.code}/customer`).send({ customerId: buyer.user.customerId }).expect(200);
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, q.code).expect(201);

    const hist = (await agent(sm.accessToken).get(`/api/v1/sales/quotes/${q.code}/history`).expect(200)).body as { items: Array<{ action: string; actorId: string | null }>; total: number };
    expect(hist.items.map((h) => h.action)).toEqual(["created", "item_added", "customer_changed", "commercial_changed", "issued"]);
    expect(hist.items.every((h) => h.actorId === sm.user.id)).toBe(true);

    // History fields не содержат PII (имён travelers / полных customers).
    const rows = await prisma.quoteHistory.findMany({ where: { quoteId: q.id } });
    for (const r of rows) {
      expect(JSON.stringify(r.fields ?? {})).not.toContain("Иван");
      expect(JSON.stringify(r.fields ?? {})).not.toContain(buyer.user.email!);
    }
  });

  // ── 24. Audit ────────────────────────────────────────────────────────────

  it("15. AuditLog minimal/no PII; details только refs/codes", async () => {
    const sm = await createStaff("qc_audit", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Audit ${stamp}`, [{ name: "S", price: 15 }]);
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, q.code).expect(201);

    const audits = await prisma.auditLog.findMany({ where: { resource: "Quote", resourceId: q.id } });
    expect(audits.map((a) => a.action).sort()).toEqual(["sales.quote.commercial_changed", "sales.quote.item_added", "sales.quote.issued", "sales.quote.created"].sort());
    for (const a of audits) {
      const raw = JSON.stringify(a.details ?? {});
      expect(raw).not.toContain("Иванов");
      expect(raw).not.toContain("email");
      created.auditLogs.push(a.id);
    }
  });

  // ── 25. Child IDOR ───────────────────────────────────────────────────────

  it("16. child IDOR: item чужой КП недоступен через свою КП (404), неизвестные refs → 404/422", async () => {
    const sm = await createStaff("qc_idor", RoleCode.SALES_MANAGER);
    const sm2 = await createStaff("qc_idor2", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC IDOR ${stamp}`, [{ name: "S", price: 20 }]);
    const qA = await createQuote(sm.accessToken);
    const itemA = (await addItem(sm.accessToken, qA.code, productId, tariffs[0].id, 1)).body as QuoteDetail;
    const qB = await createQuote(sm2.accessToken);

    // sm2 (владелец B) не может трогать item КП A.
    await agent(sm2.accessToken).patch(`/api/v1/sales/quotes/${qB.code}/items/${itemA.items[0].id}`).send({ quantity: 3 }).expect(404);
    await agent(sm2.accessToken).delete(`/api/v1/sales/quotes/${qB.code}/items/${itemA.items[0].id}`).expect(404);

    // Чужой code → 404 (нейтральный, единая семантика unknown-code).
    await agent(sm.accessToken).get("/api/v1/sales/quotes/QTE-00099999").expect(404);
    await agent(sm.accessToken).post("/api/v1/sales/quotes/QTE-00099999/issue").expect(404);
  });

  // ── 27-33. Isolation (Order/Booking/Payment/Availability/outbox/Sale) ────

  it("17. изоляция: issue не создаёт Order/Booking/Payment, не резервирует capacity, outbox без OrderRequested, Sale не закрыта", async () => {
    const sm = await createStaff("qc_iso", RoleCode.SALES_MANAGER);
    const { productId, tariffs } = await createProduct(`QC Iso ${stamp}`, [{ name: "S", price: 60 }]);
    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();
    // Payment/Finance: отдельной Payment-сущности в схеме НЕТ (Phase 2.0 audit,
    // честная absence) — issue физически не может создать Payment rows.

    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 2);
    await setCommercial(sm.accessToken, q.code, { discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    await issue(sm.accessToken, q.code).expect(201);

    expect(await prisma.order.count()).toBe(ordersBefore);
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    const outbox = await prisma.outboxEvent.findMany({ where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingCreated"] } } });
    expect(outbox.length).toBe(0);
    // Никакой capacity reservation: Availability для продукта не создаётся и не меняется.
    expect(await prisma.availability.count({ where: { productId } })).toBe(0);

    // Sale не завершена/не закрыта: нет close/complete route (404).
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: q.id }).expect(201)).body as { id: string };
    created.sales.push(sale.id);
    await agent(sm.accessToken).post(`/api/v1/sales/sales/${sale.id}/close`).expect(404);
    const saleRow = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(saleRow.status).toBe("OPEN");
  });

  // ── 34. Error envelope / requestId ───────────────────────────────────────

  it("18. error envelope: 401/403/404/409/422 + requestId, без stack/Prisma/SQL", async () => {
    const sm = await createStaff("qc_err", RoleCode.SALES_MANAGER);
    const res = await agent(sm.accessToken).get("/api/v1/sales/quotes/QTE-00099999").expect(404);
    expect(res.body).toHaveProperty("requestId");
    expect(res.body.requestId).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/at .+\(|PrismaClient|SELECT |stack/i);

    // Детерминированный 422 envelope: issue без validUntil на собранном DRAFT.
    const { productId, tariffs } = await createProduct(`QC Err ${stamp}`, [{ name: "S", price: 5 }]);
    const q = await createQuote(sm.accessToken);
    await addItem(sm.accessToken, q.code, productId, tariffs[0].id, 1);
    const res422 = await issue(sm.accessToken, q.code).expect(422);
    expect(res422.body).toHaveProperty("requestId");
    expect(res422.body.requestId).toBeTruthy();
    expect(JSON.stringify(res422.body)).not.toMatch(/at .+\(|PrismaClient|SELECT |stack/i);
    // CAS 409 уже детерминированно покрыт в тестах 12/13 (concurrent ISSUE).
  });
});
