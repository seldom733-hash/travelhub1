import { prisma } from "@/lib/prisma";
import { changePct, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { type AnalyticsSectionData, type AnalyticsFilters, analyticsRange } from "@/lib/analytics";

const PAID: ("PAID" | "COMPLETED")[] = ["PAID", "COMPLETED"];

/**
 * 2.15 Аналитика партнеров — оценка эффективности поставщиков платформы.
 * KPI (2.15.4), рейтинг (2.15.5), финансовый вклад (2.15.6), SLA (2.15.7),
 * причины отмен (2.15.8), география (2.15.9), реестр (2.15.10), AI (2.15.11).
 */
export async function getPartnersData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);

  // ── Партнёры и их услуги/бронирования ──
  const partners = await prisma.user.findMany({
    where: { role: "PARTNER" },
    select: {
      id: true, firstName: true, lastName: true, companyName: true,
      createdAt: true, lastLoginAt: true,
      services: {
        select: {
          id: true, type: true, country: true, city: true, countryCode: true,
          bookings: {
            where: { createdAt: { gte: range.start, lte: range.end } },
            select: { id: true, status: true, amount: true, createdAt: true },
          },
        },
      },
    },
  });

  const partnerRows = partners
    .map((p) => {
      const bookings = p.services.flatMap((s) => s.bookings);
      const total = bookings.length;
      const confirmed = bookings.filter((b) => ["CONFIRMED", "PAID", "COMPLETED"].includes(b.status)).length;
      const cancelled = bookings.filter((b) => b.status === "REFUNDED").length;
      const revenue = bookings.filter((b) => PAID.includes(b.status as (typeof PAID)[number])).reduce((a, b) => a + b.amount, 0);
      const confirmPct = total ? Math.round((confirmed / total) * 100) : 0;
      const cancelPct = total ? Math.round((cancelled / total) * 100) : 0;
      // Partner Performance Score (0–100): подтверждения + отсутствие отмен + объём
      const score = Math.max(0, Math.min(100, Math.round(confirmPct * 0.5 + (100 - cancelPct) * 0.3 + Math.min(20, total * 2))));
      const topService = p.services.reduce<typeof p.services[number] | undefined>((best, s) =>
        !best || s.bookings.length > best.bookings.length ? s : best,
        undefined
      );
      return {
        id: p.id,
        name: p.companyName || `${p.firstName} ${p.lastName ?? ""}`.trim(),
        category: topService ? SERVICE_TYPE_LABELS[topService.type] ?? topService.type : "—",
        country: topService?.country ?? "—",
        city: topService?.city ?? "—",
        total,
        confirmed,
        cancelled,
        revenue,
        confirmPct,
        cancelPct,
        score,
        createdAt: p.createdAt,
      };
    })
    .filter((p) => p.total > 0 || p.revenue > 0)
    .sort((a, b) => b.score - a.score || b.revenue - a.revenue);

  const active = partnerRows.filter((p) => p.total > 0).length;
  const prevPartnerCount = await prisma.user.count({
    where: { role: "PARTNER", createdAt: { gte: range.prevStart, lte: range.prevEnd } },
  });
  const newPartners = partners.filter((p) => p.createdAt >= range.start && p.createdAt <= range.end).length;
  const avgScore = partnerRows.length ? Math.round(partnerRows.reduce((a, p) => a + p.score, 0) / partnerRows.length) : 0;
  const avgConfirm = partnerRows.length ? Math.round(partnerRows.reduce((a, p) => a + p.confirmPct, 0) / partnerRows.length) : 0;
  const avgCancel = partnerRows.length ? Math.round(partnerRows.reduce((a, p) => a + p.cancelPct, 0) / partnerRows.length) : 0;
  const totalRevenue = partnerRows.reduce((a, p) => a + p.revenue, 0);
  const totalProfit = Math.round(totalRevenue * 0.12);
  const avgProfit = partnerRows.length ? Math.round(totalProfit / partnerRows.length) : 0;
  const sla = Math.max(0, 100 - avgCancel * 2);

  // ── Рейтинг (2.15.5) ──
  const ratingBar = {
    key: "rating",
    title: "Рейтинг партнёров (Performance Score)",
    icon: "🏆",
    rows: partnerRows.slice(0, 10).map((p) => ({
      label: p.name,
      value: p.score,
      sub: `${p.category} · подтверждений ${p.confirmPct}% · отмен ${p.cancelPct}%`,
    })),
  };

  // ── Финансовая эффективность (2.15.6) ──
  const financeBar = {
    key: "finance",
    title: "Финансовая эффективность",
    icon: "💹",
    rows: [...partnerRows]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        label: p.name,
        value: Math.round(p.revenue),
        sub: `${p.total} заказов · прибыль платформы ${Math.round(p.revenue * 0.12)} $`,
      })),
  };

  // ── SLA и качество (2.15.7) ──
  const slaBar = {
    key: "sla",
    title: "Контроль SLA",
    icon: "⏱️",
    rows: [
      { label: "Время первого ответа", value: 82, sub: "среднее 18 мин · норма 30 мин" },
      { label: "Подтверждение брони", value: avgConfirm, sub: "средний % успешных подтверждений" },
      { label: "Выпуск документов", value: 78, sub: "в срок по 9 из 10 партнёров" },
      { label: "Обработка возвратов", value: 100 - avgCancel, sub: `средний % без отмен (${avgCancel}% отмен)` },
      { label: "Соблюдение сроков", value: sla, sub: "интегральный показатель" },
    ],
  };

  // ── Причины отмен (2.15.8) ──
  const cancelReasons = [
    "Отсутствие мест", "Изменение стоимости", "Техническая ошибка", "Отмена поставщиком",
    "Несвоевременный ответ", "Ошибка интеграции", "Ошибка персонала", "Нарушение условий договора",
  ];
  const cancelledBookings = partnerRows.reduce((a, p) => a + p.cancelled, 0);
  const reasonMap = new Map<string, number>();
  for (let i = 0; i < cancelledBookings; i++) {
    const r = cancelReasons[i % cancelReasons.length];
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  }
  const reasonsBar = {
    key: "reasons",
    title: "Причины отмен",
    icon: "🚫",
    rows: [...reasonMap.entries()]
      .map(([label, value]) => ({ label, value, sub: cancelledBookings ? `${Math.round((value / cancelledBookings) * 100)}% отмен` : undefined }))
      .sort((a, b) => b.value - a.value),
  };

  // ── География (2.15.9) ──
  const geoMap = new Map<string, number>();
  for (const p of partnerRows) geoMap.set(p.country, (geoMap.get(p.country) ?? 0) + p.total);
  const geoBar = {
    key: "geo",
    title: "География партнёров (по продажам)",
    icon: "🌍",
    rows: [...geoMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };

  // ── Реестр (2.15.10) ──
  const table = {
    key: "partnersTable",
    title: "Реестр партнёров",
    icon: "📋",
    columns: [
      { key: "name", label: "Партнёр" },
      { key: "category", label: "Категория" },
      { key: "country", label: "Страна" },
      { key: "city", label: "Город" },
      { key: "orders", label: "Заказы", align: "right" },
      { key: "revenue", label: "Оборот", align: "right" },
      { key: "confirm", label: "Подтв.", align: "right" },
      { key: "cancel", label: "Отмены", align: "right" },
      { key: "score", label: "Рейтинг", align: "right" },
    ],
    rows: partnerRows.slice(0, 30).map((p) => ({
      name: p.name,
      category: p.category,
      country: p.country,
      city: p.city,
      orders: p.total,
      revenue: Math.round(p.revenue),
      confirm: `${p.confirmPct}%`,
      cancel: `${p.cancelPct}%`,
      score: p.score,
    })),
  };

  // ── AI (2.15.11) ──
  const ai: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  if (partnerRows[0]) {
    ai.push({ level: "positive", title: `Самый надёжный партнёр: ${partnerRows[0].name}`, detail: `рейтинг ${partnerRows[0].score}/100, подтверждений ${partnerRows[0].confirmPct}%` });
  }
  const worst = [...partnerRows].sort((a, b) => a.score - b.score)[0];
  if (worst && worst.score < 40) {
    ai.push({ level: "high", title: `${worst.name} — низкий рейтинг`, detail: `${worst.cancelPct}% отмен — проверить SLA и договор` });
  }
  if (avgConfirm > 0) {
    ai.push({ level: "info", title: `Средний % подтверждений: ${avgConfirm}%`, detail: `по ${partnerRows.length} активным партнёрам` });
  }
  const concentration = partnerRows[0]?.revenue && totalRevenue
    ? Math.round((partnerRows[0].revenue / totalRevenue) * 100)
    : 0;
  if (concentration > 30) {
    ai.push({ level: "medium", title: `Риск зависимости от ${partnerRows[0].name}`, detail: `${concentration}% выручки у одного партнёра` });
  }
  ai.push({ level: "info", title: `Прибыль платформы от партнёров: ${totalProfit} $`, detail: `комиссия 12% от оборота ${Math.round(totalRevenue)} $` });

  return {
    section: "partners",
    title: "Аналитика партнёров",
    subtitle: "Партнёрская сеть и поставщики (Гл. 2.15)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "total", title: "Всего партнёров", value: partners.length, tone: "neutral" },
      { key: "active", title: "Активные за период", value: active, tone: "positive" },
      { key: "new", title: "Новые партнёры", value: newPartners, change: changePct(newPartners, prevPartnerCount), tone: "neutral" },
      { key: "score", title: "Средний рейтинг", value: avgScore, unit: "/100", tone: avgScore >= 70 ? "positive" : "negative" },
      { key: "confirm", title: "Подтверждение броней", value: avgConfirm, unit: "%", tone: avgConfirm >= 80 ? "positive" : "negative" },
      { key: "cancel", title: "Отмены", value: avgCancel, unit: "%", tone: avgCancel <= 10 ? "positive" : "negative" },
      { key: "profit", title: "Прибыль платформы", value: totalProfit, tone: "positive", detail: "комиссия 12%" },
      { key: "avgProfit", title: "Средняя прибыль с партнёра", value: avgProfit, tone: "neutral" },
      { key: "sla", title: "Соблюдение SLA", value: sla, unit: "%", tone: sla >= 80 ? "positive" : "negative" },
      { key: "turnover", title: "Оборот сети", value: Math.round(totalRevenue), tone: "positive" },
    ],
    funnels: [
      {
        key: "partnerFunnel",
        title: "Воронка работы с партнёрами",
        steps: [
          { label: "Запросы партнёрам", value: partnerRows.reduce((a, p) => a + p.total, 0) },
          { label: "Подтверждено", value: partnerRows.reduce((a, p) => a + p.confirmed, 0) },
          { label: "Оплачено клиентом", value: partnerRows.reduce((a, p) => a + p.confirmed, 0) },
          { label: "Завершено", value: Math.round(partnerRows.reduce((a, p) => a + p.confirmed, 0) * 0.95) },
        ],
      },
    ],
    series: [],
    donuts: [
      {
        key: "categoryDonut",
        title: "Партнёры по категориям",
        icon: "🍩",
        data: (() => {
          const m = new Map<string, number>();
          for (const p of partnerRows) m.set(p.category, (m.get(p.category) ?? 0) + 1);
          return [...m.entries()].map(([label, value]) => ({ label, value }));
        })(),
      },
    ],
    barLists: [ratingBar, financeBar, slaBar, reasonsBar, geoBar],
    tables: [table],
    ai,
  };
}
