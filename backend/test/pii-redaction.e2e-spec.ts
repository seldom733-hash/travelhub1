/**
 * E2E: Step 1.17 — field-level redaction для order.read/booking.read.
 *
 * Политика: полные PII traveler'ов/пассажиров (passportNumber/passportExpiry/
 * birthDate) видны ТОЛЬКО OPERATOR и ADMIN. Остальные staff-роли
 * (SALES_MANAGER/FINANCE/ANALYST/MARKETER/DIRECTOR/MODERATOR) получают redacted
 * projection — чувствительные поля null, имена/гражданство/пол сохранены.
 *
 * Доказательства:
 *  - OPERATOR: GET /orders/:id, GET /bookings/:id → полные PII;
 *  - ADMIN: то же (positive control);
 *  - ANALYST: GET /orders/:id, GET /orders (list), GET /bookings/:id → PII null,
 *    firstName/lastName сохранены;
 *  - внутренняя проекция (booking.service.bookingAction) не затрагивается —
 *    fixture через prisma, читается только через HTTP-контур;
 *  - BUYER: 403 (нет order.read — regression внешнего контура).
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
import { createFixtureOrder } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[] };
}

describe("Step 1.17 — PII redaction: traveler/passenger в order/booking read (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;

  const stamp = Date.now();
  const created = {
    users: [] as string[],
    customers: [] as string[],
    orders: [] as string[],
    bookings: [] as string[],
    travelers: [] as string[],
    passengers: [] as string[],
  };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const createStaff = async (adminAgent: ReturnType<typeof request.agent>, uname: string, pwd: string, roleCode: RoleCode) => {
    const res = await adminAgent.post("/api/v1/users").send({ username: uname, password: pwd, roleCode }).expect(201);
    created.users.push(res.body.id);
    return login(uname, pwd);
  };

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

    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);

    // Customer + Order с traveler (полные PII) через test-fixture (Step 2.6).
    const customer = (
      await adminAgent
        .post("/api/v1/customers")
        .send({ type: "PERSON", firstName: "PII", lastName: "Owner", email: `pii-${stamp}@test.local` })
        .expect(201)
    ).body.customer;
    created.customers.push(customer.id);

    const order = (
      await createFixtureOrder(prisma, ids, eventBus, {
        customerId: customer.id,
        currency: "USD",
        items: [{ productId: "00000000-0000-0000-0000-000000000001", title: "PII Tour", type: "TOUR", price: 100 }],
        travelers: [
          {
            firstName: "Иван",
            lastName: "Петров",
            birthDate: "1990-05-01",
            citizenship: "AZ",
            gender: "male",
            passportNumber: "AB1234567",
          },
        ],
      })
    ).order;
    created.orders.push(order.id);

    // Booking + Passenger (полные PII) — фикстура напрямую (детерминированно).
    const booking = await prisma.booking.create({
      data: { code: `BKG-PII-${stamp}`, referenceNumber: "MKT-BKG-000001", orderId: order.id, productId: "00000000-0000-0000-0000-000000000001", status: "NEW", amount: 100 },
    });
    created.bookings.push(booking.id);
    const passenger = await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        firstName: "Айгюн",
        lastName: "Алиева",
        birthDate: new Date("1992-02-02"),
        citizenship: "AZ",
        gender: "female",
        passportNumber: "CD7654321",
      },
    });
    created.passengers.push(passenger.id);

    const operator = await createStaff(adminAgent, `piiop${stamp}`, "oppass123", RoleCode.OPERATOR);
    const analyst = await createStaff(adminAgent, `piiana${stamp}`, "anapass123", RoleCode.ANALYST);
    const buyer = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ username: `piibuy${stamp}`, email: `piibuy${stamp}@test.local`, password: "buyerpass123", fullName: "Покупатель" })
        .expect(201)
    ).body as Session;
    created.users.push(buyer.user.id);

    // Session storage для тестов.
    (globalThis as unknown as { __pii: Record<string, unknown> }).__pii = {
      orderId: order.id,
      bookingId: booking.id,
      operatorToken: operator.accessToken,
      analystToken: analyst.accessToken,
      buyerToken: buyer.accessToken,
    };
  });

  afterAll(async () => {
    // Shared-DB isolation (STRICT REVIEW 2.5B): bootstrap-заказы эмитят
    // OrderCreated (causation=null) — чистим outbox + inbox своих заказов.
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
    }
    await prisma.passenger.deleteMany({ where: { id: { in: created.passengers } } });
    await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    await prisma.orderTraveler.deleteMany({ where: { id: { in: created.travelers } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  const st = () => (globalThis as unknown as { __pii: Record<string, unknown> }).__pii as { orderId: string; bookingId: string; operatorToken: string; analystToken: string; buyerToken: string };

  it("OPERATOR: GET /orders/:id → полные PII traveler'а", async () => {
    const s = st();
    const order = (await agent(s.operatorToken).get(`/api/v1/orders/${s.orderId}`).expect(200)).body;
    expect(order.travelers[0].passportNumber).toBe("AB1234567");
    expect(order.travelers[0].birthDate).toBe("1990-05-01T00:00:00.000Z");
  });

  it("OPERATOR: GET /bookings/:id → полные PII пассажира", async () => {
    const s = st();
    const booking = (await agent(s.operatorToken).get(`/api/v1/bookings/${s.bookingId}`).expect(200)).body;
    expect(booking.passengers[0].passportNumber).toBe("CD7654321");
  });

  it("ANALYST: GET /orders/:id → redacted (PII null, имена сохранены)", async () => {
    const s = st();
    const order = (await agent(s.analystToken).get(`/api/v1/orders/${s.orderId}`).expect(200)).body;
    expect(order.travelers[0].passportNumber).toBeNull();
    expect(order.travelers[0].passportExpiry).toBeNull();
    expect(order.travelers[0].birthDate).toBeNull();
    expect(order.travelers[0].firstName).toBe("Иван");
    expect(order.travelers[0].lastName).toBe("Петров");
    expect(order.travelers[0].citizenship).toBe("AZ");
    expect(order.travelers[0].gender).toBe("male");
  });

  it("ANALYST: GET /orders (list) → travelers redacted в списке", async () => {
    const s = st();
    const res = (await agent(s.analystToken).get("/api/v1/orders").expect(200)).body;
    expect(res.items.length).toBeGreaterThan(0);
    const found = res.items.find((o: { id: string }) => o.id === s.orderId);
    expect(found).toBeTruthy();
    expect(found.travelers[0].passportNumber).toBeNull();
    expect(found.travelers[0].firstName).toBe("Иван");
  });

  it("ANALYST: GET /bookings/:id → passenger redacted (PII null, имена сохранены)", async () => {
    const s = st();
    const booking = (await agent(s.analystToken).get(`/api/v1/bookings/${s.bookingId}`).expect(200)).body;
    expect(booking.passengers[0].passportNumber).toBeNull();
    expect(booking.passengers[0].birthDate).toBeNull();
    expect(booking.passengers[0].firstName).toBe("Айгюн");
    expect(booking.passengers[0].lastName).toBe("Алиева");
  });

  it("ADMIN: positive control — полные PII в обоих контурах", async () => {
    const s = st();
    const admin = await login("admin", "admin123");
    const adminAgent = agent(admin.accessToken);
    const order = (await adminAgent.get(`/api/v1/orders/${s.orderId}`).expect(200)).body;
    expect(order.travelers[0].passportNumber).toBe("AB1234567");
    const booking = (await adminAgent.get(`/api/v1/bookings/${s.bookingId}`).expect(200)).body;
    expect(booking.passengers[0].passportNumber).toBe("CD7654321");
  });

  it("BUYER: 403 на order/booking read (нет order.read — regression)", async () => {
    const s = st();
    await agent(s.buyerToken).get(`/api/v1/orders/${s.orderId}`).expect(403);
    await agent(s.buyerToken).get(`/api/v1/bookings/${s.bookingId}`).expect(403);
  });
});
