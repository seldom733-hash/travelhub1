import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { DASHBOARD_ROLES, FULL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Шаблоны Dashboard (Гл. 1.36): администратор создаёт макет для роли,
 * каждый сотрудник этой роли получает его как стартовый.
 *
 * GET  /api/admin/dashboard-templates?role=… — список шаблонов (фильтр по роли)
 * POST /api/admin/dashboard-templates — создать/обновить шаблон
 *   { role, name, layout }  (layout — JSON LayoutState или "workspace:<key>")
 * DELETE /api/admin/dashboard-templates?id=… — удалить шаблон
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Чтение доступно всем ролям админки: авто-применение шаблона роли (Гл. 1.36)
    // выполняется на клиенте для любого сотрудника, не только администратора.
    const denied = requireRole(user, DASHBOARD_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "";
    const rows = await prisma.dashboardTemplate.findMany({
      where: role ? { role } : {},
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ items: rows });
  } catch (error) {
    return serverErrorResponse(error, "Dashboard templates API error");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const body = (await request.json()) as { role?: string; name?: string; layout?: string; id?: string };
    const role = (body.role || "").trim().toUpperCase();
    const name = (body.name || "").trim();
    const layout = (body.layout || "").trim();
    if (!role || !name || !layout) {
      return NextResponse.json({ error: "role, name и layout обязательны" }, { status: 400 });
    }

    // Если передан id — обновляем существующий шаблон, иначе создаём новый.
    const existing = body.id
      ? await prisma.dashboardTemplate.findUnique({ where: { id: body.id } })
      : await prisma.dashboardTemplate.findUnique({ where: { role_name: { role, name } } });

    const data = {
      role,
      name,
      layout,
      createdBy: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.email,
    };

    let item;
    if (body.id && existing) {
      item = await prisma.dashboardTemplate.update({ where: { id: body.id }, data });
    } else if (existing) {
      // Совпадение (role, name) — обновляем макет, чтобы не плодить дубли
      item = await prisma.dashboardTemplate.update({ where: { id: existing.id }, data });
    } else {
      item = await prisma.dashboardTemplate.create({ data });
    }

    await recordAudit({
      category: "Пользовательские действия",
      action: "update",
      objectType: "DashboardTemplate",
      objectId: item.id,
      comment: `Шаблон Dashboard «${item.name}» для роли ${item.role}${body.id ? " обновлён" : " создан"}`,
      ...requestContext(request),
    });

    return NextResponse.json({ item });
  } catch (error) {
    return serverErrorResponse(error, "Dashboard templates API error");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, FULL_ADMIN_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

    const item = await prisma.dashboardTemplate.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

    await prisma.dashboardTemplate.delete({ where: { id } });
    await recordAudit({
      category: "Пользовательские действия",
      action: "delete",
      objectType: "DashboardTemplate",
      objectId: id,
      comment: `Шаблон Dashboard «${item.name}» для роли ${item.role} удалён`,
      ...requestContext(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverErrorResponse(error, "Dashboard templates API error");
  }
}
