/**
 * Hybrid RBAC E2E — role permission editing + multiple/temporary roles.
 *
 * Verifies on a real isolated DB:
 *  - primary role stays compatible; additional roles union permissions;
 *  - role permission changes apply to an already-open session on the next request;
 *  - temporary role start/end are evaluated per request (no cron dependency);
 *  - revoke removes only the revoked role; self-assignment and last-admin are blocked;
 *  - unknown permission rejected; audit rows written.
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: { id: string; role: string; permissions: string[] };
}

describe("Hybrid RBAC — permissions + multi-role (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let adminAgent: ReturnType<typeof request.agent>;
  const stamp = Date.now();
  const created = { users: [] as string[] };
  const financePermissionsBefore: string[] = [];

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };
  const login = async (username: string, password: string): Promise<Session> =>
    (await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200)).body as Session;
  const createStaff = async (tag: string, roleCode: RoleCode) => {
    const res = await adminAgent
      .post("/api/v1/users")
      .send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode })
      .expect(201);
    created.users.push((res.body as { id: string }).id);
    return login(`${tag}${stamp}`, "staffpass123");
  };
  const roles = async () => (await adminAgent.get("/api/v1/users/roles").expect(200)).body as {
    roles: Array<{ code: string; permissions: string[]; userCount: number }>;
    permissions: Array<{ code: string }>;
  };
  const financeRole = async () => (await roles()).roles.find((r) => r.code === "FINANCE")!;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    admin = await login("admin", "admin123");
    adminAgent = agent(admin.accessToken);
    financePermissionsBefore.push(...(await financeRole()).permissions);
  });

  afterAll(async () => {
    // Restore FINANCE permissions and remove suite users/assignments.
    try {
      await adminAgent.put("/api/v1/users/roles/FINANCE/permissions").send({ permissions: financePermissionsBefore });
    } catch {
      // best-effort
    }
    await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  it("additional role unions permissions and revocation removes only that role", async () => {
    const operator = await createStaff("hrbacop", RoleCode.OPERATOR);
    expect(operator.user.permissions).not.toContain("finance.overview.read");
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(403);

    const assigned = await adminAgent
      .post(`/api/v1/users/${operator.user.id}/roles`)
      .send({ roleCode: "FINANCE", reason: "temporary cover" })
      .expect(201);
    const assignmentId = (assigned.body as { assignments: Array<{ id: string }> }).assignments[0].id;
    expect((assigned.body as { effectivePermissions: string[] }).effectivePermissions).toContain("finance.overview.read");

    // The SAME token/session sees the new permission immediately (guard reloads DB).
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(200);

    await adminAgent.delete(`/api/v1/users/${operator.user.id}/roles/${assignmentId}`).expect(200);
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(403);
    // Primary /users endpoint remains OPERATOR.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: operator.user.id }, include: { role: true } });
    expect(row.role.code).toBe("OPERATOR");
  });

  it("temporary assignment: future start and expired end give no permissions without cron", async () => {
    const operator = await createStaff("hrbactmp", RoleCode.OPERATOR);
    const future = new Date(Date.now() + 3600_000).toISOString();
    const assigned = await adminAgent
      .post(`/api/v1/users/${operator.user.id}/roles`)
      .send({ roleCode: "FINANCE", startAt: future, endAt: new Date(Date.now() + 7200_000).toISOString(), reason: "future" })
      .expect(201);
    const assignmentId = (assigned.body as { assignments: Array<{ id: string }> }).assignments[0].id;
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(403);

    // Move the window into the past (simulates clock passing; no scheduler run).
    await prisma.userRoleAssignment.update({
      where: { id: assignmentId },
      data: { startAt: new Date(Date.now() - 3600_000), endAt: new Date(Date.now() - 1000) },
    });
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(403);

    // Active window now.
    await prisma.userRoleAssignment.update({
      where: { id: assignmentId },
      data: { startAt: new Date(Date.now() - 1000), endAt: null },
    });
    await agent(operator.accessToken).get("/api/v1/finance/overview").expect(200);
  });

  it("role permission edit applies to every user of that role immediately", async () => {
    const finance = await createStaff("hrbacfin", RoleCode.FINANCE);
    await agent(finance.accessToken).get("/api/v1/finance/overview").expect(200);

    const role = await financeRole();
    const withoutOverview = role.permissions.filter((p) => p !== "finance.overview.read");
    await adminAgent
      .put("/api/v1/users/roles/FINANCE/permissions")
      .send({ permissions: withoutOverview })
      .expect(200);
    await agent(finance.accessToken).get("/api/v1/finance/overview").expect(403);

    await adminAgent
      .put("/api/v1/users/roles/FINANCE/permissions")
      .send({ permissions: financePermissionsBefore })
      .expect(200);
    await agent(finance.accessToken).get("/api/v1/finance/overview").expect(200);

    const history = (await adminAgent.get("/api/v1/users/roles/FINANCE/history").expect(200)).body as Array<{
      details: { added?: string[]; removed?: string[] };
    }>;
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((h) => h.details.removed?.includes("finance.overview.read"))).toBe(true);
  });

  it("unknown permission, self-assignment and last-admin protection are rejected", async () => {
    await request(app.getHttpServer()).get("/api/v1/users/roles").expect(401);

    const buyer = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: `hrbacbuyer${stamp}`,
        email: `hrbacbuyer${stamp}@test.local`,
        password: "buyerpass123",
        firstName: "Hybrid",
        lastName: "Buyer",
      })
      .expect(201);
    const buyerSession = buyer.body as Session;
    created.users.push(buyerSession.user.id);
    await agent(buyerSession.accessToken).get("/api/v1/users/roles").expect(403);

    await adminAgent
      .put("/api/v1/users/roles/FINANCE/permissions")
      .send({ permissions: ["finance.unknown.permission"] })
      .expect(422);

    await adminAgent
      .post(`/api/v1/users/${admin.user.id}/roles`)
      .send({ roleCode: "FINANCE" })
      .expect(422);

    await adminAgent
      .patch(`/api/v1/users/${admin.user.id}/role`)
      .send({ roleCode: "OPERATOR" })
      .expect(422);

    await adminAgent
      .patch(`/api/v1/users/${admin.user.id}/status`)
      .send({ status: "INACTIVE" })
      .expect(409);

    // ADMIN currently is the only role granting settings.write → removing it
    // must not leave the platform without an administrator.
    const adminRole = (await roles()).roles.find((r) => r.code === "ADMIN")!;
    const withoutSettings = adminRole.permissions.filter((p) => p !== "settings.write");
    await adminAgent
      .put("/api/v1/users/roles/ADMIN/permissions")
      .send({ permissions: withoutSettings })
      .expect(409);
  });

  it("concurrent duplicate assignment creates one row", async () => {
    const operator = await createStaff("hrbacrace", RoleCode.OPERATOR);
    const body = { roleCode: "FINANCE", reason: "race" };
    const [a, b] = await Promise.all([
      adminAgent.post(`/api/v1/users/${operator.user.id}/roles`).send(body),
      adminAgent.post(`/api/v1/users/${operator.user.id}/roles`).send(body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const count = await prisma.userRoleAssignment.count({
      where: { userId: operator.user.id, role: { code: "FINANCE" } },
    });
    expect(count).toBe(1);
  });

  it("critical finance permission is independently removable and enforced", async () => {
    const finance = await createStaff("hrbacfin2", RoleCode.FINANCE);
    const original = (await financeRole()).permissions;
    const withoutManage = original.filter((p) => p !== "finance.supplier_payout.manage");
    await adminAgent
      .put("/api/v1/users/roles/FINANCE/permissions")
      .send({ permissions: withoutManage })
      .expect(200);
    // Permission guard runs before DTO validation: lost manage → 403, not 400.
    await agent(finance.accessToken)
      .post("/api/v1/finance/supplier-payments")
      .set("Idempotency-Key", `hrbac-fin-${stamp}`)
      .send({})
      .expect(403);

    await adminAgent
      .put("/api/v1/users/roles/FINANCE/permissions")
      .send({ permissions: original })
      .expect(200);
    // Restored permission lets the request reach validation (400), not 403.
    await agent(finance.accessToken)
      .post("/api/v1/finance/supplier-payments")
      .set("Idempotency-Key", `hrbac-fin-${stamp}-2`)
      .send({})
      .expect(400);
  });

  it("audit records assignment/revocation/permission edits", async () => {
    const actions = await prisma.auditLog.findMany({
      where: { action: { in: ["user.role_assigned", "user.role_revoked", "role.permissions_updated"] } },
      select: { action: true, details: true },
      take: 20,
    });
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining(["user.role_assigned", "user.role_revoked", "role.permissions_updated"]),
    );
  });
});
