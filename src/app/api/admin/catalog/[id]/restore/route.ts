import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, FULL_ADMIN_ROLES } from "@/lib/admin-access";
import { serverErrorResponse } from "@/lib/server-error";
import { recordAudit, requestContext } from "@/lib/audit";
import type { ServiceStatus } from "@/generated/prisma/enums";

/**
 * Восстановление версии карточки услуги (Гл. 4.12 «Восстановление версии»):
 * POST /api/admin/catalog/[id]/restore { version, comment }
 *
 * Переносит статус жизненного цикла выбранной редакции в текущую карточку,
 * создаёт новую редакцию (version + 1), сохраняет историю восстановления
 * и уведомляет ответственного менеджера записью в журнале.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const version = typeof body.version === "number" ? Math.floor(body.version) : 0;
    const comment = typeof body.comment === "string" && body.comment.trim() ? body.comment.trim() : "Восстановление предыдущей редакции";

    const [service, target] = await Promise.all([
      prisma.service.findUnique({ where: { id } }),
      prisma.serviceHistory.findFirst({
        where: { serviceId: id, version },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!service) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    if (!target) return NextResponse.json({ error: "Версия не найдена" }, { status: 404 });
    if (version >= service.version) {
      return NextResponse.json({ error: "Можно восстановить только предыдущую редакцию" }, { status: 400 });
    }

    const actorName = `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";

    const restored = await prisma.$transaction(async (tx) => {
      const nextVersion = service.version + 1;
      const targetStatus = (target.to as string | null) ?? service.status;
      const VALID: ServiceStatus[] = ["DRAFT", "REVIEW", "READY", "PUBLISHED", "SUSPENDED", "ARCHIVED"];
      const status: ServiceStatus = VALID.includes(targetStatus as ServiceStatus) ? (targetStatus as ServiceStatus) : service.status;
      const svc = await tx.service.update({
        where: { id },
        data: {
          status,
          isActive: status === "PUBLISHED" || status === "SUSPENDED",
          version: nextVersion,
          updatedAt: new Date(),
        },
        select: { id: true, code: true, title: true, status: true, version: true },
      });
      await tx.serviceHistory.create({
        data: {
          serviceId: id,
          version: nextVersion,
          action: "restore",
          from: service.status,
          to: status,
          fields: JSON.stringify(["status", "version"]),
          actorId: user.id,
          actorName,
          comment: `Восстановлена редакция v${version} — ${comment}`,
        },
      });
      return svc;
    });

    // Гл. 3.18: восстановление редакции фиксируется в журнале аудита.
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: "status",
      objectType: "Услуга",
      objectId: id,
      objectNumber: service.code,
      fromData: { status: service.status, version: service.version },
      toData: { status: restored.status, version: restored.version },
      comment: `Восстановлена редакция v${version} — ${comment}`,
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      criticality: "info",
    });

    return NextResponse.json({ service: restored });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog restore error");
  }
}
