import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName, orderSystemMessage } from "@/lib/admin-data";
import { recordAudit, requestContext } from "@/lib/audit";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";
import { SALES_ROLES, ORDER_LIFECYCLE_ROLES, ORDER_PAYMENT_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

type BulkAction = "confirm" | "send" | "complete" | "close" | "cancel" | "pay" | "refund" | "assign_manager" | "set_priority";

const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Допустимые исходные статусы и целевой статус для каждого массового действия
// (канонический жизненный цикл Baseline §0.4).
type OrderStatusValue =
  | "NEW" | "IN_PROCESSING" | "WAITING_FOR_DATA" | "READY_FOR_BOOKING" | "SENT_TO_BOOKING"
  | "PARTIALLY_FULFILLED" | "FULFILLED" | "READY_TO_CLOSE" | "CLOSED"
  | "CANCELLED" | "PROBLEM" | "SUSPENDED";

type OrderPaymentValue = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";

const TRANSITIONS: Record<Exclude<BulkAction, "assign_manager" | "set_priority" | "pay" | "refund">, { from: OrderStatusValue[]; to: OrderStatusValue }> = {
  confirm: { from: ["IN_PROCESSING", "WAITING_FOR_DATA"], to: "READY_FOR_BOOKING" },
  send: { from: ["READY_FOR_BOOKING"], to: "SENT_TO_BOOKING" },
  complete: { from: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"], to: "FULFILLED" },
  close: { from: ["FULFILLED", "READY_TO_CLOSE"], to: "CLOSED" },
  cancel: {
    from: [
      "NEW",
      "IN_PROCESSING",
      "WAITING_FOR_DATA",
      "READY_FOR_BOOKING",
      "SENT_TO_BOOKING",
      "PARTIALLY_FULFILLED",
      "FULFILLED",
      "READY_TO_CLOSE",
      "PROBLEM",
      "SUSPENDED",
    ],
    to: "CANCELLED",
  },
};

/**
 * POST /api/admin/orders/bulk
 * Тело: { action: "confirm" | "pay" | "complete" | "cancel" | "archive", ids: string[] }
 * Выполняет действие над всеми подходящими заказами (недопустимые — пропускает),
 * атомарно пишет записи в журнал истории. Возвращает количество обработанных.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Раздел «Продажи» (SALES_ROLES); финансовые и lifecycle-действия — по своим матрицам.
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    let body: { action?: unknown; ids?: unknown; value?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    const isAssignManager = action === "assign_manager";
    const isSetPriority = action === "set_priority";
    const isFinancial = action === "pay" || action === "refund";
    if (
      typeof action !== "string" ||
      !(isAssignManager || isSetPriority || isFinancial || action in TRANSITIONS)
    ) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }
    // Action-level RBAC (RBAC Matrix): lifecycle-переходы и финансовые операции
    // разрешены только ролям из соответствующих матриц.
    if (isFinancial) {
      const finDenied = requireRole(user, ORDER_PAYMENT_ROLES);
      if (finDenied) return finDenied;
    } else if (!isAssignManager && !isSetPriority) {
      const lcDenied = requireRole(user, ORDER_LIFECYCLE_ROLES);
      if (lcDenied) return lcDenied;
    }
    const managerValue = isAssignManager && typeof body.value === "string" && body.value ? body.value : "";
    if (isAssignManager && !managerValue) {
      return NextResponse.json({ error: "Укажите менеджера" }, { status: 400 });
    }
    const priorityValue = isSetPriority && typeof body.value === "string" && PRIORITY_VALUES.includes(body.value) ? body.value : "";
    if (isSetPriority && !priorityValue) {
      return NextResponse.json({ error: "Укажите приоритет" }, { status: 400 });
    }
    if (!Array.isArray(body.ids) || !body.ids.length) {
      return NextResponse.json({ error: "Не выбраны заказы" }, { status: 400 });
    }
    const ids = [...new Set(body.ids.filter((x): x is string => typeof x === "string"))].slice(0, MAX_IDS);
    if (!ids.length) {
      return NextResponse.json({ error: "Не выбраны заказы" }, { status: 400 });
    }

    const t =
      isAssignManager || isSetPriority || isFinancial
        ? null
        : TRANSITIONS[action as Exclude<BulkAction, "assign_manager" | "set_priority" | "pay" | "refund">];

    const processed = await prisma.$transaction(async (tx) => {
      const rows = await tx.order.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, amount: true },
      });
      let count = 0;
      for (const r of rows) {
        if (!isAssignManager && !isSetPriority && !isFinancial && !t!.from.includes(r.status as OrderStatusValue)) continue;
        if (isSetPriority) {
          // Смена приоритета (Гл. 3.8 «Массовые операции»): обновляем поле priority,
          // фиксируем в журнале и системном сообщении.
          await tx.order.update({ where: { id: r.id }, data: { priority: priorityValue as OrderPriority } });
          await tx.orderHistory.create({
            data: {
              orderId: r.id,
              action: "set_priority",
              from: r.status,
              to: r.status,
              fields: JSON.stringify({ priority: priorityValue }),
              actorId: user.id,
              actorName: actorDisplayName(user),
              comment: `Приоритет заказа: ${priorityValue}`,
            },
          });
          await tx.orderMessage.create({
            data: {
              orderId: r.id,
              senderId: null,
              senderName: "Система",
              senderRole: "system",
              text: `🎯 Приоритет заказа: ${priorityValue}`,
            },
          });
          count++;
          continue;
        }
        if (isAssignManager) {
          // Назначение менеджера: менеджер не хранится в схеме (детерминированная
          // ротация по id), поэтому фиксируем назначение в журнале и системном сообщении.
          await tx.orderHistory.create({
            data: {
              orderId: r.id,
              action: "assign_manager",
              from: r.status,
              to: r.status,
              fields: JSON.stringify({ manager: managerValue }),
              actorId: user.id,
              actorName: actorDisplayName(user),
              comment: `Назначен менеджер: ${managerValue}`,
            },
          });
          await tx.orderMessage.create({
            data: {
              orderId: r.id,
              senderId: null,
              senderName: "Система",
              senderRole: "system",
              text: `👤 Менеджер по заказу: ${managerValue}`,
            },
          });
          count++;
          continue;
        }
        if (action === "pay" || action === "refund") {
          // Оплата/возврат — финансовое измерение (Baseline §0.6)
          const paymentStatus: OrderPaymentValue = action === "pay" ? "PAID" : "REFUNDED";
          await tx.order.update({
            where: { id: r.id },
            data: { paymentStatus: paymentStatus as never, paidAmount: action === "pay" ? r.amount : 0 },
          });
          await tx.orderHistory.create({
            data: {
              orderId: r.id,
              action,
              from: r.status,
              to: r.status,
              fields: JSON.stringify({ paymentStatus }),
              actorId: user.id,
              actorName: actorDisplayName(user),
              comment: bulkMessage(action),
            },
          });
          await tx.orderMessage.create({
            data: {
              orderId: r.id,
              senderId: null,
              senderName: "Система",
              senderRole: "system",
              text: orderSystemMessage(action === "pay" ? "READY_FOR_BOOKING" : "CLOSED"),
            },
          });
          // Outbox (Гл. 6): финансовое событие атомарно с операцией.
          await emitOrderEvent(tx, r.id, action === "pay" ? "ORDER_PAYMENT_RECEIVED" : "ORDER_PAYMENT_REFUNDED", {
            paymentStatus,
            amount: r.amount,
            actor: actorDisplayName(user),
          });
          count++;
          continue;
        }
        await tx.order.update({ where: { id: r.id }, data: { status: t!.to as never } });
        await tx.orderHistory.create({
          data: {
            orderId: r.id,
            action,
            from: r.status,
            to: t!.to,
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: bulkMessage(action),
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: r.id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: orderSystemMessage(t!.to),
          },
        });
        // Outbox (Гл. 6): событие перехода пишется атомарно с изменением статуса.
        await emitOrderEvent(tx, r.id, action === "send" ? "ORDER_SENT_TO_BOOKING" : action === "confirm" ? "ORDER_READY_FOR_BOOKING" : action === "complete" ? "ORDER_FULFILLED" : action === "close" ? "ORDER_CLOSED" : action === "cancel" ? "ORDER_CANCELLED" : "ORDER_STATUS_CHANGED", {
          from: r.status,
          to: t!.to,
          actor: actorDisplayName(user),
        });
        count++;
      }
      return count;
    });

    // Публикация outbox-событий после коммита массовой операции (Гл. 6).
    await publishOrderEvents();

    const skipped = ids.length - processed;

    // Гл. 3.18: массовая операция фиксируется в журнале аудита.
    if (processed > 0) {
      const ctx = requestContext(request);
      await recordAudit({
        user,
        category: "Пользовательские действия",
        action: "bulk",
        objectType: "Заказ",
        toData: { action, count: processed },
        comment: `${bulkMessage(action)} — обработано ${processed} заказов${skipped ? `, пропущено ${skipped}` : ""}`,
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        criticality: action === "cancel" || action === "archive" ? "warning" : "info",
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        processed > 0
          ? `Обработано: ${processed}${skipped ? `, не обработано: ${skipped} (недопустимый статус или не найдено)` : ""}`
          : "Нет заказов, для которых действие допустимо",
      processed,
      skipped,
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin orders bulk error");
  }
}

function bulkMessage(action: string): string {
  const map: Record<string, string> = {
    confirm: "Массовое подтверждение заказов",
    send: "Массовая передача в бронирование",
    complete: "Массовое исполнение заказов",
    close: "Массовое закрытие заказов",
    cancel: "Массовая отмена заказов",
    pay: "Массовая оплата заказов",
    refund: "Массовый возврат средств",
    assign_manager: "Назначение менеджера",
    set_priority: "Изменение приоритета заказов",
  };
  return    map[action] ?? `Массовое действие: ${action}`;
}

type OrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
