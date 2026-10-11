/**
 * UNIFIED FINANCE CENTER Phase 2 — SupplierObligation / SupplierPayout e2e.
 *
 * Покрывает (HTTP + RBAC + денежные инварианты через API):
 *  - anonymous → 401 на все obligation/payout-эндпоинты;
 *  - RBAC: BUYER → 403 везде; ANALYST/DIRECTOR → read 200, write (payout/cancel/
 *    adjust) 403; FINANCE → full (payout 201, cancel/adjust 200);
 *  - obligation создаётся consumer-ом (BookingConfirmed); здесь сидируется
 *    напрямую (таблица без FK на Booking/Order) и тестируются read+денежные
 *    команды;
 *  - partial payouts: первый payout 500 USD (azn 850 при 1.7) → PARTIALLY_PAID,
 *    остаток 850; второй payout закрывает → CLOSED; overpayment → 422;
 *  - UNKNOWN obligation (aznAmount null) → payout 422 (blocked, never zero);
 *  - providerRef idempotency: replay same payload → 200 (тот же code, без
 *    второго списания); divergent → 409;
 *  - cancel/adjust: unpaid → OK; paid → 409;
 *  - DTO: amountUnknown/remainingAmount/partnerCode в ответах.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[] };
}

const FIN = "/api/v1/finance";

describe("UNIFIED FINANCE CENTER Phase 2 — SupplierObligation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const suiteStart = new Date();
  const created: { users: string[]; obligations: string[] } = { users: [], obligations: [] };

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
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `${tag}${stamp}`, email: `${tag}${stamp}@test.local`, password: "buyerpass123", firstName: "Покупатель", lastName: tag.toUpperCase() })
      .expect(201);
    return res.body as Session;
  };

  const createStaff = async (tag: string, roleCode: RoleCode, admin: ReturnType<typeof agent>): Promise<Session> => {
    const staff = (await admin.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  /** Сидирует obligation напрямую (таблица без FK на Booking/Order). */
  const seedObligation = async (opts: {
    code: string;
    sourceAmount: string;
    sourceCurrency: string;
    aznAmount?: string | null;
    fxRate?: string | null;
    fxRateCode?: string | null;
    status?: string;
  }): Promise<{ id: string; code: string }> => {
    const id = randomUUID();
    const azn = opts.aznAmount == null ? null : Number(opts.aznAmount);
    await prisma.supplierObligation.create({
      data: {
        id,
        code: opts.code,
        bookingId: `bkg-${opts.code}`,
        bookingCode: `BKG-${opts.code}`,
        orderId: `ord-${opts.code}`,
        orderCode: `ORD-${opts.code}`,
        supplierCode: "SUMMERTOUR",
        partnerId: null,
        serviceType: "tour",
        sourceAmount: Number(opts.sourceAmount),
        sourceCurrency: opts.sourceCurrency,
        aznAmount: azn,
        fxRate: opts.fxRate == null ? null : Number(opts.fxRate),
        fxRateCode: opts.fxRateCode ?? null,
        status: opts.status ?? "OPEN",
        paidAmount: 0,
        remainingAmount: azn,
        source: "BOOKING_CONFIRMED",
        confirmedAt: suiteStart,
      },
    });
    created.obligations.push(id);
    return { id, code: opts.code };
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
    await prisma.auditLog.deleteMany({ where: { action: { startsWith: "finance." }, createdAt: { gte: suiteStart } } });
    await prisma.supplierPayout.deleteMany({ where: { obligationId: { in: created.obligations } } });
    await prisma.supplierObligation.deleteMany({ where: { id: { in: created.obligations } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. anonymous → 401 на все obligation/payout-эндпоинты", async () => {
    const http = request(app.getHttpServer());
    await http.get(`${FIN}/obligations`).expect(401);
    await http.get(`${FIN}/obligations/SBO-00000001`).expect(401);
    await http.get(`${FIN}/payouts`).expect(401);
    await http.post(`${FIN}/obligations/SBO-00000001/payouts`).send({ amount: "1", currency: "USD" }).expect(401);
    await http.post(`${FIN}/obligations/SBO-00000001/cancel`).send({}).expect(401);
    await http.post(`${FIN}/obligations/SBO-00000001/adjust`).send({ newAznAmount: "1" }).expect(401);
  });

  it("2. RBAC: BUYER → 403 везде; ANALYST/DIRECTOR → read 200, write 403; FINANCE → full", async () => {
    const ob = await seedObligation({ code: `SBO-R${stamp % 100000}`, sourceAmount: "1000", sourceCurrency: "USD", aznAmount: "1700", fxRate: "1.7" });
    const buyer = agent((await registerBuyer(`ob_b_${stamp % 100000}`)).accessToken);
    const analyst = agent((await createStaff("ob_an", RoleCode.ANALYST, adminAgent)).accessToken);
    const director = agent((await createStaff("ob_dir", RoleCode.DIRECTOR, adminAgent)).accessToken);
    const finance = agent((await createStaff("ob_fin", RoleCode.FINANCE, adminAgent)).accessToken);

    // BUYER: read+write → 403
    await buyer.get(`${FIN}/obligations`).expect(403);
    await buyer.get(`${FIN}/payouts`).expect(403);
    await buyer.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "1", currency: "USD", aznAmount: "1" }).expect(403);
    await buyer.post(`${FIN}/obligations/${ob.code}/cancel`).send({}).expect(403);

    // ANALYST/DIRECTOR: read → 200; write → 403
    for (const who of [analyst, director]) {
      await who.get(`${FIN}/obligations`).expect(200);
      await who.get(`${FIN}/payouts`).expect(200);
      await who.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "1", currency: "USD", aznAmount: "1" }).expect(403);
      await who.post(`${FIN}/obligations/${ob.code}/cancel`).send({}).expect(403);
      await who.post(`${FIN}/obligations/${ob.code}/adjust`).send({ newAznAmount: "1" }).expect(403);
    }

    // FINANCE: read → 200; adjust (unpaid) → 200; payout → 201; cancel (unpaid) → 200.
    await finance.get(`${FIN}/obligations`).expect(200);
    // adjust ДО выплаты (obligation ещё unpaid → allowed).
    await finance.post(`${FIN}/obligations/${ob.code}/adjust`).send({ newAznAmount: "1690", reason: "rbac" }).expect(200);
    const payout = await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "10", currency: "USD", aznAmount: "17", providerRef: `rbac-${stamp}` }).expect(201);
    expect(payout.body.code).toMatch(/^SPO-/);
    // cancel на отдельной unpaid obligation (ob уже частично оплачен → 409).
    const cancelOb = await seedObligation({ code: `SBO-RC${stamp % 100000}`, sourceAmount: "300", sourceCurrency: "AZN", aznAmount: "300", fxRate: "1" });
    await finance.post(`${FIN}/obligations/${cancelOb.code}/cancel`).send({ reason: "rbac" }).expect(200);
  });

  it("3. GET shape: amountUnknown/remainingAmount; фильтр по status", async () => {
    const ob = await seedObligation({ code: `SBO-S${stamp % 100000}`, sourceAmount: "2000", sourceCurrency: "USD", aznAmount: "3400", fxRate: "1.7" });
    const finance = agent((await createStaff("ob_shape", RoleCode.FINANCE, adminAgent)).accessToken);
    const detail = await finance.get(`${FIN}/obligations/${ob.code}`).expect(200);
    expect(detail.body.code).toBe(ob.code);
    expect(detail.body.aznAmount).toBe("3400");
    expect(detail.body.remainingAmount).toBe("3400");
    expect(detail.body.paidAmount).toBe("0");
    expect(detail.body.amountUnknown).toBe(false);
    expect(detail.body.status).toBe("OPEN");
    expect(Array.isArray(detail.body.payouts)).toBe(true);

    const list = await finance.get(`${FIN}/obligations?status=OPEN`).expect(200);
    expect(list.body.items.some((o: { code: string }) => o.code === ob.code)).toBe(true);
    expect(list.body).toHaveProperty("total");
  });

  it("4. partial payouts → PARTIALLY_PAID → CLOSED; overpayment → 422", async () => {
    const ob = await seedObligation({ code: `SBO-P${stamp % 100000}`, sourceAmount: "1000", sourceCurrency: "USD", aznAmount: "1700", fxRate: "1.7" });
    const finance = agent((await createStaff("ob_pay", RoleCode.FINANCE, adminAgent)).accessToken);

    // Первый payout: 500 USD → azn 850 (сервер посчитал 500 × 1.7), остаток 850.
    const p1 = await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "500", currency: "USD", providerRef: `pr-a-${stamp}` }).expect(201);
    expect(p1.body.aznAmount).toBe("850");
    expect(p1.body.fxVariance).toBe("0");
    const after1 = await finance.get(`${FIN}/obligations/${ob.code}`).expect(200);
    expect(after1.body.status).toBe("PARTIALLY_PAID");
    expect(after1.body.paidAmount).toBe("850");
    expect(after1.body.remainingAmount).toBe("850");

    // Overpayment: azn 900 > remaining 850 → 422.
    await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "600", currency: "USD", aznAmount: "900" }).expect(422);

    // Второй payout закрывает остаток (850) → CLOSED.
    await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "500", currency: "USD", aznAmount: "850", providerRef: `pr-b-${stamp}` }).expect(201);
    const after2 = await finance.get(`${FIN}/obligations/${ob.code}`).expect(200);
    expect(after2.body.status).toBe("CLOSED");
    expect(after2.body.paidAmount).toBe("1700");
    expect(after2.body.remainingAmount).toBe("0");

    // CLOSED → further payout 409.
    await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "1", currency: "USD", aznAmount: "1" }).expect(409);
  });

  it("5. UNKNOWN obligation (aznAmount null) → payout 422 (blocked, never zero)", async () => {
    const ob = await seedObligation({ code: `SBO-U${stamp % 100000}`, sourceAmount: "1000", sourceCurrency: "USD", aznAmount: null, fxRate: null });
    const finance = agent((await createStaff("ob_unk", RoleCode.FINANCE, adminAgent)).accessToken);
    const detail = await finance.get(`${FIN}/obligations/${ob.code}`).expect(200);
    expect(detail.body.amountUnknown).toBe(true);
    expect(detail.body.aznAmount).toBeNull();
    await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ amount: "100", currency: "USD" }).expect(422);
  });

  it("6. providerRef idempotency: replay same → 200 (без двойного списания); divergent → 409", async () => {
    const ob = await seedObligation({ code: `SBO-I${stamp % 100000}`, sourceAmount: "1000", sourceCurrency: "USD", aznAmount: "1700", fxRate: "1.7" });
    const finance = agent((await createStaff("ob_idem", RoleCode.FINANCE, adminAgent)).accessToken);
    const body = { amount: "100", currency: "USD", aznAmount: "170", providerRef: `idem-${stamp}` };

    const first = await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send(body).expect(201);
    // Replay того же providerRef + payload → идемпотентный 201, тот же code,
    // remaining НЕ меняется (нет двойного списания).
    const replay = await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send(body).expect(201);
    expect(replay.body.code).toBe(first.body.code);
    const after = await finance.get(`${FIN}/obligations/${ob.code}`).expect(200);
    expect(after.body.paidAmount).toBe("170");
    expect(after.body.remainingAmount).toBe("1530");

    // Divergent replay (другой amount) → 409.
    await finance.post(`${FIN}/obligations/${ob.code}/payouts`).send({ ...body, amount: "999" }).expect(409);
  });

  it("7. cancel/adjust: unpaid → OK; paid → 409", async () => {
    const unpaid = await seedObligation({ code: `SBO-C${stamp % 100000}`, sourceAmount: "500", sourceCurrency: "AZN", aznAmount: "500", fxRate: "1" });
    const paid = await seedObligation({ code: `SBO-D${stamp % 100000}`, sourceAmount: "500", sourceCurrency: "USD", aznAmount: "850", fxRate: "1.7" });
    const finance = agent((await createStaff("ob_cad", RoleCode.FINANCE, adminAgent)).accessToken);

    // adjust unpaid → ADJUSTED (remaining обновлён).
    const adj = await finance.post(`${FIN}/obligations/${unpaid.code}/adjust`).send({ newAznAmount: "600", reason: "corrected" }).expect(200);
    expect(adj.body.status).toBe("ADJUSTED");
    expect(adj.body.aznAmount).toBe("600");
    expect(adj.body.remainingAmount).toBe("600");

    // cancel unpaid → CANCELLED.
    const cancelled = await finance.post(`${FIN}/obligations/${unpaid.code}/cancel`).send({ reason: "dup" }).expect(200);
    expect(cancelled.body.status).toBe("CANCELLED");

    // paid obligation: сначала payout, затем cancel/adjust → 409.
    await finance.post(`${FIN}/obligations/${paid.code}/payouts`).send({ amount: "100", currency: "USD", aznAmount: "170", providerRef: `cad-${stamp}` }).expect(201);
    await finance.post(`${FIN}/obligations/${paid.code}/cancel`).send({}).expect(409);
    await finance.post(`${FIN}/obligations/${paid.code}/adjust`).send({ newAznAmount: "900" }).expect(409);
  });

  it("8. forged server-owned keys (code/obligationCode/id) → 422", async () => {
    const ob = await seedObligation({ code: `SBO-F${stamp % 100000}`, sourceAmount: "100", sourceCurrency: "AZN", aznAmount: "100", fxRate: "1" });
    const finance = agent((await createStaff("ob_forg", RoleCode.FINANCE, adminAgent)).accessToken);
    await finance
      .post(`${FIN}/obligations/${ob.code}/payouts`)
      .send({ amount: "10", currency: "AZN", aznAmount: "10", code: "SBO-FORGED", obligationCode: "SBO-FORGED", id: "forged" })
      .expect(422);
  });

  it("9. overview: anonymous 401, BUYER 403, ANALYST/DIRECTOR/FINANCE 200 + shape", async () => {
    await request(app.getHttpServer()).get(`${FIN}/overview`).expect(401);
    const buyer = agent((await registerBuyer(`ob_ov_${stamp % 100000}`)).accessToken);
    await buyer.get(`${FIN}/overview`).expect(403);
    for (const tag of ["ob_oan", "ob_odr", "ob_ofn"]) {
      const role = tag === "ob_ofn" ? RoleCode.FINANCE : tag === "ob_odr" ? RoleCode.DIRECTOR : RoleCode.ANALYST;
      const who = agent((await createStaff(tag, role, adminAgent)).accessToken);
      const res = await who.get(`${FIN}/overview`).expect(200);
      const b = res.body;
      expect(b).toHaveProperty("obligations");
      expect(b).toHaveProperty("supplierPayouts");
      expect(b).toHaveProperty("expectedMargin");
      expect(b).toHaveProperty("customerReceipts");
      expect(b).toHaveProperty("customerDebt");
      // Profit/cash-flow честно UNAVAILABLE (Phase 5), не «captured−payouts».
      expect(b.actualProfit.availability).toBe("UNAVAILABLE");
      expect(b.netCashFlow.availability).toBe("UNAVAILABLE");
      // AZN-итоги обязательств/выплат присутствуют (строки, «never zero»).
      expect(typeof b.obligations.totalAzn).toBe("string");
      expect(typeof b.supplierPayouts.paidAzn).toBe("string");
    }
  });

  it("10. Phase 5 ledger: payout → SUPPLIER_PAYOUT fact; adjust → OBLIGATION_ADJUSTED; replay → no duplicate", async () => {
    const fin = agent((await createStaff("ob_led", RoleCode.FINANCE, adminAgent)).accessToken);

    // ── Payout path → SUPPLIER_PAYOUT ledger fact (cash movement 500 USD). ──
    const payOb = await seedObligation({ code: `SBO-LP${stamp % 100000}`, sourceAmount: "1000", sourceCurrency: "USD", aznAmount: "1700", fxRate: "1.7" });
    const p = await fin.post(`${FIN}/obligations/${payOb.code}/payouts`).send({ amount: "500", currency: "USD", aznAmount: "850", providerRef: `led-${stamp}` }).expect(201);
    expect(p.body.id).toBeDefined();
    const payoutLedger = await prisma.ledgerTransaction.findFirst({
      where: { sourceType: "SUPPLIER_PAYOUT", sourceId: p.body.id, type: "SUPPLIER_PAYOUT" },
    });
    expect(payoutLedger).not.toBeNull();
    // Факт исходящего движения: 500 USD (не AZN-эквивалент) — честный cash-факт.
    expect(payoutLedger!.amount.toString()).toBe("500");
    expect(payoutLedger!.currency).toBe("USD");
    expect(payoutLedger!.sourceEventId).not.toBeNull();
    expect(payoutLedger!.occurredAt).not.toBeNull(); // occurredAt payout зафиксирован

    // Replay того же providerRef → no-op (ранний return ДО emit) → ровно один ledger fact.
    await fin.post(`${FIN}/obligations/${payOb.code}/payouts`).send({ amount: "500", currency: "USD", aznAmount: "850", providerRef: `led-${stamp}` }).expect(201);
    const payoutLedgerCount = await prisma.ledgerTransaction.count({
      where: { sourceType: "SUPPLIER_PAYOUT", sourceId: p.body.id, type: "SUPPLIER_PAYOUT" },
    });
    expect(payoutLedgerCount).toBe(1);

    // ── Adjust path → OBLIGATION_ADJUSTED ledger fact (revaluation, AZN). ──
    const adjOb = await seedObligation({ code: `SBO-LA${stamp % 100000}`, sourceAmount: "500", sourceCurrency: "AZN", aznAmount: "500", fxRate: "1" });
    const adj = await fin.post(`${FIN}/obligations/${adjOb.code}/adjust`).send({ newAznAmount: "650", reason: "ledger" }).expect(200);
    expect(adj.body.aznAmount).toBe("650");
    const adjLedger = await prisma.ledgerTransaction.findFirst({
      where: { sourceType: "OBLIGATION", sourceId: adjOb.id, type: "OBLIGATION_ADJUSTED" },
    });
    expect(adjLedger).not.toBeNull();
    expect(adjLedger!.amount.toString()).toBe("650"); // AZN revaluation
    expect(adjLedger!.currency).toBe("AZN");
  });
});
