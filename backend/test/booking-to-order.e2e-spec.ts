/**
 * Stage 2 — BOOKING → ORDER round-trip (`returnToOrder`) — e2e.
 *
 * Контракт (Q1–Q9 + матрица reconciliation):
 *  1. direct-возврат (NEW..NEEDS_CLARIFICATION + PROBLEM): бронь → CANCELLED
 *     (CAS + cancelledAt), Order SENT_TO_BOOKING → READY_FOR_BOOKING (или
 *     PARTIALLY_FULFILLED при оставшихся активных), BookingHistory
 *     `returned_to_order` + OrderHistory `returnFromBooking` + AuditLog
 *     `booking.returned_to_order`, события BookingCancelled (direct) +
 *     OrderStatusChanged (только при изменении Order);
 *  2. матрица Q2: CONFIRMED/IN_SERVICE/CANCELLATION_REQUESTED/CHANGE_REQUESTED
 *     → 409 «сначала подтверждённая отмена»; COMPLETED → 409 (никогда);
 *     PROBLEM с history CONFIRMED/IN_SERVICE → 409;
 *  3. guards: payments AUTHORIZED/CAPTURED → 409 «refund first» (Q4, без
 *     auto-refund, OrderPaymentStatus не трогается); Order вне from-списка /
 *     терминальный → 409 — всё до мутаций;
 *  4. phase-2 (CANCELLED/SUPPLIER_REJECTED): статус брони не меняется, повтор
 *     при «ничего не меняется» → 409 (идемпотентность отказом);
 *  5. Q1/Q5: агрегат partial (PARTIALLY_FULFILLED) / full (READY_FOR_BOOKING);
 *  6. Q9: после возврата повторный `send` создаёт B2 ТОЛЬКО для свободных
 *     items; все items заняты → 409; старая бронь никогда не удаляется;
 *  7. Q8: Commission ACCRUED → REVERSED (CAS, accrual зеркально) + факт-событие
 *     CommissionReversed; повторный возврат не создаёт второй факт;
 *  8. Q7: RBAC — без booking.return_to_order → 403, действие не применилось,
 *     проекция не показывает команду.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { IdsService } from "../src/shared/ids.service";
import { EventBusService } from "../src/eventbus/eventbus.service";
import { RoleCode, type BookingStatus, type Prisma } from "../src/generated/prisma/client";
import { createFixtureOrder } from "./fixtures/create-order.fixture";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}
interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe("Stage 2 — Booking → Order round-trip (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdsService;
  let eventBus: EventBusService;
  let adminAgent: ReturnType<typeof request.agent>;
  let seller: Seller;
  let op: Session;
  let analyst: Session;
  let productId: string;

  const stamp = Date.now();
  let uniq = 0;
  const nextUniq = () => String(++uniq);
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    orders: string[];
  } = { users: [], customers: [], partners: [], products: [], orders: [] };

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

  /** Approve-путь партнёра (Stage-1 pattern): catalog.product.create_own у
   *  PARTNER. admin-создание Product — pre-existing 403 (catalog.product.write
   *  отсутствует у ADMIN в базе; baseline: rbac-actions/d6-… — известные
   *  фейлы), поэтому продукт создаётся владельцем-партнёром. */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `st2${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `ST2 Partner ${tag} ${stamp}`,
        country: "AZ",
        contactEmail: email,
        termsAccepted: true,
      })
      .expect(201);
    const pAgent = agent((await login(email, "partnerpass123")).accessToken);
    const appRow = (await pAgent.get("/api/v1/partner/application").expect(200)).body as { id: string };
    await pAgent.post("/api/v1/partner/application/submit").expect(201);
    const queue = (await adminAgent.get("/api/v1/partner/onboarding/review").expect(200)).body as {
      items: Array<{ id: string }>;
    };
    const reviewId = queue.items.find((x) => x.id === appRow.id)!.id;
    await adminAgent.post(`/api/v1/partner/onboarding/review/${reviewId}/start`).expect(201);
    const approved = (await adminAgent
      .post(`/api/v1/partner/onboarding/review/${reviewId}/approve`)
      .send({ reason: "ok" })
      .expect(201)).body as { partnerId: string };
    created.partners.push(approved.partnerId);
    const session = await login(email, "partnerpass123");
    created.users.push(session.user.id);
    return { partnerId: approved.partnerId, token: session.accessToken, agent: agent(session.accessToken) };
  };

  const opAgent = () => agent(op.accessToken);

  /** Fixture-Order → process → confirm → send → consumer создаёт ровно itemCount Booking. */
  const makeSentOrder = async (
    tag: string,
    itemCount = 1,
  ): Promise<{ orderId: string; orderCode: string; customerId: string; bookingIds: string[] }> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "ST2",
        lastName: tag.toUpperCase(),
        code: `CRM-ST2-${tag.toUpperCase()}-${stamp}`,
        email: `st2-${tag.toLowerCase()}-${stamp}@example.com`,
      },
    });
    created.customers.push(customer.id);

    const fixture = await createFixtureOrder(prisma, ids, eventBus, {
      customerId: customer.id,
      items: Array.from({ length: itemCount }, (_, i) => ({
        productId,
        title: `ST2 ${tag} item ${i + 1}`,
        type: "TOUR",
        price: 100,
      })),
      travelers: [{ firstName: "ST2", lastName: tag.toUpperCase(), passportNumber: "P1234567" }],
      serviceDate: FUTURE(),
    });
    created.orders.push(fixture.order.id);

    await opAgent().patch(`/api/v1/orders/${fixture.order.id}`).send({ action: "process" }).expect(200);
    await opAgent().patch(`/api/v1/orders/${fixture.order.id}`).send({ action: "confirm" }).expect(200);
    await opAgent().patch(`/api/v1/orders/${fixture.order.id}`).send({ action: "send" }).expect(200);

    // listBookings по умолчанию сужает scope до MARKETPLACE — fixture-заказы
    // имеют acquisitionSource DIRECT, фильтруем явно.
    const bookings = (
      await opAgent().get(`/api/v1/bookings?orderId=${fixture.order.id}&acquisitionSource=DIRECT`).expect(200)
    ).body as {
      items: Array<{ id: string }>;
      total: number;
    };
    expect(bookings.total).toBe(itemCount);
    return {
      orderId: fixture.order.id,
      orderCode: fixture.order.code,
      customerId: customer.id,
      bookingIds: bookings.items.map((b) => b.id),
    };
  };

  const returnToOrder = (bookingId: string, reason?: string) =>
    opAgent().patch(`/api/v1/bookings/${bookingId}`).send({ action: "returnToOrder", reason });

  const setBookingStatus = (id: string, status: BookingStatus, extra: Prisma.BookingUpdateInput = {}) =>
    prisma.booking.update({ where: { id }, data: { status, version: { increment: 1 }, ...extra } });

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
    adminAgent = agent(admin.accessToken);
    seller = await createApprovedSeller("st2");
    op = await createStaff("st2_op", RoleCode.OPERATOR);
    analyst = await createStaff("st2_an", RoleCode.ANALYST);

    const product = (
      await seller.agent.post("/api/v1/products").send({
        type: "TOUR",
        title: `ST2 Product ${stamp}`,
        tariffs: [{ name: "Std", price: 100 }],
      }).expect(201)
    ).body as { product: { id: string } };
    productId = product.product.id;
    created.products.push(productId);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      const commissionIds = (
        await prisma.commission.findMany({
          where: { orderId: { in: created.orders } },
          select: { id: true },
        })
      ).map((c) => c.id);
      const bookingIds = (
        await prisma.booking.findMany({ where: { orderId: { in: created.orders } }, select: { id: true } })
      ).map((b) => b.id);
      const outboxIds = (
        await prisma.outboxEvent.findMany({
          where: { aggregateId: { in: [...created.orders, ...bookingIds, ...commissionIds] } },
          select: { id: true },
        })
      ).map((e) => e.id);
      const bookingCreatedIds = (
        await prisma.outboxEvent.findMany({
          where: {
            eventType: "BookingCreated",
            OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
          },
          select: { id: true },
        })
      ).map((e) => e.id);
      const eventIds = [...new Set([...outboxIds, ...bookingCreatedIds])];
      if (eventIds.length > 0) await prisma.inboxEvent.deleteMany({ where: { eventId: { in: eventIds } } });
      if (eventIds.length > 0) await prisma.outboxEvent.deleteMany({ where: { id: { in: eventIds } } });

      await prisma.payment.deleteMany({ where: { orderId: { in: created.orders } } });
      if (commissionIds.length > 0) {
        await prisma.commissionAccrual.deleteMany({ where: { sourceCommissionId: { in: commissionIds } } });
        await prisma.commission.deleteMany({ where: { id: { in: commissionIds } } });
      }
      await prisma.passenger.deleteMany({ where: { booking: { orderId: { in: created.orders } } } });
      await prisma.bookingHistory.deleteMany({ where: { booking: { orderId: { in: created.orders } } } });
      await prisma.booking.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.orderHistory.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.auditLog.deleteMany({ where: { action: "booking.returned_to_order" } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. direct round-trip: NEW-бронь → CANCELLED, Order → READY_FOR_BOOKING, history/audit/events, B1 сохраняется", async () => {
    const { orderId, orderCode, bookingIds } = await makeSentOrder("one");
    const bookingId = bookingIds[0];

    const b1 = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o1.status).toBe("SENT_TO_BOOKING");

    // Defensive release-гвард §5.2: HELD Reservation → RELEASED при возврате.
    await prisma.reservation.create({ data: { bookingId, supplierId: "st2-supplier" } });

    // Проекция: оператору returnToOrder виден, аналитику — нет (гранулярный RBAC).
    const opDetail = (await opAgent().get(`/api/v1/bookings/${bookingId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(opDetail.availableActions).toContain("returnToOrder");
    const anDetail = (await agent(analyst.accessToken).get(`/api/v1/bookings/${bookingId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(anDetail.availableActions).not.toContain("returnToOrder");

    // RBAC: без права → 403, действие не применилось.
    await agent(analyst.accessToken)
      .patch(`/api/v1/bookings/${bookingId}`)
      .send({ action: "returnToOrder" })
      .expect(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("NEW");

    // Сам round-trip.
    const res = (await returnToOrder(bookingId, "поставщик не подтвердил сроки").expect(200)).body as {
      id: string;
      status: string;
      version: number;
    };
    expect(res.status).toBe("CANCELLED");
    expect(res.version).toBe(b1.version + 1);

    // Booking: CANCELLED + milestone + defensive Reservation release; B1 не удалена.
    const bAfter = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(bAfter.status).toBe("CANCELLED");
    expect(bAfter.cancelledAt).not.toBeNull();
    expect(bAfter.version).toBe(b1.version + 1);
    const reservation = await prisma.reservation.findFirst({ where: { bookingId } });
    expect(reservation).not.toBeNull();
    expect(reservation!.status).toBe("RELEASED");

    // BookingHistory returned_to_order (from/to/actor UUID/username/reason).
    const bHist = await prisma.bookingHistory.findFirst({ where: { bookingId, action: "returned_to_order" } });
    expect(bHist).not.toBeNull();
    expect(bHist!.from).toBe("NEW");
    expect(bHist!.to).toBe("CANCELLED");
    expect(bHist!.actorId).toBe(op.user.id);
    expect(bHist!.actorName).toBe("st2_op" + stamp);
    expect(bHist!.comment).toContain(orderCode);
    expect(bHist!.comment).toContain("поставщик не подтвердил сроки");

    // Order: READY_FOR_BOOKING (нет активных броней) + history; paymentStatus не тронут.
    const oAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(oAfter.status).toBe("READY_FOR_BOOKING");
    expect(oAfter.version).toBe(o1.version + 1);
    expect(oAfter.paymentStatus).toBe("UNPAID");
    const oHist = await prisma.orderHistory.findFirst({ where: { orderId, action: "returnFromBooking" } });
    expect(oHist).not.toBeNull();
    expect(oHist!.from).toBe("SENT_TO_BOOKING");
    expect(oHist!.to).toBe("READY_FOR_BOOKING");
    expect(oHist!.actorName).toBe("st2_op" + stamp);
    expect(oHist!.comment).toMatch(/из бронирования/);

    // AuditLog (Q6: факт передачи фиксируется в history/audit, PII не трогается).
    const audit = await prisma.auditLog.findFirst({
      where: { action: "booking.returned_to_order", resourceId: bookingId },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(op.user.id);
    const details = audit!.details as Record<string, unknown>;
    expect(details.orderTo).toBe("READY_FOR_BOOKING");
    expect(details.bookingTo).toBe("CANCELLED");

    // События: BookingCancelled (direct) + OrderStatusChanged (изменение Order);
    // BookingStatusChanged НЕ эмитится (canonical возврат — BookingCancelled).
    const cancelEvt = await prisma.outboxEvent.findFirst({
      where: { eventType: "BookingCancelled", aggregateId: bookingId },
    });
    expect(cancelEvt).not.toBeNull();
    const changedEvt = await prisma.outboxEvent.findFirst({
      where: {
        eventType: "OrderStatusChanged",
        aggregateId: orderId,
        AND: [
          { payload: { path: ["from"], equals: "SENT_TO_BOOKING" } },
          { payload: { path: ["to"], equals: "READY_FOR_BOOKING" } },
        ],
      },
    });
    expect(changedEvt).not.toBeNull();
    expect(
      await prisma.outboxEvent.count({ where: { eventType: "BookingStatusChanged", aggregateId: bookingId } }),
    ).toBe(0);

    // Проекция после действия: send снова доступен (Q9). Stage 2 fix (Bug 1 /
    // AC-1): returnToOrder СКРЫТ в проекции возвращённой брони — источник
    // правды «уже возвращена» = history-факт returned_to_order (тот же fact
    // используется guard-ом). Повторный прямой API-вызов защищён → 409
    // «already returned» (AC-2), без мутаций.
    const bookingDetailAfter = (await opAgent().get(`/api/v1/bookings/${bookingId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(bookingDetailAfter.availableActions).not.toContain("returnToOrder");
    const orderDetail = (await opAgent().get(`/api/v1/orders/${orderId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(orderDetail.availableActions).toContain("send");

    const repeat = await returnToOrder(bookingId, "повтор после возврата").expect(409);
    expect(String((repeat.body as { message?: string }).message ?? "")).toMatch(/already returned/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).version).toBe(b1.version + 1);
    expect(await prisma.bookingHistory.count({ where: { bookingId, action: "returned_to_order" } })).toBe(1);
  });

  it("2. матрица Q2: подтверждённые/активные → 409 «сначала подтверждённая отмена»; COMPLETED → 409; без мутаций", async () => {
    const { orderId, bookingIds } = await makeSentOrder("matrix");
    const bookingId = bookingIds[0];
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    for (const status of ["CONFIRMED", "IN_SERVICE", "CANCELLATION_REQUESTED", "CHANGE_REQUESTED"] as const) {
      await setBookingStatus(bookingId, status);
      const r = await returnToOrder(bookingId).expect(409);
      expect(String((r.body as { message?: string }).message ?? "")).toMatch(/requestCancellation/);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe(status);
    }

    // COMPLETED — терминальный, возврат невозможен (Q2).
    await setBookingStatus(bookingId, "COMPLETED");
    const completed = await returnToOrder(bookingId).expect(409);
    expect(String((completed.body as { message?: string }).message ?? "")).toMatch(/Cannot returnToOrder/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("COMPLETED");

    // Ни одна 409 не тронула Order и не добавила history-строк.
    const oAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(oAfter.status).toBe(o1.status);
    expect(oAfter.version).toBe(o1.version);
    expect(await prisma.bookingHistory.count({ where: { bookingId, action: "returned_to_order" } })).toBe(0);
  });

  it("3. PROBLEM: с history CONFIRMED/IN_SERVICE → 409; без подтверждений → direct-возврат работает", async () => {
    const { orderId, bookingIds } = await makeSentOrder("problem");
    const bookingId = bookingIds[0];

    // Подтверждённая в прошлом бронь в PROBLEM: двухфазный гейт (Q2).
    await prisma.bookingHistory.create({
      data: { bookingId, action: "confirmed", from: "SENT_TO_SUPPLIER", to: "CONFIRMED" },
    });
    await setBookingStatus(bookingId, "PROBLEM");
    const guarded = await returnToOrder(bookingId).expect(409);
    expect(String((guarded.body as { message?: string }).message ?? "")).toMatch(/history CONFIRMED/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("PROBLEM");

    // PROBLEM без подтверждений (owner: recovery через returnToOrder) → работает.
    await prisma.bookingHistory.deleteMany({ where: { bookingId, action: "confirmed" } });
    await returnToOrder(bookingId, "recover").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("CANCELLED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("READY_FOR_BOOKING");
  });

  it("4. Order-guards: вне from-списка / терминальный / payments → 409 до мутаций; PROBLEM-order recovery работает", async () => {
    const { orderId, bookingIds } = await makeSentOrder("guards");
    const bookingId = bookingIds[0];
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    // (a) Order вне from-списка → 409.
    await prisma.order.update({ where: { id: orderId }, data: { status: "NEW", version: { increment: 1 } } });
    const fromGuard = await returnToOrder(bookingId).expect(409);
    expect(String((fromGuard.body as { message?: string }).message ?? "")).toMatch(/expected/);

    // (b) Order терминальный → 409.
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED", version: { increment: 1 } } });
    const terminalGuard = await returnToOrder(bookingId).expect(409);
    expect(String((terminalGuard.body as { message?: string }).message ?? "")).toMatch(/is CANCELLED/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("NEW");

    // (c) Q4: AUTHORIZED payment → 409 «refund first», без auto-refund.
    await prisma.order.update({ where: { id: orderId }, data: { status: "SENT_TO_BOOKING" } });
    const payment = await prisma.payment.create({
      data: {
        code: `PAY-ST2-${stamp}-${nextUniq()}`,
        referenceNumber: `MKT-PAY-ST2-${stamp}-${nextUniq()}`,
        orderId,
        amount: 100,
        currency: "USD",
        status: "AUTHORIZED",
      },
    });
    const payGuard = await returnToOrder(bookingId).expect(409);
    expect(String((payGuard.body as { message?: string }).message ?? "")).toMatch(/refund first/);
    const oAfterPay = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(oAfterPay.status).toBe("SENT_TO_BOOKING");
    expect(oAfterPay.paymentStatus).toBe("UNPAID");
    await prisma.payment.delete({ where: { id: payment.id } });

    // (d) PROBLEM-order в from-списке (owner decision): возврат восстанавливает заказ.
    await prisma.order.update({ where: { id: orderId }, data: { status: "PROBLEM" } });
    await returnToOrder(bookingId, "problem recovery").expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("CANCELLED");
    const recovered = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(recovered.status).toBe("READY_FOR_BOOKING");
    expect(recovered.version).toBeGreaterThan(o1.version);
  });

  it("5. phase-2 (SUPPLIER_REJECTED): статус брони не меняется; повтор → 409, версии/history стабильны", async () => {
    const { orderId, bookingIds } = await makeSentOrder("phase2");
    const bookingId = bookingIds[0];
    await setBookingStatus(bookingId, "SUPPLIER_REJECTED", { rejectedAt: new Date() });

    const res = (await returnToOrder(bookingId, "отклонён поставщиком").expect(200)).body as { status: string };
    expect(res.status).toBe("SUPPLIER_REJECTED"); // phase-2: статус не меняется

    const bAfter = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(bAfter.status).toBe("SUPPLIER_REJECTED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("READY_FOR_BOOKING");
    const hist = await prisma.bookingHistory.findFirst({ where: { bookingId, action: "returned_to_order" } });
    expect(hist).not.toBeNull();
    expect(hist!.from).toBe("SUPPLIER_REJECTED");
    expect(hist!.to).toBe("SUPPLIER_REJECTED");
    // direct-событие BookingCancelled НЕ было (перехода не было).
    expect(
      await prisma.outboxEvent.count({ where: { eventType: "BookingCancelled", aggregateId: bookingId } }),
    ).toBe(0);

    // Повтор при «ничего не меняется» → 409, без новых history/версий.
    const repeat = await returnToOrder(bookingId, "повтор").expect(409);
    expect(String((repeat.body as { message?: string }).message ?? "")).toMatch(/already returned/);
    const bFinal = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(bFinal.version).toBe(bAfter.version);
    expect(await prisma.bookingHistory.count({ where: { bookingId, action: "returned_to_order" } })).toBe(1);
    expect(await prisma.orderHistory.count({ where: { orderId, action: "returnFromBooking" } })).toBe(1);
  });

  it("6. Q1/Q5/Q9: partial-возврат → PARTIALLY_FULFILLED; повторный send создаёт B2 только для свободных items; все заняты → 409", async () => {
    const { orderId } = await makeSentOrder("partial", 2);
    const items = await prisma.orderItem.findMany({ where: { orderId }, orderBy: { id: "asc" } });
    expect(items).toHaveLength(2);
    const bks0 = await prisma.booking.findMany({ where: { orderId } });
    const b1 = bks0.find((b) => b.orderItemId === items[0].id)!.id;
    const b2 = bks0.find((b) => b.orderItemId === items[1].id)!.id;

    // Partial: одна активная бронь остаётся → PARTIALLY_FULFILLED (Q1/Q5).
    await returnToOrder(b1).expect(200);
    const oPartial = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(oPartial.status).toBe("PARTIALLY_FULFILLED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b2 } })).status).toBe("NEW");

    // Повторный send из PARTIALLY_FULFILLED (follow-up) → B2 только для item1.
    await opAgent().patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(200);
    const afterSend = await prisma.booking.findMany({ where: { orderId } });
    expect(afterSend).toHaveLength(3);
    const b1After = afterSend.find((b) => b.id === b1)!;
    expect(b1After.status).toBe("CANCELLED"); // старая бронь никогда не удаляется (Q9)
    const active = afterSend.filter((b) => b.status === "NEW");
    expect(active).toHaveLength(2);
    expect(active.map((b) => b.orderItemId).sort()).toEqual([items[0].id, items[1].id].sort());
    // Новая бронь заняла освободившийся item первой брони, item2 не дублирован.
    const newBooking = afterSend.find((b) => b.id !== b1 && b.id !== b2)!;
    expect(newBooking.orderItemId).toBe(items[0].id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("SENT_TO_BOOKING");

    // Gate: Order в рабочей стадии (PARTIALLY_FULFILLED, как после reconcile),
    // но все items заняты активными бронями → send → 409 /free order item/ (никаких B3).
    await prisma.order.update({ where: { id: orderId }, data: { status: "PARTIALLY_FULFILLED" } });
    const gate = await opAgent().patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(409);
    expect(String((gate.body as { message?: string }).message ?? "")).toMatch(/free order item/);
    expect(await prisma.booking.count({ where: { orderId } })).toBe(3);

    // Full-возврат: вернули оставшиеся две активные брони → READY_FOR_BOOKING,
    // phase-2 повторы → 409 (идемпотентность отказом).
    await returnToOrder(b2).expect(200);
    await returnToOrder(newBooking.id).expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("READY_FOR_BOOKING");
    const repeat = await returnToOrder(b2).expect(409);
    expect(String((repeat.body as { message?: string }).message ?? "")).toMatch(/already returned/);
    expect(await prisma.booking.count({ where: { orderId } })).toBe(3); // ничего не пересоздано/удалено
  });

  it("7. Q8: Commission ACCRUED → REVERSED (CAS + accrual), CommissionReversed — ровно один факт", async () => {
    const { orderId, bookingIds } = await makeSentOrder("commission", 2);
    const [b1, b2] = bookingIds;

    const commission = await prisma.commission.create({
      data: {
        code: `CMS-ST2-${stamp}-${nextUniq()}`,
        orderId,
        partnerId: `st2-partner-${stamp}`,
        amount: 100,
        currency: "USD",
      },
    });
    const accrual = await prisma.commissionAccrual.create({
      data: {
        code: `CAA-ST2-${stamp}-${nextUniq()}`,
        partnerId: commission.partnerId,
        amount: 100,
        currency: "USD",
        sourceCommissionId: commission.id,
        accruedAt: new Date(),
      },
    });

    await returnToOrder(b1, "возврат 1").expect(200);
    const cAfter1 = await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(cAfter1.status).toBe("REVERSED");
    expect(cAfter1.version).toBe(commission.version + 1);
    const aAfter1 = await prisma.commissionAccrual.findUniqueOrThrow({ where: { id: accrual.id } });
    expect(aAfter1.status).toBe("REVERSED");
    expect(aAfter1.version).toBe(accrual.version + 1);
    const evt1 = await prisma.outboxEvent.findMany({
      where: { eventType: "CommissionReversed", aggregateId: commission.id },
    });
    expect(evt1).toHaveLength(1);
    const p1 = evt1[0].payload as Record<string, unknown>;
    expect(p1.commissionId).toBe(commission.id);
    expect(p1.accrualId).toBe(accrual.id);
    expect(p1.orderId).toBe(orderId);
    expect(p1.bookingId).toBe(b1);
    expect(p1.partnerId).toBe(commission.partnerId);

    // Второй возврат (тот же заказ): комиссия уже REVERSED → второй факт НЕ создаётся (Q8).
    await returnToOrder(b2, "возврат 2").expect(200);
    const cAfter2 = await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(cAfter2.status).toBe("REVERSED");
    expect(cAfter2.version).toBe(cAfter1.version); // CAS не выиграл повторно
    expect(
      await prisma.outboxEvent.count({ where: { eventType: "CommissionReversed", aggregateId: commission.id } }),
    ).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("READY_FOR_BOOKING");
  });
});
