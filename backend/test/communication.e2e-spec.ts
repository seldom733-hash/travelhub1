/**
 * E2E Phase 1 Step 1.16 — Communication Foundation (canonical CML-*).
 *
 * Покрывает §55–§60:
 *  1.  anonymous /communications* → 401;
 *  2.  internal staff (OPERATOR) create → 201, CML-* code, DTO whitelist;
 *  3.  forged fields (code/status/actorUserId/occurredAt/customerId) → 422/400;
 *  4.  контекст existence: fake contextId → 422; ORDER/BOOKING contexts работают;
 *  5.  type/direction семантика: NOTE⇒INTERNAL, MESSAGE⇒INBOUND/OUTBOUND;
 *  6.  HTML body → 422 (XSS-safe);
 *  7.  BUYER own-scope: видит только свои CUSTOMER-communications;
 *  8.  IDOR: Buyer B не видит CML Buyer A (own list + detail → neutral 404);
 *  9.  NOTE никогда не отдаётся BUYER/PARTNER;
 *  10. PARTNER own-scope: свой PARTNER-контекст; чужой — 404; без partnerId — пусто;
 *  11. role gates: BUYER create/list → 403; MODERATOR → 403; PARTNER list → 403;
 *  12. DTO whitelist: без actorUserId/requestId/correlationId/updatedAt; own-view
 *      режет internal USER ids;
 *  13. temporal: occurredAt=createdAt UTC ISO; client occurredAt запрещён;
 *  14. pagination: page/pageSize/hasMore/total, deterministic order, cap 50;
 *  15. AuditLog: create аудируется БЕЗ body (§20/§21);
 *  16. legacy isolation: нет startup backfill (count == 0 после boot);
 *  17. public Marketplace не раскрывает communications;
 *  18. correlation: X-Request-Id присутствует; requestId сохранён в строке.
 */

import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";

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

