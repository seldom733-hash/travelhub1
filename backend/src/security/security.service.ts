import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../shared/ids.service";
import { CrmService } from "../modules/crm/crm.service";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type PermissionCode,
} from "./permissions.constants";
import { RoleCode, UserStatus } from "../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../shared/errors";
import { normalizeEmail } from "../shared/field-validation";
import { normalizePhoneE164 } from "../shared/phone/phone";
import { buildSortClause } from '../shared/sort';
import { getRequestContext } from "../shared/request-context";
import type { Prisma } from "../generated/prisma/client";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "Administrator";

/**
 * SecurityModule (Phase 2, RBAC Matrix Baseline 1.3):
 *  - владелец security.* (User/Role/Permission/AuditLog);
 *  - канонический набор ролей ADMIN..BUYER + granular permissions;
 *  - seed ролей/прав выполняется при старте (идемпотентно, через upsert);
 *  - аудит действий безопасности (AuditLog).
 */
@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly crm: CrmService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRoles();
    await this.seedAdmin();
    // НЕ выполняем legacy Buyer↔Customer reconciliation при старте (review
    // Step 1.9): runtime startup backfill не нужен — новые BUYER всегда
    // получают Customer внутри registration orchestration (AuthService.register).
    // Legacy repair — отдельная явная idempotent command (dry-run/report):
    //   POST /api/v1/users/reconcile-buyer-customers  (см. repairBuyerCustomers).
  }

  /** Создание канонических ролей и прав (идемпотентно). */
  private async seedRoles(): Promise<void> {
    const roles = Object.values(RoleCode);
    for (const code of roles) {
      await this.prisma.role.upsert({
        where: { code },
        update: {},
        create: { code, title: ROLE_TITLES[code], description: ROLE_TITLES[code] },
      });
    }

    const existing = await this.prisma.permission.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((p) => p.code));
    const missing = ALL_PERMISSIONS.filter((c) => !existingCodes.has(c));
    if (missing.length > 0) {
      await this.prisma.permission.createMany({
        data: missing.map((code) => ({ code, description: PERMISSION_DESCRIPTIONS[code] ?? null })),
      });
    }

    // Step 3.2: RolePermission rows = persisted effective state.
    // Startup seed НЕ выполняет toAdd/toRevoke для RolePermission.
    // Default assignments создаются one-time Prisma migration.
    // Admin grant/revoke (Stage C) сохраняется между restarts.
    this.logger.log("RBAC roles/permissions seeded");
  }

  /** Создание администратора по умолчанию (идемпотентно). */
  private async seedAdmin(): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { username: ADMIN_USERNAME },
      select: { id: true, passwordHash: true },
    });
    if (existing) {
      // Синхронизация пароля: если хеш в БД не совпадает с текущим ADMIN_PASSWORD
      // из .env — обновляем, чтобы деплой/рестарт не ломал вход.
      const matches = await bcrypt.compare(ADMIN_PASSWORD, existing.passwordHash);
      if (!matches) {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash },
        });
        this.logger.warn(`Admin user '${ADMIN_USERNAME}' password hash was out of sync — updated from ADMIN_PASSWORD env`);
      }
      return;
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } });
    const code = await this.ids.nextCode(this.prisma as unknown as Prisma.TransactionClient, "USR");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    try {
      await this.prisma.user.create({
        data: {
          code,
          username: ADMIN_USERNAME,
          passwordHash,
          fullName: ADMIN_FULL_NAME,
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
      });
      this.logger.log(`Seeded admin user '${ADMIN_USERNAME}' (role ADMIN)`);
    } catch (err: any) {
      // P2002 = unique constraint — another suite or concurrent init already created it.
      if (err?.code === "P2002") {
        // Re-verify: the admin user MUST exist after P2002.
        // If another field conflicted (not username), rethrow.
        const recheck = await this.prisma.user.findUnique({
          where: { username: ADMIN_USERNAME },
          select: { id: true },
        });
        if (recheck) {
          this.logger.log(`Admin user '${ADMIN_USERNAME}' already exists (P2002), skipping seed`);
          return;
        }
        // P2002 fired but admin not found — unexpected conflict, rethrow.
        throw err;
      }
      throw err;
    }
  }

  /** Права пользователя (из его роли). */
  async permissionsOf(userId: string): Promise<string[]> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: { select: { permissions: { select: { permission: { select: { code: true } } } } } },
        roleAssignments: {
          where: {
            revokedAt: null,
            startAt: { lte: now },
            OR: [{ endAt: null }, { endAt: { gt: now } }],
          },
          select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
        },
      },
    });
    const codes = new Set<string>();
    for (const rp of user?.role?.permissions ?? []) codes.add(rp.permission.code);
    for (const assignment of user?.roleAssignments ?? []) {
      for (const rp of assignment.role.permissions) codes.add(rp.permission.code);
    }
    // Primary role is always effective; additional roles are filtered by their
    // validity window at REQUEST time — expiry takes effect without a cron.
    return [...codes];
  }

  /** Проверка права у пользователя. */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.permissionsOf(userId);
    return perms.includes(permission);
  }

  // ── Hybrid RBAC: role catalogue / permission editor / assignments ──────────

  private static readonly SETTINGS_WRITE = "settings.write";

  /** Roles + permission catalogue + counts (primary + active additional). */
  async listRoles() {
    const now = new Date();
    const [roles, permissions, users, assignments] = await Promise.all([
      this.prisma.role.findMany({
        orderBy: { code: "asc" },
        include: { permissions: { include: { permission: true } } },
      }),
      this.prisma.permission.findMany({ orderBy: { code: "asc" }, select: { code: true, description: true } }),
      this.prisma.user.findMany({ select: { id: true, roleId: true } }),
      this.prisma.userRoleAssignment.findMany({
        where: { revokedAt: null, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] },
        select: { roleId: true, userId: true },
      }),
    ]);
    const primary = new Map<string, Set<string>>();
    for (const u of users) {
      if (!primary.has(u.roleId)) primary.set(u.roleId, new Set());
      primary.get(u.roleId)!.add(u.id);
    }
    const extra = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!extra.has(a.roleId)) extra.set(a.roleId, new Set());
      extra.get(a.roleId)!.add(a.userId);
    }
    return {
      roles: roles.map((r) => ({
        code: r.code,
        title: r.title,
        description: r.description ?? r.title,
        userCount: new Set([...(primary.get(r.id) ?? []), ...(extra.get(r.id) ?? [])]).size,
        permissions: r.permissions.map((p) => p.permission.code).sort(),
      })),
      permissions,
    };
  }

  async roleHistory(code: RoleCode) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) throw new NotFoundError(`Role ${code} not found`);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: "role.permissions_updated", resource: "Role", resourceId: role.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.username,
      createdAt: r.createdAt.toISOString(),
      details: r.details,
    }));
  }

  /**
   * Replace the role's permission set atomically. Guards:
   *  - unknown permission codes rejected;
   *  - the platform must retain at least one ACTIVE user with settings.write.
   */
  async updateRolePermissions(code: RoleCode, requested: string[], actorId: string) {
    const role = await this.prisma.role.findUnique({
      where: { code },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundError(`Role ${code} not found`);
    const unique = [...new Set(requested.map((p) => p.trim()).filter(Boolean))];
    const found = await this.prisma.permission.findMany({ where: { code: { in: unique } }, select: { code: true } });
    if (found.length !== unique.length) {
      const known = new Set(found.map((p) => p.code));
      throw new ValidationDomainError(`Unknown permission(s): ${unique.filter((p) => !known.has(p)).join(", ")}`);
    }
    const before = role.permissions.map((p) => p.permission.code).sort();
    if (before.includes(SecurityService.SETTINGS_WRITE) && !unique.includes(SecurityService.SETTINGS_WRITE)) {
      await this.assertRoleEditKeepsAdmin(role.id, unique);
    }
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (unique.length > 0) {
        const permissions = await tx.permission.findMany({ where: { code: { in: unique } }, select: { id: true } });
        await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      }
      await this.audit(tx, {
        userId: actorId,
        username: actor?.username ?? null,
        action: "role.permissions_updated",
        resource: "Role",
        resourceId: role.id,
        details: {
          roleCode: role.code,
          before,
          after: [...unique].sort(),
          added: unique.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !unique.includes(p)),
        },
      });
      await tx.role.update({ where: { id: role.id }, data: { description: role.description ?? role.title } });
      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { permissions: { include: { permission: true } } },
      });
    });
    return {
      code: updated.code,
      title: updated.title,
      description: updated.description,
      permissions: updated.permissions.map((p) => p.permission.code).sort(),
    };
  }

  /** Detailed user roles: primary + all additional assignments + effective perms. */
  async userRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        roleAssignments: { include: { role: true }, orderBy: [{ startAt: "desc" }, { createdAt: "desc" }] },
      },
    });
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    const now = new Date();
    const roles = await this.prisma.role.findMany({ orderBy: { code: "asc" }, select: { code: true, title: true } });
    return {
      userId: user.id,
      code: user.code,
      username: user.username,
      fullName: user.fullName,
      primaryRole: { code: user.role.code, title: user.role.title },
      assignments: user.roleAssignments.map((a) => ({
        id: a.id,
        roleCode: a.role.code,
        roleTitle: a.role.title,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        reason: a.reason,
        assignedById: a.assignedById,
        assignedByName: a.assignedByName,
        assignedAt: a.createdAt.toISOString(),
        status: a.revokedAt
          ? "REVOKED"
          : a.startAt > now
            ? "SCHEDULED"
            : a.endAt && a.endAt <= now
              ? "EXPIRED"
              : "ACTIVE",
        revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
      })),
      effectivePermissions: await this.permissionsOf(user.id),
      availableRoles: roles,
    };
  }

  /** Assign an additional role (optionally temporary). Never changes primary. */
  async assignAdditionalRole(
    userId: string,
    input: { roleCode: RoleCode; startAt?: string; endAt?: string; reason?: string },
    actor: { id: string; username: string },
  ) {
    if (actor.id === userId) throw new ValidationDomainError("You cannot assign roles to yourself");
    const role = await this.prisma.role.findUnique({ where: { code: input.roleCode } });
    if (!role) throw new NotFoundError(`Role ${input.roleCode} not found`);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, roleId: true, username: true } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    if (user.roleId === role.id) throw new ValidationDomainError("Role is already the user's primary role");
    const startAt = input.startAt ? new Date(input.startAt) : new Date();
    const endAt = input.endAt ? new Date(input.endAt) : null;
    if (Number.isNaN(startAt.getTime()) || (endAt && Number.isNaN(endAt.getTime()))) {
      throw new ValidationDomainError("Invalid role validity dates");
    }
    if (endAt && endAt <= startAt) throw new ValidationDomainError("endAt must be after startAt");
    if (endAt && endAt <= new Date()) throw new ValidationDomainError("endAt must be in the future");
    const reason = input.reason?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRoleAssignment.findUnique({
        where: { userId_roleId: { userId, roleId: role.id } },
      });
      // Atomic upsert (unique user+role) — concurrent duplicate assignments do
      // not create a second row or leak a raw P2002.
      await tx.userRoleAssignment.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        create: {
          userId,
          roleId: role.id,
          startAt,
          endAt,
          reason,
          assignedById: actor.id,
          assignedByName: actor.username,
        },
        update: {
          startAt,
          endAt,
          reason,
          assignedById: actor.id,
          assignedByName: actor.username,
          revokedAt: null,
          revokedById: null,
          createdAt: new Date(),
        },
      });
      await this.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: existing ? "user.role_assignment_updated" : "user.role_assigned",
        resource: "User",
        resourceId: user.id,
        details: {
          targetUsername: user.username,
          roleCode: role.code,
          startAt: startAt.toISOString(),
          endAt: endAt ? endAt.toISOString() : null,
          reason,
          actor: actor.username,
        },
      });
    });
    return this.userRoles(userId);
  }

  /** Revoke one additional assignment; other roles (and primary) untouched. */
  async revokeAdditionalRole(userId: string, assignmentId: string, actor: { id: string; username: string }) {
    if (actor.id === userId) throw new ValidationDomainError("You cannot revoke your own roles");
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { id: assignmentId, userId },
      include: { role: true, user: { select: { id: true, roleId: true, username: true } } },
    });
    if (!assignment) throw new NotFoundError("Role assignment not found");
    if (assignment.role.code === RoleCode.ADMIN && assignment.user.roleId !== assignment.roleId) {
      await this.assertUserRemainsAdmin(userId, { removeRoleId: assignment.roleId });
    }
    const changed = await this.prisma.$transaction(async (tx) => {
      const res = await tx.userRoleAssignment.updateMany({
        where: { id: assignment.id, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id },
      });
      if (res.count === 0) return false;
      await this.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "user.role_revoked",
        resource: "User",
        resourceId: userId,
        details: {
          targetUsername: assignment.user.username,
          roleCode: assignment.role.code,
          assignmentId: assignment.id,
          actor: actor.username,
        },
      });
      return true;
    });
    return this.userRoles(userId);
  }

  /** Change primary role (legacy /users/:id/role), preserving additional roles. */
  async assignRole(userId: string, roleCode: RoleCode, actor: { id: string; username: string }): Promise<void> {
    if (actor.id === userId) throw new ValidationDomainError("You cannot change your own primary role");
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundError(`Role ${roleCode} not found`);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    if (user.roleId === role.id) return;
    if (user.role.code === RoleCode.ADMIN && role.code !== RoleCode.ADMIN) {
      await this.assertUserRemainsAdmin(userId, { newPrimaryRoleId: role.id });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { roleId: role.id, version: { increment: 1 } } });
      // The promoted role cannot remain as an additional assignment.
      await tx.userRoleAssignment.updateMany({
        where: { userId, roleId: role.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id },
      });
      await this.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "user.role_changed",
        resource: "User",
        resourceId: user.id,
        details: { fromRole: user.role.code, toRole: role.code, username: user.username },
      });
    });
  }

  /** True if at least one ACTIVE user would retain settings.write after simulation. */
  private async assertRoleEditKeepsAdmin(roleId: string, newCodes: string[]) {
    const settingsWriteRoles = await this.prisma.role.findMany({
      where: { permissions: { some: { permission: { code: SecurityService.SETTINGS_WRITE } } } },
      select: { id: true },
    });
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: {
        id: true,
        roleId: true,
        roleAssignments: {
          where: { revokedAt: null, startAt: { lte: new Date() }, OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
          select: { roleId: true },
        },
      },
    });
    const roleGrants = new Set(settingsWriteRoles.map((r) => r.id));
    if (newCodes.includes(SecurityService.SETTINGS_WRITE)) roleGrants.add(roleId);
    else roleGrants.delete(roleId);
    const any = users.some((u) => roleGrants.has(u.roleId) || u.roleAssignments.some((a) => roleGrants.has(a.roleId)));
    if (!any) throw new ConflictError("Cannot remove settings.write: platform must retain at least one active administrator");
  }

  /** Locking/deactivating the last active administrator is forbidden. */
  private async assertTargetRetainsAdminOnStatusChange(targetUserId: string) {
    const settingsRoles = await this.prisma.role.findMany({
      where: { permissions: { some: { permission: { code: SecurityService.SETTINGS_WRITE } } } },
      select: { id: true },
    });
    const roleGrants = new Set(settingsRoles.map((r) => r.id));
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: {
        id: true,
        roleId: true,
        roleAssignments: {
          where: { revokedAt: null, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] },
          select: { roleId: true },
        },
      },
    });
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return;
    const targetIsAdmin =
      roleGrants.has(target.roleId) || target.roleAssignments.some((a) => roleGrants.has(a.roleId));
    if (!targetIsAdmin) return;
    const others = users.filter(
      (u) =>
        u.id !== targetUserId &&
        (roleGrants.has(u.roleId) || u.roleAssignments.some((a) => roleGrants.has(a.roleId))),
    ).length;
    if (others === 0) throw new ConflictError("Cannot deactivate the last active administrator");
  }

  /** Last-admin protection for primary change / additional ADMIN revocation. */
  private async assertUserRemainsAdmin(
    targetUserId: string,
    opts: { newPrimaryRoleId?: string; removeRoleId?: string } = {},
  ) {
    const settingsWriteRoles = await this.prisma.role.findMany({
      where: { permissions: { some: { permission: { code: SecurityService.SETTINGS_WRITE } } } },
      select: { id: true },
    });
    const roleGrants = new Set(settingsWriteRoles.map((r) => r.id));
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: {
        id: true,
        roleId: true,
        roleAssignments: {
          where: { revokedAt: null, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] },
          select: { roleId: true },
        },
      },
    });
    let remaining = 0;
    for (const u of users) {
      if (u.id === targetUserId) continue;
      if (roleGrants.has(u.roleId) || u.roleAssignments.some((a) => roleGrants.has(a.roleId))) remaining += 1;
    }
    const target = users.find((u) => u.id === targetUserId);
    if (target) {
      const primary = opts.newPrimaryRoleId ?? target.roleId;
      const assigned = target.roleAssignments
        .map((a) => a.roleId)
        .filter((roleId) => roleId !== opts.removeRoleId);
      const targetRetains = roleGrants.has(primary) || assigned.some((id) => roleGrants.has(id));
      if (!targetRetains && remaining === 0) {
        throw new ConflictError("Cannot remove the last active administrator");
      }
    }
  }

  private static readonly USER_SORT_ALLOWLIST: Record<string, string> = {
    code: 'code',
    username: 'username',
    email: 'email',
    fullName: 'fullName',
    status: 'status',
    lastLoginAt: 'lastLoginAt',
    createdAt: 'createdAt',
  };

  /** Список пользователей (ADMIN/DIRECTOR) — серверная пагинация. */
  async listUsers(query: { search?: string; status?: string; roleCode?: string; sortBy?: string; sortDirection?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.roleCode ? { role: { code: query.roleCode as any } } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
              { fullName: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    // Date range filtering on createdAt (inclusive end-of-day)
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(new Date(query.dateTo).getTime() + 86400000 - 1) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: buildSortClause(query.sortBy, query.sortDirection, SecurityService.USER_SORT_ALLOWLIST, { createdAt: 'desc' }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          username: true,
          email: true,
          fullName: true,
          status: true,
          role: { select: { code: true, title: true } },
          roleAssignments: {
            where: {
              revokedAt: null,
              startAt: { lte: new Date() },
              OR: [{ endAt: null }, { endAt: { gt: new Date() } }],
            },
            select: { role: { select: { code: true, title: true } }, endAt: true },
          },
          partnerId: true,
          customerId: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    // KPI aggregates
    const [countActive, countInactive, countLocked] = await Promise.all([
      this.prisma.user.count({ where: { ...where, status: 'ACTIVE' as any } }),
      this.prisma.user.count({ where: { ...where, status: 'INACTIVE' as any } }),
      this.prisma.user.count({ where: { ...where, status: 'LOCKED' as any } }),
    ]);
    return { items, total, page, pageSize, aggregates: { active: countActive, inactive: countInactive, locked: countLocked } };
  }

  /**
   * Export all matching users (no pagination).
   */
  async exportUsers(query: { search?: string; status?: string; roleCode?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleCode ? { role: { code: query.roleCode } } : {}),
      ...(query.search ? { OR: [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(new Date(query.dateTo).getTime() + 86400000 - 1) } : {}),
      };
    }
    const items = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, code: true, username: true, email: true, fullName: true,
        status: true, role: { select: { code: true, title: true } },
        partnerId: true, customerId: true, lastLoginAt: true, createdAt: true,
      },
    });
    const rows = items.map(u => ({
      id: u.id, code: u.code, username: u.username, email: u.email ?? '',
      fullName: u.fullName ?? '', status: u.status,
      roleCode: u.role?.code ?? '', roleTitle: u.role?.title ?? '',
      lastLoginAt: u.lastLoginAt?.toISOString() ?? '',
      createdAt: u.createdAt?.toISOString() ?? '',
    }));
    return { rows, total: rows.length };
  }

  /** Смена статуса пользователя (lock/unlock). */
  async setStatus(userId: string, status: UserStatus, actorId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    if (status !== UserStatus.ACTIVE) {
      await this.assertTargetRetainsAdminOnStatusChange(userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status, version: { increment: 1 } } });
      await this.audit(tx, {
        userId: actorId,
        username: null,
        action: "user.status_changed",
        resource: "User",
        resourceId: user.id,
        details: { from: user.status, to: status, username: user.username },
      });
    });
  }

  /**
   * Смена пароля администратором (settings.write) для ЛЮБОГО пользователя.
   *
   * Безопасность:
   *  - пароль хешируется bcrypt(10); старый хеш перезаписывается;
   *  - tokenVersion++ инвалидирует ВСЕ ранее выданные JWT/сессии целевого
   *    пользователя (иначе компрометированный токен живёт до истечения);
   *  - аудит user.password_reset (кто сменил, кому) — без значения пароля.
   */
  async resetPassword(userId: string, newPassword: string, actorId: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await this.audit(tx, {
        userId: actorId,
        username: null,
        action: "user.password_reset",
        resource: "User",
        resourceId: user.id,
        details: { username: user.username, sessionsRevoked: true },
      });
    });
  }

  /**
   * Запись в журнал аудита. Может выполняться в рамках транзакции вызывающего
   * (передать tx) либо отдельной записью (tx опущен).
   *
   * Step 1.15 §10: если активен request context — в details безопасно добавляется
   * ссылка { requestId, correlationId } для связи AuditLog с logs/outbox chain.
   * Это reference, а не event store: AuditLog остаётся журналом действий.
   */
  async audit(
    tx: Prisma.TransactionClient | undefined,
    entry: {
      userId?: string | null;
      username?: string | null;
      action: string;
      resource?: string | null;
      resourceId?: string | null;
      details?: Record<string, unknown>;
      ip?: string | null;
    },
  ): Promise<void> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const ctx = getRequestContext();
    // Step 1.15: correlation — безопасный reference в details (только когда
    // контекст активен). Без details и без контекста — SQL NULL (как раньше),
    // никакой пустой object/backfill.
    const correlation = ctx ? { correlation: { requestId: ctx.requestId, correlationId: ctx.correlationId } } : undefined;
    const details: Prisma.InputJsonValue | undefined =
      entry.details || correlation ? ({ ...(entry.details ?? {}), ...(correlation ?? {}) } as Prisma.InputJsonValue) : undefined;
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        username: entry.username ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        resourceId: entry.resourceId ?? null,
        ...(details !== undefined ? { details } : {}),
        ip: entry.ip ?? null,
      },
    });
  }

  /**
   * Step 1.9 (Clarification §7, review fix) — ЯВНАЯ idempotent migration/repair
   * command для legacy BUYER без валидного customerId. НЕ вызывается из
   * runtime lifecycle (onModuleInit): новые BUYER всегда получают Customer в
   * registration orchestration, поэтому startup backfill не нужен.
   *
   * Контракт (сохраняет все требования Clarification):
   *  - deterministic matching: link только по нормализованному email
   *    (однозначный Customer.email UNIQUE);
   *  - no guessing: BUYER без email — skippedNoEmail (нет канонического ключа),
   *    Customer «наугад» не создаётся;
   *  - ambiguous match → NO auto-merge: имя/телефон не являются ключом связи;
   *  - broken reference: customerId указывает на несуществующий Customer —
   *    однозначно мёртвая ссылка (не guessing), очищается и ремонтируется по
   *    email в том же прогоне;
   *  - transaction safety: create + link одной транзакцией на пользователя
   *    (нет окна «Customer создан, User не связан»);
   *  - dry-run/report: при dryRun=true выполняются ТОЛЬКО чтения и возвращается
   *    отчёт { scanned, linked, created, skippedNoEmail, brokenRefs, dryRun }
   *    без каких-либо изменений;
   *  - audit: реальный прогон аудируется вызывающим (контроллер пишет AuditLog
   *    с полным результатом).
   */
  async repairBuyerCustomers(dryRun = false): Promise<{
    scanned: number;
    linked: number;
    created: number;
    skippedNoEmail: number;
    brokenRefs: number;
    dryRun: boolean;
  }> {
    const buyers = await this.prisma.user.findMany({
      where: { role: { code: RoleCode.BUYER } },
      select: { id: true, username: true, email: true, customerId: true },
    });
    let linked = 0;
    let created = 0;
    let skippedNoEmail = 0;
    let brokenRefs = 0;
    for (const b of buyers) {
      // Уже валидная связь (Customer существует) — пропускаем.
      if (b.customerId) {
        const exists = await this.prisma.customer.findUnique({ where: { id: b.customerId }, select: { id: true } });
        if (exists) continue;
        // Мёртвая ссылка: Customer не существует (однозначно). Чистим и ремонтируем.
        brokenRefs += 1;
        if (!dryRun) {
          await this.prisma.user.update({ where: { id: b.id }, data: { customerId: null } });
        }
      }
      if (!b.email) {
        skippedNoEmail += 1; // без email нет канонического ключа — no guessing
        continue;
      }
      const email = normalizeEmail(b.email);
      const linkedCustomer = await this.prisma.customer.findUnique({ where: { email }, select: { id: true } });
      if (linkedCustomer) {
        linked += 1;
        if (!dryRun) {
          await this.prisma.user.update({ where: { id: b.id }, data: { customerId: linkedCustomer.id } });
        }
        continue;
      }
      created += 1;
      if (!dryRun) {
        // Create + link ОДНОЙ транзакцией через CRM-owned command.
        await this.prisma.$transaction(async (tx) => {
          const { customerId } = await this.crm.ensureCustomerForBuyer(tx, { email, actorUserId: b.id });
          await tx.user.update({ where: { id: b.id }, data: { customerId } });
        });
      }
    }
    if (!dryRun && buyers.length > 0) {
      this.logger.log(
        `Buyer↔Customer repair: scanned=${buyers.length} linked=${linked} created=${created} skippedNoEmail=${skippedNoEmail} brokenRefs=${brokenRefs}`,
      );
    }
    return { scanned: buyers.length, linked, created, skippedNoEmail, brokenRefs, dryRun };
  }

  /**
   * M4.1 (ADR-0016 §2.9) — явная idempotent backfill-команда: loginPhone из
   * канонического телефона связанного Customer. Правила (решение владельца):
   *  - phone НЕ выдумывается: только Customer.phone через User.customerId;
   *  - нормализация — shared/phone; невалидный → пропуск (skippedNoPhone);
   *  - loginPhone уже установлен → не трогаем (никогда не перезаписывать);
   *  - canonical уже занят другим User → conflict, пропуск (без мержа);
   *  - dryRun → только чтения и отчёт.
   */
  async backfillLoginPhones(dryRun = false): Promise<{
    scanned: number;
    updated: number;
    skippedNoCustomer: number;
    skippedNoPhone: number;
    conflicts: { loginPhone: string; ownerUsername: string; attemptedUsername: string }[];
    dryRun: boolean;
  }> {
    const users = await this.prisma.user.findMany({
      select: { id: true, username: true, loginPhone: true, customerId: true },
    });
    const taken = new Map<string, string>(); // loginPhone -> owner username
    for (const u of users) {
      if (u.loginPhone) taken.set(u.loginPhone, u.username);
    }
    let updated = 0;
    let skippedNoCustomer = 0;
    let skippedNoPhone = 0;
    const conflicts: { loginPhone: string; ownerUsername: string; attemptedUsername: string }[] = [];
    for (const u of users) {
      if (u.loginPhone) continue; // never overwrite
      if (!u.customerId) {
        skippedNoCustomer += 1;
        continue;
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: u.customerId },
        select: { phoneCanonical: true, phone: true },
      });
      if (!customer) {
        skippedNoCustomer += 1;
        continue;
      }
      const canonical = customer.phoneCanonical ?? normalizePhoneE164(customer.phone);
      if (!canonical) {
        skippedNoPhone += 1;
        continue;
      }
      const owner = taken.get(canonical);
      if (owner && owner !== u.username) {
        conflicts.push({ loginPhone: canonical, ownerUsername: owner, attemptedUsername: u.username });
        continue;
      }
      taken.set(canonical, u.username);
      updated += 1;
      if (!dryRun) {
        await this.prisma.user.update({ where: { id: u.id }, data: { loginPhone: canonical } });
      }
    }
    if (!dryRun && updated > 0) {
      this.logger.log(`loginPhone backfill: scanned=${users.length} updated=${updated} conflicts=${conflicts.length}`);
    }
    return { scanned: users.length, updated, skippedNoCustomer, skippedNoPhone, conflicts, dryRun };
  }

  /** Создание пользователя персонала (ADMIN). */
  async createStaff(input: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    roleCode: RoleCode;
    partnerId?: string;
    customerId?: string;
  }): Promise<{ id: string; code: string; username: string }> {
    if (input.password.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictError(`Username '${input.username}' already taken`);
    const role = await this.prisma.role.findUnique({ where: { code: input.roleCode } });
    if (!role) throw new NotFoundError(`Role ${input.roleCode} not found`);

    const code = await this.ids.nextCode(this.prisma as unknown as Prisma.TransactionClient, "USR");
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        code,
        username: input.username,
        email: input.email ?? null,
        passwordHash,
        fullName: input.fullName ?? null,
        status: UserStatus.ACTIVE,
        roleId: role.id,
        partnerId: input.partnerId ?? null,
        customerId: input.customerId ?? null,
      },
      select: { id: true, code: true, username: true },
    });
  }
}

