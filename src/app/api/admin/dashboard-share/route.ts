import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { ALL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/**
 * Совместный доступ к Dashboard (Гл. 1.40): администратор выбирает получателей
 * из списка сотрудников, система формирует ссылку с закодированным макетом
 * пространства. Получатель открывает ссылку и применяет макет одним кликом.
 *
 * GET /api/admin/dashboard-share — список сотрудников для выбора получателей
 *   (админ-роли + менеджеры продаж/операторы — те, кто видит дашборд).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, ALL_ADMIN_ROLES);
    if (denied) return denied;

    const staff = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "DIRECTOR", "SALES_MANAGER", "OPERATOR", "MODERATOR", "FINANCE", "MARKETER", "ANALYST"] } },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    return NextResponse.json({
      items: staff.map((u) => ({
        id: u.id,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    return serverErrorResponse(error, "Dashboard share API error");
  }
}
