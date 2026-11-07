import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const TERMINAL = ["CONVERTED", "REJECTED", "UNAVAILABLE", "EXPIRED", "CANCELLED_BY_CUSTOMER"];
const ACTIVE = ["NEW", "CHECKING", "SUPPLIER_TIMEOUT", "PRICE_CHANGED", "CUSTOMER_ACCEPTED", "CONFIRMED", "CUSTOMER_PAYMENT_TIMEOUT"];

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return this.prisma.salesAssignmentSettings.upsert({
      where: { id: "default" },
      create: { id: "default", mode: "AUTO" },
      update: {},
    });
  }

  async updateSettings(mode: string, actor: { id: string; username: string }) {
    const normalized = mode === "MANUAL" ? "MANUAL" : "AUTO";
    return this.prisma.salesAssignmentSettings.upsert({
      where: { id: "default" },
      create: { id: "default", mode: normalized, updatedById: actor.id },
      update: { mode: normalized, updatedById: actor.id },
    });
  }

  /** Атомарно назначает наименее загруженного SALES_MANAGER с Round Robin. */
  async assign(requestId: string, actor?: { id: string; username: string }, options?: { respectMode?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the request row: two concurrent creates/assignments cannot both win.
      const locked = await tx.$queryRaw<Array<{ id: string; assignedManagerId: string | null }>>`
        SELECT id, "assignedManagerId" FROM "order"."Request" WHERE id = ${requestId} FOR UPDATE
      `;
      const current = locked[0];
      if (!current) throw new NotFoundException("Request not found");
      if (current.assignedManagerId) return { assigned: false, managerId: current.assignedManagerId };

      if (options?.respectMode) {
        const settings = await tx.salesAssignmentSettings.findUnique({ where: { id: "default" } });
        if (settings?.mode === "MANUAL") {
          return this.queue(tx, requestId, "MANUAL_MODE");
        }
      }

      const heads = await tx.user.findMany({ where: { status: "ACTIVE", role: { code: "SALES_HEAD" } }, select: { id: true } });
      if (heads.length > 0) {
        await tx.salesManagerProfile.createMany({ data: heads.map((u) => ({ userId: u.id, availability: "FREE", participatesInAutoDistribution: true, maxActiveRequests: 20 })), skipDuplicates: true });
      }
      const profiles = await tx.salesManagerProfile.findMany({
        where: { participatesInAutoDistribution: true, availability: "FREE" },
      });
      if (profiles.length === 0) return this.queue(tx, requestId, "NO_AVAILABLE_MANAGERS");

      const users = await tx.user.findMany({
        where: { id: { in: profiles.map((p) => p.userId) }, status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_HEAD"] } } },
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
      await tx.userNotification.updateMany({ where: { entityType: "Request", entityId: requestId, type: "REQUEST_UNASSIGNED", readAt: null }, data: { readAt: now } });
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
      where: { status: "ACTIVE", role: { code: { in: ["ADMIN", "DIRECTOR", "SALES_HEAD"] } } },
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

  async getMyStatus(userId: string) {
    const profile = await this.prisma.salesManagerProfile.findUnique({ where: { userId } });
    return { availability: profile?.availability ?? "FREE" };
  }

  async selfAssign(requestId: string, actor: { id: string; username: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "order"."Request" WHERE id = ${requestId} FOR UPDATE`;
      const request = await tx.request.findUnique({ where: { id: requestId }, select: { id: true, assignedManagerId: true, status: true } });
      if (!request) throw new NotFoundException("Request not found");
      if (request.assignedManagerId && request.assignedManagerId !== actor.id) throw new ConflictException("Request is already assigned");
      if (request.assignedManagerId === actor.id) return { ok: true, managerId: actor.id };
      const profile = await tx.salesManagerProfile.findUnique({ where: { userId: actor.id } });
      if (profile?.availability === "ABSENT") throw new BadRequestException("Manager is absent");
      const now = new Date();
      await tx.request.update({ where: { id: requestId }, data: { assignedManagerId: actor.id, assignedAt: now, assignmentType: "SELF", assignmentState: "ASSIGNED", slaDueAt: new Date(now.getTime() + 30 * 60_000), assignmentVersion: { increment: 1 } } });
      await tx.salesManagerProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, availability: "FREE", lastAssignedAt: now }, update: { lastAssignedAt: now } });
      await tx.userNotification.updateMany({ where: { entityType: "Request", entityId: requestId, type: "REQUEST_UNASSIGNED", readAt: null }, data: { readAt: now } });
      await tx.requestHistory.create({ data: { requestId, action: "SELF_ASSIGNED", to: actor.id, actorId: actor.id, actorName: actor.username, comment: "Manager took request" } });
      return { ok: true, managerId: actor.id };
    });
  }

  async setMyStatus(userId: string, status: string) {
    if (!["FREE", "BUSY", "ABSENT"].includes(status)) throw new BadRequestException("Unknown manager status");
    return this.prisma.salesManagerProfile.upsert({
      where: { userId },
      create: { userId, availability: status },
      update: { availability: status },
    });
  }

  async setManagerSettings(userId: string, input: { availability?: string; participates?: boolean; maxActiveRequests?: number | null }) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, role: { code: { in: ["SALES_MANAGER", "SALES_HEAD"] } } }, select: { id: true } });
    if (!user) throw new NotFoundException("Manager not found");
    if (input.availability && !["FREE", "BUSY", "ABSENT"].includes(input.availability)) throw new BadRequestException("Unknown manager status");
    return this.prisma.salesManagerProfile.upsert({
      where: { userId },
      create: { userId, availability: input.availability ?? "AVAILABLE", participatesInAutoDistribution: input.participates ?? true, maxActiveRequests: input.maxActiveRequests ?? null },
      update: {
        ...(input.availability ? { availability: input.availability } : {}),
        ...(input.participates !== undefined ? { participatesInAutoDistribution: input.participates } : {}),
        ...(input.maxActiveRequests !== undefined ? { maxActiveRequests: input.maxActiveRequests } : {}),
      },
    });
  }

  async unassigned() {
    return this.prisma.request.findMany({
      where: { assignedManagerId: null, status: { in: ACTIVE as never } },
      select: { id: true, referenceNumber: true, status: true, assignmentState: true, createdAt: true, customerId: true, productId: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async reassign(requestId: string, managerId: string, reason: string, actor: { id: string; username: string }, expectedManagerId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "order"."Request" WHERE id = ${requestId} FOR UPDATE`;
      const request = await tx.request.findUnique({ where: { id: requestId }, select: { id: true, assignedManagerId: true } });
      if (!request) throw new NotFoundException("Request not found");
      if (expectedManagerId !== undefined && request.assignedManagerId !== expectedManagerId) {
        throw new ConflictException("Request was reassigned by another user");
      }
      const user = await tx.user.findFirst({ where: { id: managerId, status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_HEAD"] } } }, select: { id: true, fullName: true, username: true } });
      if (!user) throw new NotFoundException("Manager not found or inactive");
      const profile = await tx.salesManagerProfile.findUnique({ where: { userId: managerId } });
      if (profile?.availability === "ABSENT") throw new BadRequestException("Manager is absent");
      const now = new Date();
      await tx.request.update({ where: { id: requestId }, data: { assignedManagerId: managerId, assignedAt: now, assignmentType: "MANUAL", assignmentState: "ASSIGNED", slaDueAt: new Date(now.getTime() + 30 * 60_000), assignmentVersion: { increment: 1 } } });
      await tx.salesManagerProfile.updateMany({ where: { userId: managerId }, data: { lastAssignedAt: now } });
      await tx.userNotification.updateMany({ where: { entityType: "Request", entityId: requestId, type: "REQUEST_UNASSIGNED", readAt: null }, data: { readAt: now } });
      await tx.requestHistory.create({ data: { requestId, action: "REASSIGNED", from: request.assignedManagerId ?? undefined, to: managerId, actorId: actor.id, actorName: actor.username, comment: reason || "Manual reassignment" } });
      if (request.assignedManagerId && request.assignedManagerId !== managerId) {
        await tx.userNotification.updateMany({
          where: { recipientId: request.assignedManagerId, entityType: "Request", entityId: requestId, type: { in: ["REQUEST_ASSIGNED", "REQUEST_REASSIGNED"] }, readAt: null },
          data: { readAt: now },
        });
      }
      await tx.userNotification.create({ data: { recipientId: managerId, type: "REQUEST_REASSIGNED", entityType: "Request", entityId: requestId, title: "Заявка переназначена вам", body: reason || "Откройте заявку для обработки.", dedupeKey: `request-reassigned:${requestId}:${managerId}:${now.getTime()}`, payload: { requestId, from: request.assignedManagerId } } });
      return { ok: true, manager: user.fullName ?? user.username };
    });
  }

  async load() {
    const users = await this.prisma.user.findMany({
      where: { status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_HEAD"] } } },
      select: { id: true, fullName: true, username: true },
    });
    const heads = await this.prisma.user.findMany({ where: { status: "ACTIVE", role: { code: "SALES_HEAD" } }, select: { id: true } });
    if (heads.length > 0) {
      await this.prisma.salesManagerProfile.createMany({ data: heads.map((u) => ({ userId: u.id, availability: "FREE", participatesInAutoDistribution: true, maxActiveRequests: 20 })), skipDuplicates: true });
    }
    const profiles = await this.prisma.salesManagerProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const rows = await Promise.all(users.map(async (u) => {
      const counts = await this.prisma.request.groupBy({ by: ["status"], where: { assignedManagerId: u.id }, _count: { _all: true } });
      const overdue = await this.prisma.request.count({ where: { assignedManagerId: u.id, status: { in: ACTIVE as never }, slaDueAt: { lt: new Date() }, firstContactAt: null } });
      const slaSoon = await this.prisma.request.count({ where: { assignedManagerId: u.id, status: { in: ACTIVE as never }, slaDueAt: { gte: new Date(), lte: new Date(Date.now() + 10 * 60_000) }, firstContactAt: null } });
      const openedNotStarted = await this.prisma.request.count({ where: { assignedManagerId: u.id, status: "NEW", firstOpenedAt: { not: null } } });
      const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
      const active = Object.entries(by).filter(([s]) => ACTIVE.includes(s)).reduce((sum, [, n]) => sum + n, 0);
      return { userId: u.id, name: u.fullName ?? u.username, availability: profileByUser.get(u.id)?.availability ?? "INACTIVE", participates: profileByUser.get(u.id)?.participatesInAutoDistribution ?? false, maxActiveRequests: profileByUser.get(u.id)?.maxActiveRequests ?? null, new: by.NEW ?? 0, processing: (by.CHECKING ?? 0) + (by.CONFIRMED ?? 0), overdue, slaSoon, openedNotStarted, active, total: counts.reduce((s, c) => s + c._count._all, 0) };
    }));
    return rows;
  }

  async unread(userId: string) {
    const [total, requests, payments, deals, whatsappLinked, whatsappUnlinked, orderEvents] = await Promise.all([
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, entityType: "Request" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, entityType: "Payment" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, type: "DEAL_CREATED" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, type: "WHATSAPP_MESSAGE_LINKED" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, type: "WHATSAPP_MESSAGE_UNLINKED" } }),
      this.prisma.userNotification.count({ where: { recipientId: userId, readAt: null, type: { startsWith: "ORDER_" } } }),
    ]);
    return { total, requests, payments, deals, whatsappLinked, whatsappUnlinked, orderEvents, whatsapp: whatsappLinked + whatsappUnlinked };
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
