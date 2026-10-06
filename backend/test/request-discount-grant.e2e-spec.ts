/**
 * SUPPLIER MARKUP PHASE 4 §4.3 (e2e) — Live Sales individual discount
 * (`POST /api/v1/requests/:id/discount`, sales.discount.grant).
 *
 * T1 — anonymous → 401; RBAC: ANALYST/OPERATOR → 403 (нет sales.discount.grant),
 *      SALES_MANAGER/FINANCE/ADMIN → 201; server-authoritative: скидка
 *      пересчитывает ТОЛЬКО commercialSnapshot (public/displayed не меняются);
 * T2 — floor: final < supplier price → 422, заявка не мутируется;
 * T3 — validation: неизвестный discountType → 422;
 * T4 — guard'ы: PRICE_CHANGED (pending supplier proposal), frozen snapshot,
 *      legacy заявка без snapshot → 422 с каноническими сообщениями;
 * T5 — history discount_granted + audit request.discount_granted (actor);
 * T6 — §4.6/§4.9.3 propagation: discount → frozen accept → convert →
 *      Order.commercialSnapshot verbatim (supplier/markup/public/discount/
 *      final/customerAcceptedAt); позднейший MarkupRule change НЕ мутирует
 *      принятый факт;
 * T7 — legacy без snapshot → Order.commercialSnapshot null; invalid money
 *      конверсию блокирует (money-gate не ослаблен).
 *
 * Order conversion money-gate (order.service:658-661) НЕ затрагивается.
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
import { buildWorkingSnapshot } from "../src/modules/pricing/commercial-snapshot";

interface Session {
  accessToken: string;
  user: { id: string; role: string; email: string | null; customerId: string | null; partnerId: string | null; permissions: string[] };
}

interface RequestDtoBody {
  id: string;
  status: string;
  convertedOrderId: string | null;
  displayedPrice: string | null;
  displayedCurrency: string | null;
  commercialSnapshot: {
    supplierPrice: number;
    publicPrice: number;
    customerFinalPrice: number;
    discountType?: string;
    discountAmount?: number;
    discountValue?: number | string;
    customerAcceptedAt?: string | null;
  } | null;
}

const stamp = Date.now();
const PAST = "2026-01-01T00:00:00.000Z";

function workingSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    ...buildWorkingSnapshot({
      supplierCode: "KOMPAS",
      serviceType: "tours",
      pricing: {
        supplierAmount: 1000,
        currency: "USD",
        markupRate: "0.05",
        markupAmount: 50,
        publicAmount: 1050,
        markupRuleCode: "MKR-00000001",
        markupRuleVersion: 1,
        configurationState: "CONFIGURED",
        calculatedAt: "2026-10-01T10:00:00.000Z",
      },
      supplierPriceFetchedAt: "2026-10-01T10:00:00.000Z",
      supplierPriceExpiresAt: "2026-10-01T10:15:00.000Z",
    }),
    ...overrides,
  };
}

describe("Supplier Markup Phase 4 §4.3 — Live Sales discount grant (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let admin: ReturnType<typeof request.agent>;
  const created: { users: string[]; requests: string[]; rules: string[] } = { users: [], requests: [], rules: [] };

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
    const staff = (await admin.post("/api/v1/users").send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode }).expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  let seq = 0;
  const seedRequest = async (overrides: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const row = await prisma.request.create({
      data: {
        code: `REQD${stamp}${seq}`,
        commerceSequence: `${90_000_000 + seq}${stamp}`.slice(0, 24),
        referenceNumber: `MKT-REQ-D${stamp}${seq}`,
        status: "NEW",
        requestedServiceDate: new Date("2026-11-01T00:00:00.000Z"),
        quantity: 1,
        displayedPrice: 1050,
        displayedCurrency: "USD",
        ...overrides,
      },
    });
    created.requests.push(row.id);
    return { id: row.id, code: row.code };
  };

  const seedSnapshotRequest = async (overrides: Record<string, unknown> = {}) =>
    seedRequest({
      commercialSnapshot: workingSnapshot() as unknown as Prisma.InputJsonValue,
      ...overrides,
    });

  const discount = (token: string, id: string, body: Record<string, unknown>) =>
    agent(token).post(`/api/v1/requests/${id}/discount`).send(body);

  const getDetail = async (id: string): Promise<RequestDtoBody> =>
    (await admin.get(`/api/v1/requests/${id}`).expect(200)).body as RequestDtoBody;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const session = await login("admin", "admin123");
    adminToken = session.accessToken;
    admin = agent(session.accessToken);
  });

  afterAll(async () => {
    if (created.rules.length > 0) {
      await prisma.markupRuleHistory.deleteMany({ where: { ruleId: { in: created.rules } } });
      await prisma.markupRule.deleteMany({ where: { id: { in: created.rules } } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.rules } } });
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    if (created.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    await app.close();
  });

  it("T1. anonymous → 401; RBAC: ANALYST/OPERATOR 403; SALES_MANAGER/FINANCE/ADMIN 201", async () => {
    const r = await seedSnapshotRequest();
    const analyst = await createStaff("ds_an", RoleCode.ANALYST);
    const operator = await createStaff("ds_op", RoleCode.OPERATOR);
    const sm = await createStaff("ds_sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("ds_fin", RoleCode.FINANCE);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${r.id}/discount`)
      .send({ discountType: "FIXED", discountValue: 10 })
      .expect(401);
    await discount(analyst.accessToken, r.id, { discountType: "FIXED", discountValue: 10 }).expect(403);
    await discount(operator.accessToken, r.id, { discountType: "FIXED", discountValue: 10 }).expect(403);

    // SALES_MANAGER → 201: snapshot-only discount (public/displayed untouched)
    const smRes = await discount(sm.accessToken, r.id, { discountType: "FIXED", discountValue: 30 }).expect(201);
    const smBody = smRes.body as RequestDtoBody;
    expect(smBody.commercialSnapshot?.customerFinalPrice).toBe(1020);
    expect(smBody.commercialSnapshot?.discountAmount).toBe(30);
    expect(smBody.commercialSnapshot?.publicPrice).toBe(1050);
    expect(smBody.displayedPrice).toBe("1050");

    // FINANCE → 201: PERCENTAGE пересчитывает от publicPrice (замена скидки)
    const finRes = await discount(fin.accessToken, r.id, { discountType: "PERCENTAGE", discountValue: 4 }).expect(201);
    expect((finRes.body as RequestDtoBody).commercialSnapshot?.customerFinalPrice).toBe(1008);

    // ADMIN (ALL) → 201
    const adminRes = await discount(adminToken, r.id, { discountType: "FIXED", discountValue: 10 }).expect(201);
    expect((adminRes.body as RequestDtoBody).commercialSnapshot?.customerFinalPrice).toBe(1040);

    // GET detail: displayedPrice/publicPrice по-прежнему 1050 (скидка — только в snapshot)
    const detail = await getDetail(r.id);
    expect(detail.displayedPrice).toBe("1050");
    expect(detail.commercialSnapshot?.publicPrice).toBe(1050);
    expect(detail.commercialSnapshot?.customerFinalPrice).toBe(1040);
    expect(detail.commercialSnapshot?.supplierPrice).toBe(1000);
  });

  it("T2. floor: FIXED 60 → 422 'final price < supplier price'; request not mutated", async () => {
    const r = await seedSnapshotRequest();

    const res = await discount(adminToken, r.id, { discountType: "FIXED", discountValue: 60 }).expect(422);
    expect(JSON.stringify(res.body)).toMatch(/final price < supplier price/);

    const detail = await getDetail(r.id);
    expect(detail.commercialSnapshot?.customerFinalPrice).toBe(1050);
    expect(detail.commercialSnapshot?.discountAmount).toBe(0);
    expect(detail.status).toBe("NEW");
  });

  it("T3. validation: unknown discountType → 422; no mutation", async () => {
    const r = await seedSnapshotRequest();

    const res = await discount(adminToken, r.id, { discountType: "CRYPTO", discountValue: 10 }).expect(422);
    expect(JSON.stringify(res.body)).toMatch(/invalid discountType/);

    const detail = await getDetail(r.id);
    expect(detail.commercialSnapshot?.customerFinalPrice).toBe(1050);
  });

  it("T4. guards: PRICE_CHANGED proposal pending / frozen snapshot / legacy no-snapshot → 422", async () => {
    const priceChanged = await seedSnapshotRequest({
      status: "PRICE_CHANGED",
      supplierPriceProposal: 1100,
      displayedPrice: 1100,
    });
    const res1 = await discount(adminToken, priceChanged.id, { discountType: "FIXED", discountValue: 10 }).expect(422);
    expect(JSON.stringify(res1.body)).toMatch(/supplier price proposal pending/);

    const frozen = await seedSnapshotRequest({
      status: "CUSTOMER_ACCEPTED",
      commercialSnapshot: workingSnapshot({ customerAcceptedAt: "2026-10-02T10:00:00.000Z" }) as unknown as Prisma.InputJsonValue,
    });
    const res2 = await discount(adminToken, frozen.id, { discountType: "FIXED", discountValue: 10 }).expect(422);
    expect(JSON.stringify(res2.body)).toMatch(/frozen/);

    const legacy = await seedRequest();
    const res3 = await discount(adminToken, legacy.id, { discountType: "FIXED", discountValue: 10 }).expect(422);
    expect(JSON.stringify(res3.body)).toMatch(/missing supplier price/);
  });

  it("T5. history discount_granted + audit request.discount_granted (actor)", async () => {
    const sm = await createStaff("ds_sm2", RoleCode.SALES_MANAGER);
    const r = await seedSnapshotRequest();

    await discount(sm.accessToken, r.id, { discountType: "FIXED", discountValue: 25 }).expect(201);

    const history = (await admin.get(`/api/v1/requests/${r.id}/history`).expect(200)).body as Array<{
      action: string;
      actorId: string | null;
      comment: string | null;
    }>;
    const entry = history.find((h) => h.action === "discount_granted");
    expect(entry).toBeDefined();
    expect(entry?.actorId).toBe(sm.user.id);
    expect(entry?.comment).toMatch(/1025/); // 1050 - 25

    const audit = await prisma.auditLog.findFirst({
      where: { resourceId: r.id, action: "request.discount_granted" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(sm.user.id);
  });

  it("T6. §4.6 propagation: discount → frozen accept → convert → Order.commercialSnapshot verbatim; later MarkupRule change не мутирует", async () => {
    const r = await seedSnapshotRequest();

    // Live Sales: скидка 30 → final 1020 (только snapshot)
    await discount(adminToken, r.id, { discountType: "FIXED", discountValue: 30 }).expect(201);

    // Supplier подтверждает (NEW → CONFIRMED), клиент принимает (frozen)
    await admin.post(`/api/v1/requests/${r.id}/confirm-price`).send({ note: "ok" }).expect(201);
    const accepted = (await admin.post(`/api/v1/requests/${r.id}/customer-accept`).expect(201)).body as RequestDtoBody;
    expect(accepted.commercialSnapshot?.customerFinalPrice).toBe(1020);
    expect(accepted.commercialSnapshot?.customerAcceptedAt).toBeTruthy();

    // Request → Order conversion (money-gate: confirmedPrice 1020/USD)
    await admin.post(`/api/v1/requests/${r.id}/convert`).expect(201);
    const detail = await getDetail(r.id);
    expect(detail.status).toBe("CONVERTED");
    expect(detail.convertedOrderId).toBeTruthy();

    const order = await prisma.order.findUnique({ where: { id: detail.convertedOrderId as string } });
    expect(order).not.toBeNull();
    expect(order?.amount.toString()).toBe("1020"); // money-gate: accepted money, не 0/missing
    const snap = order?.commercialSnapshot as Record<string, unknown> | null;
    expect(snap).not.toBeNull();
    expect(snap?.supplierPrice).toBe(1000);
    expect(snap?.supplierCurrency).toBe("USD");
    expect(snap?.markupRate).toBe("0.05");
    expect(snap?.publicPrice).toBe(1050);
    expect(snap?.discountAmount).toBe(30);
    expect(snap?.customerFinalPrice).toBe(1020);
    expect(snap?.customerCurrency).toBe("USD");
    expect(snap?.priceSource).toBe("PUBLIC");
    expect(typeof snap?.customerAcceptedAt).toBe("string");

    // Day 2: MarkupRule change (новый ACTIVE KOMPAS/tours 8%) — матрица
    // показывает 0.08, но принятый Order/Request snapshot НЕ пересчитывается.
    const ruleRes = await admin.post("/api/v1/pricing/markup-rules").send({
      supplierCode: "KOMPAS",
      serviceType: "tours",
      rate: "0.08",
      effectiveFrom: PAST,
    }).expect(201);
    const rule = ruleRes.body as { id: string; code: string };
    created.rules.push(rule.id);
    await admin.post(`/api/v1/pricing/markup-rules/${rule.code}/activate`).expect(201);

    const matrix = (await admin.get("/api/v1/pricing/markup-matrix").expect(200)).body as {
      cells: Array<{ supplierCode: string; serviceType: string; state: string; rate: string }>;
    };
    const cell = matrix.cells.find((c) => c.supplierCode === "KOMPAS" && c.serviceType === "tours");
    expect(cell).toMatchObject({ state: "CONFIGURED", rate: "0.08" });

    const orderAfter = await prisma.order.findUnique({ where: { id: detail.convertedOrderId as string } });
    const snapAfter = orderAfter?.commercialSnapshot as Record<string, unknown>;
    expect(snapAfter.markupRate).toBe("0.05");
    expect(snapAfter.customerFinalPrice).toBe(1020);
    expect(snapAfter.publicPrice).toBe(1050);
    const reqAfter = await getDetail(r.id);
    expect(reqAfter.commercialSnapshot?.customerFinalPrice).toBe(1020); // frozen Request тоже не мутировал
  });

  it("T7. legacy без snapshot → Order.commercialSnapshot null; invalid money блокирует конверсию", async () => {
    // Legacy: без commercial snapshot, только displayed money
    const legacy = await seedRequest({ displayedPrice: 900 });
    await admin.post(`/api/v1/requests/${legacy.id}/confirm-price`).send({ note: "ok" }).expect(201);
    await admin.post(`/api/v1/requests/${legacy.id}/customer-accept`).expect(201);
    await admin.post(`/api/v1/requests/${legacy.id}/convert`).expect(201);
    const legacyDetail = await getDetail(legacy.id);
    expect(legacyDetail.convertedOrderId).toBeTruthy();
    const legacyOrder = await prisma.order.findUnique({ where: { id: legacyDetail.convertedOrderId as string } });
    expect(legacyOrder?.commercialSnapshot).toBeNull();

    // Invalid money: заявка без price/currency → acceptance money-gate (400),
    // конверсия невозможна (статус не CUSTOMER_ACCEPTED → 409).
    const noMoney = await seedRequest({ displayedPrice: null, displayedCurrency: null });
    await admin.post(`/api/v1/requests/${noMoney.id}/confirm-price`).send({ note: "ok" }).expect(201);
    const acc = await admin.post(`/api/v1/requests/${noMoney.id}/customer-accept`);
    expect(acc.status).toBe(400);
    expect(JSON.stringify(acc.body)).toMatch(/no valid commercial money/);
    await admin.post(`/api/v1/requests/${noMoney.id}/convert`).expect(409);
    const noMoneyDetail = await getDetail(noMoney.id);
    expect(noMoneyDetail.convertedOrderId).toBeNull();
  });
});
