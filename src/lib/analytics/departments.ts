import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_GROUPS, changePct, bucketize } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID_ORDER = [...ORDER_STATUS_GROUPS.paid] as const;
const PAID_BOOKING = ["PAID", "COMPLETED"] as const;
const CONFIRMED_BOOKING = ["CONFIRMED", "PAID", "COMPLETED"] as const;

const DEPT_LABEL: Record<string, string> = {
  sales: "Коммерческий отдел",
  bookings: "Отдел бронирования",
  finance: "Финансовый отдел",
  marketing: "Маркетинг",
  support: "Поддержка",
  moderation: "Модерация контента",
};

/**
 * 2.3 «Подразделения» — аналитика эффективности подразделений платформы.
 * Отделы выводятся из функциональных доменов данных (заказы, брони, финансы,
 * маркетинг, поддержка, модерация). Для каждого отдела рассчитываются реальные
 * метрики: загрузка, конверсия, SLA и интегральная оценка 0–100.
 */
export async function getDepartmentsData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
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
  const bookingWhere: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } };
  const prevBookingWhere: Record<string, unknown> = { createdAt: { gte: range.prevStart, lte: range.prevEnd } };
  if (hasServiceFilter) {
    orderWhere.bookings = { some: { service: serviceFilter } };
    prevOrderWhere.bookings = { some: { service: serviceFilter } };
    bookingWhere.service = serviceFilter;
    prevBookingWhere.service = serviceFilter;
  }
  const viewWhere = {
    viewedAt: { gte: range.start, lte: range.end },
    ...(hasServiceFilter ? { service: serviceFilter } : {}),
  };

  const [orders, prevOrders, bookings, prevBookings, views, msgRows, unreadRows, prevPaidAgg, newServices, newPartners] =
    await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        select: { id: true, status: true, amount: true, paidAmount: true, createdAt: true, updatedAt: true },
      }),
      prisma.order.count({ where: prevOrderWhere }),
      prisma.booking.findMany({ where: bookingWhere, select: { id: true, status: true, amount: true, createdAt: true } }),
      prisma.booking.count({ where: prevBookingWhere }),
      prisma.serviceView.count({ where: viewWhere }),
      prisma.orderMessage.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
      prisma.orderMessage.count({ where: { createdAt: { gte: range.start, lte: range.end }, isRead: false } }),
      prisma.order.aggregate({
        where: { ...prevOrderWhere, status: { in: [...PAID_ORDER] } },
        _sum: { paidAmount: true },
      }),
      prisma.service.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
      prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: range.start, lte: range.end } } }),
    ]);

  // ── Поддержка: сообщения по броням и заказам ──
  const [bkMsgs, bkUnread] = await Promise.all([
    prisma.bookingMessage.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    prisma.bookingMessage.count({ where: { createdAt: { gte: range.start, lte: range.end }, isRead: false } }),
  ]);
  const messages = msgRows + bkMsgs;
  const unread = unreadRows + bkUnread;

  // ── Коммерческий отдел (2.10) ──
  const ordersCount = orders.length;
  const paidOrders = orders.filter((o) => (PAID_ORDER as readonly string[]).includes(o.status));
  const paidRevenue = paidOrders.reduce((a, o) => a + (o.paidAmount ?? 0), 0);
  const salesConv = ordersCount ? (paidOrders.length / ordersCount) * 100 : 0;

  // ── Отдел бронирования (2.12) ──
  const bookingsCount = bookings.length;
  const confirmedCount = bookings.filter((b) => (CONFIRMED_BOOKING as readonly string[]).includes(b.status)).length;
  const confirmedShare = bookingsCount ? (confirmedCount / bookingsCount) * 100 : 0;
  const refundCount = bookings.filter((b) => b.status === "REFUNDED").length;
  const refundRate = bookingsCount ? (refundCount / bookingsCount) * 100 : 0;
  const paidBookings = bookings.filter((b) => (PAID_BOOKING as readonly string[]).includes(b.status));

  // ── SLA: доля заказов, обработанных быстрее 48 часов ──
  const withDelta = orders.filter((o) => o.updatedAt && o.createdAt);
  const slaShare = withDelta.length
    ? (withDelta.filter((o) => o.updatedAt.getTime() - o.createdAt.getTime() < 48 * 3600000).length / withDelta.length) * 100
    : 0;
  const avgHours = withDelta.length
    ? withDelta.reduce((a, o) => a + (o.updatedAt.getTime() - o.createdAt.getTime()) / 3600000, 0) / withDelta.length
    : 0;

  // ── Маркетинг (2.17): просмотры → брони ──
  const viewsToBooking = views ? (bookingsCount / views) * 100 : 0;

  // ── Интегральные оценки отделов (0–100) ──
  const score = (raw: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(raw)));
  const deptScores: Record<string, number> = {
    sales: score(salesConv),
    bookings: score(confirmedShare),
    finance: score(100 - refundRate * 6),
    marketing: score(viewsToBooking * 30),
    support: score(messages ? 100 - (unread / messages) * 100 * 2 : 100),
    moderation: score(100 - Math.min(20, refundRate * 2)),
  };
  const deptLoad: Record<string, number> = {
    sales: ordersCount,
    bookings: bookingsCount,
    finance: paidBookings.length,
    marketing: views,
    support: messages,
    moderation: newServices + newPartners,
  };

  const ranked = (Object.keys(DEPT_LABEL) as (keyof typeof DEPT_LABEL)[])
    .map((key) => ({ key, label: DEPT_LABEL[key], score: deptScores[key], load: deptLoad[key] }))
    .sort((a, b) => b.score - a.score);

  // ── Динамика по отделам ──
  const ordersSeries = bucketize(orders.map((o) => ({ at: o.createdAt, amount: 1 })), f.period, range);
  const bookingsSeries = bucketize(bookings.map((b) => ({ at: b.createdAt, amount: 1 })), f.period, range);
  const viewsRows = await prisma.serviceView.findMany({
    where: viewWhere,
    select: { viewedAt: true },
  });
  const viewsSeries = bucketize(viewsRows.map((v) => ({ at: v.viewedAt, amount: 1 })), f.period, range);

  // ── Сотрудники (внутренний штат) ──
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "DIRECTOR", "FINANCE", "MARKETER", "ANALYST", "MODERATOR", "SALES_MANAGER", "OPERATOR"] } },
    select: { firstName: true, lastName: true, role: true, isActive: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  const ROLE_DEPT: Record<string, string> = {
    ADMIN: "Руководство",
    DIRECTOR: "Руководство",
    FINANCE: "Финансовый отдел",
    MARKETER: "Маркетинг",
    ANALYST: "Аналитика",
    MODERATOR: "Модерация",
    SALES_MANAGER: "Коммерческий отдел",
    OPERATOR: "Отдел бронирования",
  };
  const ROLE_LABEL: Record<string, string> = {
    ADMIN: "Администратор",
    DIRECTOR: "Руководитель",
    FINANCE: "Финансист",
    MARKETER: "Маркетолог",
    ANALYST: "Аналитик",
    MODERATOR: "Модератор",
    SALES_MANAGER: "Менеджер по продажам",
    OPERATOR: "Операционист",
  };

  // ── AI-инсайты ──
  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  if (ranked[0]) {
    ai.push({ level: "positive", title: `Лидер: ${ranked[0].label}`, detail: `Оценка ${ranked[0].score}/100 · ${ranked[0].load} задач за период` });
  }
  const weakest = ranked[ranked.length - 1];
  if (weakest && weakest.key !== ranked[0]?.key && weakest.score < 60) {
    ai.push({ level: "medium", title: `Требует внимания: ${weakest.label}`, detail: `Оценка ${weakest.score}/100 — проанализировать процессы` });
  }
  if (slaShare < 80) {
    ai.push({ level: "high", title: "Нарушения SLA", detail: `Только ${slaShare.toFixed(0)}% заказов обработано быстрее 48 часов` });
  }
  ai.push({ level: "info", title: "Загрузка подразделений", detail: `Заказы ${ordersCount} · Бронирования ${bookingsCount} · Просмотры ${views}` });

  return {
    section: "departments",
    title: "Подразделения",
    subtitle: "Эффективность подразделений платформы (Гл. 2.3)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "depts", title: "Подразделений", value: Object.keys(DEPT_LABEL).length, unit: " шт", tone: "neutral" },
      { key: "staff", title: "Сотрудников", value: staff.length, unit: " чел.", tone: "neutral", detail: "внутренний штат" },
      { key: "orders", title: "Заказы", value: ordersCount, unit: " шт", change: changePct(ordersCount, prevOrders), spark: ordersSeries.values, tone: "neutral" },
      { key: "bookings", title: "Бронирования", value: bookingsCount, unit: " шт", change: changePct(bookingsCount, prevBookings), spark: bookingsSeries.values, tone: "neutral" },
      { key: "revenue", title: "Выручка", value: Math.round(paidRevenue), change: changePct(paidRevenue, prevPaidAgg._sum.paidAmount ?? 0), tone: "positive", detail: "оплаченные заказы" },
      { key: "avgTime", title: "Среднее время обработки", value: Math.round(avgHours), unit: " ч", tone: avgHours <= 48 ? "positive" : "medium" },
      { key: "sla", title: "Выполнение SLA (48 ч)", value: slaShare, unit: "%", tone: slaShare >= 80 ? "positive" : "negative" },
      { key: "support", title: "Обращений в поддержку", value: messages, unit: " шт", tone: "neutral", detail: `${unread} непрочитанных` },
    ],
    funnels: [
      {
        key: "clientJourney",
        title: "Путь клиента по отделам",
        steps: [
          { label: "Маркетинг: просмотры", value: views },
          { label: "Бронирование: брони", value: bookingsCount, detail: `${views ? viewsToBooking.toFixed(1) : 0}% от просмотров` },
          { label: "Коммерческий: оплата", value: paidOrders.length, detail: `${salesConv.toFixed(0)}% от заказов` },
        ],
      },
    ],
    series: [
      { key: "ordersSeries", title: "Заказы — коммерческий отдел", icon: "📦", mode: "bar", data: ordersSeries },
      { key: "bookingsSeries", title: "Бронирования — отдел бронирования", icon: "📑", mode: "line", data: bookingsSeries },
      { key: "viewsSeries", title: "Просмотры — маркетинг", icon: "👀", mode: "area", data: viewsSeries },
    ],
    donuts: [],
    barLists: [
      {
        key: "deptScores",
        title: "Эффективность отделов",
        icon: "🏢",
        rows: ranked.map((d) => ({ label: d.label, value: d.score, sub: `${d.load} задач за период` })),
        maxValue: 100,
      },
      {
        key: "deptLoad",
        title: "Загрузка отделов",
        icon: "⚙️",
        rows: [...ranked].sort((a, b) => b.load - a.load).map((d) => ({ label: d.label, value: d.load })),
      },
    ],
    tables: [
      {
        key: "deptTable",
        title: "Сводка по отделам",
        icon: "📊",
        columns: [
          { key: "dept", label: "Отдел" },
          { key: "load", label: "Задач", align: "right" },
          { key: "conv", label: "Ключевая конверсия" },
          { key: "score", label: "Оценка", align: "right" },
        ],
        rows: ranked.map((d) => ({
          dept: d.label,
          load: d.load,
          conv:
            d.key === "sales"
              ? `${salesConv.toFixed(0)}% оплат`
              : d.key === "bookings"
              ? `${confirmedShare.toFixed(0)}% подтверждено`
              : d.key === "finance"
              ? `${refundRate.toFixed(1)}% возвратов`
              : d.key === "marketing"
              ? `${viewsToBooking.toFixed(1)}% просмотр → бронь`
              : d.key === "support"
              ? `${messages ? Math.round((unread / messages) * 100) : 0}% непрочитанных`
              : "услуги и партнёры",
          score: d.score,
        })),
      },
      {
        key: "staffTable",
        title: "Сотрудники",
        icon: "👥",
        columns: [
          { key: "name", label: "Имя" },
          { key: "role", label: "Роль" },
          { key: "dept", label: "Отдел" },
          { key: "status", label: "Статус" },
        ],
        rows: staff.map((u) => ({
          name: `${u.firstName} ${u.lastName ?? ""}`.trim(),
          role: ROLE_LABEL[u.role] ?? u.role,
          dept: ROLE_DEPT[u.role] ?? "—",
          status: u.isActive ? "Активен" : "Неактивен",
        })),
      },
    ],
    ai,
  };
}
