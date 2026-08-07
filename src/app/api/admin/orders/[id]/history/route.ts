import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders/[id]/history
 * Журнал изменений заказа (вкладка «История изменений», Гл. 6.9).
 * Возвращает записи от новых к старым.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const rows = await prisma.orderHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        from: true,
        to: true,
        fields: true,
        actorName: true,
        comment: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      history: rows.map((r) => {
        let fields: Record<string, unknown> | null = null;
        if (r.fields) {
          try {
            fields = JSON.parse(r.fields) as Record<string, unknown>;
          } catch {
            fields = null;
          }
        }
        return {
          id: r.id,
          action: r.action,
          from: r.from,
          to: r.to,
          fields,
          actorName: r.actorName,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin order history GET error");
  }
}
