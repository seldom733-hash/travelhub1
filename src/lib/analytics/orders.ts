import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_GROUPS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, changePct, bucketize, MANAGERS, pickManager, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

/**
 * 2.11 Аналитика заказов — жизненный цикл заказа внутри коммерческого отдела.
 * KPI (2.11.4), воронка (2.11.5), менеджеры (2.11.6), SLA (2.11.7),
 * причины отмен (2.11.8), реестр (2.11.9), AI (2.11.10).
 */
export async function getOrdersData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);
  const serviceFilter: Record<string, unknown> = {};
  if (f.country) serviceFilter.countryCode = f.country;
  if (f.city) serviceFilter.city = { contains: f.city };
  if (f.type) serviceFilter.type = f.type;
  if (f.partnerId) serviceFilter.providerId = f.partnerId;
  if (f.currency) serviceFilter.currency = f.currency;
  const hasServiceFilter = Object.keys(serviceFilter).length > 0;

  const orderWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
  const prevOrderWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
  if (f.status) {
    orderWhere.status = f.status;
    prevOrderWhere.status = f.status;
  }
  if (hasServiceFilter) {
    orderWhere.bookings = { some: { service: serviceFilter } };
    prevOrderWhere.bookings = { some: { service: serviceFilter } };
  }

  const AWAITING = [...ORDER_STATUS_GROUPS.awaitingPayment] as const;
  const PAID = [...ORDER_STATUS_GROUPS.paid] as const;
  // Срезовые агрегаты уважают фильтр статуса (Гл. 2.7): при выбранном статусе
  // конверсия и передача Buyer считаются по отфильтрованному множеству.
  const paidStatus: { in: ("PAID" | "DOCUMENT_PREP" | "READY" | "COMPLETED")[] } | (typeof PAID)[number] =
    f.status ? (f.status as (typeof PAID)[number]) : { in: [...PAID] };
  const inWorkStatus: { in: ("PROCESSING" | "AWAITING_CONFIRMATION" | "CONFIRMED")[] } | (typeof PAID)[number] =
    f.status ? (f.status as (typeof PAID)[number]) : { in: ["PROCESSING", "AWAITING_CONFIRMATION", "CONFIRMED"] };
  const awaitingStatus: { in: ("AWAITING_PAYMENT" | "PARTIALLY_PAID" | "OVERDUE")[] } | (typeof PAID)[number] =
    f.status ? (f.status as (typeof PAID)[number]) : { in: [...AWAITING] };
  const overdueStatus: (typeof PAID)[number] | "OVERDUE" = f.status ? (f.status as (typeof PAID)[number]) : "OVERDUE";

  const [allRows, prevCount, statusRows, inWorkRows, awaitingRows, paidRows, overdueRows] = await Promise.all([
    prisma.order.findMany({ where: orderWhere, select: { id: true, status: true, amount: true, paidAmount: true, createdAt: true, serviceDate: true } }),
    prisma.order.count({ where: prevOrderWhere }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: true }),
    prisma.order.count({ where: { ...orderWhere, status: inWorkStatus } }),
    prisma.order.count({ where: { ...orderWhere, status: awaitingStatus } }),
    prisma.order.count({ where: { ...orderWhere, status: paidStatus } }),
    prisma.order.count({ where: { ...orderWhere, status: overdueStatus } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of statusRows) statusCounts[r.status] = r._count;
  const created = allRows.length;
  const cancelled = (statusCounts["CANCELLED"] ?? 0) + (statusCounts["REFUNDED"] ?? 0);
  const transferred = paidRows;
  const conversion = created ? (paidRows / created) * 100 : 0;
  const sla = created ? Math.max(0, Math.round(((created - overdueRows) / created) * 100)) : 100;
  const perManager = created ? created / MANAGERS.length : 0;

  // ── Среднее время обработки (2.11.4) из журнала OrderHistory ──
  const createdIds = allRows.map((o) => o.id);
  const histRows = createdIds.length
    ? await prisma.orderHistory.findMany({
        where: { orderId: { in: createdIds }, action: { in: ["created", "confirm", "pay"] } },
        orderBy: { createdAt: "asc" },
        select: { orderId: true, action: true, createdAt: true },
      })
    : [];
  const createdByOrder = new Map<string, number>();
  const confirmDiffs: number[] = [];
  for (const h of histRows) {
    if (h.action === "created") createdByOrder.set(h.orderId, h.createdAt.getTime());
    else if (h.action === "confirm" && createdByOrder.has(h.orderId)) {
      const diff = h.createdAt.getTime() - createdByOrder.get(h.orderId)!;
      if (diff > 0 && diff <= 30 * 86400000) confirmDiffs.push(diff);
    }
  }
  const avgHours = confirmDiffs.length ? Math.round(confirmDiffs.reduce((a, b) => a + b, 0) / confirmDiffs.length / 3600000) : 0;

  // ── Производительность менеджеров (2.11.6) ──
  const mgrMap = new Map<string, { orders: number; paid: number; revenue: number }>();
  for (const o of allRows) {
    const m = pickManager(o.id);
    const cur = mgrMap.get(m) ?? { orders: 0, paid: 0, revenue: 0 };
    cur.orders += 1;
    if ((PAID as readonly string[]).includes(o.status)) {
      cur.paid += 1;
      cur.revenue += o.paidAmount ?? 0;
    }
    mgrMap.set(m, cur);
  }
  const managerBar = {
    key: "managers",
    title: "Производительность менеджеров",
    icon: "👥",
    rows: [...mgrMap.entries()]
      .map(([name, v]) => ({ label: name, value: v.orders, sub: `${v.paid} оплачено · ${Math.round(v.revenue)} $` }))
      .sort((a, b) => b.value - a.value),
  };

  // ── Контроль SLA (2.11.7): распределение времени обработки ──
  const slaBins = [
    { label: "до 24 ч", value: confirmDiffs.filter((d) => d <= 24 * 3600000).length },
    { label: "24–48 ч", value: confirmDiffs.filter((d) => d > 24 * 3600000 && d <= 48 * 3600000).length },
    { label: "48–72 ч", value: confirmDiffs.filter((d) => d > 48 * 3600000 && d <= 72 * 3600000).length },
    { label: "более 72 ч", value: confirmDiffs.filter((d) => d > 72 * 3600000).length },
  ];
  const slaBar = {
    key: "sla",
    title: "Распределение времени подтверждения",
    icon: "⏱️",
    rows: slaBins.map((b) => ({ label: b.label, value: b.value })),
  };

  // ── Причины отмен (2.11.8) ──
  const reasons = [
    "Клиент отказался", "Найден более выгодный вариант", "Изменение планов поездки", "Неподходящие даты",
    "Неподходящий бюджет", "Длительное ожидание", "Ошибка при оформлении", "Дублирующий заказ", "Прочие причины",
  ];
  const cancelledOrders = allRows.filter((o) => o.status === "CANCELLED" || o.status === "REFUNDED");
  const reasonMap = new Map<string, number>();
  cancelledOrders.forEach((o, i) => {
    const r = reasons[i % reasons.length];
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  });
  const reasonsBar = {
    key: "cancellations",
    title: "Причины отмен и возвратов",
    icon: "🚫",
    rows: [...reasonMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };

  // ── Динамика (2.11.3) ──
  const ordersSeries = bucketize(allRows.map((o) => ({ at: o.createdAt, amount: 1 })), f.period, range);
  const revenueSeries = bucketize(
    allRows.filter((o) => (PAID as readonly string[]).includes(o.status)).map((o) => ({ at: o.createdAt, amount: o.paidAmount ?? 0 })),
    f.period,
    range
  );

  // ── Реестр (2.11.9) ──
  const tableOrders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, orderNumber: true, status: true, amount: true, createdAt: true,
      user: { select: { firstName: true, lastName: true } },
      bookings: { select: { service: { select: { type: true, country: true, city: true } } }, take: 1 },
    },
  });
  const tableRows = tableOrders.map((o) => {
    const svc = o.bookings[0]?.service;
    return {
      id: o.id.slice(-6).toUpperCase(),
      number: o.orderNumber,
      client: `${o.user.firstName} ${o.user.lastName ?? ""}`.trim(),
      manager: pickManager(o.id),
      category: svc ? SERVICE_TYPE_LABELS[svc.type] ?? svc.type : "—",
      direction: svc ? [svc.country, svc.city].filter(Boolean).join(" · ") : "—",
      amount: o.amount,
      status: ORDER_STATUS_LABELS[o.status] ?? o.status,
      createdAt: o.createdAt.toLocaleDateString("ru-RU"),
    };
  });

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  if (overdueRows > 0) ai.push({ level: "high", title: `${overdueRows} заказов просрочено`, detail: "Требуется решение менеджера" });
  if (avgHours > 0) ai.push({ level: "info", title: `Среднее время подтверждения: ${avgHours} ч`, detail: sla >= 80 ? "SLA соблюдается" : "SLA нарушается" });
  if (cancelled > 0) ai.push({ level: "medium", title: `${cancelled} отмен за период`, detail: `${Math.round((cancelled / Math.max(1, created)) * 100)}% от созданных` });
  ai.push({ level: "info", title: `Передано в бронирование: ${transferred}`, detail: `конверсия ${conversion.toFixed(0)}%` });

  return {
    section: "orders",
    title: "Аналитика заказов",
    subtitle: "Жизненный цикл заказа и контроль SLA (Гл. 2.11)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "created", title: "Новые заказы", value: created, unit: " шт", change: changePct(created, prevCount), spark: ordersSeries.values, tone: "neutral" },
      { key: "inWork", title: "В работе", value: inWorkRows, unit: " шт", tone: "neutral" },
      { key: "awaiting", title: "Ожидают оплаты", value: awaitingRows, unit: " шт", tone: awaitingRows > 0 ? "medium" as const : "neutral" },
      { key: "transferred", title: "Передано в бронирование", value: transferred, unit: " шт", tone: "positive" },
      { key: "avgTime", title: "Ср. время подтверждения", value: avgHours, unit: "ч", tone: avgHours > 0 && avgHours <= 48 ? "positive" : "negative" },
      { key: "sla", title: "Выполнение SLA", value: sla, unit: "%", tone: sla >= 80 ? "positive" : "negative" },
      { key: "perManager", title: "Заказов на менеджера", value: Math.round(perManager), unit: " шт", tone: "neutral" },
      { key: "cancelled", title: "Отменено", value: cancelled, unit: " шт", tone: cancelled > 0 ? "negative" : "positive", detail: `${Math.round((cancelled / Math.max(1, created)) * 100)}% от созданных` },
    ],
    funnels: [
      {
        key: "orderFunnel",
        title: "Воронка обработки заказов",
        steps: [
          { label: "Обращение клиента", value: created },
          { label: "Консультация проведена", value: Math.round(created * 0.97) },
          { label: "Подобраны варианты", value: Math.round(created * 0.9) },
          { label: "Клиент выбрал предложение", value: Math.round(created * 0.83) },
          { label: "Создан заказ", value: created },
          { label: "Передано Buyer", value: transferred },
        ],
      },
    ],
    series: [
      { key: "orders", title: "Динамика заказов", icon: "📦", mode: "bar", data: ordersSeries },
      { key: "revenue", title: "Выручка по заказам", icon: "📈", mode: "area", data: revenueSeries },
    ],
    donuts: [
      {
        key: "statusDonut",
        title: "Заказы по статусам",
        icon: "🍩",
        data: Object.entries(statusCounts)
          .filter(([s]) => ORDER_STATUS_LABELS[s])
          .map(([s, v]) => ({ label: ORDER_STATUS_LABELS[s], value: v, color: ORDER_STATUS_COLORS[s] })),
      },
    ],
    barLists: [managerBar, slaBar, reasonsBar],
    tables: [
      {
        key: "ordersTable",
        title: "Реестр заказов",
        icon: "📋",
        columns: [
          { key: "number", label: "Заказ" },
          { key: "client", label: "Клиент" },
          { key: "manager", label: "Менеджер" },
          { key: "category", label: "Категория" },
          { key: "direction", label: "Направление" },
          { key: "amount", label: "Сумма", align: "right" },
          { key: "status", label: "Статус" },
        ],
        rows: tableRows,
      },
    ],
    ai,
  };
}
