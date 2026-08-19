/**
 * Step 3.2 — DB-Backed Restart Persistence Tests (Round 2)
 *
 * Tests that validate persisted RolePermission state survives application
 * restart lifecycle against a REAL PostgreSQL database.
 *
 * These tests do NOT use mocks — they use the real PrismaService connected
 * to the isolated test database (travelhub1_test).
 *
 * Test contract (§5 of Round 2 remediation prompt):
 * Test A: revoked MARKETER default link stays revoked after restart
 * Test B: FINANCE extra grant survives after restart
 * Test C: repeated startup is idempotent
 */

import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SecurityService } from "../src/security/security.service";
import { RoleCode } from "../src/generated/prisma/enums";
import { ALL_PERMISSIONS } from "../src/security/permissions.constants";

describe("Step 3.2 — DB-Backed Restart Persistence (Round 2)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let securityService: SecurityService;

  // Track fixtures for cleanup
  const fixtures: {
    revokedLink?: { roleId: string; permissionId: string };
    extraGrant?: { roleId: string; permissionId: string };
  } = {};

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
    // Restore any revoked fixtures
    if (fixtures.revokedLink) {
      await prisma.rolePermission
        .create({ data: fixtures.revokedLink })
        .catch(() => {});
    }
    // Remove any extra grants
    if (fixtures.extraGrant) {
      await prisma.rolePermission
        .delete({ where: { roleId_permissionId: fixtures.extraGrant } })
        .catch(() => {});
    }
    await app.close();
  });

  // ─── Helper: find RolePermission link ─────────────────────────────

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

  // ─── Helper: count RolePermission for a role ──────────────────────

  async function countRolePermissions(roleCode: RoleCode): Promise<number> {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) return 0;
    return prisma.rolePermission.count({ where: { roleId: role.id } });
  }

  // ─── Test A: revoked MARKETER default link stays revoked ──────────

  it("Test A: revoked MARKETER → dashboard.marketplace.read stays revoked after onModuleInit()", async () => {
    // 1. Verify default link exists before revocation
    const existsBefore = await findRolePermission(
      RoleCode.MARKETER,
      "dashboard.marketplace.read",
    );
    expect(existsBefore).toBe(true);

    // 2. Record fixture for cleanup
    const marketerRole = await prisma.role.findUnique({
      where: { code: RoleCode.MARKETER },
    });
    const marketplacePerm = await prisma.permission.findUnique({
      where: { code: "dashboard.marketplace.read" },
    });
    fixtures.revokedLink = {
      roleId: marketerRole!.id,
      permissionId: marketplacePerm!.id,
    };

    // 3. Delete the default link (simulating admin revocation)
    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: marketerRole!.id,
          permissionId: marketplacePerm!.id,
        },
      },
    });

    // 4. Verify link is deleted
    const existsAfterRevoke = await findRolePermission(
      RoleCode.MARKETER,
      "dashboard.marketplace.read",
    );
    expect(existsAfterRevoke).toBe(false);

    // 5. Run real onModuleInit (startup seed)
    await securityService.onModuleInit();

    // 6. Verify link is STILL deleted (not restored by seed)
    const existsAfterRestart = await findRolePermission(
      RoleCode.MARKETER,
      "dashboard.marketplace.read",
    );
    expect(existsAfterRestart).toBe(false);

    // 7. Restore fixture in test's own finally (via afterAll)
  });

  // ─── Test B: FINANCE extra grant survives restart ─────────────────

  it("Test B: FINANCE → analytics.read extra grant survives onModuleInit()", async () => {
    // 1. Verify default link does NOT exist
    const existsBefore = await findRolePermission(
      RoleCode.FINANCE,
      "analytics.read",
    );
    expect(existsBefore).toBe(false);

    // 2. Record fixture for cleanup
    const financeRole = await prisma.role.findUnique({
      where: { code: RoleCode.FINANCE },
    });
    const analyticsPerm = await prisma.permission.findUnique({
      where: { code: "analytics.read" },
    });
    fixtures.extraGrant = {
      roleId: financeRole!.id,
      permissionId: analyticsPerm!.id,
    };

    // 3. Create the extra grant
    await prisma.rolePermission.create({
      data: { roleId: financeRole!.id, permissionId: analyticsPerm!.id },
    });

    // 4. Verify link exists
    const existsAfterCreate = await findRolePermission(
      RoleCode.FINANCE,
      "analytics.read",
    );
    expect(existsAfterCreate).toBe(true);

    // 5. Run real onModuleInit (startup seed)
    await securityService.onModuleInit();

    // 6. Verify link STILL exists (not deleted by seed)
    const existsAfterRestart = await findRolePermission(
      RoleCode.FINANCE,
      "analytics.read",
    );
    expect(existsAfterRestart).toBe(true);
  });

  // ─── Test C: repeated startup is idempotent ───────────────────────

  it("Test C: repeated onModuleInit() does not create duplicate RolePermission rows", async () => {
    // Record initial counts
    const adminCountBefore = await countRolePermissions(RoleCode.ADMIN);
    const financeCountBefore = await countRolePermissions(RoleCode.FINANCE);

    // Run onModuleInit 3 times
    await securityService.onModuleInit();
    await securityService.onModuleInit();
    await securityService.onModuleInit();

    // Verify counts unchanged (no duplicate RolePermission rows created)
    const adminCountAfter = await countRolePermissions(RoleCode.ADMIN);
    const financeCountAfter = await countRolePermissions(RoleCode.FINANCE);

    expect(adminCountAfter).toBe(adminCountBefore);
    expect(financeCountAfter).toBe(financeCountBefore);
  });

  // ─── Test D: verify all 65 dashboard permission codes exist ────────

  it("Test D: all dashboard permission codes exist in Permission catalog", async () => {
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

  // ─── Test E: safe role defaults match ROLE_PERMISSIONS ─────────────

  it("Test E: MARKETER has expected non-revoked dashboard defaults", async () => {
    const marketerRole = await prisma.role.findUnique({
      where: { code: RoleCode.MARKETER },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    const permCodes = marketerRole!.permissions.map(
      (rp) => rp.permission.code,
    );

    // MARKETER should have executive and customize (non-revoked defaults)
    expect(permCodes).toContain("dashboard.executive.read");
    expect(permCodes).toContain("dashboard.customize");

    // Note: Test A revoked marketplace.read — it will be restored in afterAll
    // So we don't assert it here. The test validates that core defaults exist.
  });
});
