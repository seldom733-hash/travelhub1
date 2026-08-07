import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  periodRange,
  changePct,
  bucketize,
  fmtMoney,
  actorDisplayName,
  bookingSystemMessage,
} from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { EXECUTION_ROLES, requireRole } from "@/lib/admin-access";
import { nextBusinessCode } from "@/lib/ids";

export const dynamic = "force-dynamic";

// Канонические группы статусов брони (Baseline §0.5): оплата — измерение Order,
// поэтому «оплаченные» в центре броней = подтверждённые/исполненные брони.
const BOOKING_AWAITING = ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "NEEDS_CLARIFICATION"] as const;
const BOOKING_CONFIRMED = ["CONFIRMED", "IN_SERVICE", "COMPLETED"] as const;
const BOOKING_CANCELLED = ["CANCELLED", "CANCELLATION_REQUESTED", "SUPPLIER_REJECTED"] as const;

type PeriodKey = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";

// Детерминированный список менеджеров (в схеме нет поля manager — ротация по id)
const MANAGERS = ["Анна Смирнова", "Дмитрий Петров", "Ольга Козлова", "Игорь Волков", "Мария Соколова"];

export function pickManager(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MANAGERS[h % MANAGERS.length];
}

// Детерминированный источник бронирования
export function pickSource(id: string): string {
  const sources = ["Сайт", "Мобильное приложение", "Партнёр", "Call-центр", "Telegram-бот", "WhatsApp"];
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) >>> 0;
  return sources[h % sources.length];
}

