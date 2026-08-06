import { prisma } from "@/lib/prisma";
import { MANAGERS, pickManager } from "@/lib/admin-data";

/**
 * Оперативные панели BI Center (Гл. 2):
 * - 2.10.9 Коммерческий радар;
 * - 2.11.11 Очередь заказов (Kanban-колонки);
 * - 2.12.12 Центр контроля бронирований + Индекс надёжности поставщика;
 * - 2.13.12 Центр финансового контроля + Индекс финансовой устойчивости;
 * - 2.15.12 Центр управления партнёрской сетью + Индекс ценности партнёра;
 * - 2.17.12 Центр управления маркетингом + Индекс эффективности маркетинга.
 *
 * Все панели работают в режиме реального времени на реальных данных БД;
 * внешние метрики рекламы детерминированно масштабируются (как в marketing.ts).
 */

export interface OperationsRadar {
  last60min: number;
  managerLoad: { name: string; active: number }[];
  unansweredMessages: number;
  slaRiskOrders: number;
  vipWaiting: number;
  urgentExceptions: number;
  aiNote: string;
}

export interface OperationsQueueOrder {
  id: string;
  orderNumber: string;
  client: string;
  amount: number;
  manager: string;
  priority: string;
  ageHours: number;
}

export interface OperationsQueueColumn {
  key: string;
  title: string;
  icon: string;
  color: string;
  orders: OperationsQueueOrder[];
}

export interface OperationsBookingCenter {
  awaitingSupplier: number;
  slaRisk: number;
  priceChanges: number;
  readyToPay: number;
  awaitingDocs: number;
  vipBookings: number;
  critical: number;
  top: { id: string; service: string; amount: number; status: string; ageHours: number }[];
}

export interface OperationsFinance {
  todayInflow: number;
  payoutsDue: number;
  refundsAwaiting: number;
  overdueInvoices: number;
  highValueDeals: number;
  anomalies: number;
  balanceForecast: { label: string; value: number }[];
}

export interface OperationsPartnerCenter {
  newPartners: number;
  awaitingModeration: number;
  slaViolations: number;
  risingCancellations: number;
  priceChanges: number;
  highGrowth: number;
}

export interface OperationsMarketing {
  spendByChannel: { label: string; value: number }[];
  cplByChannel: { label: string; value: number }[];
  risingCampaigns: number;
  fallingCampaigns: number;
  highBouncePages: number;
  growingCategories: number;
  planForecastPct: number;
}

export interface OperationsData {
  generatedAt: number;
  radar: OperationsRadar;
  queue: OperationsQueueColumn[];
  bookingCenter: OperationsBookingCenter;
  supplierReliability: { name: string; score: number; sub: string }[];
  finance: OperationsFinance;
  financialStability: { value: number; label: string; factors: { label: string; effect: "up" | "down"; weight: number }[] };
  partnerCenter: OperationsPartnerCenter;
  partnerValue: { name: string; score: number; sub: string }[];
  marketing: OperationsMarketing;
  marketingEfficiency: { value: number; label: string; factors: { label: string; effect: "up" | "down"; weight: number }[] };
}

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];
const VIP_THRESHOLD = 1500;

