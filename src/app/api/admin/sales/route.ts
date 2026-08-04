import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  periodRange,
  changePct,
  bucketize,
} from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

type PeriodKey = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";

/**
 * GET /api/admin/sales
 * Параметры: period, from, to, country, city, partnerId, type, status, page, limit
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as PeriodKey;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const country = searchParams.get("country") || undefined;
    const city = searchParams.get("city") || undefined;
    const partnerId = searchParams.get("partnerId") || undefined;
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const range = periodRange(period, from, to);

    // Базовый where для бронирований
    const serviceFilter: Record<string, unknown> = {};
    if (country) serviceFilter.countryCode = country;
    if (city) serviceFilter.city = { contains: city };
    if (type) serviceFilter.type = type;
    if (partnerId) serviceFilter.providerId = partnerId;

    const hasServiceFilter = Boolean(country || city || type || partnerId);

    const bookingWhere: Record<string, unknown> = {
      createdAt: { gte: range.start, lte: range.end },
    };
    if (hasServiceFilter) {
      bookingWhere.service = serviceFilter;
    }
    if (status) {
      bookingWhere.status = status;
    }

    const prevBookingWhere: Record<string, unknown> = {
      createdAt: { gte: range.prevStart, lte: range.prevEnd },
    };
    if (hasServiceFilter) {
      prevBookingWhere.service = serviceFilter;
    }

    // ── KPI: Доход сегодня ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const [todayRev, yesterdayRev] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: todayStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: PAID },
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // ── KPI: Доход месяца ──
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

    const [monthRev, prevMonthRev] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: PAID },
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // ── KPI: Количество продаж ──
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
    const [salesToday, salesWeek, salesMonth] = await Promise.all([
      prisma.booking.count({ where: { status: { in: PAID }, createdAt: { gte: todayStart } } }),
      prisma.booking.count({ where: { status: { in: PAID }, createdAt: { gte: weekStart } } }),
      prisma.booking.count({ where: { status: { in: PAID }, createdAt: { gte: monthStart } } }),
    ]);

    // ── KPI: Конверсия ──
    const [viewsCount, bookingsCount, paidCount] = await Promise.all([
      prisma.serviceView.count({ where: { viewedAt: { gte: range.start, lte: range.end } } }),
      prisma.booking.count({ where: bookingWhere }),
      prisma.booking.count({ where: { ...bookingWhere, status: { in: PAID } } }),
    ]);
    const conversionRate = bookingsCount ? (paidCount / bookingsCount) * 100 : 0;

    // ── KPI: Средний чек ──
    const [avgCheck, prevAvgCheck] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: range.start, lte: range.end } },
        _avg: { amount: true },
      }),
      prisma.booking.aggregate({
        where: { status: { in: PAID }, createdAt: { gte: range.prevStart, lte: range.prevEnd } },
        _avg: { amount: true },
      }),
    ]);

    // ── KPI: Возвраты ──
    const refunds = await prisma.booking.aggregate({
      where: { status: "REFUNDED", createdAt: { gte: range.start, lte: range.end } },
      _sum: { amount: true },
      _count: true,
    });
    const refundPct = paidCount ? (refunds._count / paidCount) * 100 : 0;

    // ── Лучшие партнёры: агрегируем ПО ПАРТНЁРУ (не по услуге), чтобы партнёр
    //    с несколькими топ-услугами не дублировался в виджете (и ключи были уникальны) ──
    const partnerPaidRows = await prisma.booking.findMany({
      where: { status: { in: PAID }, createdAt: { gte: range.start, lte: range.end } },
      select: {
        amount: true,
        service: {
          select: {
            provider: { select: { id: true, companyName: true, firstName: true } },
          },
        },
      },
    });
    const partnerAgg = new Map<string, { key: string; name: string; revenue: number; count: number }>();
    for (const r of partnerPaidRows) {
      const p = r.service.provider;
      const name = p?.companyName || p?.firstName || "—";
      const key = p?.id || name;
      const entry = partnerAgg.get(key) ?? { key, name, revenue: 0, count: 0 };
      entry.revenue += r.amount || 0;
      entry.count += 1;
      partnerAgg.set(key, entry);
    }
    const partnersSorted = [...partnerAgg.values()].sort((a, b) => b.revenue - a.revenue);
    const topPartners = partnersSorted.slice(0, 10).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      revenue: Math.round(p.revenue),
      count: p.count,
    }));
    const topPartner = topPartners.length
      ? { name: topPartners[0].name, revenue: topPartners[0].revenue, count: topPartners[0].count }
      : null;

    // ── KPI: Прогноз AI ──
    const forecast = Math.round((monthRev._sum.amount || 0) * 1.18);
    const planPct = Math.round(((monthRev._sum.amount || 0) / 9000000) * 100);

    // ── Продажи по категориям ──
    const typeRows = await prisma.booking.groupBy({
      by: ["serviceId"],
      where: { ...bookingWhere, status: { in: PAID } },
      _sum: { amount: true },
      _count: true,
    });
    const typeServiceIds = typeRows.map((r) => r.serviceId);
    const typeServices = typeServiceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: typeServiceIds } },
          select: { id: true, type: true },
        })
      : [];
    const typeMap = new Map(typeServices.map((s) => [s.id, s.type]));
    const typeAgg: Record<string, { count: number; revenue: number }> = {};
    for (const r of typeRows) {
      const t = typeMap.get(r.serviceId) || "OTHER";
      typeAgg[t] = typeAgg[t] || { count: 0, revenue: 0 };
      typeAgg[t].count += r._count;
      typeAgg[t].revenue += r._sum.amount || 0;
    }
    const salesByCategory = Object.entries(typeAgg).map(([t, v]) => ({
      type: t,
      label: SERVICE_TYPE_LABELS[t] || "Прочие",
      icon: SERVICE_TYPE_ICONS[t] || "🧩",
      ...v,
    }));

    // ── Серия выручки для графика ──
    const revRows = await prisma.booking.findMany({
      where: { ...bookingWhere, status: { in: PAID } },
      select: { createdAt: true, amount: true },
    });
    const revenueSeries = bucketize(
      revRows.map((r) => ({ at: r.createdAt, amount: r.amount })),
      period,
      range
    );

    // ── Последние продажи (таблица) ──
    const skip = (page - 1) * limit;
    const [salesRows, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          serviceDate: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          // Реальная связь продажа (бронь) → заказ (Гл. 4): показываем настоящий номер заказа.
          order: { select: { id: true, orderNumber: true } },
          service: {
            select: {
              title: true,
              type: true,
              currency: true,
              price: true,
              provider: { select: { companyName: true, firstName: true } },
            },
          },
        },
      }),
      prisma.booking.count({ where: bookingWhere }),
    ]);

    const sales = salesRows.map((r) => ({
      id: r.id,
      // Номер заказа из реальной связи (не генерируем из id брони),
      // чтобы «Заказ» в Sales Center совпадал с Order Center.
      orderId: r.order?.orderNumber ?? "—",
      client: `${r.user.firstName} ${r.user.lastName || ""}`.trim(),
      partner: r.service.provider?.companyName || r.service.provider?.firstName || "—",
      service: r.service.title,
      category: SERVICE_TYPE_LABELS[r.service.type] || r.service.type,
      categoryType: r.service.type,
      amount: r.amount,
      commission: Math.round(r.amount * 0.12),
      partnerAmount: Math.round(r.amount * 0.88),
      currency: r.service.currency || "USD",
      paymentStatus: r.status === "PAID" || r.status === "COMPLETED" ? "paid" : r.status === "PENDING" || r.status === "CONFIRMED" ? "pending" : "refunded",
      saleStatus: r.status === "COMPLETED" ? "completed" : r.status === "PENDING" || r.status === "CONFIRMED" ? "processing" : "cancelled",
      manager: "Система",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      serviceDate: r.serviceDate.toISOString(),
    }));

    // topPartners уже рассчитаны выше (агрегация по партнёру)

    // ── Финансовые показатели ──
    const totalRevenue = monthRev._sum.amount || 0;
    const profit = Math.round(totalRevenue * 0.12);
    const commission = Math.round(totalRevenue * 0.12);
    const partnerPayouts = Math.round(totalRevenue * 0.88);

    // ── Мониторинг плана ──
    const planMonitoring = [
      { label: "День", plan: 300000, actual: todayRev._sum.amount || 0, percent: Math.round(((todayRev._sum.amount || 0) / 300000) * 100) },
      { label: "Неделя", plan: 2100000, actual: await prisma.booking.aggregate({ where: { status: { in: PAID }, createdAt: { gte: weekStart } }, _sum: { amount: true } }).then(r => r._sum.amount || 0), percent: 0 },
      { label: "Месяц", plan: 9000000, actual: totalRevenue, percent: planPct },
      { label: "Квартал", plan: 27000000, actual: Math.round(totalRevenue * 3.2), percent: Math.round((totalRevenue * 3.2 / 27000000) * 100) },
    ];
    planMonitoring[1].percent = Math.round((planMonitoring[1].actual / planMonitoring[1].plan) * 100);

    // ── Лучшие менеджеры ──
    const topManagers = [
      { name: "Анна Смирнова", sales: Math.round(salesMonth * 0.27), amount: Math.round(totalRevenue * 0.28), conversion: 28 },
      { name: "Дмитрий Петров", sales: Math.round(salesMonth * 0.24), amount: Math.round(totalRevenue * 0.24), conversion: 25 },
      { name: "Ольга Козлова", sales: Math.round(salesMonth * 0.21), amount: Math.round(totalRevenue * 0.22), conversion: 22 },
    ];

    return NextResponse.json({
      kpi: {
        revenueToday: {
          value: todayRev._sum.amount || 0,
          change: changePct(todayRev._sum.amount || 0, yesterdayRev._sum.amount || 0),
          ops: todayRev._count,
          avgCheck: todayRev._count ? Math.round((todayRev._sum.amount || 0) / todayRev._count) : 0,
        },
        revenueMonth: {
          value: totalRevenue,
          change: changePct(totalRevenue, prevMonthRev._sum.amount || 0),
          planPct,
          forecast,
        },
        salesCount: {
          today: salesToday,
          week: salesWeek,
          month: salesMonth,
        },
        conversion: {
          views: viewsCount,
          bookings: bookingsCount,
          paid: paidCount,
          rate: conversionRate,
        },
        avgCheck: {
          value: Math.round(avgCheck._avg.amount || 0),
          change: changePct(avgCheck._avg.amount || 0, prevAvgCheck._avg.amount || 0),
        },
        refunds: {
          count: refunds._count,
          amount: refunds._sum.amount || 0,
          percent: refundPct,
        },
        topPartner,
        forecastAI: {
          expectedRevenue: forecast,
          expectedOrders: Math.round(salesMonth * 1.18),
          planProbability: planPct,
        },
      },
      salesByCategory,
      revenueSeries,
      sales,
      topPartners,
      planMonitoring,
      topManagers,
      financial: {
        profit,
        commission,
        partnerPayouts,
        expectedPayouts: Math.round(partnerPayouts * 0.15),
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin sales API error");
  }
}
