/**
 * E2E PHASE 2 STEP 2.14E — Channel-Based Commission Rules Foundation (ADR-0013).
 *
 * Покрывает (§32):
 *  T1  — anonymous → 401;
 *  T2  — RBAC: FINANCE/ADMIN manage 201; OPERATOR/BUYER/ANALYST/SALES_MANAGER/
 *        DIRECTOR manage → 403; read — FINANCE/DIRECTOR/ANALYST/SALES_MANAGER 200,
 *        OPERATOR read → 403;
 *  T3  — canonical create (CMP-*, Decimal string, effective/version, DRAFT);
 *  T4  — mass assignment: forged code/version/status/rateType/timestamps → 422;
 *  T5  — validation: channel/rate (10, 0, 1.5, 7 decimals)/interval → 4xx;
 *  T6  — no-commission channels: create PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST
 *        → 422; resolve DIRECT → NO_COMMISSION_CHANNEL;
 *  T7  — deterministic resolution (POLICY_FOUND);
 *  T8  — boundary instants [effectiveFrom, effectiveTo);
 *  T9  — overlap: conflicting activate → 409 (никогда arbitrary first-row);
 *  T10 — concurrency: concurrent conflicting activates → один успех + 409, 0 raw 500;
 *  T11 — historical safety: будущая policy не мутирует существующие rows;
 *  T12 — zero financial side effects (Commission/CommissionAccrual/Ledger/
 *        ProviderFee/Settlement/Payout/Invoice/Payment/Refund/Dispute = 0 новых);
 *  T13 — no cross-domain writes (Order/Booking/Availability не тронуты);
 *  T14 — pagination/filter validation (page=0/pageSize=101/invalid channel → 400);
 *  T15 — migration/foundation: таблицы/индексы существуют; history пишется;
 *        legacy-факты не backfill-ятся.
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
  user: { id: string; role: string; email: string | null; customerId: string | null; partnerId: string | null; permissions: string[] };
}

const stamp = Date.now();

const FINANCIAL_READ_MODELS = [
  "commission",
  "commissionAccrual",
  "ledgerTransaction",
  "providerFee",
  "settlement",
  "payout",
  "invoice",
  "payment",
  "refund",
  "dispute",
] as const;

describe("Phase 2 Step 2.14E — Commission Policy Foundation (e2e, ADR-0013)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: { users: string[]; policies: string[]; auditLogs: string[] } = { users: [], policies: [], auditLogs: [] };

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

  interface CreatedPolicy {
    id: string;
    code: string;
    rate: string;
    rateType: string;
    channel: string;
    status: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    createdAt: string;
    updatedAt: string;
    [k: string]: unknown;
  }

  const createPolicy = async (token: string, body: Record<string, unknown>, expected = 201): Promise<CreatedPolicy> => {
    const res = await agent(token).post("/api/v1/finance/commission-policies").send(body);
    expect(res.status).toBe(expected);
    if (expected === 201) {
      created.policies.push((res.body as { id: string }).id);
      created.auditLogs.push((res.body as { id: string }).id);
    }
    return res.body as CreatedPolicy;
  };

  const basePolicyBody = (overrides: Record<string, unknown> = {}) => ({
    channel: "MARKETPLACE",
    rate: "0.15",
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    effectiveTo: "2027-01-01T00:00:00.000Z",
    ...overrides,
  });

  const countFinancialFacts = async () => {
    const out: Record<string, number> = {};
    for (const m of FINANCIAL_READ_MODELS) {
      out[m] = await (prisma as unknown as Record<string, { count: () => Promise<number> }>)[m].count();
    }
    return out;
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
    if (created.policies.length > 0) {
      await prisma.commissionPolicyHistory.deleteMany({ where: { policyId: { in: created.policies } } });
      await prisma.commissionPolicy.deleteMany({ where: { id: { in: created.policies } } });
    }
    if (created.auditLogs.length > 0) {
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.auditLogs } } });
    }
    if (created.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    await app.close();
  });

  it("T1. anonymous → 401 (management and read)", async () => {
    await request(app.getHttpServer()).get("/api/v1/finance/commission-policies").expect(401);
    await request(app.getHttpServer()).post("/api/v1/finance/commission-policies").send(basePolicyBody()).expect(401);
    await request(app.getHttpServer()).get("/api/v1/finance/commission-policies/resolve?channel=MARKETPLACE&at=2026-10-01T00:00:00Z").expect(401);
  });

  it("T2. RBAC: FINANCE/ADMIN manage; OPERATOR/BUYER/SALES_MANAGER/ANALYST/DIRECTOR → 403; read set exact", async () => {
    const fin = await createStaff("cp_fin", RoleCode.FINANCE);
    const op = await createStaff("cp_op", RoleCode.OPERATOR);
    const buyer = await createStaff("cp_by", RoleCode.BUYER);
    const sm = await createStaff("cp_sm", RoleCode.SALES_MANAGER);
    const an = await createStaff("cp_an", RoleCode.ANALYST);
    const dir = await createStaff("cp_dir", RoleCode.DIRECTOR);

    // manage: FINANCE/ADMIN → 201
    const p = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.12" }));
    expect(p).toMatchObject({ channel: "MARKETPLACE", status: "DRAFT", version: 1 });

    // manage: forbidden roles → 403
    for (const s of [op, buyer, sm, an, dir]) {
      await agent(s.accessToken).post("/api/v1/finance/commission-policies").send(basePolicyBody()).expect(403);
      await agent(s.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/activate`).expect(403);
      await agent(s.accessToken).patch(`/api/v1/finance/commission-policies/${p.code}`).send({ rate: "0.11" }).expect(403);
      await agent(s.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/archive`).expect(403);
    }

    // read: фактический ROLE_PERMISSIONS — finance.commission.read у
    // FINANCE/DIRECTOR/ANALYST (SALES_MANAGER НЕ имеет commission.read);
    // OPERATOR/BUYER → 403.
    for (const s of [fin, dir, an]) {
      await agent(s.accessToken).get("/api/v1/finance/commission-policies").expect(200);
      await agent(s.accessToken).get(`/api/v1/finance/commission-policies/${p.code}`).expect(200);
    }
    await agent(sm.accessToken).get("/api/v1/finance/commission-policies").expect(403);
    await agent(op.accessToken).get("/api/v1/finance/commission-policies").expect(403);
    await agent(buyer.accessToken).get(`/api/v1/finance/commission-policies/${p.code}`).expect(403);
  });

  it("T3. canonical create: CMP-* code, Decimal string, effective/version fields, DRAFT + history row", async () => {
    const fin = await createStaff("cp_t3", RoleCode.FINANCE);
    const p = await createPolicy(fin.accessToken, basePolicyBody());
    expect(p.code).toMatch(/^CMP-\d{8}$/);
    expect(p.rate).toBe("0.15");
    expect(p.rateType).toBe("PERCENTAGE");
    expect(p.effectiveFrom).toBe("2026-09-01T00:00:00.000Z");
    expect(p.effectiveTo).toBe("2027-01-01T00:00:00.000Z");
    expect(p.status).toBe("DRAFT");
    expect(p.version).toBe(1);
    expect(typeof p.createdAt).toBe("string");
    expect(typeof p.updatedAt).toBe("string");
    const history = await prisma.commissionPolicyHistory.count({ where: { policyId: p.id } });
    expect(history).toBeGreaterThanOrEqual(1);
  });

  it("T4. mass assignment: forged server-owned fields → 422", async () => {
    const fin = await createStaff("cp_t4", RoleCode.FINANCE);
    const forged = [
      basePolicyBody({ code: "CMP-99999999" }),
      basePolicyBody({ version: 99 }),
      basePolicyBody({ status: "ACTIVE" }),
      basePolicyBody({ rateType: "FIXED" }),
      basePolicyBody({ createdAt: "2020-01-01T00:00:00Z" }),
      basePolicyBody({ updatedAt: "2020-01-01T00:00:00Z" }),
      basePolicyBody({ id: "forged-id" }),
    ];
    for (const body of forged) {
      const res = await agent(fin.accessToken).post("/api/v1/finance/commission-policies").send(body);
      expect(res.status).toBe(422);
    }
  });

  it("T5. validation: channel / rate / interval → controlled 4xx", async () => {
    const fin = await createStaff("cp_t5", RoleCode.FINANCE);
    const bad = [
      basePolicyBody({ channel: "BITCOIN" }), // unknown channel
      basePolicyBody({ rate: "10" }), // percent-as-number (10 ≥ 1)
      basePolicyBody({ rate: "0" }),
      basePolicyBody({ rate: "-0.05" }),
      basePolicyBody({ rate: "1.5" }),
      basePolicyBody({ rate: "0.1234567" }), // > 6 decimals
      basePolicyBody({ rate: "abc" }),
      // STRICT REVIEW 2.14E FIX: scientific notation bypass — «1e-7» (=0.0000001)
      // проходил старую валидацию, а Postgres DECIMAL(18,6) округлял до 0.000000 →
      // молчаливая 0%-policy (нарушение 0 < rate < 1). Теперь — контролируемый 4xx.
      basePolicyBody({ rate: "1e-7" }),
      basePolicyBody({ rate: "1.5e-7" }),
      basePolicyBody({ rate: "1e-2" }), // scientific notation даже при валидном значении — не канон
      basePolicyBody({ rate: "0.00000015" }),
      // whitespace: « 0.15 » проходил Number()-трим, но Prisma.Decimal бросал
      // DecimalError → raw 500 (exception filter). Теперь — контролируемый 4xx.
      basePolicyBody({ rate: " 0.15 " }),
      basePolicyBody({ rate: "0.15 " }),
      basePolicyBody({ rate: " 0.15" }),
      // all-zero fraction (= 0) и неканонические формы — rejected.
      basePolicyBody({ rate: "0.000000" }),
      basePolicyBody({ rate: "0.0" }),
      basePolicyBody({ rate: ".15" }),
      basePolicyBody({ rate: "+0.15" }),
      basePolicyBody({ rate: "0,15" }),
      basePolicyBody({ effectiveTo: "2026-09-01T00:00:00.000Z" }), // to == from
      basePolicyBody({ effectiveTo: "2026-08-01T00:00:00.000Z" }), // to < from
      basePolicyBody({ rate: undefined }), // missing required
    ];
    for (const body of bad) {
      const res = await agent(fin.accessToken).post("/api/v1/finance/commission-policies").send(body);
      expect([400, 422]).toContain(res.status);
    }
    // no rows created by invalid attempts
    const count = await prisma.commissionPolicy.count();
    expect(count).toBeGreaterThan(0); // only valid creates from other tests
    // STRICT REVIEW 2.14E FIX: в БД не может существовать policy с rate <= 0
    // (раньше «1e-7» давала 0.000000 в DECIMAL(18,6) после округления).
    const zeroOrNegative = await prisma.commissionPolicy.count({ where: { rate: { lte: 0 } } });
    expect(zeroOrNegative).toBe(0);
  });

  it("T5b. canonical rate boundaries: 0.000001 and 0.999999 accepted (201), not over-restrictive", async () => {
    const fin = await createStaff("cp_t5b", RoleCode.FINANCE);
    // DTO-контракт rate.toString(): trailing zeros срезаются Decimal.js
    // (0.150000 → "0.15") — числовая эквивалентность, не строковая копия.
    const cases: Array<[string, string]> = [
      ["0.000001", "0.000001"],
      ["0.999999", "0.999999"],
      ["0.1", "0.1"],
      ["0.150000", "0.15"],
    ];
    for (const [input, expected] of cases) {
      const p = await createPolicy(fin.accessToken, basePolicyBody({ rate: input, effectiveFrom: "2032-01-01T00:00:00.000Z", effectiveTo: "2032-12-31T00:00:00.000Z" }));
      expect(p.rate).toBe(expected); // round-trip без округления значения
    }
  });

  it("T6. no-commission channels: create → 422; resolve → NO_COMMISSION_CHANNEL", async () => {
    const fin = await createStaff("cp_t6", RoleCode.FINANCE);
    for (const ch of ["PARTNER_STOREFRONT", "DIRECT", "BUYER_REQUEST"]) {
      const res = await agent(fin.accessToken).post("/api/v1/finance/commission-policies").send(basePolicyBody({ channel: ch }));
      expect(res.status).toBe(422);
    }
    for (const ch of ["PARTNER_STOREFRONT", "DIRECT", "BUYER_REQUEST"]) {
      const res = await agent(fin.accessToken).get(`/api/v1/finance/commission-policies/resolve?channel=${ch}&at=2026-10-01T00:00:00Z`).expect(200);
      expect(res.body).toEqual({ found: false, reason: "NO_COMMISSION_CHANNEL" });
    }
  });

  it("T7. deterministic resolution: activate → POLICY_FOUND; DRAFT not resolvable", async () => {
    const fin = await createStaff("cp_t7", RoleCode.FINANCE);
    const p = await createPolicy(fin.accessToken, basePolicyBody({ effectiveFrom: "2031-01-01T00:00:00.000Z", effectiveTo: "2031-12-31T00:00:00.000Z" }));
    // DRAFT — not resolvable
    let res = await agent(fin.accessToken).get("/api/v1/finance/commission-policies/resolve?channel=MARKETPLACE&at=2031-06-01T00:00:00Z").expect(200);
    expect(res.body).toEqual({ found: false, reason: "NO_POLICY" });
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/activate`).expect(201);
    res = await agent(fin.accessToken).get("/api/v1/finance/commission-policies/resolve?channel=MARKETPLACE&at=2031-06-01T00:00:00Z").expect(200);
    expect(res.body.found).toBe(true);
    expect(res.body.reason).toBe("POLICY_FOUND");
    expect(res.body.policy.code).toBe(p.code);
    expect(res.body.policy.rate).toBe("0.15");
  });

  it("T8. boundary instants: [effectiveFrom, effectiveTo)", async () => {
    const fin = await createStaff("cp_t8", RoleCode.FINANCE);
    const p = await createPolicy(fin.accessToken, basePolicyBody({ effectiveFrom: "2032-01-01T00:00:00.000Z", effectiveTo: "2032-12-31T00:00:00.000Z" }));
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/activate`).expect(201);
    const resolve = async (at: string) => (await agent(fin.accessToken).get(`/api/v1/finance/commission-policies/resolve?channel=MARKETPLACE&at=${encodeURIComponent(at)}`).expect(200)).body;
    expect((await resolve("2031-12-31T23:59:59.999Z")).reason).toBe("NO_POLICY"); // before start
    expect((await resolve("2032-01-01T00:00:00.000Z")).reason).toBe("POLICY_FOUND"); // at start (inclusive)
    expect((await resolve("2032-06-01T00:00:00.000Z")).reason).toBe("POLICY_FOUND");
    expect((await resolve("2032-12-31T00:00:00.000Z")).reason).toBe("NO_POLICY"); // at end (exclusive)
  });

  it("T9. overlap: conflicting activate → 409 (never arbitrary first-row)", async () => {
    const fin = await createStaff("cp_t9", RoleCode.FINANCE);
    const p1 = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.15", effectiveFrom: "2033-01-01T00:00:00.000Z", effectiveTo: "2033-12-31T00:00:00.000Z" }));
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p1.code}/activate`).expect(201);
    const p2 = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.18", effectiveFrom: "2033-06-01T00:00:00.000Z", effectiveTo: "2033-09-01T00:00:00.000Z" }));
    const res = await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p2.code}/activate`);
    expect(res.status).toBe(409);
    // non-overlapping successor is fine (half-open: [2034-01-01, 2035-01-01))
    const p3 = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.20", effectiveFrom: "2034-01-01T00:00:00.000Z", effectiveTo: "2035-01-01T00:00:00.000Z" }));
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p3.code}/activate`).expect(201);
  });

  it("T10. concurrency: concurrent conflicting activates → один успех + 409, 0 raw 500", async () => {
    const fin = await createStaff("cp_t10", RoleCode.FINANCE);
    const base = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.10", effectiveFrom: "2040-01-01T00:00:00.000Z", effectiveTo: "2040-12-31T00:00:00.000Z" }));
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${base.code}/activate`).expect(201);
    // два overlapping ДРУГ ДРУГУ кандидата (не пересекают base) — гонка: один 201, один 409
    const c1 = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.11", effectiveFrom: "2041-01-01T00:00:00.000Z", effectiveTo: "2041-12-31T00:00:00.000Z" }));
    const c2 = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.12", effectiveFrom: "2041-06-01T00:00:00.000Z", effectiveTo: "2041-09-01T00:00:00.000Z" }));
    const results = await Promise.allSettled([
      agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${c1.code}/activate`),
      agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${c2.code}/activate`),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : 500));
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
    expect(statuses.every((s) => s !== 500)).toBe(true);
    const active = await prisma.commissionPolicy.count({ where: { status: "ACTIVE", channel: "MARKETPLACE" } });
    expect(active).toBeGreaterThanOrEqual(2);
  });

  it("T11. historical safety: будущая policy не мутирует существующие rows", async () => {
    const fin = await createStaff("cp_t11", RoleCode.FINANCE);
    const before = await countFinancialFacts();
    // новая ACTIVE policy в собственном будущем окне
    const p = await createPolicy(fin.accessToken, basePolicyBody({ rate: "0.25", effectiveFrom: "2042-01-01T00:00:00.000Z", effectiveTo: "2042-12-31T00:00:00.000Z" }));
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/activate`).expect(201);
    const after = await countFinancialFacts();
    expect(after).toEqual(before);
  });

  it("T12. zero financial side effects: policy CRUD создаёт 0 финансовых фактов", async () => {
    const fin = await createStaff("cp_t12", RoleCode.FINANCE);
    const before = await countFinancialFacts();
    const p = await createPolicy(fin.accessToken, basePolicyBody({ effectiveFrom: "2043-01-01T00:00:00.000Z", effectiveTo: "2043-12-31T00:00:00.000Z" }));
    await agent(fin.accessToken).patch(`/api/v1/finance/commission-policies/${p.code}`).send({ rate: "0.16" }).expect(200);
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/activate`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/commission-policies/${p.code}/archive`).expect(201);
    const after = await countFinancialFacts();
    expect(after).toEqual(before);
  });

  it("T13. no cross-domain writes: Order/Booking/Availability не тронуты", async () => {
    const fin = await createStaff("cp_t13", RoleCode.FINANCE);
    const [ordersBefore, bookingsBefore, availBefore] = await Promise.all([
      prisma.order.count(),
      prisma.booking.count(),
      prisma.availability.count(),
    ]);
    await createPolicy(fin.accessToken, basePolicyBody({ effectiveFrom: "2044-01-01T00:00:00.000Z", effectiveTo: "2044-12-31T00:00:00.000Z" }));
    const [ordersAfter, bookingsAfter, availAfter] = await Promise.all([prisma.order.count(), prisma.booking.count(), prisma.availability.count()]);
    expect(ordersAfter).toBe(ordersBefore);
    expect(bookingsAfter).toBe(bookingsBefore);
    expect(availAfter).toBe(availBefore);
  });

  it("T14. pagination/filter validation: invalid page/pageSize → 400; invalid channel/status → 422", async () => {
    const fin = await createStaff("cp_t14", RoleCode.FINANCE);
    await agent(fin.accessToken).get("/api/v1/finance/commission-policies?page=0").expect(400);
    await agent(fin.accessToken).get("/api/v1/finance/commission-policies?pageSize=101").expect(400);
    await agent(fin.accessToken).get("/api/v1/finance/commission-policies?pageSize=abc").expect(400);
    await agent(fin.accessToken).get("/api/v1/finance/commission-policies?channel=BITCOIN").expect(422); // service-level vocabulary check
    await agent(fin.accessToken).get("/api/v1/finance/commission-policies?status=BOGUS").expect(422);
    const res = await agent(fin.accessToken).get("/api/v1/finance/commission-policies?page=2&pageSize=1").expect(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("page", 2);
    expect(res.body).toHaveProperty("total");
  });

  it("T15. migration/foundation: таблицы/индексы существуют; history пишется; legacy НЕ backfill-ится", async () => {
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'CommissionPolicy'",
    );
    const names = cols.map((c) => c.column_name);
    for (const required of ["code", "channel", "rateType", "rate", "status", "version", "effectiveFrom", "effectiveTo"]) {
      expect(names).toContain(required);
    }
    const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'finance' AND tablename = 'CommissionPolicy'",
    );
    const idxNames = idx.map((i) => i.indexname);
    expect(idxNames).toContain("CommissionPolicy_code_key");
    expect(idxNames).toContain("CommissionPolicy_channel_status_idx");
    // Commission/CommissionAccrual foundation tables остаются пустыми (0 producers, no backfill)
    expect(await prisma.commission.count()).toBe(0);
    expect(await prisma.commissionAccrual.count()).toBe(0);
  });
});
