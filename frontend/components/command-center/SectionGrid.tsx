"use client";

import { type CommandCenterSummary, type DashboardSection, type PeriodPreset } from "@/lib/dashboard-api";
import { type EffectiveLayout, type WidgetPosition, type WidgetDefinition } from "@/lib/workspace-api";
import { t, type Locale } from "@/lib/i18n";
import { KpiCard } from "./KpiCard";
import { TrendWidget } from "./TrendWidget";
import { OperationalSection } from "./OperationalSection";
import { FinancialSection } from "./FinancialSection";

interface Props {
  summary: CommandCenterSummary | null;
  authorizedSections: DashboardSection[];
  loading: boolean;
  layout: EffectiveLayout | null;
  editing: boolean;
  draft: WidgetPosition[] | null;
  availableMetrics: string[];
  periodPreset: PeriodPreset;
  customStart?: string;
  customEnd?: string;
  comparison: boolean;
  allWidgetDefs: WidgetDefinition[];
  locale?: Locale;
}

/** Check if a widget ID is visible in the given positions. */
function isWidgetVisible(positions: WidgetPosition[], widgetId: string): boolean {
  const pos = positions.find((wp) => wp.widgetId === widgetId);
  return pos?.visible === true;
}

/** Check if a section has at least one visible widget from its widget set. */
function sectionHasVisibleWidgets(
  positions: WidgetPosition[],
  sectionWidgetIds: string[],
): boolean {
  return sectionWidgetIds.some((id) => isWidgetVisible(positions, id));
}

const SECTION_META: Record<DashboardSection, { titleKey: string; icon: string; widgetIds: string[] }> = {
  executive: {
    titleKey: "cc.section.executive",
    icon: "📈",
    widgetIds: ["gmv", "revenue", "net-revenue", "orders", "bookings", "aov", "conversion", "orders-trend", "bookings-trend", "revenue-trend"],
  },
  operational: {
    titleKey: "cc.section.operational",
    icon: "⚙️",
    widgetIds: ["funnel"],
  },
  financial: {
    titleKey: "cc.section.financial",
    icon: "💰",
    widgetIds: ["commission", "payments", "net-payments", "reconciliation"],
  },
  marketplace: {
    titleKey: "cc.section.marketplace",
    icon: "🏪",
    widgetIds: ["sessions", "storefront-sessions", "partners", "customers"],
  },
};

export function SectionGrid({
  summary,
  authorizedSections,
  loading,
  layout,
  editing,
  draft,
  availableMetrics,
  periodPreset,
  customStart,
  customEnd,
  comparison,
  allWidgetDefs,
  locale = "ru",
}: Props) {
  if (loading && !summary) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  // Use draft when editing, otherwise use persisted layout
  const activePositions = (editing && draft) ? draft : (layout?.widgets ?? []);

  // Section is shown if:
  // 1. Server authorized it (availableSections)
  // 2. Summary has section data
  // 3. At least one widget in the section is visible
  const hasSection = (section: DashboardSection) =>
    authorizedSections.includes(section) &&
    summary.sections[section] !== undefined &&
    sectionHasVisibleWidgets(activePositions, SECTION_META[section].widgetIds);

  // Widget definitions for lookup
  const getDef = (widgetId: string) => allWidgetDefs.find((d) => d.widgetId === widgetId);

  return (
    <div className="mt-8 space-y-8">
      {/* Executive Section */}
      {hasSection("executive") && summary.sections.executive && (
        <section aria-labelledby="section-executive">
          <h2 id="section-executive" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.executive.icon} {t(SECTION_META.executive.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isWidgetVisible(activePositions, "gmv") && (
              <KpiCard title={t("cc.kpi.gmv", locale)} value={summary.sections.executive.gmv} format="currency" />
            )}
            {isWidgetVisible(activePositions, "revenue") && (
              <KpiCard title={t("cc.kpi.revenue", locale)} value={summary.sections.executive.revenue} format="currency" />
            )}
            {isWidgetVisible(activePositions, "net-revenue") && (
              <KpiCard title={t("cc.kpi.netRevenue", locale)} value={summary.sections.executive.netRevenue} format="currency" />
            )}
            {isWidgetVisible(activePositions, "orders") && (
              <KpiCard title={t("cc.kpi.orders", locale)} value={summary.sections.executive.ordersCreated} />
            )}
            {isWidgetVisible(activePositions, "bookings") && (
              <KpiCard title={t("cc.kpi.bookings", locale)} value={summary.sections.executive.bookingsRequested} />
            )}
            {isWidgetVisible(activePositions, "aov") && (
              <KpiCard title={t("cc.kpi.aov", locale)} value={summary.sections.executive.averageOrderValue} format="currency" />
            )}
            {isWidgetVisible(activePositions, "conversion") && (
              <KpiCard title={t("cc.kpi.conversion", locale)} value={summary.sections.executive.conversionRate} format="percent" />
            )}
          </div>
          {/* Executive trends — only registered trend widgets, using server metrics */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {isWidgetVisible(activePositions, "orders-trend") && (
              <TrendWidget
                metric="orders"
                title={t("cc.trend.orders", locale)}
                section="executive"
                periodPreset={periodPreset}
                customStart={customStart}
                customEnd={customEnd}
                availableMetrics={availableMetrics}
                locale={locale}
              />
            )}
            {isWidgetVisible(activePositions, "bookings-trend") && (
              <TrendWidget
                metric="bookings"
                title={t("cc.trend.bookings", locale)}
                section="executive"
                periodPreset={periodPreset}
                customStart={customStart}
                customEnd={customEnd}
                availableMetrics={availableMetrics}
                locale={locale}
              />
            )}
            {isWidgetVisible(activePositions, "revenue-trend") && (
              <TrendWidget
                metric="revenue"
                title="Revenue Trend"
                section="executive"
                unsupported
                periodPreset={periodPreset}
                availableMetrics={availableMetrics}
                locale={locale}
              />
            )}
          </div>
        </section>
      )}

      {/* Operational Section */}
      {hasSection("operational") && summary.sections.operational && (
        <OperationalSection
          data={summary.sections.operational}
          positions={activePositions}
          editing={editing}
          locale={locale}
        />
      )}

      {/* Financial Section */}
      {hasSection("financial") && summary.sections.financial && (
        <FinancialSection
          data={summary.sections.financial}
          positions={activePositions}
          editing={editing}
          locale={locale}
        />
      )}

      {/* Marketplace Section */}
      {hasSection("marketplace") && summary.sections.marketplace && (
        <section aria-labelledby="section-marketplace">
          <h2 id="section-marketplace" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.marketplace.icon} {t(SECTION_META.marketplace.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isWidgetVisible(activePositions, "sessions") && (
              <KpiCard title={t("cc.kpi.sessions", locale)} value={summary.sections.marketplace.marketplaceSessions} />
            )}
            {isWidgetVisible(activePositions, "storefront-sessions") && (
              <KpiCard title={t("cc.kpi.storefrontSessions", locale)} value={summary.sections.marketplace.storefrontSessions} />
            )}
            {isWidgetVisible(activePositions, "partners") && (
              <KpiCard title={t("cc.kpi.partners", locale)} value={summary.sections.marketplace.activePartners} />
            )}
            {isWidgetVisible(activePositions, "customers") && (
              <KpiCard title={t("cc.kpi.customers", locale)} value={summary.sections.marketplace.newCustomers} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
