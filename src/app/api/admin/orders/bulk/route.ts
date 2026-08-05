import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName, orderSystemMessage } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

type BulkAction = "confirm" | "pay" | "complete" | "cancel" | "archive" | "assign_manager" | "set_priority";

const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Допустимые исходные статусы и целевой статус для каждого массового действия
type OrderStatusValue =
  | "DRAFT" | "CREATED" | "PROCESSING" | "AWAITING_CONFIRMATION" | "CONFIRMED"
  | "AWAITING_PAYMENT" | "PARTIALLY_PAID" | "PAID" | "DOCUMENT_PREP" | "READY"
  | "COMPLETED" | "CHANGED" | "REFUNDED" | "CANCELLED" | "OVERDUE" | "ARCHIVED";

const TRANSITIONS: Record<Exclude<BulkAction, "assign_manager" | "set_priority">, { from: OrderStatusValue[]; to: OrderStatusValue }> = {
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
  archive: { from: ["COMPLETED", "CANCELLED", "REFUNDED"], to: "ARCHIVED" },
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
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { action?: unknown; ids?: unknown; value?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    const isAssignManager = action === "assign_manager";
    const isSetPriority = action === "set_priority";
    if (typeof action !== "string" || !(isAssignManager || isSetPriority || action in TRANSITIONS)) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
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

    const t = isAssignManager || isSetPriority ? null : TRANSITIONS[action as Exclude<BulkAction, "assign_manager" | "set_priority">];

    const processed = await prisma.$transaction(async (tx) => {
      const rows = await tx.order.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, amount: true },
      });
      let count = 0;
      for (const r of rows) {
        if (!isAssignManager && !isSetPriority && !t!.from.includes(r.status as OrderStatusValue)) continue;
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
        await tx.order.update({ where: { id: r.id }, data: { status: t!.to, ...(action === "pay" ? { paidAmount: r.amount } : {}) } });
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
    pay: "Массовая оплата заказов",
    complete: "Массовое завершение заказов",
    cancel: "Массовая отмена заказов",
    archive: "Массовая архивация заказов",
    assign_manager: "Назначение менеджера",
    set_priority: "Изменение приоритета заказов",
  };
  return    map[action] ?? `Массовое действие: ${action}`;
}

type OrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
