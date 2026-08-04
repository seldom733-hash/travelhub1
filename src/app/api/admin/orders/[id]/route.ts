import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SERVICE_TYPE_LABELS, actorDisplayName, orderSystemMessage, pickManager } from "@/lib/admin-data";
import { pickSource, orderPaymentStatus, worstBookingStatus } from "@/app/api/admin/orders/route";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// Жизненный цикл заказа (Гл. 6.10): допустимые переходы по действию.
// Действия UI: confirm (подтвердить), pay (оплатить), complete (завершить),
// cancel (отменить), refund (возврат), archive (архивировать), update (правка).
const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  confirm: { from: ["AWAITING_CONFIRMATION", "PROCESSING"], to: "CONFIRMED" },
  pay: { from: ["CONFIRMED", "AWAITING_PAYMENT", "PARTIALLY_PAID"], to: "PAID" },
  complete: { from: ["PAID", "DOCUMENT_PREP", "READY"], to: "COMPLETED" },
  cancel: {
    from: [
      "DRAFT",
      "CREATED",
      "PROCESSING",
      "AWAITING_CONFIRMATION",
      "CONFIRMED",
      "AWAITING_PAYMENT",
      "PARTIALLY_PAID",
      "PAID",
      "DOCUMENT_PREP",
      "READY",
      "CHANGED",
      "OVERDUE",
    ],
    to: "CANCELLED",
  },
  refund: { from: ["PAID", "PARTIALLY_PAID", "DOCUMENT_PREP", "READY", "AWAITING_PAYMENT"], to: "REFUNDED" },
  archive: { from: ["COMPLETED", "CANCELLED", "REFUNDED"], to: "ARCHIVED" },
};

