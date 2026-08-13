/**
 * E2E: RBAC Matrix §4 — granular permissions на действия жизненного цикла Order/Booking.
 *
 * Фиксирует результаты аудита ролевого UI:
 *  - Step 1.13: BUYER НЕ имеет internal order.read / booking.read (отозваны — это
 *    internal read-контракты), только узкие own-scope права Buyer Cabinet
 *    (account.order.read_own / account.booking.read_own). SALES_MANAGER сохраняет
 *    order.read / booking.read (internal read);
 *  - ни BUYER, ни SALES_MANAGER не имеют ни одного действия
 *    (accept/edit_noncritical/request_booking/close/cancel, send_supplier/confirm/cancel)
 *    → 403 на КАЖДОЕ действие PATCH /orders/:id и PATCH /bookings/:id;
 *  - OPERATOR (полный набор прав Order/Booking) — 200 (позитивный контроль, *  guard работает в обе стороны, а не отключает всё).
 *
 * Test DB: jest `setupFiles` (test/e2e.env.ts) подставляет изолированную
 * тестовую БД (TEST_DATABASE_URL) до импорта AppModule — dev-БД не используется.
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
import { IdsService } from "../src/shared/ids.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { createFixtureOrder, type FixtureOrderInput } from "./fixtures/create-order.fixture";

/** Все команды, которые фронтенд показывает в панелях (и их права из ACTION_PERMISSIONS). */
const ORDER_ACTIONS = ["process", "confirm", "send", "complete", "close", "cancel"] as const;
// Step 2.9: полный набор lifecycle-команд (включая supplier-processing,
// clarification, change/cancellation markers) — все закрыты для BUYER/SALES_MANAGER.
const BOOKING_ACTIONS = [
  "prepare",
  "send",
  "requestClarification",
  "resume",
  "confirm",
  "reject",
  "service",
  "requestChange",
  "resolveChange",
  "requestCancellation",
  "complete",
  "cancel",
  "problem",
] as const;
/** Права, которых не должно быть у BUYER/SALES_MANAGER. */
const ACTION_PERMS = [
  "order.accept",
  "order.edit_noncritical",
  "order.request_booking",
  "order.close",
  "order.cancel",
  "booking.send_supplier",
  "booking.confirm",
  "booking.cancel",
];

