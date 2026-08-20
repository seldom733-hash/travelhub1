/**
 * Step 3.2 — SecurityService Unit Tests (Round 3, corrected)
 *
 * Tests that the modified startup seed does NOT call any RolePermission
 * mutation methods. These are MOCK-based unit tests verifying the
 * code contract — NOT persistence behavior.
 *
 * Real persistence behavior is tested in test/restart-persistence.e2e-spec.ts.
 */

import { SecurityService } from "./security.service";
import { RoleCode } from "../generated/prisma/enums";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function createMockPrisma() {
  const store: {
    roles: Map<string, { code: string; title: string }>;
    permissions: Map<string, { code: string; description: string | null }>;
    rolePermissionCalls: string[];
  } = {
    roles: new Map(),
    permissions: new Map(),
    rolePermissionCalls: [],
  };

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
      create: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where?.username === "admin") return { id: "admin-id" };
        return null;
      }),
      create: jest.fn(),
    },
  };
}

function createMockIds() {
  return { nextCode: jest.fn().mockResolvedValue("USR_TEST001") };
}

function createMockCrm() {
  return { ensureCustomerForBuyer: jest.fn() };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SecurityService — Seed Contract (mock-based unit tests)", () => {
  it("seed creates/updates Role catalog via upsert", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any, createMockIds() as any, createMockCrm() as any,
    );

    await service.onModuleInit();

    expect(prisma.role.upsert).toHaveBeenCalledTimes(
      Object.values(RoleCode).length,
    );
    for (const code of Object.values(RoleCode)) {
      expect(prisma.role.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code } }),
      );
    }
  });

  it("seed creates missing Permission catalog entries", async () => {
    const prisma = createMockPrisma();
    prisma._store.permissions.set("order.read", { code: "order.read", description: null });
    prisma._store.permissions.set("booking.read", { code: "booking.read", description: null });

    const service = new SecurityService(
      prisma as any, createMockIds() as any, createMockCrm() as any,
    );

    await service.onModuleInit();

    expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.permission.createMany).toHaveBeenCalledTimes(1);
    const created = prisma.permission.createMany.mock.calls[0][0].data;
    expect(created.length).toBeGreaterThan(0);
    const createdCodes = created.map((p: any) => p.code);
    expect(createdCodes).not.toContain("order.read");
    expect(createdCodes).not.toContain("booking.read");
  });

  it("seed does NOT call any RolePermission mutation methods", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any, createMockIds() as any, createMockCrm() as any,
    );

    await service.onModuleInit();

    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.update).not.toHaveBeenCalled();
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it("seed is idempotent — repeated calls only upsert roles", async () => {
    const prisma = createMockPrisma();
    const service = new SecurityService(
      prisma as any, createMockIds() as any, createMockCrm() as any,
    );

    await service.onModuleInit();
    await service.onModuleInit();
    await service.onModuleInit();

    // RolePermission never touched across all calls
    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.update).not.toHaveBeenCalled();
    expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();

    // Role upsert called each time (idempotent)
    expect(prisma.role.upsert).toHaveBeenCalledTimes(
      3 * Object.values(RoleCode).length,
    );

    // Permission createMany only on first run
    expect(prisma.permission.createMany).toHaveBeenCalledTimes(1);
  });
});
