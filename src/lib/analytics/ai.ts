import {
  type AnalyticsSectionData,
  type AnalyticsFilters,
  type AiInsight,
  analyticsRange,
} from "@/lib/analytics";
import { getOverviewData } from "./overview";
import { getSalesData } from "./sales";
import { getOrdersData } from "./orders";
import { getBookingsData } from "./bookings";
import { getFinanceData } from "./finance";
import { getCrmData } from "./crm";
import { getPartnersData } from "./partners";
import { getCatalogData } from "./catalog";
import { getMarketingData } from "./marketing";
import { getDepartmentsData } from "./departments";

/**
 * 2.3, 2.6, 2.9.11 — AI Analytics как отдельный модуль BI Center.
 * Собирает AI-инсайты, ключевые KPI и «Пульс компании» со всех разделов
 * в единый аналитический дайджест, сортируя инсайты по уровню важности.
 */
export async function getAiData(f: AnalyticsFilters): Promise<AnalyticsSectionData> {
  const range = analyticsRange(f);

  // Собираем данные всех разделов параллельно — каждый раздел уже применяет
  // единую систему фильтров (2.7), поэтому дайджест уважает период/страну/услугу.
  const [overview, sales, orders, bookings, finance, crm, partners, catalog, marketing, departments] =
    await Promise.all([
      getOverviewData(f),
      getSalesData(f),
      getOrdersData(f),
      getBookingsData(f),
      getFinanceData(f),
      getCrmData(f),
      getPartnersData(f),
      getCatalogData(f),
      getMarketingData(f),
      getDepartmentsData(f),
    ]);

  const sections = [
    { key: "overview", title: "Общая аналитика", data: overview },
    { key: "sales", title: "Продажи", data: sales },
    { key: "orders", title: "Заказы", data: orders },
    { key: "bookings", title: "Бронирования", data: bookings },
    { key: "finance", title: "Финансы", data: finance },
    { key: "crm", title: "Клиенты (CRM)", data: crm },
    { key: "partners", title: "Партнёры", data: partners },
    { key: "catalog", title: "Каталог услуг", data: catalog },
    { key: "marketing", title: "Маркетинг", data: marketing },
    { key: "departments", title: "Подразделения", data: departments },
  ] as const;

  // ── Сводный AI-дайджест: инсайты всех разделов с приоритизацией ──
  const levelRank: Record<AiInsight["level"], number> = { high: 0, medium: 1, positive: 2, info: 3 };
  const allInsights: AiInsight[] = sections
    .flatMap((s) =>
      s.data.ai.map((a) => ({ ...a, detail: `${s.title} · ${a.detail}` }))
    )
    .sort((a, b) => levelRank[a.level] - levelRank[b.level]);

  // Общий вердикт AI по всем разделам
  const highCount = allInsights.filter((i) => i.level === "high").length;
  const mediumCount = allInsights.filter((i) => i.level === "medium").length;
  const verdict: AiInsight =
    highCount > 0
      ? { level: "high", title: `Требуется внимание: ${highCount} критических сигнала`, detail: "Есть проблемы в разделах — начните с инсайтов уровня «критично»" }
      : mediumCount > 2
        ? { level: "medium", title: `Средний уровень рисков: ${mediumCount} предупреждения`, detail: "Отслеживайте тренды в отмеченных разделах" }
        : { level: "positive", title: "Бизнес стабилен", detail: "Критических сигналов нет — динамика в норме" };

  // ── Ключевые KPI по всем разделам (таблица для сравнения) ──
  const kpiRows = sections.map((s) => {
    const first = s.data.kpis[0];
    const second = s.data.kpis[1];
    return {
      section: s.title,
      kpi1: first?.title ?? "—",
      v1: Math.round(first?.value ?? 0),
      kpi2: second?.title ?? "—",
      v2: Math.round(second?.value ?? 0),
    };
  });

  // ── Пульс компании: события за 24 часа из «Общей аналитики» ──
  const pulse = (overview.pulse ?? []).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 12);

  // Сводная серия выручки (из «Общей аналитики»)
  const revenueSeries = overview.series.find((s) => s.key === "revenue");

  // Сводные KPI из «Общей аналитики»
  const revKpi = overview.kpis.find((k) => k.key === "revenue");
  const convKpi = overview.kpis.find((k) => k.key === "conversion");
  const refundKpi = overview.kpis.find((k) => k.key === "refunds");

  // ── Инсайты по партнёрам/финансам для дайджеста ──
  const topPartner = partners.barLists[0];

  return {
    section: "ai" as const,
    title: "AI Analytics",
    subtitle: "Сводный AI-дайджест по всем разделам бизнеса (Гл. 2.3, 2.9.11)",
    periodLabel: range.start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
    kpis: [
      { key: "revenue", title: "Выручка (все разделы)", value: revKpi?.value ?? 0, change: revKpi?.change, spark: revKpi?.spark, tone: (revKpi?.change ?? 0) >= 0 ? "positive" : "negative" },
      { key: "conversion", title: "Конверсия бронь → оплата", value: convKpi?.value ?? 0, unit: "%", tone: (convKpi?.value ?? 0) >= 40 ? "positive" : "negative" },
      { key: "refunds", title: "Возвраты", value: refundKpi?.value ?? 0, change: refundKpi?.change, tone: (refundKpi?.change ?? 0) > 0 ? "negative" : "positive" },
      { key: "sections", title: "Разделов в дайджесте", value: sections.length, unit: " шт", tone: "neutral", detail: "10 модулей BI Center" },
    ],
    pulse,
    funnels: [],
    series: revenueSeries ? [revenueSeries] : [],
    donuts: [],
    barLists: [
      topPartner && {
        key: "top-partner",
        title: "Лучший партнёр периода",
        icon: "🤝",
        rows: topPartner.rows.slice(0, 6),
      },
      {
        key: "ai-focus",
        title: "Фокус AI-анализа",
        icon: "🤖",
        rows: sections
          .map((s, i) => ({ label: s.title, value: Math.max(1, 100 - i * 8 - (s.data.ai[0]?.level === "high" ? 5 : 0)) }))
          .slice(0, 10),
        maxValue: 100,
      },
    ].filter(Boolean) as { key: string; title: string; icon: string; rows: { label: string; value: number; sub?: string }[] }[],
    tables: [
      {
        key: "kpi-summary",
        title: "KPI по разделам (сводная таблица)",
        icon: "📊",
        columns: [
          { key: "section", label: "Раздел" },
          { key: "kpi1", label: "Показатель 1" },
          { key: "v1", label: "Значение", align: "right" },
          { key: "kpi2", label: "Показатель 2" },
          { key: "v2", label: "Значение", align: "right" },
        ],
        rows: kpiRows,
      },
    ],
    ai: [verdict, ...allInsights],
  };
}
