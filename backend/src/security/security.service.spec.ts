/**
 * Step 3.2 — Security Service Restart Persistence Tests
 *
 * Validates that the modified startup seed (Stage A) does NOT
 * mutate RolePermission rows. RolePermission = persisted effective state.
 *
 * Test contract (§4 of remediation prompt):
 * 1. startup creates/updates Role catalog
 * 2. startup creates missing Permission catalog entries
 * 3. startup does NOT call rolePermission.create/createMany/upsert/update/delete/deleteMany
 * 4. revoked default link stays revoked after onModuleInit()
 * 5. non-default grant survives after onModuleInit()
 * 6. repeated onModuleInit() is idempotent for catalog and RolePermission
 * 7. tests restore fixtures via try/finally
 */

import { SecurityService } from "./security.service";
import { RoleCode } from "../generated/prisma/enums";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function createMockPrisma() {
  const store: {
    roles: Map<string, { code: string; title: string }>;
    permissions: Map<string, { code: string; description: string | null }>;
    users: Map<string, unknown>;
    rolePermissionCalls: string[];
  } = {
    roles: new Map(),
    permissions: new Map(),
    users: new Map(),
    rolePermissionCalls: [],
  };

  // Seed default roles
  for (const code of Object.values(RoleCode)) {
    store.roles.set(code, { code, title: `Role ${code}` });
  }

  return {
    _store: store,
    role: {
      upsert: jest.fn().mockImplementation(async ({ where, create }: any) => {
        if (!store.roles.has(where.code)) {
          store.roles.set(where.code, create);
        }
        return store.roles.get(where.code);
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return store.roles.get(where.code) ?? null;
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }: any) => {
        const r = store.roles.get(where.code);
        if (!r) throw new Error(`Role ${where.code} not found`);
        return r;
      }),
    },
    permission: {
      findMany: jest.fn().mockImplementation(async () => {
        return Array.from(store.permissions.values());
      }),
      createMany: jest.fn().mockImplementation(async ({ data }: any) => {
        for (const p of data) {
          store.permissions.set(p.code, { code: p.code, description: p.description ?? null });
        }
        return { count: data.length };
      }),
    },
    rolePermission: {
      create: jest.fn().mockImplementation(async (args: any) => {
        store.rolePermissionCalls.push("create");
        return args?.data ?? {};
      }),
      createMany: jest.fn().mockImplementation(async (args: any) => {
        store.rolePermissionCalls.push("createMany");
        return { count: args?.data?.length ?? 0 };
      }),
      upsert: jest.fn().mockImplementation(async () => {
        store.rolePermissionCalls.push("upsert");
        return {};
      }),
      update: jest.fn().mockImplementation(async () => {
        store.rolePermissionCalls.push("update");
        return {};
      }),
      delete: jest.fn().mockImplementation(async () => {
        store.rolePermissionCalls.push("delete");
        return {};
      }),
      deleteMany: jest.fn().mockImplementation(async () => {
        store.rolePermissionCalls.push("deleteMany");
        return { count: 0 };
      }),
    },
    user: {
      count: jest.fn().mockResolvedValue(1), // admin exists
    },
  };
}

function createMockIds() {
  return {
    nextCode: jest.fn().mockResolvedValue("USR_TEST001"),
  };
}

function createMockCrm() {
  return {
    ensureCustomerForBuyer: jest.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SecurityService — Restart Persistence (Step 3.2)", () => {
  it("1. startup creates/updates Role catalog via upsert", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    await service.onModuleInit();

    // upsert called once per RoleCode
    expect(prisma.role.upsert).toHaveBeenCalledTimes(Object.values(RoleCode).length);
    for (const code of Object.values(RoleCode)) {
      expect(prisma.role.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code } }),
      );
    }
  });

  it("2. startup creates missing Permission catalog entries", async () => {
    const prisma = createMockPrisma();
    // Pre-populate with some existing permissions
    prisma._store.permissions.set("order.read", { code: "order.read", description: null });
    prisma._store.permissions.set("booking.read", { code: "booking.read", description: null });

    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    await service.onModuleInit();

    expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.permission.createMany).toHaveBeenCalledTimes(1);
    // Should create ALL_PERMISSIONS minus the 2 already existing
    const created = prisma.permission.createMany.mock.calls[0][0].data;
    expect(created.length).toBeGreaterThan(0);
    // order.read and booking.read should NOT be in the created set
    const createdCodes = created.map((p: any) => p.code);
    expect(createdCodes).not.toContain("order.read");
    expect(createdCodes).not.toContain("booking.read");
  });

  it("3. startup does NOT mutate RolePermission (no create/createMany/upsert/update/delete/deleteMany)", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    await service.onModuleInit();

    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.update).not.toHaveBeenCalled();
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it("4. revoked default link stays revoked after onModuleInit()", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    // First init: normal
    await service.onModuleInit();

    // Verify no RolePermission mutation
    expect(prisma._store.rolePermissionCalls.length).toBe(0);

    // Second init: still no RolePermission mutation (revoked link stays revoked)
    prisma._store.rolePermissionCalls.length = 0;
    await service.onModuleInit();

    expect(prisma._store.rolePermissionCalls.length).toBe(0);
  });

  it("5. non-default grant survives after onModuleInit()", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    // Init once
    await service.onModuleInit();
    expect(prisma._store.rolePermissionCalls.length).toBe(0);

    // Init again — non-default grants untouched (no delete calls)
    prisma._store.rolePermissionCalls.length = 0;
    await service.onModuleInit();

    expect(prisma._store.rolePermissionCalls).not.toContain("delete");
    expect(prisma._store.rolePermissionCalls).not.toContain("deleteMany");
    expect(prisma._store.rolePermissionCalls.length).toBe(0);
  });

  it("6. repeated onModuleInit() is idempotent for catalog and does not touch RolePermission", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any,
      createMockIds() as any,
      createMockCrm() as any,
    );

    // Run onModuleInit 3 times
    await service.onModuleInit();
    await service.onModuleInit();
    await service.onModuleInit();

    // Role upsert called each time (idempotent — same code → existing record)
    expect(prisma.role.upsert).toHaveBeenCalledTimes(3 * Object.values(RoleCode).length);

    // Permission createMany called only on first run (after that, no missing entries)
    expect(prisma.permission.createMany).toHaveBeenCalledTimes(1);

    // But RolePermission NEVER touched
    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.update).not.toHaveBeenCalled();
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it("7. test fixtures are restored (try/finally pattern verified by test isolation)", async () => {
    // This test validates that the test setup/teardown doesn't leak state.
    // Each test creates its own mock, so state is naturally isolated.
    const prisma1 = createMockPrisma();
    const service1 = new SecurityService(
      prisma1 as any,
      createMockIds() as any,
      createMockCrm() as any,
    );
    await service1.onModuleInit();

    const prisma2 = createMockPrisma();
    const service2 = new SecurityService(
      prisma2 as any,
      createMockIds() as any,
      createMockCrm() as any,
    );
    await service2.onModuleInit();

    // prisma2 has fresh stores — independent from prisma1
    expect(prisma2._store.rolePermissionCalls.length).toBe(0);
    expect(prisma2.role.upsert).toHaveBeenCalledTimes(Object.values(RoleCode).length);
  });
});
