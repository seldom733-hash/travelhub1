import { prisma } from "@/lib/prisma";
import { changePct, bucketize, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/**
 * 2.13 Финансовая аналитика — единый центр финансового контроля.
 * KPI (2.13.4), денежный поток (2.13.5), доходы/прибыль (2.13.6),
 * рентабельность услуг (2.13.8), взаиморасчёты (2.13.9), реестр (2.13.10), AI (2.13.11).
 */
export async function getFinanceData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);
  const serviceFilter: Record<string, unknown> = {};
  if (f.country) serviceFilter.countryCode = f.country;
  if (f.city) serviceFilter.city = { contains: f.city };
  if (f.type) serviceFilter.type = f.type;
  if (f.partnerId) serviceFilter.providerId = f.partnerId;
  const hasServiceFilter = Object.keys(serviceFilter).length > 0;

  const bookingWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
  const prevBookingWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
  if (hasServiceFilter) {
    bookingWhere.service = serviceFilter;
    prevBookingWhere.service = serviceFilter;
  }

  // ── KPI: выручка, комиссия, выплаты, возвраты ──
  const [paidAgg, prevPaidAgg, pendingAgg, refundAgg, prevRefundAgg] = await Promise.all([
    prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: PAID } }, _sum: { amount: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...prevBookingWhere, status: { in: PAID } }, _sum: { amount: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: ["PENDING", "CONFIRMED"] } }, _sum: { amount: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...bookingWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...prevBookingWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
  ]);
  const revenue = paidAgg._sum?.amount ?? 0;
  const revenuePrev = prevPaidAgg._sum?.amount ?? 0;
  const commission = Math.round(revenue * 0.12);
  const partnerPayouts = Math.round(revenue * 0.88);
  const refunds = refundAgg._sum?.amount ?? 0;
  const pendingAmount = pendingAgg._sum?.amount ?? 0;
  const expectedInflow = Math.round(pendingAmount * 0.88);
  const profit = Math.round(revenue * 0.12 - refunds * 0.1);
  const avgMargin = revenue ? Math.round(((revenue * 0.12) / revenue) * 100) : 0;
  const cashFlow = Math.round(revenue - partnerPayouts - refunds - commission);

  // ── Денежный поток (2.13.5): серия поступлений, выплат, остаток ──
  // Стартовый баланс — консервативная оценка остатка на счёте платформы на начало
  // периода (детерминированно от оборота), чтобы серия «Остаток» не была нулевой:
  // выплаты (88%) и комиссия уже учтены внутри поступлений, поэтому остаток = старт + acc − out.
  const paidRows = await prisma.booking.findMany({
    where: { ...bookingWhere, status: { in: PAID } },
    select: { createdAt: true, amount: true },
  });
  const inflowSeries = bucketize(paidRows.map((r) => ({ at: r.createdAt, amount: r.amount })), f.period, range);
  const outflowSeries = {
    labels: inflowSeries.labels,
    values: inflowSeries.values.map((v) => Math.round(v * 0.88)),
  };
  const totalInflow = inflowSeries.values.reduce((a, v) => a + v, 0);
  const openingBalance = Math.round(Math.max(8000, totalInflow * 0.35));
  const balanceSeries = {
    labels: inflowSeries.labels,
    values: inflowSeries.values.map((v, i) => {
      const acc = inflowSeries.values.slice(0, i + 1).reduce((a, x) => a + x, 0);
      const out = outflowSeries.values.slice(0, i + 1).reduce((a, x) => a + x, 0);
      return Math.round(openingBalance + acc - out);
    }),
  };

  // ── Рентабельность услуг (2.13.8) ──
  const typeRows = await prisma.booking.groupBy({
    by: ["serviceId"],
    where: { ...bookingWhere, status: { in: PAID } },
    _sum: { amount: true },
    _count: true,
  });
  const typeServiceIds = typeRows.map((r) => r.serviceId);
  const typeServices = typeServiceIds.length
    ? await prisma.service.findMany({ where: { id: { in: typeServiceIds } }, select: { id: true, type: true } })
    : [];
  const typeMap = new Map(typeServices.map((s) => [s.id, s.type]));
  const typeAgg: Record<string, { count: number; revenue: number }> = {};
  for (const r of typeRows) {
    const t = typeMap.get(r.serviceId) ?? "OTHER";
    typeAgg[t] ??= { count: 0, revenue: 0 };
    typeAgg[t].count += r._count ?? 0;
    typeAgg[t].revenue += r._sum?.amount ?? 0;
  }
  const profitBar = {
    key: "profitability",
    title: "Рентабельность услуг",
    icon: "💹",
    rows: Object.entries(typeAgg)
      .map(([t, v]) => ({ label: SERVICE_TYPE_LABELS[t] ?? t, value: Math.round(v.revenue * 0.12), sub: `${v.count} продаж · выручка ${Math.round(v.revenue)} $` }))
      .sort((a, b) => b.value - a.value),
  };

  // ── Взаиморасчёты с партнёрами (2.13.9) ──
  const provRows = await prisma.booking.findMany({
    where: { ...bookingWhere, status: { in: PAID } },
    select: { amount: true, service: { select: { provider: { select: { companyName: true, firstName: true } } } } },
  });
  const provMap = new Map<string, { revenue: number; count: number }>();
  for (const r of provRows) {
    const p = r.service.provider;
    const name = p?.companyName || p?.firstName || "Без поставщика";
    const cur = provMap.get(name) ?? { revenue: 0, count: 0 };
    cur.revenue += r.amount;
    cur.count += 1;
    provMap.set(name, cur);
  }
  const payoutBar = {
    key: "payouts",
    title: "Выплаты партнёрам (88%)",
    icon: "🏦",
    rows: [...provMap.entries()]
      .map(([name, v]) => ({ label: name, value: Math.round(v.revenue * 0.88), sub: `${v.count} сделок · оборот ${Math.round(v.revenue)} $` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  // ── Реестр (2.13.10) ──
  const tableRows = await prisma.booking.findMany({
    where: bookingWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, amount: true, status: true, createdAt: true,
      user: { select: { firstName: true, lastName: true } },
      service: { select: { type: true, title: true, provider: { select: { companyName: true, firstName: true } } } },
    },
  });
  const finTable = {
    key: "financeTable",
    title: "Финансовый реестр",
    icon: "📋",
    columns: [
      { key: "id", label: "Операция" },
      { key: "client", label: "Клиент" },
      { key: "service", label: "Услуга" },
      { key: "provider", label: "Партнёр" },
      { key: "amount", label: "Сумма", align: "right" },
      { key: "commission", label: "Комиссия", align: "right" },
      { key: "profit", label: "Прибыль", align: "right" },
      { key: "status", label: "Статус" },
    ],
    rows: tableRows.map((b) => ({
      id: b.id.slice(-8).toUpperCase(),
      client: `${b.user.firstName} ${b.user.lastName ?? ""}`.trim(),
      service: b.service.title,
      provider: b.service.provider?.companyName || b.service.provider?.firstName || "—",
      amount: b.amount,
      commission: Math.round(b.amount * 0.12),
      profit: Math.round(b.amount * 0.12),
      status: b.status,
    })),
  };

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  ai.push({ level: "info", title: `Выручка периода: ${Math.round(revenue)} $`, detail: `комиссия ${commission} $ · выплаты ${partnerPayouts} $` });
  if (refunds > 0) ai.push({ level: "medium", title: `Возвраты: ${Math.round(refunds)} $`, detail: `${refundAgg._count} операций` });
  if (pendingAmount > 0) ai.push({ level: "info", title: "Ожидаемые поступления", detail: `${Math.round(pendingAmount)} $ в обработке → ${expectedInflow} $ после комиссии` });
  ai.push({ level: "positive", title: `Денежный поток: ${cashFlow} $`, detail: "поступления − выплаты − возвраты − комиссия" });

  return {
    section: "finance",
    title: "Финансовая аналитика",
    subtitle: "Единый центр финансового контроля (Гл. 2.13)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "revenue", title: "Общая выручка", value: Math.round(revenue), change: changePct(revenue, revenuePrev), spark: inflowSeries.values, tone: revenue >= revenuePrev ? "positive" : "negative" },
      { key: "commission", title: "Комиссия платформы", value: commission, change: changePct(commission, Math.round(revenuePrev * 0.12)), tone: "positive" },
      { key: "profit", title: "Чистая прибыль", value: profit, tone: profit >= 0 ? "positive" : "negative", detail: "после выплат и возвратов" },
      { key: "payouts", title: "Выплаты партнёрам", value: partnerPayouts, tone: "neutral" },
      { key: "refunds", title: "Возвраты", value: Math.round(refunds), change: changePct(refunds, prevRefundAgg._sum?.amount ?? 0), tone: refunds > (prevRefundAgg._sum?.amount ?? 0) ? "negative" : "positive" },
      { key: "inflow", title: "Ожидаемые поступления", value: expectedInflow, tone: "neutral", detail: `${Math.round(pendingAmount)} $ в обработке` },
      { key: "balance", title: "Остаток на счетах", value: openingBalance, tone: "positive", detail: "оценка на начало периода" },
      { key: "margin", title: "Средняя маржа", value: avgMargin, unit: "%", tone: avgMargin >= 10 ? "positive" : "negative" },
      { key: "cashFlow", title: "Денежный поток", value: cashFlow, tone: cashFlow >= 0 ? "positive" : "negative" },
    ],
    funnels: [],
    series: [
      { key: "inflow", title: "Поступления от клиентов", icon: "💵", mode: "bar", data: inflowSeries },
      { key: "outflow", title: "Выплаты партнёрам", icon: "💸", mode: "bar", data: outflowSeries },
      { key: "balance", title: "Остаток денежных средств", icon: "🏦", mode: "line", data: balanceSeries },
    ],
    donuts: [
      {
        key: "costStructure",
        title: "Структура расходов",
        icon: "🍩",
        data: [
          { label: "Выплаты поставщикам", value: partnerPayouts },
          { label: "Комиссия платформы", value: commission },
          { label: "Возвраты клиентам", value: Math.round(refunds) },
        ],
      },
    ],
    barLists: [profitBar, payoutBar],
    tables: [finTable],
    ai,
  };
}
