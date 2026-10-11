/**
 * TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX (STRICT PROMPT §15/§16) —
 * REGRESSION for the previously untested PUBLIC TOUR-OFFER path.
 *
 * Root defect: TourRequestService.createTourRequest wrote the OFFER snapshot
 * into Request.pinnedRequirements → conversion copied it verbatim into
 * Order.pinnedRequirements → TravelerCollectionPanel.fieldsFor filtered every
 * key out (`(pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED"`) → ZERO
 * traveler input fields and an unreachable D3 lifecycle for tour-offer
 * Orders (live case: TH-2026-000101 / MKT-REQ-00000402).
 *
 * Chain asserted end-to-end (§15/§16):
 *
 *   public tour offer → create Request → confirm-price → customer-accept
 *   → convert → Order → GET /orders/:id/travelers → traveler inputs visible
 *   → PATCH traveler 1/2 → validate-completion → final-confirm → confirm
 *   → send → BookingRequested → Booking → Passengers
 *
 * D3 gates are asserted to stay INTACT (§13/§14): final confirmation blocked
 * until the REQUIRED traveler data is complete, and no confirm/send/Booking
 * before that.
 *
 * Resource safety (§17): single suite, serial (--runInBand), no watch/coverage.
 * Hermetic: SupplierOfferService.refreshPrice is overridden — no real supplier
 * call, no captcha, no network.
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
import { SupplierOfferService } from "../src/modules/supplier/supplier-offer.service";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[]; customerId: string | null };
}

const FUTURE = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/** Canonical TOUR pin (catalog/traveler-requirements DEFAULTS_TOUR, §3). */
const TOUR_PIN = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "REQUIRED",
  citizenship: "REQUIRED",
  gender: "NOT_REQUESTED",
  passportSeries: "REQUIRED",
  passportNumber: "REQUIRED",
  passportExpiry: "REQUIRED",
};

/** Exact copy of TravelerCollectionPanel.FIELD_ORDER (frontend contract). */
const FIELD_ORDER = [
  "firstName",
  "lastName",
  "birthDate",
  "citizenship",
  "gender",
  "passportSeries",
  "passportNumber",
  "passportExpiry",
] as const;

