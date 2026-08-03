import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName, bookingSystemMessage } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

type BulkAction = "confirm" | "pay" | "cancel";

// Допустимые исходные статусы и целевой статус для каждого массового действия
type BookingStatusValue = "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED" | "COMPLETED";
const TRANSITIONS: Record<BulkAction, { from: BookingStatusValue[]; to: BookingStatusValue }> = {
  confirm: { from: ["PENDING"], to: "CONFIRMED" },
  pay: { from: ["PENDING", "CONFIRMED"], to: "PAID" },
  cancel: { from: ["PENDING", "CONFIRMED", "PAID"], to: "REFUNDED" },
};

/**
 * POST /api/admin/bookings/bulk
 * Тело: { action: "confirm" | "pay" | "cancel", ids: string[] }
 * Выполняет действие над всеми подходящими бронями (недопустимые — пропускает),
 * атомарно пишет записи в журнал истории. Возвращает количество обработанных.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { action?: unknown; ids?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (typeof action !== "string" || !(action in TRANSITIONS)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }
    if (!Array.isArray(body.ids) || !body.ids.length) {
      return NextResponse.json({ error: "Не выбраны бронирования" }, { status: 400 });
    }
    const ids = [...new Set(body.ids.filter((x): x is string => typeof x === "string"))].slice(0, MAX_IDS);
    if (!ids.length) {
      return NextResponse.json({ error: "Не выбраны бронирования" }, { status: 400 });
    }

    const t = TRANSITIONS[action as BulkAction];

    const processed = await prisma.$transaction(async (tx) => {
      const rows = await tx.booking.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      });
      let count = 0;
      for (const r of rows) {
        if (!t.from.includes(r.status)) continue;
        await tx.booking.update({ where: { id: r.id }, data: { status: t.to } });
        await tx.bookingHistory.create({
          data: {
            bookingId: r.id,
            action,
            from: r.status,
            to: t.to,
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: bulkMessage(action),
          },
        });
        // Автоматическое системное сообщение в переписку (Гл. 5.9)
        await tx.bookingMessage.create({
          data: {
            bookingId: r.id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: bookingSystemMessage(t.to),
          },
        });
        count++;
      }
      return count;
    });

    const skipped = ids.length - processed;
    return NextResponse.json({
      ok: true,
      message:
        processed > 0
          ? `Обработано: ${processed}${skipped ? `, не обработано: ${skipped} (недопустимый статус или не найдено)` : ""}`
          : "Нет бронирований, для которых действие допустимо",
      processed,
      skipped,
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin bookings bulk error");
  }
}

function bulkMessage(action: string): string {
  const map: Record<string, string> = {
    confirm: "Массовое подтверждение",
    pay: "Массовая отправка на оплату",
    cancel: "Массовая отмена",
  };
  return map[action] ?? `Массовое действие: ${action}`;
}
