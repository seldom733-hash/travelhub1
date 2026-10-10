/**
 * M4.5 — GUEST CHECKOUT e2e (§23/§24, §28 «Guest checkout»).
 *
 * Сценарий §23: anonymous visitor → onboarding → Customer Resolver →
 * Customer (create/reuse, никогда не merge) → Request → Order (staff-assisted).
 *
 * Покрытие (§28):
 *  - anonymous onboarding: без аутентификации (public @Public endpoint);
 *  - Customer creation: phoneCanonical + email, БЕЗ создания User
 *    (регистрация не форсируется, option B — пароли не изобретаются);
 *  - Customer reuse: тот же телефон → тот же Customer (created=false);
 *  - email-fallback reuse: новый телефон + существующий email → read-only
 *    reuse (source=email), без дубля Customer;
 *  - AMBIGUOUS (>1 владельцев телефона) → 409, без auto-merge;
 *  - Request: NEW, customerId = resolver-результат, quantity/travelerCount
 *    дефолты, цена гостем не задаётся (displayedPrice null);
 *  - Order: staff-assisted flow (propose → accept → convert) → canonical
 *    Order с тем же customerId (§24 commerce owner, phone НЕ owner);
 *  - Traveler: PATCH traveler не создаёт User (§28 Traveler);
 *  - whitelist: forged customerId/роли из body игнорируются;
 *  - race (M4.6 §11): конкурентный duplicate creation → ровно 1 Customer,
 *    без HTTP 500 (advisory lock + deterministic ConflictError);
 *  - throttle: 10 неуспешных попыток/IP → 429.
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
import { normalizePhoneE164 } from "../src/shared/phone/phone";
import { LoginThrottleService } from "../src/shared/login-throttle.service";

interface Session {
  accessToken: string;
  user: { id: string; role: string };
}

describe("M4.5 — Guest checkout (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emailDomain = `m45-${stamp}.test`;
  const password = "secret12345";
  let operatorToken: string;
  const createdUserIds: string[] = [];
  const createdRequests: string[] = [];
  const createdOrders: string[] = [];
  const createdAmbiguousCustomers: string[] = [];

  let pseq = 0;
  const nextNational = () => {
    pseq += 1;
    const nine = `50${String(((stamp % 100000) * 100 + pseq) % 100000000).padStart(7, "0")}`;
    return `0${nine.slice(0, 9)}`;
  };
  const canonicalOf = (national: string) => normalizePhoneE164(national)!;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (username: string, pass: string): Promise<Session> => {
    const res = await api().post("/api/v1/auth/login").send({ username, password: pass }).expect(200);
    return res.body as Session;
  };

  const guest = (body: Record<string, unknown>) => api().post("/api/v1/checkout/guest").send(body);

  /** M4.6: детерминированное окно throttle между тестами (check() на каждый запрос). */
  const resetGuestThrottle = () => {
    const throttle = app.get(LoginThrottleService);
    for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
      throttle.reset(`guest-checkout|${ip}`);
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

    const operator = (
      await api()
        .post("/api/v1/users")
        .set(bearer((await login("admin", "admin123")).accessToken))
        .send({ username: `m45_op_${stamp}`, password, roleCode: RoleCode.OPERATOR })
        .expect(201)
    ).body as { id: string };
    createdUserIds.push(operator.id);
    operatorToken = (await login(`m45_op_${stamp}`, password)).accessToken;
  });

  afterAll(async () => {
    if (createdOrders.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "events"."OutboxEvent" WHERE "eventType" IN ('OrderCreated','OrderReadyForBooking','OrderStatusChanged') AND "aggregateId" = ANY($1)`,
        createdOrders,
      );
      await prisma.order.deleteMany({ where: { id: { in: createdOrders } } });
    }
    if (createdRequests.length > 0) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: createdRequests } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequests } } });
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "events"."InboxEvent" WHERE "consumerId" IN ('order-requested-consumer','booking-requested-consumer','booking-order-cancelled-consumer') AND "eventId" NOT IN (SELECT id FROM "events"."OutboxEvent")`,
    );
    await prisma.customer.deleteMany({ where: { email: { endsWith: `@${emailDomain}` } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ action: { startsWith: "checkout." } }, { action: "request.created", username: "guest-checkout" }],
        createdAt: { gte: new Date(stamp - 60_000) },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  it("validation: bad email → 400; invalid phone → 422; unknown product → 404; forged fields stripped", async () => {
    await guest({ email: "not-an-email", phone: "0501234567" }).expect(400);
    await guest({ email: `v1@${emailDomain}`, phone: "12345678" }).expect(422);
    await guest({ email: `v2@${emailDomain}`, phone: "0501111111", productId: `missing-${stamp}` }).expect(404);

    // Whitelist: forged customerId/role/id из body не влияют на результат —
    // commerce owner берётся ТОЛЬКО из Customer Resolver (§22/§24).
    const forged = await guest({
      email: `forged@${emailDomain}`,
      phone: "0502222222",
      customerId: "forged-customer-id",
      roleCode: "ADMIN",
      id: "forged-request-id",
      loginPhone: "+994500000000",
    }).expect(201);
    expect(forged.body.customer.id).toBeTruthy();
    expect(forged.body.customer.id).not.toBe("forged-customer-id");
    expect(forged.body.request.customerId).toBe(forged.body.customer.id);
    expect(forged.body.request.id).not.toBe("forged-request-id");
    expect(forged.body.roleCode).toBeUndefined();
    createdRequests.push(forged.body.request.id as string);
  });

  it("anonymous onboarding: UNMATCHED → Customer (без User) + Request + audit без PII", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const email = `guest1@${emailDomain}`;

    const res = await guest({ email, phone: national, firstName: "Guest", lastName: "First" }).expect(201);
    expect(res.body.customer.created).toBe(true);
    expect(res.body.resolvedSource).toBe("none");
    expect(res.body.request.status).toBe("NEW");
    const customerId = res.body.customer.id as string;
    const requestId = res.body.request.id as string;
    createdRequests.push(requestId);

    // Customer: canonical phone + нормализованный email; User НЕ создан
    // (guest ≠ регистрация; option B: пароли/аккаунты не изобретаются).
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.phoneCanonical).toBe(canonical);
    expect(customer.email).toBe(email);
    expect(await prisma.user.findFirst({ where: { loginPhone: canonical } })).toBeNull();

    // Request: дефолты §23 — quantity/travelerCount, цена гостем не задаётся.
    const reqRow = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(reqRow.customerId).toBe(customerId);
    expect(reqRow.productId).toBeNull();
    expect(reqRow.quantity).toBe(1);
    expect(reqRow.travelerCount).toBe(1);
    expect(reqRow.displayedPrice).toBeNull();
    expect(reqRow.displayedCurrency).toBe("AZN"); // серверная константа (не от гостя)

    // History: system-актор guest-канала.
    const hist = await prisma.requestHistory.findFirst({ where: { requestId, action: "created" } });
    expect(hist?.actorName).toBe("guest-checkout");
    expect(hist?.actorId).toBeNull();

    // Audit checkout.guest_created: userId null, без PII в details.
    const audit = await prisma.auditLog.findFirst({
      where: { action: "checkout.guest_created", resourceId: requestId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBeNull();
    expect(audit!.username).toBe("guest-checkout");
    const details = JSON.stringify(audit!.details ?? {});
    expect(details).not.toContain(email);
    expect(details).not.toContain(national);
    expect(details).toContain(customerId);
  });

  it("reuse по телефону: другой email → тот же Customer, без дубла", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const first = await guest({ email: `reuse1@${emailDomain}`, phone: national }).expect(201);
    const customerId = first.body.customer.id as string;
    createdRequests.push(first.body.request.id as string);
    expect(first.body.customer.created).toBe(true);

    const second = await guest({ email: `reuse2@${emailDomain}`, phone: canonical }).expect(201);
    expect(second.body.customer.created).toBe(false);
    expect(second.body.customer.id).toBe(customerId);
    expect(second.body.resolvedSource).toBe("phone");
    createdRequests.push(second.body.request.id as string);

    expect(await prisma.customer.count({ where: { phoneCanonical: canonical } })).toBe(1);
  });

  it("email-fallback reuse: новый телефон + существующий email → read-only reuse, без дубла", async () => {
    const email = `mailkey@${emailDomain}`;
    const first = await guest({ email, phone: "0503333333" }).expect(201);
    const customerId = first.body.customer.id as string;
    createdRequests.push(first.body.request.id as string);

    const second = await guest({ email: email.toUpperCase(), phone: "0504444444" }).expect(201);
    expect(second.body.customer.created).toBe(false);
    expect(second.body.customer.id).toBe(customerId);
    expect(second.body.resolvedSource).toBe("email");
    createdRequests.push(second.body.request.id as string);

    expect(await prisma.customer.count({ where: { email } })).toBe(1);
  });

  it("AMBIGUOUS: >1 Customer с телефоном → 409, без auto-merge и без create", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    for (const suffix of ["1", "2"]) {
      const c = await prisma.customer.create({
        data: {
          code: `M45-AMB-${stamp}-${suffix}`,
          email: `amb${suffix}@${emailDomain}`,
          phone: national,
          phoneCanonical: canonical,
        },
        select: { id: true },
      });
      createdAmbiguousCustomers.push(c.id);
    }

    const res = await guest({ email: `amb-guest@${emailDomain}`, phone: national }).expect(409);
    expect(res.body.message).toMatch(/multiple customer records/i);
    expect(await prisma.customer.count({ where: { phoneCanonical: canonical } })).toBe(2);

    await prisma.customer.deleteMany({ where: { id: { in: createdAmbiguousCustomers } } });
    createdAmbiguousCustomers.length = 0;
  });

  it("staff-assisted flow: guest Request → propose → accept → convert → Order (customerId owner) + traveler без User", async () => {
    const national = nextNational();
    const canonical = canonicalOf(national);
    const res = await guest({
      email: `pipeline@${emailDomain}`,
      phone: national,
      firstName: "Pipeline",
      lastName: "Guest",
      travelerCount: 1,
    }).expect(201);
    const customerId = res.body.customer.id as string;
    const requestId = res.body.request.id as string;
    createdRequests.push(requestId);
    expect(res.body.customer.created).toBe(true);

    // Supplier: предложить цену (guest цену не задавал — checkout не источник цены).
    await api()
      .post(`/api/v1/requests/${requestId}/propose-price`)
      .set(bearer(operatorToken))
      .send({ price: 350, note: "M4.5 guest pipeline" })
      .expect(201);

    // Two-stage §4: guest FIO+DOB не собирал → оператор задаёт состав туриста
    // через Request travelers API (readiness-гейт §6 требует его до acceptance).
    await api()
      .post(`/api/v1/requests/${requestId}/travelers`)
      .set(bearer(operatorToken))
      .send({ firstName: "Guest", lastName: "Traveler", birthDate: "1990-05-10" })
      .expect(201);

    // Customer acceptance → CUSTOMER_ACCEPTED (freeze confirmedPrice/terms).
    await api()
      .post(`/api/v1/requests/${requestId}/customer-accept`)
      .set(bearer(operatorToken))
      .send({})
      .expect(201);

    // Convert → canonical Order; commerce owner = customerId (§24).
    const conv = (await api()
      .post(`/api/v1/requests/${requestId}/convert`)
      .set(bearer(operatorToken))
      .send({})
      .expect(201)).body as { status: string; convertedOrder: { id: string } };
    expect(conv.status).toBe("CONVERTED");
    const orderId = conv.convertedOrder.id;
    createdOrders.push(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.customerId).toBe(customerId);
    const reqRow = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(reqRow.status).toBe("CONVERTED");
    expect(reqRow.convertedOrderId).toBe(orderId);

    // Traveler placeholders из frozen travelerCount; PATCH не создаёт User.
    const travelers = await prisma.orderTraveler.findMany({ where: { orderId } });
    expect(travelers.length).toBe(1);
    const usersBefore = await prisma.user.count();
    await api()
      .patch(`/api/v1/orders/${orderId}/travelers/${travelers[0].id}`)
      .set(bearer(operatorToken))
      .send({ firstName: "Guest", lastName: "Traveler" })
      .expect(200);
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.user.findFirst({ where: { loginPhone: canonical } })).toBeNull();
  });

  it("race: 5 конкурентных guest checkout с одним телефоном → ровно 1 Customer, без 500 (§11 advisory lock)", async () => {
    resetGuestThrottle();
    const national = nextNational();
    const canonical = canonicalOf(national);

    const statuses: number[] = [];
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        guest({ email: `race${i}@${emailDomain}`, phone: national, firstName: "Race", lastName: "Guest" }).then(
          (res) => {
            statuses.push(res.status);
            const requestId = res.body?.request?.id;
            if (requestId) createdRequests.push(requestId as string);
          },
        ),
      ),
    );

    // §11: «Do not return HTTP 500 for an expected concurrent identity race» —
    // только 201 (create/reuse) либо контролируемый 409 (duplicate guard).
    expect(statuses.length).toBe(5);
    for (const status of statuses) expect([201, 409]).toContain(status);
    expect(statuses.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);

    // Инвариант M4.6: check-then-create под pg_advisory_xact_lock — дубль
    // владельца телефона невозможен, конкурентная гонка не даёт второго Customer.
    expect(await prisma.customer.count({ where: { phoneCanonical: canonical } })).toBe(1);

    resetGuestThrottle();
  });

  it("throttle: 10 неуспешных попыток/IP → 429 (последний тест)", async () => {
    resetGuestThrottle();
    let p = 7000000;
    for (let i = 0; i < 10; i += 1) {
      p += 1;
      await guest({
        email: `thr${i}@${emailDomain}`,
        phone: `050${p}`,
        productId: `missing-${stamp}`,
      }).expect(404);
    }
    p += 1;
    await guest({
      email: `thr-final@${emailDomain}`,
      phone: `050${p}`,
      productId: `missing-${stamp}`,
    }).expect(429);
  });
});