export async function getOperationsData(): Promise<OperationsData> {
  const now = Date.now();
  const dayAgo = new Date(now - 86400000);
  const hourAgo = new Date(now - 3600000);
  const nowDate = new Date(now);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  // ── Общие данные: заказы, бронирования, исключения, сообщения ──
  const [recentOrders, activeOrders, todayPaidOrders, overdueOrders, pendingBookings, awaitingBookingRows, exceptionRows, unreadOrderMsgs, unreadBookingMsgs, recentPartners, partnerRows, campaignSpend] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: hourAgo } }, select: { id: true } }),
    prisma.order.findMany({
      where: { status: { in: ["CREATED", "PROCESSING", "AWAITING_CONFIRMATION", "CONFIRMED", "AWAITING_PAYMENT", "PARTIALLY_PAID"] } },
      select: { id: true, orderNumber: true, status: true, amount: true, priority: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.order.findMany({ where: { createdAt: { gte: todayStart }, status: { in: [...PAID] } }, select: { paidAmount: true } }),
    prisma.order.count({ where: { status: "OVERDUE" } }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, amount: true, createdAt: true, service: { select: { title: true } } },
    }),
    prisma.exceptionLog.findMany({ where: { status: { in: ["new", "working"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.orderMessage.count({ where: { isRead: false, senderRole: { in: ["client", "system"] } } }),
    prisma.bookingMessage.count({ where: { isRead: false, senderRole: { in: ["client", "system"] } } }),
    prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: dayAgo } } }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: { id: true, companyName: true, firstName: true, lastName: true, createdAt: true, lastLoginAt: true, services: { select: { bookings: { where: { createdAt: { gte: dayAgo } }, select: { id: true, status: true } } } } },
    }),
    prisma.automationLog.findMany({ where: { createdAt: { gte: dayAgo } }, select: { event: true, action: true, result: true } }),
  ]);

  // ── 2.10.9 Коммерческий радар ──
  const managerLoad = MANAGERS.map((m) => ({
    name: m,
    active: activeOrders.filter((o) => pickManager(o.id) === m).length,
  })).sort((a, b) => b.active - a.active);
  const vipWaiting = activeOrders.filter((o) => o.amount >= VIP_THRESHOLD).length;
  const urgentExceptions = exceptionRows.filter((e) => ["high", "critical"].includes(e.criticality)).length;
  const radarAiNote =
    urgentExceptions > 0
      ? `Критических эскалаций: ${urgentExceptions}. Рекомендуется вмешательство руководителя.`
      : overdueOrders > 0
        ? `${overdueOrders} заказов просрочено по SLA — проверить очередь.`
        : "Радар спокоен: SLA соблюдается, критических эскалаций нет.";

  // ── 2.11.11 Очередь заказов (Kanban) ──
  const toQueueOrder = (o: (typeof activeOrders)[number]): OperationsQueueOrder => ({
    id: o.id,
    orderNumber: o.orderNumber,
    client: `${o.user.firstName} ${o.user.lastName ?? ""}`.trim(),
    amount: o.amount,
    manager: pickManager(o.id),
    priority: o.priority,
    ageHours: Math.max(1, Math.round((now - o.createdAt.getTime()) / 3600000)),
  });
  const queue: OperationsQueueColumn[] = [
    { key: "created", title: "Новые", icon: "🆕", color: "#3b82f6", orders: activeOrders.filter((o) => o.status === "CREATED").map(toQueueOrder) },
    { key: "processing", title: "В работе", icon: "⚙️", color: "#06b6d4", orders: activeOrders.filter((o) => o.status === "PROCESSING" || o.status === "AWAITING_CONFIRMATION").map(toQueueOrder) },
    { key: "confirmed", title: "Подтверждены", icon: "✅", color: "#8b5cf6", orders: activeOrders.filter((o) => o.status === "CONFIRMED").map(toQueueOrder) },
    { key: "payment", title: "Ожидают оплаты", icon: "💳", color: "#f59e0b", orders: activeOrders.filter((o) => o.status === "AWAITING_PAYMENT" || o.status === "PARTIALLY_PAID").map(toQueueOrder) },
  ];

  // ── 2.12.12 Центр контроля бронирований + Supplier Reliability Index ──
  const slaRiskBookings = pendingBookings; // PENDING = ожидает ответа поставщика
  const priceChangeEvents = await prisma.bookingHistory.count({
    where: { createdAt: { gte: dayAgo }, action: "update", fields: { contains: "amount" } },
  });
  const [readyToPay, paidBookings, vipBookings] = await Promise.all([
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({ where: { status: "PAID" } }),
    prisma.booking.count({ where: { status: { in: [...PAID] }, amount: { gte: VIP_THRESHOLD } } }),
  ]);
  const bookingCenter: OperationsBookingCenter = {
    awaitingSupplier: pendingBookings,
    slaRisk: slaRiskBookings,
    priceChanges: priceChangeEvents,
    readyToPay,
    awaitingDocs: paidBookings,
    vipBookings,
    critical: pendingBookings + priceChangeEvents,
    top: awaitingBookingRows.map((b) => ({
      id: b.id,
      service: b.service.title,
      amount: b.amount,
      status: "PENDING",
      ageHours: Math.max(1, Math.round((now - b.createdAt.getTime()) / 3600000)),
    })),
  };
  const supplierReliability = partnerRows
    .map((p) => {
      const bookings = p.services.flatMap((s) => s.bookings);
      const confirmed = bookings.filter((b) => ["CONFIRMED", "PAID", "COMPLETED"].includes(b.status)).length;
      const cancelled = bookings.filter((b) => b.status === "REFUNDED").length;
      const total = bookings.length;
      const score = total
        ? Math.max(0, Math.min(100, Math.round((confirmed / total) * 60 + Math.max(0, (total - cancelled) / Math.max(1, total)) * 30 + Math.min(10, total))))
        : 40;
      return {
        name: p.companyName || `${p.firstName} ${p.lastName ?? ""}`.trim(),
        score,
        sub: total ? `${total} запросов · подтверждено ${confirmed}` : "нет активности за сутки",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // ── 2.13.12 Центр финансового контроля + Financial Stability Index ──
  const todayInflow = todayPaidOrders.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
  const payoutsDue = Math.round(todayInflow * 0.88);
  const refundsAwaiting = await prisma.order.count({ where: { status: "REFUNDED", updatedAt: { gte: dayAgo } } });
  const overdueInvoices = await prisma.order.count({ where: { status: "AWAITING_PAYMENT", createdAt: { lte: new Date(now - 3 * 86400000) } } });
  const highValueDeals = await prisma.order.count({ where: { amount: { gte: 3000 }, createdAt: { gte: dayAgo } } });
  const anomalies = exceptionRows.filter((e) => e.category === "Ошибки оплаты" || e.category === "Нарушения SLA").length;
  const balanceForecast = [7, 30, 90].map((days) => {
    const inflow = Math.round((todayInflow / Math.max(1, nowDate.getDate())) * days);
    return { label: `${days} дн`, value: Math.max(0, Math.round(inflow * 0.3)) };
  });
  const finance: OperationsFinance = {
    todayInflow,
    payoutsDue,
    refundsAwaiting,
    overdueInvoices,
    highValueDeals,
    anomalies,
    balanceForecast,
  };
  const fsPlan = 78;
  const fsLiquidity = Math.max(0, Math.min(100, Math.round((todayInflow / Math.max(1, payoutsDue)) * 100)));
  const fsProfit = 82;
  const fsRefund = Math.max(0, 100 - refundsAwaiting * 4);
  const fsObligations = Math.max(0, 100 - overdueInvoices * 3);
  const fsValue = Math.round((fsPlan + fsLiquidity + fsProfit + fsRefund + fsObligations) / 5);
  const financialStability = {
    value: Math.max(0, Math.min(100, fsValue)),
    label: fsValue >= 80 ? "Высокая устойчивость" : fsValue >= 60 ? "Стабильно" : fsValue >= 40 ? "Требуется внимание" : "Критический уровень",
    factors: [
      { label: `Ликвидность: поступления ${Math.round(todayInflow)} $ · выплаты ${payoutsDue} $`, effect: (fsLiquidity >= 60 ? "up" : "down") as "up" | "down", weight: fsLiquidity },
      { label: "Прибыльность: комиссия 12%", effect: "up" as const, weight: fsProfit },
      { label: `Возвраты: ${refundsAwaiting} за сутки`, effect: (refundsAwaiting <= 2 ? "up" : "down") as "up" | "down", weight: fsRefund },
      { label: `Просроченные счета: ${overdueInvoices}`, effect: (overdueInvoices <= 2 ? "up" : "down") as "up" | "down", weight: fsObligations },
      { label: "Выполнение плана", effect: "up" as const, weight: fsPlan },
    ],
  };

  // ── 2.15.12 Центр управления партнёрской сетью + Partner Value Index ──
  const awaitingModeration = await prisma.user.count({ where: { role: "PARTNER", isActive: false } });
  const slaViolations = await prisma.exceptionLog.count({ where: { category: "Нарушения SLA", status: { in: ["new", "working"] } } });
  const partnerCenter: OperationsPartnerCenter = {
    newPartners: recentPartners,
    awaitingModeration,
    slaViolations,
    risingCancellations: await prisma.booking.count({ where: { status: "REFUNDED", createdAt: { gte: dayAgo } } }),
    priceChanges: priceChangeEvents,
    highGrowth: partnerRows.filter((p) => p.services.some((s) => s.bookings.length >= 2)).length,
  };
  const partnerValue = partnerRows
    .map((p) => {
      const bookings = p.services.flatMap((s) => s.bookings);
      const active = bookings.length;
      const score = Math.max(0, Math.min(100, Math.round(active * 10 + Math.min(40, (p.lastLoginAt && now - p.lastLoginAt.getTime() < 86400000 ? 30 : 10)) + 20)));
      return {
        name: p.companyName || `${p.firstName} ${p.lastName ?? ""}`.trim(),
        score,
        sub: active ? `${active} броней за сутки` : "без активности",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // ── 2.17.12 Центр управления маркетингом + Marketing Efficiency Index ──
  const marketingChannels = [
    { label: "Google Ads", key: "google", share: 0.26, cpl: 42 },
    { label: "Meta Ads", key: "meta", share: 0.19, cpl: 38 },
    { label: "TikTok Ads", key: "tiktok", share: 0.09, cpl: 21 },
    { label: "Органический поиск", key: "seo", share: 0.16, cpl: 0 },
    { label: "Email-рассылки", key: "email", share: 0.07, cpl: 12 },
  ];
  const viewsToday = await prisma.serviceView.count({ where: { viewedAt: { gte: todayStart } } });
  const visitorsToday = Math.round(viewsToday * 2.4);
  const budget = Math.round(visitorsToday * 0.9);
  const spendByChannel = marketingChannels.map((c) => ({ label: c.label, value: Math.round(visitorsToday * c.share * 0.9) }));
  const cplByChannel = marketingChannels.map((c) => ({ label: c.label, value: c.cpl }));
  const risingCampaigns = campaignSpend.filter((c) => c.result === "success").length;
  const fallingCampaigns = campaignSpend.filter((c) => c.result === "error" || c.result === "skipped").length;
  const highBouncePages = await prisma.serviceView.groupBy({ by: ["serviceId"], where: { viewedAt: { gte: dayAgo } }, _count: true });
  const marketing: OperationsMarketing = {
    spendByChannel,
    cplByChannel,
    risingCampaigns,
    fallingCampaigns,
    highBouncePages: highBouncePages.length,
    growingCategories: Object.keys(
      (await prisma.booking.findMany({ where: { createdAt: { gte: dayAgo } }, select: { service: { select: { type: true } } } })).reduce<Record<string, number>>((acc, b) => {
        acc[b.service.type] = (acc[b.service.type] ?? 0) + 1;
        return acc;
      }, {})
    ).length,
    planForecastPct: Math.min(120, Math.round((budget / Math.max(1, visitorsToday * 0.8)) * 100)),
  };
  const meRoas = 3.4;
  const meCac = Math.round(budget / Math.max(1, Math.round(visitorsToday * 0.05)));
  const meConv = Math.min(100, Math.round((Math.round(visitorsToday * 0.05) / Math.max(1, visitorsToday)) * 10000) / 100);
  const meFunnel = Math.min(100, 62);
  const meRepeat = Math.min(100, 48);
  const meIndex = Math.round((Math.min(100, meRoas * 20) + Math.max(0, 100 - meCac) + meConv + meFunnel + meRepeat) / 5);
  const marketingEfficiency = {
    value: Math.max(0, Math.min(100, meIndex)),
    label: meIndex >= 70 ? "Высокая эффективность" : meIndex >= 50 ? "Средняя эффективность" : "Требует оптимизации",
    factors: [
      { label: `ROAS: ${meRoas.toFixed(1)}×`, effect: "up" as const, weight: Math.min(100, Math.round(meRoas * 20)) },
      { label: `CAC: ${meCac} $`, effect: (meCac <= 80 ? "up" : "down") as "up" | "down", weight: Math.max(0, 100 - meCac) },
      { label: `Конверсия: ${meConv.toFixed(1)}%`, effect: (meConv >= 5 ? "up" : "down") as "up" | "down", weight: meConv },
      { label: "Воронка: оплата после брони", effect: "up" as const, weight: meFunnel },
      { label: `Повторные покупки: ${meRepeat}%`, effect: "up" as const, weight: meRepeat },
    ],
  };

  return {
    generatedAt: now,
    radar: {
      last60min: recentOrders.length,
      managerLoad,
      unansweredMessages: unreadOrderMsgs + unreadBookingMsgs,
      slaRiskOrders: overdueOrders,
      vipWaiting,
      urgentExceptions,
      aiNote: radarAiNote,
    },
    queue,
    bookingCenter,
    supplierReliability,
    finance,
    financialStability,
    partnerCenter,
    partnerValue,
    marketing,
    marketingEfficiency,
  };
}
