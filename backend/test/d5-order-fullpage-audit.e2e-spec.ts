/**
 * PHASE 3 — PRE-STEP 3.12 — D5 — ORDER FULL-PAGE + ACTIONS + EDITING + AUDIT (e2e).
 *
 * Server-authoritative contract для canonical Order full-page:
 *  - GET /orders/:id возвращает `availableActions` (state machine + gates +
 *    granular permissions) — frontend рендерит только этот список;
 *  - действия жизненного цикла исполняются реальными командами и фиксируются
 *    в immutable history (LIFECYCLE_ACTION: action/from/to/actor/time);
 *  - traveler field-edit (pre-final-confirm) фиксирует FIELD_CHANGE diff в
 *    history (fields JSON), PII-значения (passport/birthDate) — только masked;
 *  - denied edit (forged keys 422 / post-final-confirm 409) → НЕТ успешного
 *    audit события;
 *  - GET /orders/:id/history — paginated/stable/server-authorized; Storefront
 *    Order history через platform → 404 (D4 isolation не обходится).
 *
 * Synthetic personas (§26, PII-safe), deterministic seed builder.
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

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[] };
}
interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

describe("Phase 3 Pre-Step 3.12 D5 — Order Full-Page Actions/Editing/Audit (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `D5A${tag}${seq++}${stamp}`;
  const created: { users: string[]; partners: string[]; orders: string[] } = { users: [], partners: [], orders: [] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201);
    const s = await login(`${tag}${stamp}`, password);
    created.users.push(s.user.id);
    return s;
  };
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `d5a${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D5A Partner ${tag} ${stamp}`,
        country: "AZ",
        contactEmail: email,
        termsAccepted: true,
      })
      .expect(201);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as { items: Array<{ id: string }> };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/start`).expect(201);
    const approved = (await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/approve`).send({ reason: "ok" }).expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    created.users.push(session.user.id);
    return { partnerId: approved.partnerId, token: session.accessToken, agent: agent(session.accessToken) };
  };

  const PINNED: Record<string, string> = {
    firstName: "REQUIRED",
    lastName: "REQUIRED",
    birthDate: "OPTIONAL",
    citizenship: "REQUIRED",
    gender: "OPTIONAL",
    passportNumber: "REQUIRED",
    passportExpiry: "OPTIONAL",
  };

  interface SeededOrder {
    id: string;
    code: string;
    referenceNumber: string;
    travelerId: string;
  }

  const seedMarketplaceOrder = async (
    seller: Seller,
    opts: { status?: string; finalConfirmed?: boolean; complete?: boolean; source?: string } = {},
  ): Promise<SeededOrder> => {
    const tag = uid(opts.source === "PARTNER_STOREFRONT" ? "SF" : "M");
    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`,
        number: `TH-${tag}`,
        referenceNumber: opts.source === "PARTNER_STOREFRONT" ? `SF001-ORD-${tag}` : `MKT-ORD-${tag}`,
        status: (opts.status ?? "NEW") as any,
        currency: "USD",
        amount: 240,
        acquisitionSource: (opts.source ?? "MARKETPLACE") as any,
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: opts.finalConfirmed ? new Date() : null,
        travelerCount: 1,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: {
          create: [
            {
              position: 1,
              firstName: "Айтен",
              lastName: "Мамедова",
              ...(opts.complete === false
                ? {}
                : {
                    citizenship: "AZ",
                    gender: "F",
                    passportNumber: "AZ1234567",
                    passportExpiry: new Date(FUTURE(700)),
                    dataCompleteness: "COMPLETE" as const,
                  }),
              version: 1,
            },
          ],
        },
      },
      include: { travelers: true },
    });
    created.orders.push(order.id);
    return { id: order.id, code: order.code, referenceNumber: order.referenceNumber, travelerId: order.travelers[0].id };
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
    if (created.orders.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Booking" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  let op: Session;
  let analyst: Session;
  let seller: Seller;

  it("0. fixtures: OPERATOR + ANALYST + seller", async () => {
    op = await createStaff("d5a_op", RoleCode.OPERATOR);
    analyst = await createStaff("d5a_an", RoleCode.ANALYST);
    seller = await createApprovedSeller("A");
  });

  it("1. availableActions (server authority): NEW order → process/cancel(+problem/suspend); ANALYST → []", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });

    const detail = await agent(op.accessToken).get(`/api/v1/orders/${order.id}`).expect(200);
    const actions = detail.body.availableActions as string[];
    expect(actions).toContain("process");
    expect(actions).toContain("cancel");
    // D3 gate: traveler-bearing Order без finalConfirm → confirm/send недоступны.
    expect(actions).not.toContain("confirm");
    expect(actions).not.toContain("send");
    expect(actions).not.toContain("close");

    // Роль без action-прав: detail доступен (order.read), actions — пусто.
    const anDetail = await agent(analyst.accessToken).get(`/api/v1/orders/${order.id}`).expect(200);
    expect(anDetail.body.availableActions).toEqual([]);
  });

  it("2. lifecycle action: process исполняется; history LIFECYCLE_ACTION (action/from/to/actor) фиксируется", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });
    await agent(op.accessToken).patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);

    const after = await agent(op.accessToken).get(`/api/v1/orders/${order.id}`).expect(200);
    expect(after.body.status).toBe("IN_PROCESSING");
    const acts = after.body.availableActions as string[];
    expect(acts).toContain("markWaitingData");
    expect(acts).not.toContain("confirm"); // gate: final-confirm ещё нет
    expect(acts).toContain("cancel");

    const hist = await agent(op.accessToken).get(`/api/v1/orders/${order.id}/history?pageSize=20`).expect(200);
    const row = hist.body.items[0] as { action: string; from: string; to: string; actorName: string; createdAt: string };
    expect(row.action).toBe("process");
    expect(row.from).toBe("NEW");
    expect(row.to).toBe("IN_PROCESSING");
    expect(row.actorName).toBeTruthy();
    expect(row.createdAt).toBeTruthy();
  });

  it("3. action permission denial: ANALYST PATCH process → 403, статус не меняется, успешного события нет", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });
    const before = await prisma.orderHistory.count({ where: { orderId: order.id } });
    await agent(analyst.accessToken).patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(403);
    const db = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(db.status).toBe("NEW");
    const after = await prisma.orderHistory.count({ where: { orderId: order.id } });
    expect(after).toBe(before);
  });

  it("4. edit allowed: traveler field save → FIELD_CHANGE audit diff; PII только masked", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });
    // Дозаполняем REQUIRED (citizenship/passportNumber) + меняем gender.
    await agent(op.accessToken)
      .patch(`/api/v1/orders/${order.id}/travelers/${order.travelerId}`)
      .send({ citizenship: "AZ", gender: "M", passportNumber: "AZ1234567" })
      .expect(200);

    const hist = await agent(op.accessToken).get(`/api/v1/orders/${order.id}/history?pageSize=5`).expect(200);
    const row = hist.body.items[0] as { action: string; fields: unknown };
    expect(row.action).toBe("update_traveler_d3");
    const fields = row.fields as Array<{ field: string; oldValue: string | null; newValue: string | null; redacted: boolean }>;
    expect(fields.length).toBeGreaterThan(0);
    const raw = JSON.stringify(row);
    expect(raw).not.toContain("AZ1234567"); // full passport НЕ в аудите

    const pn = fields.find((f) => f.field === "passportNumber")!;
    expect(pn).toBeDefined();
    expect(pn.redacted).toBe(true);
    expect(pn.newValue).toContain("••••"); // masked форма
    const citizenship = fields.find((f) => f.field === "citizenship");
    expect(citizenship?.newValue).toBe("AZ");
    // DB business entity содержит synthetic full value (PII-safe fixture).
    const dbT = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: order.travelerId } });
    expect(dbT.passportNumber).toBe("AZ1234567");
  });

  it("5. denied edit: forged server-owned key → 422, DB неизменна, БЕЗ успешного audit события", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });
    const before = await prisma.orderHistory.count({ where: { orderId: order.id } });
    await agent(op.accessToken)
      .patch(`/api/v1/orders/${order.id}/travelers/${order.travelerId}`)
      .send({ gender: "M", dataCompleteness: "COMPLETE" })
      .expect(422);
    const dbT = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: order.travelerId } });
    expect(dbT.gender).toBeNull();
    const after = await prisma.orderHistory.count({ where: { orderId: order.id } });
    expect(after).toBe(before);
  });

  it("6. post-final-confirm traveler edit → 409 и НЕТ успешного FIELD_CHANGE события", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: true, finalConfirmed: true });
    const before = await prisma.orderHistory.count({ where: { orderId: order.id } });
    await agent(op.accessToken)
      .patch(`/api/v1/orders/${order.id}/travelers/${order.travelerId}`)
      .send({ gender: "M" })
      .expect(409);
    const after = await prisma.orderHistory.count({ where: { orderId: order.id } });
    expect(after).toBe(before);
  });

  it("7. history API: pagination + стабильная сортировка (createdAt DESC)", async () => {
    const order = await seedMarketplaceOrder(seller, { complete: false });
    await agent(op.accessToken).patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/orders/${order.id}`).send({ action: "markWaitingData" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/orders/${order.id}`).send({ action: "resumeProcessing" }).expect(200);

    const total = await prisma.orderHistory.count({ where: { orderId: order.id } });
    const page1 = await agent(op.accessToken).get(`/api/v1/orders/${order.id}/history?page=1&pageSize=2`).expect(200);
    expect(page1.body.total).toBe(total);
    expect(page1.body.items).toHaveLength(2);
    const page2 = await agent(op.accessToken).get(`/api/v1/orders/${order.id}/history?page=2&pageSize=2`).expect(200);
    const ids1 = (page1.body.items as { id: string }[]).map((i) => i.id);
    const ids2 = (page2.body.items as { id: string }[]).map((i) => i.id);
    expect([...ids1, ...ids2]).toEqual([...new Set([...ids1, ...ids2])]);
    // orderBy createdAt DESC: первая запись первой страницы — самая свежая (resumeProcessing).
    expect((page1.body.items[0] as { action: string }).action).toBe("resumeProcessing");
  });

  it("8. scope: platform → Storefront Order detail/history → 404 (D4 isolation сохранён)", async () => {
    const sfOrder = await seedMarketplaceOrder(seller, { source: "PARTNER_STOREFRONT", finalConfirmed: true, complete: true });
    await agent(op.accessToken).get(`/api/v1/orders/${sfOrder.id}`).expect(404);
    await agent(op.accessToken).get(`/api/v1/orders/${sfOrder.id}/history`).expect(404);
    const db = await prisma.order.findUnique({ where: { id: sfOrder.id }, select: { id: true } });
    expect(db).not.toBeNull(); // Storefront-строка существует в DB
  });
});
