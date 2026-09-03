/**
 * PHASE 3 — PRE-STEP 3.12 — D4 — STRICT REVIEW REMEDIATION CLOSURE (e2e).
 *
 * Закрывает findings D4 STRICT REVIEW на isolated DB через РЕАЛЬНЫЕ команды:
 *  - F1 (TOCTOU): traveler mutation ↔ finalConfirm сериализованы DB row-lock
 *    (SELECT ... FOR UPDATE на строке Order). R1: finalConfirm побеждает →
 *    concurrent traveler mutation (single и bulk) не коммитится (409 + DB
 *    без изменений). R2: traveler mutation коммитится первой → finalConfirm
 *    наблюдает закоммиченное состояние. Проверяется DB, а не только HTTP.
 *  - F2: platform list/export bypass закрыт — явный
 *    ?acquisitionSource=PARTNER_STOREFRONT на Orders/Bookings list/export и
 *    drill-down (export?orderId=Storefront-order) не отдаёт Storefront-строки.
 *  - F3/S12: natural completion chain Booking COMPLETED → Order FULFILLED →
 *    Order CLOSED через реальные команды (никакой прямой инъекции статусов).
 *  - F6: bulk PATCH travelers сохраняет passportExpiry и считает
 *    dataCompleteness по canonical pinned REQUIREMENTS (общая логика с single).
 *  - S5: customer-decline → CANCELLED_BY_CUSTOMER → нет конверсии в Order.
 *
 * Synthetic personas (§26, PII-safe). Fixtures — deterministic seed builder:
 * canonical domain graph; жизненные переходы — реальными командами.
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
  user: { id: string };
}
interface Seller {
  partnerId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
}

const waitFor = async <T>(fn: () => Promise<T | null | undefined>, until: (v: T) => boolean, tries = 40): Promise<T> => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v && until(v)) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("waitFor: condition not met");
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Phase 3 Pre-Step 3.12 D4 — Strict Review Remediation Closure (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  let seq = 0;
  const uid = (tag: string) => `D4RC${tag}${seq++}${stamp}`;
  const created: {
    users: string[];
    customers: string[];
    partners: string[];
    products: string[];
    requests: string[];
    orders: string[];
  } = { users: [], customers: [], partners: [], products: [], requests: [], orders: [] };

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

  /** Полный onboarding одобренного партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `d4rc${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D4RC Partner ${tag} ${stamp}`,
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

  const createProduct = async (seller: Seller, tag: string) => {
    const res = await seller.agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title: `D4RC ${tag} ${stamp}`, tariffs: [{ name: "Std", price: 150 }] })
      .expect(201);
    const product = res.body.product as { id: string };
    created.products.push(product.id);
    return product.id;
  };

  const createCustomer = async (tag: string): Promise<string> => {
    const customer = await prisma.customer.create({
      data: {
        firstName: "D4RC",
        lastName: tag,
        code: `CRM-D4RC-${tag.toUpperCase()}-${stamp}-${seq++}`,
        email: `d4rc-${tag.toLowerCase()}-${stamp}-${seq++}@example.com`,
      },
    });
    created.customers.push(customer.id);
    return customer.id;
  };

  // Synthetic personas (D4 §26 — PII-safe evidence).
  const PERSONA = { firstName: "Айтен", lastName: "Мамедова", passportNumber: "AZ1234567" };

  const PINNED: Record<string, string> = {
    firstName: "REQUIRED",
    lastName: "REQUIRED",
    birthDate: "OPTIONAL",
    citizenship: "REQUIRED",
    gender: "OPTIONAL",
    passportNumber: "REQUIRED",
    passportExpiry: "OPTIONAL",
  };

  /**
   * Seed builder — Marketplace D3-shape Order (canonical, 1 traveler, до final
   * confirm). `complete:false` → traveler без REQUIRED citizenship/passport.
   */
  const seedMarketplaceD3Order = async (seller: Seller, opts: { complete?: boolean; passportExpiry?: string } = {}) => {
    const tag = uid("M");
    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`,
        number: `TH-${tag}`,
        referenceNumber: `MKT-ORD-${tag}`,
        status: "NEW",
        currency: "USD",
        amount: 240,
        acquisitionSource: "MARKETPLACE",
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: null,
        travelerCount: 1,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: {
          create: [
            {
              position: 1,
              firstName: PERSONA.firstName,
              lastName: PERSONA.lastName,
              ...(opts.complete === false
                ? {}
                : {
                    citizenship: "AZ",
                    gender: "F",
                    passportNumber: PERSONA.passportNumber,
                    passportExpiry: opts.passportExpiry ? new Date(opts.passportExpiry) : new Date(FUTURE(700)),
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
    return order;
  };

  /** Seed builder — Marketplace chain (Order + Booking, MARKETPLACE scope). */
  const seedMarketplaceChain = async (seller: Seller) => {
    const tag = uid("MP");
    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`,
        number: `TH-${tag}`,
        referenceNumber: `MKT-ORD-${tag}`,
        status: "SENT_TO_BOOKING",
        currency: "USD",
        amount: 180,
        acquisitionSource: "MARKETPLACE",
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: new Date(),
        travelerCount: 1,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: { create: [{ position: 1, firstName: PERSONA.firstName, lastName: PERSONA.lastName, citizenship: "AZ", gender: "M", passportNumber: PERSONA.passportNumber, dataCompleteness: "COMPLETE", version: 1 }] },
      },
    });
    created.orders.push(order.id);
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${tag}`,
        referenceNumber: `MKT-BKG-${tag}`,
        orderId: order.id,
        productId: "d4rc-fixture-product",
        status: "CONFIRMED",
        amount: 180,
        currency: "USD",
        acquisitionSource: "MARKETPLACE",
        passengers: { create: [{ firstName: PERSONA.firstName, lastName: PERSONA.lastName, citizenship: "AZ", passportNumber: PERSONA.passportNumber }] },
      },
    });
    return { order, booking };
  };

  /** Seed builder — Storefront (PARTNER tenant) chain (D4 §21). */
  const seedStorefrontChain = async (seller: Seller) => {
    const tag = uid("SF");
    const order = await prisma.order.create({
      data: {
        code: `ORD-${tag}`,
        number: `TH-${tag}-SF`,
        referenceNumber: `SF001-ORD-${tag}`,
        status: "SENT_TO_BOOKING",
        currency: "USD",
        amount: 180,
        acquisitionSource: "PARTNER_STOREFRONT",
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: new Date(),
        travelerCount: 1,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: { create: [{ position: 1, firstName: "Storefront", lastName: "Guest", citizenship: "GE", gender: "M", passportNumber: "GE9988776", dataCompleteness: "COMPLETE", version: 1 }] },
      },
    });
    created.orders.push(order.id);
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${tag}`,
        referenceNumber: `SF001-BKG-${tag}`,
        orderId: order.id,
        productId: "d4rc-fixture-product",
        status: "CONFIRMED",
        amount: 180,
        currency: "USD",
        acquisitionSource: "PARTNER_STOREFRONT",
        passengers: { create: [{ firstName: "Storefront", lastName: "Guest", citizenship: "GE", passportNumber: "GE9988776" }] },
      },
    });
    return { order, booking };
  };

  /**
   * Deterministic natural chain builder — canonical Request → Booking CONFIRMED
   * через реальные команды (та же цепь, что d4-representative-chain).
   */
  const chainToBookingConfirmed = async (op: Session, seller: Seller, productId: string, customerId: string) => {
    const req = (await agent(op.accessToken)
      .post("/api/v1/requests")
      .send({
        customerId,
        productId,
        partnerId: seller.partnerId,
        requestedServiceDate: FUTURE(30),
        quantity: 2,
        travelerCount: 2,
        displayedPrice: 340,
        displayedCurrency: "USD",
      })
      .expect(201)).body as { id: string; referenceNumber: string };
    created.requests.push(req.id);
    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/confirm-price`).send({}).expect(201);
    await agent(op.accessToken).post(`/api/v1/requests/${req.id}/customer-accept`).send({}).expect(201);
    const conv = (await agent(op.accessToken).post(`/api/v1/requests/${req.id}/convert`).send({}).expect(201)).body as any;
    const orderId = conv.convertedOrder.id as string;
    created.orders.push(orderId);

    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "process" }).expect(200);
    const travelersRes = (await agent(op.accessToken).get(`/api/v1/orders/${orderId}/travelers`).expect(200)).body as { travelers: Array<{ id: string }> };
    expect(travelersRes.travelers).toHaveLength(2);
    for (let i = 0; i < travelersRes.travelers.length; i++) {
      await agent(op.accessToken)
        .patch(`/api/v1/orders/${orderId}/travelers/${travelersRes.travelers[i].id}`)
        .send({ firstName: `Чейн${i + 1}`, lastName: "Представительный" })
        .expect(200);
    }
    await agent(op.accessToken).post(`/api/v1/orders/${orderId}/final-confirm`).send({}).expect(201);
    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "confirm" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(200);

    const booking = await waitFor(
      async () => {
        const rows = await prisma.booking.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
        return rows[0] ?? null;
      },
      (b) => !!b,
    );
    await agent(op.accessToken).patch(`/api/v1/bookings/${booking.id}`).send({ action: "send" }).expect(200);
    await agent(op.accessToken).patch(`/api/v1/bookings/${booking.id}`).send({ action: "confirm" }).expect(200);
    return { requestRef: req.referenceNumber, orderId, bookingId: booking.id };
  };

  const httpStatus = async (p: Promise<request.Response>): Promise<number> => {
    try {
      const r = await p;
      return r.status;
    } catch (e) {
      const err = e as { status?: number; response?: { status: number } };
      return err.response?.status ?? err.status ?? 500;
    }
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
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('BookingRequested','BookingCreated','BookingConfirmed','BookingCancelled','OrderCancelled','PaymentCaptured','RefundProcessed','OrderFulfilled','OrderStatusChanged','BookingStatusChanged') AND "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer','order-booking-consumer','order-payment-consumer','order-refund-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  let op: Session;
  let seller: Seller;

  // ── F1 / F6 fixtures state ──
  type SeededOrder = Awaited<ReturnType<typeof seedMarketplaceD3Order>>;

  it("0. fixtures: roles + seller готовы", async () => {
    op = await createStaff("d4rc_op", RoleCode.OPERATOR);
    seller = await createApprovedSeller("A");
  });

  describe("F1 — TOCTOU traveler mutation ↔ final-confirm (DB row-lock)", () => {
    it("R1 single: finalConfirm побеждает → concurrent traveler PATCH не коммитится (409, DB неизменна)", async () => {
      const order = await seedMarketplaceD3Order(seller, { complete: true });
      const travelerId = order.travelers[0].id;

      // PATCH стартует первым (pre-read видит finalConfirmedAt = NULL), но его
      // tx упирается в row-lock теста; тест в это же время коммитит finalConfirm.
      const patchP = agent(op.accessToken)
        .patch(`/api/v1/orders/${order.id}/travelers/${travelerId}`)
        .send({ gender: "M" })
        .then((r) => r.status)
        .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
      const txP = (async () => {
        await prisma.$transaction(async (tx) => {
          // Держим row-lock строки Order, пока PATCH пытается войти в свою tx.
          await tx.$queryRawUnsafe(`SELECT "id" FROM "order"."Order" WHERE "id" = $1 FOR UPDATE`, order.id);
          await sleep(500);
          await tx.order.update({ where: { id: order.id }, data: { finalConfirmedAt: new Date() } });
        });
      })();

      const patchStatus = await patchP;
      await txP;
      expect(patchStatus).toBe(409); // R1: mutation после confirm невозможна

      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { travelers: true } });
      expect(dbOrder.finalConfirmedAt).not.toBeNull();
      expect(dbOrder.travelers[0].gender).toBe("F"); // значение не изменилось
    });

    it("R2 single: traveler PATCH коммитится первой → finalConfirm наблюдает закоммиченное состояние", async () => {
      // sequential-семантика + concurrent-раунды с инвариантом «нет post-confirm mutation».
      let observedR2 = 0;
      for (let round = 0; round < 4; round++) {
        const order = await seedMarketplaceD3Order(seller, { complete: true });
        const travelerId = order.travelers[0].id;
        const patchP = agent(op.accessToken)
          .patch(`/api/v1/orders/${order.id}/travelers/${travelerId}`)
          .send({ citizenship: "RU" })
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
        await sleep(round % 2 === 0 ? 0 : 12);
        const confirmP = agent(op.accessToken)
          .post(`/api/v1/orders/${order.id}/final-confirm`)
          .send({})
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);

        const [patchStatus, confirmStatus] = await Promise.all([patchP, confirmP]);
        const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { travelers: true } });
        expect(dbOrder.finalConfirmedAt).not.toBeNull();
        if (patchStatus === 409) {
          // R1 outcome: турист не тронут.
          expect(confirmStatus).toBe(201);
          expect(dbOrder.travelers[0].citizenship).toBe("AZ");
        } else {
          // R2 outcome: patch закоммичен ДО confirm (serialization) — DB хранит его значение.
          expect(patchStatus).toBe(200);
          expect(confirmStatus).toBe(201);
          expect(dbOrder.travelers[0].citizenship).toBe("RU");
          expect(dbOrder.travelers[0].dataCompleteness).toBe("COMPLETE");
          observedR2++;
        }
        // Никакой post-confirm mutation: дополнительный PATCH после confirm → 409.
        const after = await agent(op.accessToken)
          .patch(`/api/v1/orders/${order.id}/travelers/${travelerId}`)
          .send({ gender: "M" })
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
        expect(after).toBe(409);
      }
      expect(observedR2).toBeGreaterThan(0); // хотя бы один раунд — R2 (patch первый)
    });

    it("R1 bulk: finalConfirm побеждает → concurrent bulk PATCH не коммитится (409, DB неизменна)", async () => {
      const order = await seedMarketplaceD3Order(seller, { complete: true });
      const patchP = agent(op.accessToken)
        .patch(`/api/v1/orders/${order.id}/travelers`)
        .send({
          travelers: [{ firstName: PERSONA.firstName, lastName: "Изменён", citizenship: "KZ", gender: "M", passportNumber: PERSONA.passportNumber }],
        })
        .then((r) => r.status)
        .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
      const txP = (async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRawUnsafe(`SELECT "id" FROM "order"."Order" WHERE "id" = $1 FOR UPDATE`, order.id);
          await sleep(500);
          await tx.order.update({ where: { id: order.id }, data: { finalConfirmedAt: new Date() } });
        });
      })();

      const patchStatus = await patchP;
      await txP;
      expect(patchStatus).toBe(409);

      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { travelers: true } });
      expect(dbOrder.finalConfirmedAt).not.toBeNull();
      expect(dbOrder.travelers[0].lastName).toBe(PERSONA.lastName); // bulk не прошёл
    });

    it("R2 bulk: bulk PATCH коммитится первой → finalConfirm наблюдает закоммиченное состояние", async () => {
      let observedR2 = 0;
      for (let round = 0; round < 4; round++) {
        const order = await seedMarketplaceD3Order(seller, { complete: true });
        const patchP = agent(op.accessToken)
          .patch(`/api/v1/orders/${order.id}/travelers`)
          .send({
            travelers: [{ firstName: PERSONA.firstName, lastName: "Балк", citizenship: "GE", gender: "M", passportNumber: PERSONA.passportNumber }],
          })
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
        await sleep(round % 2 === 0 ? 0 : 12);
        const confirmP = agent(op.accessToken)
          .post(`/api/v1/orders/${order.id}/final-confirm`)
          .send({})
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);

        const [patchStatus, confirmStatus] = await Promise.all([patchP, confirmP]);
        const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { travelers: true } });
        expect(dbOrder.finalConfirmedAt).not.toBeNull();
        if (patchStatus === 409) {
          expect(confirmStatus).toBe(201);
          expect(dbOrder.travelers[0].lastName).toBe(PERSONA.lastName);
        } else {
          expect(patchStatus).toBe(200);
          expect(confirmStatus).toBe(201);
          expect(dbOrder.travelers[0].lastName).toBe("Балк");
          expect(dbOrder.travelers[0].dataCompleteness).toBe("COMPLETE");
          observedR2++;
        }
        const after = await agent(op.accessToken)
          .patch(`/api/v1/orders/${order.id}/travelers`)
          .send({ travelers: [{ firstName: PERSONA.firstName, lastName: "Поздний", citizenship: "AZ", passportNumber: PERSONA.passportNumber }] })
          .then((r) => r.status)
          .catch((e: { response?: { status: number }; status?: number }) => e.response?.status ?? e.status ?? 500);
        expect(after).toBe(409);
      }
      expect(observedR2).toBeGreaterThan(0);
    });
  });

  describe("F6 — legacy bulk traveler update (passportExpiry + canonical completeness)", () => {
    it("bulk pre-final-confirm сохраняет passportExpiry (DTO больше не silent-discard)", async () => {
      const expiry = FUTURE(500);
      const order = await seedMarketplaceD3Order(seller, { complete: false });
      const res = await agent(op.accessToken)
        .patch(`/api/v1/orders/${order.id}/travelers`)
        .send({
          travelers: [
            {
              firstName: PERSONA.firstName,
              lastName: PERSONA.lastName,
              citizenship: "AZ",
              gender: "F",
              passportNumber: PERSONA.passportNumber,
              passportExpiry: expiry,
            },
          ],
        })
        .expect(200);
      expect(res.body[0].passportExpiry ? new Date(res.body[0].passportExpiry).toISOString().slice(0, 10) : null).toBe(expiry);
      const db = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: order.travelers[0].id } });
      expect(db.passportExpiry).not.toBeNull();
      expect(db.passportExpiry!.toISOString().slice(0, 10)).toBe(expiry);
      expect(db.dataCompleteness).toBe("COMPLETE"); // citizenship+passport present → REQUIRED satisfied
    });

    it("pinned REQUIRED отсутствует → traveler НЕ COMPLETE; после заполнения → COMPLETE", async () => {
      const order = await seedMarketplaceD3Order(seller, { complete: false });
      // citizenship REQUIRED по pinned, но не передан → INCOMPLETE.
      const res1 = await agent(op.accessToken)
        .patch(`/api/v1/orders/${order.id}/travelers`)
        .send({ travelers: [{ firstName: PERSONA.firstName, lastName: PERSONA.lastName, passportNumber: PERSONA.passportNumber }] })
        .expect(200);
      expect(res1.body[0].dataCompleteness).toBe("INCOMPLETE");
      const db1 = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: order.travelers[0].id } });
      expect(db1.dataCompleteness).toBe("INCOMPLETE");

      // Все REQUIRED заполнены (OPTIONAL birthDate/gender не переданы — НЕ обязательны).
      const res2 = await agent(op.accessToken)
        .patch(`/api/v1/orders/${order.id}/travelers`)
        .send({
          travelers: [
            { firstName: PERSONA.firstName, lastName: PERSONA.lastName, citizenship: "AZ", passportNumber: PERSONA.passportNumber },
          ],
        })
        .expect(200);
      expect(res2.body[0].dataCompleteness).toBe("COMPLETE");
      const db2 = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: order.travelers[0].id } });
      expect(db2.dataCompleteness).toBe("COMPLETE");
    });
  });

  describe("F2 — Platform list/export Storefront bypass закрыт", () => {
    let mkt: Awaited<ReturnType<typeof seedMarketplaceChain>>;
    let sf: Awaited<ReturnType<typeof seedStorefrontChain>>;

    it("1. seed: Marketplace + Storefront цепочки существуют в DB (scope contrast)", async () => {
      mkt = await seedMarketplaceChain(seller);
      sf = await seedStorefrontChain(seller);
      const sfOrder = await prisma.order.findUniqueOrThrow({ where: { id: sf.order.id } });
      expect(sfOrder.acquisitionSource).toBe("PARTNER_STOREFRONT");
      const mktOrder = await prisma.order.findUniqueOrThrow({ where: { id: mkt.order.id } });
      expect(mktOrder.acquisitionSource).toBe("MARKETPLACE");
    });

    it("2. GET /orders?acquisitionSource=PARTNER_STOREFRONT → пусто (Storefront не существует для platform)", async () => {
      const res = await agent(op.accessToken).get(`/api/v1/orders?acquisitionSource=PARTNER_STOREFRONT`).expect(200);
      expect(res.body.total).toBe(0);
      expect(res.body.items).toHaveLength(0);
      // Positive: дефолтный platform scope = MARKETPLACE остаётся видимым.
      const def = await agent(op.accessToken).get(`/api/v1/orders`).expect(200);
      expect(def.body.total).toBeGreaterThanOrEqual(1);
      expect(def.body.items.map((o: { referenceNumber: string }) => o.referenceNumber)).toContain(mkt.order.referenceNumber);
      const mktFilter = await agent(op.accessToken).get(`/api/v1/orders?acquisitionSource=MARKETPLACE`).expect(200);
      expect(mktFilter.body.items.map((o: { referenceNumber: string }) => o.referenceNumber)).toContain(mkt.order.referenceNumber);
    });

    it("3. GET /orders/export?acquisitionSource=PARTNER_STOREFRONT → без Storefront-строк", async () => {
      const denied = await agent(op.accessToken).get(`/api/v1/orders/export?acquisitionSource=PARTNER_STOREFRONT`).expect(200);
      expect(denied.text).not.toContain(sf.order.referenceNumber);
      expect(denied.text).not.toContain(mkt.order.referenceNumber); // пустой экспорт
      const pos = await agent(op.accessToken).get(`/api/v1/orders/export`).expect(200);
      expect(pos.text).toContain(mkt.order.referenceNumber);
    });

    it("4. GET /bookings?acquisitionSource=PARTNER_STOREFRONT → пусто", async () => {
      const res = await agent(op.accessToken).get(`/api/v1/bookings?acquisitionSource=PARTNER_STOREFRONT`).expect(200);
      expect(res.body.total).toBe(0);
      expect(res.body.items).toHaveLength(0);
      const def = await agent(op.accessToken).get(`/api/v1/bookings`).expect(200);
      expect(def.body.items.map((b: { referenceNumber: string }) => b.referenceNumber)).toContain(mkt.booking.referenceNumber);
    });

    it("5. GET /bookings/export?acquisitionSource=PARTNER_STOREFRONT → без Storefront-строк", async () => {
      const denied = await agent(op.accessToken).get(`/api/v1/bookings/export?acquisitionSource=PARTNER_STOREFRONT`).expect(200);
      expect(denied.text).not.toContain(sf.booking.referenceNumber);
      const pos = await agent(op.accessToken).get(`/api/v1/bookings/export`).expect(200);
      expect(pos.text).toContain(mkt.booking.referenceNumber);
    });

    it("6. drill-down закрыт: export/list по Storefront orderId не отдают Storefront Booking", async () => {
      const drillSf = await agent(op.accessToken).get(`/api/v1/bookings/export?orderId=${sf.order.id}`).expect(200);
      expect(drillSf.text).not.toContain(sf.booking.referenceNumber);
      const listSf = await agent(op.accessToken).get(`/api/v1/bookings?orderId=${sf.order.id}`).expect(200);
      expect(listSf.body.total).toBe(0);
      const drillMkt = await agent(op.accessToken).get(`/api/v1/bookings/export?orderId=${mkt.order.id}`).expect(200);
      expect(drillMkt.text).toContain(mkt.booking.referenceNumber);
    });

    it("7. прямые Storefront reads сохранены: platform → 404 (D4 §10/§21 не сломан)", async () => {
      await agent(op.accessToken).get(`/api/v1/orders/${sf.order.id}`).expect(404);
      await agent(op.accessToken).get(`/api/v1/bookings/${sf.booking.id}`).expect(404);
    });
  });

  describe("F3/S12 — natural completion chain (Booking COMPLETED → Order FULFILLED → CLOSED)", () => {
    it("полная natural цепь через реальные команды + temporal integrity", async () => {
      const productId = await createProduct(seller, "s12");
      const customerId = await createCustomer("S12");
      const { orderId, bookingId } = await chainToBookingConfirmed(op, seller, productId, customerId);

      // Booking → IN_SERVICE → COMPLETED (реальные команды).
      await agent(op.accessToken).patch(`/api/v1/bookings/${bookingId}`).send({ action: "service" }).expect(200);
      await agent(op.accessToken).patch(`/api/v1/bookings/${bookingId}`).send({ action: "complete" }).expect(200);

      // Order auto-reconcile → FULFILLED (BookingStatusChanged → COMPLETED).
      const fulfilled = await waitFor(
        async () => prisma.order.findUnique({ where: { id: orderId } }),
        (o) => o!.status === "FULFILLED",
      );
      expect(fulfilled!.fulfilledAt).not.toBeNull();

      // Order → CLOSED (реальная команда close).
      await agent(op.accessToken).patch(`/api/v1/orders/${orderId}`).send({ action: "close" }).expect(200);

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(order.status).toBe("CLOSED");
      expect(booking.status).toBe("COMPLETED");

      // S12 temporal assertions (канонические timestamps; updatedAt не подменяет их).
      expect(booking.confirmedAt).not.toBeNull();
      expect(booking.completedAt).not.toBeNull();
      expect(order.fulfilledAt).not.toBeNull();
      expect(order.closedAt).not.toBeNull();
      expect(booking.completedAt!.getTime()).toBeGreaterThanOrEqual(booking.confirmedAt!.getTime());
      expect(order.fulfilledAt!.getTime()).toBeGreaterThanOrEqual(booking.completedAt!.getTime());
      expect(order.closedAt!.getTime()).toBeGreaterThanOrEqual(order.fulfilledAt!.getTime());
      expect(order.createdAt.getTime()).toBeLessThanOrEqual(order.fulfilledAt!.getTime());
    });
  });

  describe("S5 — customer decline (CANCELLED_BY_CUSTOMER, no Order conversion)", () => {
    it("Request → customer-decline → CANCELLED_BY_CUSTOMER → нет Order", async () => {
      const productId = await createProduct(seller, "s5");
      const customerId = await createCustomer("S5");
      const req = (await agent(op.accessToken)
        .post("/api/v1/requests")
        .send({
          customerId,
          productId,
          partnerId: seller.partnerId,
          requestedServiceDate: FUTURE(20),
          quantity: 1,
          travelerCount: 1,
          displayedPrice: 120,
          displayedCurrency: "USD",
        })
        .expect(201)).body as { id: string };
      created.requests.push(req.id);

      await agent(op.accessToken).post(`/api/v1/requests/${req.id}/customer-decline`).send({}).expect(201);
      const declined = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
      expect(declined.status).toBe("CANCELLED_BY_CUSTOMER");
      expect(declined.customerDecision).toBe("DECLINED");
      expect(declined.convertedOrderId).toBeNull();

      // Decline → конверсия невозможна (нет Order conversion): convert отклонён,
      // связь Request→Order остаётся NULL.
      const convertStatus = await httpStatus(agent(op.accessToken).post(`/api/v1/requests/${req.id}/convert`).send({}));
      expect(convertStatus).toBeGreaterThanOrEqual(400);
      const after = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
      expect(after.convertedOrderId).toBeNull();
      expect(after.status).toBe("CANCELLED_BY_CUSTOMER");
    });
  });
});
