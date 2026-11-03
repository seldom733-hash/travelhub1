import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const TERMINAL = ["CONVERTED", "REJECTED", "UNAVAILABLE", "EXPIRED", "CANCELLED_BY_CUSTOMER"];
const ACTIVE = ["NEW", "CHECKING", "SUPPLIER_TIMEOUT", "PRICE_CHANGED", "CUSTOMER_ACCEPTED", "CONFIRMED", "CUSTOMER_PAYMENT_TIMEOUT"];

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Атомарно назначает наименее загруженного SALES_MANAGER с Round Robin. */
  async assign(requestId: string, actor?: { id: string; username: string }) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the request row: two concurrent creates/assignments cannot both win.
      const locked = await tx.$queryRaw<Array<{ id: string; assignedManagerId: string | null }>>`
        SELECT id, "assignedManagerId" FROM "order"."Request" WHERE id = ${requestId} FOR UPDATE
      `;
      const current = locked[0];
      if (!current) throw new NotFoundException("Request not found");
      if (current.assignedManagerId) return { assigned: false, managerId: current.assignedManagerId };

      const profiles = await tx.salesManagerProfile.findMany({
        where: { participatesInAutoDistribution: true, availability: "AVAILABLE" },
      });
      if (profiles.length === 0) return this.queue(tx, requestId, "NO_AVAILABLE_MANAGERS");

      const users = await tx.user.findMany({
        where: { id: { in: profiles.map((p) => p.userId) }, status: "ACTIVE", role: { code: "SALES_MANAGER" } },
        select: { id: true, fullName: true, username: true },
      });
      if (users.length === 0) return this.queue(tx, requestId, "NO_AVAILABLE_MANAGERS");

      const counts = await tx.request.groupBy({
        by: ["assignedManagerId"],
        where: { assignedManagerId: { in: users.map((u) => u.id) }, status: { in: ACTIVE as never } },
        _count: { _all: true },
      });
      const load = new Map(counts.map((c) => [c.assignedManagerId ?? "", c._count._all]));
      const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
      const candidates = users
        .map((u) => ({ ...u, load: load.get(u.id) ?? 0, profile: profileByUser.get(u.id)! }))
        .filter((u) => u.profile.maxActiveRequests == null || u.load < u.profile.maxActiveRequests)
        .sort((a, b) => {
          if (a.load !== b.load) return a.load - b.load;
          const at = a.profile.lastAssignedAt?.getTime() ?? 0;
          const bt = b.profile.lastAssignedAt?.getTime() ?? 0;
          if (at !== bt) return at - bt;
          return a.id.localeCompare(b.id);
        });
      if (candidates.length === 0) return this.queue(tx, requestId, "ALL_MANAGERS_AT_LIMIT");

      const chosen = candidates[0];
      const now = new Date();
      const slaDueAt = new Date(now.getTime() + 30 * 60_000);
      await tx.request.update({
        where: { id: requestId },
        data: {
          assignedManagerId: chosen.id,
          assignedAt: now,
          assignmentType: actor ? "MANUAL" : "AUTO",
          assignmentState: "ASSIGNED",
          slaDueAt,
          assignmentVersion: { increment: 1 },
        },
      });
      await tx.salesManagerProfile.update({ where: { userId: chosen.id }, data: { lastAssignedAt: now } });
      await tx.requestHistory.create({
        data: { requestId, action: "ASSIGNED", to: chosen.id, actorId: actor?.id ?? null, actorName: actor?.username ?? "SYSTEM", comment: "Auto-distribution" },
      });
      await tx.userNotification.create({
        data: {
          recipientId: chosen.id,
          type: "REQUEST_ASSIGNED",
          entityType: "Request",
          entityId: requestId,
          title: "Новая заявка назначена",
          body: "Откройте заявку, чтобы начать обработку.",
          dedupeKey: `request-assigned:${requestId}:${chosen.id}`,
          payload: { requestId },
        },
      });
      return { assigned: true, managerId: chosen.id, managerName: chosen.fullName ?? chosen.username, load: chosen.load + 1 };
    });
  }

  private async queue(tx: Prisma.TransactionClient, requestId: string, reason: string) {
    await tx.request.update({ where: { id: requestId }, data: { assignmentState: "QUEUED" } });
    const recipients = await tx.user.findMany({
      where: { status: "ACTIVE", role: { code: { in: ["ADMIN", "DIRECTOR"] } } },
      select: { id: true },
    });
    for (const r of recipients) {
      await tx.userNotification.upsert({
        where: { dedupeKey: `request-unassigned:${requestId}:${r.id}` },
        create: { recipientId: r.id, type: "REQUEST_UNASSIGNED", entityType: "Request", entityId: requestId, title: "Заявка без менеджера", body: reason, dedupeKey: `request-unassigned:${requestId}:${r.id}`, payload: { requestId, reason } },
        update: {},
      });
    }
    return { assigned: false, queued: true, reason };
  }

  async unassigned() {
    return this.prisma.request.findMany({
      where: { assignedManagerId: null, status: { in: ACTIVE as never } },
      select: { id: true, referenceNumber: true, status: true, assignmentState: true, createdAt: true, customerId: true, productId: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async reassign(requestId: string, managerId: string, reason: string, actor: { id: string; username: string }) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({ where: { id: requestId }, select: { id: true, assignedManagerId: true } });
      if (!request) throw new NotFoundException("Request not found");
      const user = await tx.user.findFirst({ where: { id: managerId, status: "ACTIVE", role: { code: "SALES_MANAGER" } }, select: { id: true, fullName: true, username: true } });
      if (!user) throw new NotFoundException("Manager not found or inactive");
      const now = new Date();
      await tx.request.update({ where: { id: requestId }, data: { assignedManagerId: managerId, assignedAt: now, assignmentType: "MANUAL", assignmentState: "ASSIGNED", slaDueAt: new Date(now.getTime() + 30 * 60_000), assignmentVersion: { increment: 1 } } });
      await tx.salesManagerProfile.updateMany({ where: { userId: managerId }, data: { lastAssignedAt: now } });
      await tx.requestHistory.create({ data: { requestId, action: "REASSIGNED", from: request.assignedManagerId ?? undefined, to: managerId, actorId: actor.id, actorName: actor.username, comment: reason || "Manual reassignment" } });
      await tx.userNotification.create({ data: { recipientId: managerId, type: "REQUEST_REASSIGNED", entityType: "Request", entityId: requestId, title: "Заявка переназначена вам", body: reason || "Откройте заявку для обработки.", dedupeKey: `request-reassigned:${requestId}:${managerId}:${now.getTime()}`, payload: { requestId, from: request.assignedManagerId } } });
      return { ok: true, manager: user.fullName ?? user.username };
    });
  }

  async load() {
    const users = await this.prisma.user.findMany({
      where: { status: "ACTIVE", role: { code: "SALES_MANAGER" } },
      select: { id: true, fullName: true, username: true },
    });
    const profiles = await this.prisma.salesManagerProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const rows = await Promise.all(users.map(async (u) => {
      const counts = await this.prisma.request.groupBy({ by: ["status"], where: { assignedManagerId: u.id }, _count: { _all: true } });
      const overdue = await this.prisma.request.count({ where: { assignedManagerId: u.id, status: { in: ACTIVE as never }, slaDueAt: { lt: new Date() }, firstContactAt: null } });
      const openedNotStarted = await this.prisma.request.count({ where: { assignedManagerId: u.id, status: "NEW", firstOpenedAt: { not: null } } });
      const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
      const active = Object.entries(by).filter(([s]) => ACTIVE.includes(s)).reduce((sum, [, n]) => sum + n, 0);
      return { userId: u.id, name: u.fullName ?? u.username, availability: profileByUser.get(u.id)?.availability ?? "INACTIVE", participates: profileByUser.get(u.id)?.participatesInAutoDistribution ?? false, new: by.NEW ?? 0, processing: (by.CHECKING ?? 0) + (by.CONFIRMED ?? 0), overdue, openedNotStarted, active, total: counts.reduce((s, c) => s + c._count._all, 0) };
    }));
    return rows;
  }

  async unread(userId: string) {
    const [total, requests, payments] = await Promise.all([
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, entityType: "Request" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, entityType: "Payment" } }),
    ]);
    return { total, requests, payments };
  }

  async list(userId: string, unreadOnly = false) {
    return this.prisma.userNotification.findMany({ where: { recipientId: userId, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.userNotification.findFirst({ where: { id, recipientId: userId } });
    if (!row) throw new NotFoundException("Notification not found");
    return this.prisma.userNotification.update({ where: { id }, data: { readAt: row.readAt ?? new Date() } });
  }

  async markByEntity(userId: string, entityType: string, entityId: string) {
    await this.prisma.userNotification.updateMany({ where: { recipientId: userId, entityType, entityId, readAt: null }, data: { readAt: new Date() } });
    if (entityType === "Request") {
      await this.prisma.request.updateMany({ where: { id: entityId, assignedManagerId: userId, firstOpenedAt: null }, data: { firstOpenedAt: new Date() } });
    }
  }
}
