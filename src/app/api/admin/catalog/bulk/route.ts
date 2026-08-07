import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, CATALOG_ROLES } from "@/lib/admin-access";
import { serverErrorResponse } from "@/lib/server-error";
import { recordAudit, requestContext } from "@/lib/audit";

/**
 * Массовые операции каталога (Гл. 4.3): публикация, снятие с публикации,
 * архивирование нескольких услуг одним действием. Каждая услуга фиксируется
 * в ServiceHistory (Гл. 4.12/4.15), а сама массовая операция — в журнале
 * аудита AuditLog (Гл. 3.18).
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, CATALOG_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    const action = typeof body.action === "string" ? body.action : "";
    if (!ids.length || !["publish", "unpublish", "archive"].includes(action)) {
      return NextResponse.json({ error: "Укажите услуги и действие" }, { status: 400 });
    }
    // PARTNER не публикует напрямую (Baseline §14): только архивирование своих черновиков.
    if (user.role === "PARTNER" && action !== "archive") {
      return NextResponse.json(
        { error: "Forbidden: публикация выполняется после модерации (MODERATOR/ADMIN)" },
        { status: 403 }
      );
    }

    const actorName = `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";
    const services = await prisma.service.findMany({
      where: { id: { in: ids }, ...(user.role === "PARTNER" ? { providerId: user.id } : {}) },
      select: { id: true, status: true, version: true, providerId: true },
    });
    // PARTNER: убеждаемся, что все выбранные услуги — его (object scope).
    if (user.role === "PARTNER" && services.some((s) => s.providerId !== user.id)) {
      return NextResponse.json({ error: "Forbidden: доступ только к своим продуктам" }, { status: 403 });
    }

    const targetStatus: Record<string, string> = {
      publish: "PUBLISHED",
      unpublish: "READY",
      archive: "ARCHIVED",
    };
    const comment: Record<string, string> = {
      publish: "Массовая публикация",
      unpublish: "Массовое снятие с публикации",
      archive: "Массовое архивирование",
    };

    const updated = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const s of services) {
        const to = targetStatus[action];
        if (s.status === to) continue;
        await tx.service.update({
          where: { id: s.id },
          data: {
            status: to as never,
            isActive: to === "PUBLISHED" || to === "SUSPENDED",
            version: s.version + 1,
            ...(to === "PUBLISHED" ? { publishedAt: new Date() } : {}),
          },
        });
        await tx.serviceHistory.create({
          data: {
            serviceId: s.id,
            version: s.version + 1,
            action: action === "publish" ? "publish" : action === "archive" ? "archive" : "unpublish",
            from: s.status,
            to,
            fields: JSON.stringify(["status"]),
            actorId: user.id,
            actorName,
            comment: comment[action],
          },
        });
        count++;
      }
      return count;
    });

    // Гл. 3.18: массовая операция по каталогу фиксируется в журнале аудита.
    if (updated > 0) {
      const ctx = requestContext(request);
      await recordAudit({
        user,
        category: "Пользовательские действия",
        action: "bulk",
        objectType: "Услуга",
        toData: { action, count: updated },
        comment: `${comment[action]} — ${updated} ${updated === 1 ? "услуга" : "услуг"}`,
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        criticality: action === "archive" ? "warning" : "info",
      });
    }

    return NextResponse.json({ updated });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog bulk error");
  }
}
