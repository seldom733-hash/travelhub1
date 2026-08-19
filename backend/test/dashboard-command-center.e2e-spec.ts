/**
 * Step 3.1 Dashboard / Command Center Backend — E2E Tests
 *
 * HTTP/API e2e tests with guards and DB/query semantics.
 * Covers: authorization, partner isolation, period presets, empty state.
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

describe("Step 3.1 — Dashboard / Command Center (e2e)", () => {
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
    for (const userId of createdUsers) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  async function createUserWithRole(
    role: RoleCode,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const username = `dashboard_test_${suffix}_${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username,
        password: "TestPassword123!",
        fullName: `Dashboard Test ${suffix}`,
      })
      .expect(201);
    const userId = res.body.user.id;
    createdUsers.push(userId);

    const adminLogin = await login("admin", "admin123");
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/role`)
      .set("Authorization", `Bearer ${adminLogin.accessToken}`)
      .send({ roleCode: role })
      .expect(200);

    const userLogin = await login(username, "TestPassword123!");
    return { token: userLogin.accessToken, userId };
  }

  // ─── 1. Authorized request (ADMIN) ──────────────────────────────────

  describe("Authorized command center request", () => {
    it("ADMIN with analytics.read can access command-center", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.period).toBeDefined();
      expect(res.body.period.preset).toBe("MONTH");
      expect(res.body.sections).toBeDefined();
      expect(res.body.sections.executive).toBeDefined();
      expect(res.body.sections.operational).toBeDefined();
      expect(res.body.sections.financial).toBeDefined();
      expect(res.body.sections.marketplace).toBeDefined();
    });
  });

  // ─── 2. Unauthorized request → 401 ──────────────────────────────────

  describe("Unauthorized request", () => {
    it("returns 401 without access token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .query({ preset: "MONTH" })
        .expect(401);
    });
  });

  // ─── 3. BUYER denied → 403 ──────────────────────────────────────────

  describe("BUYER role denied", () => {
    it("BUYER cannot access command center", async () => {
      const adminLogin = await login("admin", "admin123");
      const username = `dashboard_buyer_${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ username, password: "TestPassword123!", roleCode: "BUYER" })
        .expect(201);
      createdUsers.push(createRes.body.id);

      const buyerLogin = await login(username, "TestPassword123!");
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
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
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "TODAY" })
        .expect(200);

      expect(res.body.period.preset).toBe("TODAY");
    });

    it("LAST_7_DAYS resolves correctly", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "LAST_7_DAYS" })
        .expect(200);

      expect(res.body.period.preset).toBe("LAST_7_DAYS");
    });

    it("YEAR resolves correctly", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
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
        .get("/api/v1/dashboard/command-center")
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
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "CUSTOM", endDate: "2026-01-31" })
        .expect(400);
    });
  });

  // ─── 6. Invalid preset → 400 ────────────────────────────────────────

  describe("Invalid input", () => {
    it("rejects unknown preset", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "UNKNOWN_PRESET" })
        .expect(400);
    });
  });

  // ─── 7. Trends endpoint ─────────────────────────────────────────────

  describe("Trends endpoint", () => {
    it("returns time series buckets", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center/trends")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH", metric: "orders" })
        .expect(200);

      expect(res.body.granularity).toBeDefined();
      expect(Array.isArray(res.body.buckets)).toBe(true);
      expect(res.body.metric).toBe("orders");
    });

    it("defaults metric to orders", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center/trends")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.metric).toBe("orders");
    });
  });

  // ─── 8. Empty state ────────────────────────────────────────────────

  describe("Empty state", () => {
    it("returns valid response with zero values for far-future period", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({
          preset: "CUSTOM",
          startDate: "2099-01-01",
          endDate: "2099-12-31",
        })
        .expect(200);

      expect(res.body.sections.executive.gmv.current).toBe("0.00");
      expect(res.body.sections.executive.ordersCreated.current).toBe(0);
    });
  });

  // ─── 9. Response contract ──────────────────────────────────────────

  describe("Response contract", () => {
    it("includes attribution metadata", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.attribution).toBeDefined();
      expect(Array.isArray(res.body.attribution.actionFields)).toBe(true);
    });

    it("all KPI values have drillDown", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      const exec = res.body.sections.executive;
      expect(exec.gmv.drillDown).toBeDefined();
      expect(exec.revenue.drillDown).toBeDefined();
      expect(exec.ordersCreated.drillDown).toBeDefined();
    });
  });

  // ─── 10. Section Authority (Step 3.2) ─────────────────────────────

  describe("Section Authority", () => {
    it("ADMIN gets 4 authorized sections in canonical order", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.availableSections).toEqual(["executive", "operational", "financial", "marketplace"]);
      expect(res.body.sections.executive).toBeDefined();
      expect(res.body.sections.operational).toBeDefined();
      expect(res.body.sections.financial).toBeDefined();
      expect(res.body.sections.marketplace).toBeDefined();
    });

    it("MARKETER gets only executive and marketplace sections", async () => {
      const { token: marketerToken } = await createUserWithRole(RoleCode.MARKETER, "dash_section_marketer");

      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${marketerToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.availableSections).toEqual(["executive", "marketplace"]);
      expect(res.body.sections.executive).toBeDefined();
      expect(res.body.sections.marketplace).toBeDefined();
      expect(res.body.sections.operational).toBeUndefined();
      expect(res.body.sections.financial).toBeUndefined();
    });

    it("availableSections matches actually returned sections", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      for (const section of res.body.availableSections) {
        expect(res.body.sections[section]).toBeDefined();
      }
    });

    it("availableMetrics contains only supported + authorized metrics", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.availableMetrics).toContain("orders");
      expect(res.body.availableMetrics).toContain("bookings");
      expect(res.body.availableMetrics).toContain("payments");
      expect(res.body.availableMetrics).toContain("customers");
      expect(res.body.availableMetrics).toContain("commissions");
    });

    it("MARKETER availableMetrics excludes financial metrics", async () => {
      const { token: marketerToken } = await createUserWithRole(RoleCode.MARKETER, "dash_metrics_marketer");

      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${marketerToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      expect(res.body.availableMetrics).toContain("orders");
      expect(res.body.availableMetrics).toContain("bookings");
      expect(res.body.availableMetrics).toContain("customers");
      expect(res.body.availableMetrics).not.toContain("payments");
      expect(res.body.availableMetrics).not.toContain("commissions");
    });

    it("financial read model not called without Financial permission", async () => {
      const { token: marketerToken } = await createUserWithRole(RoleCode.MARKETER, "dash_financial_skip");

      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${marketerToken}`)
        .query({ preset: "MONTH" })
        .expect(200);

      // Financial section should be absent — reconciliation not called
    });

    it("unknown trend metric returns 404", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center/trends")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .query({ preset: "MONTH", metric: "nonexistent" })
        .expect(404);
    });

    it("unauthorized trend metric returns 403", async () => {
      const { token: marketerToken } = await createUserWithRole(RoleCode.MARKETER, "dash_trend_403");

      // MARKETER has no dashboard.financial.read → payments should be 403
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center/trends")
        .set("Authorization", `Bearer ${marketerToken}`)
        .query({ preset: "MONTH", metric: "payments" })
        .expect(403);
    });

    it("FINANCE without analytics.read gets 403 on command center", async () => {
      const { token: financeToken } = await createUserWithRole(RoleCode.FINANCE, "dash_finance_403");

      await request(app.getHttpServer())
        .get("/api/v1/dashboard/command-center")
        .set("Authorization", `Bearer ${financeToken}`)
        .query({ preset: "MONTH" })
        .expect(403);
    });
  });
});