describe("Data-shape fix §15/§16 — public tour offer → traveler pin → D3 lifecycle", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAgent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const created: { users: string[]; requests: string[]; orders: string[] } = {
    users: [],
    requests: [],
    orders: [],
  };

  /** Hermetic supplier re-check (no network / no captcha).
   *  UNIFIED FINANCE CENTER Phase 1: recheck pricing-block в AZN (management
   *  currency; strict FX-гейт money-пути пропускает AZN-блоки). */
  const refreshPrice = jest.fn().mockResolvedValue({
    amount: 1050,
    currency: "AZN",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    queryHash: "e2e-hash",
    source: "KOMPAS",
    pricing: {
      supplierAmount: 1000,
      currency: "AZN",
      markupRate: "0.05",
      markupAmount: 50,
      publicAmount: 1050,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      configurationState: "CONFIGURED",
      calculatedAt: new Date().toISOString(),
    },
  });

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username, password })
      .expect(200);
    return res.body as Session;
  };
  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupplierOfferService)
      .useValue({ refreshPrice })
      .compile();
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
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Passenger" WHERE "bookingId" IN (SELECT id FROM "booking"."Booking" WHERE "orderId" = ANY($1))`, created.orders);
      await prisma.$executeRawUnsafe(`DELETE FROM "booking"."Booking" WHERE "orderId" = ANY($1)`, created.orders);
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "payload"->>'orderId' = ANY($1) OR "aggregateId" = ANY($1)`,
        created.orders,
      );
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.requests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: created.requests } } });
      await prisma.request.deleteMany({ where: { id: { in: created.requests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer')`,
    );
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("§15: offer snapshot → productSnapshot, traveler requirements → pin; full D3 chain to Booking/Passengers", async () => {
    // ── staff (OPERATOR = order.edit_noncritical / order.request_booking) ──
    const staff = (await adminAgent
      .post("/api/v1/users")
      .send({ username: `top${stamp}`, password: "staffpass123", roleCode: RoleCode.OPERATOR })
      .expect(201)).body as { id: string };
    created.users.push(staff.id);
    const op = await login(`top${stamp}`, "staffpass123");
    const opAgent = agent(op.accessToken);

    // ── 1. public tour offer → Request (productId may be NULL — §7) ──
    const createdRes = (await request(app.getHttpServer())
      .post("/api/v1/public/supplier/create-request")
      .send({
        supplierCode: "KOMPAS",
        externalOfferId: "35000",
        hotel: "Rixos Dubai",
        hotelExternalId: "2807",
        departureDate: FUTURE(),
        nights: 7,
        adults: 2,
        children: 0,
        room: "DBL",
        meal: "AI",
        price: 999999, // stale client number — ignored (server-authoritative re-check)
        currency: "USD",
        destination: "Antalya",
        departureCity: "Baku",
        country: "Turkey",
      })
      .expect(201)).body as { id: string; referenceNumber: string; displayedPrice: number };
    created.requests.push(createdRes.id);

    expect(refreshPrice).toHaveBeenCalled();
    expect(String(createdRes.displayedPrice)).toBe("1050");

    // ── 2. REQUEST: pin = canonical TravelerFullRequirements (§4/§5) ──
    const reqRow = await prisma.request.findUniqueOrThrow({ where: { id: createdRes.id } });
    expect(reqRow.productId).toBeNull(); // product-less path (§7) — ANEX/KOMPAS без catalog-hit
    const reqPin = reqRow.pinnedRequirements as Record<string, string>;
    expect(reqPin).toEqual(TOUR_PIN);

    // §15: offer facts are NOT traveler requirement keys.
    for (const key of ["hotel", "room", "meal", "externalOfferId", "supplierCode", "nights", "adults"]) {
      expect(reqPin).not.toHaveProperty(key);
    }

    // §6: offer/search facts preserved in the existing product snapshot.
    const reqSnap = reqRow.productSnapshot as Record<string, any>;
    expect(reqSnap.offer).toMatchObject({
      supplierCode: "KOMPAS",
      externalOfferId: "35000",
      hotel: "Rixos Dubai",
      hotelExternalId: "2807",
      nights: 7,
      adults: 2,
      children: 0,
      room: "DBL",
      meal: "AI",
      destination: "Antalya",
      departureCity: "Baku",
      country: "Turkey",
    });

    // ── 3. supplier confirm → состав туристов (§4/§6) → customer acceptance ──
    (await opAgent.post(`/api/v1/requests/${createdRes.id}/confirm-price`).send({}).expect(201))
      .body as { status: string };
    // Public offer собирает только adults/children → FIO+DOB задаёт staff через
    // Request travelers API (readiness-гейт §6 требует их до acceptance).
    for (const traveler of [
      { firstName: "Иван", lastName: "Иванов", birthDate: "1990-05-04" },
      { firstName: "Пётр", lastName: "Петров", birthDate: "1988-07-12" },
    ]) {
      await opAgent.post(`/api/v1/requests/${createdRes.id}/travelers`).send(traveler).expect(201);
    }
    (await opAgent.post(`/api/v1/requests/${createdRes.id}/customer-accept`).send({}).expect(201))
      .body as { status: string };

    const accepted = await prisma.request.findUniqueOrThrow({ where: { id: createdRes.id } });
    expect(accepted.status).toBe("CUSTOMER_ACCEPTED");
    expect(accepted.pinnedRequirements as Record<string, string>).toEqual(TOUR_PIN);
    expect((accepted.productSnapshot as Record<string, any>).offer).toMatchObject({
      hotel: "Rixos Dubai",
      nights: 7,
    });

    // ── 4. convert → Order carries the SAME traveler pin (propagation) ──
    const conv = (await opAgent.post(`/api/v1/requests/${createdRes.id}/convert`).send({}).expect(201))
      .body as { convertedOrder: { id: string } };
    const orderId = conv.convertedOrder.id;
    created.orders.push(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.pinnedRequirements as Record<string, string>).toEqual(TOUR_PIN);
    expect(order.travelerCount).toBe(2);

    const travelers = await prisma.orderTraveler.findMany({
      where: { orderId },
      orderBy: { position: "asc" },
    });
    expect(travelers).toHaveLength(2);

    // ── 5. GET travelers → panel renders the CORRECT inputs (§15/E) ──
    const view = (await opAgent.get(`/api/v1/orders/${orderId}/travelers`).expect(200)).body as {
      pinnedRequirements: Record<string, string> | null;
      travelers: Array<{ id: string; firstName: string; dataCompleteness: string }>;
    };
    expect(view.pinnedRequirements).toEqual(TOUR_PIN);
    expect(view.travelers).toHaveLength(2);

    // Exact TravelerCollectionPanel.fieldsFor projection — BEFORE the fix this
    // was [] (zero inputs); AFTER the fix the required identity fields show.
    const fieldsFor = FIELD_ORDER.filter(
      (f) => ((view.pinnedRequirements ?? {})[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED",
    );
    expect(fieldsFor).toEqual(["firstName", "lastName", "birthDate", "citizenship", "passportSeries", "passportNumber", "passportExpiry"]);
    expect(fieldsFor).not.toContain("hotel");

    // ── 6. D3 gates stay intact (§13/§14) ──
    await opAgent.patch(`/api/v1/orders/${orderId}`).send({ action: "process" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${orderId}`).send({ action: "confirm" }).expect(422); // no final-confirm yet
    await opAgent.patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(409);
    expect(await prisma.booking.count({ where: { orderId } })).toBe(0);

    // FIO+DOB скопированы из Request, но Order-стадия §4 (гражданство/серия/номер/
    // срок) пуста → final confirmation denied (REQUIRED gate).
    await opAgent.post(`/api/v1/orders/${orderId}/final-confirm`).expect(422);

    // ── 7. traveler PATCH works (§F) + completeness (§G) ──
    await opAgent
      .patch(`/api/v1/orders/${orderId}/travelers/${travelers[0].id}`)
      .send({
        firstName: "Иван",
        lastName: "Иванов",
        birthDate: "1990-05-04",
        citizenship: "RU",
        passportSeries: "RU",
        passportNumber: "RU1000001",
        passportExpiry: FUTURE(900),
      })
      .expect(200);
    await opAgent
      .patch(`/api/v1/orders/${orderId}/travelers/${travelers[1].id}`)
      .send({
        firstName: "Пётр",
        lastName: "Петров",
        birthDate: "1988-07-12",
        citizenship: "RU",
        passportSeries: "RU",
        passportNumber: "RU1000002",
        passportExpiry: FUTURE(950),
      })
      .expect(200);

    const saved = await prisma.orderTraveler.findMany({ where: { orderId }, orderBy: { position: "asc" } });
    expect(saved[0].firstName).toBe("Иван");
    expect(saved[0].dataCompleteness).toBe("COMPLETE");
    expect(saved[1].dataCompleteness).toBe("COMPLETE");

    const completion = (await opAgent
      .post(`/api/v1/orders/${orderId}/validate-completion`)
      .expect(201)).body as { complete: boolean; reason: string | null };
    expect(completion.complete).toBe(true);

    // ── 8. final-confirm → confirm → send → Booking → Passengers (§I/§16) ──
    await opAgent.post(`/api/v1/orders/${orderId}/final-confirm`).expect(201);
    await opAgent.patch(`/api/v1/orders/${orderId}`).send({ action: "confirm" }).expect(200);
    await opAgent.patch(`/api/v1/orders/${orderId}`).send({ action: "send" }).expect(200);

    const bookings = await prisma.booking.findMany({ where: { orderId } });
    expect(bookings).toHaveLength(1);
    const passengers = await prisma.passenger.findMany({
      where: { bookingId: bookings[0].id },
      orderBy: { id: "asc" },
    });
    expect(passengers).toHaveLength(2);
    expect(passengers.map((p) => p.firstName).sort()).toEqual(["Иван", "Пётр"]);

    // Immutability after final confirmation (§13).
    await opAgent
      .patch(`/api/v1/orders/${orderId}/travelers/${travelers[0].id}`)
      .send({ firstName: "Хакер" })
      .expect(409);
  });
});
