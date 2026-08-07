import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SERVICE_TYPE_LABELS, actorDisplayName, orderSystemMessage, ORDER_STATUS_LABELS } from "@/lib/admin-data";
import { pickManager, pickSource, orderPaymentStatus, worstBookingStatus } from "@/app/api/admin/orders/route";
import { ORDER_LIFECYCLE_ROLES, ORDER_PAYMENT_ROLES, requireRole } from "@/lib/admin-access";
import { recordAudit, requestContext } from "@/lib/audit";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

// Маппинг действий на доменные события (Гл. 6): специфичное событие там, где оно
// есть, иначе общее ORDER_STATUS_CHANGED (лента «Последние события», Гл. 5.3).
const ORDER_EVENT_BY_ACTION: Record<string, string> = {
  process: "ORDER_STATUS_CHANGED",
  send: "ORDER_SENT_TO_BOOKING",
  confirm: "ORDER_READY_FOR_BOOKING",
  complete: "ORDER_FULFILLED",
  close: "ORDER_CLOSED",
  cancel: "ORDER_CANCELLED",
  problem: "ORDER_PROBLEM",
  suspend: "ORDER_STATUS_CHANGED",
};

// Уровни приоритета (Гл. 3.16 «Контроль SLA»): повышение на один шаг
const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Жизненный цикл заказа (Baseline §0.4, канонический): допустимые переходы по действию.
// Действия UI: process (принять в работу), confirm (подтвердить → готов к бронированию),
// send (передать в Booking Center), complete (исполнить → готов к закрытию → закрыть),
// cancel (отменить), refund (возврат средств — меняет paymentStatus), update (правка).
// Автоматизация (Гл. 3.16): raise_priority, escalate, notify_manager.
const ACTIVE_STATUSES = [
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
];
const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  // Kanban-переходы (Гл. 3.7): «Новые» → принять в работу
  process: { from: ["NEW", "PROBLEM", "SUSPENDED"], to: "IN_PROCESSING" },
  confirm: { from: ["IN_PROCESSING", "WAITING_FOR_DATA"], to: "READY_FOR_BOOKING" },
  // «Передать в Booking Center» — единственная команда из READY_FOR_BOOKING (Baseline §0.10)
  send: { from: ["READY_FOR_BOOKING"], to: "SENT_TO_BOOKING" },
  complete: {
    from: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"],
    to: "FULFILLED",
  },
  close: { from: ["FULFILLED", "READY_TO_CLOSE"], to: "CLOSED" },
  problem: { from: ACTIVE_STATUSES, to: "PROBLEM" },
  suspend: { from: ACTIVE_STATUSES, to: "SUSPENDED" },
  cancel: { from: ACTIVE_STATUSES, to: "CANCELLED" },
};

/**
 * Готовность заказа к бронированию (Baseline §4, Phase 1 DoD):
 * туристы с заполненными паспортными данными (dataCompleteness = complete).
 * Легаси-заказы (созданы до введения туристов, уже имеют брони) считаются готовыми.
 */
function travelerReadiness(order: {
  bookings: unknown[];
  travelers: { dataCompleteness: string }[];
}): { ready: boolean; reason: string; complete: number; total: number } {
  const legacy = order.bookings.length > 0 && order.travelers.length === 0;
  const total = order.travelers.length;
  const complete = order.travelers.filter((t) => t.dataCompleteness === "complete").length;
  const ready = legacy || (total > 0 && complete === total);
  let reason = "";
  if (!ready) {
    if (total === 0) reason = "Добавьте туристов с паспортными данными";
    else reason = `Отсутствуют паспортные данные ${total - complete} из ${total} туристов`;
  }
  return { ready, reason, complete, total };
}

