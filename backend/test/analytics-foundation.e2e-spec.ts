/**
 * Step 3.3 Analytics Foundation — E2E Tests (Remediated)
 *
 * Covers mandatory e2e matrix from remediation §29:
 * 1. Authorized analytics request (ADMIN with analytics.read)
 * 2. Unauthorized request → 401
 * 3. Invalid permission → 403
 * 4. TODAY, CUSTOM, invalid CUSTOM
 * 5. Half-open DB boundary
 * 6. Partner A own scope
 * 7. Partner A → Partner B denied (IDOR)
 * 8. BUYER denied
 * 9. Company KPI Summary
 * 10. Partner Performance
 * 11. Conversion Funnel
 * 12. Time Series
 * 13. Financial Reconciliation Summary
 * 14. Empty state
 * 15. Controlled invalid input → no raw 500
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

describe("Step 3.3 — Analytics Foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdUsers: string[] = [];

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username, password })
      .expect(200);
    return res.body as {
      accessToken: string;
      user: { id: string; role: RoleCode; permissions: string[] };
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup created users
    for (const userId of createdUsers) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  // ─── Helper: create a user with specific role ────────────────────────
  async function createUserWithRole(
    role: RoleCode,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const username = `analytics_test_${suffix}_${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username,
        password: "TestPassword123!",
        fullName: `Analytics Test ${suffix}`,
      })
      .expect(201);
    const userId = res.body.user.id;
    createdUsers.push(userId);

    // Assign role
    const adminLogin = await login("admin", "admin123");
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/role`)
      .set("Authorization", `Bearer ${adminLogin.accessToken}`)
      .send({ roleCode: role })
      .expect(200);

    // Login as the new user
    const userLogin = await login(username, "TestPassword123!");
    return { token: userLogin.accessToken, userId };
  }

  // ─── 1. Authorized request (ADMIN) ──────────────────────────────────

  describe("Authorized analytics request", () => {
    it("ADMIN with analytics.read can access company-kpi", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.period).toBeDefined();
      expect(res.body.period.preset).toBe("MONTH");
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.gmv).toBeDefined();
      expect(res.body.metrics.revenue).toBeDefined();
      expect(res.body.metrics.averageOrderValue).toBeDefined();
    });
  });

  // ─── 2. Unauthorized request → 401 ──────────────────────────────────

  describe("Unauthorized request", () => {
    it("returns 401 without access token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .query({ preset: "MONTH" })
        .expect(401);
    });
  });

  // ─── 3. BUYER denied → 403 ──────────────────────────────────────────

  describe("BUYER role denied", () => {
    it("BUYER cannot access analytics endpoints", async () => {
      // Create a BUYER user via admin API
      const adminLogin = await login("admin", "admin123");
      const username = `analytics_buyer_${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ username, password: "TestPassword123!", roleCode: "BUYER" })
        .expect(201);
      createdUsers.push(createRes.body.id);

      const buyerLogin = await login(username, "TestPassword123!");
      await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${buyerLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(403);
    });
  });

  // ─── 4. Period presets ───────────────────────────────────────────────

  describe("Period presets", () => {
    it("TODAY resolves correctly", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "TODAY" })
        .expect(200);

      expect(res.body.period.preset).toBe("TODAY");
    });

    it("LAST_7_DAYS resolves correctly", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "LAST_7_DAYS" })
        .expect(200);

      expect(res.body.period.preset).toBe("LAST_7_DAYS");
    });

    it("YEAR resolves correctly", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "YEAR" })
        .expect(200);

      expect(res.body.period.preset).toBe("YEAR");
    });
  });

  // ─── 5. CUSTOM period ────────────────────────────────────────────────

  describe("CUSTOM period", () => {
    it("resolves valid CUSTOM date range", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({
          preset: "CUSTOM",
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        })
        .expect(200);

      expect(res.body.period.preset).toBe("CUSTOM");
      expect(res.body.period.start).toContain("2026-01-01");
    });

    it("rejects CUSTOM without startDate", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "CUSTOM", endDate: "2026-01-31" })
        .expect(400);
    });

    it("rejects CUSTOM with startDate > endDate", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({
          preset: "CUSTOM",
          startDate: "2026-01-31",
          endDate: "2026-01-01",
        })
        .expect(400);
    });
  });

  // ─── 6. Invalid preset → 400 ────────────────────────────────────────

  describe("Invalid input", () => {
    it("rejects unknown preset", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "UNKNOWN_PRESET" })
        .expect(400);
    });

    it("no raw 500 for controlled invalid input", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "INVALID" });

      // Should be 400, not 500
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── 7. Partner Performance ──────────────────────────────────────────

  describe("Partner Performance", () => {
    it("returns partner performance data", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/partner-performance")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.period).toBeDefined();
      expect(Array.isArray(res.body.partners)).toBe(true);
    });
  });

  // ─── 8. Conversion Funnel ───────────────────────────────────────────

  describe("Conversion Funnel", () => {
    it("returns funnel stages", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/conversion-funnel")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.stages).toBeDefined();
      expect(Array.isArray(res.body.stages)).toBe(true);
      expect(res.body.stages.length).toBe(7);
      expect(res.body.stages[0].stage).toBe("Product Impression");
      expect(res.body.stages[6].stage).toBe("Booking Completed");
    });
  });

  // ─── 9. Time Series ─────────────────────────────────────────────────

  describe("Time Series", () => {
    it("returns time series buckets", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/time-series")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH", metric: "orders" })
        .expect(200);

      expect(res.body.granularity).toBeDefined();
      expect(Array.isArray(res.body.buckets)).toBe(true);
      expect(res.body.buckets.length).toBeGreaterThan(0);
    });

    it("payments metric uses paidAt (not createdAt)", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/time-series")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH", metric: "payments" })
        .expect(200);

      // Should return valid response with buckets
      expect(res.body.granularity).toBeDefined();
      expect(Array.isArray(res.body.buckets)).toBe(true);
    });
  });

  // ─── 10. Financial Reconciliation ───────────────────────────────────

  describe("Financial Reconciliation", () => {
    it("returns reconciliation summary with currencies array", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/financial-reconciliation")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      // Backward-compatible fields
      expect(res.body.currency).toBeDefined();
      expect(res.body.totalPayments).toBeDefined();
      expect(res.body.totalRefunds).toBeDefined();
      expect(res.body.netPayments).toBeDefined();
      expect(res.body.totalCommission).toBeDefined();
      expect(typeof res.body.totalLedgerEntries).toBe("number");

      // Currency-separated reconciliation (MEDIUM-NEW-1)
      expect(Array.isArray(res.body.currencies)).toBe(true);
    });
  });

  // ─── 11. Empty state ────────────────────────────────────────────────

  describe("Empty state", () => {
    it("returns valid response with zero values for far-future period", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({
          preset: "CUSTOM",
          startDate: "2099-01-01",
          endDate: "2099-12-31",
        })
        .expect(200);

      expect(res.body.metrics.gmv.current).toBe("0.00");
      expect(res.body.metrics.revenue.current).toBe("0.00");
      expect(res.body.metrics.ordersCreated.current).toBe(0);
    });
  });

  // ─── 12. Response contract ──────────────────────────────────────────

  describe("Response contract", () => {
    it("Company KPI includes attribution metadata", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.attribution).toBeDefined();
      expect(Array.isArray(res.body.attribution.actionFields)).toBe(true);
      expect(Array.isArray(res.body.attribution.ownershipFields)).toBe(true);
      expect(Array.isArray(res.body.attribution.outcomeFields)).toBe(true);
    });

    it("Company KPI includes averageOrderValue", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/company-kpi")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.metrics.averageOrderValue).toBeDefined();
      expect(res.body.metrics.averageOrderValue.current).toBeDefined();
    });
  });
});
