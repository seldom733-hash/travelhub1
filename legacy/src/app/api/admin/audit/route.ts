import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, FULL_ADMIN_ROLES } from "@/lib/admin-access";
import { serverErrorResponse } from "@/lib/server-error";
import { PeriodKey, periodRange } from "@/lib/admin-data";
import { AUDIT_CATEGORIES, AUDIT_ACTION_LABELS, AUDIT_CRITICALITY, AUDIT_SOURCES } from "@/lib/audit-meta";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Журнал аудита (Гл. 3.18): централизованный реестр значимых действий.
 *
 * GET /api/admin/audit — список с фильтрами и KPI-панелью:
 *   period, from, to, category, action, criticality, source, actorName,
 *   search (номер события, номер объекта, комментарий), sort, page, limit
 * POST /api/admin/audit — запись события (используется сервисами платформы
 *   и администратором для ручного внесения системных записей).
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as PeriodKey;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const category = searchParams.get("category") || "";
    const action = searchParams.get("action") || "";
    const criticality = searchParams.get("criticality") || "";
    const source = searchParams.get("source") || "";
    const actorName = searchParams.get("actorName")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";
    const sort = searchParams.get("sort") || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const range = periodRange(period as never, from, to);

    const where: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
    if (category) where.category = category;
    if (action) where.action = action;
    if (criticality) where.criticality = criticality;
    if (source) where.source = source;
    if (actorName) where.actorName = { contains: actorName };
    if (search) {
      where.OR = [
        { eventId: { contains: search } },
        { objectNumber: { contains: search } },
        { comment: { contains: search } },
        { actorName: { contains: search } },
        { objectType: { contains: search } },
      ];
    }

    const [total, rows, todayCount, criticalCount, byCategory, actors] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          ...(category ? { category } : {}),
        },
      }),
      prisma.auditLog.count({ where: { ...where, criticality: { in: ["error", "critical"] } } }),
      prisma.auditLog.groupBy({ by: ["category"], where, _count: true }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        distinct: ["actorName"],
        select: { actorName: true },
        orderBy: { actorName: "asc" },
        take: 200,
      }),
    ]);

    const categoryCounts: Record<string, number> = {};
    for (const c of byCategory) categoryCounts[c.category] = c._count;

    // ── KPI (Гл. 3.18) ──
    const kpi = {
      total: { value: total, detail: "Событий в периоде" },
      today: { value: todayCount, detail: "За сегодня" },
      critical: { value: criticalCount, detail: "Ошибки и критические" },
      byCategory: AUDIT_CATEGORIES.map((c) => ({
        category: c,
        count: categoryCounts[c] ?? 0,
      })),
    };

    const list = rows.map((r) => {
      let fromData: Record<string, unknown> | null = null;
      let toData: Record<string, unknown> | null = null;
      try {
        fromData = r.fromData ? (JSON.parse(r.fromData) as Record<string, unknown>) : null;
      } catch {
        fromData = null;
      }
      try {
        toData = r.toData ? (JSON.parse(r.toData) as Record<string, unknown>) : null;
      } catch {
        toData = null;
      }
      return {
        id: r.id,
        eventId: r.eventId,
        actorName: r.actorName,
        actorRole: r.actorRole,
        department: r.department,
        category: r.category,
        action: r.action,
        actionLabel: AUDIT_ACTION_LABELS[r.action] ?? r.action,
        objectType: r.objectType,
        objectId: r.objectId,
        objectNumber: r.objectNumber,
        fromData,
        toData,
        comment: r.comment,
        source: r.source,
        ip: r.ip,
        userAgent: r.userAgent,
        criticality: r.criticality,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      kpi,
      list,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      filters: {
        categories: AUDIT_CATEGORIES.map((c) => ({ value: c, label: c })),
        actions: Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
        criticality: AUDIT_CRITICALITY.map((c) => ({ value: c.key, label: c.label })),
        sources: AUDIT_SOURCES.map((s) => ({ value: s, label: s })),
        actors: actors.map((a) => a.actorName).filter(Boolean),
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin audit API error");
  }
}

/**
 * POST /api/admin/audit — ручная запись системного события в журнал аудита
 * (Гл. 3.18). Тело: { category, action, objectType?, objectNumber?, comment?, criticality? }
 * Используется администраторами для внесения служебных записей; автоматическая
 * регистрация действий выполняется через recordAudit() в самих API-роутах.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const category = typeof body.category === "string" ? body.category : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (!category || !action) {
      return NextResponse.json({ error: "Укажите категорию и действие" }, { status: 400 });
    }

    const ctx = requestContext(request);
    await recordAudit({
      user,
      category,
      action,
      objectType: typeof body.objectType === "string" ? body.objectType : undefined,
      objectNumber: typeof body.objectNumber === "string" ? body.objectNumber : undefined,
      comment: typeof body.comment === "string" ? body.comment : undefined,
      criticality: typeof body.criticality === "string" ? body.criticality : "info",
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Событие записано в журнал аудита" }, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error, "Admin audit POST error");
  }
}
