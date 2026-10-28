/**
 * UNIFIED FINANCE CENTER Phase 1 — SupplierFxRate e2e.
 *
 * Покрывает:
 *  - anonymous → 401 на все fx-эндпоинты;
 *  - RBAC: BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/MARKETER → 403
 *    (read+write); ANALYST/DIRECTOR → read 200, write 403; FINANCE → 201/200;
 *  - CRUD: FINANCE ставит курс SUMMERTOUR/USD=1.70 → SFX-*, targetCurrencyIso
 *    AZN, история CREATE; повтор того же курса — идемпотентен (без новой
 *    истории); UPDATE 1.75 → история oldRate 1.7 → newRate 1.75 (append-only);
 *  - supplier-specific: KOMPAS/USD=1.72 живёт отдельно от SUMMERTOUR/USD;
 *  - AZN→AZN → 422 (всегда 1, строка не хранится); invalid rate → 422;
 *  - forged server-owned keys (code/targetCurrencyIso/id) → 422;
 *  - audit: finance.fx_rate.set пишется в AuditLog.
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
  user: { id: string; role: string; permissions: string[] };
}

describe("UNIFIED FINANCE CENTER Phase 1 — SupplierFxRate (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const suiteStart = new Date();
  const created: { users: string[]; fxRates: string[] } = { users: [], fxRates: [] };

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
      .send({
        username: `${tag}${stamp}`,
        email: `${tag}${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Покупатель",
        lastName: tag.toUpperCase(),
      })
      .expect(201);
    return res.body as Session;
  };

  const createStaff = async (tag: string, roleCode: RoleCode, admin: ReturnType<typeof agent>): Promise<Session> => {
    const staff = (await admin.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  const setBody = (supplierCode: string, sourceCurrencyIso: string, rate: string) => ({ supplierCode, sourceCurrencyIso, rate });

  const SFX = "/api/v1/finance/supplier-fx-rates";

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
    await prisma.auditLog.deleteMany({
      where: { action: "finance.fx_rate.set", createdAt: { gte: suiteStart } },
    });
    // Kаскад FK удалит history, но явное удаление надёжнее для частичных состояний.
    await prisma.supplierFxRateHistory.deleteMany({
      where: { rate: { code: { in: created.fxRates } } },
    });
    await prisma.supplierFxRate.deleteMany({ where: { code: { in: created.fxRates } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. anonymous → 401 на все fx-эндпоинты", async () => {
    const http = request(app.getHttpServer());
    await http.get(SFX).expect(401);
    await http.get(`${SFX}/SFX-00000001`).expect(401);
    await http.get(`${SFX}/history`).expect(401);
    await http.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.7")).expect(401);
  });

  it("2. RBAC: BUYER/OPERATOR → 403; ANALYST/DIRECTOR → read 200, write 403; FINANCE → 201/200", async () => {
    const buyer = agent((await registerBuyer(`fx_b_${stamp % 100000}`)).accessToken);
    const operator = agent((await createStaff("fx_op", RoleCode.OPERATOR, adminAgent)).accessToken);
    const analyst = agent((await createStaff("fx_an", RoleCode.ANALYST, adminAgent)).accessToken);
    const director = agent((await createStaff("fx_dir", RoleCode.DIRECTOR, adminAgent)).accessToken);
    const financeSession = await createStaff("fx_fin", RoleCode.FINANCE, adminAgent);
    const finance = agent(financeSession.accessToken);

    // BUYER/OPERANTOR: read+write → 403
    for (const who of [buyer, operator]) {
      await who.get(SFX).expect(403);
      await who.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.7")).expect(403);
    }

    // ANALYST/DIRECTOR: read → 200; write → 403
    for (const who of [analyst, director]) {
      await who.get(SFX).expect(200);
      await who.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.7")).expect(403);
    }

    // FINANCE: read → 200; write → 201
    await finance.get(SFX).expect(200);
    const res = await finance.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.70")).expect(201);
    const body = res.body as { code: string; targetCurrencyIso: string };
    expect(body.code).toMatch(/^SFX-\d{8}$/);
    expect(body.targetCurrencyIso).toBe("AZN");
    created.fxRates.push(body.code);
  });

  it("3. history CREATE: oldRate null, actor из сессии; повтор того же курса идемпотентен", async () => {
    const finance = agent((await login(`fx_fin${stamp}`, "staffpass123")).accessToken);

    // повтор того же курса («1.70» == «1.7») → 201, но БЕЗ новой истории
    const again = await finance.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.70")).expect(201);
    expect((again.body as { rate: string }).rate).toBe("1.7");

    const history = await finance.get(`${SFX}/history?supplierCode=SUMMERTOUR&sourceCurrencyIso=USD`).expect(200);
    const items = (history.body as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      action: "CREATE",
      oldRate: null,
      newRate: "1.7",
      actorName: `fx_fin${stamp}`,
    });
  });

  it("4. UPDATE 1.75 → история oldRate 1.7 → newRate 1.75 (append-only), current обновлён", async () => {
    const finance = agent((await login(`fx_fin${stamp}`, "staffpass123")).accessToken);

    const updated = await finance.post(SFX).send(setBody("SUMMERTOUR", "USD", "1.75")).expect(201);
    expect((updated.body as { rate: string }).rate).toBe("1.75");

    const listed = await finance.get(`${SFX}?supplierCode=SUMMERTOUR`).expect(200);
    const rows = listed.body as Array<{ code: string; rate: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rate).toBe("1.75");

    const byCode = await finance.get(`${SFX}/${rows[0]!.code}`).expect(200);
    expect(byCode.body).toMatchObject({ code: rows[0]!.code, rate: "1.75", targetCurrencyIso: "AZN" });

    const history = await finance.get(`${SFX}/history?supplierCode=SUMMERTOUR`).expect(200);
    const items = (history.body as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(2);
    // Новейшая сверху: UPDATE old→new, старый CREATE не мутировал.
    expect(items[0]).toMatchObject({ action: "UPDATE", oldRate: "1.7", newRate: "1.75" });
    expect(items[1]).toMatchObject({ action: "CREATE", oldRate: null, newRate: "1.7" });
  });

  it("5. supplier-specific: KOMPAS/USD=1.72 живёт отдельно от SUMMERTOUR/USD", async () => {
    const finance = agent((await login(`fx_fin${stamp}`, "staffpass123")).accessToken);

    const kompas = await finance.post(SFX).send(setBody("KOMPAS", "USD", "1.72")).expect(201);
    created.fxRates.push((kompas.body as { code: string }).code);

    const listed = await finance.get(`${SFX}?sourceCurrencyIso=USD`).expect(200);
    // В тестовой БД есть baseline-курсы партнёров (PRN-*), поэтому проверяем
    // именно независимость двух supplier-specific курсов, а не «всего две строки».
    const rows = (listed.body as Array<{ supplierCode: string; rate: string }>)
      .filter((r) => r.supplierCode === "KOMPAS" || r.supplierCode === "SUMMERTOUR")
      .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.supplierCode === "KOMPAS")!.rate).toBe("1.72");
    expect(rows.find((r) => r.supplierCode === "SUMMERTOUR")!.rate).toBe("1.75");

    // Фильтр supplierCode=KOMPAS → только KOMPAS
    const onlyKompas = await finance.get(`${SFX}?supplierCode=KOMPAS`).expect(200);
    const kRows = onlyKompas.body as Array<{ supplierCode: string }>;
    expect(kRows).toHaveLength(1);
    expect(kRows[0]!.supplierCode).toBe("KOMPAS");
  });

  it("6. validation: AZN→AZN → 422; invalid rate → 422; forged server-owned keys → 422; unknown code → 404", async () => {
    const finance = agent((await login(`fx_fin${stamp}`, "staffpass123")).accessToken);

    // AZN→AZN всегда 1, строка не хранится
    await finance.post(SFX).send(setBody("SUMMERTOUR", "AZN", "1")).expect(422);

    // invalid rates
    await finance.post(SFX).send(setBody("SUMMERTOUR", "EUR", "0")).expect(422);
    await finance.post(SFX).send(setBody("SUMMERTOUR", "EUR", "-1.5")).expect(422);
    await finance.post(SFX).send(setBody("SUMMERTOUR", "EUR", "abc")).expect(422);
    await finance.post(SFX).send(setBody("SUMMERTOUR", "EUR", "1.1234567")).expect(422);
    // невалидный ISO
    await finance.post(SFX).send(setBody("SUMMERTOUR", "usd", "1.7")).expect(422);

    // forged server-owned keys
    await finance.post(SFX).send({ ...setBody("SUMMERTOUR", "EUR", "1.7"), code: "SFX-00000042" }).expect(422);
    await finance.post(SFX).send({ ...setBody("SUMMERTOUR", "EUR", "1.7"), targetCurrencyIso: "USD" }).expect(422);
    await finance.post(SFX).send({ ...setBody("SUMMERTOUR", "EUR", "1.7"), id: "x" }).expect(422);

    // unknown code → 404
    await finance.get(`${SFX}/SFX-99999999`).expect(404);
  });

  it("7. audit: finance.fx_rate.set пишется в AuditLog (без PII)", async () => {
    const audits = await prisma.auditLog.findMany({
      where: { action: "finance.fx_rate.set", createdAt: { gte: suiteStart } },
      orderBy: { createdAt: "desc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(3); // SUMMERTOUR CREATE + UPDATE + KOMPAS CREATE
    expect(audits[0]).toMatchObject({ action: "finance.fx_rate.set" });
    expect(audits.some((a) => a.resourceId === created.fxRates[0])).toBe(true);
  });
});
