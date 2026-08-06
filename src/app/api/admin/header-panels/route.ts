import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { getDashboardMessages } from "@/lib/dashboard-messages";
import { ALL_ADMIN_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/** Ключ дня по local-дате (YYYY-MM-DD), как в календаре дашборда. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * GET /api/admin/header-panels
 * Лёгкие данные для выпадающих панелей верхней панели (Гл. 1.5):
 * сообщения (1.24) и компактный календарь заказов (1.25). Отдельный эндпоинт,
 * чтобы шапка не тянула весь дашборд.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, ALL_ADMIN_ROLES);
    if (denied) return denied;

    const [messages, calendarRows] = await Promise.all([
      getDashboardMessages(),
      prisma.order.findMany({
        orderBy: { serviceDate: "asc" },
        take: 30,
        select: {
          id: true,
          orderNumber: true,
          serviceDate: true,
          status: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const now = new Date();
    const todayKey = dayKey(now);
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowKey = dayKey(tomorrow);

    const calendar = {
      today: calendarRows.filter((o) => o.serviceDate && dayKey(new Date(o.serviceDate)) === todayKey),
      tomorrow: calendarRows.filter((o) => o.serviceDate && dayKey(new Date(o.serviceDate)) === tomorrowKey),
      overdue: calendarRows.filter((o) => o.serviceDate && new Date(o.serviceDate).getTime() < now.getTime()),
    };

    return NextResponse.json({ messages, calendar });
  } catch (error) {
    return serverErrorResponse(error, "Header panels API error");
  }
}
