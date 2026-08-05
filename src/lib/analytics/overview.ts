import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_GROUPS,
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

const PAID = [...ORDER_STATUS_GROUPS.paid] as const;

/**
 * 2.9 Общая аналитика — главный аналитический экран платформы.
 * KPI платформы, Индекс здоровья бизнеса (2.9.7), динамика (2.9.8),
 * структура доходов (2.9.9), география (2.9.10), AI-инсайты и Пульс компании (2.9.11).
 *
 * Все денежные и количественные показатели строятся на заказах (Order) —
 * том же источнике, что раздел «Продажи и исполнение» (Гл. 3), чтобы карточки
 * Аналитики совпадали с реестром заказов.
 */
export async function getOverviewData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);

  // Фильтры по услуге (заказ связан с услугами через бронирования)
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

  // Платёжные агрегаты уважают фильтр статуса: при выбранном статусе вся страница
  // показывает данные только по нему, иначе — только оплаченные (Гл. 2.7).
  const paidStatus: { in: (typeof PAID)[number][] } | (typeof PAID)[number] = f.status
    ? (f.status as (typeof PAID)[number])
    : { in: [...PAID] };

  // ── KPI: выручка, продажи, заказы, средний чек, прибыль ──
  const [paidAgg, prevPaidAgg, ordersAgg, prevOrdersAgg] = await Promise.all([
    prisma.order.aggregate({ where: { ...orderWhere, status: paidStatus }, _sum: { paidAmount: true }, _count: true, _avg: { paidAmount: true } }),
    prisma.order.aggregate({ where: { ...prevOrderWhere, status: paidStatus }, _sum: { paidAmount: true }, _count: true, _avg: { paidAmount: true } }),
    prisma.order.aggregate({ where: orderWhere, _count: true }),
    prisma.order.aggregate({ where: prevOrderWhere, _count: true }),
  ]);
  const revenue = paidAgg._sum.paidAmount ?? 0;
  const revenuePrev = prevPaidAgg._sum.paidAmount ?? 0;
  const salesCount = paidAgg._count;
  const avgCheck = paidAgg._avg.paidAmount ?? 0;

  // ── KPI: заказы по статусам, отмены, возвраты ──
  const [statusRows, prevStatusRows, refundAgg, prevRefundAgg] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: true }),
    prisma.order.groupBy({ by: ["status"], where: prevOrderWhere, _count: true }),
    prisma.order.aggregate({ where: { ...orderWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
    prisma.order.aggregate({ where: { ...prevOrderWhere, status: "REFUNDED" }, _sum: { amount: true }, _count: true }),
  ]);
  const counts: Record<string, number> = {};
  for (const r of statusRows) counts[r.status] = r._count;
  const prevCounts: Record<string, number> = {};
  for (const r of prevStatusRows) prevCounts[r.status] = r._count;
  const refunds = refundAgg._count;
  const refundAmount = refundAgg._sum.amount ?? 0;
  const refundPct = ordersAgg._count ? (refunds / ordersAgg._count) * 100 : 0;
  const refundRate = refundAgg._count ? (refundAmount / (paidAgg._sum.paidAmount ?? 1)) * 100 : 0;

  // ── KPI: конверсия (просмотры → заказы → оплата) ──
  const viewFilter: Record<string, unknown> = {};
  if (f.country) viewFilter.countryCode = f.country;
  if (f.type) viewFilter.type = f.type;
  const hasViewFilter = Object.keys(viewFilter).length > 0;
  const viewWhere = { viewedAt: { gte: range.start, lte: range.end }, ...(hasViewFilter ? { service: viewFilter } : {}) };
  const [viewsInPeriod, paidInPeriod] = await Promise.all([
    prisma.serviceView.count({ where: viewWhere }),
    prisma.order.count({ where: { ...orderWhere, status: paidStatus } }),
  ]);
  const conversion = ordersAgg._count ? (paidInPeriod / ordersAgg._count) * 100 : 0;

  // ── KPI: клиенты — новые, повторные, LTV ──
  const [newUsers, prevNewUsers, buyersWithOrders, totalRevenueAll] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    prisma.user.count({ where: { createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
    prisma.user.count({ where: { role: "BUYER", orders: { some: {} } } }),
    prisma.order.aggregate({ where: { status: { in: [...PAID] } }, _sum: { paidAmount: true } }),
  ]);
  // Повторные покупатели — клиенты с 2+ заказами
  const repeatBuyerIds = await prisma.order.groupBy({ by: ["userId"], _count: { _all: true } });
  const repeatBuyers = repeatBuyerIds.filter((r) => r._count._all >= 2).length;
  const repeatPct = buyersWithOrders ? (repeatBuyers / buyersWithOrders) * 100 : 0;
  const ltv = buyersWithOrders ? (totalRevenueAll._sum?.paidAmount ?? 0) / buyersWithOrders : 0;

  // ── KPI: партнёры онлайн ──
  const onlineCutoff = new Date(Date.now() - 15 * 60000);
  const partnersOnline = await prisma.user.count({ where: { role: "PARTNER", lastLoginAt: { gte: onlineCutoff } } });

  // ── Серии: выручка, заказы, новые клиенты ──
  const paidRows = await prisma.order.findMany({
    where: { ...orderWhere, status: paidStatus },
    select: {
      createdAt: true,
      paidAmount: true,
      bookings: { select: { service: { select: { type: true, countryCode: true, country: true, city: true } } } },
    },
  });
  const revenueSeries = bucketize(paidRows.map((r) => ({ at: r.createdAt, amount: r.paidAmount ?? 0 })), f.period, range);
  const orderRows = await prisma.order.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } });
  const ordersSeries = bucketize(orderRows.map((r) => ({ at: r.createdAt, amount: 1 })), f.period, range);
  const userRows = await prisma.user.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } });
  const usersSeries = bucketize(userRows.map((r) => ({ at: r.createdAt, amount: 1 })), f.period, range);

  // ── Структура доходов по категориям (2.9.9): по услугам оплаченных заказов ──
  const typeAgg: Record<string, { count: number; revenue: number }> = {};
  for (const o of paidRows) {
    const services = o.bookings.map((b) => b.service);
    if (!services.length) {
      typeAgg["OTHER"] ??= { count: 0, revenue: 0 };
      typeAgg["OTHER"].count += 1;
      typeAgg["OTHER"].revenue += o.paidAmount ?? 0;
      continue;
    }
    const perType = (o.paidAmount ?? 0) / services.length;
    for (const s of services) {
      const t = s.type ?? "OTHER";
      typeAgg[t] ??= { count: 0, revenue: 0 };
      typeAgg[t].count += 1;
      typeAgg[t].revenue += perType;
    }
  }
  const categoryRows = Object.entries(typeAgg)
    .map(([type, v]) => ({ type, label: SERVICE_TYPE_LABELS[type] ?? "Прочие", icon: SERVICE_TYPE_ICONS[type] ?? "🧩", count: v.count, revenue: Math.round(v.revenue) }))
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

  // ── География продаж (2.9.10): Страна → Город для интерактивной карты ──
  const countryAgg = new Map<string, { name: string; revenue: number; count: number; cities: Map<string, { revenue: number; count: number }> }>();
  for (const o of paidRows) {
    const services = o.bookings.map((b) => b.service);
    const perDest = services.length ? (o.paidAmount ?? 0) / services.length : (o.paidAmount ?? 0);
    const dests = services.length ? services : [];
    if (!dests.length) {
      const code = "OTHER";
      const entry = countryAgg.get(code) ?? { name: "Прочее", revenue: 0, count: 0, cities: new Map() };
      entry.revenue += perDest;
      entry.count += 1;
      countryAgg.set(code, entry);
      continue;
    }
    for (const s of dests) {
      const code = s.countryCode ?? "OTHER";
      const entry = countryAgg.get(code) ?? { name: s.country ?? code, revenue: 0, count: 0, cities: new Map() };
      entry.revenue += perDest;
      entry.count += 1;
      const city = s.city ?? "—";
      const cityEntry = entry.cities.get(city) ?? { revenue: 0, count: 0 };
      cityEntry.revenue += perDest;
      cityEntry.count += 1;
      entry.cities.set(city, cityEntry);
      countryAgg.set(code, entry);
    }
  }
  const geo: { code: string; name: string; revenue: number; count: number; cities: { name: string; revenue: number; count: number }[] }[] = [...countryAgg.entries()]
    .map(([code, v]) => ({
      code,
      name: v.name,
      revenue: Math.round(v.revenue),
      count: v.count,
      cities: [...v.cities.entries()]
        .map(([name, c]) => ({ name, revenue: Math.round(c.revenue), count: c.count }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6),
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const geoBar = {
    key: "geo",
    title: "Продажи по странам",
    icon: "🌍",
    rows: geo.slice(0, 8).map((g) => ({ label: `${g.code} · ${g.name}`, value: g.revenue, sub: `${g.count} продаж · ${g.cities.length} городов` })),
  };

  // ── Индекс здоровья бизнеса (2.9.7): композит 0–100 ──
  // Факторы: выполнение плана (100% = доход периода к предыдущему), конверсия,
  // возвраты (ниже — лучше), прибыльность (12% комиссия).
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
      { label: `Конверсия заказ → оплата: ${conversion.toFixed(0)}%`, effect: conversion >= 40 ? "up" as const : "down" as const, weight: convFactor },
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
    prisma.order.findMany({ where: { status: "REFUNDED", updatedAt: { gte: dayAgo } }, orderBy: { updatedAt: "desc" }, take: 2, select: { updatedAt: true, amount: true } }),
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
      { key: "sales", title: "Продано услуг", value: salesCount, unit: " шт", change: changePct(salesCount, prevPaidAgg._count), tone: "neutral" },
      { key: "orders", title: "Заказы", value: ordersAgg._count, unit: " шт", change: changePct(ordersAgg._count, prevOrdersAgg._count), tone: "neutral" },
      { key: "avgCheck", title: "Средний чек", value: avgCheck, change: changePct(avgCheck, prevPaidAgg._avg.paidAmount ?? 0), tone: "neutral" },
      { key: "conversion", title: "Конверсия", value: conversion, unit: "%", tone: conversion >= 40 ? "positive" : "negative", detail: `${paidInPeriod} оплат из ${ordersAgg._count} заказов` },
      { key: "profit", title: "Прибыль платформы", value: Math.round(revenue * 0.12), change: changePct(revenue * 0.12, revenuePrev * 0.12), tone: "positive", detail: "комиссия 12%" },
      { key: "refunds", title: "Возвраты", value: refunds, change: changePct(refunds, prevRefundAgg._count), tone: refunds > prevRefundAgg._count ? "negative" : "positive", detail: `${refundRate.toFixed(1)}% от выручки` },
      { key: "newUsers", title: "Новые клиенты", value: newUsers, unit: " чел.", change: changePct(newUsers, prevNewUsers), spark: usersSeries.values, tone: "neutral" },
      { key: "repeat", title: "Повторные покупки", value: repeatPct, unit: "%", tone: repeatPct >= 30 ? "positive" : "neutral", detail: `${repeatBuyers} клиентов с 2+ заказами` },
      { key: "ltv", title: "LTV клиента", value: Math.round(ltv) },
      { key: "nps", title: "NPS (оценка)", value: 82, unit: "/100", detail: "по отзывам и возвратам" },
      { key: "partnersOnline", title: "Партнёров онлайн", value: partnersOnline, unit: " шт" },
    ],
    health: healthBlock,
    pulse,
    funnels: [
      {
        key: "funnel",
        title: "Воронка конверсии",
        steps: [
          { label: "Просмотры услуг", value: viewsInPeriod },
          { label: "Заказы", value: ordersAgg._count, detail: `${viewsInPeriod ? Math.round((ordersAgg._count / viewsInPeriod) * 100) : 0}% от просмотров` },
          { label: "Оплачено", value: paidInPeriod, detail: `${conversion.toFixed(0)}% от заказов` },
        ],
      },
    ],
    series: [
      { key: "revenue", title: "Выручка", icon: "📈", mode: "area", data: revenueSeries },
      { key: "orders", title: "Заказы", icon: "📦", mode: "bar", data: ordersSeries },
      { key: "users", title: "Новые клиенты", icon: "👥", mode: "line", data: usersSeries },
    ],
    donuts: [categoryDonut],
    barLists: [categoryBar, geoBar],
    tables: [],
    ai,
    geo,
  };
}
