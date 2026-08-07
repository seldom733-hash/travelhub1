import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { prisma } from "@/lib/prisma";
import { getRecentOrderEvents, ORDER_EVENT_LABELS, ORDER_EVENT_ICONS } from "@/lib/events";
import { ORDER_STATUS_LABELS, BOOKING_STATUS_LABELS } from "@/lib/admin-data";
import { DASHBOARD_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/events?limit=30
 * Лента доменных событий из outbox (Гл. 6 «Событийная модель»): последние события
 * Order Center с данными заказа. Используется в блоке «Последние события» (Гл. 5.3)
 * и для мониторинга публикации событий (PENDING/PUBLISHED/FAILED).
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = requireRole(user, DASHBOARD_ROLES);
    if (denied) return denied;

    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "30");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;

    const rows = await getRecentOrderEvents(limit);
    const items = rows.map((ev) => {
      const p = (ev.payload ?? {}) as { from?: string; to?: string; amount?: number; bookingCode?: string; saleCode?: string; orderNumber?: string };
      const label = (code?: string) =>
        code ? (ORDER_STATUS_LABELS[code] ?? BOOKING_STATUS_LABELS[code] ?? code) : "";
      const from = label(p.from);
      const to = label(p.to);
      return {
        id: ev.id,
        orderId: ev.orderId,
        orderNumber: ev.order?.orderNumber ?? p.orderNumber ?? "—",
        orderStatus: ev.order?.status ?? "—",
        type: ev.type,
        label: ORDER_EVENT_LABELS[ev.type] ?? ev.type,
        icon: ORDER_EVENT_ICONS[ev.type] ?? "🔄",
        from,
        to,
        amount: typeof p.amount === "number" ? p.amount : null,
        bookingCode: p.bookingCode ?? null,
        saleCode: typeof p.saleCode === "string" ? p.saleCode : null,
        status: ev.status,
        createdAt: ev.createdAt.toISOString(),
        href: ev.orderId ? `/admin/sales-execution?open=${ev.orderId}&tab=overview` : "/admin/sales",
      };
    });

    // Статистика outbox: сколько событий опубликовано / ожидает / упало.
    const [published, pending, failed] = await Promise.all([
      prisma.orderEvent.count({ where: { status: "PUBLISHED" } }),
      prisma.orderEvent.count({ where: { status: "PENDING" } }),
      prisma.orderEvent.count({ where: { status: "FAILED" } }),
    ]);

    return NextResponse.json({ items, counts: { published, pending, failed } });
  } catch (error) {
    return serverErrorResponse(error, "Admin events error");
  }
}
