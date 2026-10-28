import { ConflictError, ValidationDomainError } from "../shared/errors";
import { SecurityService } from "./security.service";

const at = (iso: string) => new Date(iso);

function permission(code: string) {
  return { permission: { code } };
}

function makeService(userOverride: Record<string, unknown> = {}) {
  const baseUser = {
    role: { permissions: [permission("order.read")] },
    roleAssignments: [
      {
        startAt: at("2026-01-01T00:00:00Z"),
        endAt: null,
        revokedAt: null,
        role: { permissions: [permission("finance.overview.read")] },
      },
    ],
    ...userOverride,
  };
  const prisma: any = {
    user: {
      // Emulate Prisma's relation filters: effective permissions query must see
      // only revokedAt=null, startAt<=now and endAt=null/>now assignments.
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        if (!args?.select?.roleAssignments) return baseUser;
        const now = new Date();
        const rows = (baseUser.roleAssignments as any[]).filter(
          (a) => a.revokedAt === null && a.startAt <= now && (a.endAt === null || a.endAt > now),
        );
        return { role: baseUser.role, roleAssignments: rows };
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    role: { findUnique: jest.fn(), findMany: jest.fn() },
    permission: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };
  const service = new SecurityService(prisma, { nextCode: jest.fn() } as never, {} as never);
  return { service, prisma };
}

describe("Hybrid RBAC — effective permissions", () => {
  it("объединяет primary и действующие дополнительные роли", async () => {
    const { service } = makeService();
    const perms = await service.permissionsOf("u1");
    expect(perms.sort()).toEqual(["finance.overview.read", "order.read"]);
  });

  it("исключает назначение, которое ещё не началось", async () => {
    const { service } = makeService({
      roleAssignments: [
        {
          startAt: new Date(Date.now() + 86400000),
          endAt: null,
          revokedAt: null,
          role: { permissions: [permission("finance.overview.read")] },
        },
      ],
    });
    expect(await service.permissionsOf("u1")).toEqual(["order.read"]);
  });

  it("исключает назначение с истёкшим endAt без фоновой задачи", async () => {
    const { service } = makeService({
      roleAssignments: [
        {
          startAt: at("2026-01-01T00:00:00Z"),
          endAt: new Date(Date.now() - 1000),
          revokedAt: null,
          role: { permissions: [permission("finance.overview.read")] },
        },
      ],
    });
    expect(await service.permissionsOf("u1")).toEqual(["order.read"]);
  });

  it("исключает отозванное назначение", async () => {
    const { service } = makeService({
      roleAssignments: [
        {
          startAt: at("2026-01-01T00:00:00Z"),
          endAt: null,
          revokedAt: new Date(),
          role: { permissions: [permission("finance.overview.read")] },
        },
      ],
    });
    expect(await service.permissionsOf("u1")).toEqual(["order.read"]);
  });
});

describe("Hybrid RBAC — assignment guards", () => {
  it("нельзя назначить роль самому себе", async () => {
    const { service } = makeService();
    await expect(
      service.assignAdditionalRole("u1", { roleCode: "FINANCE" as never }, { id: "u1", username: "admin" }),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("нельзя создать уже истёкшее временное назначение", async () => {
    const { service, prisma } = makeService();
    prisma.role.findUnique.mockResolvedValue({ id: "r-fin", code: "FINANCE" });
    prisma.user.findUnique.mockResolvedValue({ id: "u2", roleId: "r-op", username: "op" });
    await expect(
      service.assignAdditionalRole(
        "u2",
        { roleCode: "FINANCE" as never, endAt: new Date(Date.now() - 1000).toISOString() },
        { id: "admin", username: "admin" },
      ),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("неизвестный permission при редактировании роли отклоняется", async () => {
    const { service, prisma } = makeService();
    prisma.role.findUnique.mockResolvedValue({
      id: "r1",
      code: "FINANCE",
      title: "Finance",
      description: "Finance",
      permissions: [],
    });
    prisma.permission.findMany.mockResolvedValue([]);
    await expect(
      service.updateRolePermissions("FINANCE" as never, ["finance.unknown"], "admin"),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("последний settings.write нельзя убрать из роли", async () => {
    const { service, prisma } = makeService();
    prisma.role.findUnique.mockResolvedValue({
      id: "r-admin",
      code: "ADMIN",
      title: "Admin",
      description: "Admin",
      permissions: [permission("settings.write")],
    });
    prisma.permission.findMany.mockResolvedValue([{ code: "order.read" }]);
    prisma.role.findMany.mockResolvedValue([{ id: "r-admin" }]);
    prisma.user.findMany.mockResolvedValue([{ id: "u1", roleId: "r-admin", roleAssignments: [] }]);
    await expect(
      service.updateRolePermissions("ADMIN" as never, ["order.read"], "admin"),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