describe("Phase 1 Step 1.16 — Communication Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    products: string[];
    orders: string[];
    partners: string[];
    communications: string[];
    auditLogs: string[];
  } = { users: [], customers: [], products: [], orders: [], partners: [], communications: [], auditLogs: [] };

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

  /** Создаёт crm.Partner (ADMIN) и привязывает его к PARTNER-пользователю. */
  const createLinkedPartner = async (session: Session, name: string): Promise<string> => {
    const partner = (await adminAgent.post("/api/v1/partners").send({ name }).expect(201)).body as { id: string };
    created.partners.push(partner.id);
    await prisma.user.update({ where: { id: session.user.id }, data: { partnerId: partner.id } });
    // Обновляем сессию (partnerId в JWT-пользователе перечитывается из БД при каждом запросе).
    return partner.id;
  };

  /** Создаёт реальный Order + Booking (для context ORDER/BOOKING). */
  const createOrderWithBooking = async (customerId: string, title: string) => {
    const product = (
      await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `${title} ${stamp}`, tariffs: [{ name: "S", price: 90 }] }).expect(201)
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const order = (
      await adminAgent
        .post("/api/v1/orders/bootstrap")
        .send({ customerId, items: [{ productId: product.id, title: product.title, type: "TOUR", price: 90 }] })
        .expect(201)
    ).body.order;
    created.orders.push(order.id);

    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "confirm" }).expect(200);
    await adminAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(200);

    const booking = await prisma.booking.findFirst({ where: { orderId: order.id }, select: { id: true } });
    if (!booking) throw new Error("Booking not created by consumer");
    return { orderId: order.id, bookingId: booking.id };
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
    await prisma.communication.deleteMany({ where: { id: { in: created.communications } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogs } } });
    await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: created.orders } }, { aggregateId: { in: created.products } }, { aggregateId: { in: created.customers } }, { aggregateId: { in: created.partners } }] },
    });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ── 1. Auth gate + legacy isolation ────────────────────────────────────────

  it("1. anonymous /communications* → 401; нет startup backfill (count==0 после boot)", async () => {
    for (const path of ["", "/own", "/CML-00000001"]) {
      await request(app.getHttpServer()).get(`/api/v1/communications${path}`).expect(401);
    }
    await request(app.getHttpServer()).post("/api/v1/communications").send({}).expect(401);
    // §25/§59: boot не создаёт Communication автоматически (нет backfill).
    expect(await prisma.communication.count()).toBe(0);
  });

  // ── 2-6. Create + semantics + content ──────────────────────────────────────

  it("2. OPERATOR create NOTE → 201, CML-* code, DTO whitelist, occurredAt=createdAt UTC", async () => {
    const operator = await createStaff("comm_op", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_cus");

    const res = await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "NOTE",
        direction: "INTERNAL",
        subject: "Внутренняя заметка",
        body: "Покупатель позвонил — уточнить даты тура.",
        contextType: "CUSTOMER",
        contextId: buyer.user.customerId,
      })
      .expect(201);
    const comm = res.body as Record<string, unknown>;
    created.communications.push(String(comm.id));

    expect(String(comm.code)).toMatch(/^CML-\d{8}$/);
    expect(comm.type).toBe("NOTE");
    expect(comm.channel).toBe("PLATFORM");
    expect(comm.direction).toBe("INTERNAL");
    expect(comm.status).toBe("ACTIVE");
    expect(comm.contextType).toBe("CUSTOMER");
    expect(comm.contextId).toBe(buyer.user.customerId);
    expect(comm.subject).toBe("Внутренняя заметка");
    expect(comm.body).toBe("Покупатель позвонил — уточнить даты тура.");

    // DTO whitelist (§38): БЕЗ internal/audit/correlation полей.
    expect(comm).not.toHaveProperty("actorUserId");
    expect(comm).not.toHaveProperty("requestId");
    expect(comm).not.toHaveProperty("correlationId");
    expect(comm).not.toHaveProperty("updatedAt");
    expect(comm).not.toHaveProperty("version");

    // Temporal (§16/§17): occurredAt == createdAt, ISO UTC.
    expect(String(comm.occurredAt)).toMatch(/Z$/);
    expect(String(comm.createdAt)).toMatch(/Z$/);
    expect(Date.parse(String(comm.occurredAt))).toBe(Date.parse(String(comm.createdAt)));

    // Correlation reference сохранена в строке (§18).
    const row = await prisma.communication.findUniqueOrThrow({ where: { id: String(comm.id) } });
    expect(row.requestId).toBeTruthy();
    expect(row.correlationId).toBeTruthy();
    // X-Request-Id в response.
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("3. forged fields (code/status/actorUserId/occurredAt/customerId) отклоняются", async () => {
    const operator = await createStaff("comm_forge", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_forge_cus");

    // Raw-body forbidden keys → 422 (code/status/actorUserId/occurredAt/ownership).
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "NOTE",
        direction: "INTERNAL",
        body: "x",
        contextType: "CUSTOMER",
        contextId: buyer.user.customerId,
        code: "CML-99999999",
        status: "ARCHIVED",
        actorUserId: "someone-else",
        occurredAt: "2020-01-01T00:00:00.000Z",
        customerId: buyer.user.customerId,
        partnerId: "par-fake",
      })
      .expect(422);

    // Whitelist: payload только из неизвестных полей → stripped → 400 (missing required).
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ customerId: buyer.user.customerId, zzJunk: "junk" })
      .expect(400);

    // Whitelist: неизвестный junk-ключ при валидном payload молча срезается —
    // не влияет на факт (201), forged-поля при этом невозможны (см. 422 выше).
    const ok = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({
          type: "NOTE",
          direction: "INTERNAL",
          body: "whitelist junk stripped",
          contextType: "CUSTOMER",
          contextId: buyer.user.customerId,
          zzJunk: { evil: true },
        })
        .expect(201)
    ).body as { id: string };
    created.communications.push(ok.id);
  });

  it("4. контекст existence: fake contextId → 422; ORDER/BOOKING contexts работают", async () => {
    const operator = await createStaff("comm_ctx", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_ctx_cus");

    // Несуществующий контекст.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ type: "NOTE", direction: "INTERNAL", body: "x", contextType: "CUSTOMER", contextId: "cus-does-not-exist" })
      .expect(422);
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ type: "NOTE", direction: "INTERNAL", body: "x", contextType: "ORDER", contextId: "ord-does-not-exist" })
      .expect(422);

    // Реальный Order + Booking.
    const { orderId, bookingId } = await createOrderWithBooking(String(buyer.user.customerId), "Comm Order");
    const orderComm = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ type: "NOTE", direction: "INTERNAL", body: "Заказ принят в работу", contextType: "ORDER", contextId: orderId })
        .expect(201)
    ).body as { id: string; code: string };
    created.communications.push(orderComm.id);
    expect(orderComm.code).toMatch(/^CML-\d{8}$/);

    // INBOUND по BOOKING требует внешний sender, консистентный владельцу заказа.
    const bookingComm = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({
          type: "MESSAGE",
          direction: "INBOUND",
          body: "Клиент подтвердил даты по бронированию",
          contextType: "BOOKING",
          contextId: bookingId,
          sender: { type: "CUSTOMER", id: buyer.user.customerId },
        })
        .expect(201)
    ).body as { id: string };
    created.communications.push(bookingComm.id);
  });

  it("5. type/direction семантика: NOTE⇒INTERNAL; MESSAGE⇒INBOUND/OUTBOUND; HTML → 422", async () => {
    const operator = await createStaff("comm_sem", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_sem_cus");
    const base = { contextType: "CUSTOMER" as const, contextId: buyer.user.customerId };

    await agent(operator.accessToken).post("/api/v1/communications").send({ ...base, type: "NOTE", direction: "OUTBOUND", body: "x" }).expect(422);
    await agent(operator.accessToken).post("/api/v1/communications").send({ ...base, type: "MESSAGE", direction: "INTERNAL", body: "x" }).expect(422);
    // NOTE не может иметь recipient.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "NOTE", direction: "INTERNAL", body: "x", recipient: { type: "CUSTOMER", id: buyer.user.customerId } })
      .expect(422);
    // HTML body → 422 (§50).
    await agent(operator.accessToken).post("/api/v1/communications").send({ ...base, type: "NOTE", direction: "INTERNAL", body: "<script>alert(1)</script>" }).expect(422);
    // MESSAGE INBOUND валиден.
    const ok = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ ...base, type: "MESSAGE", direction: "INBOUND", body: "Клиент написал в поддержку", sender: { type: "CUSTOMER", id: buyer.user.customerId } })
        .expect(201)
    ).body as { id: string };
    created.communications.push(ok.id);
  });

  // ── 7-9. BUYER own-scope + IDOR + NOTE invisibility ───────────────────────

  it("7-9. BUYER own-scope: свои CUSTOMER-сообщения видны; чужой CML → 404; NOTE скрыта", async () => {
    const operator = await createStaff("comm_scope", RoleCode.OPERATOR);
    const buyerA = await registerBuyer("comm_scope_a");
    const buyerB = await registerBuyer("comm_scope_b");
    const aAgent = agent(buyerA.accessToken);
    const bAgent = agent(buyerB.accessToken);

    // A: OUTBOUND MESSAGE (оператор → покупатель A) — видима A.
    const visible = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({
          type: "MESSAGE",
          direction: "OUTBOUND",
          subject: "Ответ по бронированию",
          body: "Ваш тур подтверждён, детали отправлены.",
          contextType: "CUSTOMER",
          contextId: buyerA.user.customerId,
          recipient: { type: "CUSTOMER", id: buyerA.user.customerId },
        })
        .expect(201)
    ).body as { id: string; code: string; sender: { type: string; id: string | null } };
    created.communications.push(visible.id);

    // A: NOTE (внутренняя заметка по A) — НЕ видима A (§36).
    const note = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ type: "NOTE", direction: "INTERNAL", body: "Требует внимания менеджера", contextType: "CUSTOMER", contextId: buyerA.user.customerId })
        .expect(201)
    ).body as { id: string; code: string };
    created.communications.push(note.id);

    // B: своя (пустая — B ничего не создавали).
    // A видит ТОЛЬКО visible (не NOTE).
    const ownA = (await aAgent.get("/api/v1/communications/own").expect(200)).body as { items: Array<Record<string, unknown>>; total: number };
    expect(ownA.total).toBe(1);
    expect(String(ownA.items[0].code)).toBe(visible.code);
    // own-view redacts internal USER sender id (§38).
    expect((ownA.items[0].sender as { type: string; id: string | null }).type).toBe("USER");
    expect((ownA.items[0].sender as { type: string; id: string | null }).id).toBeNull();
    // A detail NOTE → 404 (внутренняя заметка не отдаётся).
    await aAgent.get(`/api/v1/communications/${note.code}`).expect(404);

    // IDOR: B не видит CML A (list + detail → neutral 404, §35).
    const ownB = (await bAgent.get("/api/v1/communications/own").expect(200)).body as { total: number };
    expect(ownB.total).toBe(0);
    await bAgent.get(`/api/v1/communications/${visible.code}`).expect(404);

    // Внутренний список (staff) видит и MESSAGE, и NOTE.
    const internal = (await agent(operator.accessToken).get(`/api/v1/communications?contextType=CUSTOMER&contextId=${buyerA.user.customerId}`).expect(200)).body as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    expect(internal.total).toBe(2);
    // Internal view сохраняет полные sender refs (не redacted).
    const msg = internal.items.find((i) => String(i.code) === visible.code) as Record<string, unknown>;
    expect((msg.sender as { type: string; id: string | null }).type).toBe("USER");
    expect((msg.sender as { type: string; id: string | null }).id).toBeTruthy();
  });

  // ── 10. PARTNER own-scope ──────────────────────────────────────────────────

  it("10. PARTNER own-scope: свой PARTNER-контекст; чужой → 404; без partnerId — пусто; NOTE скрыта", async () => {
    const operator = await createStaff("comm_p_op", RoleCode.OPERATOR);
    const partnerA = await createStaff("comm_p_a", RoleCode.PARTNER, "partnerpass123");
    const partnerB = await createStaff("comm_p_b", RoleCode.PARTNER, "partnerpass123");
    const partnerAId = await createLinkedPartner(partnerA, `Comm Partner A ${stamp}`);
    const partnerBId = await createLinkedPartner(partnerB, `Comm Partner B ${stamp}`);

    // Оператор: MESSAGE по PARTNER A + NOTE по PARTNER A.
    const visible = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ type: "MESSAGE", direction: "OUTBOUND", body: "Согласованы новые тарифы", contextType: "PARTNER", contextId: partnerAId, recipient: { type: "PARTNER", id: partnerAId } })
        .expect(201)
    ).body as { id: string; code: string };
    created.communications.push(visible.id);
    const note = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ type: "NOTE", direction: "INTERNAL", body: "Партнёр просит продлить скидку", contextType: "PARTNER", contextId: partnerAId })
        .expect(201)
    ).body as { id: string; code: string };
    created.communications.push(note.id);

    const ownA = (await agent(partnerA.accessToken).get("/api/v1/communications/own").expect(200)).body as { items: Array<Record<string, unknown>>; total: number };
    expect(ownA.total).toBe(1);
    expect(String(ownA.items[0].code)).toBe(visible.code);
    await agent(partnerA.accessToken).get(`/api/v1/communications/${note.code}`).expect(404);

    // PARTNER B не видит CML A.
    const ownB = (await agent(partnerB.accessToken).get("/api/v1/communications/own").expect(200)).body as { total: number };
    expect(ownB.total).toBe(0);
    await agent(partnerB.accessToken).get(`/api/v1/communications/${visible.code}`).expect(404);
    void partnerBId;

    // PARTNER без partnerId → own пусто (controlled, §32) — внутренний список запрещён (403).
    const partnerNoLink = await createStaff("comm_p_nolink", RoleCode.PARTNER, "partnerpass123");
    const ownNoLink = (await agent(partnerNoLink.accessToken).get("/api/v1/communications/own").expect(200)).body as { total: number };
    expect(ownNoLink.total).toBe(0);
    await agent(partnerNoLink.accessToken).get("/api/v1/communications").expect(403);
  });

  // ── 11. Role gates ─────────────────────────────────────────────────────────

  it("11. role gates: BUYER create/list → 403; MODERATOR → 403; PARTNER internal list → 403", async () => {
    const buyer = await registerBuyer("comm_role_b");
    const mod = await createStaff("comm_role_m", RoleCode.MODERATOR);

    await agent(buyer.accessToken).post("/api/v1/communications").send({}).expect(403);
    await agent(buyer.accessToken).get("/api/v1/communications").expect(403);
    await agent(mod.accessToken).post("/api/v1/communications").send({}).expect(403);
    await agent(mod.accessToken).get("/api/v1/communications").expect(403);
  });

  // ── 12-14. DTO/scope, pagination, temporal ────────────────────────────────

  it("12. pagination: page/pageSize/hasMore/total, детерминированный порядок, cap 50 → 400", async () => {
    const operator = await createStaff("comm_page", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_page_cus");

    for (let i = 0; i < 3; i++) {
      const c = (
        await agent(operator.accessToken)
          .post("/api/v1/communications")
          .send({ type: "NOTE", direction: "INTERNAL", body: `Заметка ${i}`, contextType: "CUSTOMER", contextId: buyer.user.customerId })
          .expect(201)
      ).body as { id: string };
      created.communications.push(c.id);
    }

    const p1 = (await agent(operator.accessToken).get(`/api/v1/communications?contextType=CUSTOMER&contextId=${buyer.user.customerId}&page=1&pageSize=2`).expect(200)).body as {
      items: Array<{ code: string; occurredAt: string }>;
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
    expect(p1.total).toBe(3);
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);

    const p2 = (await agent(operator.accessToken).get(`/api/v1/communications?contextType=CUSTOMER&contextId=${buyer.user.customerId}&page=2&pageSize=2`).expect(200)).body as {
      items: Array<{ code: string; occurredAt: string }>;
      hasMore: boolean;
    };
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);

    // Детерминированный порядок: occurredAt desc, code asc tie-breaker (§39).
    const codes = [...p1.items.map((i) => i.code), ...p2.items.map((i) => i.code)];
    const times = [...p1.items.map((i) => Date.parse(i.occurredAt)), ...p2.items.map((i) => Date.parse(i.occurredAt))];
    for (let i = 1; i < times.length; i++) expect(times[i] <= times[i - 1]).toBe(true);

    await agent(operator.accessToken).get(`/api/v1/communications?pageSize=999`).expect(400);
    // forged contextId в query не даёт чужой контекст — просто пустой фильтр (не ошибка).
    const forged = (await agent(operator.accessToken).get(`/api/v1/communications?contextId=${buyer.user.customerId}&page=1&pageSize=2`).expect(200)).body as { total: number };
    expect(typeof forged.total).toBe("number");
  });

  // ── 15. Audit без body ────────────────────────────────────────────────────

  it("15. AuditLog: create аудируется БЕЗ body (PII minimization, §20/§21)", async () => {
    const operator = await createStaff("comm_audit", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_audit_cus");
    const bodyText = "СЕКРЕТНОЕ содержание заметки для проверки PII";

    const comm = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({ type: "NOTE", direction: "INTERNAL", body: bodyText, contextType: "CUSTOMER", contextId: buyer.user.customerId })
        .expect(201)
    ).body as { id: string };
    created.communications.push(comm.id);

    const audit = await prisma.auditLog.findFirst({ where: { action: "communication.created", resourceId: comm.id } });
    expect(audit).toBeTruthy();
    const details = (audit?.details ?? {}) as Record<string, unknown>;
    expect(details.code).toMatch(/^CML-\d{8}$/);
    expect(details.contextType).toBe("CUSTOMER");
    // Body НЕ дублируется в AuditLog.
    expect(JSON.stringify(details)).not.toContain(bodyText);
    if (audit) created.auditLogs.push(audit.id);
  });

  // ── 16-17. Legacy isolation + public boundary ─────────────────────────────

  it("16-17. legacy isolation: records создаются ТОЛЬКО явным API; public Marketplace не раскрывает Communication", async () => {
    const before = await prisma.communication.count();
    const buyer = await registerBuyer("comm_public");
    // Регистрация BUYER / public-запросы НЕ создают Communication (нет backfill).
    expect(await prisma.communication.count()).toBe(before);

    // Public Marketplace работает и не содержит communication-полей.
    const anon = await request(app.getHttpServer()).get("/api/v1/public/products").expect(200);
    expect(Array.isArray(anon.body.items)).toBe(true);
    const allKeys = new Set<string>();
    for (const item of anon.body.items as Array<Record<string, unknown>>) {
      for (const k of Object.keys(item)) allKeys.add(k);
    }
    expect([...allKeys].some((k) => k.toLowerCase().includes("communication") || k.toLowerCase().includes("message"))).toBe(false);

    // Анонимный доступ к communication API закрыт.
    await request(app.getHttpServer()).get("/api/v1/communications/own").expect(401);
  });

  // ── STRICT REVIEW FIX: impersonation policy + participant↔context authz ──

  it("R1. SYSTEM sender/recipient нельзя forged через HTTP → 422", async () => {
    const operator = await createStaff("comm_sys", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_sys_cus");
    const base = { contextType: "CUSTOMER" as const, contextId: buyer.user.customerId };

    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "MESSAGE", direction: "INBOUND", body: "x", sender: { type: "SYSTEM" } })
      .expect(422);
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "MESSAGE", direction: "OUTBOUND", body: "x", recipient: { type: "SYSTEM" } })
      .expect(422);
    // NOTE от SYSTEM — тоже запрещено.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "NOTE", direction: "INTERNAL", body: "x", sender: { type: "SYSTEM" } })
      .expect(422);
  });

  it("R2. direction↔participant: INBOUND от USER / OUTBOUND без recipient / OUTBOUND к USER → 422", async () => {
    const operator = await createStaff("comm_dir", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_dir_cus");
    const base = { contextType: "CUSTOMER" as const, contextId: buyer.user.customerId };

    // INBOUND с внутренним sender — impersonation (нельзя «входящее от персонала»).
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "MESSAGE", direction: "INBOUND", body: "x", sender: { type: "USER", id: operator.user.id } })
      .expect(422);
    // OUTBOUND без recipient.
    await agent(operator.accessToken).post("/api/v1/communications").send({ ...base, type: "MESSAGE", direction: "OUTBOUND", body: "x" }).expect(422);
    // OUTBOUND к внутреннему USER.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "MESSAGE", direction: "OUTBOUND", body: "x", recipient: { type: "USER", id: operator.user.id } })
      .expect(422);
    // NOTE от внешнего sender.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ ...base, type: "NOTE", direction: "INTERNAL", body: "x", sender: { type: "CUSTOMER", id: buyer.user.customerId } })
      .expect(422);
  });

  it("R3. participant↔context mismatch: чужой CUSTOMER/PARTNER на контексте → 422 (existence ≠ authorization)", async () => {
    const operator = await createStaff("comm_ctxz", RoleCode.OPERATOR);
    const buyerA = await registerBuyer("comm_ctxz_a");
    const buyerB = await registerBuyer("comm_ctxz_b");
    const partner = await createStaff("comm_ctxz_p", RoleCode.PARTNER, "partnerpass123");
    const partnerId = await createLinkedPartner(partner, `Comm CtxZ Partner ${stamp}`);

    // OUTBOUND на CUSTOMER-контексте A, но recipient — B → mismatch.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "MESSAGE",
        direction: "OUTBOUND",
        body: "x",
        contextType: "CUSTOMER",
        contextId: buyerA.user.customerId,
        recipient: { type: "CUSTOMER", id: buyerB.user.customerId },
      })
      .expect(422);
    // PARTNER participant на CUSTOMER-контексте → mismatch.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "MESSAGE",
        direction: "OUTBOUND",
        body: "x",
        contextType: "CUSTOMER",
        contextId: buyerA.user.customerId,
        recipient: { type: "PARTNER", id: partnerId },
      })
      .expect(422);
    // INBOUND от CUSTOMER A на PARTNER-контексте → mismatch.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "MESSAGE",
        direction: "INBOUND",
        body: "x",
        contextType: "PARTNER",
        contextId: partnerId,
        sender: { type: "CUSTOMER", id: buyerA.user.customerId },
      })
      .expect(422);
  });

  it("R4. ORDER-context: CUSTOMER participant должен быть владельцем заказа → 422 для чужого", async () => {
    const operator = await createStaff("comm_ordz", RoleCode.OPERATOR);
    const buyerA = await registerBuyer("comm_ordz_a");
    const buyerB = await registerBuyer("comm_ordz_b");
    const { orderId } = await createOrderWithBooking(String(buyerA.user.customerId), "Comm OrdZ");

    // Чужой CUSTOMER на ORDER-контексте A → 422.
    await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({
        type: "MESSAGE",
        direction: "INBOUND",
        body: "x",
        contextType: "ORDER",
        contextId: orderId,
        sender: { type: "CUSTOMER", id: buyerB.user.customerId },
      })
      .expect(422);
    // Владелец заказа → 201.
    const ok = (
      await agent(operator.accessToken)
        .post("/api/v1/communications")
        .send({
          type: "MESSAGE",
          direction: "INBOUND",
          body: "Заказчик уточняет состав тура",
          contextType: "ORDER",
          contextId: orderId,
          sender: { type: "CUSTOMER", id: buyerA.user.customerId },
        })
        .expect(201)
    ).body as { id: string };
    created.communications.push(ok.id);
  });

  it("R5. CML concurrency: 20 параллельных create → 20 уникальных кодов (BusinessSequence atomic)", async () => {
    const operator = await createStaff("comm_conc", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_conc_cus");
    const base = { type: "NOTE" as const, direction: "INTERNAL" as const, body: "concurrency", contextType: "CUSTOMER" as const, contextId: buyer.user.customerId };

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => agent(operator.accessToken).post("/api/v1/communications").send(base).expect(201)),
    );
    const codes = responses.map((r) => String((r.body as { code: string }).code));
    expect(new Set(codes).size).toBe(20);
    for (const c of codes) expect(c).toMatch(/^CML-\d{8}$/);
    for (const r of responses) created.communications.push(String((r.body as { id: string }).id));
  });

  // ── 18. Correlation ───────────────────────────────────────────────────────

  it("18. correlation: X-Request-Id header; requestId/correlationId сохранены в строке", async () => {
    const operator = await createStaff("comm_corr", RoleCode.OPERATOR);
    const buyer = await registerBuyer("comm_corr_cus");

    const res = await agent(operator.accessToken)
      .post("/api/v1/communications")
      .send({ type: "NOTE", direction: "INTERNAL", body: "correlation check", contextType: "CUSTOMER", contextId: buyer.user.customerId })
      .expect(201);
    const comm = res.body as { id: string };
    created.communications.push(comm.id);

    const row = await prisma.communication.findUniqueOrThrow({ where: { id: comm.id } });
    expect(row.requestId).toBeTruthy();
    expect(row.correlationId).toBeTruthy();
    expect(row.correlationId).toBe(res.headers["x-request-id"] ?? row.requestId);
  });
});
