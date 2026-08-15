/**
 * E2E PHASE 2 STEP 2.12H — External API Idempotency Contract (T1–T19).
 *
 * Защищённая операция V1: POST /api/v1/finance/payments (payment.create) —
 * payment-initiation boundary, hard prerequisite of 2.12B.
 *
 * Доказывает:
 *  - T1/T2 header contract (missing/malformed → controlled 4xx);
 *  - T3/T4 first execution + identical retry (DB-backed replay, один факт);
 *  - T5/T6 divergent reuse / divergent aggregate → controlled 409, 0 wrong facts;
 *  - T7/T8 genuine DB concurrency (same key identical/divergent);
 *  - T9 app reconstruction (второй Nest instance, тот же DB) → DB-backed replay;
 *  - T10 cross-principal same literal key → isolated;
 *  - T11/T12 auth/RBAC не обходится replay-ом (401/403 ДО слота);
 *  - T13 rolled-back business op → claim удалён, ключ не poisoning, нет fake
 *    completed success;
 *  - T14 response replay status/body semantics;
 *  - T15 volatile headers (Set-Cookie и т.п.) НЕ реплеятся;
 *  - T16 unprotected endpoint (confirm/fail/cancel) без ключа работает как раньше;
 *  - T17 idempotency layer не транзишит сам Payment (PENDING сохраняется);
 *  - T18 no PSP/webhook runtime (route-graph + source audit);
 *  - T19 DB race backstop → никаких raw 500.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { ExternalIdempotencyStatus } from "../src/generated/prisma/enums";
import { Prisma, RoleCode } from "../src/generated/prisma/client";
import { deriveSlotKey } from "../src/shared/idempotency/idempotency.slot-key";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("Phase 2 Step 2.12H — External API Idempotency Contract (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;

  const created: {
    users: string[];
    products: string[];
    quotes: string[];
    checkouts: string[];
    sales: string[];
    orders: string[];
    payments: string[];
  } = { users: [], products: [], quotes: [], checkouts: [], sales: [], orders: [], payments: [] };

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

  const futureDate = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const futureIso = (days = 30) => new Date(Date.now() + days * 86400000).toISOString();

  /** Полная canonical цепочка до Order (frozen money snapshot, как 2.11/2.12 e2e). */
  const buildOrder = async (sm: Session, tag: string, price: number): Promise<{ orderId: string; orderCode: string }> => {
    const smAgent = agent(sm.accessToken);
    const prod = (await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: `Idem ${tag} ${stamp}`, tariffs: [{ name: "Std", price }] }).expect(201)).body.product as { id: string };
    created.products.push(prod.id);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { productId: prod.id } });
    const date = futureDate();
    await adminAgent.post(`/api/v1/products/${prod.id}/availability`).send({ tariffId: tariff.id, date: `${date}T00:00:00.000Z`, slotsTotal: 10 }).expect(201);

    const quote = (await smAgent.post("/api/v1/sales/quotes").send({}).expect(201)).body as { id: string; code: string };
    created.quotes.push(quote.id);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/items`).send({ productId: prod.id, tariffId: tariff.id, quantity: 1 }).expect(201);
    await smAgent.put(`/api/v1/sales/quotes/${quote.code}/commercial`).send({ discountType: "NONE", validUntil: futureIso() }).expect(200);
    await smAgent.post(`/api/v1/sales/quotes/${quote.code}/issue`).expect(201);
    const intent = (await smAgent.post("/api/v1/sales/checkouts").send({ quoteId: quote.id, serviceDate: date, travelers: [] }).expect(201)).body as { id: string; code: string; version: number };
    created.checkouts.push(intent.id);
    await smAgent.put(`/api/v1/sales/checkouts/${intent.code}/payment-terms`).send({ scheme: "FULL_PREPAYMENT", expectedVersion: intent.version }).expect(200);
    const sale = (await smAgent.post("/api/v1/sales/sales").send({ quoteId: quote.id, checkoutIntentId: intent.id }).expect(201)).body as { id: string; code: string };
    created.sales.push(sale.id);
    await smAgent.post(`/api/v1/sales/sales/${sale.code}/complete`).send({ expectedVersion: 1 }).expect(201);
    await eventBus.publishPending();
    const order = await prisma.order.findFirstOrThrow({ where: { saleId: sale.id } });
    created.orders.push(order.id);
    return { orderId: order.id, orderCode: order.code };
  };

  const createPayment = (fin: Session, orderId: string, key: string, body: Record<string, unknown> = {}) => {
    const a = agent(fin.accessToken);
    return a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId, ...body });
  };

  const slotCount = async (scopeId: string, key: string) =>
    prisma.externalIdempotencyRecord.count({
      where: { slotKey: deriveSlotKey({ type: "USER", id: scopeId }, "payment.create", key) },
    });

  const paymentCount = async (orderId: string) => prisma.payment.count({ where: { orderId } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);
    const admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
  });

  afterAll(async () => {
    // Idempotency-слоты созданных FINANCE-пользователей (scopeId = user.id).
    await prisma.externalIdempotencyRecord.deleteMany({ where: { scopeId: { in: created.users } } });
    if (created.payments.length > 0) {
      const payEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.payments } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: payEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.payments } } });
      await prisma.paymentHistory.deleteMany({ where: { paymentId: { in: created.payments } } });
      await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    }
    if (created.orders.length > 0) {
      const orderEventIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: orderEventIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.sales.length > 0) {
      await prisma.availabilityReservation.deleteMany({ where: { sourceSaleId: { in: created.sales } } });
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } });
    }
    await prisma.availability.deleteMany({ where: { productId: { in: created.products } } });
    await prisma.checkoutIntent.deleteMany({ where: { id: { in: created.checkouts } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("T1. missing Idempotency-Key → controlled 400 (не raw 500)", async () => {
    const fin = await createStaff("h_fin1", RoleCode.FINANCE);
    const sm = await createStaff("h_sm1", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t1", 150);
    const res = await agent(fin.accessToken).post("/api/v1/finance/payments").send({ orderId });
    expect(res.status).toBe(400);
    expect(await paymentCount(orderId)).toBe(0);
  });

  it("T2. malformed key (empty/whitespace/too long/unsupported chars) → controlled 400", async () => {
    const fin = await createStaff("h_fin2", RoleCode.FINANCE);
    const sm = await createStaff("h_sm2", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t2", 140);
    // Node/superagent отклоняют client-side chars <0x20, 0x7f и >0x7f (\n, таб,
    // кириллица) — такие запросы вообще не доходят до сервера. Поэтому bad-chars —
    // ASCII printable (валидный транспорт), не проходящие контракт regex
    // [A-Za-z0-9._~-]: пробел/! / , / ; / @ / = / #.
    const badKeys = ["", "   ", "a".repeat(129), "bad key!", "key,with-comma", "key;with-semicolon", "key@domain", "key=value", "key#frag"];
    for (const k of badKeys) {
      const res = await createPayment(fin, orderId, k);
      expect(res.status).toBe(400);
    }
    expect(await paymentCount(orderId)).toBe(0);
  });

  it("T3. first request → один бизнес-факт + один idempotency-факт", async () => {
    const fin = await createStaff("h_fin3", RoleCode.FINANCE);
    const sm = await createStaff("h_sm3", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t3", 130);
    const key = `e2e-t3-${stamp}`;
    const res = await createPayment(fin, orderId, key).expect(201);
    created.payments.push((res.body as { id: string }).id);
    expect(await paymentCount(orderId)).toBe(1);
    expect(await slotCount(fin.user.id, key)).toBe(1);
  });

  it("T4. identical retry (same key + same body) → replay: тот же результат, 0 новых фактов", async () => {
    const fin = await createStaff("h_fin4", RoleCode.FINANCE);
    const sm = await createStaff("h_sm4", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t4", 120);
    const key = `e2e-t4-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string; code: string };
    created.payments.push(first.id);
    const second = (await createPayment(fin, orderId, key).expect(201)).body as { id: string; code: string };
    expect(second.id).toBe(first.id);
    expect(second.code).toBe(first.code);
    expect(await paymentCount(orderId)).toBe(1);
    expect(await slotCount(fin.user.id, key)).toBe(1);
  });

  it("T5. divergent reuse (same key, другой body) → controlled 409; 0 фактов для нового агрегата", async () => {
    const fin = await createStaff("h_fin5", RoleCode.FINANCE);
    const sm = await createStaff("h_sm5", RoleCode.SALES_MANAGER);
    const { orderId: orderA } = await buildOrder(sm, "idem_t5a", 110);
    const { orderId: orderB } = await buildOrder(sm, "idem_t5b", 105);
    const key = `e2e-t5-${stamp}`;
    const first = (await createPayment(fin, orderA, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    const res = await createPayment(fin, orderB, key);
    expect(res.status).toBe(409);
    expect(await paymentCount(orderB)).toBe(0); // divergent reuse НЕ создаёт факт
    expect(await paymentCount(orderA)).toBe(1);
  });

  it("T6. divergent aggregate → нет wrong replay (same key никогда не отдаёт чужой результат)", async () => {
    const fin = await createStaff("h_fin6", RoleCode.FINANCE);
    const sm = await createStaff("h_sm6", RoleCode.SALES_MANAGER);
    const { orderId: orderA } = await buildOrder(sm, "idem_t6a", 100);
    const { orderId: orderB } = await buildOrder(sm, "idem_t6b", 95);
    const key = `e2e-t6-${stamp}`;
    const a = (await createPayment(fin, orderA, key).expect(201)).body as { id: string; orderId: string };
    created.payments.push(a.id);
    expect(a.orderId).toBe(orderA);
    // Тот же key, другой orderId → 409, НИКОГДА не replay платежа orderA.
    const res = await createPayment(fin, orderB, key);
    expect(res.status).toBe(409);
    expect((res.body as { message?: string }).message).toContain("divergent");
    expect(await paymentCount(orderB)).toBe(0);
  });

  it("T7. concurrent identical (same key, genuine DB concurrency) → ровно один бизнес-факт, оба получают результат", async () => {
    const fin = await createStaff("h_fin7", RoleCode.FINANCE);
    const sm = await createStaff("h_sm7", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t7", 90);
    const key = `e2e-t7-${stamp}`;
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
    ]);
    expect(r1.status).toBeLessThan(500);
    expect(r2.status).toBeLessThan(500);
    const ids = [r1, r2].filter((r) => r.status === 201).map((r) => (r.body as { id: string }).id);
    expect(ids.length).toBeGreaterThan(0);
    created.payments.push(ids[0]);
    expect(await paymentCount(orderId)).toBe(1); // ровно один бизнес-факт
    expect(await slotCount(fin.user.id, key)).toBe(1);
    // Оба ответа несут один и тот же Payment (replay или fresh — одинаковый факт).
    const allIds = [r1, r2].map((r) => (r.body as { id?: string }).id);
    expect(allIds.every((id) => id === ids[0])).toBe(true);
  });

  it("T8. concurrent divergent (same key, разные body) → один execution + controlled 409", async () => {
    const fin = await createStaff("h_fin8", RoleCode.FINANCE);
    const sm = await createStaff("h_sm8", RoleCode.SALES_MANAGER);
    const { orderId: orderA } = await buildOrder(sm, "idem_t8a", 85);
    const { orderId: orderB } = await buildOrder(sm, "idem_t8b", 80);
    const key = `e2e-t8-${stamp}`;
    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId: orderA }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId: orderB }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
    for (const s of statuses) expect(s).toBeLessThan(500);
    const winner = [r1, r2].find((r) => r.status === 201);
    created.payments.push((winner!.body as { id: string }).id);
    expect(await paymentCount(orderA) + await paymentCount(orderB)).toBe(1); // один факт суммарно
  });

  it("T9. app reconstruction (второй Nest instance, тот же DB) → DB-backed replay", async () => {
    const fin = await createStaff("h_fin9", RoleCode.FINANCE);
    const sm = await createStaff("h_sm9", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t9", 75);
    const key = `e2e-t9-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string; code: string };
    created.payments.push(first.id);

    // «Реконструкция»: новый экземпляр приложения, тот же PostgreSQL.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app2 = moduleRef.createNestApplication();
    app2.setGlobalPrefix("api/v1");
    app2.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app2.useGlobalFilters(new AppExceptionFilter());
    await app2.init();
    try {
      const res = await request(app2.getHttpServer())
        .post("/api/v1/finance/payments")
        .set("Authorization", `Bearer ${fin.accessToken}`)
        .set("Idempotency-Key", key)
        .send({ orderId })
        .expect(201);
      expect((res.body as { id: string }).id).toBe(first.id); // DB-backed replay
    } finally {
      await app2.close();
    }
    expect(await paymentCount(orderId)).toBe(1);
  });

  it("T10. cross-principal: одинаковый literal key разных пользователей → изолированные слоты", async () => {
    const finA = await createStaff("h_fin10a", RoleCode.FINANCE);
    const finB = await createStaff("h_fin10b", RoleCode.FINANCE);
    const sm = await createStaff("h_sm10", RoleCode.SALES_MANAGER);
    const { orderId: orderA } = await buildOrder(sm, "idem_t10a", 70);
    const { orderId: orderB } = await buildOrder(sm, "idem_t10b", 65);
    const key = `e2e-t10-shared-${stamp}`;
    const a = (await createPayment(finA, orderA, key).expect(201)).body as { id: string; orderId: string };
    const b = (await createPayment(finB, orderB, key).expect(201)).body as { id: string; orderId: string };
    created.payments.push(a.id, b.id);
    expect(a.orderId).toBe(orderA);
    expect(b.orderId).toBe(orderB); // НЕ replay результата A
    expect(a.id).not.toBe(b.id);
    expect(await slotCount(finA.user.id, key)).toBe(1);
    expect(await slotCount(finB.user.id, key)).toBe(1);
  });

  it("T11. auth failure → нет replay leakage (аноним с чужим key → 401)", async () => {
    const fin = await createStaff("h_fin11", RoleCode.FINANCE);
    const sm = await createStaff("h_sm11", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t11", 60);
    const key = `e2e-t11-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    // Анонимный запрос с тем же key — 401 ДО слота (guards раньше interceptor-а).
    await request(app.getHttpServer()).post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }).expect(401);
    expect(await paymentCount(orderId)).toBe(1);
  });

  it("T12. RBAC failure → нет bypass (SALES_MANAGER c чужим key → 403)", async () => {
    const fin = await createStaff("h_fin12", RoleCode.FINANCE);
    const sm = await createStaff("h_sm12", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t12", 55);
    const key = `e2e-t12-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    // SALES_MANAGER (нет finance.payment.write) — 403 ДО слота.
    await createPayment(sm, orderId, key).expect(403);
    expect(await paymentCount(orderId)).toBe(1);
  });

  it("T13. rolled-back business operation → claim удалён, ключ не poisoning, нет fake completed success", async () => {
    const fin = await createStaff("h_fin13", RoleCode.FINANCE);
    const sm = await createStaff("h_sm13", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t13", 50);
    const key = `e2e-t13-${stamp}`;
    // Несуществующий order → 404 (бизнес-ошибка после claim) → claim rollback.
    await createPayment(fin, "ord-does-not-exist", key).expect(404);
    expect(await slotCount(fin.user.id, key)).toBe(0); // слот удалён
    // Идентичный повторный запрос с тем же key → снова честный 404 (не replay fake success).
    await createPayment(fin, "ord-does-not-exist", key).expect(404);
    expect(await slotCount(fin.user.id, key)).toBe(0);
    // Ключ полностью переиспользуем для валидного запроса.
    const ok = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(ok.id);
    expect(await slotCount(fin.user.id, key)).toBe(1);
  });

  it("T14. response replay semantics: статус и body идентичны оригиналу", async () => {
    const fin = await createStaff("h_fin14", RoleCode.FINANCE);
    const sm = await createStaff("h_sm14", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t14", 45);
    const key = `e2e-t14-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as Record<string, unknown>;
    created.payments.push(first.id as string);
    const second = (await createPayment(fin, orderId, key).expect(201)).body as Record<string, unknown>;
    expect(second).toEqual(first); // business-result replay (safe body)
  });

  it("T15. unsafe/volatile headers НЕ реплеятся (нет Set-Cookie на replay)", async () => {
    const fin = await createStaff("h_fin15", RoleCode.FINANCE);
    const sm = await createStaff("h_sm15", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t15", 40);
    const key = `e2e-t15-${stamp}`;
    const a = agent(fin.accessToken);
    const first = await a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }).expect(201);
    created.payments.push((first.body as { id: string }).id);
    const replay = await a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }).expect(201);
    expect(replay.headers["set-cookie"]).toBeUndefined();
    expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
  });

  it("T16. unprotected endpoint без Idempotency-Key работает как раньше (transitions — CAS, не этот слой)", async () => {
    const fin = await createStaff("h_fin16", RoleCode.FINANCE);
    const sm = await createStaff("h_sm16", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t16", 35);
    const key = `e2e-t16-${stamp}`;
    const pay = (await createPayment(fin, orderId, key).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    // confirm/fail/cancel — НЕ защищённые операции: без ключа работают.
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(row.status).toBe("CAPTURED");
    // Повторный confirm — канонический CAS 409 (не затронут слоем).
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(409);
  });

  it("T17. idempotency layer НЕ транзишит сам Payment: replay сохраняет PENDING, милстоуны не пишутся", async () => {
    const fin = await createStaff("h_fin17", RoleCode.FINANCE);
    const sm = await createStaff("h_sm17", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t17", 30);
    const key = `e2e-t17-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string; status: string };
    created.payments.push(first.id);
    expect(first.status).toBe("PENDING");
    const replay = (await createPayment(fin, orderId, key).expect(201)).body as { status: string };
    expect(replay.status).toBe("PENDING");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.status).toBe("PENDING");
    expect(row.paidAt).toBeNull();
    expect(row.failedAt).toBeNull();
    expect(row.cancelledAt).toBeNull();
    // Payment lifecycle по-прежнему только через transitions (T16).
  });

  it("T18. no PSP/webhook runtime: 0 webhook-роутов; idempotency-модуль без network/PSP", async () => {
    // Route-graph audit: ни одного webhook/callback роута (как 2.12A T18).
    const server = app.getHttpServer();
    const routes = (server as unknown as { _router?: { stack: Array<{ route?: { path?: string } }> } })._router?.stack ?? [];
    const paths = routes.map((layer) => layer.route?.path).filter((p): p is string => Boolean(p));
    const webhooks = paths.filter((p) => /webhook|callback|hook/i.test(p));
    expect(webhooks).toEqual([]);
    // Source audit: в src/shared/idempotency нет network/PSP импортов.
    const fs = await import("node:fs");
    const pathMod = await import("node:path");
    const dir = pathMod.join(process.cwd(), "src", "shared", "idempotency");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"));
    const banned = /(node-fetch|axios|http\.request|https\.request|stripe|adyen|paypal|fetch\()/i;
    for (const f of files) {
      const content = fs.readFileSync(pathMod.join(dir, f), "utf8");
      expect(content).not.toMatch(banned);
    }
    // SPLIT_AT_PAYMENT / provider registry — вне этого слоя (2.12B).
    expect(await prisma.externalIdempotencyRecord.count({ where: { operation: { not: "payment.create" } } })).toBe(0);
  });

  it("T19. DB race backstop: concurrent identical ×3 → ни одного raw 500, ровно один факт", async () => {
    const fin = await createStaff("h_fin19", RoleCode.FINANCE);
    const sm = await createStaff("h_sm19", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t19", 25);
    const key = `e2e-t19-${stamp}`;
    const a = agent(fin.accessToken);
    const results = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
    ]);
    for (const r of results) {
      expect(r.status).toBeLessThan(500); // никогда raw 500
      expect([201, 409]).toContain(r.status);
    }
    const winners = results.filter((r) => r.status === 201).map((r) => (r.body as { id: string }).id);
    expect(winners.length).toBeGreaterThan(0);
    created.payments.push(winners[0]);
    expect(await paymentCount(orderId)).toBe(1);
    expect(await slotCount(fin.user.id, key)).toBe(1);
    // COMPLETED слот с корректным replay-статусом.
    const rec = await prisma.externalIdempotencyRecord.findUniqueOrThrow({
      where: { slotKey: deriveSlotKey({ type: "USER", id: fin.user.id }, "payment.create", key) },
    });
    expect(rec.status).toBe(ExternalIdempotencyStatus.COMPLETED);
    expect(rec.responseStatus).toBe(201);
  });

  // ── STRICT REVIEW §18/§36 — CRASH WINDOW C FAULT INJECTION ─────────────────
  // Payment COMMIT succeeded, но completion idempotency-записи не произошёл
  // (crash/пропуск) → после stale recovery retry НЕ создаёт второй Payment.
  // Симуляция crash-остатка на уровне DB: слот → IN_PROGRESS + stale claimedAt,
  // response поля → NULL (как если бы complete() не выполнялся).

  const simulateCrashWindowC = async (scopeId: string, key: string) => {
    const slotKey = deriveSlotKey({ type: "USER", id: scopeId }, "payment.create", key);
    await prisma.externalIdempotencyRecord.update({
      where: { slotKey },
      data: {
        status: ExternalIdempotencyStatus.IN_PROGRESS,
        claimedAt: new Date(Date.now() - 120_000), // stale (>30s bound)
        responseStatus: null,
        responseBody: Prisma.DbNull,
        completedAt: null,
      },
    });
  };

  it("T20. CRASH WINDOW C: Payment закоммичен, complete пропущен (stale IN_PROGRESS) → retry даёт ТОТ ЖЕ Payment, 0 дубликатов, 0 raw 500", async () => {
    const fin = await createStaff("h_fin20", RoleCode.FINANCE);
    const sm = await createStaff("h_sm20", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t20", 22);
    const key = `e2e-t20-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    expect(await paymentCount(orderId)).toBe(1);

    // Fault injection: crash между бизнес-commit и idempotency-complete.
    await simulateCrashWindowC(fin.user.id, key);

    // Retry после stale recovery → ре-execute; business idempotency возвращает
    // СУЩЕСТВУЮЩИЙ Payment — второй Payment НЕ создаётся.
    const retry = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    expect(retry.id).toBe(first.id);
    expect(await paymentCount(orderId)).toBe(1); // НЕТ второго Payment
    // НЕТ дубликата PaymentCreated / PaymentHistory.
    expect(await prisma.outboxEvent.count({ where: { eventType: "PaymentCreated", aggregateId: first.id } })).toBe(1);
    expect(await prisma.paymentHistory.count({ where: { paymentId: first.id } })).toBe(1);
    // Слот восстановлен в COMPLETED с корректным replay-результатом.
    const rec = await prisma.externalIdempotencyRecord.findUniqueOrThrow({
      where: { slotKey: deriveSlotKey({ type: "USER", id: fin.user.id }, "payment.create", key) },
    });
    expect(rec.status).toBe(ExternalIdempotencyStatus.COMPLETED);
    expect(rec.responseStatus).toBe(201);
    expect((rec.responseBody as { id: string }).id).toBe(first.id);
  });

  it("T21. divergent retry НЕ может захватить crash-восстановление (stale IN_PROGRESS + другой body → 409, 0 фактов)", async () => {
    const fin = await createStaff("h_fin21", RoleCode.FINANCE);
    const sm = await createStaff("h_sm21", RoleCode.SALES_MANAGER);
    const { orderId: orderA } = await buildOrder(sm, "idem_t21a", 20);
    const { orderId: orderB } = await buildOrder(sm, "idem_t21b", 18);
    const key = `e2e-t21-${stamp}`;
    const first = (await createPayment(fin, orderA, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    await simulateCrashWindowC(fin.user.id, key);

    // Тот же key + другой orderId → fingerprint mismatch ДО stale-логики → 409.
    const res = await createPayment(fin, orderB, key);
    expect(res.status).toBe(409);
    expect(await paymentCount(orderB)).toBe(0); // 0 фактов для orderB
    expect(await paymentCount(orderA)).toBe(1); // исходный факт не тронут
    // Слот остался stale IN_PROGRESS — корректный retry всё ещё может восстановить.
    const rec = await prisma.externalIdempotencyRecord.findUniqueOrThrow({
      where: { slotKey: deriveSlotKey({ type: "USER", id: fin.user.id }, "payment.create", key) },
    });
    expect(rec.status).toBe(ExternalIdempotencyStatus.IN_PROGRESS);
    // Честное восстановление правильным retry (идентичный body).
    const healed = (await createPayment(fin, orderA, key).expect(201)).body as { id: string };
    expect(healed.id).toBe(first.id);
  });

  it("T22. concurrent stale reclaim: два same-key retry после crash-остатка → ни одного raw 500, ровно один факт", async () => {
    const fin = await createStaff("h_fin22", RoleCode.FINANCE);
    const sm = await createStaff("h_sm22", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t22", 16);
    const key = `e2e-t22-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    await simulateCrashWindowC(fin.user.id, key);

    const a = agent(fin.accessToken);
    const [r1, r2] = await Promise.all([
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
      a.post("/api/v1/finance/payments").set("Idempotency-Key", key).send({ orderId }),
    ]);
    for (const r of [r1, r2]) {
      expect(r.status).toBeLessThan(500); // никогда raw 500
      expect([201, 409]).toContain(r.status);
    }
    expect([r1.status, r2.status]).toContain(201); // CAS победитель восстановил
    expect(await paymentCount(orderId)).toBe(1);
    const rec = await prisma.externalIdempotencyRecord.findUniqueOrThrow({
      where: { slotKey: deriveSlotKey({ type: "USER", id: fin.user.id }, "payment.create", key) },
    });
    expect(rec.status).toBe(ExternalIdempotencyStatus.COMPLETED);
  });

  it("T23. raw Idempotency-Key НЕ персистится (только digest slotKey, 0 raw key в записи)", async () => {
    const fin = await createStaff("h_fin23", RoleCode.FINANCE);
    const sm = await createStaff("h_sm23", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t23", 14);
    const key = `raw-key-must-not-persist-${stamp}-secret`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    const rec = await prisma.externalIdempotencyRecord.findUniqueOrThrow({
      where: { slotKey: deriveSlotKey({ type: "USER", id: fin.user.id }, "payment.create", key) },
    });
    const serialized = JSON.stringify(rec);
    expect(serialized).not.toContain(key); // raw key нигде не сохранён
    expect(rec.slotKey).toMatch(/^[0-9a-f]{64}$/); // digest
    expect(rec.slotKey).not.toBe(key);
  });

  it("T24. replay НЕ дублирует PaymentCreated/PaymentHistory (identical retry — только replay)", async () => {
    const fin = await createStaff("h_fin24", RoleCode.FINANCE);
    const sm = await createStaff("h_sm24", RoleCode.SALES_MANAGER);
    const { orderId } = await buildOrder(sm, "idem_t24", 12);
    const key = `e2e-t24-${stamp}`;
    const first = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    created.payments.push(first.id);
    expect(await prisma.outboxEvent.count({ where: { eventType: "PaymentCreated", aggregateId: first.id } })).toBe(1);
    expect(await prisma.paymentHistory.count({ where: { paymentId: first.id } })).toBe(1);

    // Identical retry → replay из слота (бизнес НЕ вызывается).
    const second = (await createPayment(fin, orderId, key).expect(201)).body as { id: string };
    expect(second.id).toBe(first.id);
    expect(await prisma.outboxEvent.count({ where: { eventType: "PaymentCreated", aggregateId: first.id } })).toBe(1);
    expect(await prisma.paymentHistory.count({ where: { paymentId: first.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { resourceId: first.id, action: "finance.payment.created" } })).toBe(1);
  });
});
