/**
 * Phase 3 — Global Workspace Constructor Foundation — E2E Tests
 *
 * HTTP/API e2e tests with guards and DB persistence.
 * Covers:
 *   W3: API/Security — auth, own workspace, save, reset, disabled constructor,
 *       forbidden widgets, required widget restoration, cross-user mutation,
 *       partner scope.
 *   W2: Persistence — create/upsert/uniqueness/delete.
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
import type { WidgetPosition } from "../src/modules/workspace/workspace.types";

describe("Phase 3 — Workspace Constructor Foundation (e2e)", () => {
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
    // Cleanup workspace layouts
    await prisma.userWorkspaceLayout.deleteMany({});
    for (const userId of createdUsers) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  async function createUserWithRole(
    role: RoleCode,
    suffix: string,
  ): Promise<{ token: string; userId: string; username: string }> {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 6);
    const username = `ws_${suffix.slice(0, 12)}_${ts}_${rnd}`.slice(0, 50);
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username,
        email: `${username}@test.example.com`,
        password: "TestPassword123!",
        fullName: `WS Test ${suffix}`,
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
    return { token: userLogin.accessToken, userId, username };
  }

  // ─── 1. Unauthenticated → 401 ──────────────────────────────────────

  describe("Authentication", () => {
    it("returns 401 without access token (GET)", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .expect(401);
    });

    it("returns 401 without access token (PUT)", async () => {
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .send({ widgets: [] })
        .expect(401);
    });

    it("returns 401 without access token (DELETE)", async () => {
      await request(app.getHttpServer())
        .delete("/api/v1/workspaces/command-center/layout")
        .expect(401);
    });

    it("returns 401 without access token (Widgets GET)", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .expect(401);
    });
  });

  // ─── 2. Unknown page → 404 ─────────────────────────────────────────

  describe("Unknown page", () => {
    it("returns 404 for nonexistent pageId", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .get("/api/v1/workspaces/nonexistent")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(404);
    });
  });

  // ─── 3. Effective layout (command-center, ADMIN) ────────────────────

  describe("Effective layout", () => {
    it("ADMIN gets effective layout for command-center", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(res.body.pageId).toBe("command-center");
      expect(res.body.constructorEnabled).toBe(true);
      expect(res.body.layoutVersion).toBe(1);
      expect(Array.isArray(res.body.widgets)).toBe(true);
      expect(res.body.widgets.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.availableWidgets)).toBe(true);
    });

    it("includes required reconciliation widget", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      const widgetIds = res.body.widgets.map((w: WidgetPosition) => w.widgetId);
      expect(widgetIds).toContain("reconciliation");
    });
  });

  // ─── 4. Available widgets ───────────────────────────────────────────

  describe("Available widgets", () => {
    it("returns widgets for command-center", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      for (const w of res.body) {
        expect(w.widgetId).toBeDefined();
        expect(w.pageIds).toContain("command-center");
      }
    });
  });

  // ─── 5. Save layout ────────────────────────────────────────────────

  describe("Save layout", () => {
    it("saves a valid layout via PUT", async () => {
      const adminLogin = await login("admin", "admin123");
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
        { widgetId: "revenue", x: 1, y: 0, w: 1, h: 1, visible: true },
      ];

      const res = await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets })
        .expect(200);

      expect(res.body.pageId).toBe("command-center");
      const savedIds = res.body.widgets.map((w: WidgetPosition) => w.widgetId);
      expect(savedIds).toContain("gmv");
      expect(savedIds).toContain("revenue");
    });

    it("upserts: second save replaces the first (idempotent)", async () => {
      const adminLogin = await login("admin", "admin123");
      const widgets1: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];
      const widgets2: WidgetPosition[] = [
        { widgetId: "revenue", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];

      await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets: widgets1 })
        .expect(200);

      const res = await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets: widgets2 })
        .expect(200);

      const savedIds = res.body.widgets.map((w: WidgetPosition) => w.widgetId);
      expect(savedIds).toContain("revenue");
    });

    it("restores required widget when omitted from save", async () => {
      const adminLogin = await login("admin", "admin123");
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];

      const res = await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets })
        .expect(200);

      const savedIds = res.body.widgets.map((w: WidgetPosition) => w.widgetId);
      expect(savedIds).toContain("reconciliation");
    });

    it("sanitizes unknown widgetId from layout", async () => {
      const adminLogin = await login("admin", "admin123");
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
        {
          widgetId: "nonexistent-widget-xyz",
          x: 1,
          y: 0,
          w: 1,
          h: 1,
          visible: true,
        },
      ];

      const res = await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets })
        .expect(200);

      const savedIds = res.body.widgets.map((w: WidgetPosition) => w.widgetId);
      expect(savedIds).not.toContain("nonexistent-widget-xyz");
      expect(savedIds).toContain("gmv");
    });
  });

  // ─── 6. Disabled constructor (CRM) ─────────────────────────────────

  describe("Disabled constructor", () => {
    it("returns effective layout with constructorEnabled=false", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/crm")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(res.body.constructorEnabled).toBe(false);
    });

    it("rejects save for disabled constructor page", async () => {
      const adminLogin = await login("admin", "admin123");
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/crm/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({ widgets: [] })
        .expect(403);
    });
  });

  // ─── 7. Reset layout ───────────────────────────────────────────────

  describe("Reset layout", () => {
    it("resets user layout to default (idempotent)", async () => {
      const adminLogin = await login("admin", "admin123");

      // Save a custom layout first
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({
          widgets: [
            { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
          ],
        })
        .expect(200);

      // Reset
      const res = await request(app.getHttpServer())
        .delete("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(res.body.pageId).toBe("command-center");
      // After reset, should get default layout
      expect(res.body.widgets.length).toBeGreaterThanOrEqual(1);
    });

    it("idempotent: reset without saved layout returns default", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .delete("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(res.body.pageId).toBe("command-center");
      expect(res.body.widgets.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 8. Cross-user isolation ───────────────────────────────────────

  describe("Cross-user isolation", () => {
    it("user A cannot see user B's saved layout", async () => {
      const { token: tokenA } = await createUserWithRole(
        RoleCode.ADMIN,
        "ws_isolation_a",
      );
      const { token: tokenB } = await createUserWithRole(
        RoleCode.ADMIN,
        "ws_isolation_b",
      );

      // User A saves custom layout
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          widgets: [
            { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
            { widgetId: "revenue", x: 1, y: 0, w: 1, h: 1, visible: true },
          ],
        })
        .expect(200);

      // User B gets default layout (not A's)
      const resB = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);

      // B's layout should be the system default (10 widgets for command-center)
      expect(resB.body.widgets.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ─── 9. RBAC filtering + Step 3.2 page gate ─────────────────────────

  describe("RBAC filtering + page gate", () => {
    it("BUYER without analytics.read gets 403 on GET command-center", async () => {
      const { token: buyerToken } = await createUserWithRole(
        RoleCode.BUYER,
        "ws_rbac_buyer",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${buyerToken}`)
        .expect(403);
    });

    it("BUYER without analytics.read gets 403 on GET command-center/widgets", async () => {
      const { token: buyerToken } = await createUserWithRole(
        RoleCode.BUYER,
        "ws_rbac_buyer_w",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${buyerToken}`)
        .expect(403);
    });

    it("FINANCE without analytics.read gets 403 on GET command-center", async () => {
      const { token: financeToken } = await createUserWithRole(
        RoleCode.FINANCE,
        "ws_rbac_finance",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${financeToken}`)
        .expect(403);
    });

    it("PARTNER without analytics.read gets 403 on GET command-center", async () => {
      const { token: partnerToken } = await createUserWithRole(
        RoleCode.PARTNER,
        "ws_rbac_partner",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${partnerToken}`)
        .expect(403);
    });

    it("ADMIN with analytics.read gets 200 on GET command-center/widgets", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("MARKETER with analytics.read gets 200 on GET command-center", async () => {
      const { token: marketerToken } = await createUserWithRole(
        RoleCode.MARKETER,
        "ws_rbac_marketer",
      );

      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${marketerToken}`)
        .expect(200);

      expect(res.body.pageId).toBe("command-center");
      expect(res.body.constructorEnabled).toBe(true);
    });

    it("MARKETER with analytics.read gets 200 on GET command-center/widgets", async () => {
      const { token: marketerToken } = await createUserWithRole(
        RoleCode.MARKETER,
        "ws_rbac_marketer_w",
      );

      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${marketerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("FINANCE without analytics.read gets 403 on GET command-center/widgets", async () => {
      const { token: financeToken } = await createUserWithRole(
        RoleCode.FINANCE,
        "ws_rbac_finance_w",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${financeToken}`)
        .expect(403);
    });

    it("PARTNER without analytics.read gets 403 on GET command-center/widgets", async () => {
      const { token: partnerToken } = await createUserWithRole(
        RoleCode.PARTNER,
        "ws_rbac_partner_w",
      );

      await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center/widgets")
        .set("Authorization", `Bearer ${partnerToken}`)
        .expect(403);
    });

    it("FINANCE with persisted analytics.read grant gets 200 on GET", async () => {
      const { username } = await createUserWithRole(
        RoleCode.FINANCE,
        "ws_fin_grant",
      );

      // Create persisted grant: FINANCE → analytics.read
      const financeRole = await prisma.role.findUnique({ where: { code: RoleCode.FINANCE } });
      const analyticsPerm = await prisma.permission.findUnique({ where: { code: "analytics.read" } });
      let grantCreated = false;
      try {
        await prisma.rolePermission.create({
          data: { roleId: financeRole!.id, permissionId: analyticsPerm!.id },
        });
        grantCreated = true;

        // Re-login to get updated permissions
        const newLogin = await login(username, "TestPassword123!");
        const res = await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(200);

        expect(res.body.pageId).toBe("command-center");

        // Also verify Widgets GET returns 200
        const wRes = await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center/widgets")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(200);

        expect(Array.isArray(wRes.body)).toBe(true);
      } finally {
        // Cleanup: remove persisted grant
        if (grantCreated) {
          await prisma.rolePermission.delete({
            where: { roleId_permissionId: { roleId: financeRole!.id, permissionId: analyticsPerm!.id } },
          }).catch(() => {});
        }
      }
    });

    it("after removing persisted grant, GET returns 403 again", async () => {
      const { userId, username } = await createUserWithRole(
        RoleCode.FINANCE,
        "ws_fin_revoke",
      );

      const financeRole = await prisma.role.findUnique({ where: { code: RoleCode.FINANCE } });
      const analyticsPerm = await prisma.permission.findUnique({ where: { code: "analytics.read" } });
      let grantCreated = false;
      try {
        await prisma.rolePermission.create({
          data: { roleId: financeRole!.id, permissionId: analyticsPerm!.id },
        });
        grantCreated = true;

        // Re-login — should now have analytics.read
        const newLogin = await login(username, "TestPassword123!");
        await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center/widgets")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(200);

        // Remove the grant
        await prisma.rolePermission.delete({
          where: { roleId_permissionId: { roleId: financeRole!.id, permissionId: analyticsPerm!.id } },
        });
        grantCreated = false;

        // Re-login — should lose access on BOTH endpoints
        const revokedLogin = await login(username, "TestPassword123!");
        await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center")
          .set("Authorization", `Bearer ${revokedLogin.accessToken}`)
          .expect(403);
        await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center/widgets")
          .set("Authorization", `Bearer ${revokedLogin.accessToken}`)
          .expect(403);
      } finally {
        if (grantCreated) {
          await prisma.rolePermission.delete({
            where: { roleId_permissionId: { roleId: financeRole!.id, permissionId: analyticsPerm!.id } },
          }).catch(() => {});
        }
      }
    });

    it("user with analytics.read but no dashboard.customize gets 403 on PUT/DELETE", async () => {
      const { username } = await createUserWithRole(
        RoleCode.FINANCE,
        "ws_nocustom",
      );

      const financeRole = await prisma.role.findUnique({ where: { code: RoleCode.FINANCE } });
      const analyticsPerm = await prisma.permission.findUnique({ where: { code: "analytics.read" } });
      let grantCreated = false;
      try {
        await prisma.rolePermission.create({
          data: { roleId: financeRole!.id, permissionId: analyticsPerm!.id },
        });
        grantCreated = true;

        const newLogin = await login(username, "TestPassword123!");

        // GET should work (has analytics.read)
        await request(app.getHttpServer())
          .get("/api/v1/workspaces/command-center")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(200);

        // PUT should fail (no dashboard.customize)
        await request(app.getHttpServer())
          .put("/api/v1/workspaces/command-center/layout")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .send({ widgets: [{ widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true }] })
          .expect(403);

        // DELETE should fail (no dashboard.customize)
        await request(app.getHttpServer())
          .delete("/api/v1/workspaces/command-center/layout")
          .set("Authorization", `Bearer ${newLogin.accessToken}`)
          .expect(403);
      } finally {
        if (grantCreated) {
          await prisma.rolePermission.delete({
            where: { roleId_permissionId: { roleId: financeRole!.id, permissionId: analyticsPerm!.id } },
          }).catch(() => {});
        }
      }
    });
  });

  // ─── 10. Different pages ───────────────────────────────────────────

  describe("Different pages", () => {
    it("analytics page returns its own layout", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/analytics")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(res.body.pageId).toBe("analytics");
      expect(res.body.constructorEnabled).toBe(true);
    });

    it("saves and reads independently for different pages", async () => {
      const adminLogin = await login("admin", "admin123");

      // Save to command-center
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/command-center/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({
          widgets: [
            { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
          ],
        })
        .expect(200);

      // Save to analytics
      await request(app.getHttpServer())
        .put("/api/v1/workspaces/analytics/layout")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .send({
          widgets: [
            {
              widgetId: "kpi-summary",
              x: 0,
              y: 0,
              w: 4,
              h: 1,
              visible: true,
            },
          ],
        })
        .expect(200);

      // Read each — independent
      const cc = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      const analytics = await request(app.getHttpServer())
        .get("/api/v1/workspaces/analytics")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(cc.body.pageId).toBe("command-center");
      expect(analytics.body.pageId).toBe("analytics");
    });
  });

  // ─── 11. Version mismatch ──────────────────────────────────────────

  describe("Version handling", () => {
    it("returns current layoutVersion in effective layout", async () => {
      const adminLogin = await login("admin", "admin123");
      const res = await request(app.getHttpServer())
        .get("/api/v1/workspaces/command-center")
        .set("Authorization", `Bearer ${adminLogin.accessToken}`)
        .expect(200);

      expect(typeof res.body.layoutVersion).toBe("number");
      expect(res.body.layoutVersion).toBeGreaterThanOrEqual(1);
    });
  });
});
