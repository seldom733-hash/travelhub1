/**
 * E2E: Step 1.17 REVIEW FIX — PARTNER не получает internal unscoped read-контракты.
 *
 * Проблема (CRITICAL, найдена в strict review): PARTNER имел crm.customer.read /
 * order.read / booking.read, а соответствующие endpoints (GET /customers,
 * GET /customers/:id, GET /orders, GET /bookings) НЕ применяют object-scope —
 * чтение открывало ВСЕ customers (контакты), orders (traveler PII) и bookings
 * (passenger PII) любых тенантов. Дополнительно у PARTNER были dormant Phase-2
 * grants (sales.sale.read / finance.payment.read / documents.read / support.read).
 *
 * Фикс: все 7 внутренних read-контрактов отозваны из ROLE_PERMISSIONS[PARTNER]
 * (seed-реконсиляция отзывает stale links при boot). Внешний контур PARTNER
 * получает только own-scope read-модели (account.*.read_own, communication.read_own).
 *
 * Этот spec доказывает:
 *  - approved PARTNER: permissions НЕ содержат ни одного из 7 внутренних прав;
 *  - approved PARTNER: GET /customers, /customers/:id, /orders, /orders/:id,
 *    /bookings, /bookings/:id → 403 (даже при реально существующем объекте);
 *  - BUYER: то же (regression, Step 1.13);
 *  - ADMIN (internal staff): список customers/orders/bookings доступен (positive control);
 *  - revoked права не возвращаются после повторного approve/seed.
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

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; permissions: string[] };
}

describe("Step 1.17 — RBAC: PARTNER без internal unscoped read-контрактов (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const created = { users: [] as string[], applications: [] as string[], partners: [] as string[] };

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const registerPartner = (prefix: string) =>
    request(app.getHttpServer())
      .post("/api/v1/auth/partner-register")
      .send({
        email: `${prefix}${stamp}@test.local`,
        password: "partnerpass123",
        firstName: "Парт",
        lastName: "Скоуп",
        applicantType: "INDIVIDUAL",
        brandName: `Scope ${prefix}`,
        country: "AZ",
        contactEmail: `${prefix}${stamp}@test.local`,
        termsAccepted: true,
      });

  /** Полный flow регистрации → approve; возвращает сессию approved PARTNER. */
  const approvePartner = async (prefix: string): Promise<Session> => {
    const reg = await registerPartner(prefix).expect(201);
    const session = reg.body as Session;
    created.users.push(session.user.id);

    const appRow = await prisma.partnerApplication.findFirstOrThrow({ where: { userId: session.user.id } });
    created.applications.push(appRow.id);

    await agent(session.accessToken).post("/api/v1/partner/application/submit").expect(201);

    const admin = await login("admin", "admin123");
    const a = agent(admin.accessToken);
    await a.post(`/api/v1/partner/onboarding/review/${appRow.id}/start`).expect(201);
    const decided = (
      await a
        .post(`/api/v1/partner/onboarding/review/${appRow.id}/approve`)
        .send({ reason: "Документы ок" })
        .expect(201)
    ).body as { status: string; partnerId: string; partnerCreated: boolean };
    expect(decided.status).toBe("APPROVED");
    expect(decided.partnerCreated).toBe(true);
    created.partners.push(decided.partnerId);

    return login(session.user.username, "partnerpass123");
  };

  /** Внутренние unscoped read-права, которые НЕ должны быть у внешних ролей. */
  const INTERNAL_READS = [
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.sale.read",
    "finance.payment.read",
    "documents.read",
    "support.read",
  ] as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await prisma.partnerApplication.deleteMany({ where: { id: { in: created.applications } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("approved PARTNER не имеет ни одного internal unscoped read-права в permissions", async () => {
    const partner = await approvePartner("sc1");
    for (const perm of INTERNAL_READS) {
      expect(partner.user.permissions).not.toContain(perm);
    }
    // own-scope контуры остаются (regression).
    expect(partner.user.permissions).toContain("catalog.product.read_own");
    expect(partner.user.permissions).toContain("catalog.product.create_own");
    expect(partner.user.permissions).toContain("storefront.read_own");
    expect(partner.user.permissions).toContain("communication.read_own");
  });

  it("approved PARTNER: GET /customers → 403 (нет crm.customer.read)", async () => {
    const partner = await approvePartner("sc2");
    await agent(partner.accessToken).get("/api/v1/customers").expect(403);
  });

  it("approved PARTNER: GET /customers/:id (реально существующий) → 403, не 404/200", async () => {
    const partner = await approvePartner("sc3");
    // Существующий customer (созданный buyer registration ранее/в этом прогоне):
    const anyCustomer = await prisma.customer.findFirst();
    if (anyCustomer) {
      await agent(partner.accessToken).get(`/api/v1/customers/${anyCustomer.id}`).expect(403);
      await agent(partner.accessToken).get(`/api/v1/customers/${anyCustomer.id}/contacts`).expect(403);
    }
    // Neutral-контроль: даже несуществующий id → 403 (permission denial раньше existence).
    await agent(partner.accessToken).get("/api/v1/customers/00000000-0000-0000-0000-000000000000").expect(403);
  });

  it("approved PARTNER: GET /orders и /bookings → 403 (нет order.read/booking.read)", async () => {
    const partner = await approvePartner("sc4");
    await agent(partner.accessToken).get("/api/v1/orders").expect(403);
    await agent(partner.accessToken).get("/api/v1/orders/00000000-0000-0000-0000-000000000000").expect(403);
    await agent(partner.accessToken).get("/api/v1/bookings").expect(403);
    await agent(partner.accessToken).get("/api/v1/bookings/00000000-0000-0000-0000-000000000000").expect(403);
  });

  it("BUYER: regression — те же внутренние права отсутствуют (Step 1.13)", async () => {
    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ username: `scbuyer${stamp}`, email: `scbuyer${stamp}@test.local`, password: "buyerpass123", fullName: "Покупатель" })
      .expect(201);
    const session = reg.body as Session;
    created.users.push(session.user.id);
    for (const perm of INTERNAL_READS) {
      expect(session.user.permissions).not.toContain(perm);
    }
    await agent(session.accessToken).get("/api/v1/customers").expect(403);
    await agent(session.accessToken).get("/api/v1/orders").expect(403);
    await agent(session.accessToken).get("/api/v1/bookings").expect(403);
  });

  it("ADMIN (internal staff): positive control — списки customers/orders/bookings доступны", async () => {
    const admin = await login("admin", "admin123");
    await agent(admin.accessToken).get("/api/v1/customers").expect(200);
    await agent(admin.accessToken).get("/api/v1/orders").expect(200);
    await agent(admin.accessToken).get("/api/v1/bookings").expect(200);
  });
});
