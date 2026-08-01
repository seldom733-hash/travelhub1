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

type PeriodKey = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";

/**
 * GET /api/admin/analytics
 * Параметры: period, from, to, country (код), city, partnerId, type, currency
 */
export async function GET(request: Request) {
  try {
    // Только админ/партнёр: без сессии или покупатель → 401
    const user = await getCurrentUser();
    if (!user || user.role === "BUYER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as PeriodKey;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const country = searchParams.get("country") || undefined;
    const city = searchParams.get("city") || undefined;
    const partnerId = searchParams.get("partnerId") || undefined;
    const type = searchParams.get("type") || undefined;

    const range = periodRange(period, from, to);

    // Базовый where по бронированиям с учётом фильтров (конкретные объекты, не Record)
    const serviceFilter = {
      ...(country ? { countryCode: country } : {}),
      ...(city ? { city: { contains: city } } : {}),
      ...(type ? { type: type as never } : {}),
      ...(partnerId ? { providerId: partnerId } : {}),
    };
    const hasServiceFilter = Boolean(country || city || type || partnerId);
    const bookingWhere = {
      createdAt: { gte: range.start, lte: range.end },
      ...(hasServiceFilter ? { service: serviceFilter } : {}),
    };
    const prevBookingWhere = {
      createdAt: { gte: range.prevStart, lte: range.prevEnd },
      ...(hasServiceFilter ? { service: serviceFilter } : {}),
    };

    // ── KPI: общий доход, продажи, средний чек, прибыль (комиссия платформы ~12%) ──
    const [paidAgg, prevPaidAgg, bookingsAgg, prevBookingsAgg] = await Promise.all([
      prisma.booking.aggregate({
        where: { ...bookingWhere, status: { in: PAID } },
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true },
      }),
      prisma.booking.aggregate({
        where: { ...prevBookingWhere, status: { in: PAID } },
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true },
      }),
      prisma.booking.aggregate({ where: bookingWhere, _count: true }),
      prisma.booking.aggregate({ where: prevBookingWhere, _count: true }),
    ]);

    // ── KPI: бронирования по статусам ──
    const statusRows = await prisma.booking.groupBy({
      by: ["status"],
      where: bookingWhere,
      _count: true,
    });
    const statusCounts: Record<string, number> = {};
    for (const r of statusRows) statusCounts[r.status] = r._count;

    // ── KPI: конверсия (просмотры → брони → оплата) ──
    const viewServiceFilter = {
      ...(country ? { countryCode: country } : {}),
      ...(type ? { type: type as never } : {}),
      ...(partnerId ? { providerId: partnerId } : {}),
    };
    const hasViewFilter = Boolean(country || type || partnerId);
    const viewWhere = {
      viewedAt: { gte: range.start, lte: range.end },
      ...(hasViewFilter ? { service: viewServiceFilter } : {}),
    };
    const prevViewWhere = {
      viewedAt: { gte: range.prevStart, lte: range.prevEnd },
      ...(hasViewFilter ? { service: viewServiceFilter } : {}),
    };
    const [viewsInPeriod, paidInPeriod, prevViews] = await Promise.all([
      prisma.serviceView.count({ where: viewWhere }),
      prisma.booking.count({ where: { ...bookingWhere, status: { in: PAID } } }),
      prisma.serviceView.count({ where: prevViewWhere }),
    ]);
    const conversion = {
      views: viewsInPeriod,
      bookings: bookingsAgg._count,
      paid: paidInPeriod,
      rate: bookingsAgg._count ? (paidInPeriod / bookingsAgg._count) * 100 : 0,
      viewsToBooking: viewsInPeriod ? (bookingsAgg._count / viewsInPeriod) * 100 : 0,
      change: changePct(viewsInPeriod, prevViews),
    };

    // ── KPI: активные пользователи (уникальные за период) ──
    const activeViews = await prisma.serviceView.findMany({
      where: viewWhere,
      select: { userId: true },
    });
    const activeUsers = new Set(activeViews.map((v) => v.userId)).size;

    // ── KPI: новые партнёры и пользователи ──
    const [newPartners, newUsers, prevNewPartners] = await Promise.all([
      prisma.user.count({ where: { role: "PARTNER", createdAt: { gte: range.start, lte: range.end } } }),
      prisma.user.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
      prisma.user.count({
        where: { role: "PARTNER", createdAt: { gte: range.prevStart, lte: range.prevEnd } },
      }),
    ]);

    // ── Серия выручки ──
    const revRows = await prisma.booking.findMany({
      where: { ...bookingWhere, status: { in: PAID } },
      select: { createdAt: true, amount: true },
    });
    const revenueSeries = bucketize(
      revRows.map((r) => ({ at: r.createdAt, amount: r.amount })),
      period,
      range
    );

    // ── Продажи по типам услуг ──
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
    const salesByCategory = Object.entries(typeAgg).map(([t, v]) => ({
      type: t,
      label: SERVICE_TYPE_LABELS[t] ?? "Прочие",
      icon: SERVICE_TYPE_ICONS[t] ?? "🧩",
      ...v,
    }));

    // ── География продаж (по странам → города) ──
    const geoRows = await prisma.booking.findMany({
      where: { ...bookingWhere, status: { in: PAID } },
      select: {
        amount: true,
        service: { select: { countryCode: true, country: true, city: true } },
      },
    });
    const countryAgg = new Map<string, { name: string; revenue: number; count: number; cities: Map<string, number> }>();
    for (const r of geoRows) {
      const code = r.service.countryCode ?? "OTHER";
      const name = r.service.country ?? code;
      const entry = countryAgg.get(code) ?? { name, revenue: 0, count: 0, cities: new Map() };
      entry.revenue += r.amount;
      entry.count += 1;
      if (r.service.city) entry.cities.set(r.service.city, (entry.cities.get(r.service.city) ?? 0) + 1);
      countryAgg.set(code, entry);
    }
    const salesByCountry = [...countryAgg.entries()]
      .map(([code, v]) => ({
        code,
        country: v.name,
        revenue: Math.round(v.revenue),
        count: v.count,
        cities: [...v.cities.entries()]
          .map(([name, cnt]) => ({ name, count: cnt }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Онлайн-пользователи (за 15 минут) ──
    const onlineCutoff = new Date(Date.now() - 15 * 60000);
    const onlineRows = await prisma.serviceView.findMany({
      where: { viewedAt: { gte: onlineCutoff } },
      select: { userId: true, viewedAt: true, service: { select: { country: true, city: true, title: true } } },
    });
    const onlineUsers = onlineRows
      .slice(0, 12)
      .map((v) => ({
        id: v.userId,
        country: v.service.country ?? "—",
        city: v.service.city ?? "—",
        page: v.service.title,
        action: "Просмотр услуги",
        device: "Web",
        at: v.viewedAt,
      }));

    // ── Последние продажи ──
    const recentSales = await prisma.booking.findMany({
      where: { ...bookingWhere, status: { in: PAID } },
      orderBy: { createdAt: "desc" },
      take: 10,
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

    // ── Важные события ──
    const [recentPartners, recentRefunds, recentBookings] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PARTNER" },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { firstName: true, companyName: true, createdAt: true },
      }),
      prisma.booking.findMany({
        where: { status: "REFUNDED", createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { amount: true, createdAt: true, user: { select: { firstName: true } } },
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, createdAt: true, amount: true },
      }),
    ]);
    const importantEvents = [
      ...recentPartners.map((p) => ({
        id: `p-${p.createdAt.getTime()}`,
        type: "partner",
        title: `Регистрация партнёра: ${p.companyName ?? p.firstName}`,
        at: p.createdAt,
      })),
      ...recentRefunds.map((r) => ({
        id: `r-${r.createdAt.getTime()}`,
        type: "refund",
        title: `Возврат средств: ${r.user.firstName}, ${fmtMoney(r.amount)}`,
        at: r.createdAt,
      })),
      ...recentBookings.map((b) => ({
        id: `b-${b.id}`,
        type: "booking",
        title: `Новое бронирование на ${fmtMoney(b.amount)}`,
        at: b.createdAt,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 10);

    // ── AI-рекомендации ──
    const aiRecommendations = [];
    const topCat = [...salesByCategory].sort((a, b) => b.revenue - a.revenue)[0];
    const topCountry = salesByCountry[0];
    if (topCat) {
      aiRecommendations.push({
        level: "info",
        title: `Лидер категории: ${topCat.label}`,
        effect: `${fmtMoney(topCat.revenue)} · ${topCat.count} продаж`,
      });
    }
    if (topCountry) {
      aiRecommendations.push({
        level: "positive",
        title: `Топ направление: ${topCountry.country}`,
        effect: `${fmtMoney(topCountry.revenue)} за период`,
      });
    }
    if (statusCounts["PENDING"]) {
      aiRecommendations.push({
        level: "medium",
        title: `${statusCounts["PENDING"]} броней ожидают оплаты`,
        effect: "Напомнить клиентам",
      });
    }
    if (conversion.rate < 40) {
      aiRecommendations.push({
        level: "medium",
        title: "Конверсия бронь → оплата ниже нормы",
        effect: `${conversion.rate.toFixed(0)}% (норма 40%+)`,
      });
    }
    aiRecommendations.push({
      level: "info",
      title: "Распределение партнёров",
      effect: `${await prisma.user.count({ where: { role: "PARTNER" } })} активных партнёров`,
    });

    return NextResponse.json({
      kpi: {
        totalRevenue: {
          value: paidAgg._sum.amount ?? 0,
          change: changePct(paidAgg._sum.amount ?? 0, prevPaidAgg._sum.amount ?? 0),
          forecast: Math.round((paidAgg._sum.amount ?? 0) * 1.2),
        },
        salesCount: {
          value: paidAgg._count,
          change: changePct(paidAgg._count, prevPaidAgg._count),
          perDay: paidAgg._count / Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000)),
        },
        bookings: {
          created: bookingsAgg._count,
          confirmed: statusCounts["PAID"] ?? 0,
          pending: statusCounts["PENDING"] ?? 0,
          cancelled: statusCounts["REFUNDED"] ?? 0,
          completed: statusCounts["COMPLETED"] ?? 0,
          change: changePct(bookingsAgg._count, prevBookingsAgg._count),
        },
        avgCheck: {
          value: paidAgg._avg.amount ?? 0,
          change: changePct(paidAgg._avg.amount ?? 0, prevPaidAgg._avg.amount ?? 0),
        },
        profit: {
          value: (paidAgg._sum.amount ?? 0) * 0.12,
          margin: 12,
        },
        conversion,
        activeUsers: { total: activeUsers, today: activeUsers },
        newPartners: {
          registered: newPartners,
          change: changePct(newPartners, prevNewPartners),
          activated: newPartners,
        },
        newUsers,
      },
      revenueSeries,
      salesByCategory,
      salesByCountry,
      onlineUsers,
      recentSales,
      importantEvents,
      aiRecommendations,
      period: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error("Admin analytics API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
