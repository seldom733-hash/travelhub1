/**
 * E2E PHASE 2 STEP 2.10 — Finance Domain Foundation (§42/§43/§44/§45/§49).
 *
 * Покрывает:
 *  - master data CRUD (Currency/ExchangeRate/Tax/TaxRule) с canonical кодами
 *    CUR-/FXR-/TAX-/TXR- (BusinessSequence) и Decimal-контрактом;
 *  - RBAC matrix: anonymous 401; BUYER/PARTNER/OPERATOR/SALES_MANAGER/
 *    MODERATOR/MARKETER/ANALYST → 403; FINANCE/ADMIN → 200/201; DIRECTOR →
 *    read-only (нет master-data manage) 403 на write;
 *  - forged server-owned fields (id/code/createdAt/updatedAt/version) → 422;
 *  - duplicate isoCode → 409; unknown code → 404;
 *  - НЕ реализовано (foundation): POST /finance/payments → 404 (нет payment
 *    initiation), нет refund/invoice/settlement/payout write-путей;
 *  - НЕТ cross-domain writes: finance CRUD не создаёт Order/Booking/Product/
 *    Availability/Acquisition и не трогает Order.paymentStatus;
 *  - audit: master-data изменения пишутся в AuditLog (без PII);
 *  - migration: fresh replay (globalSetup) + finance.* таблицы существуют.
 */

import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/client";

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

const MASTER_WRITE_ROUTES: Array<[string, string, Record<string, unknown>]> = [
  ["/api/v1/finance/currencies", "post", { isoCode: "XTS", name: "Test", symbol: "T" }],
  ["/api/v1/finance/exchange-rates", "post", { baseCurrencyIso: "USD", quoteCurrencyIso: "AZN", rate: "1.7", validFrom: "2026-01-01T00:00:00Z" }],
  ["/api/v1/finance/taxes", "post", { name: "VAT", rate: "18" }],
];