describe("Phase 2 — RBAC: действия Order/Booking закрыты по правам (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;

  const created: { users: string[]; products: string[]; orders: string[]; customers: string[] } = {
    users: [],
    products: [],
    orders: [],
    customers: [],
  };
  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; permissions: string[] } };
  };

  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let buyerAgent: ReturnType<typeof request.agent>;
  let salesAgent: ReturnType<typeof request.agent>;
  let opAgent: ReturnType<typeof request.agent>;
  const buyerUsername = `rbac403buyer${stamp}`;
  const salesUsername = `rbac403sales${stamp}`;
  const opUsername = `rbac403op${stamp}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    ids = app.get(IdsService);
    eventBus = app.get(EventBusService);

    // Роли: ADMIN (setup), BUYER (регистрация), SALES_MANAGER и OPERATOR (персонал)
    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: buyerUsername, email: `${buyerUsername}@test.local`, password: "buyerpass123", fullName: "Покупатель 403" })
      .expect(201);
    created.users.push(reg.body.user.id);
    buyerAgent = await agent(reg.body.accessToken);

    const sales = (
      await adminAgent.post("/api/v1/users").send({ username: salesUsername, password: "salespass123", roleCode: RoleCode.SALES_MANAGER })
    ).body;
    created.users.push(sales.id);
    salesAgent = await agent((await login(salesUsername, "salespass123")).accessToken);

    const op = (
      await adminAgent.post("/api/v1/users").send({ username: opUsername, password: "oppass123", roleCode: RoleCode.OPERATOR })
    ).body;
    created.users.push(op.id);
    opAgent = await agent((await login(opUsername, "oppass123")).accessToken);
  });

  afterAll(async () => {
    // Shared-DB isolation (STRICT REVIEW 2.5A): вычищаем ВСЕ события своих
    // заказов (OrderCreated/OrderStatusChanged/BookingRequested/...) + inbox
    // строки их consumer-ов — раньше OrderCreated-строки оставались в общей
    // events.OutboxEvent и ломали absolute-global счётчики других спеков
    // (напр. sales-center «outbox без OrderRequested/OrderCreated»).
    if (created.orders.length > 0) {
      const orderEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: { in: created.orders } },
        select: { id: true },
      });
      const eventIds = orderEvents.map((e) => e.id);
      if (eventIds.length > 0) {
        await prisma.inboxEvent.deleteMany({ where: { eventId: { in: eventIds } } });
      }
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      // Shared-DB isolation (STRICT REVIEW 2.5B): child BookingCreated имеет
      // aggregateId = bookingId (НЕ orderId) — вычищаем по payload.orderId.
      await prisma.outboxEvent.deleteMany({
        where: { eventType: "BookingCreated", OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) },
      });
      // Брони удаляем явно (не полагаемся на каскад Order → Booking).
      await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("BUYER не имеет internal order.read/booking.read, только own-scope Buyer Cabinet права; SALES_MANAGER сохраняет internal read", async () => {
    const buyer = await login(buyerUsername, "buyerpass123");
    expect(buyer.user.role).toBe("BUYER");
    // Step 1.13: узкие own-scope права вместо internal read-контрактов.
    expect(buyer.user.permissions).toContain("account.order.read_own");
    expect(buyer.user.permissions).toContain("account.booking.read_own");
    expect(buyer.user.permissions).not.toContain("order.read");
    expect(buyer.user.permissions).not.toContain("booking.read");
    expect(buyer.user.permissions).not.toContain("crm.customer.read");
    expect(buyer.user.permissions).not.toContain("finance.payment.read");
    for (const p of ACTION_PERMS) expect(buyer.user.permissions).not.toContain(p);

    const sales = await login(salesUsername, "salespass123");
    expect(sales.user.role).toBe("SALES_MANAGER");
    expect(sales.user.permissions).toContain("order.read");
    expect(sales.user.permissions).toContain("booking.read");
    for (const p of ACTION_PERMS) expect(sales.user.permissions).not.toContain(p);
  });

  it("все действия Order → 403 для BUYER и SALES_MANAGER; OPERATOR → 200", async () => {
    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "TOUR", title: `403 Order ${stamp}`, tariffs: [{ name: "S", price: 100 }] })
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const customer = (
      await adminAgent
        .post("/api/v1/customers")
        .send({ type: "PERSON", firstName: "403", lastName: "Order", email: `403-order-${stamp}@test.local` })
    ).body.customer;
    created.customers.push(customer.id);

    const order = (
      await createFixtureOrder(prisma, ids, eventBus, {
        customerId: customer.id,
        items: [{ productId: product.id, title: product.title, type: "TOUR", price: 100 }],
      })
    ).order;
    created.orders.push(order.id);

    // Отрицательный контроль: ни одного действия не должно пройти без прав
    for (const action of ORDER_ACTIONS) {
      await buyerAgent.patch(`/api/v1/orders/${order.id}`).send({ action }).expect(403);
      await salesAgent.patch(`/api/v1/orders/${order.id}`).send({ action }).expect(403);
    }

    // Позитивный контроль: OPERATOR с полным набором прав выполняет команду
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
  });

  it("все действия Booking → 403 для BUYER и SALES_MANAGER; OPERATOR → 200", async () => {
    const product = (
      await adminAgent
        .post("/api/v1/products")
        .send({ type: "HOTEL", title: `403 Booking ${stamp}`, tariffs: [{ name: "S", price: 200 }] })
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);

    const customer = (
      await adminAgent
        .post("/api/v1/customers")
        .send({ type: "PERSON", firstName: "403", lastName: "Booking", email: `403-booking-${stamp}@test.local` })
    ).body.customer;
    created.customers.push(customer.id);

    const order = (
      await createFixtureOrder(prisma, ids, eventBus, {
        customerId: customer.id,
        items: [{ productId: product.id, title: product.title, type: "HOTEL", price: 200 }],
        travelers: [{ firstName: "403", lastName: "Booking", passportNumber: "P8888899" }],
      })
    ).order;
    created.orders.push(order.id);

    // Доводим заказ до Booking силами OPERATOR
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "confirm" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(200);

    const bookings = await opAgent.get(`/api/v1/bookings?orderId=${order.id}`).expect(200);
    expect(bookings.body.total).toBe(1);
    const booking = bookings.body.items[0] as { id: string };

    // Отрицательный контроль: все действия Booking закрыты для ролей без прав
    for (const action of BOOKING_ACTIONS) {
      await buyerAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action }).expect(403);
      await salesAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action }).expect(403);
    }

    // Позитивный контроль: OPERATOR отправляет запрос поставщику
    await opAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
  });
});
