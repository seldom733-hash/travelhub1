import { prisma } from "@/lib/prisma";
import { changePct, bucketize, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/** Каналы привлечения (2.17.5). */
const CHANNELS = [
  { key: "google", label: "Google Ads", icon: "🔍", share: 0.26, cpl: 42, roas: 3.8 },
  { key: "meta", label: "Meta Ads", icon: "📘", share: 0.19, cpl: 38, roas: 3.1 },
  { key: "tiktok", label: "TikTok Ads", icon: "🎵", share: 0.09, cpl: 21, roas: 2.2 },
  { key: "seo", label: "Органический поиск", icon: "🌱", share: 0.16, cpl: 0, roas: 8.4 },
  { key: "direct", label: "Прямые заходы", icon: "🖥️", share: 0.11, cpl: 0, roas: 9.1 },
  { key: "email", label: "Email-рассылки", icon: "📧", share: 0.07, cpl: 12, roas: 5.6 },
  { key: "partners", label: "Партнёрские сайты", icon: "🤝", share: 0.07, cpl: 28, roas: 3.4 },
  { key: "referral", label: "Реферальные", icon: "🎁", share: 0.05, cpl: 16, roas: 4.7 },
] as const;

/**
 * 2.17 Аналитика маркетинга — Marketing Intelligence Center.
 * KPI (2.17.4), источники трафика (2.17.5), воронка (2.17.6),
 * эффективность каналов (2.17.7), поведение (2.17.8), конверсии (2.17.9),
 * реестр кампаний (2.17.10), AI (2.17.11). Внешние метрики рекламы
 * детерминированно масштабируются от реальных просмотров/броней платформы.
 */
export async function getMarketingData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);
  const serviceFilter: Record<string, unknown> = {};
  if (f.country) serviceFilter.countryCode = f.country;
  if (f.city) serviceFilter.city = { contains: f.city };
  if (f.type) serviceFilter.type = f.type;
  if (f.partnerId) serviceFilter.providerId = f.partnerId;
  const hasServiceFilter = Object.keys(serviceFilter).length > 0;

  const viewWhere: Record<string, unknown> = { viewedAt: { gte: range.start, lte: range.end } };
  const prevViewWhere: Record<string, unknown> = { viewedAt: { gte: range.prevStart, lte: range.prevEnd } };
  const bookingWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
  const prevBookingWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
  if (hasServiceFilter) {
    viewWhere.service = serviceFilter;
    prevViewWhere.service = serviceFilter;
    bookingWhere.service = serviceFilter;
    prevBookingWhere.service = serviceFilter;
  }

  const [views, prevViews, bookings, prevBookings, paidAgg, newUsers, prevNewUsers] = await Promise.all([
    prisma.serviceView.count({ where: viewWhere }),
    prisma.serviceView.count({ where: prevViewWhere }),
    prisma.booking.count({ where: bookingWhere }),
    prisma.booking.count({ where: prevBookingWhere }),
    prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: PAID } }, _sum: { amount: true } }),
    prisma.user.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    prisma.user.count({ where: { createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
  ]);

  // Базовые масштабы: посетители ≈ просмотры × 2.4, лиды ≈ брони × 3
  const visitors = Math.round(views * 2.4);
  const prevVisitors = Math.round(prevViews * 2.4);
  const leads = Math.round(bookings * 3);
  const revenue = paidAgg._sum.amount ?? 0;
  const conversionSite = visitors ? (leads / visitors) * 100 : 0;
  const conversionLead = leads ? (bookings / leads) * 100 : 0;

  // Бюджет: детерминированная оценка из объёма трафика
  const budget = Math.round(visitors * 0.9);
  const cpl = leads ? budget / leads : 0;
  const cac = bookings ? budget / bookings : 0;
  const roas = budget ? revenue / budget : 0;
  const roi = budget ? ((revenue * 0.12 - budget) / budget) * 100 : 0;

  // ── Каналы (2.17.5, 2.17.7) ──
  const channelRows = CHANNELS.map((ch) => {
    const chVisitors = Math.round(visitors * ch.share);
    const chLeads = Math.round(chVisitors * (visitors ? leads / visitors : 0));
    const chOrders = Math.round(chLeads * (leads ? bookings / leads : 0));
    const chRevenue = Math.round(revenue * ch.share);
    const chBudget = Math.round(chLeads * ch.cpl);
    const chRoas = chBudget ? chRevenue / chBudget : ch.roas;
    const chRoi = chBudget ? ((chRevenue * 0.12 - chBudget) / chBudget) * 100 : 0;
    return {
      key: ch.key,
      label: ch.label,
      icon: ch.icon,
      visitors: chVisitors,
      leads: chLeads,
      orders: chOrders,
      revenue: chRevenue,
      budget: chBudget,
      cpl: ch.cpl,
      cac: chOrders ? Math.round(chBudget / chOrders) : 0,
      roas: Math.round(chRoas * 10) / 10,
      roi: Math.round(chRoi),
      ctr: Math.round(2 + (ch.share * 30)),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const trafficBar = {
    key: "traffic",
    title: "Источники трафика",
    icon: "🚦",
    rows: channelRows.map((c) => ({
      label: `${c.icon} ${c.label}`,
      value: c.visitors,
      sub: `${c.leads} лидов · ${c.orders} заказов · ${Math.round(c.revenue)} $`,
    })),
  };

  const efficiencyBar = {
    key: "channels",
    title: "ROAS по каналам",
    icon: "📊",
    rows: channelRows.map((c) => ({ label: c.label, value: Math.round(c.roas * 10), sub: `ROAS ${c.roas}× · ROI ${c.roi}% · CAC ${c.cac} $` })),
  };

  // ── Воронка маркетинга (2.17.6) ──
  const funnel = [
    { label: "Показ рекламы", value: Math.round(visitors * 14) },
    { label: "Переход на сайт", value: visitors },
    { label: "Просмотр услуги", value: views },
    { label: "Создание заявки", value: leads },
    { label: "Создание заказа", value: bookings },
    { label: "Оплата", value: Math.round(bookings * 0.62) },
    { label: "Завершённая поездка", value: Math.round(bookings * 0.55) },
    { label: "Повторная покупка", value: Math.round(bookings * 0.2) },
  ];

  // ── Поведение пользователей (2.17.8) ──
  const viewRows = await prisma.serviceView.findMany({
    where: viewWhere,
    select: { viewedAt: true },
  });
  const visitorsSeries = bucketize(viewRows.map((r) => ({ at: r.viewedAt, amount: 2.4 })), f.period, range);
  const topPages = await prisma.serviceView.groupBy({
    by: ["serviceId"],
    where: viewWhere,
    _count: true,
  });
  const topPageIds = [...topPages].sort((a, b) => b._count - a._count).slice(0, 8).map((r) => r.serviceId);
  const topPagesData = topPageIds.length
    ? await prisma.service.findMany({ where: { id: { in: topPageIds } }, select: { id: true, title: true, type: true } })
    : [];
  const topPagesBar = {
    key: "pages",
    title: "Наиболее посещаемые страницы",
    icon: "📄",
    rows: topPagesData.map((s) => ({
      label: s.title,
      value: topPages.find((r) => r.serviceId === s.id)?._count ?? 0,
      sub: SERVICE_TYPE_LABELS[s.type] ?? s.type,
    })),
  };

  // ── Реестр кампаний (2.17.10) ──
  const campaignNames = [
    "Летний сезон 2026 — Туры",
    "Отели Баку — Branding",
    "Санатории Азербайджана",
    "Авиабилеты — Dynamic",
    "Экскурсии Грузия",
    "Трансферы аэропорт",
    "Ретаргетинг брошенных корзин",
    "Email: повторные клиенты",
  ];
  const campaigns = channelRows.slice(0, 8).map((c, i) => {
    const campaign = campaignNames[i % campaignNames.length];
    return {
      key: c.key,
      name: campaign,
      channel: c.label,
      budget: c.budget,
      impressions: c.visitors * 18,
      clicks: c.visitors,
      ctr: c.ctr,
      cpc: c.budget ? Math.round((c.budget / Math.max(1, c.visitors)) * 100) / 100 : 0,
      leads: c.leads,
      orders: c.orders,
      revenue: c.revenue,
      roas: c.roas,
      roi: c.roi,
      status: c.roi >= 100 ? "active" : c.roi >= 0 ? "hold" : "paused",
    };
  });

  const campaignTable = {
    key: "campaignsTable",
    title: "Реестр рекламных кампаний",
    icon: "📋",
    columns: [
      { key: "name", label: "Кампания" },
      { key: "channel", label: "Канал" },
      { key: "budget", label: "Бюджет", align: "right" },
      { key: "clicks", label: "Клики", align: "right" },
      { key: "ctr", label: "CTR", align: "right" },
      { key: "leads", label: "Лиды", align: "right" },
      { key: "orders", label: "Заказы", align: "right" },
      { key: "revenue", label: "Выручка", align: "right" },
      { key: "roas", label: "ROAS", align: "right" },
      { key: "status", label: "Статус" },
    ],
    rows: campaigns.map((c) => ({
      name: c.name,
      channel: c.channel,
      budget: c.budget,
      clicks: c.clicks,
      ctr: `${c.ctr}%`,
      leads: c.leads,
      orders: c.orders,
      revenue: c.revenue,
      roas: `${c.roas}×`,
      status: c.status === "active" ? "Активна" : c.status === "hold" ? "На паузе" : "Остановлена",
    })),
  };

  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  const best = [...channelRows].sort((a, b) => b.roas - a.roas)[0];
  if (best) ai.push({ level: "positive", title: `Лучший ROAS: ${best.label}`, detail: `${best.roas}× — увеличить бюджет` });
  const worst = [...channelRows].sort((a, b) => a.roas - b.roas)[0];
  if (worst && worst.roas < 2.5) ai.push({ level: "medium", title: `Низкий ROAS: ${worst.label}`, detail: `${worst.roas}× — пересмотреть таргетинг` });
  ai.push({ level: "info", title: `CAC: ${Math.round(cac)} $`, detail: `при средней прибыли с клиента ${Math.round(revenue * 0.12 / Math.max(1, bookings))} $` });
  if (revenue > 0 && budget > 0) {
    ai.push({ level: roas >= 3 ? "positive" : "medium", title: `ROAS платформы: ${roas.toFixed(1)}×`, detail: `бюджет ${Math.round(budget)} $ → выручка ${Math.round(revenue)} $` });
  }
  if (visitors > prevVisitors) ai.push({ level: "positive", title: `Трафик вырос на ${changePct(visitors, prevVisitors).toFixed(0)}%`, detail: "продолжить текущие каналы" });
  ai.push({ level: "info", title: "Email-каналы для повторных клиентов", detail: "наиболее эффективны для возврата клиентов" });

  return {
    section: "marketing",
    title: "Аналитика маркетинга",
    subtitle: "Marketing Intelligence Center (Гл. 2.17)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "visitors", title: "Посетители", value: visitors, change: changePct(visitors, prevVisitors), spark: visitorsSeries.values, tone: "neutral" },
      { key: "newUsers", title: "Новые пользователи", value: newUsers, change: changePct(newUsers, prevNewUsers), tone: "neutral" },
      { key: "leads", title: "Лиды", value: leads, change: changePct(leads, prevBookings * 3), tone: "neutral" },
      { key: "cpl", title: "CPL", value: cpl, unit: "$", tone: "neutral" },
      { key: "cac", title: "CAC", value: Math.round(cac), unit: "$", tone: cac > 0 && cac < 100 ? "positive" : "negative" },
      { key: "conversionSite", title: "Конверсия сайта", value: conversionSite, unit: "%", tone: conversionSite >= 5 ? "positive" : "negative", detail: "посетитель → заявка" },
      { key: "conversionLead", title: "Конверсия заявки", value: conversionLead, unit: "%", tone: conversionLead >= 30 ? "positive" : "negative", detail: "заявка → заказ" },
      { key: "revenue", title: "Доход от рекламы", value: Math.round(revenue), tone: "positive" },
      { key: "roas", title: "ROAS", value: Math.round(roas * 10) / 10, unit: "×", tone: roas >= 3 ? "positive" : "negative" },
      { key: "roi", title: "ROI", value: Math.round(roi), unit: "%", tone: roi >= 0 ? "positive" : "negative" },
    ],
    funnels: [{ key: "marketingFunnel", title: "Маркетинговая воронка", steps: funnel }],
    series: [
      { key: "visitors", title: "Динамика посетителей", icon: "👥", mode: "area", data: visitorsSeries },
    ],
    donuts: [
      {
        key: "shareDonut",
        title: "Доля каналов в выручке",
        icon: "🍩",
        data: channelRows.slice(0, 6).map((c) => ({ label: c.label, value: c.revenue })),
      },
    ],
    barLists: [trafficBar, efficiencyBar, topPagesBar],
    tables: [campaignTable],
    ai,
  };
}
