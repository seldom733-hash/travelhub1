import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SERVICE_TYPE_LABELS, actorDisplayName, bookingSystemMessage } from "@/lib/admin-data";
import { pickManager, pickSource } from "@/app/api/admin/bookings/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bookings/[id]
 * Полная бронь в формате карточки (BookingRow) — для глубокой ссылки
 * из виджета «Проблемные бронирования» (?open=<id>&tab=messages).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        status: true,
        serviceDate: true,
        createdAt: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
        service: {
          select: {
            title: true,
            type: true,
            currency: true,
            country: true,
            city: true,
            provider: { select: { companyName: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
    }
    const provider = booking.service.provider;

    return NextResponse.json({
      booking: {
        id: booking.id,
        bookingNumber: `BK-${booking.id.slice(-8).toUpperCase()}`,
        orderId: booking.order?.orderNumber ?? "—",
        client: `${booking.user.firstName} ${booking.user.lastName ?? ""}`.trim(),
        partner: provider?.companyName || provider?.firstName || "—",
        provider: provider?.companyName || `${provider?.firstName ?? ""} ${provider?.lastName ?? ""}`.trim() || "—",
        service: booking.service.title,
        category: SERVICE_TYPE_LABELS[booking.service.type] || booking.service.type,
        categoryType: booking.service.type,
        direction: [booking.service.country, booking.service.city].filter(Boolean).join(" · ") || "—",
        amount: booking.amount,
        currency: booking.service.currency || "USD",
        bookingStatus: booking.status,
        paymentStatus:
          booking.status === "PAID" || booking.status === "COMPLETED"
            ? "paid"
            : booking.status === "PENDING" || booking.status === "CONFIRMED"
            ? "pending"
            : "refunded",
        manager: pickManager(booking.id),
        source: pickSource(booking.id),
        unreadCount: 0,
        createdAt: booking.createdAt.toISOString(),
        serviceDate: booking.serviceDate.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin booking GET error");
  }
}

/**
 * PATCH /api/admin/bookings/[id]
 * Тело: { action: "confirm" | "pay" | "cancel" | "complete" | "update" }
 *
 * Жизненный цикл (Гл. 5.7):
 *   PENDING   → CONFIRMED   (action: "confirm"  — подтвердить бронирование)
 *   CONFIRMED → PAID        (action: "pay"      — отправить на оплату / оплачено)
 *   PENDING   → PAID        (action: "pay"      — допускается без промежуточного шага)
 *   PAID      → COMPLETED   (action: "complete" — завершить поездку)
 *   PENDING/CONFIRMED/PAID → REFUNDED (action: "cancel" — отменить/возврат)
 *   Любой (кроме REFUNDED) → правка serviceDate/amount (action: "update")
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: { action?: unknown; serviceDate?: unknown; amount?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (typeof action !== "string" || !["confirm", "pay", "cancel", "complete", "update"].includes(action)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
    }

    // ── Действие update: правка даты поездки и/или суммы (Гл. 5.4 «Изменить») ──
    if (action === "update") {
      if (booking.status === "REFUNDED") {
        return NextResponse.json({ error: "Возвращённое бронирование нельзя редактировать" }, { status: 409 });
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
            amount: true,
            status: true,
            serviceDate: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
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
          bookingNumber: `BK-${updated.id.slice(-8).toUpperCase()}`,
          orderId: `ORD-${updated.id.slice(-6).toUpperCase()}`,
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
            updated.status === "PAID" || updated.status === "COMPLETED"
              ? "paid"
              : updated.status === "PENDING" || updated.status === "CONFIRMED"
              ? "pending"
              : "refunded",
          manager: pickManager(updated.id),
          source: pickSource(updated.id),
          unreadCount: unreadBefore,
          createdAt: updated.createdAt.toISOString(),
          serviceDate: updated.serviceDate.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }

    // Валидация перехода по жизненному циклу
    const from = booking.status;
    let to: string | null = null;
    if (action === "confirm" && from === "PENDING") to = "CONFIRMED";
    else if (action === "pay" && (from === "CONFIRMED" || from === "PENDING")) to = "PAID";
    else if (action === "complete" && from === "PAID") to = "COMPLETED";
    else if (action === "cancel" && (from === "PENDING" || from === "CONFIRMED" || from === "PAID")) to = "REFUNDED";

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
        data: { status: to as "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED" | "COMPLETED" },
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
      return u;
    });

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
    CONFIRMED: "Бронирование подтверждено",
    PAID: "Бронирование оплачено",
    COMPLETED: "Бронирование завершено",
    REFUNDED: "Бронирование отменено, средства возвращены",
  };
  return map[to] ?? `Статус обновлён: ${to}`;
}
