"use client";

import { type CommandCenterSummary, type DashboardSection, type PeriodPreset, SUPPORTED_TREND_METRICS } from "@/lib/dashboard-api";
import { type WidgetDefinition, type WidgetPosition } from "@/lib/workspace-api";
import { t, type Locale } from "@/lib/i18n";
import { KpiCard } from "./KpiCard";
import { TrendWidget } from "./TrendWidget";
import { OperationalSection } from "./OperationalSection";
import { FinancialSection } from "./FinancialSection";

/** KPI field mapping: widgetId → section + field name + format. */
const WIDGET_MAP: Record<string, { section: DashboardSection; field: string; format?: "currency" | "percent" | "number" }> = {
  "gmv":              { section: "executive", field: "gmv", format: "currency" },
  "revenue":          { section: "executive", field: "revenue", format: "currency" },
  "net-revenue":      { section: "executive", field: "netRevenue", format: "currency" },
  "orders":           { section: "executive", field: "ordersCreated" },
  "bookings":         { section: "executive", field: "bookingsRequested" },
  "aov":              { section: "executive", field: "averageOrderValue", format: "currency" },
  "conversion":       { section: "executive", field: "conversionRate", format: "percent" },
  "funnel":           { section: "operational", field: "funnel" },
  "commission":       { section: "financial", field: "commissionAccrued", format: "currency" },
  "payments":         { section: "financial", field: "totalPayments", format: "currency" },
  "net-payments":     { section: "financial", field: "netPayments", format: "currency" },
  "reconciliation":   { section: "financial", field: "reconciliationStatus" },
  "sessions":         { section: "marketplace", field: "marketplaceSessions" },
  "storefront-sessions": { section: "marketplace", field: "storefrontSessions" },
  "partners":         { section: "marketplace", field: "activePartners" },
  "customers":        { section: "marketplace", field: "newCustomers" },
};

/** Trend widgets: widgetId → metric. */
const TREND_WIDGETS: Record<string, string> = {
  "orders-trend": "orders",
  "bookings-trend": "bookings",
  // revenue-trend is registered but unsupported — handled specially
};

/** IDs that are NOT rendered as cards (composite/trend/special). */
const NON_CARD_IDS = new Set(["funnel", "orders-trend", "bookings-trend", "revenue-trend"]);

const SECTION_META: Record<DashboardSection, { titleKey: string; icon: string }> = {
  executive: { titleKey: "cc.section.executive", icon: "📈" },
  operational: { titleKey: "cc.section.operational", icon: "⚙️" },
  financial: { titleKey: "cc.section.financial", icon: "💰" },
  marketplace: { titleKey: "cc.section.marketplace", icon: "🏪" },
};

interface Props {
  summary: CommandCenterSummary | null;
  authorizedSections: DashboardSection[];
  loading: boolean;
  positions: WidgetPosition[];
  allWidgetDefs: WidgetDefinition[];
  availableMetrics: string[];
  periodPreset: PeriodPreset;
  customStart?: string;
  customEnd?: string;
  comparison: boolean;
  locale?: Locale;
}

export function SectionGrid({
  summary, authorizedSections, loading, positions,
  allWidgetDefs, availableMetrics, periodPreset, customStart, customEnd, locale = "ru",
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

  // R2-05: Sort positions by y then x to determine render order
  const sortedPositions = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);

  // Filter to visible only
  const visiblePositions = sortedPositions.filter((wp) => wp.visible);

  // Group visible positions by section
  const sectionPositions: Record<DashboardSection, WidgetPosition[]> = {
    executive: [], operational: [], financial: [], marketplace: [],
  };
  for (const wp of visiblePositions) {
    const mapping = WIDGET_MAP[wp.widgetId];
    if (mapping) sectionPositions[mapping.section].push(wp);
  }

  const hasSection = (section: DashboardSection) =>
    authorizedSections.includes(section) &&
    summary.sections[section] !== undefined &&
    sectionPositions[section].length > 0;

  return (
    <div className="mt-8 space-y-8">
      {/* Executive Section — cards in positions order */}
      {hasSection("executive") && summary.sections.executive && (
        <section aria-labelledby="section-executive">
          <h2 id="section-executive" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.executive.icon} {t(SECTION_META.executive.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sectionPositions.executive
              .filter((wp) => !NON_CARD_IDS.has(wp.widgetId))
              .map((wp) => {
                const mapping = WIDGET_MAP[wp.widgetId];
                if (!mapping) return null;
                const val = (summary.sections.executive as Record<string, unknown>)?.[mapping.field];
                if (!val || typeof val !== "object") return null;
                return (
                  <KpiCard
                    key={wp.widgetId}
                    title={t(`cc.kpi.${wp.widgetId}`, locale) || wp.widgetId}
                    value={val as import("@/lib/dashboard-api").KpiValue}
                    format={mapping.format as "currency" | "percent" | undefined}
                  />
                );
              })}
          </div>
          {/* Trends — in positions order */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {sectionPositions.executive
              .filter((wp) => wp.widgetId in TREND_WIDGETS)
              .map((wp) => (
                <TrendWidget
                  key={wp.widgetId}
                  metric={TREND_WIDGETS[wp.widgetId]}
                  title={t(`cc.trend.${TREND_WIDGETS[wp.widgetId]}`, locale) || wp.widgetId}
                  section="executive"
                  periodPreset={periodPreset}
                  customStart={customStart}
                  customEnd={customEnd}
                  availableMetrics={availableMetrics}
                  locale={locale}
                />
              ))}
            {/* revenue-trend: suppressed (R2-12) — only shown if position exists and metric unsupported */}
            {sectionPositions.executive.some((wp) => wp.widgetId === "revenue-trend") && (
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
          positions={sectionPositions.operational}
          locale={locale}
        />
      )}

      {/* Financial Section */}
      {hasSection("financial") && summary.sections.financial && (
        <FinancialSection
          data={summary.sections.financial}
          positions={sectionPositions.financial}
          locale={locale}
        />
      )}

      {/* Marketplace Section — cards in positions order */}
      {hasSection("marketplace") && summary.sections.marketplace && (
        <section aria-labelledby="section-marketplace">
          <h2 id="section-marketplace" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.marketplace.icon} {t(SECTION_META.marketplace.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sectionPositions.marketplace
              .filter((wp) => !NON_CARD_IDS.has(wp.widgetId))
              .map((wp) => {
                const mapping = WIDGET_MAP[wp.widgetId];
                if (!mapping) return null;
                const val = (summary.sections.marketplace as Record<string, unknown>)?.[mapping.field];
                if (!val || typeof val !== "object") return null;
                return (
                  <KpiCard
                    key={wp.widgetId}
                    title={t(`cc.kpi.${wp.widgetId}`, locale) || wp.widgetId}
                    value={val as import("@/lib/dashboard-api").KpiValue}
                    format={mapping.format as "currency" | "percent" | undefined}
                  />
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
