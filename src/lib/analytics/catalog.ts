import { prisma } from "@/lib/prisma";
import { changePct, bucketize, SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/**
 * 2.16 Аналитика каталога услуг — сравнение категорий (2.16.4), география
 * спроса (2.16.5), сезонность (2.16.6), популярность услуг (2.16.7),
 * партнёры внутри категории (2.16.8), таблица категорий, AI (2.16.9).
 */
export async function getCatalogData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
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
  const viewWhere: Record<string, unknown> = { viewedAt: { gte: range.start, lte: range.end } };
  if (f.status) {
    bookingWhere.status = f.status;
    prevBookingWhere.status = f.status;
  }
  if (hasServiceFilter) {
    bookingWhere.service = serviceFilter;
    prevBookingWhere.service = serviceFilter;
    viewWhere.service = serviceFilter;
  }

  // Платёжные агрегаты уважают фильтр статуса (Гл. 2.7).
  const paidStatus: { in: ("PAID" | "COMPLETED")[] } | "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED" | "COMPLETED" =
    f.status ? (f.status as "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED" | "COMPLETED") : { in: PAID };

  // ── Каталог в целом ──
  const [totalServices, activeServices, paidRows, prevPaidRows, allBookingRows, viewsInPeriod] = await Promise.all([
    prisma.service.count(),
    prisma.service.count({ where: { isActive: true } }),
    prisma.booking.findMany({ where: { ...bookingWhere, status: paidStatus }, select: { id: true, amount: true, serviceId: true, serviceDate: true, createdAt: true } }),
    prisma.booking.findMany({ where: { ...prevBookingWhere, status: paidStatus }, select: { amount: true } }),
    prisma.booking.findMany({ where: bookingWhere, select: { status: true, serviceId: true, createdAt: true } }),
    prisma.serviceView.count({ where: viewWhere }),
  ]);
  const revenue = paidRows.reduce((a, r) => a + r.amount, 0);
  const revenuePrev = prevPaidRows.reduce((a, r) => a + r.amount, 0);
  const sold = paidRows.length;
  const soldPrev = prevPaidRows.length;
  const avgCheck = sold ? revenue / sold : 0;
  const bookingsAll = allBookingRows.length;
  const cancelled = allBookingRows.filter((b) => b.status === "REFUNDED").length;
  const cancelPct = bookingsAll ? (cancelled / bookingsAll) * 100 : 0;
  const conversion = viewsInPeriod ? (bookingsAll / viewsInPeriod) * 100 : 0;

  // ── По категориям: продажи, выручка, прибыль, отмены ──
  const serviceIds = [...new Set([...paidRows.map((r) => r.serviceId), ...allBookingRows.map((r) => r.serviceId)])];
  const serviceTypes = serviceIds.length
    ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, type: true, title: true, price: true, rating: true, reviewCount: true, country: true, city: true, provider: { select: { companyName: true, firstName: true, lastName: true } } } })
    : [];
  // Имя поставщика для анализа партнёров внутри категории (2.16.8)
  const providerNameById = new Map<string, string>();
  for (const s of serviceTypes) {
    providerNameById.set(
      s.id,
      s.provider ? s.provider.companyName || `${s.provider.firstName} ${s.provider.lastName ?? ""}`.trim() : "Без поставщика"
    );
  }
  const typeMap = new Map(serviceTypes.map((s) => [s.id, s.type]));
  const catMap = new Map<string, { count: number; revenue: number; cancelled: number }>();
  for (const r of allBookingRows) {
    const t = typeMap.get(r.serviceId) ?? "OTHER";
    const cur = catMap.get(t) ?? { count: 0, revenue: 0, cancelled: 0 };
    cur.count += 1;
    if (r.status === "REFUNDED") cur.cancelled += 1;
    catMap.set(t, cur);
  }
  for (const r of paidRows) {
    const t = typeMap.get(r.serviceId) ?? "OTHER";
    const cur = catMap.get(t) ?? { count: 0, revenue: 0, cancelled: 0 };
    cur.revenue += r.amount;
    catMap.set(t, cur);
  }

  const categories = [...catMap.entries()]
    .map(([type, v]) => ({
      type,
      label: SERVICE_TYPE_LABELS[type] ?? "Прочие",
      icon: SERVICE_TYPE_ICONS[type] ?? "🧩",
      count: v.count,
      revenue: Math.round(v.revenue),
      profit: Math.round(v.revenue * 0.12),
      avg: v.count ? Math.round(v.revenue / v.count) : 0,
      conversion: viewsInPeriod ? Math.round((v.count / viewsInPeriod) * 10000) / 100 : 0,
      cancel: v.count ? Math.round((v.cancelled / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Карточки категорий (2.16.3): рост относительно прошлого периода ──
  const prevCatRows = await prisma.booking.findMany({
    where: { ...prevBookingWhere, status: paidStatus },
    select: { serviceId: true, amount: true },
  });
  const prevCatMap = new Map<string, number>();
  const prevCatIds = [...new Set(prevCatRows.map((r) => r.serviceId))];
  const prevTypes = prevCatIds.length
    ? await prisma.service.findMany({ where: { id: { in: prevCatIds } }, select: { id: true, type: true } })
    : [];
  for (const r of prevCatRows) {
    const t = prevTypes.find((s) => s.id === r.serviceId)?.type ?? "OTHER";
    prevCatMap.set(t, (prevCatMap.get(t) ?? 0) + r.amount);
  }

  // ── ТОП услуг по продажам / просмотрам / рейтингу (2.16.7) ──
  const soldByService = new Map<string, number>();
  const revenueByService = new Map<string, number>();
  for (const r of paidRows) {
    soldByService.set(r.serviceId, (soldByService.get(r.serviceId) ?? 0) + 1);
    revenueByService.set(r.serviceId, (revenueByService.get(r.serviceId) ?? 0) + r.amount);
  }
  const viewRows = await prisma.serviceView.groupBy({ by: ["serviceId"], where: viewWhere, _count: true });
  const viewCount = new Map(viewRows.map((r) => [r.serviceId, r._count]));
  const topSold = [...soldByService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topViewed = [...viewCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const serviceById = new Map(serviceTypes.map((s) => [s.id, s]));

  const topSoldBar = {
    key: "topSold",
    title: "Самые продаваемые услуги",
    icon: "🔥",
    rows: topSold.map(([id, value]) => {
      const s = serviceById.get(id);
      return { label: s?.title ?? id.slice(0, 6), value, sub: `${s ? SERVICE_TYPE_LABELS[s.type] ?? s.type : "—"} · ${Math.round(revenueByService.get(id) ?? 0)} $` };
    }),
  };
  const topViewedBar = {
    key: "topViewed",
    title: "Самые просматриваемые",
    icon: "👀",
    rows: topViewed.map(([id, value]) => {
      const s = serviceById.get(id);
      return { label: s?.title ?? id.slice(0, 6), value, sub: s ? SERVICE_TYPE_LABELS[s.type] ?? s.type : "—" };
    }),
  };
  const topRated = serviceTypes.filter((s) => s.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 8);
  const topRatedBar = {
    key: "topRated",
    title: "Самые рейтинговые",
    icon: "⭐",
    rows: topRated.map((s) => ({ label: s.title, value: s.rating, sub: `${s.reviewCount} отзывов` })),
  };

  // ── География спроса (2.16.5) ──
  const geoByType = new Map<string, Map<string, number>>();
  for (const r of allBookingRows) {
    const t = typeMap.get(r.serviceId) ?? "OTHER";
    const svc = serviceById.get(r.serviceId);
    const country = svc?.country ?? "Не указано";
    if (!geoByType.has(country)) geoByType.set(country, new Map());
    geoByType.get(country)!.set(t, (geoByType.get(country)!.get(t) ?? 0) + 1);
  }
  const geoTopCountry = [...geoByType.entries()].sort(
    (a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0)
  )[0];
  const geoBar = {
    key: "geo",
    title: "Спрос по странам",
    icon: "🌍",
    rows: [...geoByType.entries()]
      .map(([label, m]) => ({ label, value: [...m.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  // ── Сезонность (2.16.6): бронирования по месяцам года ──
  const monthSeries = bucketize(allBookingRows.map((r) => ({ at: r.createdAt, amount: 1 })), "year", range);

  // ── Сравнение категорий (2.16.4) — таблица ──
  const catTable = {
    key: "catalogTable",
    title: "Сравнение категорий",
    icon: "📊",
    columns: [
      { key: "label", label: "Категория" },
      { key: "count", label: "Продажи", align: "right" },
      { key: "revenue", label: "Выручка", align: "right" },
      { key: "profit", label: "Прибыль", align: "right" },
      { key: "avg", label: "Средний чек", align: "right" },
      { key: "conversion", label: "Конверсия", align: "right" },
      { key: "cancel", label: "Отмены", align: "right" },
      { key: "trend", label: "Тренд", align: "right" },
    ],
    rows: categories.map((c) => ({
      label: `${c.icon} ${c.label}`,
      count: c.count,
      revenue: c.revenue,
      profit: c.profit,
      avg: c.avg,
      conversion: `${c.conversion}%`,
      cancel: `${c.cancel}%`,
      trend: `${changePct(c.revenue, prevCatMap.get(c.type) ?? 0) >= 0 ? "+" : ""}${changePct(c.revenue, prevCatMap.get(c.type) ?? 0).toFixed(0)}%`,
    })),
  };

  // ── Категория с наибольшим приростом ──
  const withTrend = categories
    .map((c) => ({ ...c, trend: changePct(c.revenue, prevCatMap.get(c.type) ?? 0) }))
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.trend - a.trend);

  // ── Матрица жизненного цикла услуги (2.16.11): Запуск → Рост → Зрелость → Спад ──
  // Стадия определяется по темпу роста выручки и текущему объёму продаж.
  const lifecycleRows = categories.map((c) => {
    const trend = changePct(c.revenue, prevCatMap.get(c.type) ?? 0);
    const stage =
      c.count <= 1 && c.revenue > 0
        ? { key: "launch", label: "Запуск", icon: "🚀", advice: "оценить первые продажи и реакцию клиентов" }
        : trend > 15
          ? { key: "growth", label: "Рост", icon: "📈", advice: "усилить продвижение и расширить ассортимент" }
          : trend >= -10 && trend <= 15
            ? { key: "maturity", label: "Зрелость", icon: "⚖️", advice: "удержание качества и оптимизация маржи" }
            : { key: "decline", label: "Спад", icon: "📉", advice: "обновить предложение, изменить цену или вывести из каталога" };
    return { ...c, trend, stage };
  });
  const lifecycleBar = {
    key: "lifecycle",
    title: "Матрица жизненного цикла услуг",
    icon: "🔄",
    rows: lifecycleRows.map((c) => ({
      label: `${c.icon} ${c.label} — ${c.stage.icon} ${c.stage.label}`,
      value: Math.round(Math.max(5, Math.abs(c.trend)) * 10),
      sub: `${c.revenue} $ · тренд ${c.trend >= 0 ? "+" : ""}${c.trend.toFixed(0)}% · ${c.stage.advice}`,
    })),
  };

  // ── Партнёры внутри категории (2.16.8): поставщики услуг оплаченных броней ──
  const providerMap = new Map<string, { revenue: number; count: number }>();
  for (const r of paidRows) {
    const pname = providerNameById.get(r.serviceId);
    if (!pname) continue;
    const cur = providerMap.get(pname) ?? { revenue: 0, count: 0 };
    cur.revenue += r.amount;
    cur.count += 1;
    providerMap.set(pname, cur);
  }
  const partnersInCatBar = {
    key: "partnersInCategory",
    title: "Лучшие партнёры каталога",
    icon: "🤝",
    rows: [...providerMap.entries()]
      .map(([name, v]) => ({ label: name, value: Math.round(v.revenue), sub: `${v.count} продаж` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  if (categories[0]) {
    const sharePct = revenue ? Math.round((categories[0].revenue / revenue) * 100) : 0;
    ai.push({ level: "info", title: `Лидер каталога: ${categories[0].label}`, detail: `${sharePct}% выручки периода` });
  }
  if (withTrend[0] && withTrend[0].trend > 10) {
    ai.push({ level: "positive", title: `Быстрый рост: ${withTrend[0].label}`, detail: `+${withTrend[0].trend.toFixed(0)}% к прошлому периоду` });
  }
  const falling = [...withTrend].filter((c) => c.trend < -10);
  if (falling[0]) {
    ai.push({ level: "high", title: `Спад: ${falling[0].label}`, detail: `${falling[0].trend.toFixed(0)}% — обновить предложение или цены` });
  }
  if (cancelPct > 0) {
    ai.push({ level: "medium", title: `Отмены по каталогу: ${cancelPct.toFixed(0)}%`, detail: "проверить поставщиков проблемных категорий" });
  }
  ai.push({ level: "info", title: `Конверсия просмотр → бронь: ${conversion.toFixed(1)}%`, detail: `${viewsInPeriod} просмотров, ${bookingsAll} броней` });
  if (geoTopCountry) {
    const types = [...geoTopCountry[1].entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, v]) => `${SERVICE_TYPE_LABELS[t] ?? t} ${v}`);
    ai.push({ level: "info", title: `Топ страна: ${geoTopCountry[0]}`, detail: types.join(" · ") });
  }

  return {
    section: "catalog",
    title: "Аналитика каталога услуг",
    subtitle: "Категории, спрос и популярность услуг (Гл. 2.16)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "services", title: "Услуг в каталоге", value: totalServices, unit: " шт", tone: "neutral" },
      { key: "active", title: "Активные услуги", value: activeServices, unit: " шт", tone: "positive" },
      { key: "sold", title: "Проданные услуги", value: sold, unit: " шт", change: changePct(sold, soldPrev), tone: "neutral" },
      { key: "revenue", title: "Общая выручка", value: revenue, change: changePct(revenue, revenuePrev), spark: monthSeries.values, tone: revenue >= revenuePrev ? "positive" : "negative" },
      { key: "profit", title: "Прибыль каталога", value: Math.round(revenue * 0.12), tone: "positive" },
      { key: "avgCheck", title: "Средний чек", value: Math.round(avgCheck), tone: "neutral" },
      { key: "conversion", title: "Конверсия просмотр → бронь", value: conversion, unit: "%", tone: conversion >= 5 ? "positive" : "negative" },
      { key: "cancel", title: "Процент отмен", value: cancelPct, unit: "%", tone: cancelPct <= 10 ? "positive" : "negative" },
    ],
    funnels: [
      {
        key: "catalogFunnel",
        title: "Воронка каталога",
        steps: [
          { label: "Просмотры услуг", value: viewsInPeriod },
          { label: "Бронирования", value: bookingsAll, detail: `${viewsInPeriod ? Math.round((bookingsAll / viewsInPeriod) * 100) : 0}% от просмотров` },
          { label: "Оплачено", value: sold, detail: `${bookingsAll ? Math.round((sold / bookingsAll) * 100) : 0}% от броней` },
        ],
      },
    ],
    series: [
      { key: "seasonality", title: "Сезонность (бронирования по месяцам)", icon: "📅", mode: "bar", data: monthSeries },
    ],
    donuts: [
      {
        key: "shareDonut",
        title: "Доля категорий в выручке",
        icon: "🍩",
        data: categories.slice(0, 8).map((c) => ({ label: c.label, value: c.revenue })),
      },
    ],
    barLists: [topSoldBar, topViewedBar, topRatedBar, geoBar, lifecycleBar, partnersInCatBar],
    tables: [catTable],
    ai,
  };
}
