/**
 * Step 3.2 — Full RBAC Parity Check (Round 3)
 *
 * Compares actual database state against ROLE_PERMISSIONS constants
 * for ALL 10 roles using exact set equality (not just counts).
 *
 * This test runs against the isolated test database after migration deploy.
 */

import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
} from "../src/security/permissions.constants";

describe("Step 3.2 — Full RBAC Parity (Round 3)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Permission catalog parity ────────────────────────────────────

  it("Permission catalog has exact set equality with PERMISSIONS constant", async () => {
    const dbPerms = await prisma.permission.findMany({
      select: { code: true },
    });
    const dbSet = new Set<string>(dbPerms.map((p) => p.code));
    const expectedSet = new Set<string>(ALL_PERMISSIONS as readonly string[]);

    const missingInDb = [...expectedSet].filter((c) => !dbSet.has(c));
    const extraInDb = [...dbSet].filter((c) => !expectedSet.has(c));

    console.log(`Permission catalog: expected=${expectedSet.size}, db=${dbSet.size}`);
    console.log(`missing in DB: ${missingInDb.length === 0 ? "none" : missingInDb.join(", ")}`);
    console.log(`extra in DB: ${extraInDb.length === 0 ? "none" : extraInDb.join(", ")}`);

    expect(missingInDb).toEqual([]);
    expect(extraInDb).toEqual([]);
    expect(dbSet.size).toBe(expectedSet.size);
  });

  // ─── Per-role parity (all 10 roles) ──────────────────────────────

  for (const roleCode of Object.values(RoleCode)) {
    it(`${roleCode}: RolePermission set matches ROLE_PERMISSIONS constant`, async () => {
      const role = await prisma.role.findUnique({
        where: { code: roleCode },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      expect(role).not.toBeNull();

      const dbCodes = new Set(
        role!.permissions.map((rp) => rp.permission.code),
      );

      // For ADMIN, expected = ALL_PERMISSIONS
      const expectedCodes =
        roleCode === "ADMIN"
          ? new Set<string>(ALL_PERMISSIONS as readonly string[])
          : new Set<string>((ROLE_PERMISSIONS[roleCode] ?? []) as readonly string[]);

      const missingInDb = [...expectedCodes].filter((c) => !dbCodes.has(c));
      const extraInDb = [...dbCodes].filter((c) => !expectedCodes.has(c));

      console.log(
        `${roleCode}: expected=${expectedCodes.size}, db=${dbCodes.size}, ` +
        `missing=${missingInDb.length === 0 ? "none" : missingInDb.join(", ")}, ` +
        `extra=${extraInDb.length === 0 ? "none" : extraInDb.join(", ")}`,
      );

      expect(missingInDb).toEqual([]);
      expect(extraInDb).toEqual([]);
      expect(dbCodes.size).toBe(expectedCodes.size);
    });
  }
});
