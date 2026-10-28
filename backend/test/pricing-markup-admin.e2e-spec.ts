/**
 * SUPPLIER MARKUP PHASE 4 §4.1/§4.2 (e2e) — Admin Markup Matrix + MarkupRule UX.
 *
 * T1 — anonymous → 401 (matrix + rules read/manage);
 * T2 — RBAC: read — FINANCE/DIRECTOR/ANALYST 200, OPERATOR/BUYER/SALES_MANAGER
 *      403; manage — FINANCE 201, остальные роли 403 (Gate J: только
 *      pricing.markup.*);
 * T3 — matrix строится из РЕЕСТРОВ реального приложения (ANEX/KOMPAS +
 *      flights-поставщики, колонки tours/hotels/flights, JSON-safe rate
 *      строки, ячейка только для поддерживаемой пары);
 * T4 — DRAFT не резолвится (NOT_CONFIGURED) → activate → CONFIGURED cell
 *      (rate/ruleCode/version) → archive → снова NOT_CONFIGURED;
 * T5 — CAS: update со stale expectedVersion → 409; update ACTIVE → 422;
 * T6 — overlap: second ACTIVE covering тот же key → 409; archive → activate;
 * T7 — mass assignment: forged server-owned поля → 422;
 * T8 — validation: rate-канон/период → контролируемый 4xx;
 * T9 — MarkupRuleHistory пишется на каждый шаг lifecycle.
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

interface MatrixCell {
  supplierCode: string;
  serviceType: string;
  state: "CONFIGURED" | "NOT_CONFIGURED";
  rate: string;
  ruleCode: string | null;
  ruleVersion: number | null;
}

interface MarkupMatrixBody {
  at: string;
  services: string[];
  suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: MatrixCell[];
}

interface CreatedRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  rate: string;
  status: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

const stamp = Date.now();
const PAST = "2026-01-01T00:00:00.000Z";

describe("Supplier Markup Phase 4 §4.1/§4.2 — Admin Markup Matrix + Rule UX (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let finToken: string;
  let fin: ReturnType<typeof request.agent>;
  const created: { users: string[]; rules: string[] } = { users: [], rules: [] };

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
    const staff = (await fin.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  const ruleBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    supplierCode: "KOMPAS",
    serviceType: "tours",
    rate: "0.08",
    effectiveFrom: PAST,
    ...overrides,
  });

  const createRule = async (body: Record<string, unknown>, expected = 201): Promise<CreatedRule> => {
    const res = await fin.post("/api/v1/pricing/markup-rules").send(body);
    expect(res.status).toBe(expected);
    if (expected === 201) created.rules.push((res.body as CreatedRule).id);
    return res.body as CreatedRule;
  };

  const getMatrix = async (token: string, expected = 200): Promise<MarkupMatrixBody> => {
    const res = await agent(token).get("/api/v1/pricing/markup-matrix");
    expect(res.status).toBe(expected);
    return res.body as MarkupMatrixBody;
  };

  const cellOf = (matrix: MarkupMatrixBody, supplierCode: string, serviceType: string): MatrixCell | undefined =>
    matrix.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const admin = await login("admin", "admin123");
    finToken = admin.accessToken;
    fin = agent(admin.accessToken);
  });

  afterAll(async () => {
    if (created.rules.length > 0) {
      await prisma.markupRuleHistory.deleteMany({ where: { ruleId: { in: created.rules } } });
      await prisma.markupRule.deleteMany({ where: { id: { in: created.rules } } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.rules } } });
    }
    if (created.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    await app.close();
  });

  it("T1. anonymous → 401 (matrix read + rule management)", async () => {
    await request(app.getHttpServer()).get("/api/v1/pricing/markup-matrix").expect(401);
    await request(app.getHttpServer()).get("/api/v1/pricing/markup-rules").expect(401);
    await request(app.getHttpServer()).post("/api/v1/pricing/markup-rules").send(ruleBody()).expect(401);
  });

  it("T2. RBAC: read = FINANCE/DIRECTOR/ANALYST; manage = FINANCE only", async () => {
    const analyst = await createStaff("mk_an", RoleCode.ANALYST);
    const director = await createStaff("mk_dir", RoleCode.DIRECTOR);
    const operator = await createStaff("mk_op", RoleCode.OPERATOR);
    const buyer = await createStaff("mk_by", RoleCode.BUYER);
    const sm = await createStaff("mk_sm", RoleCode.SALES_MANAGER);

    // read 200
    await getMatrix(finToken);
    await getMatrix(analyst.accessToken);
    await getMatrix(director.accessToken);
    // read 403
    await getMatrix(operator.accessToken, 403);
    await getMatrix(buyer.accessToken, 403);
    await getMatrix(sm.accessToken, 403);

    // manage 201 (FINANCE) — created rule used for later cleanup bookkeeping
    const r = await createRule(ruleBody({ rate: "0.09" }));
    expect(r).toMatchObject({ status: "DRAFT", version: 1, rate: "0.09" });

    // manage 403 for the remaining roles
    for (const s of [analyst, director, operator, buyer, sm]) {
      await agent(s.accessToken).post("/api/v1/pricing/markup-rules").send(ruleBody()).expect(403);
      await agent(s.accessToken).post(`/api/v1/pricing/markup-rules/${r.code}/activate`).expect(403);
      await agent(s.accessToken).patch(`/api/v1/pricing/markup-rules/${r.code}`).send({ rate: "0.1" }).expect(403);
      await agent(s.accessToken).post(`/api/v1/pricing/markup-rules/${r.code}/archive`).expect(403);
    }
  });

  it("T3. matrix built from live registries: suppliers/columns dynamic, JSON-safe cells", async () => {
    const m = await getMatrix(finToken);

    expect(typeof m.at).toBe("string");
    // adapter-реестр: tours (SUMMERTOUR/KOMPAS/KAZUNION/ANEX) + hotels (ANEX)
    expect(m.services).toEqual(expect.arrayContaining(["tours", "hotels"]));
    // FlightSupplierRegistry: хотя бы один flights-поставщик
    expect(m.services).toContain("flights");
    expect(m.suppliers.map((s) => s.code)).toEqual(expect.arrayContaining(["ANEX", "KOMPAS"]));
    expect(m.suppliers.every((s) => typeof s.name === "string" && s.name.length > 0)).toBe(true);

    // supported pairs only: KOMPAS теперь покрывает и tours, и hotels;
    // flights у KOMPAS не поддерживается (реестр живой, отрицательный контроль).
    expect(cellOf(m, "KOMPAS", "tours")).toBeDefined();
    expect(cellOf(m, "KOMPAS", "hotels")).toBeDefined();
    expect(cellOf(m, "KOMPAS", "flights")).toBeUndefined();
    // хотя бы одна flights-ячейка (реестр живой)
    expect(m.cells.some((c) => c.serviceType === "flights")).toBe(true);

    // JSON-safe: rate — строка, никаких Decimal-объектов, state — enum
    for (const c of m.cells) {
      expect(typeof c.rate).toBe("string");
      expect(c.rate).toMatch(/^0(\.\d{1,6})?$/);
      expect(["CONFIGURED", "NOT_CONFIGURED"]).toContain(c.state);
      expect(c.ruleCode === null || typeof c.ruleCode === "string").toBe(true);
      expect(c.ruleVersion === null || typeof c.ruleVersion === "number").toBe(true);
    }
  });

  it("T4. DRAFT → NOT_CONFIGURED cell; activate → CONFIGURED; archive → NOT_CONFIGURED", async () => {
    const draft = await createRule(ruleBody({ rate: "0.075" }));
    expect(draft.code).toMatch(/^MKR-\d{8}$/);

    const m1 = await getMatrix(finToken);
    const before = cellOf(m1, "KOMPAS", "tours");
    expect(before?.state).toBe("NOT_CONFIGURED");
    expect(before?.rate).toBe("0");

    await fin.post(`/api/v1/pricing/markup-rules/${draft.code}/activate`).expect(201);
    const m2 = await getMatrix(finToken);
    const active = cellOf(m2, "KOMPAS", "tours");
    expect(active).toMatchObject({
      state: "CONFIGURED",
      rate: "0.075",
      ruleCode: draft.code,
      ruleVersion: draft.version,
    });

    await fin.post(`/api/v1/pricing/markup-rules/${draft.code}/archive`).expect(201);
    const m3 = await getMatrix(finToken);
    const archived = cellOf(m3, "KOMPAS", "tours");
    expect(archived?.state).toBe("NOT_CONFIGURED");
    expect(archived?.rate).toBe("0");
  });

  it("T5. CAS: stale expectedVersion → 409; update ACTIVE → 422", async () => {
    const rule = await createRule(ruleBody({ rate: "0.12" }));
    const ok = await fin.patch(`/api/v1/pricing/markup-rules/${rule.code}`).send({ rate: "0.13", expectedVersion: 1 });
    expect(ok.status).toBe(200);
    expect((ok.body as CreatedRule).version).toBe(2);
    expect((ok.body as CreatedRule).rate).toBe("0.13");

    const stale = await fin.patch(`/api/v1/pricing/markup-rules/${rule.code}`).send({ rate: "0.14", expectedVersion: 1 });
    expect(stale.status).toBe(409);

    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/activate`).expect(201);
    const onActive = await fin.patch(`/api/v1/pricing/markup-rules/${rule.code}`).send({ rate: "0.15" });
    expect(onActive.status).toBe(422);
    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/archive`).expect(201);
  });

  it("T6. overlap: second covering ACTIVE rule → 409; archive first → activate passes", async () => {
    const first = await createRule(ruleBody({ rate: "0.05" }));
    await fin.post(`/api/v1/pricing/markup-rules/${first.code}/activate`).expect(201);

    const second = await createRule(ruleBody({ rate: "0.06" }));
    const clash = await fin.post(`/api/v1/pricing/markup-rules/${second.code}/activate`);
    expect(clash.status).toBe(409);
    expect(String((clash.body as { message?: string }).message)).toContain("already covers");

    await fin.post(`/api/v1/pricing/markup-rules/${first.code}/archive`).expect(201);
    await fin.post(`/api/v1/pricing/markup-rules/${second.code}/activate`).expect(201);
    await fin.post(`/api/v1/pricing/markup-rules/${second.code}/archive`).expect(201);
  });

  it("T7. mass assignment: forged server-owned fields → 422", async () => {
    const forged: Array<Record<string, unknown>> = [
      ruleBody({ code: "MKR-99999999" }),
      ruleBody({ status: "ACTIVE" }),
      ruleBody({ version: 99 }),
      ruleBody({ id: "forged-id" }),
      ruleBody({ createdAt: "2020-01-01T00:00:00Z" }),
    ];
    for (const body of forged) {
      const res = await fin.post("/api/v1/pricing/markup-rules").send(body);
      expect(res.status).toBe(422);
    }
  });

  it("T8. validation: rate canonical form + effective period → controlled 4xx", async () => {
    const bad: Array<[Record<string, unknown>, number]> = [
      [ruleBody({ rate: "10" }), 422], // percent-as-number
      [ruleBody({ rate: "-0.05" }), 422],
      [ruleBody({ rate: "0.1234567" }), 422], // > 6 decimals
      [ruleBody({ rate: "5%" }), 422],
      [ruleBody({ rate: "1e-2" }), 422], // scientific notation
      [ruleBody({ rate: " 0.15 " }), 422], // whitespace
      [ruleBody({ supplierCode: "bad supplier!" }), 422],
      [ruleBody({ serviceType: "Tours" }), 422], // registry-ключ case-sensitive
      [ruleBody({ rate: undefined }), 400], // DTO: missing required
      [ruleBody({ effectiveTo: PAST }), 422], // to <= from
    ];
    for (const [body, expected] of bad) {
      const res = await fin.post("/api/v1/pricing/markup-rules").send(body);
      expect(res.status).toBe(expected);
    }
    // explicit 0% — валиден (осознанный configured 0, design §3)
    const zero = await createRule(ruleBody({ rate: "0" }));
    expect(zero.rate).toBe("0");
  });

  it("T9. MarkupRuleHistory records every lifecycle step (create/update/activate/archive)", async () => {
    const rule = await createRule(ruleBody({ rate: "0.11" }));
    await fin.patch(`/api/v1/pricing/markup-rules/${rule.code}`).send({ rate: "0.111" }).expect(200);
    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/activate`).expect(201);
    await fin.post(`/api/v1/pricing/markup-rules/${rule.code}/archive`).expect(201);

    const res = await fin.get(`/api/v1/pricing/markup-rules/${rule.code}/history`).expect(200);
    const actions = (res.body as { items: Array<{ action: string }> }).items.map((i) => i.action);
    expect(actions).toEqual(["archived", "activated", "updated", "created"]);
  });
});
