/**
 * E2E PHASE 2 STEP 2.3B — Payment Terms / Payment Scheme Foundation (§43).
 *
 * Покрывает:
 *  1. anonymous 401; 2. unauthorized roles 403; 3. SALES_MANAGER can set;
 *  4. DIRECTOR read-only matrix; 5. FULL_PREPAYMENT; 6. PARTIAL percentage;
 *  7. PARTIAL fixed; 8. DEPOSIT; 9. PAY_LATER; 10. PAY_AT_SERVICE;
 *  11. derived fields forged → 422; 12. Decimal reconciliation;
 *  13. stale CAS → 409; 14. concurrent updates → one winner;
 *  15. cancelled Checkout immutable; 16. history; 17. audit no PII;
 *  18. existing Checkout no terms → null (migration legacy proof);
 *  19. no Order/Booking/Payment; 20. no OrderRequested; 21. Sale remains OPEN;
 *  22. availability still not reserved; 23. acquisitionSource unchanged;
 *  24. requestId/error envelope.
 *  Доп. §50: 13b. terms vs cancel race; 13c. terms vs travelers/serviceDate race;
 *  13d. quote expiry + catalog reprice (frozen total); 13e. failure →
 *  no history/audit/outbox rows (failure atomicity).
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

interface PaymentTermsBody {
  scheme: string;
  prepaymentType?: string;
  prepaymentValue?: string;
  expectedVersion: number;
}

describe("Phase 2 Step 2.3B — Payment Terms / Payment Scheme Foundation (e2e)", () => {
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
    auditLogs: string[];
  } = { users: [], customers: [], products: [], quotes: [], checkouts: [], sales: [], auditLogs: [] };

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

  const createProduct = async (tag: string, price = 100): Promise<ProductFixture> => {
    const res = await adminAgent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `PT ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: product.id } });
    return { productId: product.id, tariffId: tariff.id, tariffPrice: String(tariff.price) };
  };

  /** ISSUED Quote + CheckoutIntent (без payment terms). */
  const makeIntent = async (smToken: string, fx: ProductFixture, qty = 1): Promise<{ id: string; code: string; version: number; total: string; currency: string }> => {
    const quote = (await agent(smToken).post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: fx.productId, tariffId: fx.tariffId, quantity: qty }).expect(201);
    await agent(smToken)
      .put(`/api/v1/sales/quotes/${quote.code}/commercial`)
      .send({ discountType: "NONE", validUntil: new Date(Date.now() + 30 * 86400000).toISOString() })
      .expect(200);
    await agent(smToken).post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);

    const intent = (await agent(smToken).post("/api/v1/sales/checkouts").send({ quoteId: quote.id }).expect(201)).body as {
      id: string;
      code: string;
      version: number;
      total: string;
      currency: string;
    };
    created.checkouts.push(intent.id);
    return intent;
  };

  const setTerms = (token: string, code: string, body: PaymentTermsBody) => agent(token).put(`/api/v1/sales/checkouts/${code}/payment-terms`).send(body);

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
    for (const id of created.checkouts) {
      await prisma.checkoutIntentHistory.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntentTraveler.deleteMany({ where: { checkoutIntentId: id } });
      await prisma.checkoutIntent.deleteMany({ where: { id } });
    }
    await prisma.saleHistory.deleteMany({ where: { saleId: { in: created.sales } } });
    await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1-2. Auth / RBAC ──────────────────────────────────────────────────────

  it("1. anonymous → 401 на payment-terms endpoint", async () => {
    const anon = request(app.getHttpServer());
    await anon.put("/api/v1/sales/checkouts/CKT-00000001/payment-terms").send({ scheme: "FULL_PREPAYMENT", expectedVersion: 1 }).expect(401);
  });

  it("2. не-владельцы → 403 (BUYER/PARTNER/MODERATOR/ANALYST/MARKETER/FINANCE/OPERATOR)", async () => {
    const sm = await createStaff("pt_rbac", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_rbac", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    const buyer = await registerBuyer("pt_buyer");
    const partner = await createStaff("pt_partner", RoleCode.PARTNER, "partnerpass123");
    const mod = await createStaff("pt_mod", RoleCode.MODERATOR);
    const analyst = await createStaff("pt_analyst", RoleCode.ANALYST);
    const marketer = await createStaff("pt_marketer", RoleCode.MARKETER);
    const finance = await createStaff("pt_fin", RoleCode.FINANCE);
    const operator = await createStaff("pt_op", RoleCode.OPERATOR);

    for (const who of [buyer, partner, mod, analyst, marketer, finance, operator]) {
      await setTerms(who.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(403);
    }
  });

  it("3-4. SALES_MANAGER can set; DIRECTOR read-only (read 200, write 403)", async () => {
    const sm = await createStaff("pt_sm", RoleCode.SALES_MANAGER);
    const director = await createStaff("pt_dir", RoleCode.DIRECTOR);
    const fx = await createProduct("pt_sm", 200);
    const intent = await makeIntent(sm.accessToken, fx);

    const ok = (await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(ok.paymentTerms).toMatchObject({ scheme: "FULL_PREPAYMENT", initialAmount: "200", remainingAmount: "0" });

    // DIRECTOR: read (detail) — 200; write — 403.
    await agent(director.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200);
    await setTerms(director.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 2 }).expect(403);
  });

  // ── 5-10. Schemes ─────────────────────────────────────────────────────────

  it("5. FULL_PREPAYMENT: initial = total, remaining = 0, без параметров; параметры → 422", async () => {
    const sm = await createStaff("pt_full", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_full", 150.5);
    const intent = await makeIntent(sm.accessToken, fx);

    const r = (await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { scheme: string; prepaymentType: null; prepaymentValue: null; initialAmount: string; remainingAmount: string };
    };
    expect(r.paymentTerms).toMatchObject({ scheme: "FULL_PREPAYMENT", prepaymentType: null, prepaymentValue: null, initialAmount: "150.5", remainingAmount: "0" });

    // Параметры запрещены (forbidden semantics).
    await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "10", expectedVersion: 2 }).expect(422);
    // Валидный результат неизменен после 422 (failure atomicity).
    const after = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(after.paymentTerms.scheme).toBe("FULL_PREPAYMENT");
  });

  it("6. PARTIAL_PREPAYMENT percentage: 30% → initial/remaining; границы 0/100 → 422", async () => {
    const sm = await createStaff("pt_pct", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_pct", 99.99);
    const intent = await makeIntent(sm.accessToken, fx, 2); // total 199.98

    const r = (await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "30", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { scheme: string; prepaymentType: string; prepaymentValue: string; initialAmount: string; remainingAmount: string };
    };
    // 199.98 * 0.30 = 59.994 → half-up 59.99; remaining 199.98 - 59.99 = 139.99.
    expect(r.paymentTerms).toMatchObject({ scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "30", initialAmount: "59.99", remainingAmount: "139.99" });

    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "0", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "100", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "100.01", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "abc", expectedVersion: 2 }).expect(422);
  });

  it("7. PARTIAL_PREPAYMENT fixed: 40 от total; ==total / >total / 0 → 422", async () => {
    const sm = await createStaff("pt_fxd", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_fxd", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    const r = (await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "FIXED", prepaymentValue: "40", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { prepaymentType: string; prepaymentValue: string; initialAmount: string; remainingAmount: string };
    };
    expect(r.paymentTerms).toMatchObject({ prepaymentType: "FIXED", prepaymentValue: "40", initialAmount: "40", remainingAmount: "60" });

    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "FIXED", prepaymentValue: "0", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "FIXED", prepaymentValue: "100", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "FIXED", prepaymentValue: "150", expectedVersion: 2 }).expect(422);
    // Без prepaymentType/Value.
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", expectedVersion: 2 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "FIXED", expectedVersion: 2 }).expect(422);
  });

  it("8. DEPOSIT: часть total (FIXED и PERCENTAGE); remaining = total - deposit", async () => {
    const sm = await createStaff("pt_dep", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_dep", 300);
    const intent = await makeIntent(sm.accessToken, fx);

    const fixed = (await setTerms(sm.accessToken, intent.code, { scheme: "DEPOSIT", prepaymentType: "FIXED", prepaymentValue: "90", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(fixed.paymentTerms).toMatchObject({ scheme: "DEPOSIT", initialAmount: "90", remainingAmount: "210" });

    const pct = (await setTerms(sm.accessToken, intent.code, { scheme: "DEPOSIT", prepaymentType: "PERCENTAGE", prepaymentValue: "30", expectedVersion: 2 }).expect(200)).body as {
      paymentTerms: { initialAmount: string; remainingAmount: string };
    };
    expect(pct.paymentTerms).toMatchObject({ initialAmount: "90", remainingAmount: "210" });

    await setTerms(sm.accessToken, intent.code, { scheme: "DEPOSIT", prepaymentType: "FIXED", prepaymentValue: "0", expectedVersion: 3 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "DEPOSIT", prepaymentType: "FIXED", prepaymentValue: "300", expectedVersion: 3 }).expect(422);
  });

  it("9-10. PAY_LATER / PAY_AT_SERVICE: initial 0, remaining = total; параметры → 422", async () => {
    const sm = await createStaff("pt_later", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_later", 250.5);
    const intent = await makeIntent(sm.accessToken, fx);

    const later = (await setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(later.paymentTerms).toMatchObject({ scheme: "PAY_LATER", initialAmount: "0", remainingAmount: "250.5" });

    const atService = (await setTerms(sm.accessToken, intent.code, { scheme: "PAY_AT_SERVICE", expectedVersion: 2 }).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(atService.paymentTerms).toMatchObject({ scheme: "PAY_AT_SERVICE", initialAmount: "0", remainingAmount: "250.5" });

    await setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", prepaymentType: "PERCENTAGE", prepaymentValue: "10", expectedVersion: 3 }).expect(422);
    await setTerms(sm.accessToken, intent.code, { scheme: "PAY_AT_SERVICE", prepaymentType: "FIXED", prepaymentValue: "10", expectedVersion: 3 }).expect(422);
  });

  // ── 11-12. Forged / reconciliation ────────────────────────────────────────

  it("11. derived amounts forged → 422 (frontend не источник денег)", async () => {
    const sm = await createStaff("pt_forge", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_forge", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    for (const extra of [
      { initialAmount: "1.00" },
      { remainingAmount: "1.00" },
      { total: "1.00" },
      { currency: "EUR" },
      { paidAmount: "10" },
      { paymentStatus: "PAID" },
      { orderId: "ord-x" },
      { paymentId: "pay-x" },
      { pspReference: "psp-x" },
      { dueAt: "2026-01-01T00:00:00.000Z" },
    ]) {
      await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 1, ...extra }).expect(422);
    }
  });

  it("12. Decimal reconciliation: initial + remaining == total (awkward 199.98 / 33.33%)", async () => {
    const sm = await createStaff("pt_recon", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_recon", 99.99);
    const intent = await makeIntent(sm.accessToken, fx, 3); // total 299.97

    const r = (await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "33.33", expectedVersion: 1 }).expect(200)).body as {
      paymentTerms: { initialAmount: string; remainingAmount: string };
    };
    const { initialAmount, remainingAmount } = r.paymentTerms;
    const sum = new Prisma.Decimal(initialAmount).plus(new Prisma.Decimal(remainingAmount));
    expect(sum.toString()).toBe("299.97");
  });

  // ── 13-15. CAS / cancel ───────────────────────────────────────────────────

  it("13. stale expectedVersion → 409; concurrent updates → ровно один успех", async () => {
    const sm = await createStaff("pt_cas", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_cas", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 99 }).expect(409);
    await setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 99 }).expect(409);

    const results = await Promise.allSettled([
      setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "30", expectedVersion: 1 }),
      setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 1 }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
  });

  // ── 13b-13e. Races / expiry / failure atomicity (§50) ─────────────────────

  it("13b. terms vs cancel race → ровно один победитель (CAS)", async () => {
    const sm = await createStaff("pt_rc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_rc", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    const results = await Promise.allSettled([
      setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 1 }),
      agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: 1 }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    const codes = statuses.filter((s): s is number => typeof s === "number");
    expect(codes.filter((s) => s >= 200 && s < 300)).toHaveLength(1);
    expect(codes.filter((s) => s === 409 || s === 422)).toHaveLength(1);

    // Финал консистентен: либо CANCELLED без terms, либо ACTIVE с terms.
    const d = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as {
      status: string;
      paymentTerms: unknown;
    };
    if (d.status === "CANCELLED") expect(d.paymentTerms).toBeNull();
    else expect((d.paymentTerms as { scheme: string }).scheme).toBe("FULL_PREPAYMENT");
  });

  it("13c. terms vs travelers / serviceDate race → ровно один победитель (CAS)", async () => {
    const futureDate = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const sm = await createStaff("pt_rt", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_rt", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    // terms vs travelers (одинаковый expectedVersion) → один 200, один 409.
    const travelerRace = await Promise.allSettled([
      setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 1 }),
      agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/travelers`).send({ travelers: [{ firstName: "A", lastName: "B" }], expectedVersion: 1 }),
    ]);
    const tStatuses = travelerRace.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(tStatuses.filter((s) => s === 200)).toHaveLength(1);
    expect(tStatuses.filter((s) => s === 409)).toHaveLength(1);

    // terms vs serviceDate → один 200, один 409 (версия уже 2 после первого раунда).
    const sdRace = await Promise.allSettled([
      setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 2 }),
      agent(sm.accessToken).put(`/api/v1/sales/checkouts/${intent.code}/service-date`).send({ serviceDate: futureDate(), expectedVersion: 2 }),
    ]);
    const sdStatuses = sdRace.map((r) => (r.status === "fulfilled" ? r.value.status : "rejected"));
    expect(sdStatuses.filter((s) => s === 200)).toHaveLength(1);
    expect(sdStatuses.filter((s) => s === 409)).toHaveLength(1);
  });

  it("13d. quote expires после Checkout → terms мутация допустима; catalog reprice не влияет (frozen total)", async () => {
    const sm = await createStaff("pt_exp", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_exp", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    // Эмуляция expiry после Checkout creation (policy §12: quoteExpired НЕ блокирует
    // terms mutation — Checkout ACTIVE; влияет только на future Sale completion 2.4).
    const row = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
    await prisma.quote.update({ where: { id: row.quoteId }, data: { validUntil: new Date(Date.now() - 1000) } });

    const before = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { quoteExpired: boolean };
    expect(before.quoteExpired).toBe(true);

    // Terms всё ещё ставится, frozen total = authoritative (не reprice).
    const r = (await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200)).body as {
      paymentTerms: { scheme: string; initialAmount: string; remainingAmount: string };
    };
    expect(r.paymentTerms).toMatchObject({ scheme: "FULL_PREPAYMENT", initialAmount: "100", remainingAmount: "0" });

    // Catalog price change после Checkout: total Checkout неизменен (frozen snapshot).
    await prisma.tariff.update({ where: { id: fx.tariffId }, data: { price: new Prisma.Decimal("999") } });
    const after = (await setTerms(sm.accessToken, intent.code, { scheme: "PAY_LATER", expectedVersion: 2 }).expect(200)).body as {
      paymentTerms: { initialAmount: string; remainingAmount: string };
    };
    expect(after.paymentTerms).toMatchObject({ initialAmount: "0", remainingAmount: "100" });
  });

  it("13e. failure (422/409) → никаких history/audit/outbox строк (§50.9)", async () => {
    const sm = await createStaff("pt_fa", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_fa", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    const histBefore = await prisma.checkoutIntentHistory.count({ where: { checkoutIntentId: intent.id } });
    const auditBefore = await prisma.auditLog.count({ where: { resource: "CheckoutIntent", resourceId: intent.id } });
    const outboxBefore = await prisma.outboxEvent.count({
      where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } },
    });

    // 422 — до транзакции (computePaymentTerms бросает до CAS) — ничего не пишется.
    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "0", expectedVersion: 1 }).expect(422);
    // 409 — CAS внутри tx: updateMany.count === 0 → ConflictError, tx rollback.
    await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 99 }).expect(409);

    expect(await prisma.checkoutIntentHistory.count({ where: { checkoutIntentId: intent.id } })).toBe(histBefore);
    expect(await prisma.auditLog.count({ where: { resource: "CheckoutIntent", resourceId: intent.id } })).toBe(auditBefore);
    expect(await prisma.outboxEvent.count({
      where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } },
    })).toBe(outboxBefore);

    // CAS-версия не сдвинулась после failures (нет частичных side effects).
    const row = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.version).toBe(intent.version);
    expect(row.paymentScheme).toBeNull();
  });

  it("14. cancelled Checkout immutable: payment-terms после cancel → 422", async () => {
    const sm = await createStaff("pt_canc", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_canc", 100);
    const intent = await makeIntent(sm.accessToken, fx);

    await agent(sm.accessToken).post(`/api/v1/sales/checkouts/${intent.code}/cancel`).send({ expectedVersion: intent.version }).expect(201);
    await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 2 }).expect(422);
  });

  // ── 15-17. History / audit ────────────────────────────────────────────────

  it("15-16. history payment_terms_changed без PII; audit без PII/body", async () => {
    const sm = await createStaff("pt_hist", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_hist", 120);
    const intent = await makeIntent(sm.accessToken, fx);

    await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "25", expectedVersion: 1 }).expect(200);
    await setTerms(sm.accessToken, intent.code, { scheme: "PAY_AT_SERVICE", expectedVersion: 2 }).expect(200);

    const hist = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}/history`).expect(200)).body as { items: Array<{ action: string }> };
    expect(hist.items.map((h) => h.action)).toEqual(["created", "payment_terms_changed", "payment_terms_changed"]);

    const audit = await prisma.auditLog.findMany({ where: { resource: "CheckoutIntent", resourceId: intent.id, action: "sales.checkout.payment_terms_changed" } });
    expect(audit).toHaveLength(2);
    for (const a of audit) {
      const raw = JSON.stringify(a.details ?? {});
      expect(raw).not.toContain("Иванов");
      expect(raw).not.toContain("email");
      created.auditLogs.push(a.id);
    }
  });

  // ── 17-18. Legacy / null semantics ────────────────────────────────────────

  it("17-18. existing Checkout без terms → paymentTerms null (no fake backfill)", async () => {
    const sm = await createStaff("pt_null", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_null", 80);
    const intent = await makeIntent(sm.accessToken, fx);

    // Свежесозданный intent (до любого set-terms): paymentTerms = null.
    const detail = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { paymentTerms: unknown };
    expect(detail.paymentTerms).toBeNull();

    // DB row честно пустой (не «случайная дефолтная схема»).
    const row = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.paymentScheme).toBeNull();
    expect(row.initialAmount).toBeNull();
    expect(row.remainingAmount).toBeNull();
  });

  // ── 19-23. Isolation ──────────────────────────────────────────────────────

  it("19-23. изоляция: нет Order/Booking/Payment/OrderRequested; Sale OPEN; availability не резервируется; source неизменен", async () => {
    const sm = await createStaff("pt_iso", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_iso", 90);
    const intent = await makeIntent(sm.accessToken, fx);

    const ordersBefore = await prisma.order.count();
    const bookingsBefore = await prisma.booking.count();
    const outboxBefore = await prisma.outboxEvent.count({ where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } } });

    await setTerms(sm.accessToken, intent.code, { scheme: "DEPOSIT", prepaymentType: "PERCENTAGE", prepaymentValue: "30", expectedVersion: 1 }).expect(200);

    expect(await prisma.order.count()).toBe(ordersBefore);
    expect(await prisma.booking.count()).toBe(bookingsBefore);
    const outboxAfter = await prisma.outboxEvent.count({ where: { eventType: { in: ["OrderRequested", "OrderCreated", "BookingRequested", "BookingCreated"] } } });
    expect(outboxAfter).toBe(outboxBefore);

    // Sale остаётся OPEN.
    const sale = (await agent(sm.accessToken).post("/api/v1/sales/sales").send({ quoteId: (await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } })).quoteId }).expect(201)).body as {
      id: string;
      status: string;
    };
    created.sales.push(sale.id);
    expect(sale.status).toBe("OPEN");

    // Availability не резервируется (для продукта строка capacity не создаётся).
    expect(await prisma.availability.count({ where: { productId: fx.productId } })).toBe(0);

    // acquisitionSource неизменен (DIRECT server-derived).
    const d = (await agent(sm.accessToken).get(`/api/v1/sales/checkouts/${intent.code}`).expect(200)).body as { acquisitionSource: string };
    expect(d.acquisitionSource).toBe("DIRECT");
  });

  // ── 24. Error envelope ────────────────────────────────────────────────────

  it("24. requestId/error envelope: 404/409/422 без stack/Prisma", async () => {
    const sm = await createStaff("pt_err", RoleCode.SALES_MANAGER);
    const fx = await createProduct("pt_err", 70);
    const intent = await makeIntent(sm.accessToken, fx);

    const notFound = (await setTerms(sm.accessToken, "CKT-99999999", { scheme: "FULL_PREPAYMENT", expectedVersion: 1 }).expect(404)).body as { requestId?: string };
    expect(notFound.requestId).toBeTruthy();

    const invalid = (await setTerms(sm.accessToken, intent.code, { scheme: "PARTIAL_PREPAYMENT", prepaymentType: "PERCENTAGE", prepaymentValue: "0", expectedVersion: 1 }).expect(422)).body as {
      requestId?: string;
    };
    expect(invalid.requestId).toBeTruthy();

    const conflict = (await setTerms(sm.accessToken, intent.code, { scheme: "FULL_PREPAYMENT", expectedVersion: 99 }).expect(409)).body as { requestId?: string };
    expect(conflict.requestId).toBeTruthy();

    for (const b of [notFound, invalid, conflict]) {
      expect(JSON.stringify(b)).not.toMatch(/PrismaClient|at Object\\.|at .*\\.js:/);
    }
  });
});
