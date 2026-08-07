import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderPriority } from "@/generated/prisma/enums";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  periodRange,
  changePct,
  bucketize,
  fmtMoney,
  actorDisplayName,
  orderSystemMessage,
  ORDER_STATUS_GROUPS,
  MANAGERS,
  pickManager,
} from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";
import { emitOrderEvent, publishOrderEvents } from "@/lib/events";
import {
  AUTOMATION_SCENARIOS,
  buildAutomationJournal,
  automationStats,
  buildExceptions,
  exceptionStats,
} from "@/lib/sales-automation";
import { recordAudit, requestContext } from "@/lib/audit";
import { nextBusinessCode, orderUserNumber } from "@/lib/ids";

export const dynamic = "force-dynamic";

type PeriodKey = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";

// Менеджеры и их назначение — общий справочник в admin-data.ts (pickManager),
// используется и в реестре заказов, и на Dashboard (блок «Продажи»).

// Детерминированный список источников заявки (в схеме нет поля source — ротация по id)
export { pickManager } from "@/lib/admin-data";

export function pickSource(id: string): string {
  const sources = ["Сайт", "Мобильное приложение", "Партнёр", "Call-центр", "Telegram-бот", "WhatsApp"];
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) >>> 0;
  return sources[h % sources.length];
}

// Оплата — отдельное измерение (paymentStatus, Baseline §0.6); активные статусы —
// из ORDER_STATUS_GROUPS (единый источник для реестра и Dashboard).
const ACTIVE_STATUSES = [...ORDER_STATUS_GROUPS.active] as const;

export function orderPaymentStatus(payment: string): "paid" | "partially" | "pending" | "refunded" {
  if (payment === "PAID") return "paid";
  if (payment === "PARTIALLY_PAID") return "partially";
  if (payment === "REFUNDED") return "refunded";
  return "pending";
}

// «Худший» статус брони в составе заказа (для колонки «Статус бронирования»):
// самый ранний этап канонического жизненного цикла (Baseline §0.5).
export function worstBookingStatus(statuses: string[]): string {
  const rank: Record<string, number> = {
    NEW: 0,
    PREPARING_REQUEST: 1,
    SENT_TO_SUPPLIER: 2,
    AWAITING_CONFIRMATION: 3,
    NEEDS_CLARIFICATION: 4,
    CHANGE_REQUESTED: 5,
    CONFIRMED: 6,
    IN_SERVICE: 7,
    COMPLETED: 8,
    CANCELLED: 9,
    CANCELLATION_REQUESTED: 9,
    SUPPLIER_REJECTED: 9,
    PROBLEM: 9,
  };
  let worst = "COMPLETED";
  let worstRank = 99;
  for (const s of statuses) {
    const r = rank[s] ?? 9;
    if (r < worstRank) {
      worstRank = r;
      worst = s;
    }
  }
  return statuses.length ? worst : "";
}

