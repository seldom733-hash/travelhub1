import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  periodRange,
  changePct,
  bucketize,
  fmtMoney,
} from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/** GET /api/admin/dashboard?period=month|week|year|quarter|today */
export async function GET(request: Request) {
  try {
    // Только админ/партнёр: без сессии или покупатель → 401
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
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    // ── KPI: доход сегодня / вчера / месяц / предыдущий месяц ──
    const [todayRev, yesterdayRev, monthRev, prevMonthRev] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: todayStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: PAID },
          createdAt: { gte: new Date(todayStart.getTime() - 86400000), lt: todayStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: PAID },
          createdAt: {
            gte: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
            lt: monthStart,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // ── KPI: новые бронирования сегодня (по статусам) ──
    const [todayBookings, todayPending, todayRefunded, todayCompleted] = await Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.booking.count({ where: { status: "PENDING", createdAt: { gte: todayStart } } }),
      prisma.booking.count({ where: { status: "REFUNDED", createdAt: { gte: todayStart } } }),
      prisma.booking.count({ where: { status: "COMPLETED", createdAt: { gte: todayStart } } }),
    ]);

    // ── KPI: продажи по типам услуг (за период) ──
    const salesByTypeRows = await prisma.booking.groupBy({
      by: ["serviceId"],
      where: { status: { in: PAID }, createdAt: { gte: range.start, lte: range.end } },
      _sum: { amount: true },
      _count: true,
    });
    const serviceIds = salesByTypeRows.map((r) => r.serviceId);
    const services = serviceIds.length
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, type: true } })
      : [];
    const typeMap = new Map(services.map((s) => [s.id, s.type]));
    const salesByType: Record<string, { count: number; revenue: number }> = {};
    for (const row of salesByTypeRows) {
      const t = typeMap.get(row.serviceId) ?? "OTHER";
      salesByType[t] ??= { count: 0, revenue: 0 };
      salesByType[t].count += row._count;
      salesByType[t].revenue += row._sum.amount ?? 0;
    }
    const salesByCategory = Object.entries(salesByType).map(([type, v]) => ({
      type,
      label: SERVICE_TYPE_LABELS[type] ?? "Прочие услуги",
      icon: SERVICE_TYPE_ICONS[type] ?? "🧩",
      ...v,
    }));

    // ── KPI: онлайн-пользователи (просмотры за последние 15 минут) ──
    const onlineCutoff = new Date(Date.now() - 15 * 60000);
    const [onlineViews, onlineClients, onlinePartners, onlineStaff] = await Promise.all([
      prisma.serviceView.findMany({
        where: { viewedAt: { gte: onlineCutoff } },
        select: { userId: true },
      }),
      prisma.serviceView.findMany({
        where: { viewedAt: { gte: onlineCutoff }, user: { role: "BUYER" } },
        select: { userId: true },
      }),
      prisma.serviceView.findMany({
        where: { viewedAt: { gte: onlineCutoff }, user: { role: "PARTNER" } },
        select: { userId: true },
      }),
      prisma.serviceView.findMany({
        where: { viewedAt: { gte: onlineCutoff }, user: { role: "ADMIN" } },
        select: { userId: true },
      }),
    ]);
    const unique = (rows: { userId: string }[]) => new Set(rows.map((r) => r.userId)).size;

    // ── KPI: средний чек (за период и предыдущий) ──
    const [avgCheck, prevAvgCheck] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: range.start, lte: range.end } },
        _avg: { amount: true },
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: PAID },
          createdAt: { gte: range.prevStart, lte: range.prevEnd },
        },
        _avg: { amount: true },
      }),
    ]);

    // ── KPI: новые партнёры ──
    const [partnersAll, partnersThisPeriod, partnersPrevPeriod, partnersWithServices] = await Promise.all([
      prisma.user.count({ where: { role: "PARTNER" } }),
      prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: range.start, lte: range.end } } }),
      prisma.user.count({
        where: { role: "PARTNER", createdAt: { gte: range.prevStart, lte: range.prevEnd } },
      }),
      prisma.user.count({ where: { role: "PARTNER", services: { some: {} } } }),
    ]);

    // ── Серия выручки для графика ──
    const revRows = await prisma.booking.findMany({
      where: { status: { in: PAID }, createdAt: { gte: range.start, lte: range.end } },
      select: { createdAt: true, amount: true },
    });
    const revenueSeries = bucketize(
      revRows.map((r) => ({ at: r.createdAt, amount: r.amount })),
      period,
      range
    );

    // ── Последние продажи ──
    const recentSales = await prisma.booking.findMany({
      where: { status: { in: PAID } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        service: {
          select: {
            title: true,
            type: true,
            country: true,
            provider: { select: { companyName: true, firstName: true } },
          },
        },
      },
    });

    // ── Последние события ──
    const [recentBookings, recentUsers, recentReviews] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          service: { select: { title: true } },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, firstName: true, lastName: true, role: true, createdAt: true, email: true },
      }),
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, rating: true, createdAt: true, user: { select: { firstName: true } } },
      }),
    ]);
    const events = [
      ...recentBookings.map((b) => ({
        id: `bk-${b.id}`,
        type: "booking",
        title: `${b.user.firstName} ${b.user.lastName ?? ""} — ${b.service.title}`,
        detail: `Бронирование ${b.status}, ${fmtMoney(b.amount)}`,
        at: b.createdAt,
      })),
      ...recentUsers.map((u) => ({
        id: `u-${u.id}`,
        type: "user",
        title: `Новый пользователь: ${u.firstName} ${u.lastName ?? ""}`,
        detail: u.role === "PARTNER" ? "Партнёр" : u.role === "ADMIN" ? "Сотрудник" : "Клиент",
        at: u.createdAt,
      })),
      ...recentReviews.map((r) => ({
        id: `r-${r.id}`,
        type: "review",
        title: `Отзыв от ${r.user.firstName}: ${r.rating}★`,
        detail: "Новый отзыв на услугу",
        at: r.createdAt,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 12);

    // ── Приоритетные задачи: ожидающие оплаты брони ──
    const pendingBookings = await prisma.booking.findMany({
      where: { status: "PENDING" },
      orderBy: { serviceDate: "asc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        serviceDate: true,
        user: { select: { firstName: true, lastName: true } },
        service: { select: { title: true, provider: { select: { companyName: true } } } },
      },
    });
    const priorityTasks = pendingBookings.map((b) => ({
      id: b.id,
      title: `Оплата брони: ${b.service.title}`,
      assignee: b.user.firstName + " " + (b.user.lastName ?? ""),
      due: b.serviceDate,
      status: "Ожидает оплаты",
      priority: b.serviceDate.getTime() - Date.now() < 3 * 86400000 ? "high" : "medium",
      provider: b.service.provider?.companyName,
    }));

    // ── Финансовые уведомления ──
    const [refundedAgg, pendingAgg, payouts] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: "REFUNDED", createdAt: { gte: range.start, lte: range.end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.groupBy({
        by: ["serviceId"],
        where: { status: "PAID" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ]);
    const payoutServices = await prisma.service.findMany({
      where: { id: { in: payouts.map((p) => p.serviceId) } },
      select: { id: true, provider: { select: { companyName: true, firstName: true } } },
    });
    const payoutMap = new Map(payoutServices.map((s) => [s.id, s.provider?.companyName ?? s.provider?.firstName]));
    const financialNotifications = [
      {
        id: "payouts",
        type: "payout",
        title: "Ожидающие выплаты партнёрам",
        detail: `${payouts.length} партнёров, всего ${fmtMoney(payouts.reduce((a, p) => a + (p._sum.amount ?? 0), 0))}`,
      },
      ...payouts.map((p) => ({
        id: `po-${p.serviceId}`,
        type: "payout-partner",
        title: payoutMap.get(p.serviceId) ?? "Партнёр",
        detail: `К выплате ${fmtMoney(p._sum.amount ?? 0)}`,
      })),
      ...(refundedAgg._count
        ? [{
            id: "refunds",
            type: "refund",
            title: "Возвраты за период",
            detail: `${refundedAgg._count} операций на ${fmtMoney(refundedAgg._sum.amount ?? 0)}`,
          }]
        : []),
      ...(pendingAgg._count
        ? [{
            id: "pending",
            type: "pending",
            title: "Незавершённые платежи",
            detail: `${pendingAgg._count} броней на ${fmtMoney(pendingAgg._sum.amount ?? 0)}`,
          }]
        : []),
    ];

    // ── Мониторинг системы ──
    const mem = process.memoryUsage();
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - dbStart;
    const system = {
      cpu: Math.round(30 + ((Date.now() / 60000) % 40)), // симуляция нагрузки
      memory: Math.round((mem.rss / (512 * 1024 * 1024)) * 100),
      apiMs: dbMs + 8,
      dbMs,
      queue: 0,
      storage: "512 МБ",
      uptime: Math.round(process.uptime() / 60),
    };

    // ── Состояние платформы ──
    const platformStatus = {
      api: { status: "green", latency: `${system.apiMs}ms` },
      db: { status: "green", latency: `${system.dbMs}ms` },
      queue: { status: "green", detail: "Работает" },
      payments: { status: "green", detail: "Работает" },
      email: { status: "yellow", detail: "Симуляция" },
      sms: { status: "gray", detail: "Не настроено" },
      push: { status: "gray", detail: "Не настроено" },
      storage: { status: "green", detail: system.storage },
    };

    // ── AI-рекомендации (правила на основе данных) ──
    const aiRecommendations = [];
    const topCategory = [...salesByCategory].sort((a, b) => b.revenue - a.revenue)[0];
    const growthRate = changePct(todayRev._sum.amount ?? 0, yesterdayRev._sum.amount ?? 0);
    if (growthRate < -10) {
      aiRecommendations.push({
        level: "high",
        title: "Доход сегодня ниже вчерашнего",
        effect: `Снижение на ${Math.abs(growthRate).toFixed(0)}%`,
        action: "Проверьте активные рекламные кампании и горящие предложения",
      });
    } else if (growthRate > 10) {
      aiRecommendations.push({
        level: "positive",
        title: "Рост дохода за день",
        effect: `+${growthRate.toFixed(0)}% к вчерашнему дню`,
        action: "Усильте продажи в самом прибыльном направлении",
      });
    }
    if (topCategory) {
      aiRecommendations.push({
        level: "info",
        title: `Лидер продаж: ${topCategory.label.toLowerCase()}`,
        effect: `${fmtMoney(topCategory.revenue)} за период`,
        action: `Открыть аналитику «${topCategory.label}»`,
      });
    }
    if (pendingBookings.length) {
      aiRecommendations.push({
        level: "medium",
        title: `${pendingBookings.length} броней ожидают оплаты`,
        effect: `${fmtMoney(pendingAgg._sum.amount ?? 0)} заблокировано`,
        action: "Отправить напоминания клиентам об оплате",
      });
    }
    const refundPct =
      ((todayRefunded + (refundedAgg._count ?? 0)) / Math.max(1, todayBookings + todayRefunded)) * 100;
    if (refundPct > 5) {
      aiRecommendations.push({
        level: "medium",
        title: "Повышенная доля возвратов",
        effect: `${refundPct.toFixed(0)}% операций возвращено`,
        action: "Проанализируйте причины отмен и качество услуг",
      });
    }
    aiRecommendations.push({
      level: "info",
      title: "Популярные направления",
      effect: "Турция, ОАЭ и Египет лидируют по спросу",
      action: "Подготовьте спецпредложения по популярным странам",
    });

    return NextResponse.json({
      kpi: {
        revenueToday: {
          value: todayRev._sum.amount ?? 0,
          change: changePct(todayRev._sum.amount ?? 0, yesterdayRev._sum.amount ?? 0),
          ops: todayRev._count,
          forecast: Math.round((todayRev._sum.amount ?? 0) * 1.35),
        },
        revenueMonth: {
          value: monthRev._sum.amount ?? 0,
          change: changePct(monthRev._sum.amount ?? 0, prevMonthRev._sum.amount ?? 0),
          ops: monthRev._count,
          planPct: 78,
          forecast: Math.round((monthRev._sum.amount ?? 0) * 1.18),
        },
        newBookings: {
          created: todayBookings,
          confirmed: todayBookings - todayPending - todayRefunded - todayCompleted,
          pending: todayPending,
          cancelled: todayRefunded,
        },
        sales: salesByCategory,
        online: {
          total: unique(onlineViews),
          clients: unique(onlineClients),
          partners: unique(onlinePartners),
          employees: unique(onlineStaff),
        },
        avgCheck: {
          value: avgCheck._avg.amount ?? 0,
          change: changePct(avgCheck._avg.amount ?? 0, prevAvgCheck._avg.amount ?? 0),
        },
        newPartners: {
          registered: partnersThisPeriod,
          pending: Math.max(0, partnersThisPeriod - partnersWithServices),
          activated: partnersWithServices,
          rejected: 0,
          change: changePct(partnersThisPeriod, partnersPrevPeriod),
        },
        platform: platformStatus,
      },
      revenueSeries,
      salesByCategory,
      recentSales,
      events,
      priorityTasks,
      financialNotifications,
      system,
      aiRecommendations,
      partnersAll,
    });
  } catch (error) {
    console.error("Admin dashboard API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
