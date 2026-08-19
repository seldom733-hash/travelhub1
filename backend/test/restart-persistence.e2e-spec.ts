/**
 * Step 3.2 — DB-Backed Restart Persistence Tests (Round 3)
 *
 * Each test is SELF-CONTAINED with its own try/finally cleanup.
 * Tests do NOT depend on execution order.
 * afterAll only closes the app — no fixture restoration there.
 *
 * Uses real PrismaService against isolated test database (travelhub1_test).
 */

import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SecurityService } from "../src/security/security.service";
import { RoleCode } from "../src/generated/prisma/enums";

describe("Step 3.2 — DB-Backed Restart Persistence (Round 3)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let securityService: SecurityService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    securityService = moduleRef.get(SecurityService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Helpers ──────────────────────────────────────────────────────

  async function findRolePermission(
    roleCode: RoleCode,
    permissionCode: string,
  ): Promise<boolean> {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    const perm = await prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!role || !perm) return false;
    const link = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
    });
    return link !== null;
  }

  async function getRolePermissionIds(
    roleCode: RoleCode,
  ): Promise<{ roleId: string; permissionIds: Set<string> }> {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { select: { permissionId: true } } },
    });
    return {
      roleId: role!.id,
      permissionIds: new Set(role!.permissions.map((p) => p.permissionId)),
    };
  }

  // ─── Test A: revoke MARKETER default → stays revoked ──────────────

  it("Test A: revoked MARKETER → dashboard.marketplace.read stays revoked after onModuleInit()", async () => {
    const role = await prisma.role.findUnique({
      where: { code: RoleCode.MARKETER },
    });
    const perm = await prisma.permission.findUnique({
      where: { code: "dashboard.marketplace.read" },
    });
    const compositeKey = { roleId: role!.id, permissionId: perm!.id };

    // Ensure baseline: link exists
    const existedBefore = await findRolePermission(
      RoleCode.MARKETER,
      "dashboard.marketplace.read",
    );
    expect(existedBefore).toBe(true);

    try {
      // Delete the link
      await prisma.rolePermission.delete({
        where: { roleId_permissionId: compositeKey },
      });

      // Verify deleted
      expect(
        await findRolePermission(RoleCode.MARKETER, "dashboard.marketplace.read"),
      ).toBe(false);

      // Run startup seed
      await securityService.onModuleInit();

      // Verify still deleted — seed must NOT restore it
      expect(
        await findRolePermission(RoleCode.MARKETER, "dashboard.marketplace.read"),
      ).toBe(false);
    } finally {
      // Restore baseline — re-create the link if it was missing
      const stillMissing = !(await findRolePermission(
        RoleCode.MARKETER,
        "dashboard.marketplace.read",
      ));
      if (stillMissing) {
        await prisma.rolePermission
          .create({ data: compositeKey })
          .catch(() => {});
      }
    }

    // Assert baseline restored after finally
    expect(
      await findRolePermission(RoleCode.MARKETER, "dashboard.marketplace.read"),
    ).toBe(true);
  });

  // ─── Test B: extra grant FINANCE → analytics.read survives ────────

  it("Test B: FINANCE → analytics.read extra grant survives onModuleInit()", async () => {
    const role = await prisma.role.findUnique({
      where: { code: RoleCode.FINANCE },
    });
    const perm = await prisma.permission.findUnique({
      where: { code: "analytics.read" },
    });
    const compositeKey = { roleId: role!.id, permissionId: perm!.id };

    // Ensure baseline: link does NOT exist
    const existedBefore = await findRolePermission(
      RoleCode.FINANCE,
      "analytics.read",
    );
    expect(existedBefore).toBe(false);

    try {
      // Create the extra grant
      await prisma.rolePermission.create({ data: compositeKey });

      // Verify created
      expect(
        await findRolePermission(RoleCode.FINANCE, "analytics.read"),
      ).toBe(true);

      // Run startup seed
      await securityService.onModuleInit();

      // Verify still present — seed must NOT delete it
      expect(
        await findRolePermission(RoleCode.FINANCE, "analytics.read"),
      ).toBe(true);
    } finally {
      // Cleanup: remove the extra grant if it still exists
      const stillPresent = await findRolePermission(
        RoleCode.FINANCE,
        "analytics.read",
      );
      if (stillPresent) {
        await prisma.rolePermission
          .delete({ where: { roleId_permissionId: compositeKey } })
          .catch(() => {});
      }
    }

    // Assert baseline restored after finally
    expect(
      await findRolePermission(RoleCode.FINANCE, "analytics.read"),
    ).toBe(false);
  });

  // ─── Test C: repeated startup is idempotent ───────────────────────

  it("Test C: repeated onModuleInit() does not change RolePermission state", async () => {
    // Snapshot exact baseline for ALL roles
    const baseline = new Map<string, Set<string>>();
    for (const code of Object.values(RoleCode)) {
      const { permissionIds } = await getRolePermissionIds(code);
      baseline.set(code, permissionIds);
    }

    // Run onModuleInit 3 times
    await securityService.onModuleInit();
    await securityService.onModuleInit();
    await securityService.onModuleInit();

    // Verify exact equality for every role
    for (const code of Object.values(RoleCode)) {
      const { permissionIds } = await getRolePermissionIds(code);
      const before = baseline.get(code)!;
      expect(permissionIds.size).toBe(before.size);
      for (const pid of before) {
        expect(permissionIds.has(pid)).toBe(true);
      }
    }
  });

  // ─── Test D: all dashboard permissions exist ──────────────────────

  it("Test D: all 5 dashboard permission codes exist in Permission catalog", async () => {
    const dashboardPerms = [
      "dashboard.executive.read",
      "dashboard.operational.read",
      "dashboard.financial.read",
      "dashboard.marketplace.read",
      "dashboard.customize",
    ];

    for (const code of dashboardPerms) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      expect(perm).not.toBeNull();
      expect(perm!.code).toBe(code);
    }
  });

  // ─── Test E: MARKETER dashboard defaults (order-independent) ──────

  it("Test E: MARKETER has full expected dashboard default set", async () => {
    const marketerPerms = await getRolePermissionIds(RoleCode.MARKETER);
    const allPerms = await prisma.permission.findMany();
    const permCodeMap = new Map(allPerms.map((p) => [p.id, p.code]));

    const marketerCodes = new Set(
      Array.from(marketerPerms.permissionIds).map((id) => permCodeMap.get(id)),
    );

    // Expected MARKETER dashboard defaults
    expect(marketerCodes).toContain("dashboard.executive.read");
    expect(marketerCodes).toContain("dashboard.marketplace.read");
    expect(marketerCodes).toContain("dashboard.customize");

    // Should NOT have these
    expect(marketerCodes).not.toContain("dashboard.operational.read");
    expect(marketerCodes).not.toContain("dashboard.financial.read");
  });
});
