import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/bookings/[id]/messages/read
 * Помечает все непрочитанные сообщения брони (senderRole = system/manager) как
 * прочитанные — счётчик «требует внимания» на вкладке и в таблице сбрасывается.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } });
    if (!booking) {
      return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
    }

    const res = await prisma.bookingMessage.updateMany({
      where: {
        bookingId: id,
        senderRole: { in: ["system", "manager"] },
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true, marked: res.count });
  } catch (error) {
    return serverErrorResponse(error, "Admin booking messages read error");
  }
}
