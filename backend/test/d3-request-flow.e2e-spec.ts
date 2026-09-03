/**
 * PHASE 3 — PRE-STEP 3.12 — D3 — REQUEST FLOW INTEGRATION (F6 closure, e2e)
 *
 * Real Request chain (§23): Product → Request → supplier response/current terms
 * → customer acceptance (policy A pinned) → Product mutation to B → Request-
 * derived Order STILL A → travelerCount frozen 2 → 2 OrderTraveler → REQUIRED
 * gate blocks final-confirm → travelers completed → final-confirm → confirm →
 * send → exactly 1 Booking → exactly 2 Passenger.
 *
 * Covers (§6–§18):
 *  1. FULL CHAIN + pin-at-acceptance immutability + count freeze + temporal
 *     invariants (customerAcceptedAt == Order.termsAcceptedAt; convertedAt ≈
 *     Order.createdAt; one commerceSequence; FK/UUID link, не из строк);
 *  2. Booking eligibility: no Booking before finalConfirmedAt (gate), exactly
 *     1 Booking + 2 Passenger after send;
 *  3. Conversion idempotency: повторный convert возвращает тот же Order;
 *     concurrent convert → ровно один Order;
 *  4. Invalid states cannot convert (NEW / legacy accepted без D3 snapshot);
 *  5. RBAC: BUYER/PARTNER (foreign tenant) → 403; SALES_MANAGER (order.read,
 *     без edit_noncritical) → read 200 / write 403; OPERATOR → полный цикл.
 *
 * Продукты создаёт одобренный PARTNER (Step 3.6B owner-rule). Request Center —
 * платформенный центр (order.* permission contract, D3 §18).
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

describe("Phase 3 Pre-Step 3.12 D3 — Request Flow Integration (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    requests: string[];
    orders: string[];
  } = { users: [], customers: [], partners: [], products: [], requests: [], orders: [] };

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

  /** Полный onboarding одобренного партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `d3rfp${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D3 RF Partner ${tag} ${stamp}`,
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

  const createProduct = async (seller: Seller, tag: string, opts: { type?: string; price?: number; travelerRequirements?: Record<string, string> | null } = {}) => {
    const res = await seller.agent
      .post("/api/v1/products")
      .send({
        type: opts.type ?? "TOUR",
        title: `D3RF ${tag} ${stamp}`,
        tariffs: [{ name: "Std", price: opts.price ?? 100 }],
        ...(opts.travelerRequirements !== undefined ? { travelerRequirements: opts.travelerRequirements } : {}),
      })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    return product.id;
  };

  const createCustomer = async (tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "D3RF",
        lastName: tag,
        code: `CRM-D3RF-${tag.toUpperCase()}-${stamp}`,
        email: `d3rf-${tag.toLowerCase()}-${stamp}@example.com`,
      },
    });
    created.customers.push(customer.id);
    return customer.id;
  };

  const makeRequest = (token: string, body: Record<string, unknown>) => agent(token).post("/api/v1/requests").send(body);
  const confirmPrice = (token: string, id: string) => agent(token).post(`/api/v1/requests/${id}/confirm-price`).send({});
  const customerAccept = (token: string, id: string) => agent(token).post(`/api/v1/requests/${id}/customer-accept`).send({});
  const convert = (token: string, id: string) => agent(token).post(`/api/v1/requests/${id}/convert`).send({});
  const patchTraveler = (token: string, orderId: string, travelerId: string, body: Record<string, unknown>) =>
    agent(token).patch(`/api/v1/orders/${orderId}/travelers/${travelerId}`).send(body);
  const finalConfirm = (token: string, orderId: string) => agent(token).post(`/api/v1/orders/${orderId}/final-confirm`);
  const orderAction = (token: string, orderId: string, action: string) => agent(token).patch(`/api/v1/orders/${orderId}`).send({ action });

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
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingCreated' AND "payload"->>'orderId' = ANY($1)`,
        created.orders,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" = 'BookingRequested' AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderCreated','OrderReadyForBooking','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } }); // PartnerApplication cascade
    await app.close();
  });

  // ── §23: REAL REQUEST FLOW — FULL CHAIN + PIN/IMMUTABILITY/FREEZE/CHRONOLOGY ──

  it("1. Request → accept (policy A pinned) → Product→B → Order STILL A; travelerCount 2; 1 Booking + 2 Passenger после final confirm; временные инварианты", async () => {
    const seller = await createApprovedSeller("full");
    const op = await createStaff("d3rf_op1", RoleCode.OPERATOR);
    const customerId = await createCustomer("Full");

    // Product policy A: citizenship OPTIONAL (остальные TOUR defaults).
    const productId = await createProduct(seller, "full", {
      type: "TOUR",
      price: 500,
      travelerRequirements: { citizenship: "OPTIONAL" },
    });

    // Request: explicit party composition = 2 travelers.
    const reqRes = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      quantity: 2,
      travelerCount: 2,
      displayedPrice: 1000,
      displayedCurrency: "AZN",
    }).expect(201)).body as { id: string; commerceSequence: string; referenceNumber: string; travelerCount: number };
    created.requests.push(reqRes.id);
    expect(reqRes.travelerCount).toBe(2);

    // Supplier response: confirm current terms.
    const confirmed = (await confirmPrice(op.accessToken, reqRes.id).expect(201)).body as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");

    // Customer acceptance — policy A pinned, party frozen, real timestamp.
    const acceptTime = new Date();
    const accepted = (await customerAccept(op.accessToken, reqRes.id).expect(201)).body as { status: string; customerAcceptedAt: string };
    expect(accepted.status).toBe("CUSTOMER_ACCEPTED");

    const reqRow = await prisma.request.findUniqueOrThrow({ where: { id: reqRes.id } });
    expect(reqRow.customerAcceptedAt).not.toBeNull();
    expect(reqRow.customerAcceptedAt!.getTime()).toBeGreaterThanOrEqual(acceptTime.getTime() - 2000);
    const pinnedA = reqRow.pinnedRequirements as Record<string, string>;
    expect(pinnedA.citizenship).toBe("OPTIONAL"); // policy A
    expect(pinnedA.firstName).toBe("REQUIRED");
    expect(reqRow.travelerCount).toBe(2);
    expect(reqRow.confirmedPrice?.toString()).toBe("1000");

    // Product mutation to policy B: citizenship → REQUIRED (после acceptance).
    await seller.agent
      .patch(`/api/v1/products/${productId}`)
      .send({ travelerRequirements: { citizenship: "REQUIRED" } })
      .expect(200);

    // Convert → canonical Order root (Request-derived; mutable Product НЕ читается).
    const conv = (await convert(op.accessToken, reqRes.id).expect(201)).body as any;
    expect(conv.status).toBe("CONVERTED");
    expect(conv.convertedOrder).toBeTruthy();
    const orderId = conv.convertedOrder.id as string;
    created.orders.push(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const reqAfter = await prisma.request.findUniqueOrThrow({ where: { id: reqRes.id } });
    // Order root facts:
    expect(order.saleId).toBeNull(); // нет fake Sale/Checkout (один commerce engine)
    expect(order.acquisitionSource).toBe("MARKETPLACE");
    expect(order.commerceSequence).toBe(reqRes.commerceSequence); // shared root
    expect(order.referenceNumber).toBe(`MKT-ORD-${reqRes.commerceSequence}`);
    expect(reqAfter.referenceNumber).toBe(`MKT-REQ-${reqRes.commerceSequence}`);
    // §6: termsAcceptedAt == реальный Request acceptance instant.
    expect(order.termsAcceptedAt!.getTime()).toBe(reqRow.customerAcceptedAt!.getTime());
    // §7: pinned A пережило Product→B.
    expect((order.pinnedRequirements as Record<string, string>).citizenship).toBe("OPTIONAL");
    // §8/§16: travelerCount frozen → OrderTraveler rows = 2.
    expect(order.travelerCount).toBe(2);
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId: order.id }, orderBy: { position: "asc" } });
    expect(travelers).toHaveLength(2);
    expect(travelers.map((t) => t.position)).toEqual([1, 2]);
    // §9/§13: relation by UUID, convertedAt ≈ Order.createdAt.
    expect(reqAfter.convertedOrderId).toBe(order.id);
    expect(reqAfter.status).toBe("CONVERTED");
    expect(reqAfter.convertedAt!.getTime()).toBe(order.createdAt.getTime());
    // Temporal invariants (§24).
    const hist = await prisma.requestHistory.findMany({ where: { requestId: reqRes.id }, orderBy: { createdAt: "asc" } });
    const createdHist = hist.find((h) => h.action === "created")!;
    const convHist = hist.find((h) => h.action === "converted")!;
    expect(createdHist.createdAt.getTime()).toBeLessThanOrEqual(reqRow.customerAcceptedAt!.getTime());
    expect(reqRow.customerAcceptedAt!.getTime()).toBeLessThanOrEqual(order.createdAt.getTime());
    expect(order.createdAt.getTime()).toBeLessThanOrEqual(convHist.createdAt.getTime() + 3000);

    // ── Booking gate до final confirmation (§15) ──
    await orderAction(op.accessToken, orderId, "process").expect(200);
    await orderAction(op.accessToken, orderId, "confirm").expect(422); // D3 gate: нужен final-confirm
    await orderAction(op.accessToken, orderId, "send").expect(409); // status machine; Booking невозможен
    expect(await prisma.booking.count({ where: { orderId: order.id } })).toBe(0);

    // ── Traveler collection (shared D3 contract) — REQUIRED gate + completion ──
    // firstName/lastName REQUIRED — пустые placeholders → final confirm denied.
    await finalConfirm(op.accessToken, orderId).expect(422);

    // Заполняем обоих туристов (имена + citizenship OPTIONAL по policy A).
    await patchTraveler(op.accessToken, orderId, travelers[0].id, { firstName: "Иван", lastName: "Иванов" }).expect(200);
    await patchTraveler(op.accessToken, orderId, travelers[1].id, { firstName: "Пётр", lastName: "Петров" }).expect(200);
    await patchTraveler(op.accessToken, orderId, travelers[1].id, { citizenship: "AZ" }).expect(200); // OPTIONAL → сохраняется
    const bad = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: travelers[0].id } });
    expect(bad.firstName).toBe("Иван");
    expect(bad.dataCompleteness).toBe("COMPLETE");

    await finalConfirm(op.accessToken, orderId).expect(201);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.finalConfirmedAt).not.toBeNull();

    // ── Booking: confirm → send → 1 Booking → 2 Passenger ──
    await orderAction(op.accessToken, orderId, "confirm").expect(200);
    await orderAction(op.accessToken, orderId, "send").expect(200);
    const bookings = await prisma.booking.findMany({ where: { orderId: order.id } });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].commerceSequence).toBe(reqRes.commerceSequence);
    expect(bookings[0].referenceNumber).toBe(`MKT-BKG-${reqRes.commerceSequence}`);
    const passengers = await prisma.passenger.findMany({ where: { bookingId: bookings[0].id }, orderBy: { id: "asc" } });
    expect(passengers).toHaveLength(2); // frozen count = OrderTraveler = Passenger
    const passNames = passengers.map((p) => p.firstName).sort();
    expect(passNames).toEqual(["Иван", "Пётр"]);
  });

  // ── §11: idempotency / double conversion ─────────────────────────────────

  it("2. Повторный convert → тот же Order (idempotent, 200); concurrent convert → ровно один Order", async () => {
    const seller = await createApprovedSeller("idem");
    const op = await createStaff("d3rf_op2", RoleCode.OPERATOR);
    const customerId = await createCustomer("Idem");
    const productId = await createProduct(seller, "idem", { travelerRequirements: { birthDate: "OPTIONAL" } });

    // — Serial double conversion —
    const reqA = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(reqA.id);
    await confirmPrice(op.accessToken, reqA.id).expect(201);
    await customerAccept(op.accessToken, reqA.id).expect(201);
    const first = (await convert(op.accessToken, reqA.id).expect(201)).body as any;
    const second = (await convert(op.accessToken, reqA.id).expect(200)).body as any;
    expect(second.convertedOrder.id).toBe(first.convertedOrder.id);
    expect(second.idempotent).toBe(true);
    expect(await prisma.request.count({ where: { id: reqA.id } })).toBe(1);
    expect(await prisma.order.count({ where: { id: first.convertedOrder.id } })).toBe(1);
    created.orders.push(first.convertedOrder.id);

    // — Concurrent double conversion (fresh request) —
    const reqB = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(reqB.id);
    await confirmPrice(op.accessToken, reqB.id).expect(201);
    await customerAccept(op.accessToken, reqB.id).expect(201);

    const results = await Promise.allSettled([convert(op.accessToken, reqB.id), convert(op.accessToken, reqB.id)]);
    const bodies = results.map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean) as any[];
    // Ровно один победитель создаёт Order; второй идемпотентно возвращает его же.
    const orderIds = new Set(bodies.map((b) => b.convertedOrder?.id));
    expect(orderIds.size).toBe(1);
    const finalReq = await prisma.request.findUniqueOrThrow({ where: { id: reqB.id } });
    expect(finalReq.convertedOrderId).not.toBeNull();
    expect(await prisma.order.count({ where: { id: finalReq.convertedOrderId! } })).toBe(1);
    created.orders.push(finalReq.convertedOrderId!);
  });

  // ── §10: invalid states cannot convert ────────────────────────────────────

  it("3. NEW / legacy accepted (без D3 snapshot) → conversion denied; accept без Product → 400", async () => {
    const seller = await createApprovedSeller("gate");
    const op = await createStaff("d3rf_op3", RoleCode.OPERATOR);
    const customerId = await createCustomer("Gate");
    const productId = await createProduct(seller, "gate");

    // NEW — нельзя конвертировать (нет acceptance).
    const fresh = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(fresh.id);
    await convert(op.accessToken, fresh.id).expect(409);

    // Rejected — терминальное состояние не конвертируется.
    const rej = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(rej.id);
    await agent(op.accessToken).post(`/api/v1/requests/${rej.id}/reject`).send({ reason: "no" }).expect(201);
    await convert(op.accessToken, rej.id).expect(409);

    // Legacy CUSTOMER_ACCEPTED без D3 snapshot (до-D3 строка) → 409 (честный отказ).
    const legacy = await prisma.request.create({
      data: {
        code: `REQ-LEG${stamp}`,
        commerceSequence: `9999${String(stamp).slice(-4)}`,
        referenceNumber: `MKT-REQ-9999${String(stamp).slice(-4)}`,
        customerId,
        productId,
        partnerId: seller.partnerId,
        status: "CUSTOMER_ACCEPTED",
        quantity: 1,
        displayedPrice: new Prisma.Decimal(100),
        displayedCurrency: "USD",
        customerAcceptedAt: new Date(),
        customerDecision: "ACCEPTED",
        version: 1,
      },
    });
    created.requests.push(legacy.id);
    await convert(op.accessToken, legacy.id).expect(409);

    // Accept без продукта (нет resolvable Product для pin) → 400.
    const noProduct = (await makeRequest(op.accessToken, {
      customerId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(noProduct.id);
    await confirmPrice(op.accessToken, noProduct.id).expect(201);
    await customerAccept(op.accessToken, noProduct.id).expect(400);
  });

  // ── §18: RBAC / tenant isolation ──────────────────────────────────────────

  it("4. BUYER/чужой PARTNER → 403; SALES_MANAGER read 200 + write 403; OPERATOR полный цикл", async () => {
    const seller = await createApprovedSeller("sec");
    const op = await createStaff("d3rf_secop", RoleCode.OPERATOR);
    const customerId = await createCustomer("Sec");
    const productId = await createProduct(seller, "sec");
    const req = (await makeRequest(op.accessToken, {
      customerId,
      productId,
      partnerId: seller.partnerId,
      requestedServiceDate: FUTURE(),
      travelerCount: 1,
      displayedPrice: 100,
      displayedCurrency: "USD",
    }).expect(201)).body as { id: string };
    created.requests.push(req.id);

    // Чужой PARTNER (другой тенант) — у PARTNER нет order.* → 403 на всё.
    const sellerB = await createApprovedSeller("secB");
    await sellerB.agent.get("/api/v1/requests").expect(403);
    await sellerB.agent.get(`/api/v1/requests/${req.id}`).expect(403);
    await sellerB.agent.post(`/api/v1/requests/${req.id}/customer-accept`).send({}).expect(403);

    // BUYER — нет order.* → 403.
    const buyer = await registerBuyer("d3rf_byr");
    await agent(buyer.accessToken).get("/api/v1/requests").expect(403);

    // SALES_MANAGER: order.read (read 200), но не edit_noncritical → write 403.
    const sm = await createStaff("d3rf_sm", RoleCode.SALES_MANAGER);
    await agent(sm.accessToken).get("/api/v1/requests").expect(200);
    await agent(sm.accessToken).get(`/api/v1/requests/${req.id}`).expect(200);
    await agent(sm.accessToken).post(`/api/v1/requests/${req.id}/customer-accept`).send({}).expect(403);
    await agent(sm.accessToken).post(`/api/v1/requests/${req.id}/convert`).send({}).expect(403);

    // OPERATOR — полный lifecycle.
    await confirmPrice(op.accessToken, req.id).expect(201);
    await customerAccept(op.accessToken, req.id).expect(201);
    const conv = (await convert(op.accessToken, req.id).expect(201)).body as any;
    created.orders.push(conv.convertedOrder.id as string);
    expect(conv.convertedOrder).toBeTruthy();
  });
});