const ROLE_TITLES: Record<RoleCode, string> = {
  ADMIN: "Администратор",
  DIRECTOR: "Директор",
  FINANCE: "Финансы",
  MARKETER: "Маркетолог",
  ANALYST: "Аналитик",
  MODERATOR: "Модератор",
  SALES_MANAGER: "Менеджер продаж",
  OPERATOR: "Оператор",
  PARTNER: "Партнёр",
  BUYER: "Покупатель",
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "communication.read": "Чтение communications (internal staff, cross-domain context)",
  "communication.create": "Создание communication по business context (internal staff)",
  "communication.read_own": "Чтение собственных communications (BUYER/PARTNER own-scope)",
  "account.profile.read": "Чтение собственного профиля/аккаунта (own-scope)",
  "account.profile.update": "Обновление собственного профиля (own-scope)",
  "partner.onboarding.read_own": "Чтение собственной PartnerApplication (own-scope)",
  "partner.onboarding.update_own": "Редактирование собственной PartnerApplication (own-scope)",
  "partner.onboarding.submit_own": "Отправка собственной PartnerApplication на review",
  "partner.onboarding.review": "Review очереди PartnerApplication (start/approve/reject/request changes)",
  "seller_public_profile.read_own": "Чтение собственного PublicSellerProfile/предложений (own-scope)",
  "seller_public_profile.propose": "Создание/редактирование/отправка предложения публичной идентичности (own-scope)",
  "storefront.read_own": "Чтение собственной Partner Storefront (own-scope)",
  "storefront.create_own": "Создание собственной Partner Storefront (own-scope, explicit provisioning)",
  "storefront.update_own": "Редактирование собственной Partner Storefront (own-scope)",
  "storefront.activate_own": "Активация/деактивация собственной Partner Storefront (own-scope)",
  "storefront.entitlement.manage": "Управление Storefront entitlement (операционная команда; граница будущего Billing domain)",
  "seller_public_profile.review": "Review очереди предложений публичной идентичности",
  "seller_public_profile.approve_alias": "Утверждение VERIFIED_ALIAS (alias продавца)",
  "seller_public_profile.approve_brand": "Утверждение PUBLIC_BRAND (реальный бренд)",
  "seller_public_profile.request_changes": "Запрос изменений в предложении публичной идентичности",
  "seller_public_profile.hide_identity": "Скрытие/восстановление публичной идентичности продавца",
  "catalog.product.read": "Чтение продуктов",
  "catalog.product.read_for_moderation": "Чтение продуктов для модерации",
  "catalog.product.write": "Создание/изменение продуктов",
  "catalog.product.publish": "Публикация/архивация продукта",
  "catalog.product.submit_moderation": "Отправка продукта на модерацию",
  "catalog.product.create_own": "Создание собственного draft Product (PARTNER)",
  "catalog.product.update_own_draft": "Редактирование собственного draft Product (PARTNER)",
  "catalog.product.read_own": "Чтение собственных продуктов (PARTNER)",
  "catalog.product.channels_own": "Управление каналами публикации собственного Product (own-scope)",
  "catalog.service_unit.publish": "Публикация/архивация Service Unit (Catalog publication authority, гейт: Product PUBLISHED)",
  "catalog.category.write": "Управление категориями",
  "catalog.category_schema.read": "Чтение Category Schema (конфигурации категорий)",
  "catalog.category_schema.write": "Управление Category Schema (только ADMIN)",
  "catalog.category_schema.read_active_for_product_edit": "Чтение ACTIVE Category Schema для формы создания Product (PARTNER)",
  "catalog.availability.write": "Управление availability",
  "catalog.media.upload_own": "Загрузка media собственного Product",
  "catalog.media.update_own": "Обновление media собственного Product",
  "catalog.media.delete_own": "Удаление media собственного Product",
  "catalog.media.reorder_own": "Изменение порядка media собственного Product",
  "catalog.media.set_primary_own": "Назначение primary image собственного Product",
  "catalog.media.read_for_moderation": "Чтение media для модерации",
  "crm.customer.read": "Чтение клиентов",
  "crm.customer.write": "Создание/изменение клиентов",
  "crm.contact.write": "Управление контактами",
  "crm.company.write": "Управление компаниями",
  "crm.partner.write": "Управление партнёрами",
  "crm.supplier.write": "Управление поставщиками",
  "crm.customer.read_own": "Чтение собственных CRM-отношений (partner own-scope)",
  "crm.customer.create_own": "Прямое добавление клиента/лида в собственный CRM (partner intake)",
  "crm.customer.update_own": "Обновление собственных CRM-отношений (lifecycle/tags/notes)",
  "order.read": "Чтение заказов",
  "order.accept": "Принятие заказа в работу",
  "order.edit_noncritical": "Редактирование некритичных данных заказа",
  "order.request_booking": "Передача заказа в Booking",
  "order.suspend": "Приостановка заказа",
  "order.cancel": "Отмена заказа",
  "order.close": "Закрытие заказа",
  "booking.read": "Чтение бронирований",
  "booking.send_supplier": "Отправка запроса поставщику",
  "booking.confirm": "Подтверждение/отклонение бронирования",
  "booking.request_change": "Запрос изменения бронирования",
  "booking.cancel": "Отмена бронирования",
  "booking.return_to_order": "Возврат бронирования в заказ (Booking → Order round-trip)",
  "sales.lead.read": "Чтение лидов",
  "sales.lead.write": "Управление лидами",
  "sales.opportunity.read": "Чтение сделок",
  "sales.opportunity.write": "Управление сделками",
  "sales.quote.read": "Чтение КП",
  "sales.quote.write": "Управление КП",
  "sales.quote.approve": "Согласование КП",
  "sales.sale.read": "Чтение продаж",
  "sales.sale.write": "Управление продажами",
  "sales.sale.complete": "Завершение продажи",
  "sales.kpi.read": "Чтение агрегированного Sales read model (KPI, count-based)",
  "sales.checkout.read": "Чтение checkout commercial intent context",
  "sales.checkout.write": "Управление checkout commercial intent context",
  "finance.payment.read": "Чтение платежей",
  "finance.payment.write": "Управление платежами",
  "finance.refund.read": "Чтение возвратов",
  "finance.refund.approve": "Согласование возвратов",
  "finance.dispute.read": "Чтение споров",
  "finance.dispute.write": "Управление спорами (открытие/закрытие)",
  "finance.invoice.read": "Чтение счетов",
  "finance.invoice.write": "Выставление счетов",
  "finance.commission.read": "Чтение комиссий",
  "finance.commission.write": "Управление комиссиями",
  "finance.commission.manage": "Управление Commission Policy (master data, Step 2.14E)",
  "finance.currency.manage": "Управление валютами",
  "finance.exchange_rate.manage": "Управление курсами",
  "finance.tax.manage": "Управление налогами",
  // UNIFIED FINANCE CENTER Phase 1: supplier-specific FX rates (SupplierFxRate).
  "finance.fx_rate.read": "Чтение курсов поставщиков к AZN (SupplierFxRate)",
  "finance.fx_rate.manage": "Управление курсами поставщиков к AZN (SupplierFxRate)",
  "finance.obligation.read": "Чтение обязательств поставщиков (SupplierObligation)",
  "finance.obligation.manage": "Управление обязательствами поставщиков (cancel/adjust)",
  "finance.supplier_payout.read": "Чтение выплат поставщикам (SupplierPayout)",
  "finance.supplier_payout.manage": "Создание выплат поставщикам (SupplierPayout)",
  "finance.overview.read": "Чтение сводных финансовых KPI (Finance Overview)",
  "pricing.markup.read": "Чтение MarkupRule и матрицы наценок",
  "pricing.markup.manage": "Управление MarkupRule (master data, DRAFT→ACTIVE→ARCHIVED)",
  "sales.discount.grant": "Применение индивидуальной скидки к заявке (Live Sales, server-authoritative)",
  "support.read": "Чтение поддержки",
  "support.write": "Обработка поддержки",
  "documents.read": "Чтение документов",
  "documents.write": "Управление документами",
  "settings.read": "Чтение настроек",
  "settings.write": "Управление настройками",
  "audit.read": "Чтение аудита",
  "analytics.read": "Чтение аналитики",
  "reports.read": "Чтение отчётов",
  "moderation.review": "Ревью модерации",
  "moderation.approve": "Одобрение модерации",
  "moderation.reject": "Отклонение модерации",
  "moderation.request_changes": "Запрос изменений в модерации",
  "dashboard.executive.read": "Чтение Executive KPIs (GMV, Revenue, Orders, Bookings, AOV, Conversion)",
  "dashboard.operational.read": "Чтение Operational KPIs (Orders Fulfilled, Bookings Confirmed, Funnel)",
  "dashboard.financial.read": "Чтение Financial KPIs (Commission, Reconciliation, Payments)",
  "dashboard.marketplace.read": "Чтение Marketplace KPIs (Sessions, Partners, Customers)",
  "dashboard.customize": "Настройка layout Command Center (save/reset)",
  "operational-notes.read": "Чтение operational notes",
  "operational-notes.create": "Создание operational notes",
  "operational-notes.update": "Редактирование operational notes",
  "operational-notes.delete": "Удаление operational notes (soft-delete)",
  // M1 WhatsApp integration (решение владельца №7).
  "whatsapp.read": "Чтение WhatsApp-интеграции (сессии, контакты, статусы, delivery)",
  "whatsapp.send": "Отправка сообщений в WhatsApp через TravelHUB (операционный контур)",
  "whatsapp.send.recover": "Recovery-отправка UNKNOWN-сообщений («Retry anyway», только ADMIN)",
  "whatsapp.manage": "Управление WhatsApp-интеграцией (link/unlink контактов, параметры)",
  "whatsapp.session.admin": "Администрирование WhatsApp-сессии (connect/disconnect/logout)",
};
