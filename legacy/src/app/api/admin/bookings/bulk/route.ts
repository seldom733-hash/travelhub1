import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName, bookingSystemMessage } from "@/lib/admin-data";
import { EXECUTION_ROLES, requireRole } from "@/lib/admin-access";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

type BulkAction = "send" | "confirm" | "cancel";

// Допустимые исходные статусы и целевой статус для каждого массового действия
// (канонический жизненный цикл Baseline §0.5)
type BookingStatusValue = "NEW" | "PREPARING_REQUEST" | "SENT_TO_SUPPLIER" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "IN_SERVICE" | "COMPLETED" | "NEEDS_CLARIFICATION" | "SUPPLIER_REJECTED" | "CHANGE_REQUESTED" | "CANCELLATION_REQUESTED" | "CANCELLED" | "PROBLEM";
const TRANSITIONS: Record<BulkAction, { from: BookingStatusValue[]; to: BookingStatusValue }> = {
  send: { from: ["NEW", "PREPARING_REQUEST"], to: "SENT_TO_SUPPLIER" },
  confirm: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "CONFIRMED" },
  cancel: { from: ["NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "CONFIRMED", "IN_SERVICE"], to: "CANCELLED" },
};

/**
 * POST /api/admin/bookings/bulk
 * Тело: { action: "send" | "confirm" | "cancel", ids: string[] }
 * Выполняет действие над всеми подходящими бронями (недопустимые — пропускает),
 * атомарно пишет записи в журнал истории. Возвращает количество обработанных.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, EXECUTION_ROLES);
    if (denied) return denied;

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
        select: { id: true, status: true, code: true, orderId: true },
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
        // Outbox (Гл. 6): событие бронирования для связанного заказа.
        if (r.orderId) {
          await emitOrderEvent(
            tx,
            r.orderId,
            action === "send" ? "BOOKING_SENT_TO_SUPPLIER" : action === "confirm" ? "BOOKING_CONFIRMED" : "BOOKING_STATUS_CHANGED",
            { bookingId: r.id, bookingCode: r.code, from: r.status, to: t.to, actor: actorDisplayName(user) }
          );
        }
        count++;
      }
      return count;
    });
    await publishOrderEvents();

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
    send: "Массовая отправка запроса поставщику",
    confirm: "Массовое подтверждение",
    cancel: "Массовая отмена",
  };
  return map[action] ?? `Массовое действие: ${action}`;
}
