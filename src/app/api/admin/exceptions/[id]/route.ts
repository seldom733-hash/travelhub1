import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName } from "@/lib/admin-data";
import { recordAudit, requestContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Допустимые переходы статусов исключения (Гл. 3.17): рабочее состояние
// изменяется по цепочке new → working → resolved → closed (с возможностью
// вернуть «В работе» из любого состояния кнопкой «Взять в работу»).
const ALLOWED_ACTIONS: Record<string, { from: string[]; to: string; label: string }> = {
  take: { from: ["new", "resolved", "closed"], to: "working", label: "Взят в работу" },
  resolve: { from: ["new", "working"], to: "resolved", label: "Помечен решённым" },
  close: { from: ["new", "working", "resolved"], to: "closed", label: "Закрыт" },
};

/**
 * PATCH /api/admin/exceptions/[id]
 * Тело: { action: "take" | "resolve" | "close" }
 * Меняет статус исключения, пишет запись в журнал обработки (ExceptionLogHistory)
 * и обновляет updatedAt. Возвращает обновлённое исключение.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: { action?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (typeof action !== "string" || !ALLOWED_ACTIONS[action]) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    const exception = await prisma.exceptionLog.findUnique({ where: { id } });
    if (!exception) {
      return NextResponse.json({ error: "Исключение не найдено" }, { status: 404 });
    }

    const t = ALLOWED_ACTIONS[action];
    if (!t.from.includes(exception.status)) {
      return NextResponse.json(
        { error: `Переход «${action}» недопустим для статуса ${exception.status}` },
        { status: 409 }
      );
    }

    // Атомарный переход (без TOCTOU-гонки): updateMany с условием на текущий
    // статус — параллельные запросы не могут провалидировать и записать историю
    // дважды. Обновляется ровно одна строка; иначе статус уже изменился.
    // Внимание: updateMany не обновляет @updatedAt автоматически (в отличие от
    // update), поэтому updatedAt выставляем явно.
    // Снятие/возобновление эскалации на заказе (Гл. 3.17): исключение является
    // эскалационным маркером заказа, поэтому его решён/закрыт синхронизируется
    // с заказом — запись в историю заказа, журнал автоматизации (3.16) и
    // системное сообщение в переписку. Возврат «В работу» из решённого/закрытого
    // возобновляет эскалацию.
    const actor = actorDisplayName(user);
    const exceptionType = exception.type || "Исключение";
    const escalationSideEffect =
      exception.orderId && (action === "resolve" || action === "close")
        ? {
            historyAction: action === "resolve" ? "escalation_resolved" : "escalation_closed",
            comment: `Эскалация снята с заказа: исключение «${exceptionType}» ${action === "resolve" ? "решено" : "закрыто"}`,
            journalEvent: "Снятие эскалации",
            journalAction: `Исключение «${exceptionType}» ${action === "resolve" ? "решено" : "закрыто"} — эскалация снята с заказа`,
            message: action === "resolve" ? "✅ Эскалация снята: исключение решено" : "✅ Эскалация снята: исключение закрыто",
          }
        : exception.orderId && action === "take" && exception.status !== "new"
        ? {
            historyAction: "escalation_reopened",
            comment: `Эскалация возобновлена: исключение «${exceptionType}» возвращено в работу`,
            journalEvent: "Возобновление эскалации",
            journalAction: `Исключение «${exceptionType}» возвращено в работу — эскалация активна`,
            message: "🚨 Эскалация возобновлена: исключение в работе",
          }
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.exceptionLog.updateMany({
        where: { id, status: exception.status },
        data: { status: t.to, updatedAt: new Date() },
      });
      if (res.count === 0) {
        throw new Error("STATUS_CHANGED");
      }
      const u = await tx.exceptionLog.findUniqueOrThrow({
        where: { id },
        select: { id: true, status: true, updatedAt: true },
      });
      await tx.exceptionLogHistory.create({
        data: {
          exceptionLogId: id,
          action,
          from: exception.status,
          to: t.to,
          comment: t.label,
          actorId: user.id,
          actorName: actor,
        },
      });
      // Синхронизация с заказом: снятие/возобновление эскалации.
      if (escalationSideEffect && exception.orderId) {
        await tx.orderHistory.create({
          data: {
            orderId: exception.orderId,
            action: escalationSideEffect.historyAction,
            from: null,
            to: null,
            actorId: user.id,
            actorName: actor,
            comment: escalationSideEffect.comment,
          },
        });
        await tx.automationLog.create({
          data: {
            orderId: exception.orderId,
            event: escalationSideEffect.journalEvent,
            action: escalationSideEffect.journalAction,
            result: "success",
            durationMs: Math.round(30 + Math.random() * 200),
            source: "Ручное действие · SLA",
            actorName: actor,
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: exception.orderId,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: escalationSideEffect.message,
          },
        });
      }
      return u;
    });

    // Гл. 3.18: обработка исключения фиксируется в журнале аудита.
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: "status",
      objectType: "Исключение",
      objectId: id,
      objectNumber: exception.orderNumber ?? undefined,
      fromData: { status: exception.status },
      toData: { status: t.to },
      comment: `Исключение «${exception.type}»: ${t.label}`,
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      criticality: action === "close" ? "info" : "warning",
    });

    return NextResponse.json({
      ok: true,
      message: t.label,
      exception: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    // Конкурентная смена статуса — возвращаем 409, как при недопустимом переходе
    if (error instanceof Error && error.message === "STATUS_CHANGED") {
      return NextResponse.json({ error: "Статус уже изменён другим пользователем" }, { status: 409 });
    }
    return serverErrorResponse(error, "Admin exception PATCH error");
  }
}