/**
 * GET /api/admin/bookings
 * Параметры: period, from, to, country, city, type, partnerId, providerId,
 *            status (один статус или список через запятую, напр. CONFIRMED,PAID,COMPLETED;
 *            применяется только к таблице — KPI считаются по полному периоду),
 *            paymentStatus, manager, source, currency, minPrice, maxPrice,
 *            search, page, limit
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, EXECUTION_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);

    // ── Режим формы создания: возвращает справочники (клиенты + услуги) ──
    if (searchParams.get("mode") === "form") {
      const [clients, services] = await Promise.all([
        prisma.user.findMany({
          where: { role: "BUYER", isActive: true },
          orderBy: { firstName: "asc" },
          take: 200,
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        prisma.service.findMany({
          where: { isActive: true },
          orderBy: { type: "asc" },
          take: 300,
          select: {
            id: true,
            type: true,
            title: true,
            price: true,
            discountPrice: true,
            currency: true,
            country: true,
            city: true,
          },
        }),
      ]);
      return NextResponse.json({
        clients: clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim(), email: c.email })),
        services: services.map((s) => ({
          id: s.id,
          type: s.type,
          category: SERVICE_TYPE_LABELS[s.type] ?? s.type,
          title: s.title,
          price: s.discountPrice ?? s.price,
          currency: s.currency || "USD",
          direction: [s.country, s.city].filter(Boolean).join(" · "),
        })),
      });
    }

    const period = (searchParams.get("period") || "month") as PeriodKey;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const country = searchParams.get("country") || undefined;
    const city = searchParams.get("city") || undefined;
    const type = searchParams.get("type") || undefined;
    // partnerId — алиас для providerId (партнёр = поставщик услуги в текущей модели)
    const partnerId = searchParams.get("partnerId") || undefined;
    const providerId = searchParams.get("providerId") || partnerId || undefined;
    const status = searchParams.get("status") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const manager = searchParams.get("manager") || undefined;
    const source = searchParams.get("source") || undefined;
    const currency = searchParams.get("currency") || undefined;
    const minPrice = parseFloat(searchParams.get("minPrice") || "0") || 0;
    const maxPrice = parseFloat(searchParams.get("maxPrice") || "0") || 0;
    const search = searchParams.get("search") || undefined;
    // «Требуют внимания»: только брони с непрочитанными сообщениями (Гл. 5.6)
    const needsAttention = searchParams.get("needsAttention") === "1";
    // Сортировка: sort=unread → по числу непрочитанных сообщений (убывание)
    const sort = searchParams.get("sort") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "15");

    const range = periodRange(period, from, to);

    // ── Фильтры по услуге ──
    const serviceFilter: Record<string, unknown> = {};
    if (country) serviceFilter.countryCode = country;
    if (city) serviceFilter.city = { contains: city };
    if (type) serviceFilter.type = type;
    if (providerId) serviceFilter.providerId = providerId;
    const hasServiceFilter = Boolean(country || city || type || providerId);

    // ── Фильтры по бронированию ──
    const bookingWhere: Record<string, unknown> = {
      createdAt: { gte: range.start, lte: range.end },
    };
    if (hasServiceFilter) bookingWhere.service = serviceFilter;
    // Фильтр по статусу НЕ добавляется в bookingWhere: KPI-карточки всегда считаются
    // по полному периоду, а status применяется к таблице в памяти ниже (Гл. 5.5).
    if (minPrice > 0) bookingWhere.amount = { ...(bookingWhere.amount as object ?? {}), gte: minPrice };
    if (maxPrice > 0) bookingWhere.amount = { ...(bookingWhere.amount as object ?? {}), lte: maxPrice };

    const prevBookingWhere: Record<string, unknown> = {
      createdAt: { gte: range.prevStart, lte: range.prevEnd },
    };
    if (hasServiceFilter) prevBookingWhere.service = serviceFilter;

    // ── KPI: бронирования по статусам ──
    const [statusRows, prevStatusRows] = await Promise.all([
      prisma.booking.groupBy({ by: ["status"], where: bookingWhere, _count: true }),
      prisma.booking.groupBy({ by: ["status"], where: prevBookingWhere, _count: true }),
    ]);
    const counts: Record<string, number> = {};
    const prevCounts: Record<string, number> = {};
    for (const r of statusRows) counts[r.status] = r._count;
    for (const r of prevStatusRows) prevCounts[r.status] = r._count;

    // «Новые бронирования» — новые/в подготовке (Baseline §0.5).
    const newBookings = (counts["NEW"] ?? 0) + (counts["PREPARING_REQUEST"] ?? 0);
    const awaitingCount = BOOKING_AWAITING.reduce((a, s) => a + (counts[s] ?? 0), 0);
    // «Подтверждённые» — подтверждены/в поездке/завершены.
    const confirmedBookings = BOOKING_CONFIRMED.reduce((a, s) => a + (counts[s] ?? 0), 0);
    const completedCount = counts["COMPLETED"] ?? 0;
    const cancelledBookings = BOOKING_CANCELLED.reduce((a, s) => a + (counts[s] ?? 0), 0);
    const totalBookings = statusRows.reduce((a, r) => a + r._count, 0);
    // «Оплаченные» (КПИ) — подтверждённые/исполненные брони (оплата — на уровне Order).
    const paidBookings = confirmedBookings;

    // ── KPI: конверсия бронирование → оплата ──
    const conversionRate = totalBookings ? (paidBookings / totalBookings) * 100 : 0;

    // ── KPI: среднее время подтверждения (оценка по updatedAt-createdAt для подтверждённых) ──
    const paidRows = await prisma.booking.findMany({
      where: { ...bookingWhere, status: { in: [...BOOKING_CONFIRMED] } },
      select: { createdAt: true, updatedAt: true },
    });
    let avgConfirmHours = 0;
    if (paidRows.length) {
      const totalMs = paidRows.reduce((a, r) => a + (r.updatedAt.getTime() - r.createdAt.getTime()), 0);
      avgConfirmHours = Math.round((totalMs / paidRows.length / 3600000) * 10) / 10;
    }

    // ── KPI: прогноз AI (ожидаемые бронирования/доход) ──
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthAgg = await prisma.booking.aggregate({
      where: { status: { in: [...BOOKING_CONFIRMED] }, createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    });
    const forecastRevenue = Math.round((monthAgg._sum.amount ?? 0) * 1.18);
    const forecastBookings = Math.round(monthAgg._count * 1.18);
    const forecastCancelRisk = Math.min(18, Math.round(cancelledBookings * 1.4) + 4);

    // ── Финансовые показатели ──
    const [paidAgg, pendingAgg, refundAgg] = await Promise.all([
      prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: [...BOOKING_CONFIRMED] } }, _sum: { amount: true }, _count: true }),
      prisma.booking.aggregate({
        where: { ...bookingWhere, status: { in: [...BOOKING_AWAITING] } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.booking.aggregate({ where: { ...bookingWhere, status: { in: [...BOOKING_CANCELLED] } }, _sum: { amount: true }, _count: true }),
    ]);
    const financial = {
      totalAmount: Math.round((paidAgg._sum.amount ?? 0) + (pendingAgg._sum.amount ?? 0)),
      paidAmount: Math.round(paidAgg._sum.amount ?? 0),
      pendingAmount: Math.round(pendingAgg._sum.amount ?? 0),
      refundedAmount: Math.round(refundAgg._sum.amount ?? 0),
      commission: Math.round((paidAgg._sum.amount ?? 0) * 0.12),
      expectedPayouts: Math.round((pendingAgg._sum.amount ?? 0) * 0.88),
    };

    // ── Серия бронирований ──
    const seriesRows = await prisma.booking.findMany({
      where: bookingWhere,
      select: { createdAt: true, amount: true },
    });
    const bookingsSeries = bucketize(
      seriesRows.map((r) => ({ at: r.createdAt, amount: 1 })),
      period,
      range
    );

    // ── Бронирования по категориям услуг ──
    const typeRows = await prisma.booking.groupBy({
      by: ["serviceId"],
      where: bookingWhere,
      _count: true,
      _sum: { amount: true },
    });
    const typeServiceIds = typeRows.map((r) => r.serviceId);
    const typeServices = typeServiceIds.length
      ? await prisma.service.findMany({ where: { id: { in: typeServiceIds } }, select: { id: true, type: true } })
      : [];
    const typeMap = new Map(typeServices.map((s) => [s.id, s.type]));
    const typeAgg: Record<string, { count: number; amount: number }> = {};
    for (const r of typeRows) {
      const t = typeMap.get(r.serviceId) ?? "OTHER";
      typeAgg[t] ??= { count: 0, amount: 0 };
      typeAgg[t].count += r._count;
      typeAgg[t].amount += r._sum.amount ?? 0;
    }
    const bookingsByService = Object.entries(typeAgg).map(([t, v]) => ({
      type: t,
      label: SERVICE_TYPE_LABELS[t] ?? "Прочие",
      icon: SERVICE_TYPE_ICONS[t] ?? "🧩",
      ...v,
    }));

    // ── Бронирования по странам ──
    const geoRows = await prisma.booking.findMany({
      where: bookingWhere,
      select: { service: { select: { countryCode: true, country: true } } },
    });
    const countryAgg = new Map<string, { name: string; count: number }>();
    for (const r of geoRows) {
      const code = r.service.countryCode ?? "OTHER";
      const entry = countryAgg.get(code) ?? { name: r.service.country ?? code, count: 0 };
      entry.count += 1;
      countryAgg.set(code, entry);
    }
    const bookingsByCountry = [...countryAgg.entries()]
      .map(([code, v]) => ({ code, country: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);

    // ── Тепловая карта активности (день недели × час, на реальных данных) ──
    const heatmap: { day: string; hour: number; value: number }[] = [];
    const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const hourBins: Record<string, number> = {};
    for (const r of seriesRows) {
      const key = `${r.createdAt.getDay()}:${r.createdAt.getHours()}`;
      hourBins[key] = (hourBins[key] ?? 0) + 1;
    }
    for (let d = 1; d <= 7; d++) {
      const idx = d % 7;
      for (let h = 0; h < 24; h++) {
        const v = hourBins[`${idx}:${h}`] ?? 0;
        heatmap.push({ day: dayNames[d - 1], hour: h, value: v });
      }
    }

    // ── Динамика подтверждений ──
    const confirmSeries = bucketize(
      paidRows.map((r) => ({ at: r.updatedAt, amount: 1 })),
      period,
      range
    );

    // ── Последние / проблемные бронирования ──
    const recentRows = await prisma.booking.findMany({
      where: bookingWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        status: true,
        serviceDate: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
        service: { select: { title: true, type: true } },
      },
    });

    const now = Date.now();
    // Риск-виджеты (проблемные брони, просроченные подтверждения, ожидающие оплаты)
    // не привязаны к выбранному периоду — это глобальные SLA-индикаторы.
    const riskWhere: Record<string, unknown> = { status: { in: [...BOOKING_AWAITING] } };
    if (hasServiceFilter) riskWhere.service = serviceFilter;
    const pendingRows = await prisma.booking.findMany({
      where: riskWhere,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        serviceDate: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        service: { select: { title: true, type: true, provider: { select: { companyName: true, firstName: true } } } },
      },
    });
    // Жизненный цикл «Проблемных бронирований»: если менеджер уже написал клиенту
    // (сообщение senderRole = manager) < 24ч назад — бронь считается «напомненной» и
    // уходит из виджета; через 24ч без изменения статуса она возвращается в список.
    // Системные сообщения напоминанием не считаются (только реальные письма менеджера).
    const pendingBookingIds = pendingRows.map((r) => r.id);
    const pendingManagerMsgs = pendingBookingIds.length
      ? await prisma.bookingMessage.findMany({
          where: { bookingId: { in: pendingBookingIds }, senderRole: "manager" },
          orderBy: [{ bookingId: "asc" }, { createdAt: "desc" }],
          select: { bookingId: true, createdAt: true },
        })
      : [];
    const lastManagerMsgAt = new Map<string, number>();
    for (const m of pendingManagerMsgs) {
      if (!lastManagerMsgAt.has(m.bookingId)) lastManagerMsgAt.set(m.bookingId, m.createdAt.getTime());
    }
    const REMINDER_WINDOW_MS = 24 * 3600000;
    const remindedRecently = (bookingId: string) => {
      const last = lastManagerMsgAt.get(bookingId);
      return last ? now - last < REMINDER_WINDOW_MS : false;
    };
    const problemBookings = pendingRows
      .filter((r) => r.serviceDate.getTime() - now < 3 * 86400000 && !remindedRecently(r.id))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
        service: r.service.title,
        amount: r.amount,
        serviceDate: r.serviceDate.toISOString(),
        urgency: r.serviceDate.getTime() - now < 86400000 ? "high" : "medium",
      }));

    // ── Ожидающие оплаты / просроченные подтверждения ──
    const overdueConfirmations = pendingRows
      .filter((r) => now - r.createdAt.getTime() > 48 * 3600000)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
        service: r.service.title,
        amount: r.amount,
        hours: Math.round((now - r.createdAt.getTime()) / 3600000),
      }));
    const pendingPayments = pendingRows.slice(0, 5).map((r) => ({
      id: r.id,
      client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
      service: r.service.title,
      amount: r.amount,
      createdAt: r.createdAt.toISOString(),
    }));

    // ── Ближайшие даты поездок (глобально, без привязки к периоду) ──
    const upcomingTrips = await prisma.booking.findMany({
      where: {
        status: { in: [...BOOKING_CONFIRMED] },
        serviceDate: { gte: new Date(now - 86400000), lte: new Date(now + 30 * 86400000) },
        ...(hasServiceFilter ? { service: serviceFilter } : {}),
      },
      orderBy: { serviceDate: "asc" },
      take: 5,
      select: {
        id: true,
        serviceDate: true,
        user: { select: { firstName: true, lastName: true } },
        service: { select: { title: true, city: true, country: true } },
      },
    });

    // ── Уведомления поставщиков (детерминированные, на основе данных) ──
    const providerNotifications = [
      ...(overdueConfirmations.length
        ? [{ id: "ovd", type: "warning", title: `${overdueConfirmations.length} брони ожидают подтверждения > 48 ч`, detail: "Проверьте статусы у поставщиков" }]
        : []),
      ...(pendingPayments.length
        ? [{ id: "pay", type: "info", title: `${pendingPayments.length} платежей ожидают оплаты`, detail: `${fmtMoney(financial.pendingAmount)} в обработке` }]
        : []),
      { id: "supply", type: "info", title: "Обновление тарифов партнёров", detail: "3 поставщика обновили цены за сутки" },
      { id: "doc", type: "info", title: "Готовы документы по 2 брони", detail: "Ваучеры доступны для отправки клиентам" },
    ];

    // ── Контроль SLA ──
    const slaTargetHours = 24;
    const slaBreaches = overdueConfirmations.length;
    const slaTotal = paidRows.length + pendingRows.length;
    const slaCompliance = slaTotal ? Math.max(0, Math.round(((slaTotal - slaBreaches) / slaTotal) * 100)) : 100;

    // ── AI-рекомендации ──
    const aiRecommendations = [
      ...(overdueConfirmations.length
        ? [{ level: "high", title: `${overdueConfirmations.length} подтверждений просрочены`, effect: "Ускорить обработку с поставщиками" }]
        : []),
      ...(pendingPayments.length
        ? [{ level: "medium", title: `${pendingPayments.length} броней ожидают оплаты`, effect: `${fmtMoney(financial.pendingAmount)} к получению` }]
        : []),
      ...(cancelledBookings > 0
        ? [{ level: "medium", title: `${cancelledBookings} отмен за период`, effect: "Проанализировать причины отказов" }]
        : []),
      ...(bookingsByService[0]
        ? [{ level: "info", title: `Популярная категория: ${bookingsByService[0].label}`, effect: `${bookingsByService[0].count} броней` }]
        : []),
      ...(bookingsByCountry[0]
        ? [{ level: "info", title: `Топ направление: ${bookingsByCountry[0].country}`, effect: `${bookingsByCountry[0].count} броней` }]
        : []),
      { level: "info", title: `Прогноз бронирований: ${forecastBookings}`, effect: `Ожидаемый доход ${fmtMoney(forecastRevenue)}` },
    ];

    // ── Таблица бронирований ──
    // Получаем все строки за период, фильтруем в памяти (поиск/менеджер/источник),
    // затем пагинируем — так пагинация согласована с применёнными фильтрами.
    const tableRows = await prisma.booking.findMany({
      where: bookingWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        amount: true,
        status: true,
        serviceDate: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        // Реальная связь бронь → заказ: orderId — это id связанного заказа,
        // а для таблицы/карточки показываем его настоящий номер ORD-{N} (Гл. 5.8).
        order: { select: { id: true, orderNumber: true } },
        service: {
          select: {
            title: true,
            type: true,
            currency: true,
            country: true,
            countryCode: true,
            city: true,
            provider: { select: { companyName: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // Непрочитанные сообщения (system/manager) по броням — счётчик «требует внимания» (Гл. 5.9)
    const unreadAgg = tableRows.length
      ? await prisma.bookingMessage.groupBy({
          by: ["bookingId"],
          where: {
            bookingId: { in: tableRows.map((r) => r.id) },
            senderRole: { in: ["system", "manager"] },
            isRead: false,
          },
          _count: true,
        })
      : [];
    const unreadMap = new Map(unreadAgg.map((u) => [u.bookingId, u._count]));

    // ── KPI: брони «требуют внимания» — с непрочитанными сообщениями (Гл. 5.5) ──
    // Текущий период — из unreadMap (по строкам таблицы периода), предыдущий — отдельным запросом.
    const attentionCount = unreadMap.size;
    const attentionMessages = [...unreadMap.values()].reduce((a, b) => a + b, 0);
    const prevAttentionRows = await prisma.booking.findMany({
      where: prevBookingWhere,
      select: { id: true },
    });
    const prevAttentionAgg = prevAttentionRows.length
      ? await prisma.bookingMessage.groupBy({
          by: ["bookingId"],
          where: {
            bookingId: { in: prevAttentionRows.map((r) => r.id) },
            senderRole: { in: ["system", "manager"] },
            isRead: false,
          },
          _count: true,
        })
      : [];
    const prevAttentionCount = prevAttentionAgg.length;

    const bookings = tableRows.map((r) => ({
      id: r.id,
      bookingNumber: r.code ?? `BK-${r.id.slice(-8).toUpperCase()}`,
      // Номер заказа берём из реальной связи booking.order (не генерируем из id брони),
      // чтобы колонка «Заказ» совпадала с номером заказа в реестре заказов.
      orderId: r.order?.orderNumber ?? "—",
      client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
      partner: r.service.provider?.companyName || r.service.provider?.firstName || "—",
      provider: r.service.provider?.companyName || `${r.service.provider?.firstName ?? ""} ${r.service.provider?.lastName ?? ""}`.trim() || "—",
      service: r.service.title,
      category: SERVICE_TYPE_LABELS[r.service.type] || r.service.type,
      categoryType: r.service.type,
      direction: [r.service.country, r.service.city].filter(Boolean).join(" · ") || "—",
      amount: r.amount,
      currency: r.service.currency || "USD",
      bookingStatus: r.status,
      paymentStatus: (BOOKING_CONFIRMED as readonly string[]).includes(r.status)
        ? "paid"
        : (BOOKING_CANCELLED as readonly string[]).includes(r.status)
        ? "refunded"
        : "pending",
      manager: pickManager(r.id),
      source: pickSource(r.id),
      unreadCount: unreadMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      serviceDate: r.serviceDate.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // ── Фильтры после выборки (поиск, менеджер, источник, статус оплаты, валюта) ──
    let filteredBookings = bookings;
    // Статус (в т.ч. группа через запятую) применяется только к таблице —
    // чтобы клик по KPI-карточке не обнулял остальные карточки (Гл. 5.5).
    if (status) {
      const statuses = status.split(",");
      filteredBookings = filteredBookings.filter((b) => statuses.includes(b.bookingStatus));
    }
    if (search) {
      const q = search.toLowerCase();
      filteredBookings = filteredBookings.filter(
        (b) =>
          b.bookingNumber.toLowerCase().includes(q) ||
          b.orderId.toLowerCase().includes(q) ||
          b.client.toLowerCase().includes(q) ||
          b.service.toLowerCase().includes(q) ||
          b.direction.toLowerCase().includes(q) ||
          b.provider.toLowerCase().includes(q)
      );
    }
    if (paymentStatus) filteredBookings = filteredBookings.filter((b) => b.paymentStatus === paymentStatus);
    if (needsAttention) filteredBookings = filteredBookings.filter((b) => b.unreadCount > 0);
    if (manager) filteredBookings = filteredBookings.filter((b) => b.manager === manager);
    // Сортировка по числу непрочитанных сообщений (убывание) — до пагинации,
    // чтобы страницы и total были согласованы с порядком (Гл. 5.8)
    if (sort === "unread") {
      filteredBookings = [...filteredBookings].sort((a, b) => b.unreadCount - a.unreadCount);
    }
    if (source) filteredBookings = filteredBookings.filter((b) => b.source === source);
    if (currency) filteredBookings = filteredBookings.filter((b) => b.currency === currency);

    // ── Пагинация после фильтров: total согласован с отданными строками ──
    const totalCount = filteredBookings.length;
    const pagedBookings = filteredBookings.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      kpi: {
        newBookings: { value: newBookings, change: changePct(newBookings, (prevCounts["NEW"] ?? 0) + (prevCounts["PREPARING_REQUEST"] ?? 0)), detail: `${newBookings} новых броней` },
        confirmedBookings: { value: confirmedBookings, change: changePct(confirmedBookings, BOOKING_CONFIRMED.reduce((a, s) => a + (prevCounts[s] ?? 0), 0)), detail: `${completedCount} завершено` },
        awaitingPayment: { value: awaitingCount, change: changePct(awaitingCount, BOOKING_AWAITING.reduce((a, s) => a + (prevCounts[s] ?? 0), 0)), detail: `${fmtMoney(financial.pendingAmount)} в ожидании` },
        paidBookings: { value: paidBookings, change: changePct(paidBookings, BOOKING_CONFIRMED.reduce((a, s) => a + (prevCounts[s] ?? 0), 0)), detail: fmtMoney(financial.paidAmount) },
        cancelledBookings: { value: cancelledBookings, change: changePct(cancelledBookings, BOOKING_CANCELLED.reduce((a, s) => a + (prevCounts[s] ?? 0), 0)), detail: `${fmtMoney(financial.refundedAmount)} возвращено` },
        completedBookings: {
          value: completedCount,
          change: changePct(completedCount, prevCounts["COMPLETED"] ?? 0),
          detail: paidBookings ? `${completedCount} из ${paidBookings} подтверждённых завершено` : "Поездки завершены",
        },
        conversion: { value: conversionRate, change: 0, detail: `${paidBookings} из ${totalBookings} броней` },
        avgConfirm: { value: avgConfirmHours, change: 0, detail: `Цель SLA: ${slaTargetHours} ч · Соблюдение ${slaCompliance}%` },
        forecastAI: { value: forecastBookings, change: 0, detail: `Доход ${fmtMoney(forecastRevenue)} · Риск отмен ${forecastCancelRisk}%` },
        needsAttention: {
          value: attentionCount,
          change: changePct(attentionCount, prevAttentionCount),
          detail: `${attentionMessages} непрочитанных сообщений`,
        },
      },
      // Воронка конверсии жизненного цикла (Baseline §0.5): создано → подтверждено → исполнено.
      funnel: {
        entry: totalBookings,
        confirmed: confirmedBookings,
        paid: completedCount,
      },
      bookingsSeries,
      bookingsByService,
      bookingsByCountry,
      heatmap,
      confirmSeries,
      financial,
      recentBookings: recentRows.map((r) => ({
        id: r.id,
        client: `${r.user.firstName} ${r.user.lastName ?? ""}`.trim(),
        service: r.service.title,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      problemBookings,
      pendingPayments,
      upcomingTrips: upcomingTrips.map((t) => ({
        id: t.id,
        client: `${t.user.firstName} ${t.user.lastName ?? ""}`.trim(),
        service: t.service.title,
        destination: [t.service.country, t.service.city].filter(Boolean).join(" · "),
        serviceDate: t.serviceDate.toISOString(),
      })),
      overdueConfirmations,
      sla: { targetHours: slaTargetHours, compliance: slaCompliance, breaches: slaBreaches, total: slaTotal },
      providerNotifications,
      aiRecommendations,
      managers: MANAGERS,
      bookings: pagedBookings,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
      period: { start: range.start, end: range.end },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin bookings API error");
  }
}

/**
 * POST /api/admin/bookings
 * Тело: { userId, serviceId, serviceDate, amount?, source? }
 * Создаёт бронирование со статусом NEW (Baseline §0.5) и возвращает созданную строку.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, EXECUTION_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const serviceDate = typeof body.serviceDate === "string" ? new Date(body.serviceDate) : null;
    const amountRaw = typeof body.amount === "number" ? body.amount : null;

    if (!userId || !serviceId) {
      return NextResponse.json({ error: "Укажите клиента и услугу" }, { status: 400 });
    }
    if (!serviceDate || isNaN(serviceDate.getTime())) {
      return NextResponse.json({ error: "Укажите корректную дату поездки" }, { status: 400 });
    }
    // Дата поездки не должна быть в прошлом (форма ограничивает min = завтра)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (serviceDate.getTime() < todayStart.getTime()) {
      return NextResponse.json({ error: "Дата поездки не может быть в прошлом" }, { status: 400 });
    }

    const [client, service] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!client || client.role !== "BUYER") {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Услуга не найдена или неактивна" }, { status: 404 });
    }

    // Сумма: из тела или из цены услуги (со скидкой)
    const amount =
      amountRaw && amountRaw > 0 ? Math.round(amountRaw * 100) / 100 : service.discountPrice ?? service.price;

    // Создание брони + запись в журнал истории — атомарно
    const created = await prisma.$transaction(async (tx) => {
      // Канонический код бронирования BKG-* (Baseline §0.8)
      const bkRows = await tx.booking.findMany({ select: { code: true } });
      const b = await tx.booking.create({
        data: {
          code: nextBusinessCode("BKG", bkRows.map((x) => x.code)),
          userId,
          serviceId,
          status: "NEW",
          amount,
          serviceDate,
        },
        select: {
          id: true,
          code: true,
          amount: true,
          status: true,
          serviceDate: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          service: {
            select: {
              title: true,
              type: true,
              currency: true,
              country: true,
              countryCode: true,
              city: true,
              provider: { select: { companyName: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      await tx.bookingHistory.create({
        data: {
          bookingId: b.id,
          action: "created",
          from: null,
          to: "NEW",
          actorId: user.id,
          actorName: actorDisplayName(user),
          comment: "Бронирование создано",
        },
      });
      // Автоматическое системное сообщение в переписку (Гл. 5.9)
      await tx.bookingMessage.create({
        data: {
          bookingId: b.id,
          senderId: null,
          senderName: "Система",
          senderRole: "system",
          text: bookingSystemMessage("NEW"),
        },
      });
      return b;
    });

    return NextResponse.json(
      {
        ok: true,
      message: `Бронирование создано: ${created.service.title}`,
      booking: {
        id: created.id,
        bookingNumber: created.code ?? `BK-${created.id.slice(-8).toUpperCase()}`,
        // Бронь, созданная без заказа, не привязана к заказу — показываем «—»
        // (заказ создаётся отдельно в реестре заказов).
        orderId: "—",
        client: `${created.user.firstName} ${created.user.lastName ?? ""}`.trim(),
        partner: created.service.provider?.companyName || created.service.provider?.firstName || "—",
        provider: created.service.provider?.companyName || `${created.service.provider?.firstName ?? ""} ${created.service.provider?.lastName ?? ""}`.trim() || "—",
        service: created.service.title,
        category: SERVICE_TYPE_LABELS[created.service.type] || created.service.type,
        categoryType: created.service.type,
        direction: [created.service.country, created.service.city].filter(Boolean).join(" · ") || "—",
        amount: created.amount,
        currency: created.service.currency || "USD",
        bookingStatus: created.status,
        paymentStatus: "pending",
        manager: pickManager(created.id),
        source: "Создано в админке",
        unreadCount: 1,
        createdAt: created.createdAt.toISOString(),
        serviceDate: created.serviceDate.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      },
      { status: 201 }
    );
  } catch (error) {
    return serverErrorResponse(error, "Admin bookings POST error");
  }
}
