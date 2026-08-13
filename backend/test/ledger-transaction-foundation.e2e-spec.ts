/**
 * PHASE 2 STEP 2.10A — LedgerTransaction Foundation (e2e).
 *
 * Доказывает (независимо от unit):
 *  - migration (finance.LedgerTransaction существует на fresh replay);
 *  - RBAC read (finance.ledger.read): anonymous 401; BUYER/PARTNER/OPERATOR/
 *    SALES_MANAGER/MODERATOR/MARKETER 403; FINANCE/ADMIN/DIRECTOR/ANALYST 200;
 *  - canonical LTX-######## + Decimal + currency authority (finance.Currency);
 *  - immutability: нет POST/PATCH/DELETE write-путей (404), нет updatedAt;
 *  - idempotency: replay одного source fact → одна запись (no-op);
 *  - concurrency: параллельный duplicate → одна запись, без 500;
 *  - correlation/causation/actor — server-authoritative (runWithRequestContext);
 *  - audit (finance.ledger_transaction.created);
 *  - isolation: ноль cross-domain мутаций (Order.paymentStatus/paidAmount,
 *    Payment/Refund/Invoice/Commission/CommissionAccrual/Booking/Availability);
 *  - deferred boundaries: ledger не имеет payment milestone-колонок (2.10C).
 *
 * Creation API отсутствует намеренно (§13 option A): canonical path — внутренний
 * LedgerService, вызывается напрямую (как его вызовет будущий producer 2.12+).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { LedgerService } from "../src/modules/finance/ledger.service";
import { runWithRequestContext } from "../src/shared/request-context";
import { RoleCode } from "../src/generated/prisma/enums";
import type { BusinessEventActor } from "../src/eventbus/domain-events";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("Phase 2 Step 2.10A — Ledger Transaction Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: LedgerService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: { users: string[]; ledgerIds: string[]; orderIds: string[]; currencyIds: string[] } = {
    users: [],
    ledgerIds: [],
    orderIds: [],
    currencyIds: [],
  };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const createStaff = async (tag: string, roleCode: RoleCode): Promise<Session> => {
    const staff = (await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  const createLedgerFact = (overrides: Record<string, unknown> = {}) =>
    ledger.create({
      amount: "100.00",
      currency: "USD",
      type: "TEST_FACT",
      sourceType: "ORDER",
      sourceId: `order-${stamp}`,
      ...overrides,
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    ledger = app.get(LedgerService);
    adminAgent = request.agent(app.getHttpServer());
    const admin = await login("admin", "admin123");
    adminAgent.set("Authorization", `Bearer ${admin.accessToken}`);

    // Currency authority: USD обязан существовать в finance.Currency.
    const cur = await prisma.currency.findUnique({ where: { isoCode: "USD" } });
    if (!cur) {
      const fin = await createStaff("l_fin_seed", RoleCode.FINANCE);
      const res = await agent(fin.accessToken).post("/api/v1/finance/currencies").send({ isoCode: "USD", name: "US Dollar", symbol: "$" }).expect(201);
      created.currencyIds.push(res.body.id as string);
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup: не оставлять строк в общей тестовой БД (serial-прогон; например
    // remove-bootstrap-order.assert order.count() === 0 на своём этапе).
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.ledgerIds } } });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: created.ledgerIds } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
    await prisma.currency.deleteMany({ where: { id: { in: created.currencyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── 1. RBAC / auth ──────────────────────────────────────────────────────────

  it("1. anonymous read → 401; no write routes (POST/PATCH/DELETE → 404)", async () => {
    await request(app.getHttpServer()).get("/api/v1/finance/ledger-transactions").expect(401);
    await request(app.getHttpServer()).post("/api/v1/finance/ledger-transactions").send({}).expect(404);
    await request(app.getHttpServer()).patch("/api/v1/finance/ledger-transactions/LTX-00000001").send({ amount: "1" }).expect(404);
    await request(app.getHttpServer()).delete("/api/v1/finance/ledger-transactions/LTX-00000001").expect(404);
  });

  it("2. RBAC: BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER → 403; FINANCE/ADMIN/DIRECTOR/ANALYST → 200", async () => {
    for (const [tag, role] of [
      ["l_buyer", RoleCode.BUYER],
      ["l_partner", RoleCode.PARTNER],
      ["l_oper", RoleCode.OPERATOR],
      ["l_sm", RoleCode.SALES_MANAGER],
      ["l_mod", RoleCode.MODERATOR],
      ["l_mkt", RoleCode.MARKETER],
    ] as Array<[string, RoleCode]>) {
      const s = await createStaff(tag, role);
      await agent(s.accessToken).get("/api/v1/finance/ledger-transactions").expect(403);
    }
    for (const [tag, role] of [
      ["l_fin", RoleCode.FINANCE],
      ["l_dir", RoleCode.DIRECTOR],
      ["l_an", RoleCode.ANALYST],
    ] as Array<[string, RoleCode]>) {
      const s = await createStaff(tag, role);
      await agent(s.accessToken).get("/api/v1/finance/ledger-transactions").expect(200);
    }
    await adminAgent.get("/api/v1/finance/ledger-transactions").expect(200);
  });

  // ── 2. canonical creation path (internal service) ───────────────────────────

  it("3. canonical fact: LTX-########, Decimal amount, currency snapshot, provenance", async () => {
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-p3` });
    created.ledgerIds.push(fact.id as string);
    expect(fact.code).toMatch(/^LTX-\d{8}$/);
    // Decimal string, НЕ float (Decimal.js нормализует trailing zeros: "100").
    expect(typeof fact.amount).toBe("string");
    expect(Number(fact.amount)).toBe(100);
    expect(fact.currency).toBe("USD");
    expect(fact.type).toBe("TEST_FACT");
    expect(fact.sourceType).toBe("ORDER");
    expect(fact.sourceId).toBe(`order-${stamp}-p3`);

    const row = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { code: fact.code as string } });
    expect(row.amount.toString()).toBe("100"); // Decimal.js нормализация trailing zeros
    // immutability: модель не имеет updatedAt — тип сам это гарантирует
    // (компилируется только без поля); колоночный proof — тест 15.
  });

  it("4. read API: list + detail by code; unknown → 404", async () => {
    const fin = await createStaff("l_fin_r", RoleCode.FINANCE);
    const a = agent(fin.accessToken);
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-p4` });
    created.ledgerIds.push(fact.id as string);

    const list = await a.get("/api/v1/finance/ledger-transactions").expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.total).toBeGreaterThan(0);
    expect(list.body.page).toBe(1);
    expect(list.body.hasMore).toBeDefined();

    const got = await a.get(`/api/v1/finance/ledger-transactions/${fact.code}`).expect(200);
    expect(typeof got.body.amount).toBe("string");
    expect(Number(got.body.amount)).toBe(100);
    expect(got.body.currency).toBe("USD");

    await a.get("/api/v1/finance/ledger-transactions/LTX-99999999").expect(404);
  });

  it("5. filters + pagination: sourceType/type/currency whitelist", async () => {
    const fin = await createStaff("l_fin_f", RoleCode.FINANCE);
    const a = agent(fin.accessToken);
    await createLedgerFact({ sourceId: `order-${stamp}-p5` });
    created.ledgerIds.push((await prisma.ledgerTransaction.findFirst({ where: { sourceId: `order-${stamp}-p5` } }))!.id);

    const filtered = await a.get("/api/v1/finance/ledger-transactions?sourceType=ORDER&type=TEST_FACT&currency=USD").expect(200);
    expect(filtered.body.items.length).toBeGreaterThan(0);
    for (const it of filtered.body.items) {
      expect(it.sourceType).toBe("ORDER");
      expect(it.type).toBe("TEST_FACT");
      expect(it.currency).toBe("USD");
    }
    const paged = await a.get("/api/v1/finance/ledger-transactions?page=1&pageSize=5").expect(200);
    expect(paged.body.items.length).toBeLessThanOrEqual(5);
  });

  // ── 3. validation / money / currency authority ──────────────────────────────

  it("6. amount 0/negative/excess precision → controlled ValidationDomainError", async () => {
    await expect(createLedgerFact({ amount: "0", sourceId: `order-${stamp}-n1` })).rejects.toThrow();
    await expect(createLedgerFact({ amount: "-5", sourceId: `order-${stamp}-n2` })).rejects.toThrow();
    await expect(createLedgerFact({ amount: "1.234", sourceId: `order-${stamp}-n3` })).rejects.toThrow();
    await expect(createLedgerFact({ amount: "abc", sourceId: `order-${stamp}-n4` })).rejects.toThrow();
  });

  it("7. unknown currency → controlled error (finance.Currency authority)", async () => {
    await expect(createLedgerFact({ currency: "ZZZ", sourceId: `order-${stamp}-n5` })).rejects.toThrow();
    await expect(createLedgerFact({ currency: "usd", sourceId: `order-${stamp}-n6` })).rejects.toThrow();
  });

  // ── 4. immutability ─────────────────────────────────────────────────────────

  it("8. immutable: нет update/delete путей; факт не меняется через API", async () => {
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-p8` });
    created.ledgerIds.push(fact.id as string);
    const fin = await createStaff("l_fin_i", RoleCode.FINANCE);
    const a = agent(fin.accessToken);
    await a.patch(`/api/v1/finance/ledger-transactions/${fact.code}`).send({ amount: "999" }).expect(404);
    await a.delete(`/api/v1/finance/ledger-transactions/${fact.code}`).expect(404);
    const row = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { code: fact.code as string } });
    expect(row.amount.toString()).toBe("100");
  });

  // ── 5. idempotency / concurrency ────────────────────────────────────────────

  it("9. replay одного source fact → no-op (одна запись, тот же code)", async () => {
    const first = await createLedgerFact({ sourceId: `order-${stamp}-idem` });
    const second = await createLedgerFact({ sourceId: `order-${stamp}-idem` });
    created.ledgerIds.push(first.id as string);
    expect(second.code).toBe(first.code);
    expect(second.id).toBe(first.id);
    const count = await prisma.ledgerTransaction.count({ where: { sourceId: `order-${stamp}-idem`, type: "TEST_FACT" } });
    expect(count).toBe(1);
  });

  it("9A. duplicate key + другой amount/currency → controlled ConflictError, НЕ молчаливый возврат (STRICT REVIEW FIX 1)", async () => {
    const first = await createLedgerFact({ sourceId: `order-${stamp}-conflict`, amount: "100.00", currency: "USD" });
    created.ledgerIds.push(first.id as string);
    // Другой amount с тем же ключом — producer-баг: должен быть громкий 409.
    await expect(createLedgerFact({ sourceId: `order-${stamp}-conflict`, amount: "200.00", currency: "USD" })).rejects.toThrow();
    // Другая валюта с тем же ключом — тоже 409.
    await expect(createLedgerFact({ sourceId: `order-${stamp}-conflict`, amount: "100.00", currency: "AZN" })).rejects.toThrow();
    // Идемпотентный повтор с ИДЕНТИЧНЫМ payload — no-op (существующий факт).
    const replay = await createLedgerFact({ sourceId: `order-${stamp}-conflict`, amount: "100.00", currency: "USD" });
    expect(replay.code).toBe(first.code);
    const count = await prisma.ledgerTransaction.count({ where: { sourceId: `order-${stamp}-conflict` } });
    expect(count).toBe(1);
  });

  it("10. concurrent duplicate create → одна запись, оба code равны, без 500", async () => {
    const [a, b] = await Promise.all([
      createLedgerFact({ sourceId: `order-${stamp}-race` }),
      createLedgerFact({ sourceId: `order-${stamp}-race` }),
    ]);
    created.ledgerIds.push(a.id as string);
    expect(a.code).toBe(b.code);
    const count = await prisma.ledgerTransaction.count({ where: { sourceId: `order-${stamp}-race`, type: "TEST_FACT" } });
    expect(count).toBe(1);
  });

  // ── 6. correlation / causation / actor (server-authoritative) ───────────────

  it("11. correlation/causation/actor наследуются из server context (не из body)", async () => {
    const actor: BusinessEventActor = { type: "USER", id: `user-${stamp}` };
    const fact = await runWithRequestContext(
      { requestId: `req-${stamp}`, correlationId: `corr-${stamp}`, causationId: `cause-${stamp}`, actor },
      () => createLedgerFact({ sourceId: `order-${stamp}-ctx` }),
    );
    created.ledgerIds.push(fact.id as string);
    expect(fact.correlationId).toBe(`corr-${stamp}`);
    expect(fact.causationId).toBe(`cause-${stamp}`);
    expect(fact.actorType).toBe("USER");
    expect(fact.actorId).toBe(`user-${stamp}`);
  });

  it("12. вне HTTP-контекста provenance — null (legacy unknown, без fake backfill)", async () => {
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-nullctx` });
    created.ledgerIds.push(fact.id as string);
    expect(fact.correlationId).toBeNull();
    expect(fact.causationId).toBeNull();
    expect(fact.actorType).toBeNull();
  });

  // ── 7. audit ────────────────────────────────────────────────────────────────

  it("13. create пишет AuditLog (finance.ledger_transaction.created) без PII", async () => {
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-audit` });
    created.ledgerIds.push(fact.id as string);
    const log = await prisma.auditLog.findFirst({
      where: { action: "finance.ledger_transaction.created", resourceId: fact.id as string },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log!.resource).toBe("LedgerTransaction");
    const details = log!.details as Record<string, unknown> | null;
    expect(details).toBeDefined();
    expect(details!.code).toBe(fact.code);
    expect(JSON.stringify(details)).not.toContain("email");
    expect(JSON.stringify(details)).not.toContain("amount");
  });

  // ── 8. isolation / deferred boundaries ──────────────────────────────────────

  it("14. ноль cross-domain мутаций: Order/Booking/Payment/Refund/Invoice/Commission/Availability не тронуты", async () => {
    const order = await prisma.order.create({
      data: { code: `ORD-LEDGER-${stamp}`, number: `TH-2026-LEDGER-${stamp}` },
    });
    created.orderIds.push(order.id);
    const before = {
      paymentStatus: order.paymentStatus,
      paidAmount: order.paidAmount.toString(),
      payments: await prisma.payment.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      commissions: await prisma.commission.count(),
      accruals: await prisma.commissionAccrual.count(),
      bookings: await prisma.booking.count(),
    };

    await createLedgerFact({ sourceId: `order-${stamp}-iso` });
    created.ledgerIds.push((await prisma.ledgerTransaction.findFirst({ where: { sourceId: `order-${stamp}-iso` } }))!.id);

    const afterOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterOrder.paymentStatus).toBe(before.paymentStatus);
    expect(afterOrder.paidAmount.toString()).toBe(before.paidAmount);
    expect(await prisma.payment.count()).toBe(before.payments);
    expect(await prisma.refund.count()).toBe(before.refunds);
    expect(await prisma.invoice.count()).toBe(before.invoices);
    expect(await prisma.commission.count()).toBe(before.commissions);
    expect(await prisma.commissionAccrual.count()).toBe(before.accruals);
    expect(await prisma.booking.count()).toBe(before.bookings);
  });

  it("15. temporal 2.10C boundary: LedgerTransaction не имеет payment milestone-колонок", async () => {
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'LedgerTransaction'",
    );
    const names = cols.map((c) => c.column_name);
    for (const forbidden of ["paidAt", "authorizedAt", "capturedAt", "refundedAt", "settledAt", "payoutRequestedAt"]) {
      expect(names).not.toContain(forbidden);
    }
    // createdAt — сервер-owned время факта, не payment milestone.
    expect(names).toContain("createdAt");
    expect(names).not.toContain("updatedAt"); // append-only
  });

  it("16. migration: таблица существует на fresh replay (finance schema)", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'finance' ORDER BY tablename",
    );
    expect(tables.map((t) => t.tablename)).toContain("LedgerTransaction");
  });

  it("17. legacy domain rows остаются читаемыми (legacy compatibility)", async () => {
    const fact = await createLedgerFact({ sourceId: `order-${stamp}-legacy` });
    created.ledgerIds.push(fact.id as string);
    const legacyOrder = await prisma.order.findFirst();
    expect(legacyOrder).toBeDefined();
    expect(legacyOrder!.status).toBeDefined();
    // Нет fabricated opening ledger-фактов для legacy rows: до создания в этом
    // тесте у legacy Order нет ledger-строк.
    const linked = await prisma.ledgerTransaction.count({ where: { sourceType: "ORDER", sourceId: legacyOrder!.id } });
    expect(linked).toBe(0);
  });
});