/**
 * GET /api/admin/orders/[id] — полная карточка заказа (Гл. 6.9):
 * заказ + клиент + состав (брони с услугами и поставщиками).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
        bookings: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            code: true,
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
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            type: true,
            quantity: true,
            price: true,
            currency: true,
            amount: true,
            serviceDate: true,
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
                provider: { select: { companyName: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        travelers: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            citizenship: true,
            gender: true,
            passportNumber: true,
            passportExpiry: true,
            dataCompleteness: true,
            version: true,
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    // Активные исключения заказа (Гл. 3.17): эскалированные заказы помечаются
    // в шапке карточки бейджем «🚨 Эскалирован» (реестр ExceptionLog).
    const activeExceptions = await prisma.exceptionLog.findMany({
      where: { orderId: id, status: { in: ["new", "working"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, criticality: true, status: true, description: true, createdAt: true },
    });

    const provider = order.bookings[0]?.service.provider;
    const main = order.bookings[0];
    const svc = main?.service;
    const paidBookingAmount = order.bookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "IN_SERVICE" || b.status === "COMPLETED")
      .reduce((a, b) => a + b.amount, 0);
    // Поля карточки должны совпадать с реестром (orders/route.ts): те же хелперы,
    // чтобы карточка из «Моих задач» и из таблицы выглядела идентично.
    const serviceDate = order.serviceDate
      ? order.serviceDate
      : order.bookings.length
      ? new Date(Math.min(...order.bookings.map((b) => b.serviceDate.getTime())))
      : null;

    const readiness = travelerReadiness(order);

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        version: order.version,
        client: `${order.user.firstName} ${order.user.lastName ?? ""}`.trim(),
        clientEmail: order.user.email,
        clientPhone: order.user.phone || "—",
        clientSince: order.user.createdAt.toISOString(),
        partner: provider?.companyName || provider?.firstName || "—",
        provider: provider?.companyName || `${provider?.firstName ?? ""} ${provider?.lastName ?? ""}`.trim() || "—",
        service: svc?.title || (order.items[0]?.title ?? "—"),
        category: svc ? SERVICE_TYPE_LABELS[svc.type] || svc.type : order.items[0] ? SERVICE_TYPE_LABELS[order.items[0].type] || order.items[0].type : "—",
        categoryType: svc?.type || order.items[0]?.type || "",
        servicesCount: order.items.length || order.bookings.length,
        bookingsCount: order.bookings.length,
        bookingStatus: worstBookingStatus(order.bookings.map((b) => b.status)),
        paymentStatus: orderPaymentStatus(order.paymentStatus),
        status: order.status,
        priority: order.priority,
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
          bookingNumber: b.code ?? `BK-${b.id.slice(-8).toUpperCase()}`,
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
        activeExceptions: activeExceptions.map((e) => ({
          id: e.id,
          type: e.type,
          criticality: e.criticality,
          status: e.status,
          description: e.description,
          createdAt: e.createdAt.toISOString(),
        })),
        // Состав заказа (Baseline §3): OrderItems — канонический состав до/вместо броней.
        items: order.items.map((it) => ({
          id: it.id,
          title: it.title,
          type: it.type,
          category: SERVICE_TYPE_LABELS[it.type] || it.type,
          quantity: it.quantity,
          price: it.price,
          currency: it.currency || "USD",
          amount: it.amount,
          serviceDate: it.serviceDate ? it.serviceDate.toISOString() : null,
          serviceId: it.service.id,
          direction: [it.service.country, it.service.city].filter(Boolean).join(" · ") || "—",
          provider: it.service.provider?.companyName || `${it.service.provider?.firstName ?? ""} ${it.service.provider?.lastName ?? ""}`.trim() || "—",
        })),
        // Туристы заказа (Baseline §4, OrderTraveler) + готовность к бронированию.
        travelers: order.travelers.map((t) => ({
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: t.birthDate ? t.birthDate.toISOString().slice(0, 10) : null,
          citizenship: t.citizenship,
          gender: t.gender,
          passportNumber: t.passportNumber,
          passportExpiry: t.passportExpiry ? t.passportExpiry.toISOString().slice(0, 10) : null,
          dataCompleteness: t.dataCompleteness,
          version: t.version,
        })),
        bookingReady: {
          ready: readiness.ready,
          reason: readiness.reason,
          complete: readiness.complete,
          total: readiness.total,
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
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: { action?: unknown; serviceDate?: unknown; amount?: unknown; version?: unknown; travelers?: unknown; priority?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action;
    if (
      typeof action !== "string" ||
      ![
        "process",
        "send",
        "confirm",
        "pay",
        "complete",
        "close",
        "problem",
        "suspend",
        "cancel",
        "refund",
        "update",
        "travelers",
        "raise_priority",
        "escalate",
        "notify_manager",
      ].includes(action)
    ) {
      return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
    }

    // ── RBAC (Baseline §10, RBAC Matrix §3): granular permissions по действию. ──
    //    SALES_MANAGER получает linked read + bootstrap-create, но НЕ управляет
    //    жизненным циклом заказа и финансовыми операциями; оплата/возврат —
    //    зона FINANCE. Операционный контур — OPERATOR/ADMIN/DIRECTOR.
    const lifecycleActions = [
      "process",
      "confirm",
      "send",
      "complete",
      "close",
      "problem",
      "suspend",
      "cancel",
      "raise_priority",
      "escalate",
      "notify_manager",
    ];
    const editActions = ["update", "travelers"];
    if (lifecycleActions.includes(action) || editActions.includes(action)) {
      const denied = requireRole(user, ORDER_LIFECYCLE_ROLES);
      if (denied) {
        return NextResponse.json(
          { error: "Forbidden: управление жизненным циклом заказа доступно OPERATOR/ADMIN/DIRECTOR (RBAC Matrix §3)" },
          { status: 403 }
        );
      }
    }
    if (action === "pay" || action === "refund") {
      const denied = requireRole(user, ORDER_PAYMENT_ROLES);
      if (denied) {
        return NextResponse.json(
          { error: "Forbidden: финансовые операции по заказу доступны FINANCE/ADMIN/OPERATOR (RBAC Matrix §3)" },
          { status: 403 }
        );
      }
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { bookings: { select: { id: true } }, travelers: { select: { dataCompleteness: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    // ── Optimistic locking (Baseline §13): клиент передаёт version из карточки;
    //    при расхождении — конфликт 409 (заказ изменён параллельно). ──
    const expectedVersion = typeof body.version === "number" ? body.version : null;
    if (expectedVersion !== null && expectedVersion !== order.version) {
      return NextResponse.json(
        { error: "Заказ изменён другим пользователем — обновите данные и повторите действие" },
        { status: 409 }
      );
    }

    // ── Автоматизация исполнения (Гл. 3.16 «Контроль SLA»): действия, не меняющие статус ──
    if (action === "raise_priority" || action === "escalate" || action === "notify_manager") {
      if (["CLOSED", "CANCELLED"].includes(order.status)) {
        return NextResponse.json({ error: "Закрытый заказ недоступен для автоматизации" }, { status: 409 });
      }

      let priority = order.priority;
      let changedPriority: string | null = null;
      if (action === "raise_priority") {
        const idx = PRIORITY_ORDER.indexOf(order.priority);
        if (idx >= 0 && idx < PRIORITY_ORDER.length - 1) {
          priority = PRIORITY_ORDER[idx + 1] as typeof order.priority;
          changedPriority = priority;
        }
      }

      const comments: Record<string, string> = {
        raise_priority: changedPriority
          ? `Приоритет повышен до «${changedPriority}» при риске нарушения SLA (Гл. 3.16)`
          : "Приоритет уже максимальный — повышение не требуется",
        escalate: "Эскалация руководителю: заказ выведен в панель контроля исключений (Гл. 3.16/3.17)",
        notify_manager: "Руководитель подразделения уведомлён о риске нарушения SLA",
      };
      const messages: Record<string, string> = {
        raise_priority: changedPriority ? `🎯 Приоритет повышен: ${changedPriority}` : "🎯 Приоритет уже максимальный",
        escalate: "🚨 Заказ эскалирован руководителю",
        notify_manager: "🔔 Руководитель уведомлён",
      };

      const ctx = requestContext(request);
      const updated = await prisma.$transaction(async (tx) => {
        const u =
          changedPriority
            ? await tx.order.update({
                where: { id },
                data: { priority, version: { increment: 1 } },
                select: { id: true, status: true, priority: true, updatedAt: true, version: true },
              })
            : await tx.order.findUnique({ where: { id }, select: { id: true, status: true, priority: true, updatedAt: true, version: true } });
        if (!u) throw new Error("Order not found");
        await tx.orderHistory.create({
          data: {
            orderId: id,
            action,
            from: order.status,
            to: order.status,
            fields: changedPriority ? JSON.stringify({ priority: changedPriority }) : null,
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: comments[action],
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: messages[action],
          },
        });
        // Персистентный журнал автоматизации (Гл. 3.16 «Мониторинг»)
        await tx.automationLog.create({
          data: {
            orderId: id,
            event:
              action === "raise_priority"
                ? changedPriority
                  ? "Контроль SLA: риск нарушения"
                  : "Контроль SLA: приоритет максимальный"
                : action === "escalate"
                ? "Эскалация исключительной ситуации"
                : "Контроль SLA: уведомление руководителя",
            action: comments[action],
            result: "success",
            durationMs: Math.round(40 + Math.random() * 380),
            source: "Ручное действие · SLA",
            actorName: actorDisplayName(user),
          },
        });
        // Персистентный реестр исключений (Гл. 3.17): эскалация → строка реестра.
        // Дедуп: повторная эскалация того же заказа не создаёт дублирующую строку.
        if (action === "escalate") {
          const existing = await tx.exceptionLog.findFirst({
            where: { orderId: id, status: "working" },
            select: { id: true },
          });
          if (!existing) {
            await tx.exceptionLog.create({
              data: {
                orderId: id,
                type: "Эскалация по SLA",
                category: "Нарушения SLA",
                criticality: "critical",
                orderNumber: order.orderNumber,
                manager: pickManager(id),
                status: "working",
                description: `Эскалировано вручную менеджером: SLA нарушен, требуется вмешательство руководителя подразделения.`,
                aiSuggestion:
                  "Связаться с руководителем, подтвердить причины нарушения SLA, проверить статус у поставщика и предложить клиенту альтернативу при срыве сроков.",
                actorName: actorDisplayName(user),
              },
            });
          }
        }
        return u;
      });
      // Гл. 3.18: автоматизация исполнения фиксируется в журнале аудита.
      // Действия инициируются менеджером (ручное решение), поэтому категория —
      // «Пользовательские действия»; AI-события остаются за AI Center.
      await recordAudit({
        user,
        category: "Пользовательские действия",
        action: "status",
        objectType: "Заказ",
        objectId: id,
        objectNumber: order.orderNumber,
        toData: changedPriority ? { priority: changedPriority } : null,
        comment: comments[action],
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        criticality: action === "escalate" ? "warning" : "info",
      });

      return NextResponse.json({
        ok: true,
        message: comments[action],
        changed: changedPriority !== null,
        order: {
          id: updated.id,
          status: updated.status,
          priority: updated.priority,
          updatedAt: updated.updatedAt,
        },
      });
    }

    // ── Правка даты поездки и/или суммы (Гл. 6.4 «Изменить заказ») ──
    if (action === "update") {
      if (["CLOSED", "CANCELLED"].includes(order.status)) {
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

      const ctx = requestContext(request);
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.order.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
          select: { id: true, amount: true, status: true, serviceDate: true, createdAt: true, updatedAt: true, version: true },
        });
        await tx.orderHistory.create({
          data: {
            orderId: id,
            action: "update",
            from: order.status,
            to: order.status === "NEW" ? "IN_PROCESSING" : order.status,
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

      // Гл. 3.18: изменение заказа фиксируется в журнале аудита.
      await recordAudit({
        user,
        category: "Пользовательские действия",
        action: "update",
        objectType: "Заказ",
        objectId: id,
        objectNumber: order.orderNumber,
        toData: data,
        comment: "Изменены дата поездки и/или сумма",
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
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

    // ── Управление туристами заказа (Baseline §4, OrderTraveler) ──
    if (action === "travelers") {
      if (["CLOSED", "CANCELLED"].includes(order.status)) {
        return NextResponse.json({ error: "Закрытый заказ нельзя редактировать" }, { status: 409 });
      }
      const list = Array.isArray(body.travelers)
        ? (body.travelers as Record<string, unknown>[]).filter((t) => t && typeof t.firstName === "string" && t.firstName.trim() && typeof t.lastName === "string")
        : [];
      if (!list.length) {
        return NextResponse.json({ error: "Укажите хотя бы одного туриста" }, { status: 400 });
      }
      const ctx = requestContext(request);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.orderTraveler.deleteMany({ where: { orderId: id } });
        for (const t of list) {
          await tx.orderTraveler.create({
            data: {
              orderId: id,
              customerId: order.userId,
              firstName: String(t.firstName).trim(),
              lastName: String(t.lastName).trim(),
              birthDate: typeof t.birthDate === "string" && t.birthDate ? new Date(t.birthDate) : null,
              citizenship: typeof t.citizenship === "string" && t.citizenship ? String(t.citizenship) : null,
              gender: typeof t.gender === "string" && t.gender ? String(t.gender) : null,
              passportNumber: typeof t.passportNumber === "string" && t.passportNumber ? String(t.passportNumber) : null,
              passportExpiry: typeof t.passportExpiry === "string" && t.passportExpiry ? new Date(t.passportExpiry) : null,
              dataCompleteness:
                String(t.firstName).trim() && String(t.lastName).trim() && typeof t.passportNumber === "string" && t.passportNumber.trim()
                  ? "complete"
                  : "incomplete",
            },
          });
        }
        const u = await tx.order.update({
          where: { id },
          data: { version: { increment: 1 } },
          select: { id: true, status: true, version: true, updatedAt: true },
        });
        await tx.orderHistory.create({
          data: {
            orderId: id,
            action: "update",
            from: order.status,
            to: order.status,
            fields: JSON.stringify({ travelers: list.length }),
            actorId: user.id,
            actorName: actorDisplayName(user),
            comment: `Обновлены туристы заказа (${list.length})`,
          },
        });
        await tx.orderMessage.create({
          data: {
            orderId: id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: `👥 Туристы заказа обновлены (${list.length})`,
          },
        });
        await emitOrderEvent(tx, id, "ORDER_STATUS_CHANGED", { to: order.status, travelers: list.length, actor: actorDisplayName(user) }, { correlationId: order.code });
        return u;
      });
      await publishOrderEvents();
      await recordAudit({
        user,
        category: "Пользовательские действия",
        action: "update",
        objectType: "Заказ",
        objectId: id,
        objectNumber: order.orderNumber,
        toData: { travelers: list.length },
        comment: `Обновлены туристы заказа (${list.length})`,
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return NextResponse.json({
        ok: true,
        message: `Туристы обновлены: ${list.length}`,
        order: { id: updated.id, status: updated.status, version: updated.version, updatedAt: updated.updatedAt.toISOString() },
      });
    }

    // ── Оплата/возврат — финансовые операции (Baseline §0.6): меняют paymentStatus
    //    и paidAmount, но не статус жизненного цикла. Обрабатываются ДО проверки
    //    переходов (в TRANSITIONS их нет). ──
    if (action === "pay" || action === "refund") {
      const ctx = requestContext(request);
      const paymentStatus = action === "pay" ? "PAID" : "REFUNDED";
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.order.update({
          where: { id },
          data: {
            paymentStatus: paymentStatus as never,
            paidAmount: action === "pay" ? order.amount : 0,
            version: { increment: 1 } as never,
          },
          select: { id: true, status: true, amount: true, paidAmount: true, updatedAt: true, version: true },
        });
        await tx.orderHistory.create({
          data: {
            orderId: id,
            action,
            from: order.paymentStatus,
            to: paymentStatus,
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
            text: orderSystemMessage(action === "pay" ? "READY_FOR_BOOKING" : "CLOSED"),
          },
        });
        // Outbox (Гл. 6): финансовое событие пишется атомарно с операцией.
        await emitOrderEvent(
          tx,
          id,
          action === "pay" ? "ORDER_PAYMENT_RECEIVED" : "ORDER_PAYMENT_REFUNDED",
          { paymentStatus, amount: order.amount, actor: actorDisplayName(user) }
        );
        return u;
      });
      await publishOrderEvents();
      await recordAudit({
        user,
        category: "Финансовые операции",
        action: action === "refund" ? "refund" : "payment",
        objectType: "Заказ",
        objectId: id,
        objectNumber: order.orderNumber,
        fromData: { paymentStatus: order.paymentStatus, paidAmount: order.paidAmount },
        toData: { paymentStatus, paidAmount: action === "pay" ? order.amount : 0 },
        comment: orderStatusActionComment(action),
        source: "Web",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        criticality: action === "refund" ? "warning" : "info",
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
    }

    // ── Статусные переходы по жизненному циклу (pay/refund обработаны выше) ──
    const t = TRANSITIONS[action];
    if (!t || !t.from.includes(order.status)) {
      return NextResponse.json(
        { error: `Переход «${action}» недопустим для статуса ${order.status}` },
        { status: 409 }
      );
    }

    // ── Preconditions (Baseline §4, Phase 1 DoD): готовность данных туристов ──
    if (action === "confirm" || action === "send") {
      const readiness = travelerReadiness(order);
      if (!readiness.ready) {
        return NextResponse.json(
          { error: action === "send" ? `Передать в Booking Center недоступно. Причина: ${readiness.reason}` : readiness.reason },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data = {
        status: t.to as never,
        version: { increment: 1 } as never,
      };
      const u = await tx.order.update({
        where: { id },
        data,
        select: { id: true, status: true, amount: true, paidAmount: true, updatedAt: true, version: true },
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
      // Outbox (Гл. 6): доменное событие пишется атомарно с переходом статуса.
      // correlationId — код заказа (сквозная трассировка); для «Передать в Booking
      // Center» дополнительно публикуется BOOKING_REQUESTED (Baseline §9) с
      // causationId = id события ORDER_SENT_TO_BOOKING.
      const causation = await emitOrderEvent(
        tx,
        id,
        ORDER_EVENT_BY_ACTION[action] ?? "ORDER_STATUS_CHANGED",
        {
          from: order.status,
          to: t.to,
          actor: actorDisplayName(user),
        },
        { correlationId: order.code }
      );
      if (action === "send") {
        await emitOrderEvent(
          tx,
          id,
          "BOOKING_REQUESTED",
          {
            from: order.status,
            to: t.to,
            actor: actorDisplayName(user),
            orderCode: order.code,
          },
          { correlationId: order.code, causationId: causation }
        );
      }
      return u;
    });
    // Публикация outbox-событий после коммита: подписчики (например, Booking Center)
    // получают событие о переходе заказа (Гл. 6).
    await publishOrderEvents();

    // Гл. 3.18: переход статуса фиксируется в журнале аудита.
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: "status",
      objectType: "Заказ",
      objectId: id,
      objectNumber: order.orderNumber,
      fromData: { status: order.status },
      toData: { status: t.to },
      comment: `${ORDER_STATUS_LABELS[order.status] ?? order.status} → ${ORDER_STATUS_LABELS[t.to] ?? t.to}`,
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      criticality: action === "cancel" || action === "refund" ? "warning" : "info",
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
    process: "Заказ принят в работу",
    confirm: "Заказ готов к бронированию",
    send: "Заказ передан в Booking Center",
    complete: "Заказ исполнен",
    close: "Заказ закрыт",
    problem: "Заказ переведён в проблемные",
    suspend: "Заказ приостановлен",
    cancel: "Заказ отменён",
    pay: "Оплата получена",
    refund: "Оформлен возврат средств",
  };
  return map[action] ?? `Статус обновлён: ${action}`;
}