/**
 * GET /api/admin/orders
 * Параметры: period, from, to, country, city, type, partnerId, providerId,
 *            status (один или список через запятую; применяется только к таблице),
 *            bookingStatus, paymentStatus, manager, source, currency,
 *            minPrice, maxPrice, search, page, limit, sort=unread, needsAttention,
 *            bucketFrom/bucketTo (drill-down по точке спарклайна, Гл. 3.6)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);

    // ── Режим формы создания: справочники (клиенты + услуги) ──
    if (searchParams.get("mode") === "form") {
      const [clients, services] = await Promise.all([
        prisma.user.findMany({
          where: { role: "BUYER", isActive: true },
          orderBy: { firstName: "asc" },
          take: 200,
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        prisma.service.findMany({
          where: { isActive: true },
          orderBy: { type: "asc" },
          take: 300,
          select: {
            id: true,
            type: true,
            title: true,
            price: true,
            discountPrice: true,
            currency: true,
            country: true,
            city: true,
          },
        }),
      ]);
      return NextResponse.json({
        clients: clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim(), email: c.email })),
        services: services.map((s) => ({
          id: s.id,
          type: s.type,
          category: SERVICE_TYPE_LABELS[s.type] ?? s.type,
          title: s.title,
          price: s.discountPrice ?? s.price,
          currency: s.currency || "USD",
          direction: [s.country, s.city].filter(Boolean).join(" · "),
        })),
      });
    }

    const period = (searchParams.get("period") || "month") as PeriodKey;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const country = searchParams.get("country") || undefined;
    const city = searchParams.get("city") || undefined;
    const type = searchParams.get("type") || undefined;
    const partnerId = searchParams.get("partnerId") || undefined;
    const providerId = searchParams.get("providerId") || partnerId || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const bookingStatus = searchParams.get("bookingStatus") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const manager = searchParams.get("manager") || undefined;
    const source = searchParams.get("source") || undefined;
    const currency = searchParams.get("currency") || undefined;
    const minPrice = parseFloat(searchParams.get("minPrice") || "0") || 0;
    const maxPrice = parseFloat(searchParams.get("maxPrice") || "0") || 0;
    const search = searchParams.get("search") || undefined;
    const needsAttention = searchParams.get("needsAttention") === "1";
    // Фильтр «Эскалированные» (Гл. 3.17): только заказы с активными исключениями
    const escalated = searchParams.get("escalated") === "1";
    // Drill-down по бакету спарклайна (Гл. 3.6): клик по точке графика сужает
    // ТОЛЬКО реестр заказов (и Kanban) до временного бакета; KPI-карточки и
    // графики остаются по периоду. from/to — ISO-строки границ бакета.
    const bucketFrom = searchParams.get("bucketFrom") || undefined;
    const bucketTo = searchParams.get("bucketTo") || undefined;
    const sort = searchParams.get("sort") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "15");

    const range = periodRange(period, from, to);

    // ── Фильтры по услуге (через входящие в заказ брони) ──
    const serviceFilter: Record<string, unknown> = {};
    if (country) serviceFilter.countryCode = country;
    if (city) serviceFilter.city = { contains: city };
    if (type) serviceFilter.type = type;
    if (providerId) serviceFilter.providerId = providerId;
    const hasServiceFilter = Boolean(country || city || type || providerId);

    // ── Фильтры по заказу ──
    const orderWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
    if (priority) orderWhere.priority = priority; // фильтр приоритета (Гл. 3.9)
    // Фильтр по услуге ищется и в бронях (исполненные), и в составе заказа
    // OrderItem (до передачи в Booking Center, Baseline §3).
    if (hasServiceFilter) {
      orderWhere.OR = [{ bookings: { some: { service: serviceFilter } } }, { items: { some: { service: serviceFilter } } }];
    }
    if (minPrice > 0) orderWhere.amount = { gte: minPrice };
    if (maxPrice > 0) orderWhere.amount = { ...(orderWhere.amount as object ?? {}), lte: maxPrice };

    const prevOrderWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
    if (hasServiceFilter) prevOrderWhere.OR = [{ bookings: { some: { service: serviceFilter } } }, { items: { some: { service: serviceFilter } } }];

    // ── KPI: заказы по статусам ──
    const [statusRows, prevStatusRows] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: true }),
      prisma.order.groupBy({ by: ["status"], where: prevOrderWhere, _count: true }),
    ]);
    const counts: Record<string, number> = {};
    const prevCounts: Record<string, number> = {};
    for (const r of statusRows) counts[r.status] = r._count;
    for (const r of prevStatusRows) prevCounts[r.status] = r._count;
    const prevCountsTotal = Object.values(prevCounts).reduce((a, b) => a + b, 0);

    const totalOrders = statusRows.reduce((a, r) => a + r._count, 0);
    const activeCount = ACTIVE_STATUSES.reduce((a, s) => a + (counts[s] ?? 0), 0);
    const cancelledCount = counts["CANCELLED"] ?? 0;
    const problemCount = (counts["PROBLEM"] ?? 0) + (counts["SUSPENDED"] ?? 0);
    const sentToBookingCount = counts["SENT_TO_BOOKING"] ?? 0;
    const fulfilledCount =
      (counts["PARTIALLY_FULFILLED"] ?? 0) + (counts["FULFILLED"] ?? 0) + (counts["READY_TO_CLOSE"] ?? 0);
    const closedCount = counts["CLOSED"] ?? 0;
    // Оплата — отдельное измерение: считаем по paymentStatus.
    const [paymentRows, prevPaymentRows] = await Promise.all([
      prisma.order.groupBy({ by: ["paymentStatus"], where: orderWhere, _count: true }),
      prisma.order.groupBy({ by: ["paymentStatus"], where: prevOrderWhere, _count: true }),
    ]);
    const payCounts: Record<string, number> = {};
    const prevPayCounts: Record<string, number> = {};
    for (const r of paymentRows) payCounts[r.paymentStatus] = r._count;
    for (const r of prevPaymentRows) prevPayCounts[r.paymentStatus] = r._count;
    const awaitingCount = (payCounts["UNPAID"] ?? 0) + (payCounts["PARTIALLY_PAID"] ?? 0);
    const paidCount = (payCounts["PAID"] ?? 0) + (payCounts["PARTIALLY_PAID"] ?? 0);
    const refundedCount = payCounts["REFUNDED"] ?? 0;
    // KPI: дополнительные показатели по каноническому жизненному циклу
    const processingCount =
      (counts["NEW"] ?? 0) + (counts["IN_PROCESSING"] ?? 0) + (counts["WAITING_FOR_DATA"] ?? 0) + (counts["READY_FOR_BOOKING"] ?? 0);
    const awaitingConfirmationCount = counts["WAITING_FOR_DATA"] ?? 0;
    const readyCount = fulfilledCount;
    const completedCount = closedCount;
    const prevProcessingCount =
      (prevCounts["NEW"] ?? 0) + (prevCounts["IN_PROCESSING"] ?? 0) + (prevCounts["WAITING_FOR_DATA"] ?? 0) + (prevCounts["READY_FOR_BOOKING"] ?? 0);

    // ── KPI: новые сегодня (за последние 24 часа, Гл. 5.4) ──
    const dayAgo = new Date(Date.now() - 24 * 3600000);
    const newTodayCount = await prisma.order.count({ where: { createdAt: { gte: dayAgo } } });

    // ── KPI: финансовые агрегаты (за период) — по paymentStatus ──
    const [paidAgg, awaitingAgg, refundAgg] = await Promise.all([
      prisma.order.aggregate({ where: { ...orderWhere, paymentStatus: "PAID" }, _sum: { amount: true, paidAmount: true }, _count: true }),
      prisma.order.aggregate({ where: { ...orderWhere, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } }, _sum: { amount: true }, _count: true }),
      prisma.order.aggregate({ where: { ...orderWhere, paymentStatus: "REFUNDED" }, _sum: { amount: true }, _count: true }),
    ]);
    const financial = {
      totalAmount: Math.round((paidAgg._sum.amount ?? 0) + (awaitingAgg._sum.amount ?? 0)),
      paidAmount: Math.round(paidAgg._sum.amount ?? 0),
      pendingAmount: Math.round(awaitingAgg._sum.amount ?? 0),
      refundedAmount: Math.round(refundAgg._sum.amount ?? 0),
      commission: Math.round((paidAgg._sum.amount ?? 0) * 0.12),
      expectedPayouts: Math.round((paidAgg._sum.amount ?? 0) * 0.88),
    };
    const avgCheck = paidCount ? Math.round((paidAgg._sum.amount ?? 0) / paidCount) : 0;

    // ── KPI: средний цикл заказа (updatedAt − createdAt по исполненным/закрытым) ──
    const cycleRows = await prisma.order.findMany({
      where: { ...orderWhere, status: { in: ["FULFILLED", "READY_TO_CLOSE", "CLOSED"] } },
      select: { createdAt: true, updatedAt: true },
    });
    let avgCycleHours = 0;
    if (cycleRows.length) {
      const totalMs = cycleRows.reduce((a, r) => a + (r.updatedAt.getTime() - r.createdAt.getTime()), 0);
      avgCycleHours = Math.round((totalMs / cycleRows.length / 3600000) * 10) / 10;
    }

    // ── KPI: AI-прогноз ──
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthAgg = await prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    });
    const forecastRevenue = Math.round((monthAgg._sum.amount ?? 0) * 1.18);
    const forecastOrders = Math.round(monthAgg._count * 1.18);

    // ── Серия заказов ──
    const seriesRows = await prisma.order.findMany({ where: orderWhere, select: { createdAt: true, status: true } });
    const ordersSeries = bucketize(
      seriesRows.map((r) => ({ at: r.createdAt, amount: 1 })),
      period,
      range
    );

    // ── Серии KPI-карточек (Гл. 3.6) ──
    // Каждая карточка показывает динамику СВОЕГО набора статусов (не общую серию
    // заказов): Новые / В работе / Ожидают поставщика / Ожидают оплаты / Документы /
    // Просрочено / Возвраты. SLA — процент соблюдения по бакетам, эскалации —
    // количество исключений по бакетам. Так мини-графики карточек различаются.
    const seriesFor = (statuses: string[]) =>
      bucketize(
        seriesRows.filter((r) => statuses.includes(r.status)).map((r) => ({ at: r.createdAt, amount: 1 })),
        period,
        range
      );
    const kpiSeries: Record<string, { labels: string[]; values: number[]; starts: string[] }> = {
      new: seriesFor(["NEW"]),
      active: seriesFor([...ACTIVE_STATUSES]),
      provider: seriesFor(["WAITING_FOR_DATA"]),
      payment: seriesFor(["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"]),
      docs: seriesFor(["FULFILLED", "READY_TO_CLOSE"]),
      overdue: seriesFor(["PROBLEM"]),
      refunds: seriesFor(["CANCELLED"]),
    };
    // SLA по бакетам: доля АКТИВНЫХ заказов без превышения норматива (PROBLEM —
    // нарушение), как и KPI-карточка «Соблюдение SLA» (считается по активным).
    {
      const active = seriesFor([...ACTIVE_STATUSES]).values;
      const breaches = seriesFor(["PROBLEM"]).values;
      kpiSeries.sla = {
        labels: ordersSeries.labels,
        values: active.map((a, i) => (a > 0 ? Math.round(((a - breaches[i]) / a) * 100) : 100)),
        starts: ordersSeries.starts,
      };
    }
    // Эскалации по бакетам: активные исключения (new/working) из БД. Считаем
    // УНИКАЛЬНЫЕ заказы в каждом бакете (системные исключения без orderId — как
    // отдельные единицы), чтобы сумма бакетов сходилась с KPI-карточкой
    // «Эскалации», которая считает заказы, а не записи исключений.
    const escalationSeriesRows = await prisma.exceptionLog.findMany({
      where: { status: { in: ["new", "working"] }, createdAt: { gte: range.start, lte: range.end } },
      select: { createdAt: true, orderId: true },
    });
    const escBuckets = bucketize(
      escalationSeriesRows.map((r) => ({ at: r.createdAt, amount: 1 })),
      period,
      range
    );
    const escStarts = escBuckets.starts.map((s) => new Date(s).getTime());
    const escValues = escBuckets.values.map(() => 0);
    const escSeen = new Set<string>();
    for (const r of escalationSeriesRows) {
      // Индекс бакета: последний start, не превышающий createdAt записи
      let idx = 0;
      for (let i = 0; i < escStarts.length; i++) {
        if (escStarts[i] <= r.createdAt.getTime()) idx = i;
        else break;
      }
      const key = `${idx}:${r.orderId ?? "sys"}`;
      if (escSeen.has(key)) continue;
      escSeen.add(key);
      escValues[idx] += 1;
    }
    kpiSeries.escalations = { labels: escBuckets.labels, values: escValues, starts: escBuckets.starts };

    // ── Тепловая карта активности ──
    const heatmap: { day: string; hour: number; value: number }[] = [];
    const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const hourBins: Record<string, number> = {};
    for (const r of seriesRows) {
      const key = `${r.createdAt.getDay()}:${r.createdAt.getHours()}`;
      hourBins[key] = (hourBins[key] ?? 0) + 1;
    }
    for (let d = 1; d <= 7; d++) {
      const idx = d % 7;
      for (let h = 0; h < 24; h++) {
        heatmap.push({ day: dayNames[d - 1], hour: h, value: hourBins[`${idx}:${h}`] ?? 0 });
      }
    }

    // ── Таблица заказов (с составом: брони → услуги → поставщики) ──
    const tableOrders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        bookings: {
          select: {
            status: true,
            serviceDate: true,
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
        },
        items: {
          select: {
            title: true,
            type: true,
            currency: true,
            amount: true,
            serviceDate: true,
            service: {
              select: {
                country: true,
                city: true,
                provider: { select: { companyName: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    // Непрочитанные сообщения по заказам — счётчик «требует внимания» (Гл. 6.6)
    const unreadAgg = tableOrders.length
      ? await prisma.orderMessage.groupBy({
          by: ["orderId"],
          where: {
            orderId: { in: tableOrders.map((r) => r.id) },
            senderRole: { in: ["system", "manager"] },
            isRead: false,
          },
          _count: true,
        })
      : [];
    const unreadMap = new Map(unreadAgg.map((u) => [u.orderId, u._count]));
    const attentionCount = unreadMap.size;

    // Эскалированные заказы (Гл. 3.17): реальные активные исключения (status
    // new/working) в выбранном периоде — тот же фильтр, что у панели исключений,
    // чтобы клик по индикатору всегда приводил к видимой строке реестра.
    // (Бейдж в карточке заказа остаётся период-независимым — это сигнал
    // «текущего состояния» заказа.) Счётчик за прошлый период — для KPI-карточки.
    const [escalatedRows, prevEscalatedRows] = await Promise.all([
      prisma.exceptionLog.findMany({
        where: { status: { in: ["new", "working"] }, createdAt: { gte: range.start, lte: range.end } },
        select: { orderId: true },
        take: 500,
      }),
      prisma.exceptionLog.findMany({
        where: { status: { in: ["new", "working"] }, createdAt: { gte: range.prevStart, lte: range.prevEnd } },
        select: { orderId: true },
        take: 500,
      }),
    ]);
    const escalatedOrderIds = new Set(escalatedRows.map((e) => e.orderId).filter(Boolean));
    const escalatedCount = escalatedOrderIds.size;
    const prevEscalatedCount = new Set(prevEscalatedRows.map((e) => e.orderId).filter(Boolean)).size;

    const orders = tableOrders.map((r) => {
      // Состав: брони (исполнение) либо OrderItems (до передачи в Booking Center).
      const bookingSvc = r.bookings[0]?.service;
      const item = r.items[0];
      const svc = bookingSvc ?? item?.service;
      const provider = svc?.provider;
      const serviceTitle = bookingSvc?.title ?? item?.title ?? "—";
      const serviceType = bookingSvc?.type ?? item?.type ?? "";
      const serviceDate = r.serviceDate
        ? r.serviceDate
        : r.bookings.length
        ? new Date(Math.min(...r.bookings.map((b) => b.serviceDate.getTime())))
        : item?.serviceDate
        ? item.serviceDate
        : null;
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
        partner: provider?.companyName || provider?.firstName || "—",
        provider: provider?.companyName || `${provider?.firstName ?? ""} ${provider?.lastName ?? ""}`.trim() || "—",
        service: serviceTitle,
        category: serviceType ? SERVICE_TYPE_LABELS[serviceType] || serviceType : "—",
        categoryType: serviceType,
        servicesCount: r.items.length || r.bookings.length,
        bookingsCount: r.bookings.length,
        amount: r.amount,
        paidAmount: r.paidAmount,
        // Комиссия считается с оплаченной суммы (как «Доход платформы» в KPI),
        // чтобы суммы строк сходились с итоговым показателем (Заказ.docx, Гл. 5.7).
        commission: Math.round(r.paidAmount * 0.12),
        currency: r.currency || "USD",
        status: r.status,
        priority: r.priority,
        bookingStatus: worstBookingStatus(r.bookings.map((b) => b.status)),
        paymentStatus: orderPaymentStatus(r.paymentStatus),
        manager: pickManager(r.id),
        source: r.source || pickSource(r.id),
        unreadCount: unreadMap.get(r.id) ?? 0,
        // Эскалация заказа (Гл. 3.17): колонка-индикатор «🚨» в реестре
        escalated: escalatedOrderIds.has(r.id),
        createdAt: r.createdAt.toISOString(),
        serviceDate: serviceDate ? serviceDate.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    // ── Фильтры после выборки (статус, поиск, оплата, менеджер, источник, валюта) ──
    let filteredOrders = orders;
    if (status) {
      const statuses = status.split(",");
      filteredOrders = filteredOrders.filter((o) => statuses.includes(o.status));
    }
    if (bookingStatus) {
      const statuses = bookingStatus.split(",");
      filteredOrders = filteredOrders.filter((o) => statuses.includes(o.bookingStatus));
    }
    if (paymentStatus) filteredOrders = filteredOrders.filter((o) => o.paymentStatus === paymentStatus);
    if (needsAttention) filteredOrders = filteredOrders.filter((o) => o.unreadCount > 0);
    if (escalated) filteredOrders = filteredOrders.filter((o) => o.escalated);
    if (manager) filteredOrders = filteredOrders.filter((o) => o.manager === manager);
    if (source) filteredOrders = filteredOrders.filter((o) => o.source === source);
    if (currency) filteredOrders = filteredOrders.filter((o) => o.currency === currency);
    if (search) {
      const q = search.toLowerCase();
      filteredOrders = filteredOrders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.client.toLowerCase().includes(q) ||
          o.service.toLowerCase().includes(q) ||
          o.provider.toLowerCase().includes(q) ||
          o.partner.toLowerCase().includes(q)
      );
    }
    // Бакет спарклайна (Гл. 3.6): createdAt в границах выбранной точки графика.
    // Сравнение по ISO-строкам — обе стороны формируются toISOString().
    if (bucketFrom) filteredOrders = filteredOrders.filter((o) => o.createdAt >= bucketFrom);
    if (bucketTo) filteredOrders = filteredOrders.filter((o) => o.createdAt <= bucketTo);
    if (sort === "unread") {
      filteredOrders = [...filteredOrders].sort((a, b) => b.unreadCount - a.unreadCount);
    }

    // ── Kanban (Гл. 3.7): все заказы периода без пагинации и без фильтра статуса
    // (в Kanban-режиме колонки заменяют фильтр статуса). Остальные фильтры
    // применяются, чтобы доска соответствовала реестру. До 150 карточек.
    const kq = search?.toLowerCase();
    const kanbanOrders = orders
      .filter((o) => {
        if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
        if (needsAttention && o.unreadCount === 0) return false;
        if (escalated && !o.escalated) return false;
        // Бакет спарклайна (Гл. 3.6): доска повторяет фильтр реестра
        if (bucketFrom && o.createdAt < bucketFrom) return false;
        if (bucketTo && o.createdAt > bucketTo) return false;
        if (manager && o.manager !== manager) return false;
        if (source && o.source !== source) return false;
        if (currency && o.currency !== currency) return false;
        if (kq) {
          const hit =
            o.orderNumber.toLowerCase().includes(kq) ||
            o.client.toLowerCase().includes(kq) ||
            o.service.toLowerCase().includes(kq) ||
            o.provider.toLowerCase().includes(kq) ||
            o.partner.toLowerCase().includes(kq);
          if (!hit) return false;
        }
        return true;
      })
      .slice(0, 150)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.client,
        service: o.service,
        categoryType: o.categoryType,
        status: o.status,
        priority: o.priority,
        amount: o.amount,
        currency: o.currency,
        manager: o.manager,
        serviceDate: o.serviceDate,
        escalated: o.escalated,
        unreadCount: o.unreadCount,
      }));

    // ── Пагинация ──
    const totalCount = filteredOrders.length;
    const pagedOrders = filteredOrders.slice((page - 1) * limit, page * limit);

    // ── Заказы по категориям услуг / странам (через брони) ──
    const typeAgg: Record<string, { count: number; amount: number }> = {};
    const countryAgg = new Map<string, { name: string; count: number }>();
    for (const o of tableOrders) {
      for (const b of o.bookings) {
        const svc = b.service;
        if (!svc) continue;
        typeAgg[svc.type] ??= { count: 0, amount: 0 };
        typeAgg[svc.type].count += 1;
        const code = svc.country || svc.city || "OTHER";
        const entry = countryAgg.get(code) ?? { name: [svc.country, svc.city].filter(Boolean).join(" · ") || "Другое", count: 0 };
        entry.count += 1;
        countryAgg.set(code, entry);
      }
    }
    const bookingsByService = Object.entries(typeAgg).map(([t, v]) => ({
      type: t,
      label: SERVICE_TYPE_LABELS[t] ?? "Прочие",
      icon: SERVICE_TYPE_ICONS[t] ?? "🧩",
      ...v,
    }));
    const bookingsByCountry = [...countryAgg.entries()]
      .map(([code, v]) => ({ code, country: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);

    // ── Виджеты: последние / проблемные заказы ──
    const now = Date.now();
    const recentOrders = [...filteredOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const problemOrders = [...filteredOrders]
      .filter((o) => {
        if (o.status === "PROBLEM" || o.status === "SUSPENDED") return true;
        if (o.paymentStatus === "pending" && o.serviceDate) {
          return new Date(o.serviceDate).getTime() - now < 3 * 86400000;
        }
        return false;
      })
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        client: o.client,
        service: o.service,
        amount: o.amount,
        serviceDate: o.serviceDate,
        urgency: o.status === "PROBLEM" ? "high" : "medium",
      }));
    const overdueActions = [...filteredOrders]
      .filter((o) => o.status === "PROBLEM" || o.status === "SUSPENDED")
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        client: o.client,
        service: o.service,
        amount: o.amount,
        hours: Math.max(1, Math.round((now - new Date(o.createdAt).getTime()) / 3600000)),
      }));
    const pendingPayments = [...filteredOrders]
      .filter((o) => o.paymentStatus === "pending" || o.paymentStatus === "partially")
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        client: o.client,
        service: o.service,
        amount: o.amount - o.paidAmount,
        createdAt: o.createdAt,
      }));
    const refunds = [...filteredOrders]
      .filter((o) => o.paymentStatus === "refunded" || o.status === "CANCELLED")
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        client: o.client,
        service: o.service,
        amount: o.amount,
        status: o.status,
        updatedAt: o.updatedAt,
      }));
    const upcomingTrips = [...filteredOrders]
      .filter(
        (o) =>
          o.paymentStatus === "paid" &&
          o.serviceDate &&
          new Date(o.serviceDate).getTime() >= now - 86400000 &&
          new Date(o.serviceDate).getTime() <= now + 30 * 86400000
      )
      .sort((a, b) => (a.serviceDate ?? "").localeCompare(b.serviceDate ?? ""))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        client: o.client,
        service: o.service,
        destination: o.service,
        serviceDate: o.serviceDate,
      }));

    // ── Уведомления / AI-рекомендации / SLA ──
    const providerNotifications = [
      ...(overdueActions.length
        ? [{ id: "ovd", type: "warning", title: `${overdueActions.length} заказов требуют действий`, detail: "Просроченные оплаты и подтверждения" }]
        : []),
      ...(pendingPayments.length
        ? [{ id: "pay", type: "info", title: `${pendingPayments.length} заказов ожидают оплаты`, detail: `${fmtMoney(financial.pendingAmount)} в обработке` }]
        : []),
      { id: "supply", type: "info", title: "Обновление тарифов партнёров", detail: "3 поставщика обновили цены за сутки" },
      { id: "doc", type: "info", title: "Готовы документы по 2 заказам", detail: "Ваучеры доступны для отправки клиентам" },
    ];

    // AI-рекомендации (Гл. 3.4 «AI как помощник оператора»): где рекомендация
    // относится к конкретному заказу — прикладываем orderId, чтобы клик по
    // карточке рекомендации открывал AI-анализ этого заказа.
    const aiRecommendations: { level: string; title: string; effect: string; orderId?: string }[] = [
      ...(overdueActions.length
        ? [{ level: "high", title: `${overdueActions.length} заказов просрочены`, effect: "Ускорить обработку с поставщиками", orderId: overdueActions[0].id }]
        : []),
      ...(pendingPayments.length
        ? [{ level: "medium", title: `${pendingPayments.length} заказов ожидают оплаты`, effect: `${fmtMoney(financial.pendingAmount)} к получению`, orderId: pendingPayments[0].id }]
        : []),
      ...(cancelledCount > 0 && refunds.length
        ? [{ level: "medium", title: `${cancelledCount} отмен за период`, effect: "Проанализировать причины отказов", orderId: refunds[0].id }]
        : []),
      ...(bookingsByService[0]
        ? [{ level: "info", title: `Популярная категория: ${bookingsByService[0].label}`, effect: `${bookingsByService[0].count} позиций` }]
        : []),
      ...(bookingsByCountry[0]
        ? [{ level: "info", title: `Топ направление: ${bookingsByCountry[0].country}`, effect: `${bookingsByCountry[0].count} заказов` }]
        : []),
      { level: "info", title: `Прогноз заказов: ${forecastOrders}`, effect: `Ожидаемая выручка ${fmtMoney(forecastRevenue)}` },
    ];

    const slaTargetHours = 48;
    const slaBreaches = overdueActions.length;
    const slaTotal = activeCount;
    const slaCompliance = slaTotal ? Math.max(0, Math.round(((slaTotal - slaBreaches) / slaTotal) * 100)) : 100;

    // ── SLA по рабочим очередям (Гл. 3.7): % соблюдения и среднее время обработки ──
    // Считаем из уже загруженных tableOrders (без лишних запросов): просроченным
    // считается заказ в активном статусе, чей возраст превышает SLA-цель (48 ч),
    // а также любой заказ со статусом OVERDUE. Время обработки = updatedAt − createdAt.
    const QUEUE_SLA_GROUPS: Record<string, string[]> = {
      new: ["NEW"],
      check: ["WAITING_FOR_DATA"],
      provider: ["READY_FOR_BOOKING"],
      payment: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"],
      docs: ["FULFILLED", "READY_TO_CLOSE"],
      refunds: ["CANCELLED"],
      overdue: ["PROBLEM", "SUSPENDED"],
      all: Object.keys(counts),
    };
    const nowMs = Date.now();
    const slaTargetMs = slaTargetHours * 3600000;
    const queueSla: Record<string, { total: number; compliance: number; avgHours: number }> = {};
    for (const [key, statuses] of Object.entries(QUEUE_SLA_GROUPS)) {
      const rows = tableOrders.filter((r) => statuses.includes(r.status));
      if (!rows.length) {
        queueSla[key] = { total: 0, compliance: 100, avgHours: 0 };
        continue;
      }
      const overdueCount = rows.filter((r) => {
        if (r.status === "PROBLEM" || r.status === "SUSPENDED") return true;
        if (["CLOSED", "CANCELLED"].includes(r.status)) return false;
        return nowMs - r.createdAt.getTime() > slaTargetMs;
      }).length;
      const totalMs = rows.reduce((a, r) => a + (r.updatedAt.getTime() - r.createdAt.getTime()), 0);
      queueSla[key] = {
        total: rows.length,
        compliance: Math.max(0, Math.round(((rows.length - overdueCount) / rows.length) * 100)),
        avgHours: Math.round((totalMs / rows.length / 3600000) * 10) / 10,
      };
    }

    // ── Воронка жизненного цикла (создано → исполнено → закрыто) ──
    const confirmedCount = fulfilledCount + closedCount;

    // ── Автоматизация (Гл. 3.16) и исключения (Гл. 3.17) ──
    // Демо-журнал и реестр строятся из заказов периода (согласованы с KPI/реестром),
    // а реальные записи (эскалации и SLA-действия из карточки) читаются из БД и
    // показываются первыми — они переживают перезагрузку страницы.
    const demoJournal = buildAutomationJournal(filteredOrders);
    const demoExceptions = buildExceptions(filteredOrders);
    const [realLogs, realExceptions] = await Promise.all([
      // Реальные записи согласуются с периодом (как и демо-журнал): показываются
      // только записи выбранного периода, чтобы панель «за период» была честной.
      prisma.automationLog.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.exceptionLog.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          history: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      }),
    ]);
    // Дедупликация (Гл. 3.16/3.17): сид теперь пишет персистентные записи для тех же
    // заказов, что и демо-журнал. Демо остаётся запасным вариантом для пустой БД,
    // но при наличии реальной записи по тому же ключу (заказ + событие/тип) —
    // дубликат из демо отбрасывается, чтобы журнал и реестр не показывали дважды
    // одну и ту же операцию.
    const realLogKeys = new Set(realLogs.map((l) => `${l.order?.orderNumber ?? ""}|${l.event}`));
    const realExceptionKeys = new Set(realExceptions.map((e) => `${e.orderId ?? ""}|${e.type}`));
    const demoJournalFiltered = demoJournal.filter((d) => !realLogKeys.has(`${d.orderNumber ?? ""}|${d.event}`));
    const demoExceptionsFiltered = demoExceptions.filter((d) => !realExceptionKeys.has(`${d.orderId}|${d.type}`));

    const automationJournal: {
      id: string;
      at: string;
      event: string;
      action: string;
      result: "success" | "error" | "skipped";
      durationMs: number;
      source: string;
      orderNumber?: string;
    }[] = [
      ...realLogs.map((l) => ({
        id: `log-${l.id}`,
        at: l.createdAt.toISOString(),
        event: l.event,
        action: l.action,
        result: (l.result === "error" || l.result === "skipped" ? l.result : "success") as "success" | "error" | "skipped",
        durationMs: l.durationMs,
        source: l.source,
        orderNumber: l.order?.orderNumber ?? undefined,
      })),
      ...demoJournalFiltered,
    ];
    const exceptions: {
      id: string;
      type: string;
      category: string;
      criticality: "low" | "medium" | "high" | "critical";
      orderNumber: string;
      orderId: string;
      manager: string;
      createdAt: string;
      updatedAt?: string;
      status: "new" | "working" | "resolved" | "closed";
      description: string;
      aiSuggestion: string;
      history?: {
        id: string;
        action: string;
        from: string | null;
        to: string | null;
        comment: string | null;
        actorName: string;
        createdAt: string;
      }[];
    }[] = [
      ...realExceptions.map((e) => ({
        id: `exc-${e.id}`,
        type: e.type,
        category: e.category,
        criticality: (e.criticality === "low" || e.criticality === "medium" || e.criticality === "high" || e.criticality === "critical"
          ? e.criticality
          : "critical") as "low" | "medium" | "high" | "critical",
        orderNumber: e.orderNumber || "—",
        orderId: e.orderId || "",
        manager: e.manager || "—",
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        status: (e.status === "new" || e.status === "working" || e.status === "resolved" || e.status === "closed" ? e.status : "working") as "new" | "working" | "resolved" | "closed",
        description: e.description,
        aiSuggestion: e.aiSuggestion || "",
        history: e.history.map((h) => ({
          id: h.id,
          action: h.action,
          from: h.from,
          to: h.to,
          comment: h.comment,
          actorName: h.actorName,
          createdAt: h.createdAt.toISOString(),
        })),
      })),
      ...demoExceptionsFiltered,
    ];

    return NextResponse.json({
      kpi: {
        // KPI по спецификации Заказ.docx (5.4)
        totalOrders: { value: totalOrders, change: changePct(totalOrders, prevCountsTotal), detail: "Общее количество заказов" },
        newToday: { value: newTodayCount, change: 0, detail: "За последние 24 часа" },
        awaitingProcessing: { value: processingCount, change: changePct(processingCount, prevProcessingCount), detail: `${counts["IN_PROCESSING"] ?? 0} в обработке` },
        awaitingConfirmation: { value: awaitingConfirmationCount, change: changePct(awaitingConfirmationCount, prevCounts["WAITING_FOR_DATA"] ?? 0), detail: "Ожидают данные" },
        ready: { value: readyCount, change: changePct(readyCount, (prevCounts["FULFILLED"] ?? 0) + (prevCounts["READY_TO_CLOSE"] ?? 0)), detail: "Исполнены и готовы к закрытию" },
        completed: { value: completedCount, change: changePct(completedCount, prevCounts["CLOSED"] ?? 0), detail: "Закрытые заказы" },
        avgCheck: { value: avgCheck, change: 0, detail: "Средняя стоимость заказа" },
        platformRevenue: { value: financial.commission, change: 0, detail: "Комиссия платформы (12%)" },
        // Существующие показатели (остаются для обратной совместимости)
        newOrders: { value: counts["NEW"] ?? 0, change: changePct(counts["NEW"] ?? 0, prevCounts["NEW"] ?? 0), detail: `${totalOrders} всего за период` },
        activeOrders: { value: activeCount, change: changePct(activeCount, ACTIVE_STATUSES.reduce((a, s) => a + (prevCounts[s] ?? 0), 0)), detail: `${counts["IN_PROCESSING"] ?? 0} в обработке` },
        awaitingPayment: { value: awaitingCount, change: changePct(awaitingCount, (prevPayCounts["UNPAID"] ?? 0) + (prevPayCounts["PARTIALLY_PAID"] ?? 0)), detail: `${fmtMoney(financial.pendingAmount)} в ожидании` },
        paidOrders: { value: paidCount, change: changePct(paidCount, (prevPayCounts["PAID"] ?? 0) + (prevPayCounts["PARTIALLY_PAID"] ?? 0)), detail: `${fmtMoney(financial.paidAmount)} · средний чек ${fmtMoney(avgCheck)}` },
        cancelledOrders: { value: cancelledCount, change: changePct(cancelledCount, prevCounts["CANCELLED"] ?? 0), detail: totalOrders ? `${Math.round((cancelledCount / totalOrders) * 100)}% от всех заказов` : "0%" },
        avgCycle: { value: avgCycleHours, change: 0, detail: `Цель SLA: ${slaTargetHours} ч · Соблюдение ${slaCompliance}%` },
        refunds: { value: refundedCount, change: changePct(refundedCount, prevPayCounts["REFUNDED"] ?? 0), detail: `${fmtMoney(financial.refundedAmount)} возвращено` },
        problem: { value: problemCount, change: changePct(problemCount, (prevCounts["PROBLEM"] ?? 0) + (prevCounts["SUSPENDED"] ?? 0)), detail: "Требуют решения менеджера" },
        sentToBooking: { value: sentToBookingCount, change: changePct(sentToBookingCount, prevCounts["SENT_TO_BOOKING"] ?? 0), detail: "Переданы в Booking Center" },
        // Эскалации (Гл. 3.17): заказы с активными исключениями за период
        escalations: { value: escalatedCount, change: changePct(escalatedCount, prevEscalatedCount), detail: "Заказы с активными исключениями" },
        aiForecast: { value: forecastOrders, change: 0, detail: `Выручка ${fmtMoney(forecastRevenue)} · план ~${Math.round((monthAgg._count ? (forecastOrders / Math.max(1, monthAgg._count * 1.3)) * 100 : 0))}%` },
        needsAttention: { value: attentionCount, change: 0, detail: `${filteredOrders.reduce((a, o) => a + o.unreadCount, 0)} непрочитанных сообщений` },
      },
      funnel: {
        entry: totalOrders,
        confirmed: confirmedCount,
        paid: paidCount,
      },
      ordersSeries,
      kpiSeries,
      confirmSeries: bucketize(
        cycleRows.map((r) => ({ at: r.updatedAt, amount: 1 })),
        period,
        range
      ),
      bookingsByService,
      bookingsByCountry,
      heatmap,
      financial,
      statusCounts: Object.entries(counts).map(([status, count]) => ({ status, count })),
      recentOrders,
      problemOrders,
      overdueActions,
      pendingPayments,
      refunds,
      upcomingTrips,
      providerNotifications,
      aiRecommendations,
      sla: { targetHours: slaTargetHours, compliance: slaCompliance, breaches: slaBreaches, total: slaTotal },
      queueSla,
      automation: {
        scenarios: AUTOMATION_SCENARIOS,
        journal: automationJournal,
        stats: automationStats(automationJournal),
      },
      exceptions: {
        list: exceptions,
        stats: exceptionStats(exceptions),
      },
      managers: MANAGERS,
      kanban: kanbanOrders,
      orders: pagedOrders,
      pagination: { page, limit, total: totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) },
      period: { start: range.start, end: range.end },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin orders API error");
  }
}

/**
 * POST /api/admin/orders
 * Тело: { userId, serviceId, serviceDate, amount?, source?, priority?, items?, travelers? }
 *
 * Bootstrap-создание (Phase 1, временный сценарий): создаёт Заказ + OrderItems
 * (состав) + OrderTraveler (туристы). Бронирования НЕ создаются напрямую —
 * они появятся consumer-ом события BOOKING_REQUESTED при команде
 * «Передать в Booking Center» (Baseline §9, Phase 1 DoD).
 * correlationId = Order.code — сквозная трассировка процесса.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const serviceDate = typeof body.serviceDate === "string" ? new Date(body.serviceDate) : null;
    const amountRaw = typeof body.amount === "number" ? body.amount : null;
    // Приоритет заказа (Гл. 3.10): валидируем против допустимых значений.
    const priority = (typeof body.priority === "string" && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(body.priority) ? body.priority : undefined) as OrderPriority | undefined;
    // Состав заказа: items: [{ serviceId, quantity?, price?, serviceDate? }] либо
    // одиночная услуга serviceId (обратная совместимость с формой создания).
    const rawItems = Array.isArray(body.items)
      ? (body.items as { serviceId?: unknown; quantity?: unknown; price?: unknown; serviceDate?: unknown }[]).filter((i) => i && typeof i.serviceId === "string")
      : serviceId
      ? [{ serviceId }]
      : [];
    // Туристы заказа (опционально при создании): при отсутствии — один турист
    // от имени клиента со статусом incomplete (паспортные данные заполняются в карточке).
    const rawTravelers = Array.isArray(body.travelers)
      ? (body.travelers as Record<string, unknown>[]).filter((t) => t && typeof t.firstName === "string" && typeof t.lastName === "string")
      : [];

    if (!userId || rawItems.length === 0) {
      return NextResponse.json({ error: "Укажите клиента и услугу" }, { status: 400 });
    }
    if (!serviceDate || isNaN(serviceDate.getTime())) {
      return NextResponse.json({ error: "Укажите корректную дату поездки" }, { status: 400 });
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (serviceDate.getTime() < todayStart.getTime()) {
      return NextResponse.json({ error: "Дата поездки не может быть в прошлом" }, { status: 400 });
    }

    const [client, services] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.service.findMany({ where: { id: { in: rawItems.map((i) => i.serviceId as string) } } }),
    ]);
    if (!client || client.role !== "BUYER") {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }
    if (services.length !== rawItems.length) {
      return NextResponse.json({ error: "Одна из услуг не найдена" }, { status: 404 });
    }
    if (services.some((s) => !s.isActive)) {
      return NextResponse.json({ error: "Одна из услуг неактивна" }, { status: 404 });
    }

    // Сумма: переданная сумма либо сумма состава (услуги по фактическим ценам).
    const itemsAmount = Math.round(
      rawItems.reduce((acc, it, idx) => {
        const svc = services[idx];
        const qty = typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1;
        const price = typeof it.price === "number" && it.price > 0 ? it.price : svc.discountPrice ?? svc.price;
        return acc + price * qty;
      }, 0) * 100
    ) / 100;
    const amount = amountRaw && amountRaw > 0 ? Math.round(amountRaw * 100) / 100 : itemsAmount;

    const created = await prisma.$transaction(async (tx) => {
      // Каноническая ID Policy (Baseline §0.8): внутренний код ORD-00000001
      // и пользовательский номер TH-YYYY-###### — по максимальным существующим.
      const rows = await tx.order.findMany({ select: { code: true, orderNumber: true } });
      const code = nextBusinessCode("ORD", rows.map((r) => r.code));
      const orderNumber = orderUserNumber(new Date().getFullYear(), rows.map((r) => r.orderNumber));
      const order = await tx.order.create({
        data: {
          code,
          orderNumber,
          userId,
          status: "NEW",
          paymentStatus: "UNPAID",
          ...(priority ? { priority } : {}),
          currency: services[0].currency || "USD",
          amount,
          paidAmount: 0,
          serviceDate,
          source: typeof body.source === "string" && body.source ? body.source : "Создано в админке",
        },
        select: { id: true, code: true, orderNumber: true, amount: true, status: true, createdAt: true, updatedAt: true, serviceDate: true },
      });
      // Состав заказа: OrderItem (Baseline §3) — по одной позиции на услугу.
      const items: { serviceId: string; title: string }[] = [];
      for (let idx = 0; idx < rawItems.length; idx++) {
        const it = rawItems[idx];
        const svc = services[idx];
        const qty = typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1;
        const price = typeof it.price === "number" && it.price > 0 ? it.price : svc.discountPrice ?? svc.price;
        const itemDate = typeof it.serviceDate === "string" ? new Date(it.serviceDate) : serviceDate;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: svc.id,
            title: svc.title,
            type: svc.type,
            quantity: qty,
            price: Math.round(price * 100) / 100,
            currency: svc.currency || "USD",
            amount: Math.round(price * qty * 100) / 100,
            serviceDate: itemDate,
          },
        });
        items.push({ serviceId: svc.id, title: svc.title });
      }
      // Туристы заказа (Baseline §4): из payload либо один турист от имени клиента.
      const travelers = rawTravelers.length
        ? rawTravelers.map((t) => ({
            orderId: order.id,
            customerId: userId,
            firstName: String(t.firstName),
            lastName: String(t.lastName),
            birthDate: typeof t.birthDate === "string" ? new Date(t.birthDate) : null,
            citizenship: typeof t.citizenship === "string" && t.citizenship ? String(t.citizenship) : null,
            gender: typeof t.gender === "string" && t.gender ? String(t.gender) : null,
            passportNumber: typeof t.passportNumber === "string" && t.passportNumber ? String(t.passportNumber) : null,
            passportExpiry: typeof t.passportExpiry === "string" ? new Date(t.passportExpiry) : null,
            // Полнота данных: обязательные поля для бронирования.
            dataCompleteness:
              String(t.firstName).trim() && String(t.lastName).trim() && typeof t.passportNumber === "string" && t.passportNumber.trim()
                ? "complete"
                : "incomplete",
          }))
        : [
            {
              orderId: order.id,
              customerId: userId,
              firstName: client.firstName,
              lastName: client.lastName ?? "",
              birthDate: null,
              citizenship: null,
              gender: null,
              passportNumber: null,
              passportExpiry: null,
              dataCompleteness: "incomplete",
            },
          ];
      for (const t of travelers) {
        await tx.orderTraveler.create({ data: t });
      }
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          action: "created",
          from: null,
          to: "NEW",
          actorId: user.id,
          actorName: actorDisplayName(user),
          comment: `Заказ создан: ${services.map((s) => s.title).join(", ")}`,
        },
      });
      await tx.orderMessage.create({
        data: {
          orderId: order.id,
          senderId: null,
          senderName: "Система",
          senderRole: "system",
          text: orderSystemMessage("NEW"),
        },
      });
      // Outbox (Гл. 6): событие создания заказа пишется атомарно с созданием;
      // correlationId = код заказа — сквозная трассировка процесса (Baseline §13).
      await emitOrderEvent(
        tx,
        order.id,
        "ORDER_CREATED",
        {
          amount,
          items: items.map((i) => i.serviceId),
          actor: actorDisplayName(user),
        },
        { correlationId: code }
      );
      return { order };
    });
    // Публикация события после коммита транзакции.
    await publishOrderEvents();

    // Гл. 3.18: создание заказа фиксируется в журнале аудита.
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: "create",
      objectType: "Заказ",
      objectId: created.order.id,
      objectNumber: created.order.orderNumber,
      toData: { amount, serviceDate: serviceDate.toISOString(), priority: priority ?? "MEDIUM" },
      comment: `Заказ создан: ${services.map((s) => s.title).join(", ")} для ${client.firstName} ${client.lastName ?? ""}`.trim(),
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return NextResponse.json(
      {
        ok: true,
        message: `Заказ ${created.order.orderNumber} создан`,
        order: {
          id: created.order.id,
          orderNumber: created.order.orderNumber,
          amount: created.order.amount,
          status: created.order.status,
          serviceDate: created.order.serviceDate ? created.order.serviceDate.toISOString() : serviceDate.toISOString(),
          createdAt: created.order.createdAt.toISOString(),
          updatedAt: created.order.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return serverErrorResponse(error, "Admin orders POST error");
  }
}
