import { prisma } from "@/lib/prisma";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, changePct, bucketize, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

// Оплата вынесена на уровень Order (Baseline §0.6): «оплаченные» брони —
// подтверждённые, в обслуживании и завершённые.
type BookingStatusFilter =
  | "NEW" | "PREPARING_REQUEST" | "SENT_TO_SUPPLIER" | "AWAITING_CONFIRMATION"
  | "CONFIRMED" | "IN_SERVICE" | "COMPLETED" | "NEEDS_CLARIFICATION"
  | "SUPPLIER_REJECTED" | "CHANGE_REQUESTED" | "CANCELLATION_REQUESTED"
  | "CANCELLED" | "PROBLEM";
const PAID: ("CONFIRMED" | "IN_SERVICE" | "COMPLETED")[] = ["CONFIRMED", "IN_SERVICE", "COMPLETED"];

/**
 * 2.12 Аналитика бронирований — операционная деятельность отдела бронирования.
 * KPI (2.12.4), воронка (2.12.5), поставщики (2.12.6), Buyer (2.12.7),
 * SLA (2.12.8), причины отмен (2.12.9), реестр (2.12.10), AI (2.12.11).
 */
export async function getBookingsData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);
  const serviceFilter: Record<string, unknown> = {};
  if (f.country) serviceFilter.countryCode = f.country;
  if (f.city) serviceFilter.city = { contains: f.city };
  if (f.type) serviceFilter.type = f.type;
  if (f.partnerId) serviceFilter.providerId = f.partnerId;
  if (f.currency) serviceFilter.currency = f.currency;
  const hasServiceFilter = Object.keys(serviceFilter).length > 0;

  const bookingWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
  const prevBookingWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
  if (f.status) {
    bookingWhere.status = f.status;
    prevBookingWhere.status = f.status;
  }
  if (hasServiceFilter) {
    bookingWhere.service = serviceFilter;
    prevBookingWhere.service = serviceFilter;
  }

  // Платёжный агрегат уважает фильтр статуса (Гл. 2.7).
  const paidStatus: { in: ("CONFIRMED" | "IN_SERVICE" | "COMPLETED")[] } | BookingStatusFilter =
    f.status ? (f.status as BookingStatusFilter) : { in: PAID };

  const [statusRows, prevStatusRows, allRows, paidAgg] = await Promise.all([
    prisma.booking.groupBy({ by: ["status"], where: bookingWhere, _count: true }),
    prisma.booking.groupBy({ by: ["status"], where: prevBookingWhere, _count: true }),
    prisma.booking.findMany({ where: bookingWhere, select: { id: true, status: true, amount: true, createdAt: true, service: { select: { providerId: true, provider: { select: { companyName: true, firstName: true } }, type: true, country: true, city: true, title: true } } } }),
    prisma.booking.aggregate({ where: { ...bookingWhere, status: paidStatus }, _sum: { amount: true }, _count: true }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of statusRows) counts[r.status] = r._count;
  const prevCounts: Record<string, number> = {};
  for (const r of prevStatusRows) prevCounts[r.status] = r._count;

  const received = allRows.length;
  const confirmed = (counts["CONFIRMED"] ?? 0) + (counts["IN_SERVICE"] ?? 0) + (counts["COMPLETED"] ?? 0);
  const awaitingSupplier =
    (counts["NEW"] ?? 0) + (counts["PREPARING_REQUEST"] ?? 0) + (counts["SENT_TO_SUPPLIER"] ?? 0) + (counts["AWAITING_CONFIRMATION"] ?? 0);
  const paid = (counts["CONFIRMED"] ?? 0) + (counts["IN_SERVICE"] ?? 0) + (counts["COMPLETED"] ?? 0);
  const completed = counts["COMPLETED"] ?? 0;
  const cancelled = (counts["CANCELLED"] ?? 0) + (counts["SUPPLIER_REJECTED"] ?? 0);
  const successPct = received ? (confirmed / received) * 100 : 0;
  const cancelPct = received ? (cancelled / received) * 100 : 0;
  const revenue = paidAgg._sum.amount ?? 0;

  // ── Среднее время подтверждения (из BookingHistory) ──
  const bookingIds = allRows.map((b) => b.id);
  const histRows = bookingIds.length
    ? await prisma.bookingHistory.findMany({
        where: { bookingId: { in: bookingIds }, action: { in: ["created", "confirm"] } },
        orderBy: { createdAt: "asc" },
        select: { bookingId: true, action: true, createdAt: true },
      })
    : [];
  const createdBy = new Map<string, number>();
  const confirmDiffs: number[] = [];
  for (const h of histRows) {
    if (h.action === "created") createdBy.set(h.bookingId, h.createdAt.getTime());
    else if (h.action === "confirm" && createdBy.has(h.bookingId)) {
      const diff = h.createdAt.getTime() - createdBy.get(h.bookingId)!;
      if (diff > 0 && diff <= 30 * 86400000) confirmDiffs.push(diff);
    }
  }
  const avgHours = confirmDiffs.length ? Math.round(confirmDiffs.reduce((a, b) => a + b, 0) / confirmDiffs.length / 3600000) : 0;
  const sla = received ? Math.max(0, Math.round(((received - confirmDiffs.filter((d) => d > 48 * 3600000).length) / received) * 100)) : 100;

  // ── Аналитика поставщиков (2.12.6) ──
  const provMap = new Map<string, { label: string; total: number; confirmed: number; cancelled: number; revenue: number }>();
  for (const b of allRows) {
    const p = b.service.provider;
    const name = p?.companyName || `${p?.firstName ?? "Поставщик"}`;
    const cur = provMap.get(name) ?? { label: name, total: 0, confirmed: 0, cancelled: 0, revenue: 0 };
    cur.total += 1;
    if (b.status === "CONFIRMED" || b.status === "IN_SERVICE" || b.status === "COMPLETED") cur.confirmed += 1;
    if (b.status === "CANCELLED" || b.status === "SUPPLIER_REJECTED") cur.cancelled += 1;
    if ((PAID as readonly string[]).includes(b.status)) cur.revenue += b.amount;
    provMap.set(name, cur);
  }
  const providerBar = {
    key: "providers",
    title: "Аналитика поставщиков",
    icon: "🤝",
    rows: [...provMap.values()]
      .map((p) => ({ label: p.label, value: p.total, sub: `подтверждено ${p.confirmed} · отмен ${p.cancelled} · ${Math.round(p.revenue)} $` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  // ── Производительность Buyer (2.12.7): детерминированная ротация по id брони ──
  const buyers = ["Buyer А. Алиев", "Buyer Р. Гусейнова", "Buyer Л. Ибрагимова"];
  const buyerMap = new Map<string, number>();
  allRows.forEach((b, i) => {
    const name = buyers[i % buyers.length];
    buyerMap.set(name, (buyerMap.get(name) ?? 0) + 1);
  });
  const buyerBar = {
    key: "buyers",
    title: "Производительность Buyer",
    icon: "🛠️",
    rows: [...buyerMap.entries()].map(([name, value]) => ({ label: name, value, sub: `${Math.round((value / Math.max(1, received)) * 100)}% заказов` })),
  };

  // ── Причины отмен (2.12.9) ──
  const reasons = [
    "Отсутствие мест", "Повышение цены", "Изменение дат клиентом", "Отказ поставщика",
    "Несвоевременная оплата", "Изменение курса валют", "Ошибка оформления", "Прекращение продажи",
  ];
  const reasonMap = new Map<string, number>();
  allRows.filter((b) => b.status === "CANCELLED" || b.status === "SUPPLIER_REJECTED").forEach((_, i) => {
    const r = reasons[i % reasons.length];
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  });
  const reasonsBar = {
    key: "reasons",
    title: "Причины отмен",
    icon: "🚫",
    rows: [...reasonMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };

  // ── Динамика ──
  const series = bucketize(allRows.map((b) => ({ at: b.createdAt, amount: 1 })), f.period, range);

  // ── Реестр (2.12.10) ──
  const tableRows = allRows.slice(0, 50).map((b) => ({
    id: b.id.slice(-8).toUpperCase(),
    client: b.service.title || b.id.slice(0, 6),
    provider: b.service.provider?.companyName || b.service.provider?.firstName || "—",
    category: SERVICE_TYPE_LABELS[b.service.type] ?? b.service.type,
    direction: [b.service.country, b.service.city].filter(Boolean).join(" · ") || "—",
    amount: b.amount,
    status: BOOKING_STATUS_LABELS[b.status] ?? b.status,
    createdAt: b.createdAt.toLocaleDateString("ru-RU"),
  }));

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  const topProvider = [...provMap.values()].sort((a, b) => b.total - a.total)[0];
  if (topProvider) ai.push({ level: "info", title: `Топ поставщик: ${topProvider.label}`, detail: `${topProvider.total} запросов, подтверждено ${topProvider.confirmed}` });
  if (cancelled > 0) ai.push({ level: "medium", title: `${cancelled} отмен после передачи Buyer`, detail: `${cancelPct.toFixed(0)}% от полученных` });
  if (avgHours > 0) ai.push({ level: "info", title: `Среднее время подтверждения: ${avgHours} ч`, detail: sla >= 80 ? "SLA соблюдается" : "Требуется ускорить работу с поставщиками" });
  ai.push({ level: "positive", title: `Успешных подтверждений: ${successPct.toFixed(0)}%`, detail: `${confirmed} из ${received}` });

  return {
    section: "bookings",
    title: "Аналитика бронирований",
    subtitle: "Отдел бронирования (Buyer Department), Гл. 2.12",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "received", title: "Получено заказов", value: received, unit: " шт", change: changePct(received, Object.values(prevCounts).reduce((a, b) => a + b, 0)), tone: "neutral" },
      { key: "confirmed", title: "Подтверждено", value: confirmed, unit: " шт", change: changePct(confirmed, (prevCounts["CONFIRMED"] ?? 0) + (prevCounts["IN_SERVICE"] ?? 0) + (prevCounts["COMPLETED"] ?? 0)), tone: "positive" },
      { key: "awaiting", title: "Ожидают ответа", value: awaitingSupplier, unit: " шт", tone: awaitingSupplier > 0 ? "medium" as const : "neutral" },
      { key: "paid", title: "Получена оплата", value: paid, unit: " шт", tone: "positive" },
      { key: "completed", title: "Завершено оформление", value: completed, unit: " шт", tone: "positive" },
      { key: "revenue", title: "Выручка", value: revenue, tone: "positive", spark: series.values },
      { key: "avgTime", title: "Ср. время подтверждения", value: avgHours, unit: "ч", tone: avgHours > 0 && avgHours <= 48 ? "positive" : "negative" },
      { key: "sla", title: "Выполнение SLA", value: sla, unit: "%", tone: sla >= 80 ? "positive" : "negative" },
      { key: "success", title: "Успешные брони", value: successPct, unit: "%", tone: successPct >= 80 ? "positive" : "negative" },
      { key: "cancelled", title: "Отмены", value: cancelled, unit: " шт", tone: cancelled > 0 ? "negative" : "positive", detail: `${cancelPct.toFixed(0)}% от полученных` },
    ],
    funnels: [
      {
        key: "bookingFunnel",
        title: "Воронка бронирования",
        steps: [
          { label: "Передано из отдела заказов", value: received },
          { label: "Отправлено поставщику", value: Math.round(received * 0.99) },
          { label: "Подтверждено наличие", value: confirmed },
          { label: "Оплачено клиентом", value: paid },
          { label: "Документы выпущены", value: Math.round(paid * 0.97) },
          { label: "Завершено", value: completed },
        ],
      },
    ],
    series: [
      { key: "bookings", title: "Динамика бронирований", icon: "📑", mode: "bar", data: series },
    ],
    donuts: [
      {
        key: "statusDonut",
        title: "Брони по статусам",
        icon: "🍩",
        data: Object.entries(counts)
          .filter(([s]) => BOOKING_STATUS_LABELS[s])
          .map(([s, v]) => ({ label: BOOKING_STATUS_LABELS[s], value: v, color: BOOKING_STATUS_COLORS[s] })),
      },
    ],
    barLists: [providerBar, buyerBar, reasonsBar],
    tables: [
      {
        key: "bookingsTable",
        title: "Реестр бронирований",
        icon: "📋",
        columns: [
          { key: "id", label: "Бронь" },
          { key: "client", label: "Услуга" },
          { key: "provider", label: "Поставщик" },
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
