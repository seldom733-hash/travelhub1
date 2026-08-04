import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/messages/read
 * Помечает все непрочитанные сообщения заказа (senderRole = system/manager) как
 * прочитанные — счётчик «требует внимания» в таблице и на вкладке сбрасывается (Гл. 6.6).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const { id } = await params;
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const res = await prisma.orderMessage.updateMany({
      where: {
        orderId: id,
        senderRole: { in: ["system", "manager"] },
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true, marked: res.count });
  } catch (error) {
    return serverErrorResponse(error, "Admin order messages read error");
  }
}
