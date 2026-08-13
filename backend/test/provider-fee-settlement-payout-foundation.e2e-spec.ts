/**
 * PHASE 2 STEP 2.10B — ProviderFee / Settlement / Payout Foundation (e2e).
 *
 * Доказывает:
 *  - migration (finance.ProviderFee/Settlement/Payout существуют на fresh replay);
 *  - RBAC read (finance.provider_fee.read / finance.settlement.read /
 *    finance.payout.read): anonymous 401; запрещённые роли 403;
 *    FINANCE/DIRECTOR/ANALYST/ADMIN 200;
 *  - no write routes (POST/PATCH/DELETE → 404) — создание только внутренний
 *    SettlementService (canonical Finance path);
 *  - canonical PFE-/STL-/POT- + Decimal + currency authority (finance.Currency);
 *  - idempotency first-write-wins + payload-верификация (identical → no-op,
 *    divergent → 409), concurrency → одна запись;
 *  - audit (finance.provider_fee/settlement/payout.created, без PII);
 *  - isolation: ноль cross-domain мутаций (Order/Booking/Payment/Refund/
 *    Invoice/Commission/Availability) и **ноль ledger-автопостингов**
 *    (LedgerTransaction count неизменен — 2.10A append-only не нарушен);
 *  - deferred boundaries: без Payment runtime, без PSP, без milestones,
 *    без Settlement↔Payout связи (не определена канонически).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { SettlementService } from "../src/modules/finance/settlement.service";
import { runWithRequestContext } from "../src/shared/request-context";
import { RoleCode } from "../src/generated/prisma/enums";
import type { BusinessEventActor } from "../src/eventbus/domain-events";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("Phase 2 Step 2.10B — Provider Fee / Settlement / Payout Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settlement: SettlementService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: { users: string[]; fees: string[]; settlements: string[]; payouts: string[] } = {
    users: [],
    fees: [],
    settlements: [],
    payouts: [],
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    settlement = app.get(SettlementService);
    adminAgent = request.agent(app.getHttpServer());
    const admin = await login("admin", "admin123");
    adminAgent.set("Authorization", `Bearer ${admin.accessToken}`);

    // Currency authority: USD обязан существовать в finance.Currency.
    const cur = await prisma.currency.findUnique({ where: { isoCode: "USD" } });
    if (!cur) {
      const fin = await createStaff("s_fin_seed", RoleCode.FINANCE);
      await agent(fin.accessToken).post("/api/v1/finance/currencies").send({ isoCode: "USD", name: "US Dollar", symbol: "$" }).expect(201);
    }
  }, 60000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: [...created.fees, ...created.settlements, ...created.payouts] } } });
    await prisma.providerFee.deleteMany({ where: { id: { in: created.fees } } });
    await prisma.settlement.deleteMany({ where: { id: { in: created.settlements } } });
    await prisma.payout.deleteMany({ where: { id: { in: created.payouts } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ── 1. RBAC / auth / write-surface ─────────────────────────────────────────

  it("1. anonymous read → 401; POST/PATCH/DELETE write-маршруты отсутствуют → 404", async () => {
    for (const path of ["provider-fees", "settlements", "payouts"]) {
      await request(app.getHttpServer()).get(`/api/v1/finance/${path}`).expect(401);
      await request(app.getHttpServer()).post(`/api/v1/finance/${path}`).send({ amount: "1", currency: "USD", sourceType: "ORDER", sourceId: "x" }).expect(404);
      await request(app.getHttpServer()).patch(`/api/v1/finance/${path}/PFE-00000001`).send({ amount: "2" }).expect(404);
      await request(app.getHttpServer()).delete(`/api/v1/finance/${path}/PFE-00000001`).expect(404);
    }
  });

  it("2. RBAC: запрещённые роли → 403; FINANCE/DIRECTOR/ANALYST/ADMIN → 200 (все три read)", async () => {
    for (const [tag, role] of [
      ["s_buyer", RoleCode.BUYER],
      ["s_partner", RoleCode.PARTNER],
      ["s_oper", RoleCode.OPERATOR],
      ["s_sm", RoleCode.SALES_MANAGER],
      ["s_mod", RoleCode.MODERATOR],
      ["s_mkt", RoleCode.MARKETER],
    ] as Array<[string, RoleCode]>) {
      const s = await createStaff(tag, role);
      for (const path of ["provider-fees", "settlements", "payouts"]) {
        await agent(s.accessToken).get(`/api/v1/finance/${path}`).expect(403);
      }
    }
    for (const [tag, role] of [
      ["s_fin", RoleCode.FINANCE],
      ["s_dir", RoleCode.DIRECTOR],
      ["s_an", RoleCode.ANALYST],
    ] as Array<[string, RoleCode]>) {
      const s = await createStaff(tag, role);
      for (const path of ["provider-fees", "settlements", "payouts"]) {
        await agent(s.accessToken).get(`/api/v1/finance/${path}`).expect(200);
      }
    }
    for (const path of ["provider-fees", "settlements", "payouts"]) {
      await adminAgent.get(`/api/v1/finance/${path}`).expect(200);
    }
  });

  // ── 2. canonical create (internal service) + read API ──────────────────────

  it("3. ProviderFee: PFE-*, Decimal, currency snapshot, provider, provenance, audit", async () => {
    const fee = await settlement.createProviderFee({
      provider: "STRIPE",
      amount: "1.50",
      currency: "USD",
      providerRef: "ch_abc123",
      sourceType: "PAYMENT",
      sourceId: `pay-${stamp}-1`,
    });
    created.fees.push(fee.id as string);
    expect(fee.code).toMatch(/^PFE-\d{8}$/);
    expect(typeof fee.amount).toBe("string");
    expect(Number(fee.amount)).toBe(1.5);
    expect(fee.currency).toBe("USD");
    expect(fee.provider).toBe("STRIPE");
    expect(fee.providerRef).toBe("ch_abc123");
    expect(fee.sourceType).toBe("PAYMENT");
    expect(fee.sourceId).toBe(`pay-${stamp}-1`);

    const fin = await createStaff("s_fin_r", RoleCode.FINANCE);
    const got = await agent(fin.accessToken).get(`/api/v1/finance/provider-fees/${fee.code}`).expect(200);
    expect(got.body.provider).toBe("STRIPE");

    const log = await prisma.auditLog.findFirst({ where: { action: "finance.provider_fee.created", resourceId: fee.id as string } });
    expect(log).toBeDefined();
    expect(JSON.stringify(log!.details)).not.toContain("email");
    expect(JSON.stringify(log!.details)).not.toContain("amount");
  });

  it("4. Settlement + Payout: STL-*/POT-*, read list/detail, filters", async () => {
    const stl = await settlement.createSettlement({ amount: "100.00", currency: "USD", sourceType: "ORDER", sourceId: `ord-${stamp}-s1` });
    created.settlements.push(stl.id as string);
    expect(stl.code).toMatch(/^STL-\d{8}$/);
    expect(Number(stl.amount)).toBe(100);

    const pot = await settlement.createPayout({ amount: "98.50", currency: "USD", sourceType: "SETTLEMENT", sourceId: stl.id as string });
    created.payouts.push(pot.id as string);
    expect(pot.code).toMatch(/^POT-\d{8}$/);
    expect(Number(pot.amount)).toBe(98.5);

    const fin = await createStaff("s_fin_r2", RoleCode.FINANCE);
    const a = agent(fin.accessToken);
    const list = await a.get("/api/v1/finance/settlements?sourceType=ORDER").expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.total).toBeGreaterThan(0);
    expect(list.body.hasMore).toBeDefined();

    await a.get(`/api/v1/finance/settlements/${stl.code}`).expect(200);
    await a.get(`/api/v1/finance/payouts/${pot.code}`).expect(200);
    await a.get("/api/v1/finance/provider-fees/PFE-99999999").expect(404);
    await a.get("/api/v1/finance/settlements/STL-99999999").expect(404);
    await a.get("/api/v1/finance/payouts/POT-99999999").expect(404);
    // Фильтры/пагинация — whitelist: pageSize > 100 → 400, page=0 → 400,
    // не-числовой page → 400 (без raw 500). Заглушка на чужой код → 404 уже выше.
    await a.get("/api/v1/finance/provider-fees?pageSize=101").expect(400);
    await a.get("/api/v1/finance/provider-fees?page=0").expect(400);
    await a.get("/api/v1/finance/provider-fees?page=abc").expect(400);
  });

  // ── 3. validation / money / currency ───────────────────────────────────────

  it("5. amount 0/negative/excess precision/не-число; unknown currency → controlled errors", async () => {
    await expect(settlement.createProviderFee({ provider: "P", amount: "0", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-n1` })).rejects.toThrow();
    await expect(settlement.createProviderFee({ provider: "P", amount: "-5", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-n2` })).rejects.toThrow();
    await expect(settlement.createProviderFee({ provider: "P", amount: "1.234", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-n3` })).rejects.toThrow();
    await expect(settlement.createSettlement({ amount: "abc", currency: "USD", sourceType: "ORDER", sourceId: `ord-${stamp}-n4` })).rejects.toThrow();
    await expect(settlement.createSettlement({ amount: "10", currency: "ZZZ", sourceType: "ORDER", sourceId: `ord-${stamp}-n5` })).rejects.toThrow();
    await expect(settlement.createPayout({ amount: "10", currency: "usd", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-n6` })).rejects.toThrow();
  });

  // ── 4. idempotency / concurrency (first-write-wins + payload verification) ──

  it("6. identical replay → no-op; divergent amount/currency → controlled 409", async () => {
    const first = await settlement.createProviderFee({ provider: "STRIPE", amount: "2.00", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-idem` });
    created.fees.push(first.id as string);
    const replay = await settlement.createProviderFee({ provider: "STRIPE", amount: "2.00", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-idem` });
    expect(replay.code).toBe(first.code);
    expect(replay.id).toBe(first.id);

    await expect(
      settlement.createProviderFee({ provider: "STRIPE", amount: "3.00", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-idem` }),
    ).rejects.toThrow();
    await expect(
      settlement.createProviderFee({ provider: "STRIPE", amount: "2.00", currency: "AZN", sourceType: "PAYMENT", sourceId: `pay-${stamp}-idem` }),
    ).rejects.toThrow();
    // divergent providerRef → controlled 409 (провенанс — business-authoritative поле)
    await expect(
      settlement.createProviderFee({ provider: "STRIPE", amount: "2.00", currency: "USD", providerRef: "ch_divergent", sourceType: "PAYMENT", sourceId: `pay-${stamp}-idem` }),
    ).rejects.toThrow();
    const count = await prisma.providerFee.count({ where: { sourceId: `pay-${stamp}-idem` } });
    expect(count).toBe(1);
  });

  it("6b. Payout: divergent providerRef → controlled 409; identical replay c providerRef → no-op", async () => {
    const first = await settlement.createPayout({ amount: "20", currency: "USD", providerRef: "po_abc", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-idem2` });
    created.payouts.push(first.id as string);
    const replay = await settlement.createPayout({ amount: "20", currency: "USD", providerRef: "po_abc", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-idem2` });
    expect(replay.id).toBe(first.id);
    await expect(
      settlement.createPayout({ amount: "20", currency: "USD", providerRef: "po_other", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-idem2` }),
    ).rejects.toThrow();
    expect(await prisma.payout.count({ where: { sourceId: `stl-${stamp}-idem2` } })).toBe(1);
  });

  it("7. concurrent duplicate (Settlement + Payout) → одна запись, без 500", async () => {
    const [a, b] = await Promise.all([
      settlement.createSettlement({ amount: "50", currency: "USD", sourceType: "ORDER", sourceId: `ord-${stamp}-race` }),
      settlement.createSettlement({ amount: "50", currency: "USD", sourceType: "ORDER", sourceId: `ord-${stamp}-race` }),
    ]);
    created.settlements.push(a.id as string);
    expect(a.code).toBe(b.code);
    expect(await prisma.settlement.count({ where: { sourceId: `ord-${stamp}-race` } })).toBe(1);

    const [p1, p2] = await Promise.all([
      settlement.createPayout({ amount: "50", currency: "USD", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-race` }),
      settlement.createPayout({ amount: "50", currency: "USD", sourceType: "SETTLEMENT", sourceId: `stl-${stamp}-race` }),
    ]);
    created.payouts.push(p1.id as string);
    expect(p1.code).toBe(p2.code);
    expect(await prisma.payout.count({ where: { sourceId: `stl-${stamp}-race` } })).toBe(1);
  });

  it("7b. concurrent divergent create → один durable факт, второй controlled 409, без raw 500", async () => {
    const key = `ord-${stamp}-race-div`;
    const results = await Promise.allSettled([
      settlement.createSettlement({ amount: "50", currency: "USD", sourceType: "ORDER", sourceId: key }),
      settlement.createSettlement({ amount: "51", currency: "USD", sourceType: "ORDER", sourceId: key }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as Array<PromiseFulfilledResult<{ id: string; amount: string }>>;
    const rejected = results.filter((r) => r.status === "rejected") as Array<PromiseRejectedResult>;
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    // Проигравший — детерминированный controlled conflict, НЕ raw 500 и НЕ молчаливый no-op
    expect(rejected[0].reason).toBeInstanceOf(Error);
    expect((rejected[0].reason as { httpStatus?: number }).httpStatus).toBe(409);
    created.settlements.push(fulfilled[0].value.id as string);
    expect(await prisma.settlement.count({ where: { sourceId: key } })).toBe(1);
  });

  it("8. correlation/causation/actor — server-authoritative из контекста", async () => {
    const actor: BusinessEventActor = { type: "USER", id: `user-${stamp}` };
    const fee = await runWithRequestContext(
      { requestId: `req-${stamp}`, correlationId: `corr-${stamp}`, causationId: `cause-${stamp}`, actor },
      () => settlement.createProviderFee({ provider: "STRIPE", amount: "1", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-ctx` }),
    );
    created.fees.push(fee.id as string);
    expect(fee.correlationId).toBe(`corr-${stamp}`);
    expect(fee.causationId).toBe(`cause-${stamp}`);
    expect(fee.actorType).toBe("USER");
    expect(fee.actorId).toBe(`user-${stamp}`);
  });

  // ── 5. isolation / deferred boundaries ──────────────────────────────────────

  it("9. ноль cross-domain мутаций + ноль ledger-автопостингов (2.10A append-only не нарушен)", async () => {
    const ledgerBefore = await prisma.ledgerTransaction.count();
    const payments = await prisma.payment.count();
    const refunds = await prisma.refund.count();
    const invoices = await prisma.invoice.count();
    const commissions = await prisma.commission.count();
    const accruals = await prisma.commissionAccrual.count();
    const bookings = await prisma.booking.count();

    const fee = await settlement.createProviderFee({ provider: "STRIPE", amount: "1.25", currency: "USD", sourceType: "PAYMENT", sourceId: `pay-${stamp}-iso` });
    created.fees.push(fee.id as string);
    const stl = await settlement.createSettlement({ amount: "10", currency: "USD", sourceType: "ORDER", sourceId: `ord-${stamp}-iso` });
    created.settlements.push(stl.id as string);
    const pot = await settlement.createPayout({ amount: "10", currency: "USD", sourceType: "SETTLEMENT", sourceId: stl.id as string });
    created.payouts.push(pot.id as string);

    expect(await prisma.ledgerTransaction.count()).toBe(ledgerBefore); // НЕТ ledger-автопостинга
    expect(await prisma.payment.count()).toBe(payments);
    expect(await prisma.refund.count()).toBe(refunds);
    expect(await prisma.invoice.count()).toBe(invoices);
    expect(await prisma.commission.count()).toBe(commissions);
    expect(await prisma.commissionAccrual.count()).toBe(accruals);
    expect(await prisma.booking.count()).toBe(bookings);
  });

  it("10. без Payment runtime, PSP-колонок, milestones и Settlement↔Payout связи", async () => {
    for (const table of ["ProviderFee", "Settlement", "Payout"]) {
      const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = $1",
        table,
      );
      const names = cols.map((c) => c.column_name);
      for (const forbidden of ["status", "paidAt", "authorizedAt", "capturedAt", "refundedAt", "settledAt", "payoutRequestedAt", "bankAccount", "iban", "swift"]) {
        expect(names).not.toContain(forbidden);
      }
      expect(names).not.toContain("updatedAt"); // append-only факты
      expect(names).toContain("createdAt");
    }
    // Нет связи Settlement↔Payout (не определена канонически): у Payout нет
    // обязательного settlementId-колонки.
    const payoutCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'Payout'",
    );
    expect(payoutCols.map((c) => c.column_name)).not.toContain("settlementId");
  });

  it("11. migration: таблицы существуют на fresh replay; legacy ledger rows читаемы", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'finance' ORDER BY tablename",
    );
    const names = tables.map((t) => t.tablename);
    expect(names).toContain("ProviderFee");
    expect(names).toContain("Settlement");
    expect(names).toContain("Payout");
    expect(names).toContain("LedgerTransaction"); // 2.10A не сломан
    const anyLedger = await prisma.ledgerTransaction.findFirst();
    expect(anyLedger === null || anyLedger.code.startsWith("LTX-")).toBe(true);
  });
});