/**
 * GET /api/admin/orders/[id] — полная карточка заказа (Гл. 6.9):
 * заказ + клиент + состав (брони с услугами и поставщиками).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
        bookings: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            amount: true,
            serviceDate: true,
            createdAt: true,
            updatedAt: true,
            service: {
              select: {
                id: true,
                title: true,
                type: true,
                currency: true,
                price: true,
                discountPrice: true,
                country: true,
                city: true,
                provider: { select: { companyName: true, firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const provider = order.bookings[0]?.service.provider;
    const main = order.bookings[0];
    const svc = main?.service;
    const paidBookingAmount = order.bookings
      .filter((b) => b.status === "PAID" || b.status === "COMPLETED")
      .reduce((a, b) => a + b.amount, 0);
    // Поля карточки должны совпадать с реестром (orders/route.ts): те же хелперы,
    // чтобы карточка из «Моих задач» и из таблицы выглядела идентично.
    const serviceDate = order.serviceDate
      ? order.serviceDate
      : order.bookings.length
      ? new Date(Math.min(...order.bookings.map((b) => b.serviceDate.getTime())))
      : null;

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        client: `${order.user.firstName} ${order.user.lastName ?? ""}`.trim(),
        clientEmail: order.user.email,
        clientPhone: order.user.phone || "—",
        clientSince: order.user.createdAt.toISOString(),
        partner: provider?.companyName || provider?.firstName || "—",
        provider: provider?.companyName || `${provider?.firstName ?? ""} ${provider?.lastName ?? ""}`.trim() || "—",
        service: svc?.title || "—",
        category: svc ? SERVICE_TYPE_LABELS[svc.type] || svc.type : "—",
        categoryType: svc?.type || "",
        servicesCount: order.bookings.length,
        bookingsCount: order.bookings.length,
        bookingStatus: worstBookingStatus(order.bookings.map((b) => b.status)),
        paymentStatus: orderPaymentStatus(order.status),
        status: order.status,
        currency: order.currency || "USD",
        amount: order.amount,
        paidAmount: order.paidAmount,
        commission: Math.round((order.paidAmount || paidBookingAmount) * 0.12),
        serviceDate: serviceDate ? serviceDate.toISOString() : null,
        source: order.source || pickSource(order.id),
        manager: pickManager(order.id),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        bookings: order.bookings.map((b) => ({
          id: b.id,
          bookingNumber: `BK-${b.id.slice(-8).toUpperCase()}`,
          service: b.service.title,
          category: SERVICE_TYPE_LABELS[b.service.type] || b.service.type,
          categoryType: b.service.type,
          status: b.status,
          amount: b.amount,
          currency: b.service.currency || "USD",
          serviceDate: b.serviceDate.toISOString(),
          createdAt: b.createdAt.toISOString(),
          direction: [b.service.country, b.service.city].filter(Boolean).join(" · ") || "—",
        })),
        financial: {
          totalAmount: order.amount,
          paidAmount: order.paidAmount || paidBookingAmount,
          pendingAmount: Math.max(0, Math.round((order.amount - (order.paidAmount || paidBookingAmount)) * 100) / 100),
          commission: Math.round((order.paidAmount || paidBookingAmount) * 0.12),
          expectedPayouts: Math.round((order.paidAmount || paidBookingAmount) * 0.88),
        },
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin order GET error");
  }
}

/**
 * PATCH /api/admin/orders/[id]
 * Тело: { action: "confirm" | "pay" | "complete" | "cancel" | "refund" | "archive" | "update" }
 * Для update: { action: "update", serviceDate?, amount? }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const { id } = await params;
    let body: { action?: unknown; serviceDate?: unknown; amount?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (typeof action !== "string" || !["confirm", "pay", "complete", "cancel", "refund", "archive", "update"].includes(action)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    // ── Правка даты поездки и/или суммы (Гл. 6.4 «Изменить заказ») ──
    if (action === "update") {
      if (["COMPLETED", "REFUNDED", "CANCELLED", "ARCHIVED"].includes(order.status)) {
        return NextResponse.json({ error: "Закрытый заказ нельзя редактировать" }, { status: 409 });
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

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.order.update({
          where: { id },
          data,
          select: { id: true, amount: true, status: true, serviceDate: true, createdAt: true, updatedAt: true },
        });
        await tx.orderHistory.create({
          data: {
            orderId: id,
            action: "update",
            from: order.status,
            to: order.status === "CREATED" ? "CHANGED" : order.status,
            fields: JSON.stringify({
              ...(data.serviceDate ? { serviceDate: data.serviceDate.toISOString() } : {}),
              ...(data.amount ? { amount: data.amount } : {}),
            }),
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: "Изменены дата поездки и/или сумма",
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: "Заказ изменён менеджером ✏️",
          },
        });
        return u;
      });

      return NextResponse.json({
        ok: true,
        message: "Заказ изменён",
        order: {
          id: updated.id,
          amount: updated.amount,
          status: updated.status,
          serviceDate: updated.serviceDate ? updated.serviceDate.toISOString() : null,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }

    // ── Статусные переходы по жизненному циклу ──
    const t = TRANSITIONS[action];
    if (!t.from.includes(order.status)) {
      return NextResponse.json(
        { error: `Переход «${action}» недопустим для статуса ${order.status}` },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Оплата/возврат: синхронизируем paidAmount в том же обновлении, чтобы
      // ответ содержал актуальное значение (Гл. 6.5 «Оплаченные заказы»)
      const data = {
        status: t.to as "AWAITING_CONFIRMATION" | "CONFIRMED" | "PAID" | "COMPLETED" | "CANCELLED" | "REFUNDED" | "ARCHIVED",
        ...(action === "pay" ? { paidAmount: order.amount } : action === "refund" ? { paidAmount: 0 } : {}),
      };
      const u = await tx.order.update({
        where: { id },
        data,
        select: { id: true, status: true, amount: true, paidAmount: true, updatedAt: true },
      });
      await tx.orderHistory.create({
        data: {
          orderId: id,
          action,
          from: order.status,
          to: t.to,
          actorId: user.id,
          actorName: actorDisplayName(user),
          comment: orderStatusActionComment(action),
        },
      });
      await tx.orderMessage.create({
        data: {
          orderId: id,
          senderId: null,
          senderName: "Система",
          senderRole: "system",
          text: orderSystemMessage(t.to),
        },
      });
      return u;
    });

    return NextResponse.json({
      ok: true,
      message: orderStatusActionComment(action),
      order: {
        id: updated.id,
        status: updated.status,
        from: order.status,
        amount: updated.amount,
        paidAmount: updated.paidAmount,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin order PATCH error");
  }
}

function orderStatusActionComment(action: string): string {
  const map: Record<string, string> = {
    confirm: "Заказ подтверждён",
    pay: "Заказ оплачен",
    complete: "Заказ завершён",
    cancel: "Заказ отменён",
    refund: "Оформлен возврат средств",
    archive: "Заказ архивирован",
  };
  return map[action] ?? `Статус обновлён: ${action}`;
}
