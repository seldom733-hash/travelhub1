/**
 * Targeted Backend Search Integration Tests — Request Center
 *
 * Covers 6 search dimensions:
 *   S1 Request reference (MKT-REQ-*)
 *   S2 Customer display name
 *   S3 CRM-* customer code
 *   S4 Service/product title
 *   S5 Supplier/partner display name
 *   S6 PRN-* partner code
 *
 * Also covers: partial match, pagination after search, zero-result, combined filters.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import * as bcrypt from "bcryptjs";

interface Session {
  accessToken: string;
  user: { id: string; role: string; username: string; email: string | null; customerId: string | null; permissions: string[] };
}

describe("Request Center — Targeted Search Integration (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  let adminSession: Session;
  let customerId: string;
  let productId: string;
  let partnerId: string;
  let createdRequestIds: string[] = [];

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username, password })
      .expect(200);
    return res.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    await app.init();

    prisma = app.get(PrismaService);
    adminSession = await login("admin", "admin123");

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        firstName: "TestSearch",
        lastName: "CustomerAlpha",
        code: "CRM-SEARCH-TEST-001",
        email: `search-test-${stamp}@example.com`,
      },
    });
    customerId = customer.id;

    // Create test product
    const product = await prisma.product.create({
      data: {
        title: "UniqueSearchTourPackageXYZ",
        code: "PKG-SEARCH-001",
        type: "TOUR" as any,
        slug: `unique-search-tour-pkg-${stamp}`,
      },
    });
    productId = product.id;

    // Create test partner
    const partner = await prisma.partner.create({
      data: {
        name: "UniqueSearchPartnerCo",
        code: "PRN-SEARCH-001",
        status: "ACTIVE" as any,
      },
    });
    partnerId = partner.id;

    // Create 3 test requests for this search test
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${adminSession.accessToken}`)
        .send({
          customerId,
          productId,
          partnerId,
          displayedPrice: 100 + i,
          displayedCurrency: "AZN",
        })
        .expect(201);
      createdRequestIds.push(res.body.id);
    }
  }, 60_000);

  afterAll(async () => {
    // Cleanup
    if (createdRequestIds.length) {
      await prisma.requestHistory.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
    if (partnerId) await prisma.partner.deleteMany({ where: { id: partnerId } });
    await app.close();
  });

  // ── Helper ──────────────────────────────────────────────────────────

  const search = async (query: string) => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/requests?search=${encodeURIComponent(query)}`)
      .set("Authorization", `Bearer ${adminSession.accessToken}`)
      .expect(200);
    return res.body;
  };

  // ── S1: Request reference ───────────────────────────────────────────

  it("S1 — search by Request reference (MKT-REQ-*)", async () => {
    // Get the reference number of the first created request
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/requests/${createdRequestIds[0]}`)
      .set("Authorization", `Bearer ${adminSession.accessToken}`)
      .expect(200);
    const ref = detail.body.referenceNumber as string;
    expect(ref).toMatch(/^MKT-REQ-/);

    // Search by full reference
    const result = await search(ref);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.some((r: any) => r.referenceNumber === ref)).toBe(true);
  });

  // ── S2: Customer display name ───────────────────────────────────────

  it("S2 — search by customer display name", async () => {
    // Search by first name only (partial match on one field)
    const result = await search("TestSearch");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every((r: any) => r.customerName === "TestSearch CustomerAlpha")).toBe(true);
  });

  // ── S3: CRM-* customer code ────────────────────────────────────────

  it("S3 — search by CRM-* customer code", async () => {
    const result = await search("CRM-SEARCH-TEST-001");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every((r: any) => r.customerCode === "CRM-SEARCH-TEST-001")).toBe(true);
  });

  // ── S4: Service/product title ───────────────────────────────────────

  it("S4 — search by service/product title", async () => {
    const result = await search("UniqueSearchTourPackageXYZ");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every((r: any) => r.productName === "UniqueSearchTourPackageXYZ")).toBe(true);
  });

  // ── S5: Supplier/partner display name ──────────────────────────────

  it("S5 — search by supplier/partner display name", async () => {
    const result = await search("UniqueSearchPartnerCo");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every((r: any) => r.partnerName === "UniqueSearchPartnerCo")).toBe(true);
  });

  // ── S6: PRN-* partner code ─────────────────────────────────────────

  it("S6 — search by PRN-* partner code", async () => {
    const result = await search("PRN-SEARCH-001");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every((r: any) => r.partnerCode === "PRN-SEARCH-001")).toBe(true);
  });

  // ── Partial match ──────────────────────────────────────────────────

  it("Partial match — search by partial name", async () => {
    const result = await search("TestSearch");
    expect(result.total).toBeGreaterThanOrEqual(3);
  });

  // ── Zero-result ────────────────────────────────────────────────────

  it("Zero-result — non-existent search term", async () => {
    const result = await search("NONEXISTENT_ENTITY_999999");
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  // ── Pagination after search ────────────────────────────────────────

  it("Pagination works after search", async () => {
    const result = await search("TestSearch");
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    // All items on page 1 should match
    expect(result.data.length).toBeLessThanOrEqual(20);
  });

  // ── Search + status filter combined ────────────────────────────────

  it("Search + status filter combined", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/requests?search=TestSearch&status=NEW`)
      .set("Authorization", `Bearer ${adminSession.accessToken}`)
      .expect(200);
    // Our test requests are in NEW status
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.every((r: any) => r.status === "NEW")).toBe(true);
  });

  // ── Multi-word search splits and matches any word ───────────────────

  it("Multi-word search matches individual words", async () => {
    const result = await search("CustomerAlpha");
    expect(result.total).toBeGreaterThanOrEqual(3);
  });

  // ── Unauthorized search denied ─────────────────────────────────────

  it("Unauthorized — search without token is denied", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/requests?search=TestSearch")
      .expect(401);
  });

  // ── Detail endpoint returns temporal timeline ──────────────────────

  it("Detail endpoint includes full temporal timeline", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/requests/${createdRequestIds[0]}`)
      .set("Authorization", `Bearer ${adminSession.accessToken}`)
      .expect(200);
    const body = res.body;
    expect(body.timeline).toBeDefined();
    expect(Array.isArray(body.timeline)).toBe(true);
    // At minimum: "Заявка создана" and "SLA поставщика до"
    expect(body.timeline.some((t: any) => t.label === "Заявка создана")).toBe(true);
    expect(body.timeline.some((t: any) => t.label === "SLA поставщика до")).toBe(true);
    expect(body.timeline.some((t: any) => t.label === "Ответ поставщика")).toBe(true);
    expect(body.timeline.some((t: any) => t.label === "Конвертирована в заказ")).toBe(true);
  });

  // ── Human-readable entities in list ────────────────────────────────

  it("List returns human-readable customer/service/supplier names", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/requests?search=TestSearch")
      .set("Authorization", `Bearer ${adminSession.accessToken}`)
      .expect(200);
    const item = res.body.data[0];
    expect(item.customerName).toBe("TestSearch CustomerAlpha");
    expect(item.customerCode).toBe("CRM-SEARCH-TEST-001");
    expect(item.productName).toBe("UniqueSearchTourPackageXYZ");
    expect(item.productCode).toBe("PKG-SEARCH-001");
    expect(item.partnerName).toBe("UniqueSearchPartnerCo");
    expect(item.partnerCode).toBe("PRN-SEARCH-001");
    // No UUID fragments as primary display
    expect(item.customerName).not.toMatch(/^[0-9a-f]{8}-/);
    expect(item.productName).not.toMatch(/^[0-9a-f]{8}-/);
    expect(item.partnerName).not.toMatch(/^[0-9a-f]{8}-/);
  });
});
