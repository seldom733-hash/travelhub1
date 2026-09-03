/**
 * PHASE 3 — PRE-STEP 3.12 — D4 — TRAVELER SECURITY + TENANT ISOLATION (e2e).
 *
 * Охватывает D4 §27 automated security tests:
 *  - cross-tenant OrderTraveler/Passenger read denied (Partner B → 403, permission);
 *  - unauthorized role cannot fetch sensitive fields (SALES_MANAGER/ANALYST → redacted PII);
 *  - list endpoints do not overexpose sensitive traveler payload;
 *  - post-final-confirm mutation denied (bulk PATCH travelers → 409 — D4 F1 fix);
 *  - travelerCount / pinnedRequirements / server-owned keys mutation denied (422);
 *  - direct UUID enumeration denied: Storefront-tenant объекты не читаются через
 *    Platform Marketplace read/command контракты (404 — D4 F2 fix);
 *  - Storefront traveler data excluded from Platform Marketplace scope.
 *
 * Fixtures — deterministic seed builder (§14): валидный domain graph
 * (Order + OrderTraveler + Booking + Passenger, canonical shape). Жизненные
 * переходы (final confirm) выполняются реальными командами. Synthetic personas
 * (§26, PII-safe).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
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

describe("Phase 3 Pre-Step 3.12 D4 — Traveler Security + Tenant Isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;
  let operator: Session;
  let salesManager: Session;
  let analyst: Session;

  const stamp = Date.now();
  const created: {
    users: string[];
    partners: string[];
    products: string[];
    orders: string[];
    bookings: string[];
  } = { users: [], partners: [], products: [], orders: [], bookings: [] };

  // Synthetic personas (D4 §26 — PII-safe evidence).
  const PERSONA = {
    firstName: "Айтен",
    lastName: "Мамедова",
    passportNumber: "AZ1234567",
    passportExpiry: FUTURE(700),
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

  /** Полный onboarding одобренного партнёра (register → submit → review → approve → re-login). */
  const createApprovedSeller = async (tag: string): Promise<Seller> => {
    const email = `d4p${tag.toLowerCase()}${stamp}@test.local`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email,
        password: "partnerpass123",
        firstName: "П",
        lastName: tag.toUpperCase(),
        applicantType: "INDIVIDUAL",
        brandName: `D4 Partner ${tag} ${stamp}`,
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
    passportExpiry: "REQUIRED",
  };

  /** Seed builder — Marketplace Order chain (canonical shape, до final confirm). */
  const seedMarketplaceChain = async (seller: Seller) => {
    const uid = `D4M${stamp}`;
    const order = await prisma.order.create({
      data: {
        code: `ORD-${uid}`,
        number: `TH-${uid}`,
        referenceNumber: `MKT-ORD-${String(stamp).slice(-8)}`,
        status: "NEW",
        currency: "USD",
        amount: 240,
        acquisitionSource: "MARKETPLACE",
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: null,
        travelerCount: 2,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: {
          create: [
            {
              position: 1,
              firstName: PERSONA.firstName,
              lastName: PERSONA.lastName,
              birthDate: new Date("1992-04-11"),
              citizenship: "AZ",
              gender: "F",
              passportNumber: PERSONA.passportNumber,
              passportExpiry: new Date(PERSONA.passportExpiry),
              dataCompleteness: "COMPLETE",
              version: 1,
            },
            {
              position: 2,
              firstName: "Эльдар",
              lastName: "Мамедов",
              birthDate: new Date("1989-09-02"),
              citizenship: "AZ",
              gender: "M",
              passportNumber: "AZ7654321",
              passportExpiry: new Date(FUTURE(650)),
              dataCompleteness: "COMPLETE",
              version: 1,
            },
          ],
        },
      },
      include: { travelers: true },
    });
    created.orders.push(order.id);
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${uid}`,
        referenceNumber: `MKT-BKG-${String(stamp).slice(-8)}`,
        orderId: order.id,
        productId: "d4-fixture-product",
        status: "NEW",
        amount: 240,
        currency: "USD",
        acquisitionSource: "MARKETPLACE",
        passengers: {
          create: [
            {
              firstName: PERSONA.firstName,
              lastName: PERSONA.lastName,
              birthDate: new Date("1992-04-11"),
              citizenship: "AZ",
              gender: "F",
              passportNumber: PERSONA.passportNumber,
              passportExpiry: new Date(PERSONA.passportExpiry),
            },
          ],
        },
      },
    });
    created.bookings.push(booking.id);
    return { order, booking };
  };

  /** Seed builder — Storefront (PARTNER) tenant chain (D4 §21). */
  const seedStorefrontChain = async (seller: Seller) => {
    const uid = `D4S${stamp}`;
    const order = await prisma.order.create({
      data: {
        code: `ORD-${uid}`,
        number: `TH-${uid}-SF`,
        referenceNumber: `SF001-ORD-${String(stamp).slice(-8)}`,
        status: "SENT_TO_BOOKING",
        currency: "USD",
        amount: 180,
        acquisitionSource: "PARTNER_STOREFRONT",
        sellerPartnerId: seller.partnerId,
        termsAcceptedAt: new Date(),
        finalConfirmedAt: new Date(),
        travelerCount: 1,
        pinnedRequirements: PINNED as unknown as Prisma.InputJsonValue,
        travelers: {
          create: [
            {
              position: 1,
              firstName: "Storefront",
              lastName: "Guest",
              citizenship: "GE",
              gender: "M",
              passportNumber: "GE9988776",
              passportExpiry: new Date(FUTURE(600)),
              dataCompleteness: "COMPLETE",
              version: 1,
            },
          ],
        },
      },
      include: { travelers: true },
    });
    created.orders.push(order.id);
    const booking = await prisma.booking.create({
      data: {
        code: `BKG-${uid}`,
        referenceNumber: `SF001-BKG-${String(stamp).slice(-8)}`,
        orderId: order.id,
        productId: "d4-fixture-product",
        status: "CONFIRMED",
        amount: 180,
        currency: "USD",
        acquisitionSource: "PARTNER_STOREFRONT",
        passengers: {
          create: [{ firstName: "Storefront", lastName: "Guest", citizenship: "GE", passportNumber: "GE9988776" }],
        },
      },
    });
    created.bookings.push(booking.id);
    return { order, booking };
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
    operator = await createStaff("d4op", RoleCode.OPERATOR);
    salesManager = await createStaff("d4sm", RoleCode.SALES_MANAGER);
    analyst = await createStaff("d4an", RoleCode.ANALYST);
  });

  afterAll(async () => {
    if (created.bookings.length > 0) {
      await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } }); // Passenger cascade
    }
    if (created.orders.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } }); // OrderTraveler cascade
    }
    if (created.products.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    }
    await prisma.publicSellerProfile.deleteMany({ where: { partnerId: { in: created.partners } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  let sellerA: Seller;
  let sellerB: Seller;
  let mkt: Awaited<ReturnType<typeof seedMarketplaceChain>>;
  let sf: Awaited<ReturnType<typeof seedStorefrontChain>>;

  it("1. seed: Marketplace + Storefront tenant chains exist (valid domain graph)", async () => {
    sellerA = await createApprovedSeller("A");
    sellerB = await createApprovedSeller("B");
    mkt = await seedMarketplaceChain(sellerA);
    sf = await seedStorefrontChain(sellerA);

    const mktRow = await prisma.order.findUniqueOrThrow({ where: { id: mkt.order.id }, include: { travelers: true } });
    expect(mktRow.acquisitionSource).toBe("MARKETPLACE");
    expect(mktRow.travelers).toHaveLength(2);
    const sfRow = await prisma.order.findUniqueOrThrow({ where: { id: sf.order.id } });
    expect(sfRow.acquisitionSource).toBe("PARTNER_STOREFRONT");
  });

  it("2. cross-tenant denied: Partner B не читает OrderTraveler/Passenger цепочки Partner A → 403", async () => {
    await sellerB.agent.get(`/api/v1/orders/${mkt.order.id}`).expect(403);
    await sellerB.agent.get(`/api/v1/orders/${mkt.order.id}/travelers`).expect(403);
    await sellerB.agent.get(`/api/v1/bookings/${mkt.booking.id}`).expect(403);
    await sellerB.agent.get(`/api/v1/orders/${sf.order.id}`).expect(403);
    await sellerB.agent.get(`/api/v1/bookings/${sf.booking.id}`).expect(403);
  });

  it("3. unauthorized role: SALES_MANAGER/ANALYST видят redacted PII, OPERATOR — full", async () => {
    const smOrder = await agent(salesManager.accessToken).get(`/api/v1/orders/${mkt.order.id}`).expect(200);
    expect(smOrder.body.travelers).toHaveLength(2);
    for (const t of smOrder.body.travelers) {
      expect(t.passportNumber).toBeNull();
      expect(t.passportExpiry).toBeNull();
      expect(t.birthDate).toBeNull();
      expect(t.firstName).toBeTruthy();
    }
    const anProj = await agent(analyst.accessToken).get(`/api/v1/orders/${mkt.order.id}/travelers`).expect(200);
    for (const t of anProj.body.travelers) {
      expect(t.passportNumber).toBeNull();
      expect(t.passportExpiry).toBeNull();
      expect(t.birthDate).toBeNull();
    }
    const anBkg = await agent(analyst.accessToken).get(`/api/v1/bookings/${mkt.booking.id}`).expect(200);
    expect(anBkg.body.passengers[0].passportNumber).toBeNull();
    expect(anBkg.body.passengers[0].firstName).toBeTruthy();
    const opOrder = await agent(operator.accessToken).get(`/api/v1/orders/${mkt.order.id}`).expect(200);
    expect(opOrder.body.travelers[0].passportNumber).toBe(PERSONA.passportNumber);
    const opBkg = await agent(operator.accessToken).get(`/api/v1/bookings/${mkt.booking.id}`).expect(200);
    expect(opBkg.body.passengers[0].passportNumber).toBe(PERSONA.passportNumber);
  });

  it("4. list endpoints не overexpose: /orders traveler PII redacted; /bookings projection минимальна", async () => {
    const list = await agent(analyst.accessToken).get(`/api/v1/orders?search=${mkt.order.code}`).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(mkt.order.id);
    for (const t of list.body.items[0].travelers) {
      expect(t.passportNumber).toBeNull();
    }
    const bl = await agent(analyst.accessToken).get(`/api/v1/bookings?orderId=${mkt.order.id}`).expect(200);
    expect(bl.body.total).toBe(1);
    const p = bl.body.items[0].passengers[0];
    expect(p.passportNumber).toBeUndefined();
    expect(p.firstName).toBeTruthy();
  });

  it("5. forged server-owned keys: travelerCount/pinnedRequirements/dataCompleteness → 422", async () => {
    await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}`)
      .send({ action: "confirm", travelerCount: 5 })
      .expect(422);
    await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers`)
      .send({ travelers: [{ firstName: "X", lastName: "Y" }], pinnedRequirements: { firstName: "OPTIONAL" } })
      .expect(422);
    const t1 = mkt.order.travelers[0];
    await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers/${t1.id}`)
      .send({ firstName: "X", dataCompleteness: "COMPLETE" })
      .expect(422);
  });

  it("6. SALES_MANAGER не мутирует (403); OPERATOR update до final confirm — 200 (positive path)", async () => {
    const t1 = mkt.order.travelers[0];
    await agent(salesManager.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers/${t1.id}`)
      .send({ citizenship: "RU" })
      .expect(403);
    await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers/${t1.id}`)
      .send({ citizenship: "KZ" })
      .expect(200);
    const after = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: t1.id } });
    expect(after.citizenship).toBe("KZ");
    expect(after.passportNumber).toBe(PERSONA.passportNumber);
  });

  it("7. post-final-confirm mutation denied: final confirm → bulk PATCH 409, single PATCH 409", async () => {
    await agent(operator.accessToken).post(`/api/v1/orders/${mkt.order.id}/final-confirm`).expect(201);
    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: mkt.order.id } });
    expect(confirmed.finalConfirmedAt).not.toBeNull();
    const bulk = await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers`)
      .send({
        travelers: [
          { firstName: "Hacked", lastName: "One" },
          { firstName: "Hacked", lastName: "Two" },
        ],
      });
    expect(bulk.status).toBe(409);
    const single = await agent(operator.accessToken)
      .patch(`/api/v1/orders/${mkt.order.id}/travelers/${mkt.order.travelers[0].id}`)
      .send({ firstName: "Hacked" });
    expect(single.status).toBe(409);
    const rows = await prisma.orderTraveler.findMany({ where: { orderId: mkt.order.id } });
    expect(rows.every((r) => !r.firstName.startsWith("Hacked"))).toBe(true);
    expect(rows.every((r) => r.passportNumber !== null)).toBe(true);
  });

  it("8. direct UUID enumeration denied: Storefront-tenant объекты не читаются через Platform контракт → 404", async () => {
    await agent(operator.accessToken).get(`/api/v1/orders/${sf.order.id}`).expect(404);
    await agent(operator.accessToken).get(`/api/v1/orders/${sf.order.id}/travelers`).expect(404);
    await agent(operator.accessToken).get(`/api/v1/bookings/${sf.booking.id}`).expect(404);
  });

  it("9. Storefront-tenant команды denied: traveler mutation / final-confirm / lifecycle → 404", async () => {
    await agent(operator.accessToken)
      .patch(`/api/v1/orders/${sf.order.id}/travelers/${sf.order.travelers[0].id}`)
      .send({ firstName: "Hacked" })
      .expect(404);
    await agent(operator.accessToken).post(`/api/v1/orders/${sf.order.id}/final-confirm`).expect(404);
    await agent(operator.accessToken).patch(`/api/v1/orders/${sf.order.id}`).send({ action: "complete" }).expect(404);
    await agent(operator.accessToken).patch(`/api/v1/bookings/${sf.booking.id}`).send({ action: "cancel" }).expect(404);
    const row = await prisma.orderTraveler.findUniqueOrThrow({ where: { id: sf.order.travelers[0].id } });
    expect(row.firstName).toBe("Storefront");
  });

  it("10. Storefront traveler data excluded from Platform Marketplace scope (list/registry)", async () => {
    const ol = await agent(operator.accessToken).get(`/api/v1/orders?search=${sf.order.code}`).expect(200);
    expect(ol.body.total).toBe(0);
    const bl = await agent(operator.accessToken).get(`/api/v1/bookings?orderId=${sf.order.id}`).expect(200);
    expect(bl.body.total).toBe(0);
    const bs = await agent(operator.accessToken).get(`/api/v1/bookings?search=${sf.booking.code}`).expect(200);
    expect(bs.body.total).toBe(0);
  });
});
