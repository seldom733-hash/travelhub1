import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { EXECUTION_ROLES, requireRole } from "@/lib/admin-access";
import { SERVICE_TYPE_LABELS, actorDisplayName, bookingSystemMessage } from "@/lib/admin-data";
import { pickManager, pickSource } from "@/app/api/admin/bookings/route";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/bookings/[id]
 * Тело: { action: "send" | "confirm" | "complete" | "cancel" | "update" }
 *
 * Жизненный цикл (Baseline §0.5, канонический):
 *   NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER → AWAITING_CONFIRMATION →
 *   CONFIRMED → IN_SERVICE → COMPLETED. Ветви: NEEDS_CLARIFICATION,
 *   SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM.
 *
 *   action "send"     — NEW/PREPARING_REQUEST → SENT_TO_SUPPLIER (запрос поставщику)
 *   action "confirm"  — SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → CONFIRMED
 *   action "service"  — CONFIRMED → IN_SERVICE (услуга началась)
 *   action "complete" — IN_SERVICE → COMPLETED (поездка завершена)
 *   action "reject"   — AWAITING_CONFIRMATION → SUPPLIER_REJECTED
 *   action "cancel"   — активная бронь → CANCELLED
 *   action "problem"  — активная бронь → PROBLEM
 *   Любой (кроме CANCELLED/COMPLETED) → правка serviceDate/amount (action: "update")
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, EXECUTION_ROLES);
    if (denied) return denied;

    const { id } = await params;
    let body: { action?: unknown; serviceDate?: unknown; amount?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (typeof action !== "string" || !["send", "confirm", "service", "complete", "reject", "cancel", "problem", "update"].includes(action)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
    }

    // ── Действие update: правка даты поездки и/или суммы (Гл. 5.4 «Изменить») ──
    if (action === "update") {
      if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
        return NextResponse.json({ error: "Завершённое или отменённое бронирование нельзя редактировать" }, { status: 409 });
      }
      const data: { serviceDate?: Date; amount?: number } = {};
      const serviceDateRaw = typeof body.serviceDate === "string" ? new Date(body.serviceDate) : null;
      const amountRaw = typeof body.amount === "number" ? body.amount : null;

      if (serviceDateRaw !== null) {
        if (isNaN(serviceDateRaw.getTime())) {
          return NextResponse.json({ error: "Некорректная дата поездки" }, { status: 400 });
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (serviceDateRaw.getTime() < todayStart.getTime()) {
          return NextResponse.json({ error: "Дата поездки не может быть в прошлом" }, { status: 400 });
        }
        data.serviceDate = serviceDateRaw;
      }
      if (amountRaw !== null) {
        if (!isFinite(amountRaw) || amountRaw <= 0) {
          return NextResponse.json({ error: "Сумма должна быть больше нуля" }, { status: 400 });
        }
        data.amount = Math.round(amountRaw * 100) / 100;
      }
      if (!data.serviceDate && !data.amount) {
        return NextResponse.json({ error: "Укажите новую дату или сумму" }, { status: 400 });
      }

      // Правка брони + запись в журнал истории — атомарно
      const unreadBefore = await prisma.bookingMessage.count({
        where: { bookingId: id, senderRole: { in: ["system", "manager"] }, isRead: false },
      });
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.booking.update({
          where: { id },
          data,
          select: {
            id: true,
            code: true,
            amount: true,
            status: true,
            serviceDate: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            order: { select: { orderNumber: true } },
            service: {
              select: {
                title: true,
                type: true,
                currency: true,
                country: true,
                countryCode: true,
                city: true,
                provider: { select: { companyName: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        await tx.bookingHistory.create({
          data: {
            bookingId: id,
            action: "update",
            from: null,
            to: null,
            fields: JSON.stringify({
              ...(data.serviceDate ? { serviceDate: data.serviceDate.toISOString() } : {}),
              ...(data.amount ? { amount: data.amount } : {}),
            }),
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: "Изменены дата поездки и/или сумма",
          },
        });
        return u;
      });

      return NextResponse.json({
        ok: true,
        message: "Бронирование изменено",
        booking: {
          id: updated.id,
          bookingNumber: updated.code,
          orderId: updated.order?.orderNumber ?? "—",
          client: `${updated.user.firstName} ${updated.user.lastName ?? ""}`.trim(),
          partner: updated.service.provider?.companyName || updated.service.provider?.firstName || "—",
          provider: updated.service.provider?.companyName || `${updated.service.provider?.firstName ?? ""} ${updated.service.provider?.lastName ?? ""}`.trim() || "—",
          service: updated.service.title,
          category: SERVICE_TYPE_LABELS[updated.service.type] || updated.service.type,
          categoryType: updated.service.type,
          direction: [updated.service.country, updated.service.city].filter(Boolean).join(" · ") || "—",
          amount: updated.amount,
          currency: updated.service.currency || "USD",
          bookingStatus: updated.status,
          paymentStatus:
            updated.status === "CONFIRMED" || updated.status === "IN_SERVICE" || updated.status === "COMPLETED"
              ? "paid"
              : updated.status === "CANCELLED" || updated.status === "CANCELLATION_REQUESTED"
              ? "refunded"
              : "pending",
          manager: pickManager(updated.id),
          source: pickSource(updated.id),
          unreadCount: unreadBefore,
          createdAt: updated.createdAt.toISOString(),
          serviceDate: updated.serviceDate.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }

    // Валидация перехода по жизненному циклу (Baseline §0.5)
    const from = booking.status;
    let to: string | null = null;
    if (action === "send" && (from === "NEW" || from === "PREPARING_REQUEST")) to = "SENT_TO_SUPPLIER";
    else if (action === "confirm" && (from === "SENT_TO_SUPPLIER" || from === "AWAITING_CONFIRMATION")) to = "CONFIRMED";
    else if (action === "service" && from === "CONFIRMED") to = "IN_SERVICE";
    else if (action === "complete" && from === "IN_SERVICE") to = "COMPLETED";
    else if (action === "reject" && from === "AWAITING_CONFIRMATION") to = "SUPPLIER_REJECTED";
    else if (action === "problem" && from !== "CANCELLED" && from !== "COMPLETED") to = "PROBLEM";
    else if (action === "cancel" && from !== "CANCELLED" && from !== "COMPLETED") to = "CANCELLED";

    if (!to) {
      return NextResponse.json(
        { error: `Переход ${from} → ${action} недопустим в текущем жизненном цикле` },
        { status: 409 }
      );
    }

    // Смена статуса + запись в журнал истории — атомарно
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.booking.update({
        where: { id },
        data: { status: to as never },
        select: { id: true, status: true, amount: true, updatedAt: true },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId: id,
          action,
          from,
          to,
          actorId: user.id,
          actorName: actorDisplayName(user),
          comment: bookingStatusMessage(to),
        },
      });
      // Автоматическое системное сообщение в переписку (Гл. 5.9)
      await tx.bookingMessage.create({
        data: {
          bookingId: id,
          senderId: null,
          senderName: "Система",
          senderRole: "system",
          text: bookingSystemMessage(to),
        },
      });
      // Outbox (Гл. 6): событие бронирования пишется атомарно с переходом;
      // привязка к заказу позволяет Booking Center синхронизировать заказ.
      if (booking.orderId) {
        await emitOrderEvent(
          tx,
          booking.orderId,
          action === "send" ? "BOOKING_SENT_TO_SUPPLIER" : action === "confirm" ? "BOOKING_CONFIRMED" : "BOOKING_STATUS_CHANGED",
          { bookingId: id, bookingCode: booking.code, from, to, actor: actorDisplayName(user) }
        );
      }
      return u;
    });
    await publishOrderEvents();

    return NextResponse.json({
      ok: true,
      booking: {
        id: updated.id,
        status: updated.status,
        from,
        amount: updated.amount,
        updatedAt: updated.updatedAt,
      },
      message: bookingStatusMessage(to),
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin booking PATCH error");
  }
}

function bookingStatusMessage(to: string): string {
  const map: Record<string, string> = {
    SENT_TO_SUPPLIER: "Запрос отправлен поставщику",
    CONFIRMED: "Бронирование подтверждено",
    IN_SERVICE: "Услуга началась — бронь в поездке",
    COMPLETED: "Бронирование завершено",
    SUPPLIER_REJECTED: "Поставщик отклонил запрос",
    CANCELLED: "Бронирование отменено",
    PROBLEM: "Бронирование переведено в проблемные",
  };
  return map[to] ?? `Статус обновлён: ${to}`;
}
