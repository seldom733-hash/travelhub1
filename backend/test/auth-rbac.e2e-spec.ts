/**
 * E2E Phase 2 (Jest + Supertest): аутентификация + RBAC.
 *
 *  - /auth/register (BUYER), /auth/login, /auth/me;
 *  - JWT обязателен (401 без токена);
 *  - granular permissions: ADMIN полный доступ, BUYER только чтение Catalog,
 *    ANALYST — read-only, OPERATOR — команды Order/Booking;
 *  - смена роли (ADMIN) применяется сразу (права читаются из БД);
 *  - bootstrap Order — ADMIN-only exception (order.import);
 *  - аудит auth.login / user.role_changed.
 */
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travelhub1";

import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";

describe("Phase 2 — Auth + RBAC (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("seed создал роли, права и администратора", async () => {
    const roles = await prisma.role.findMany();
    expect(roles.map((r) => r.code)).toEqual(expect.arrayContaining(Object.values(RoleCode)));
    const perms = await prisma.permission.count();
    expect(perms).toBeGreaterThan(30);
    const admin = await prisma.user.findUnique({ where: { username: "admin" }, include: { role: true } });
    expect(admin).toBeTruthy();
    expect(admin!.role.code).toBe(RoleCode.ADMIN);
    expect(admin!.code).toMatch(/^USR-\d{8}$/);
  });

  it("логин администратора выдаёт JWT и полный набор прав", async () => {
    const session = await login("admin", "admin123");
    expect(session.user.role).toBe("ADMIN");
    expect(session.user.permissions).toContain("order.import");
    expect(session.user.permissions).toContain("settings.write");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.username).toBe("admin");
  });

  it("без токена API закрыт (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/products").expect(401);
    await request(app.getHttpServer()).post("/api/v1/products").send({}).expect(401);
    await request(app.getHttpServer()).get("/api/v1/orders").expect(401);
  });

  it("неверные учётные данные → 401", async () => {
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "wrong" }).expect(401);
  });

  it("регистрация создаёт BUYER: читает Catalog, писать не может", async () => {
    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `buyer1${stamp}`, password: "buyerpass123", fullName: "Покупатель Тест" })
      .expect(201);
    const buyer = reg.body.user;
    expect(buyer.role).toBe("BUYER");
    created.users.push(buyer.id);
    expect(buyer.permissions).toContain("catalog.product.read");
    expect(buyer.permissions).not.toContain("catalog.product.write");

    const buyerAgent = await agent(reg.body.accessToken);
    await buyerAgent.get("/api/v1/products").expect(200);
    await buyerAgent.post("/api/v1/products").send({ type: "TOUR", title: "Forbidden Tour" }).expect(403);
  });

  it("bootstrap Order — только ADMIN (order.import)", async () => {
    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `buyer2${stamp}`, password: "buyerpass123" })
      .expect(201);
    created.users.push(reg.body.user.id);

    const buyerAgent = await agent(reg.body.accessToken);
    await buyerAgent
      .post("/api/v1/orders/bootstrap")
      .send({ customerId: "none", items: [{ productId: "none", title: "x", type: "TOUR", price: 1 }] })
      .expect(403);
  });

  it("ANALYST: read-only — читает, но команды запрещены", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = await agent(admin.accessToken);
    const createdRes = await adminAgent
      .post("/api/v1/users")
      .send({ username: `analyst1${stamp}`, password: "analystpass123", roleCode: RoleCode.ANALYST })
      .expect(201);
    created.users.push(createdRes.body.id);

    const analyst = await login(`analyst1${stamp}`, "analystpass123");
    const analystAgent = await agent(analyst.accessToken);
    await analystAgent.get("/api/v1/orders").expect(200);
    await analystAgent.patch("/api/v1/orders/some-id").send({ action: "process" }).expect(403);
  });

  it("смена роли применяется сразу (права читаются из БД)", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = await agent(admin.accessToken);
    const analyst = await prisma.user.findUniqueOrThrow({ where: { username: `analyst1${stamp}` } });

    await adminAgent.patch(`/api/v1/users/${analyst.id}/role`).send({ roleCode: RoleCode.OPERATOR }).expect(200);

    const operator = await login(`analyst1${stamp}`, "analystpass123");
    expect(operator.user.permissions).toContain("order.accept");
  });

  it("OPERATOR выполняет жизненный цикл Order и Booking", async () => {
    const admin = await login("admin", "admin123");
    const adminAgent = await agent(admin.accessToken);

    const product = (
      await adminAgent.post("/api/v1/products").send({ type: "TOUR", title: "RBAC Tour", tariffs: [{ name: "S", price: 100 }] })
    ).body.product;
    created.products.push(product.id);
    await adminAgent.post(`/api/v1/products/${product.id}/publish`).expect(201);
    const customer = (
      await adminAgent
        .post("/api/v1/customers")
        .send({ type: "PERSON", firstName: "RBAC", lastName: "Customer", email: `rbac${stamp}@test.local` })
    ).body.customer;
    created.customers.push(customer.id);
    const order = (
      await adminAgent.post("/api/v1/orders/bootstrap").send({
        customerId: customer.id,
        items: [{ productId: product.id, title: product.title, type: "TOUR", price: 100 }],
        travelers: [{ firstName: "RBAC", lastName: "Customer", passportNumber: "P8888888" }],
      })
    ).body.order;
    created.orders.push(order.id);

    const operator = await login(`analyst1${stamp}`, "analystpass123");
    const opAgent = await agent(operator.accessToken);

    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "process" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "confirm" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${order.id}`).send({ action: "send" }).expect(200);

    const bookings = await opAgent.get(`/api/v1/bookings?orderId=${order.id}`).expect(200);
    expect(bookings.body.total).toBe(1);
    const booking = bookings.body.items[0];
    await opAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
    await opAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(200);
    await opAgent.patch(`/api/v1/bookings/${booking.id}`).send({ action: "cancel" }).expect(200);
  });

  it("аудит безопасности фиксирует вход и смену роли", async () => {
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: ["auth.login", "user.role_changed"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(logs.some((l) => l.action === "auth.login")).toBe(true);
    expect(logs.some((l) => l.action === "user.role_changed")).toBe(true);
  });
});
