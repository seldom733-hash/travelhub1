/**
 * Stage 1 — ORDER → REQUEST (только назад) — e2e round-trip.
 *
 * Контракт (R1 → O1 → R1, одна и та же Request):
 *  1. returnToRequest: Order → CANCELLED (cancelledAt + OrderHistory +
 *     OrderCancelled event), linked Request CONVERTED → CHECKING в ТОЙ ЖЕ
 *     транзакции (RequestHistory returned_from_order + AuditLog);
 *  2. НИЧЕГО не пересоздаётся: та же Request (id/customerId/commerceSequence/
 *     code/convertedOrderId/convertedAt неприкосновенны), новых Request нет;
 *  3. повторный вызов → 409 (статус уже вне from-списка) — «идемпотентность
 *     отклонением»; RBAC: без order.cancel → 403, действие не применилось;
 *  4. guards: без linked Request → 409; bookings > 0 → 409; payments > 0 → 409;
 *     Request не CONVERTED → 409 (все — до каких-либо мутаций);
 *  5. после возврата supplier/customer-цикл снова открыт (confirm-price/
 *     accept штатны), повторная конвертация — явный 409 (уникальность
 *     MKT-ORD-{SEQ}: один Order на commerce chain), коммуникационный контекст —
 *     та же Request (unit: resolveContext).
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
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}
interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe("Stage 1 — Order → Request round-trip (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let seller: Seller;
  let op: Session;
  let analyst: Session;
  let productId: string;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    requests: string[];
    orders: string[];
    payments: string[];
    bookings: string[];
  } = {
    users: [],
    customers: [],
    partners: [],
    products: [],
    requests: [],
    orders: [],
    payments: [],
    bookings: [],
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
  const createStaff = async (tag: string, roleCode: RoleCode, password = "staffpass123") => {
    await adminAgent.post("/api/v1/users").send({ username: `${tag}${stamp}`, password, roleCode }).expect(201);
    const s = await login(`${tag}${stamp}`, password);
    created.users.push(s.user.id);
    return s;
  };
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `rtr${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `RTR Partner ${tag} ${stamp}`,
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

  const createCustomer = async (tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "RTR",
        lastName: tag,
        code: `CRM-RTR-${tag.toUpperCase()}-${stamp}`,
        email: `rtr-${tag.toLowerCase()}-${stamp}@example.com`,
      },
    });
    created.customers.push(customer.id);
    return customer.id;
  };

  /** R1 → O1: create → confirm-price → customer-accept → convert. */
  const makeConvertedChain = async (customerId: string): Promise<{ requestId: string; orderId: string }> => {
    const req = (
      await agent(op.accessToken)
        .post("/api/v1/requests")
        .send({
          customerId,
          productId,
          partnerId: seller.partnerId,
          requestedServiceDate: FUTURE(),
          quantity: 1,
          travelerCount: 1,
          travelers: [{ firstName: "Ретерн", lastName: "Турист", birthDate: "1990-01-01" }],
          displayedPrice: 100,
          displayedCurrency: "USD",
        })
        .expect(201)
    ).body as { id: string };
    created.requests.push(req.id);

    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/confirm-price`).send({}).expect(201);
    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/customer-accept`).send({}).expect(201);
    const conv = (await agent(op.accessToken).post(`/api/v1/requests/${req.id}/convert`).send({}).expect(201)).body as {
      convertedOrder: { id: string };
    };
    created.orders.push(conv.convertedOrder.id);
    return { requestId: req.id, orderId: conv.convertedOrder.id };
  };

  const returnToRequest = (orderId: string, reason?: string) =>
    agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "returnToRequest", reason });

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
    seller = await createApprovedSeller("rtr");
    op = await createStaff("rtr_op", RoleCode.OPERATOR);
    analyst = await createStaff("rtr_an", RoleCode.ANALYST);

    const product = (
      await seller.agent.post("/api/v1/products").send({
        type: "TOUR",
        title: `RTR Product ${stamp}`,
        tariffs: [{ name: "Std", price: 100 }],
      }).expect(201)
    ).body as { product: { id: string } };
    productId = product.product.id;
    created.products.push(productId);
  });

  afterAll(async () => {
    if (created.orders.length > 0) {
      // Stage 2 (returnToOrder): события/аудит брони привязаны к bookingId —
      // чистим ДО удаления Booking (inbox → outbox → booking → история).
      const bkgIds = (
        await prisma.booking.findMany({ where: { orderId: { in: created.orders } }, select: { id: true } })
      ).map((b) => b.id);
      if (bkgIds.length > 0) {
        const bkgEventIds = (
          await prisma.outboxEvent.findMany({ where: { aggregateId: { in: bkgIds } }, select: { id: true } })
        ).map((e) => e.id);
        if (bkgEventIds.length > 0) {
          await prisma.inboxEvent.deleteMany({ where: { eventId: { in: bkgEventIds } } });
          await prisma.outboxEvent.deleteMany({ where: { id: { in: bkgEventIds } } });
        }
      }
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Booking" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.payment.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderCreated','OrderReadyForBooking','OrderStatusChanged','OrderCancelled') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.auditLog.deleteMany({ where: { action: "order.returned_to_request" } });
    await prisma.auditLog.deleteMany({ where: { action: "booking.returned_to_order" } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("1. round-trip R1 → O1 → R1: та же Request вернулась в CHECKING, Order — CANCELLED-история", async () => {
    const customerId = await createCustomer("one");
    const { requestId, orderId } = await makeConvertedChain(customerId);

    const r1 = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const requestsBefore = await prisma.request.count({ where: { customerId } });
    const opSessionId = op.user.id;

    // Проекция до действия: returnToRequest доступен оператору, аналитику — нет (403).
    const detail = (await agent(op.accessToken).get(`/api/v1/orders/${orderId}`).expect(200)).body as {
      availableActions: string[];
      status: string;
    };
    expect(detail.status).toBe("NEW");
    expect(detail.availableActions).toContain("returnToRequest");
    await agent(analyst.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "returnToRequest" }).expect(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("NEW"); // 403 не применил действие

    // Сам round-trip.
    const res = (await returnToRequest(orderId, "клиент изменил состав тура").expect(200)).body as {
      id: string;
      status: string;
    };
    expect(res.status).toBe("CANCELLED");

    // Order: терминальный статус + milestone + immutable history (from/to/actor/reason).
    const oAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(oAfter.status).toBe("CANCELLED");
    expect(oAfter.cancelledAt).not.toBeNull();
    expect(oAfter.version).toBe(o1.version + 1);
    const oHist = await prisma.orderHistory.findFirst({ where: { orderId, action: "returnToRequest" } });
    expect(oHist).not.toBeNull();
    expect(oHist!.from).toBe("NEW");
    expect(oHist!.to).toBe("CANCELLED");
    expect(oHist!.actorName).toBe("rtr_op" + stamp); // username в actor-колонках (конвенция OrderHistory)
    expect(oHist!.comment).toContain("клиент изменил состав тура");

    // Request: ТА ЖЕ строка (никакой новой Request), статус → CHECKING, link сохранён.
    const rAfter = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(rAfter.status).toBe("CHECKING");
    expect(rAfter.version).toBe(r1.version + 1);
    expect(rAfter.convertedOrderId).toBe(orderId); // связь Request ↔ Order не потеряна
    expect(rAfter.convertedAt!.getTime()).toBe(r1.convertedAt!.getTime());
    expect(rAfter.customerId).toBe(r1.customerId);
    expect(rAfter.commerceSequence).toBe(r1.commerceSequence);
    expect(rAfter.code).toBe(r1.code);
    expect(await prisma.request.count({ where: { customerId } })).toBe(requestsBefore); // R2 не создана

    // RequestHistory: returned_from_order (CONVERTED → CHECKING, actor = оператор UUID).
    const rHist = await prisma.requestHistory.findFirst({ where: { requestId, action: "returned_from_order" } });
    expect(rHist).not.toBeNull();
    expect(rHist!.from).toBe("CONVERTED");
    expect(rHist!.to).toBe("CHECKING");
    expect(rHist!.actorId).toBe(opSessionId);
    expect(rHist!.comment).toContain(o1.code);

    // AuditLog: единая запись возврата с обоими ref.
    const audit = await prisma.auditLog.findFirst({
      where: { action: "order.returned_to_request", resourceId: orderId },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(opSessionId);
    const details = audit!.details as Record<string, unknown>;
    expect(details.requestId).toBe(requestId);
    expect(details.orderTo).toBe("CANCELLED");
    expect(details.requestTo).toBe("CHECKING");

    // Canonical-событие OrderCancelled (единственный факт «Order ушёл»).
    const evt = await prisma.outboxEvent.findFirst({ where: { eventType: "OrderCancelled", aggregateId: orderId } });
    expect(evt).not.toBeNull();
    expect(await prisma.booking.count({ where: { orderId } })).toBe(0); // bookings-нет → компенсация no-op

    // Проекции после действия: заказ в CANCELLED (returnToRequest скрыт), заявка снова живая.
    const afterDetail = (await agent(op.accessToken).get(`/api/v1/orders/${orderId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(afterDetail.availableActions).not.toContain("returnToRequest");
    const reqDetail = (await agent(op.accessToken).get(`/api/v1/requests/${requestId}`).expect(200)).body as {
      availableActions: Record<string, boolean>;
    };
    expect(reqDetail.availableActions.proposePrice).toBe(true);
    expect(reqDetail.availableActions.convert).toBe(false);
    expect(reqDetail.availableActions.customerAccept).toBe(false);
  });

  it("2. повторный вызов → 409 без каких-либо изменений (повторы не создают Request)", async () => {
    const customerId = await createCustomer("two");
    const { requestId, orderId } = await makeConvertedChain(customerId);

    await returnToRequest(orderId, "возврат").expect(200);
    const requestsAfterFirst = await prisma.request.count({ where: { customerId } });
    const versionAfterFirst = (await prisma.request.findUniqueOrThrow({ where: { id: requestId } })).version;

    await returnToRequest(orderId, "повтор").expect(409);
    await returnToRequest(orderId, "ещё раз").expect(409);

    expect(await prisma.request.count({ where: { customerId } })).toBe(requestsAfterFirst);
    const r = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(r.status).toBe("CHECKING");
    expect(r.version).toBe(versionAfterFirst); // 409-повторы не инкрементируют версию
    expect(await prisma.requestHistory.count({ where: { requestId, action: "returned_from_order" } })).toBe(1);
    expect(await prisma.orderHistory.count({ where: { orderId, action: "returnToRequest" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "order.returned_to_request", resourceId: orderId } })).toBe(1);
  });

  it("3. guards — все до мутаций: нет linked Request / booking / payment / Request не CONVERTED", async () => {
    // (a) Order без linked Request → 409, статус не изменился.
    const bare = await prisma.order.create({
      data: {
        code: `ORD-RTRB${stamp}`,
        number: `TH-RTRB${stamp}`,
        referenceNumber: `MKT-ORD-RTRB${stamp}`,
        status: "NEW",
        currency: "USD",
        amount: 100,
        acquisitionSource: "MARKETPLACE",
        sellerPartnerId: seller.partnerId,
      },
    });
    created.orders.push(bare.id);
    const noLink = await returnToRequest(bare.id).expect(409);
    expect(String((noLink.body as { message?: string }).message ?? "")).toMatch(/no linked Request/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bare.id } })).status).toBe("NEW");

    // (b) Payment существует → 409; удалили payment → возврат проходит.
    const customerId = await createCustomer("guard");
    const { requestId, orderId } = await makeConvertedChain(customerId);
    const payment = await prisma.payment.create({
      data: {
        code: `PAY-RTR${stamp}`,
        referenceNumber: `MKT-PAY-RTR${stamp}`,
        orderId,
        amount: 100,
        currency: "USD",
      },
    });
    created.payments.push(payment.id);
    const payGuard = await returnToRequest(orderId).expect(409);
    expect(String((payGuard.body as { message?: string }).message ?? "")).toMatch(/payment/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("NEW");
    await prisma.payment.delete({ where: { id: payment.id } });
    created.payments.splice(created.payments.indexOf(payment.id), 1);

    // (c) Booking существует → 409 (граница pre-send: Booking→Order — design pass).
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-RTR${stamp}`,
        referenceNumber: `MKT-BKG-RTR${stamp}`,
        orderId,
        productId,
      },
    });
    created.bookings.push(booking.id);
    const bkgGuard = await returnToRequest(orderId).expect(409);
    expect(String((bkgGuard.body as { message?: string }).message ?? "")).toMatch(/booking/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("NEW");
    await prisma.booking.delete({ where: { id: booking.id } });
    created.bookings.splice(created.bookings.indexOf(booking.id), 1);

    // (d) Linked Request не в CONVERTED → 409; восстановили статус → возврат проходит.
    await prisma.request.update({ where: { id: requestId }, data: { status: "NEW" } });
    const statusGuard = await returnToRequest(orderId).expect(409);
    expect(String((statusGuard.body as { message?: string }).message ?? "")).toMatch(/requires CONVERTED/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("NEW");
    await prisma.request.update({ where: { id: requestId }, data: { status: "CONVERTED" } });

    // После снятия всех guards возврат применяется (та же Request → CHECKING).
    await returnToRequest(orderId, "возврат после guards").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("CHECKING");
    expect(await prisma.request.count({ where: { customerId } })).toBe(1); // R2 не создана
  });

  it("4. после возврата: supplier/customer-цикл снова штатен, повторная конвертация — явный 409 (один Order на chain)", async () => {
    const customerId = await createCustomer("four");
    const { requestId, orderId } = await makeConvertedChain(customerId);
    await returnToRequest(orderId, "перед переоформлением").expect(200);

    // Supplier-цикл снова открыт (CHECKING → CONFIRMED → CUSTOMER_ACCEPTED).
    const confirmed = (
      await agent(op.accessToken).post(`/api/v1/requests/${requestId}/confirm-price`).send({}).expect(201)
    ).body as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");
    const accepted = (
      await agent(op.accessToken).post(`/api/v1/requests/${requestId}/customer-accept`).send({}).expect(201)
    ).body as { status: string };
    expect(accepted.status).toBe("CUSTOMER_ACCEPTED");

    // Проекция не предлагает convert (зеркалит 409-гейт).
    const reqDetail = (await agent(op.accessToken).get(`/api/v1/requests/${requestId}`).expect(200)).body as {
      availableActions: Record<string, boolean>;
    };
    expect(reqDetail.availableActions.convert).toBe(false);

    // Повторная конвертация — явный 409 (никакого P2002/500 и второго Order).
    const reConvert = await agent(op.accessToken).post(`/api/v1/requests/${requestId}/convert`).send({}).expect(409);
    expect(String((reConvert.body as { message?: string }).message ?? "")).toMatch(/already converted/);

    // Ограничения scope сохранены: одна Request, link = исторический O1.
    expect(await prisma.request.count({ where: { customerId } })).toBe(1);
    const r = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(r.id).toBe(requestId);
    expect(r.convertedOrderId).toBe(orderId);
    expect(r.status).toBe("CUSTOMER_ACCEPTED");
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o1.status).toBe("CANCELLED"); // O1 не удалён и не переписан
    expect(o1.customerId).toBe(r.customerId); // корень commerce неприкосновенен
    expect(await prisma.order.count({ where: { customerId } })).toBe(1); // O2 не создан
  });

  // ── Stage 2 fix (Bug 2): блокирует ТОЛЬКО активный Booking ────────────────
  /** Терминальная (returned/cancelled) бронь: статус CANCELLED + history-факт
   *  returned_to_order (тот же domain state, что у Booking-проекции). */
  let b2Seq = 0;
  const makeBooking = async (
    orderId: string,
    status: "CANCELLED" | "NEW",
    returned: boolean,
  ) => {
    const n = ++b2Seq;
    const b = await prisma.booking.create({
      data: {
        code: `BKG-B2-${n}-${stamp}`,
        referenceNumber: `MKT-BKG-B2-${n}-${stamp}`,
        orderId,
        productId,
        status,
      },
    });
    created.bookings.push(b.id);
    if (returned) {
      await prisma.bookingHistory.create({
        data: { bookingId: b.id, action: "returned_to_order", from: "NEW", to: status },
      });
    }
    return b;
  };

  it("5. Bug 2: Case A (только возвращённая) → ALLOW; Case B (есть активная) → BLOCK; Case C (все возвращённые) → ALLOW + проекция", async () => {
    const customerId = await createCustomer("b2cases");

    // ── Case A: O1 └─ B1 = returned → ALLOW (AC-3, AC-4) ──
    const a = await makeConvertedChain(customerId);
    const aReqBefore = await prisma.request.count({ where: { customerId } });
    const aBooking = await makeBooking(a.orderId, "CANCELLED", true);
    const detA = (await agent(op.accessToken).get(`/api/v1/orders/${a.orderId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(detA.availableActions).toContain("returnToRequest"); // историческая бронь не прячет кнопку
    await returnToRequest(a.orderId, "Case A: только возвращённая бронь").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.orderId } })).status).toBe("CANCELLED");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: a.requestId } })).status).toBe("CHECKING");
    expect(await prisma.request.count({ where: { customerId } })).toBe(aReqBefore); // R2 не создана
    expect(await prisma.booking.count({ where: { id: aBooking.id } })).toBe(1); // AC-4: не удалена

    // ── Case B: O1 ├─ B1 = returned └─ B2 = ACTIVE → BLOCK (AC-5) ──
    const b = await makeConvertedChain(customerId);
    await makeBooking(b.orderId, "CANCELLED", true);
    await makeBooking(b.orderId, "NEW", false);
    const detB = (await agent(op.accessToken).get(`/api/v1/orders/${b.orderId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(detB.availableActions).not.toContain("returnToRequest"); // проекция зеркалит guard
    const block = await returnToRequest(b.orderId, "Case B: есть активная бронь").expect(409);
    expect(String((block.body as { message?: string }).message ?? "")).toMatch(/active booking/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.orderId } })).status).toBe("NEW"); // без мутаций

    // ── Case C: O1 ├─ B1 = returned └─ B2 = returned → ALLOW ──
    const c = await makeConvertedChain(customerId);
    const cReqBefore = await prisma.request.count({ where: { customerId } });
    await makeBooking(c.orderId, "CANCELLED", true);
    await makeBooking(c.orderId, "CANCELLED", true);
    await returnToRequest(c.orderId, "Case C: все брони возвращены").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe("CANCELLED");
    expect(await prisma.request.count({ where: { customerId } })).toBe(cReqBefore);
  });

  it("6. Bug 2 / AC-6: полный round-trip R1 → O1 → B1 → O1 → R1 — те же сущности, без дубликатов", async () => {
    const customerId = await createCustomer("roundtrip");
    const { requestId, orderId } = await makeConvertedChain(customerId);
    const requestsBefore = await prisma.request.count({ where: { customerId } });
    const ordersBefore = await prisma.order.count({ where: { customerId } });

    // Fixture стадии Booking-цепочки: O1 в SENT_TO_BOOKING + активный B1
    // (создание брони фикстурой, как в test 3 — переходы под фиксом тестируются API).
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "SENT_TO_BOOKING", version: { increment: 1 } },
    });
    const b1 = await makeBooking(orderId, "NEW", false);

    // B1 → O1 (API returnToOrder): бронь терминализируется, Order → READY_FOR_BOOKING.
    const ret = (
      await agent(op.accessToken)
        .patch(`/api/v1/bookings/${b1.id}`)
        .send({ action: "returnToOrder", reason: "full round-trip" })
        .expect(200)
    ).body as { status: string };
    expect(ret.status).toBe("CANCELLED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("READY_FOR_BOOKING");

    // AC-1: проекция возвращённой брони скрывает «Вернуть в заказ».
    const bDetail = (await agent(op.accessToken).get(`/api/v1/bookings/${b1.id}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(bDetail.availableActions).not.toContain("returnToOrder");

    // AC-3: проекция Order показывает «Вернуть в заявку» (нет активных броней).
    const oDetail = (await agent(op.accessToken).get(`/api/v1/orders/${orderId}`).expect(200)).body as {
      availableActions: string[];
    };
    expect(oDetail.availableActions).toContain("returnToRequest");

    // O1 → R1 (API returnToRequest).
    await returnToRequest(orderId, "full round-trip: O1 → R1").expect(200);

    // Same Request / same Order / same Booking; никаких R2/O2/B2.
    const r1 = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(r1.status).toBe("CHECKING");
    expect(await prisma.request.count({ where: { customerId } })).toBe(requestsBefore);
    expect(await prisma.order.count({ where: { customerId } })).toBe(ordersBefore);
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o1.status).toBe("CANCELLED");
    expect(await prisma.booking.count({ where: { orderId } })).toBe(1);
    const bFinal = await prisma.booking.findUniqueOrThrow({ where: { id: b1.id } });
    expect(bFinal.status).toBe("CANCELLED");

    // Истории всех трёх переходов на тех же сущностях.
    expect(await prisma.bookingHistory.count({ where: { bookingId: b1.id, action: "returned_to_order" } })).toBe(1);
    expect(await prisma.orderHistory.count({ where: { orderId, action: "returnFromBooking" } })).toBe(1);
    expect(await prisma.orderHistory.count({ where: { orderId, action: "returnToRequest" } })).toBe(1);
  });
});
