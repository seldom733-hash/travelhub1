import os from "os";
import fs from "fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  periodRange,
  changePct,
  bucketize,
  seriesTrendPct,
  ruPlural,
  fmtMoney,
  ORDER_STATUS_GROUPS,
} from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { getDashboardMessages } from "@/lib/dashboard-messages";

export const dynamic = "force-dynamic";

// Единый источник статусных групп — ORDER_STATUS_GROUPS из admin-data.ts
// (используется и Order Center, чтобы карточки и таблицы не расходились).
const PAID_STATUSES = [...ORDER_STATUS_GROUPS.paid] as const;
const AWAITING_STATUSES = [...ORDER_STATUS_GROUPS.awaitingPayment] as const;
const ACTIVE_STATUSES = [...ORDER_STATUS_GROUPS.active] as const;

/** Все статусы заказа (для очередей). */
type OrderStatusValue =
  | (typeof ACTIVE_STATUSES)[number]
  | "COMPLETED"
  | "REFUNDED"
  | "CANCELLED"
  | "ARCHIVED";

/** Количество новых пользователей за период (для спарклайна). */
async function userSeries(range: { start: Date; end: Date }, role?: "ADMIN" | "BUYER" | "PARTNER") {
  const rows = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      createdAt: { gte: range.start, lte: range.end },
    },
    select: { createdAt: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  // Последние 8 дней
  const out: number[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  return out;
}

/** GET /api/admin/dashboard?period=month|week|year|quarter|today */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as
      | "today"
      | "yesterday"
      | "week"
      | "month"
      | "quarter"
      | "year"
      | "custom";

    const range = periodRange(period);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const prevMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);

    // ── KPI: заказы в работе / подтверждение / оплата / выполнены ──
    // Считаем за выбранный период (как Order Center), чтобы карточки сходились
    // с количеством записей в реестре заказов. Дельта — период vs предыдущий период.
    const [ordersInWork, ordersInWorkPrev, awaitingConf, awaitingConfPrev, awaitingPay, awaitingPayPrev, completed, completedPrev, overdue] =
      await Promise.all([
        prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { gte: range.start, lte: range.end } } }),
        prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
        prisma.order.count({ where: { status: "AWAITING_CONFIRMATION", createdAt: { gte: range.start, lte: range.end } } }),
        prisma.order.count({ where: { status: "AWAITING_CONFIRMATION", createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
        prisma.order.count({ where: { status: { in: [...AWAITING_STATUSES] }, createdAt: { gte: range.start, lte: range.end } } }),
        prisma.order.count({ where: { status: { in: [...AWAITING_STATUSES] }, createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
        prisma.order.count({ where: { status: "COMPLETED", createdAt: { gte: range.start, lte: range.end } } }),
        prisma.order.count({ where: { status: "COMPLETED", createdAt: { gte: range.prevStart, lte: range.prevEnd } } }),
        prisma.order.count({ where: { status: "OVERDUE", createdAt: { gte: range.start, lte: range.end } } }),
      ]);

    // ── KPI: новые за сегодня — с начала суток (то же окно, что период «today» в реестре,
    // чтобы при клике по карточке таблица показывала ровно столько же записей). ──
    const [ordersToday, ordersPrevDay] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    ]);

    // ── KPI: доход сегодня / месяц, комиссия ──
    const [todayRev, yesterdayRev, monthRev, prevMonthRev] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: todayStart } },
        _sum: { paidAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { paidAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: monthStart } },
        _sum: { paidAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: prevMonthStart, lt: monthStart } },
        _sum: { paidAmount: true },
        _count: true,
      }),
    ]);

    const revenueToday = todayRev._sum.paidAmount ?? 0;
    const revenueMonth = monthRev._sum.paidAmount ?? 0;
    const commission = Math.round(revenueMonth * 0.12); // 12% комиссия платформы
    const commissionPrev = Math.round((prevMonthRev._sum.paidAmount ?? 0) * 0.12);

    // Среднемесячный доход за предыдущие месяцы — реальная база для % плана.
    // Делим на число месяцев с фактическими продажами (а не всегда на 3),
    // чтобы на молодой платформе базовый уровень не занижался пустыми месяцами.
    const prev3MonthsStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 3, 1);
    const prev3MonthsRows = await prisma.order.findMany({
      where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: prev3MonthsStart, lt: monthStart } },
      select: { createdAt: true, paidAmount: true },
    });
    const monthsWithRevenue = new Set(prev3MonthsRows.map((r) => `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`)).size;
    const avgMonthlyRevenue = monthsWithRevenue
      ? prev3MonthsRows.reduce((a, r) => a + (r.paidAmount ?? 0), 0) / monthsWithRevenue
      : 0;

    // Дельта «сегодня vs вчера», но без пугающей «▼ 100%» при нулевой базе
    const safeChange = (cur: number, prev: number) => (cur === 0 && prev === 0 ? 0 : changePct(cur, prev));

    // ── KPI: новые пользователи / партнёры ──
    const [usersToday, usersYesterday, partnersToday, partnersYesterday, activeUsersCount, partnersAll] =
      await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
        prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: yesterdayStart, lt: todayStart } } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: "PARTNER" } }),
      ]);

    // ── Спарклайны ──
    const [usersSpark, partnersSpark, revSeriesForSpark] = await Promise.all([
      userSeries(range),
      userSeries(range, "PARTNER"),
      prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true, paidAmount: true },
      }),
    ]);
    const revByDay = new Map<string, number>();
    for (const r of revSeriesForSpark) {
      const k = r.createdAt.toISOString().slice(0, 10);
      revByDay.set(k, (revByDay.get(k) ?? 0) + (r.paidAmount ?? 0));
    }
    const revenueSpark: number[] = [];
    {
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        revenueSpark.push(Math.round(revByDay.get(d.toISOString().slice(0, 10)) ?? 0));
      }
    }

    // ── Серия выручки за период и серии заказов/пользователей (для AI-прогноза) ──
    const revenueSeries = bucketize(
      revSeriesForSpark.map((r) => ({ at: r.createdAt, amount: r.paidAmount ?? 0 })),
      period,
      range
    );
    const [orderRows, userRowsRange] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true },
      }),
    ]);
    const orderSeries = bucketize(orderRows.map((r) => ({ at: r.createdAt, amount: 1 })), period, range);
    const userSeriesPeriod = bucketize(userRowsRange.map((r) => ({ at: r.createdAt, amount: 1 })), period, range);

    // ── «Застрявшие» заказы для AI-предупреждений: подтверждения > 48 ч, оплаты > 72 ч.
    // Считаем в границах выбранного периода (gte: range.start), как и остальные
    // счётчики дашборда, чтобы предупреждения не противоречили сводке. ──
    const [staleConfirmations, stalePayments] = await Promise.all([
      prisma.order.count({
        where: {
          status: "AWAITING_CONFIRMATION",
          createdAt: { gte: range.start, lte: new Date(Date.now() - 48 * 3600000) },
        },
      }),
      prisma.order.count({
        where: {
          status: { in: ["AWAITING_PAYMENT", "PARTIALLY_PAID"] },
          createdAt: { gte: range.start, lte: new Date(Date.now() - 72 * 3600000) },
        },
      }),
    ]);

    // ── Продажи по типам услуг и направлениям (кольцевая диаграмма + AI-рекомендации) ──
    const salesByTypeRows = await prisma.order.groupBy({
      by: ["id"],
      where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: range.start, lte: range.end } },
      _sum: { paidAmount: true },
    });
    const orderIds = salesByTypeRows.map((r) => r.id);
    const ordersWithServices = orderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            bookings: { select: { service: { select: { type: true, country: true, countryCode: true } } } },
          },
        })
      : [];
    const typeMap = new Map<string, string[]>();
    const destMap = new Map<string, { name: string; code: string | null }[]>();
    for (const o of ordersWithServices) {
      typeMap.set(o.id, o.bookings.map((b) => b.service.type));
      destMap.set(
        o.id,
        o.bookings
          .map((b) => ({ name: b.service.country, code: b.service.countryCode }))
          .filter((d): d is { name: string; code: string | null } => Boolean(d.name))
      );
    }
    const salesAgg: Record<string, number> = {};
    // sales — число проданных услуг (бронирований) по направлению; destMap хранит
    // по одной записи на бронь, поэтому дубликаты учитываются корректно.
    const destAgg: Record<string, { revenue: number; code: string | null; sales: number }> = {};
    for (const row of salesByTypeRows) {
      const amount = row._sum.paidAmount ?? 0;
      const types = typeMap.get(row.id) ?? ["OTHER"];
      const perType = amount / Math.max(1, types.length);
      for (const t of types) salesAgg[t] = (salesAgg[t] ?? 0) + perType;
      const dests = destMap.get(row.id);
      if (dests?.length) {
        const perDest = amount / dests.length;
        for (const d of dests) {
          const cur = destAgg[d.name] ?? { revenue: 0, code: null, sales: 0 };
          destAgg[d.name] = { revenue: cur.revenue + perDest, code: cur.code ?? d.code, sales: cur.sales + 1 };
        }
      }
    }
    const salesByCategory = Object.entries(salesAgg)
      .map(([type, revenue]) => ({
        type,
        label: SERVICE_TYPE_LABELS[type] ?? "Прочие услуги",
        icon: SERVICE_TYPE_ICONS[type] ?? "🧩",
        revenue: Math.round(revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    // «Популярные направления» — ранжируем по числу продаж (спрос), выручка рядом.
    const popularDestinations = Object.entries(destAgg)
      .map(([name, v]) => ({ name, code: v.code, revenue: Math.round(v.revenue), sales: v.sales }))
      .sort((a, b) => b.sales - a.sales || b.revenue - a.revenue);

    // ── Очереди (Гл. 1.21) ──
    const queueGroups: { key: string; label: string; statuses: OrderStatusValue[] }[] = [
      { key: "new", label: "Новые заявки", statuses: ["CREATED", "DRAFT"] },
      { key: "check", label: "Ожидают проверки", statuses: ["AWAITING_CONFIRMATION"] },
      { key: "pay", label: "Ожидают оплаты", statuses: [...AWAITING_STATUSES] },
      { key: "ops", label: "Операционный отдел", statuses: ["PROCESSING", "CONFIRMED"] },
      { key: "docs", label: "Готовы документы", statuses: ["DOCUMENT_PREP", "READY"] },
      { key: "refund", label: "Возвраты", statuses: ["REFUNDED"] },
    ];
    // Очереди считаем за период (как KPI), чтобы число совпадало с записями
    // отфильтрованного реестра заказов, куда ведёт клик.
    const queueCounts = await Promise.all(
      queueGroups.map((g) =>
        prisma.order.count({
          where: { status: { in: g.statuses }, createdAt: { gte: range.start, lte: range.end } },
        })
      )
    );
    const queues = queueGroups.map((g, i) => ({ ...g, count: queueCounts[i] }));

    // ── Лента задач: заказы, требующие внимания (Гл. 1.8) ──
    // Микс по типам (по 2 задачи каждого типа, критичные раньше) + общие счётчики
    // по каждому типу, чтобы виджет показывал всю картину, а не только оплаты.
    // Жизненный цикл задачи об оплате: «Напомнить клиенту об оплате» → менеджер
    // отправляет сообщение → задача уходит из списка (напоминание выполнено, ждём
    // оплату) → если через 24ч статус не изменился, задача возвращается эскалацией
    // «Клиент не отвечает — позвонить» (high). Считается только сообщение менеджера
    // (senderRole = manager) — системные сообщения напоминанием не являются.
    const TASK_STATUSES = ["OVERDUE", "AWAITING_CONFIRMATION", "AWAITING_PAYMENT", "PARTIALLY_PAID"] as const;
    const ESCALATION_STATUSES = ["AWAITING_PAYMENT", "PARTIALLY_PAID"] as const;
    // Окно «напоминание отправлено»: задача по оплате скрыта, пока менеджер написал
    // клиенту < 24ч назад; по истечении окна без оплаты она возвращается эскалацией.
    const REMINDER_WINDOW_MS = 24 * 3600000;
    const TASK_META: Record<string, { title: string; prio: string; tab: string; chip: string }> = {
      OVERDUE: { title: "Просрочен — принять решение", prio: "high", tab: "overview", chip: "Просроченные" },
      AWAITING_CONFIRMATION: { title: "Подтвердить заказ у поставщика", prio: "high", tab: "overview", chip: "Подтверждения" },
      // Оплатные задачи открывают карточку сразу на вкладке «Коммуникации» (tab = messages),
      // где менеджер отправляет клиенту сообщение-напоминание об оплате.
      AWAITING_PAYMENT: { title: "Напомнить клиенту об оплате", prio: "medium", tab: "messages", chip: "Ожидают оплаты" },
      PARTIALLY_PAID: { title: "Добить оплату по заказу", prio: "medium", tab: "messages", chip: "Частичная оплата" },
    };
    const ESCALATED: { title: string; prio: string; tab: string } = {
      title: "Клиент не отвечает — позвонить",
      prio: "high",
      // Эскалация — тоже через переписку: в карточке открываем «Коммуникации»
      tab: "messages",
    };
    const [taskTypeCounts, taskReminded, taskNotReminded, taskPool] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        where: { status: { in: [...TASK_STATUSES] }, createdAt: { gte: range.start, lte: range.end } },
        _count: { _all: true },
      }),
      // Сколько из них уже «напомнили»: по оплатным заказам периода есть хотя бы одно
      // сообщение менеджера (senderRole = manager). Показывается в чипе «из них напомнено N».
      prisma.order.groupBy({
        by: ["status"],
        where: {
          status: { in: [...ESCALATION_STATUSES] },
          createdAt: { gte: range.start, lte: range.end },
          messages: { some: { senderRole: "manager" } },
        },
        _count: { _all: true },
      }),
      // Заказы БЕЗ напоминания: оплатные статусы периода, ни одного сообщения менеджера.
      // Их номера показываются в тултипе чипа «по каким заказам напоминание не отправлено».
      prisma.order.findMany({
        where: {
          status: { in: [...ESCALATION_STATUSES] },
          createdAt: { gte: range.start, lte: range.end },
          messages: { none: { senderRole: "manager" } },
        },
        orderBy: { serviceDate: "asc" },
        take: 20,
        select: {
          orderNumber: true,
          status: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: { in: [...TASK_STATUSES] }, createdAt: { gte: range.start, lte: range.end } },
        orderBy: { serviceDate: "asc" },
        take: 40,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          amount: true,
          serviceDate: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    // Группируем «ненапомненные» заказы по статусу для тултипа чипа
    const notRemindedByStatus = new Map<string, { orderNumber: string; client: string }[]>();
    for (const o of taskNotReminded) {
      const arr = notRemindedByStatus.get(o.status) ?? [];
      arr.push({ orderNumber: o.orderNumber, client: `${o.user.firstName} ${o.user.lastName ?? ""}`.trim() });
      notRemindedByStatus.set(o.status, arr);
    }
    // Последнее сообщение МЕНЕДЖЕРА по каждому заказу (для «напомнил/не отвечает»).
    // Системные сообщения напоминанием не считаются — только реальные письма менеджера.
    const lastMessages = taskPool.length
      ? await prisma.orderMessage.findMany({
          where: { orderId: { in: taskPool.map((o) => o.id) }, senderRole: "manager" },
          orderBy: [{ orderId: "asc" }, { createdAt: "desc" }],
          select: { orderId: true, createdAt: true },
        })
      : [];
    // Последнее сообщение менеджера по каждому заказу (первое из groupBy = самое свежее)
    const lastManagerMsg = new Map<string, number>();
    for (const m of lastMessages) {
      if (!lastManagerMsg.has(m.orderId)) lastManagerMsg.set(m.orderId, m.createdAt.getTime());
    }
    const attentionOrdersCount = taskTypeCounts.reduce((a, r) => a + r._count._all, 0);
    // Задачи об оплате, по которым менеджер уже написал клиенту (< 24ч назад), уходят
    // из списка: напоминание выполнено, ждём оплату. Через 24ч без изменения статуса
    // задача вернётся эскалацией «Клиент не отвечает — позвонить».
    const remindedRecently = (o: (typeof taskPool)[number]) => {
      if (!(ESCALATION_STATUSES as readonly string[]).includes(o.status)) return false;
      const last = lastManagerMsg.get(o.id);
      return last ? Date.now() - last < REMINDER_WINDOW_MS : false;
    };
    const mixedOrders: typeof taskPool = [];
    for (const status of TASK_STATUSES) {
      let taken = 0;
      for (const o of taskPool) {
        if (o.status !== status || taken >= 2) continue;
        if (remindedRecently(o)) continue; // напоминание отправлено — ждём оплату
        mixedOrders.push(o);
        taken++;
      }
    }
    const tasks = mixedOrders.map((o) => {
      const meta = TASK_META[o.status] ?? { title: "Обработать заказ", prio: "medium", tab: "overview", chip: "Прочие" };
      // Проверка эскалации: заказ в статусе оплаты, последнее сообщение менеджера > 24ч назад
      const escalated = (ESCALATION_STATUSES as readonly string[]).includes(o.status) && (() => {
        const last = lastManagerMsg.get(o.id);
        return last ? Date.now() - last > REMINDER_WINDOW_MS : false;
      })();
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        title: escalated ? ESCALATED.title : meta.title,
        client: `${o.user.firstName} ${o.user.lastName ?? ""}`.trim(),
        priority: escalated ? ESCALATED.prio : meta.prio,
        deadline: o.serviceDate ?? o.createdAt,
        amount: o.amount,
        // Вкладка карточки: для эскалированных и оплатных — «Коммуникации» (messages)
        tab: escalated ? ESCALATED.tab : meta.tab,
      };
    });
    const taskCounts = TASK_STATUSES.map((status) => ({
      status,
      label: TASK_META[status].chip,
      count: taskTypeCounts.find((r) => r.status === status)?._count._all ?? 0,
      // «из них напомнено N» — только для оплатных статусов, где напоминание имеет смысл.
      // Напомнено = есть ЛЮБОЕ сообщение менеджера (в т.ч. > 24ч — такие уже эскалированы
      // в «Клиент не отвечает»), поэтому reminded не равен числу скрытых из списка задач
      // (remindedRecently считает только сообщения моложе 24 часов).
      reminded: taskReminded.find((r) => r.status === status)?._count._all ?? 0,
      // Заказы, по которым напоминание ещё не отправлено (для тултипа чипа)
      notReminded: notRemindedByStatus.get(status) ?? [],
    }));

    // ── AI-центр (Гл. 1.9, 1.22) ──
    // Все пункты строятся только из реальных данных БД; захардкожены лишь сами
    // формулировки правил. Прогноз — линейный тренд серий выбранного периода.
    const attentionCount = awaitingConf + awaitingPay;
    const todayGrowth = changePct(revenueToday, yesterdayRev._sum.paidAmount ?? 0);

    // Предупреждения: реальные «застрявшие» заказы — просроченные, подтверждения
    // дольше 48 часов, оплаты дольше 72 часов.
    const aiWarnings: { title: string; detail: string }[] = [];
    if (overdue) {
      aiWarnings.push({
        title: `${overdue} ${ruPlural(overdue, "заказ просрочен", "заказа просрочено", "заказов просрочено")}`,
        detail: "Требуется решение менеджера",
      });
    }
    if (staleConfirmations > 0) {
      aiWarnings.push({
        title: `${staleConfirmations} ${ruPlural(staleConfirmations, "подтверждение ждёт", "подтверждения ждут", "подтверждений ждут")} дольше 48 часов`,
        detail: "Поставщик задерживает ответ",
      });
    }
    if (stalePayments > 0) {
      aiWarnings.push({
        title: `${stalePayments} ${ruPlural(stalePayments, "заказ ожидает", "заказа ожидают", "заказов ожидают")} оплату дольше 72 часов`,
        detail: "Отправьте клиентам напоминания",
      });
    }

    // Рекомендации: реальные аномалии дохода и лидеры продаж периода.
    const aiRecommendations: { level: string; title: string; effect: string; action: string }[] = [];
    // Отрицательную аномалию не показываем, пока день не дал ни $ — утром
    // «▼ 100%» было бы пугающей, а не информативной.
    if (todayGrowth < -10 && revenueToday > 0) {
      aiRecommendations.push({
        level: "high",
        title: "Доход сегодня ниже вчерашнего",
        effect: `Снижение на ${Math.abs(todayGrowth).toFixed(0)}%`,
        action: "Проверьте активные кампании и горящие предложения",
      });
    } else if (todayGrowth > 10) {
      aiRecommendations.push({
        level: "positive",
        title: "Рост дохода за день",
        effect: `+${todayGrowth.toFixed(0)}% к вчерашнему`,
        action: "Усильте продажи в самом прибыльном направлении",
      });
    }
    if (awaitingConf) {
      aiRecommendations.push({
        level: "medium",
        title: `${awaitingConf} ${ruPlural(awaitingConf, "заказ ожидает", "заказа ожидают", "заказов ожидают")} подтверждения`,
        effect: "Поставщики задерживают ответ",
        action: "Ускорить подтверждения",
      });
    }
    if (awaitingPay) {
      aiRecommendations.push({
        level: "medium",
        title: `${awaitingPay} ${ruPlural(awaitingPay, "заказ ожидает", "заказа ожидают", "заказов ожидают")} оплаты`,
        effect: fmtMoney(
          taskPool.filter((o) => AWAITING_STATUSES.includes(o.status as (typeof AWAITING_STATUSES)[number])).reduce((a, o) => a + o.amount, 0)
        ) + " в работе",
        action: "Отправить напоминания клиентам",
      });
    }
    if (salesByCategory.length) {
      const top = salesByCategory.slice(0, 3);
      aiRecommendations.push({
        level: "info",
        title: "Лидеры продаж по категориям",
        effect: top.map((t) => t.label).join(", "),
        action: `Топ-1 «${top[0].label}» — ${fmtMoney(top[0].revenue)}. Подготовьте спецпредложения`,
      });
    } else {
      aiRecommendations.push({
        level: "info",
        title: "Продаж за период нет",
        effect: "Нет оплаченных заказов в выбранном периоде",
        action: "Проверьте воронку продаж и запустите кампании",
      });
    }

    // Прогноз: линейный тренд серий дохода, заявок и новых пользователей периода.
    const aiForecast = [
      { label: "Доход", change: seriesTrendPct(revenueSeries.values) },
      { label: "Заявки", change: seriesTrendPct(orderSeries.values) },
      { label: "Новые пользователи", change: seriesTrendPct(userSeriesPeriod.values) },
    ];

    // Сводка: факты периода; строка «всё в норме» — только если аномалий нет.
    const aiSummary: { text: string; href?: string }[] = [];
    if (ordersToday > 0) {
      aiSummary.push({
        text: `Сегодня ${ordersToday} ${ruPlural(ordersToday, "новая заявка", "новые заявки", "новых заявок")}`,
        href: "/admin/orders?period=today",
      });
    }
    if (revenueToday > 0) {
      aiSummary.push({ text: `Доход сегодня ${fmtMoney(revenueToday)}` });
    }
    // AWAITING_STATUSES уже включает OVERDUE, поэтому не прибавляем overdue повторно.
    if (attentionCount > 0) {
      aiSummary.push({
        text: `${attentionCount} ${ruPlural(attentionCount, "заказ требует", "заказа требуют", "заказов требуют")} внимания`,
        href: "/admin/orders?status=AWAITING_CONFIRMATION,AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE",
      });
    }
    const hasAnomaly = aiWarnings.length > 0 || aiRecommendations.some((r) => r.level === "high");
    if (!hasAnomaly) {
      aiSummary.push({ text: "Аномалий не обнаружено: показатели в норме" });
    }

    // ── Уведомления (Гл. 1.10, 1.23) ──
    const [recentOrders, recentUsers, recentReviews] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, orderNumber: true, status: true, amount: true, createdAt: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, firstName: true, lastName: true, role: true, createdAt: true },
      }),
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { id: true, rating: true, createdAt: true },
      }),
    ]);
    const ORDER_NOTIFY: Record<string, { type: string; title: string }> = {
      CREATED: { type: "order", title: "Создан новый заказ" },
      CONFIRMED: { type: "confirm", title: "Заказ подтверждён" },
      AWAITING_PAYMENT: { type: "pay", title: "Ожидается оплата" },
      PAID: { type: "paid", title: "Поступила оплата" },
      REFUNDED: { type: "refund", title: "Оформлен возврат" },
      COMPLETED: { type: "done", title: "Заказ выполнен" },
    };
    const notifications = [
      ...recentOrders.map((o) => {
        const meta = ORDER_NOTIFY[o.status] ?? { type: "order", title: `Заказ ${o.orderNumber}` };
        return {
          id: `o-${o.id}`,
          type: meta.type,
          title: `${meta.title} №${o.orderNumber}`,
          detail: `${fmtMoney(o.amount)}`,
          at: o.createdAt,
          // Глубокий переход: открывает карточку заказа в реестре (вкладка «Обзор»)
          href: `/admin/orders?open=${o.id}&tab=overview`,
        };
      }),
      ...recentUsers.map((u) => ({
        id: `u-${u.id}`,
        type: "user",
        title: `Новый ${u.role === "PARTNER" ? "партнёр" : "пользователь"}: ${u.firstName} ${u.lastName ?? ""}`,
        detail: u.role === "PARTNER" ? "Требуется проверка" : "Регистрация на сайте",
        at: u.createdAt,
        href: "/admin/users",
      })),
      ...recentReviews.map((r) => ({
        id: `r-${r.id}`,
        type: "review",
        title: `Новый отзыв: ${r.rating}★`,
        detail: "Отзыв на услугу опубликован",
        at: r.createdAt,
        href: "/admin/content",
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    // ── Сообщения (Гл. 1.24): непрочитанные по заказам ──
    // Общий хелпер с лёгким эндпоинтом /api/admin/dashboard/messages — фоновое
    // обновление счётчика «N новых» на дашборде без перезагрузки страницы.
    const messages = await getDashboardMessages();

    // ── Календарь (Гл. 1.25) ──
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    tomorrow.setHours(23, 59, 59, 999);
    const calendarOrders = await prisma.order.findMany({
      where: { serviceDate: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { serviceDate: "asc" },
      take: 40,
      select: {
        id: true,
        orderNumber: true,
        serviceDate: true,
        status: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
    const todayKey = dayKey(now);
    const tomorrowKey = dayKey(new Date(now.getTime() + 86400000));
    // Каждый пункт календаря ведёт на карточку конкретного заказа в реестре
    const withOrderHref = (arr: typeof calendarOrders) =>
      arr.map((o) => ({ ...o, href: `/admin/orders?open=${o.id}&tab=overview` }));
    const calendar = {
      today: withOrderHref(calendarOrders.filter((o) => o.serviceDate && dayKey(o.serviceDate) === todayKey)),
      tomorrow: withOrderHref(calendarOrders.filter((o) => o.serviceDate && dayKey(o.serviceDate) === tomorrowKey)),
      overdue: withOrderHref(calendarOrders.filter((o) => o.serviceDate && new Date(o.serviceDate).getTime() < now.getTime())),
      upcoming: withOrderHref(calendarOrders.filter((o) => o.serviceDate && new Date(o.serviceDate).getTime() >= tomorrow.getTime()).slice(0, 4)),
    };

    // ── Среднее время операций (Гл. 1.26) из реальных журналов ──
    // Операции: интервал «создан → подтверждён» из OrderHistory; поддержка: время
    // от клиентского сообщения до первого ответа менеджера/системы из OrderMessage.
    // Ограничиваем окно 90 днями и отсекаем выбросы (подтверждение > 30 д,
    // ответ > 7 д), чтобы случайно «зависшие» заказы не искажали среднее.
    const historyWindow = { gte: new Date(Date.now() - 90 * 86400000) };
    const [orderHistoryRows, orderMessageRows] = await Promise.all([
      prisma.orderHistory.findMany({
        where: { createdAt: historyWindow },
        orderBy: { createdAt: "asc" },
        select: { orderId: true, action: true, createdAt: true },
      }),
      prisma.orderMessage.findMany({
        where: { createdAt: historyWindow },
        orderBy: [{ orderId: "asc" }, { createdAt: "asc" }],
        select: { orderId: true, senderRole: true, createdAt: true },
      }),
    ]);
    const createdByOrder = new Map<string, number>();
    const confirmDiffs: number[] = [];
    const CONFIRM_MAX_MS = 30 * 86400000;
    for (const h of orderHistoryRows) {
      if (h.action === "created") createdByOrder.set(h.orderId, h.createdAt.getTime());
      else if (h.action === "confirm" && createdByOrder.has(h.orderId)) {
        const diff = h.createdAt.getTime() - createdByOrder.get(h.orderId)!;
        if (diff > 0 && diff <= CONFIRM_MAX_MS) confirmDiffs.push(diff);
      }
    }
    const supportDiffs: number[] = [];
    {
      let lastClientAt: number | null = null;
      let curOrderId: string | null = null;
      for (const m of orderMessageRows) {
        if (m.orderId !== curOrderId) {
          curOrderId = m.orderId;
          lastClientAt = null;
        }
        if (m.senderRole === "client") lastClientAt = m.createdAt.getTime();
        else if (lastClientAt !== null) {
          const diff = m.createdAt.getTime() - lastClientAt;
          if (diff > 0 && diff <= 7 * 86400000) supportDiffs.push(diff);
          lastClientAt = null;
        }
      }
    }
    const avgMs = (diffs: number[]) => (diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0);
    const fmtDuration = (ms: number) => {
      if (!ms) return "—";
      if (ms < 3600000) return `${Math.max(1, Math.round(ms / 60000))} мин`;
      if (ms < 86400000) return `${Math.round(ms / 3600000)} ч`;
      return `${Math.round(ms / 86400000)} д`;
    };

    // ── Производительность подразделений (Гл. 1.26) ──
    const [ordersInPeriod, confirmedInPeriod, changedInPeriod, servicesNew, servicesInactive, clientMsgs] =
      await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.order.count({
          where: { status: { in: ["CONFIRMED", ...PAID_STATUSES] }, createdAt: { gte: monthStart } },
        }),
        prisma.order.count({ where: { status: "CHANGED", createdAt: { gte: monthStart } } }),
        prisma.service.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.service.count({ where: { isActive: false } }),
        prisma.orderMessage.count({ where: { senderRole: "client" } }),
      ]);
    const departments = {
      sales: {
        received: ordersInPeriod,
        transferred: monthRev._count,
        conversion: ordersInPeriod ? Math.round((monthRev._count / ordersInPeriod) * 100) : 0,
      },
      operations: {
        received: ordersInPeriod,
        confirmed: confirmedInPeriod,
        noAvailability: awaitingConf,
        priceChanged: changedInPeriod,
        avgTime: fmtDuration(avgMs(confirmDiffs)),
      },
      support: {
        tickets: clientMsgs,
        avgResponse: fmtDuration(avgMs(supportDiffs)),
      },
      moderation: {
        newServices: servicesNew,
        rejected: servicesInactive,
      },
    };

    // ── Последние события платформы (Гл. 1.27) ──
    const events = [
      ...recentOrders.map((o) => ({
        id: `oe-${o.id}`,
        type: "order",
        title: `Заказ №${o.orderNumber}: ${ORDER_NOTIFY[o.status]?.title ?? o.status}`,
        detail: `${fmtMoney(o.amount)}`,
        at: o.createdAt,
        href: `/admin/orders?open=${o.id}&tab=overview`,
      })),
      ...recentUsers.map((u) => ({
        id: `ue-${u.id}`,
        type: "user",
        title: `Регистрация: ${u.firstName} ${u.lastName ?? ""}`,
        detail: u.role === "PARTNER" ? "Партнёр" : u.role === "ADMIN" ? "Сотрудник" : "Клиент",
        at: u.createdAt,
        href: "/admin/users",
      })),
      ...recentReviews.map((r) => ({
        id: `re-${r.id}`,
        type: "review",
        title: `Опубликован отзыв ${r.rating}★`,
        detail: "Новый отзыв на услугу",
        at: r.createdAt,
        href: "/admin/content",
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    // ── Панель здоровья платформы (Гл. 1.29): реальные показатели системы ──
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - dbStart;
    // CPU: доля не-idle времени по всем ядрам (os.cpus); память — os.totalmem/freemem
    const cpuPct = (() => {
      const cpus = os.cpus();
      let idle = 0;
      let total = 0;
      for (const c of cpus) {
        for (const t of Object.values(c.times)) total += t;
        idle += c.times.idle;
      }
      return total ? Math.round(((total - idle) / total) * 100) : 0;
    })();
    const memTotal = os.totalmem();
    const memPct = memTotal ? Math.round(((memTotal - os.freemem()) / memTotal) * 100) : 0;
    // Диск: свободное место на разделе проекта (fs.statfsSync)
    const disk = (() => {
      try {
        const s = fs.statfsSync(process.cwd());
        const bsize = s.bsize || 4096;
        return { freeGb: (s.bavail * bsize) / 1e9, totalGb: (s.blocks * bsize) / 1e9 };
      } catch {
        return { freeGb: 0, totalGb: 0 };
      }
    })();
    // Очередь — реальные заказы, ожидающие обработки (новые + на подтверждении)
    const queueOrders = await prisma.order.count({
      where: { status: { in: ["DRAFT", "CREATED", "AWAITING_CONFIRMATION"] } },
    });
    const system = {
      cpu: cpuPct,
      memory: memPct,
      apiMs: dbMs,
      dbMs,
      queue: queueOrders,
      storage: disk.totalGb ? `${disk.freeGb.toFixed(1)} ГБ свободно` : "—",
      uptime: Math.round(process.uptime() / 60),
    };
    const latencyLabel = (ms: number) => (ms > 0 ? `${ms}ms` : "<1ms");
    const health = {
      api: { status: "green", latency: latencyLabel(system.apiMs) },
      db: { status: dbMs > 1000 ? "yellow" : "green", latency: latencyLabel(system.dbMs) },
      queue: {
        status: queueOrders > 0 ? "yellow" : "green",
        detail:
          queueOrders > 0
            ? `${queueOrders} ${ruPlural(queueOrders, "заказ в очереди", "заказа в очереди", "заказов в очереди")}`
            : "Очередь пуста",
      },
      payments: { status: "yellow", detail: "Симуляция" },
      email: { status: "yellow", detail: "Симуляция" },
      sms: { status: "gray", detail: "Не настроено" },
      push: { status: "gray", detail: "Не настроено" },
      storage: {
        status: disk.totalGb && disk.freeGb / disk.totalGb < 0.1 ? "yellow" : "green",
        detail: system.storage,
      },
    };

    // ── Приветствие (Гл. 1.6) ──
    const hour = new Date().getHours();
    const timeOfDay = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
    // Подпись периода для виджетов («Продажи по категориям», «Популярные направления»…)
    const periodLabel = range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

    return NextResponse.json({
      greeting: {
        name: user.firstName,
        timeOfDay,
        dateText: new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }),
        activeUsers: activeUsersCount,
        // Реальное число задач (без ограничения take, которым обрезан список)
        attentionTasks: attentionOrdersCount,
      },
      kpi: {
        ordersToday: { value: ordersToday, change: safeChange(ordersToday, ordersPrevDay) },
        ordersInWork: { value: ordersInWork, change: safeChange(ordersInWork, ordersInWorkPrev) },
        awaitingConfirmation: { value: awaitingConf, change: safeChange(awaitingConf, awaitingConfPrev) },
        awaitingPayment: { value: awaitingPay, change: safeChange(awaitingPay, awaitingPayPrev) },
        completed: { value: completed, change: safeChange(completed, completedPrev) },
        revenueToday: { value: revenueToday, change: safeChange(revenueToday, yesterdayRev._sum.paidAmount ?? 0), spark: revenueSpark },
        revenueMonth: {
          value: revenueMonth,
          change: safeChange(revenueMonth, prevMonthRev._sum.paidAmount ?? 0),
          // % плана: отношение дохода месяца к среднемесячному доходу за прошлые 3 месяца
          planPct: avgMonthlyRevenue
            ? Math.min(100, Math.round((revenueMonth / avgMonthlyRevenue) * 100))
            : revenueMonth
              ? 100
              : 0,
          // Прогноз — экстраполяция линейного тренда серии месяца (вместо ×1.18)
          forecast: Math.round(revenueMonth * (1 + seriesTrendPct(revenueSeries.values) / 100)),
        },
        commission: { value: commission, change: safeChange(commission, commissionPrev) },
        newUsers: { value: usersToday, change: safeChange(usersToday, usersYesterday), spark: usersSpark },
        newPartners: { value: partnersToday, change: safeChange(partnersToday, partnersYesterday), spark: partnersSpark },
      },
      queues,
      tasks,
      taskCounts,
      ai: { summary: aiSummary, recommendations: aiRecommendations, warnings: aiWarnings, forecast: aiForecast },
      notifications,
      messages,
      calendar,
      departments,
      events,
      health,
      system,
      revenueSeries,
      salesByCategory,
      popularDestinations,
      periodLabel,
      partnersAll,
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin dashboard API error");
  }
}