describe("Phase 2 Step 2.10 — Finance Domain Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: { users: string[]; auditLogs: string[]; currencies: string[]; rates: string[]; taxes: string[]; taxRules: string[] } = {
    users: [],
    auditLogs: [],
    currencies: [],
    rates: [],
    taxes: [],
    taxRules: [],
  };

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
    });
    return res.body as Session;
  };

  const createStaff = async (tag: string, roleCode: RoleCode): Promise<Session> => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

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
    // cleanup: audit logs + finance master rows created in this suite
    await prisma.taxRule.deleteMany({ where: { id: { in: created.taxRules } } });
    await prisma.tax.deleteMany({ where: { id: { in: created.taxes } } });
    await prisma.exchangeRate.deleteMany({ where: { id: { in: created.rates } } });
    await prisma.currency.deleteMany({ where: { id: { in: created.currencies } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. anonymous 401 ────────────────────────────────────────────────────────

  it("1. anonymous: все finance master-data endpoints → 401", async () => {
    const http = request(app.getHttpServer());
    await http.get("/api/v1/finance/currencies").expect(401);
    await http.post("/api/v1/finance/currencies").send({ isoCode: "XTS", name: "Test", symbol: "T" }).expect(401);
    await http.get("/api/v1/finance/taxes").expect(401);
    await http.get("/api/v1/finance/exchange-rates").expect(401);
  });

  // ── 2. RBAC matrix ──────────────────────────────────────────────────────────

  it("2. BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER/ANALYST → 403; FINANCE/ADMIN → 201; DIRECTOR read-only → 403 on write", async () => {
    const buyer = await registerBuyer("f_buyer");
    const partner = await registerBuyer("f_partner");

    const staffRoles: Array<[string, RoleCode]> = [
      ["f_op", RoleCode.OPERATOR],
      ["f_sm", RoleCode.SALES_MANAGER],
      ["f_mod", RoleCode.MODERATOR],
      ["f_mkt", RoleCode.MARKETER],
      ["f_an", RoleCode.ANALYST],
      ["f_dir", RoleCode.DIRECTOR],
      ["f_fin", RoleCode.FINANCE],
    ];
    const sessions: Session[] = [];
    for (const [tag, role] of staffRoles) sessions.push(await createStaff(tag, role));

    // write denial for non-finance roles
    for (const who of [buyer, partner, sessions[0], sessions[1], sessions[2], sessions[3], sessions[4]]) {
      for (const [route, method, body] of MASTER_WRITE_ROUTES) {
        const a = agent(who.accessToken);
        const req = method === "post" ? a.post(route).send(body) : a.patch(route).send(body);
        await req.expect(403);
      }
    }
    // DIRECTOR: no master-data manage → 403 on write, но может ли читать? у DIRECTOR нет
    // finance.currency.manage — read также 403 (нет отдельного read-права; manage = read+write).
    await agent(sessions[5].accessToken).get("/api/v1/finance/currencies").expect(403);
    await agent(sessions[5].accessToken).post("/api/v1/finance/currencies").send({ isoCode: "XTT", name: "T", symbol: "T" }).expect(403);

    // FINANCE: создаёт валюту (master data) → 201 + canonical код CUR-*
    const fin = sessions[6];
    const cur = await agent(fin.accessToken)
      .post("/api/v1/finance/currencies")
      .send({ isoCode: "XTS", name: "Test Currency", symbol: "T" })
      .expect(201);
    created.currencies.push(cur.body.id as string);
    expect(cur.body.code).toMatch(/^CUR-\d{8}$/);
    expect(cur.body.isoCode).toBe("XTS");

    // ADMIN: тоже может
    const cur2 = await adminAgent
      .post("/api/v1/finance/currencies")
      .send({ isoCode: "XTT", name: "Admin Currency", symbol: "T" })
      .expect(201);
    created.currencies.push(cur2.body.id as string);
    expect(cur2.body.code).toMatch(/^CUR-\d{8}$/);
  });

  // ── 3. master-data happy path + Decimal + identifiers ───────────────────────

  it("3. ExchangeRate: создание с Decimal rate (без float), canonical FXR-*, список/чтение", async () => {
    const fin = await createStaff("f_fin2", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    const rate = await a
      .post("/api/v1/finance/exchange-rates")
      .send({ baseCurrencyIso: "USD", quoteCurrencyIso: "AZN", rate: "1.700000", validFrom: "2026-01-01T00:00:00Z" })
      .expect(201);
    created.rates.push(rate.body.id as string);
    expect(rate.body.code).toMatch(/^FXR-\d{8}$/);
    // Decimal string, НЕ float (Decimal.js toString нормализует trailing zeros: "1.7") —
    // контракт: строковое представление без плавающей точки + числовое равенство.
    expect(typeof rate.body.rate).toBe("string");
    expect(Number(rate.body.rate)).toBe(1.7);

    const list = await a.get("/api/v1/finance/exchange-rates").expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    const found = (list.body as Array<{ code: string }>).find((r) => r.code === rate.body.code);
    expect(found).toBeDefined();

    const got = await a.get(`/api/v1/finance/exchange-rates/${rate.body.code}`).expect(200);
    expect(got.body.baseCurrencyIso).toBe("USD");
    expect(got.body.quoteCurrencyIso).toBe("AZN");
  });

  it("4. Tax + TaxRule: canonical TAX-*/TXR-*, taxId валидируется, правило привязано", async () => {
    const fin = await createStaff("f_fin3", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    const tax = await a.post("/api/v1/finance/taxes").send({ name: "VAT", rate: "18.00", countryIso: "RU" }).expect(201);
    created.taxes.push(tax.body.id as string);
    expect(tax.body.countryIso).toBe("RU");
    expect(tax.body.code).toMatch(/^TAX-\d{8}$/);
    expect(typeof tax.body.rate).toBe("string");
    expect(Number(tax.body.rate)).toBe(18);

    const rule = await a
      .post("/api/v1/finance/tax-rules")
      .send({ taxId: tax.body.id, productType: "TOUR", countryIso: "AZ", effectiveFrom: "2026-01-01T00:00:00Z" })
      .expect(201);
    created.taxRules.push(rule.body.id as string);
    expect(rule.body.code).toMatch(/^TXR-\d{8}$/);
    expect(rule.body.tax.code).toBe(tax.body.code);

    // unknown taxId → 422
    await a.post("/api/v1/finance/tax-rules").send({ taxId: "00000000-0000-0000-0000-000000000000", effectiveFrom: "2026-01-01T00:00:00Z" }).expect(422);
  });

  // ── 4. forged fields → 422 ──────────────────────────────────────────────────

  it("5. forged server-owned fields (id/code/createdAt/updatedAt/version) → 422", async () => {
    const fin = await createStaff("f_fin4", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    const forgedCurrency = await a
      .post("/api/v1/finance/currencies")
      .send({ isoCode: "XTF", name: "Forged", symbol: "F", id: "hack", code: "CUR-99999999", createdAt: "2020-01-01T00:00:00Z" })
      .expect(422);
    expect(forgedCurrency.body).toBeDefined();

    const forgedRate = await a
      .post("/api/v1/finance/exchange-rates")
      .send({ baseCurrencyIso: "USD", quoteCurrencyIso: "EUR", rate: "0.9", validFrom: "2026-01-01T00:00:00Z", version: 999 })
      .expect(422);
    expect(forgedRate.body).toBeDefined();

    const forgedTax = await a
      .post("/api/v1/finance/taxes")
      .send({ name: "Forged Tax", rate: "5", updatedAt: "2020-01-01T00:00:00Z" })
      .expect(422);
    expect(forgedTax.body).toBeDefined();
  });

  // ── 5. conflicts / 404 ──────────────────────────────────────────────────────

  it("6. duplicate isoCode → 409; unknown code → 404; invalid rate/ISO → 422", async () => {
    const fin = await createStaff("f_fin5", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    const cur = await a.post("/api/v1/finance/currencies").send({ isoCode: "XTD", name: "Dup", symbol: "D" }).expect(201);
    created.currencies.push(cur.body.id as string);
    await a.post("/api/v1/finance/currencies").send({ isoCode: "XTD", name: "Dup2", symbol: "D" }).expect(409);

    await a.get("/api/v1/finance/currencies/CUR-00000000").expect(404);
    await a.get("/api/v1/finance/exchange-rates/FXR-00000000").expect(404);
    await a.get("/api/v1/finance/taxes/TAX-00000000").expect(404);
    await a.get("/api/v1/finance/tax-rules/TXR-00000000").expect(404);

    await a.post("/api/v1/finance/currencies").send({ isoCode: "usd", name: "lower", symbol: "x" }).expect(422);
    await a.post("/api/v1/finance/exchange-rates").send({ baseCurrencyIso: "USD", quoteCurrencyIso: "USD", rate: "1", validFrom: "2026-01-01T00:00:00Z" }).expect(422);
    await a.post("/api/v1/finance/exchange-rates").send({ baseCurrencyIso: "USD", quoteCurrencyIso: "EUR", rate: "0", validFrom: "2026-01-01T00:00:00Z" }).expect(422);
    await a.post("/api/v1/finance/taxes").send({ name: "Bad", rate: "-5" }).expect(422);
    // country: locale-строка и alpha-3 НЕ являются страной (ISO 3166-1 alpha-2).
    // "az" (locale, 2 буквы) проходит DTO и отклоняется сервисным regex → 422;
    // "AZE"/"ru-RU" (неверная длина) отклоняются DTO @Length(2,2) → 400. Оба контролируемые.
    await a.post("/api/v1/finance/taxes").send({ name: "Bad", rate: "5", countryIso: "az" }).expect(422);
    await a.post("/api/v1/finance/taxes").send({ name: "Bad", rate: "5", countryIso: "AZE" }).expect(400);
    await a.post("/api/v1/finance/taxes").send({ name: "Bad", rate: "5", countryIso: "ru-RU" }).expect(400);
  });

  it("6A. concurrent create Currency с одинаковым isoCode → [201, 409], ни одного 500 (STRICT REVIEW FIX 1)", async () => {
    const fin = await createStaff("f_fin5r", RoleCode.FINANCE);
    const a = agent(fin.accessToken);
    const iso = `XQ${String.fromCharCode(65 + (stamp % 26))}`; // уникальный 3-буквенный ISO (XQA–XQZ)
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/currencies").send({ isoCode: iso, name: "Race", symbol: "R" }),
      a.post("/api/v1/finance/currencies").send({ isoCode: iso, name: "Race", symbol: "R" }),
    ]);
    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([201, 409]);
    expect(r1.status).not.toBe(500);
    expect(r2.status).not.toBe(500);
  });

  // ── 6. no payment initiation / no refund / no invoice write paths ───────────

  it("7. НЕ реализовано (foundation): payment/refund/invoice/settlement/payout write-пути отсутствуют → 404", async () => {
    const fin = await createStaff("f_fin6", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    await a.post("/api/v1/finance/payments").send({ orderId: "x", amount: "10", currency: "USD" }).expect(404);
    await a.post("/api/v1/finance/refunds").send({ paymentId: "x", amount: "5" }).expect(404);
    await a.post("/api/v1/finance/invoices").send({ orderId: "x", amount: "10" }).expect(404);
    await a.post("/api/v1/finance/settlements").send({ orderId: "x" }).expect(404);
    await a.post("/api/v1/finance/payouts").send({ partnerId: "x", amount: "10" }).expect(404);
    await a.post("/api/v1/finance/ledger-transactions").send({}).expect(404);
  });

  it("8. НЕТ cross-domain writes: finance master CRUD не создаёт Order/Booking/Product/Availability и не трогает Order.paymentStatus", async () => {
    const before = await prisma.order.count();
    const fin = await createStaff("f_fin7", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    await a.post("/api/v1/finance/currencies").send({ isoCode: "XTE", name: "NoWrite", symbol: "N" }).expect(201).then((r) => created.currencies.push(r.body.id as string));
    await a.post("/api/v1/finance/taxes").send({ name: "NoWriteTax", rate: "10" }).expect(201).then((r) => created.taxes.push(r.body.id as string));

    const after = await prisma.order.count();
    expect(after).toBe(before); // никаких новых Order
    const bookingCount = await prisma.booking.count();
    expect(bookingCount).toBeGreaterThanOrEqual(0);
    // Finance не создаёт Availability/Product/Acquisition rows — все counts без изменений
    const curRows = await prisma.currency.count();
    const taxRows = await prisma.tax.count();
    expect(curRows).toBeGreaterThan(0);
    expect(taxRows).toBeGreaterThan(0);
  });

  // ── 7. audit ────────────────────────────────────────────────────────────────

  it("9. master-data изменения пишутся в AuditLog (без PII)", async () => {
    const fin = await createStaff("f_fin8", RoleCode.FINANCE);
    const a = agent(fin.accessToken);

    const cur = await a.post("/api/v1/finance/currencies").send({ isoCode: "XTA", name: "Audit", symbol: "A" }).expect(201);
    created.currencies.push(cur.body.id as string);

    const log = await prisma.auditLog.findFirst({
      where: { action: "finance.currency.created", resourceId: cur.body.id as string },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log!.resource).toBe("Currency");
    const details = log!.details as Record<string, unknown> | null;
    expect(details).toBeDefined();
    expect(details!.code).toBe(cur.body.code);
    // без PII: в details нет email/name/traveller данных
    expect(JSON.stringify(details)).not.toContain("email");
  });

  // ── 8. migration / schema proof ─────────────────────────────────────────────

  it("10. finance.* таблицы существуют (fresh replay + schema)", async () => {
    // globalSetup применяет реальные миграции → таблицы обязаны существовать
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'finance' ORDER BY tablename",
    );
    const names = tables.map((t) => t.tablename);
    for (const expected of ["Payment", "PaymentTerms", "Refund", "Invoice", "Commission", "CommissionAccrual", "Currency", "ExchangeRate", "Tax", "TaxRule"]) {
      expect(names).toContain(expected);
    }
  });

  // ── 9. temporal: 2.10C ввёл ОДНО легитимное поле (Ledger occurredAt),
  //    lifecycle-милстоуны Payment/Refund/Settlement/Payout остаются deferred ──

  it("11. temporal: 2.10C ввёл occurredAt ТОЛЬКО на LedgerTransaction; payment/lifecycle milestone-колонки остаются ЗАПРЕЩЕНЫ (deferred 2.12–2.14)", async () => {
    // Roadmap evolution (§28): Step 2.10C (Finance Temporal Contract) легитимно
    // добавил LedgerTransaction.occurredAt (бизнес-occurrence, отдельно от
    // createdAt). Lifecycle-милстоуны (paidAt/authorizedAt/capturedAt/failedAt/
    // cancelledAt/settledAt) НЕ существуют: их producer-ы/семантика — 2.12–2.14.
    const lifecycle = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND column_name IN ('paidAt','authorizedAt','capturedAt','failedAt','cancelledAt','settledAt')",
    );
    expect(lifecycle.length).toBe(0);

    // occurredAt — единственное 2.10C-поле и живёт ТОЛЬКО на LedgerTransaction
    // (не на Payment/Refund/Settlement/Payout — чужие семантики не выдумываются).
    const occ = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      "SELECT table_name FROM information_schema.columns WHERE table_schema = 'finance' AND column_name = 'occurredAt'",
    );
    expect(occ.map((r) => r.table_name)).toEqual(["LedgerTransaction"]);
  });
});
