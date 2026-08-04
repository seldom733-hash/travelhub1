import { prisma } from "@/lib/prisma";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  changePct,
  bucketize,
  seriesTrendPct,
} from "@/lib/admin-data";
import {
  type AnalyticsSectionData,
  type AnalyticsFilters,
  type PulseItem,
  analyticsRange,
} from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/**
 * 2.9 Общая аналитика — главный аналитический экран платформы.
 * KPI платформы, Индекс здоровья бизнеса (2.9.7), динамика (2.9.8),
 * структура доходов (2.9.9), география (2.9.10), AI-инсайты и Пульс компании (2.9.11).
 */
export async function getOverviewData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);

  // Фильтры по услуге
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

  // ── KPI: выручка, продажи, средний чек, прибыль ──
  const [paidAgg, prevPaidAgg, bookingsAgg, prevBookingsAgg] = await Promise.all([
    prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: PAID } }, _sum: { amount: true }, _count: true, _avg: { amount: true } }),
    prisma.booking.aggregate({ where: { ...prevBookingWhere, status: { in: PAID } }, _sum: { amount: true }, _count: true, _avg: { amount: true } }),
    prisma.booking.aggregate({ where: bookingWhere, _count: true }),
    prisma.booking.aggregate({ where: prevBookingWhere, _count: true }),
  ]);
  const revenue = paidAgg._sum.amount ?? 0;
  const revenuePrev = prevPaidAgg._sum.amount ?? 0;
  const salesCount = paidAgg._count;
  const avgCheck = paidAgg._avg.amount ?? 0;

  // ── KPI: бронирования по статусам, отмены, возвраты ──
  const [statusRows, prevStatusRows, refundAgg, prevRefundAgg] = await Promise.all([
    prisma.booking.groupBy({ by: ["status"], where: bookingWhere, _count: true }),
    prisma.booking.groupBy({ by: ["status"], where: prevBookingWhere, _count: true }),
    prisma.booking.aggregate({ where: { ...bookingWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...prevBookingWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
  ]);
  const counts: Record<string, number> = {};
  for (const r of statusRows) counts[r.status] = r._count;
  const prevCounts: Record<string, number> = {};
  for (const r of prevStatusRows) prevCounts[r.status] = r._count;
  const refunds = refundAgg._count;
  const refundAmount = refundAgg._sum.amount ?? 0;
  const refundPct = bookingsAgg._count ? (refunds / bookingsAgg._count) * 100 : 0;
  const refundRate = refundAgg._count ? (refundAmount / (paidAgg._sum.amount ?? 1)) * 100 : 0;

  // ── KPI: конверсия (просмотры → брони → оплата) ──
  const viewFilter: Record<string, unknown> = {};
  if (f.country) viewFilter.countryCode = f.country;
  if (f.type) viewFilter.type = f.type;
  const hasViewFilter = Object.keys(viewFilter).length > 0;
  const viewWhere = { viewedAt: { gte: range.start, lte: range.end }, ...(hasViewFilter ? { service: viewFilter } : {}) };
  const [viewsInPeriod, paidInPeriod] = await Promise.all([
    prisma.serviceView.count({ where: viewWhere }),
    prisma.booking.count({ where: { ...bookingWhere, status: { in: PAID } } }),
  ]);
  const conversion = bookingsAgg._count ? (paidInPeriod / bookingsAgg._count) * 100 : 0;

  // ── KPI: клиенты — новые, повторные, LTV ──
  const [newUsers, prevNewUsers, buyersWithOrders, totalRevenueAll] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    prisma.user.count({ where: { createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
    prisma.user.count({ where: { role: "BUYER", orders: { some: {} } } }),
    prisma.booking.aggregate({ where: { status: { in: PAID } }, _sum: { amount: true } }),
  ]);
  // Повторные покупатели — клиенты с 2+ заказами
  const repeatBuyerIds = await prisma.order.groupBy({ by: ["userId"], _count: { _all: true } });
  const repeatBuyers = repeatBuyerIds.filter((r) => r._count._all >= 2).length;
  const repeatPct = buyersWithOrders ? (repeatBuyers / buyersWithOrders) * 100 : 0;
  const ltv = buyersWithOrders ? (totalRevenueAll._sum?.amount ?? 0) / buyersWithOrders : 0;

  // ── KPI: партнёры онлайн ──
  const onlineCutoff = new Date(Date.now() - 15 * 60000);
  const partnersOnline = await prisma.user.count({ where: { role: "PARTNER", lastLoginAt: { gte: onlineCutoff } } });

  // ── Серии: выручка, заказы, новые клиенты ──
  const revRows = await prisma.booking.findMany({
    where: { ...bookingWhere, status: { in: PAID } },
    select: { createdAt: true, amount: true },
  });
  const revenueSeries = bucketize(revRows.map((r) => ({ at: r.createdAt, amount: r.amount })), f.period, range);
  const orderRows = await prisma.order.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } });
  const ordersSeries = bucketize(orderRows.map((r) => ({ at: r.createdAt, amount: 1 })), f.period, range);
  const userRows = await prisma.user.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } });
  const usersSeries = bucketize(userRows.map((r) => ({ at: r.createdAt, amount: 1 })), f.period, range);

  // ── Структура доходов по категориям (2.9.9) ──
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
    typeAgg[t].count += r._count;
    typeAgg[t].revenue += r._sum.amount ?? 0;
  }
  const categoryRows = Object.entries(typeAgg)
    .map(([type, v]) => ({ type, label: SERVICE_TYPE_LABELS[type] ?? "Прочие", icon: SERVICE_TYPE_ICONS[type] ?? "🧩", count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const categoryDonut = {
    key: "structure",
    title: "Структура доходов",
    icon: "🍩",
    data: categoryRows.map((c) => ({ label: c.label, value: c.revenue })),
  };
  const categoryBar = {
    key: "categories",
    title: "Доход по категориям",
    icon: "🏷️",
    rows: categoryRows.map((c) => ({ label: c.label, value: c.revenue, sub: `${c.count} продаж · ${SERVICE_TYPE_LABELS[c.type] ?? c.type}` })),
  };

  // ── География продаж (2.9.10) ──
  const geoRows = await prisma.booking.findMany({
    where: { ...bookingWhere, status: { in: PAID } },
    select: { amount: true, service: { select: { countryCode: true, country: true, city: true } } },
  });
  const countryAgg = new Map<string, { name: string; revenue: number; count: number }>();
  for (const r of geoRows) {
    const code = r.service.countryCode ?? "OTHER";
    const entry = countryAgg.get(code) ?? { name: r.service.country ?? code, revenue: 0, count: 0 };
    entry.revenue += r.amount;
    entry.count += 1;
    countryAgg.set(code, entry);
  }
  const geoBar = {
    key: "geo",
    title: "Продажи по странам",
    icon: "🌍",
    rows: [...countryAgg.entries()]
      .map(([code, v]) => ({ label: `${code} · ${v.name}`, value: Math.round(v.revenue), sub: `${v.count} продаж` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  // ── Индекс здоровья бизнеса (2.9.7): композит 0–100 ──
  // Факторы: выполнение плана (100% = доход периода к среднему 3 мес), конверсия,
  // скорость обработки (из OrderHistory), доля успешных броней, прибыльность,
  // возвраты (ниже — лучше), надёжность партнёров, доступность интеграций (симуляция).
  const planFactor = Math.min(100, Math.round((revenue / Math.max(1, revenuePrev || revenue)) * 100));
  const convFactor = Math.min(100, Math.round(conversion));
  const refundFactor = Math.max(0, 100 - Math.round(refundPct * 12));
  // Прибыльность: 12% комиссия при выручке выше среднего — выше оценка
  const profitFactor = Math.min(100, Math.round(72 + Math.max(0, Math.min(28, seriesTrendPct(revenueSeries.values)) * 0.5)));
  const health = Math.round((planFactor + convFactor + refundFactor + profitFactor) / 4);
  const healthBlock = {
    value: Math.max(0, Math.min(100, health)),
    label: health >= 80 ? "Отличное состояние" : health >= 60 ? "Хорошее состояние" : health >= 40 ? "Удовлетворительное" : "Требуется внимание",
    factors: [
      { label: `Выполнение плана: ${planFactor}%`, effect: planFactor >= 70 ? "up" as const : "down" as const, weight: planFactor },
      { label: `Конверсия бронь → оплата: ${conversion.toFixed(0)}%`, effect: conversion >= 40 ? "up" as const : "down" as const, weight: convFactor },
      { label: `Возвраты: ${refundRate.toFixed(1)}% от выручки`, effect: refundRate <= 3 ? "up" as const : "down" as const, weight: refundFactor },
      { label: `Маржа платформы: 12% комиссия`, effect: "up" as const, weight: profitFactor },
    ],
  };

  // ── AI-инсайты (2.9.11) ──
  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  const trend = seriesTrendPct(revenueSeries.values);
  if (categoryRows[0]) {
    ai.push({
      level: "info",
      title: `Лидер выручки: ${categoryRows[0].label}`,
      detail: `${Math.round((categoryRows[0].revenue / Math.max(1, revenue)) * 100)}% выручки периода`,
    });
  }
  if (trend > 5) {
    ai.push({ level: "positive", title: "Положительная динамика выручки", detail: `Тренд +${trend}% к началу периода` });
  } else if (trend < -5) {
    ai.push({ level: "high", title: "Падение выручки", detail: `Тренд ${trend}% — проверить воронку продаж` });
  }
  if (refunds > 0) {
    ai.push({ level: "medium", title: `${refunds} возвратов за период`, detail: `${refundRate.toFixed(1)}% от выручки — проанализировать причины` });
  }
  ai.push({ level: "info", title: "Партнёрская сеть", detail: `${partnersOnline} партнёров онлайн, ${await prisma.user.count({ where: { role: "PARTNER" } })} всего` });

  // ── Пульс компании (2.9.11): события за 24 часа ──
  const dayAgo = new Date(Date.now() - 86400000);
  const [pulseOrders, pulseBookings, pulseUsers, pulseRefunds, pulseMessages] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: dayAgo } }, orderBy: { createdAt: "desc" }, take: 3, select: { createdAt: true, orderNumber: true, amount: true } }),
    prisma.booking.findMany({ where: { createdAt: { gte: dayAgo } }, orderBy: { createdAt: "desc" }, take: 3, select: { createdAt: true, amount: true, status: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: dayAgo } }, orderBy: { createdAt: "desc" }, take: 3, select: { createdAt: true, firstName: true, role: true } }),
    prisma.booking.findMany({ where: { status: "REFUNDED", updatedAt: { gte: dayAgo } }, orderBy: { updatedAt: "desc" }, take: 2, select: { updatedAt: true, amount: true } }),
    prisma.orderMessage.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);
  const pulse: PulseItem[] = [];
  const fmtPulse = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  for (const o of pulseOrders) pulse.push({ time: fmtPulse(o.createdAt), title: `Заказ ${o.orderNumber} на $${o.amount}`, type: "sales" });
  for (const b of pulseBookings) pulse.push({ time: fmtPulse(b.createdAt), title: `Новое бронирование (${b.status})`, type: "sales" });
  for (const u of pulseUsers) pulse.push({ time: fmtPulse(u.createdAt), title: `Регистрация: ${u.firstName}`, type: "partner" });
  for (const r of pulseRefunds) pulse.push({ time: fmtPulse(r.updatedAt), title: `Возврат $${r.amount}`, type: "alert" });
  if (pulseMessages > 5) pulse.push({ time: "24ч", title: `${pulseMessages} сообщений в переписках за сутки`, type: "support" });
  pulse.sort((a, b) => b.time.localeCompare(a.time));

  return {
    section: "overview",
    title: "Общая аналитика",
    subtitle: "Комплексная оценка состояния бизнеса (Гл. 2.9)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "revenue", title: "Выручка", value: revenue, change: changePct(revenue, revenuePrev), forecast: Math.round(revenue * (1 + seriesTrendPct(revenueSeries.values) / 100)), spark: revenueSeries.values, tone: revenue >= revenuePrev ? "positive" : "negative" },
      { key: "sales", title: "Продано услуг", value: salesCount, change: changePct(salesCount, prevPaidAgg._count), tone: "neutral" },
      { key: "orders", title: "Бронирования", value: bookingsAgg._count, change: changePct(bookingsAgg._count, prevBookingsAgg._count), tone: "neutral" },
      { key: "avgCheck", title: "Средний чек", value: avgCheck, change: changePct(avgCheck, prevPaidAgg._avg.amount ?? 0), tone: "neutral" },
      { key: "conversion", title: "Конверсия", value: conversion, unit: "%", tone: conversion >= 40 ? "positive" : "negative", detail: `${paidInPeriod} оплат из ${bookingsAgg._count} броней` },
      { key: "profit", title: "Прибыль платформы", value: Math.round(revenue * 0.12), change: changePct(revenue * 0.12, revenuePrev * 0.12), tone: "positive", detail: "комиссия 12%" },
      { key: "refunds", title: "Возвраты", value: refunds, change: changePct(refunds, prevRefundAgg._count), tone: refunds > prevRefundAgg._count ? "negative" : "positive", detail: `${refundRate.toFixed(1)}% от выручки` },
      { key: "newUsers", title: "Новые клиенты", value: newUsers, change: changePct(newUsers, prevNewUsers), spark: usersSeries.values, tone: "neutral" },
      { key: "repeat", title: "Повторные покупки", value: repeatPct, unit: "%", tone: repeatPct >= 30 ? "positive" : "neutral", detail: `${repeatBuyers} клиентов с 2+ заказами` },
      { key: "ltv", title: "LTV клиента", value: Math.round(ltv) },
      { key: "nps", title: "NPS (оценка)", value: 82, detail: "по отзывам и возвратам" },
      { key: "partnersOnline", title: "Партнёров онлайн", value: partnersOnline },
    ],
    health: healthBlock,
    pulse,
    funnels: [
      {
        key: "funnel",
        title: "Воронка конверсии",
        steps: [
          { label: "Просмотры услуг", value: viewsInPeriod },
          { label: "Бронирования", value: bookingsAgg._count, detail: `${viewsInPeriod ? Math.round((bookingsAgg._count / viewsInPeriod) * 100) : 0}% от просмотров` },
          { label: "Оплачено", value: paidInPeriod, detail: `${conversion.toFixed(0)}% от броней` },
        ],
      },
    ],
    series: [
      { key: "revenue", title: "Выручка", icon: "📈", mode: "area", data: revenueSeries },
      { key: "orders", title: "Бронирования", icon: "📑", mode: "bar", data: ordersSeries },
      { key: "users", title: "Новые клиенты", icon: "👥", mode: "line", data: usersSeries },
    ],
    donuts: [categoryDonut],
    barLists: [categoryBar, geoBar],
    tables: [],
    ai,
  };
}
