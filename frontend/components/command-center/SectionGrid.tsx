"use client";

import { type CommandCenterSummary, type DashboardSection, type PeriodPreset, SUPPORTED_TREND_METRICS } from "@/lib/dashboard-api";
import { type WidgetDefinition, type WidgetPosition } from "@/lib/workspace-api";
import { t, type Locale } from "@/lib/i18n";
import { KpiCard } from "./KpiCard";
import { TrendWidget } from "./TrendWidget";
import { DecisionQueue } from "./DecisionQueue";

/** Interpolate {param} placeholders in a localized template string */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

/** KPI field mapping: widgetId → section + field name + format. */
const WIDGET_MAP: Record<string, { section: DashboardSection; field: string; format?: "currency" | "percent" | "number" }> = {
  // ─── Executive ──────────────────────────────────────────────────
  "gmv":              { section: "executive", field: "qualifiedGmv", format: "currency" },
  "collected-gmv":    { section: "executive", field: "collectedGmv", format: "currency" },
  "outstanding":      { section: "executive", field: "outstandingGmv", format: "currency" },
  "completed-gmv":    { section: "executive", field: "completedGmv", format: "currency" },
  "revenue":          { section: "executive", field: "revenue", format: "currency" },
  "refunds":          { section: "financial", field: "totalRefunds", format: "currency" },
  "orders":           { section: "executive", field: "ordersCreated" },
  "bookings":         { section: "executive", field: "bookingsRequested" },
  "aov":              { section: "executive", field: "averageOrderValue", format: "currency" },
  "conversion":       { section: "executive", field: "conversionRate", format: "percent" },
  // ─── Operational (individual KPI cards) ─────────────────────────
  "orders-fulfilled":      { section: "operational", field: "ordersFulfilled" },
  "bookings-confirmed":    { section: "operational", field: "bookingsConfirmed" },
  "bookings-completed":    { section: "operational", field: "bookingsCompleted" },
  "payments-captured":     { section: "operational", field: "paymentsCaptured" },
  "refunds-processed":     { section: "operational", field: "refundsProcessed" },
  "funnel":                { section: "operational", field: "funnelConversion", format: "percent" },
  // ─── Financial ──────────────────────────────────────────────────
  "commission":       { section: "financial", field: "commissionAccrued", format: "currency" },
  "payments":         { section: "financial", field: "totalPayments", format: "currency" },
  "net-payments":     { section: "financial", field: "netPayments", format: "currency" },
  "reconciliation":   { section: "financial", field: "reconciliationStatus" },
  "total-refunds":    { section: "financial", field: "totalRefunds", format: "currency" },
  // backward-compat: old 'net-revenue' alias → net payments
  "net-revenue":       { section: "financial", field: "netPayments", format: "currency" },
  // ─── Marketplace ────────────────────────────────────────────────
  "sessions":         { section: "marketplace", field: "marketplaceSessions" },
  "storefront-sessions": { section: "marketplace", field: "storefrontSessions" },
  "marketplace-partners": { section: "marketplace", field: "marketplacePartners" },
  "storefront-partners":  { section: "marketplace", field: "storefrontPartners" },
  "marketplace-customers": { section: "marketplace", field: "marketplaceCustomers" },
  "storefront-customers":  { section: "marketplace", field: "storefrontCustomers" },
  // Stage I: Storefront SaaS billing metrics
  "storefront-mrr":        { section: "marketplace", field: "storefrontMrr", format: "currency" },
  "storefront-arr":        { section: "marketplace", field: "storefrontArr", format: "currency" },
  "storefront-collected":  { section: "marketplace", field: "storefrontCollected", format: "currency" },
  "storefront-outstanding": { section: "marketplace", field: "storefrontOutstanding", format: "currency" },
  // backward-compat: old layout IDs → map to first split field
  "partners":        { section: "marketplace", field: "marketplacePartners" },
  "customers":       { section: "marketplace", field: "marketplaceCustomers" },
};

/** Trend widgets: widgetId → metric. */
const TREND_WIDGETS: Record<string, string> = {
  "orders-trend": "orders",
  "bookings-trend": "bookings",
};

/** IDs rendered as trend charts (not KPI cards). */
const CHART_IDS = new Set(["orders-trend", "bookings-trend", "revenue-trend"]);

/** IDs for KPI cards — NOT rendered as cards. */
const NON_KPI_IDS = new Set(["revenue-trend"]);

const SECTION_META: Record<string, { titleKey: string; icon: string }> = {
  executive: { titleKey: "cc.section.executive", icon: "📈" },
  operational: { titleKey: "cc.section.operational", icon: "⚙️" },
  financial: { titleKey: "cc.section.financial", icon: "💰" },
  marketplace: { titleKey: "cc.section.marketplace", icon: "🏪" },
  catalog: { titleKey: "cc.section.catalog", icon: "📦" },
  channels: { titleKey: "cc.section.channels", icon: "🔀" },
  attention: { titleKey: "cc.section.attention", icon: "⚠️" },
  insights: { titleKey: "cc.section.insights", icon: "🤖" },
};

/** Reconciliation badge for special KPI rendering. */
function ReconciliationBadge({ status, locale = "ru" }: { status: number | null; locale?: Locale }) {
  if (status === null || status === undefined) return <span className="text-sm text-slate-400">—</span>;
  if (status === 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{t("cc.recon.balanced", locale)}</span>
  );
  if (status > 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{t("cc.recon.discrepancy", locale)}: {status}</span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{t("cc.recon.critical", locale)}</span>
  );
}

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

  // Sort positions by y then x to determine render order
  const sortedPositions = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);

  // Filter to visible only
  const visiblePositions = sortedPositions.filter((wp) => wp.visible);

  // Group visible positions by section
  const sectionPositions: Record<DashboardSection, WidgetPosition[]> = {
    executive: [], operational: [], financial: [], marketplace: [],
    catalog: [], channels: [], attention: [], insights: [],
  };
  for (const wp of visiblePositions) {
    const mapping = WIDGET_MAP[wp.widgetId];
    if (mapping) sectionPositions[mapping.section].push(wp);
  }

  const V3_SECTIONS = new Set<DashboardSection>(["catalog", "channels", "attention", "insights"]);

  const hasSection = (section: DashboardSection) =>
    authorizedSections.includes(section) &&
    summary.sections[section] !== undefined &&
    (V3_SECTIONS.has(section) || sectionPositions[section].length > 0);

  /** Render KPI cards for a section, in position order. */
  function renderKpiCards(
    section: DashboardSection,
    sectionData: Record<string, { current: number | string | null; previous: number | string | null; delta: number | string | null; deltaPercent: number | null }>,
    format?: "currency" | "percent" | "number",
  ) {
    return sectionPositions[section]
      .filter((wp) => !CHART_IDS.has(wp.widgetId) && !NON_KPI_IDS.has(wp.widgetId))
      .map((wp) => {
        const mapping = WIDGET_MAP[wp.widgetId];
        if (!mapping) return null;
        const val = sectionData[mapping.field];
        if (!val || typeof val !== "object") return null;
        // Special rendering for reconciliation
        if (wp.widgetId === "reconciliation") {
          return (
            <div key={wp.widgetId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("cc.kpi.reconciliation", locale)}</div>
              <div className="mt-2">
                <ReconciliationBadge status={(val as { current: number | null }).current} locale={locale} />
              </div>
            </div>
          );
        }
        const subtitleKey = `cc.kpi.${wp.widgetId}.subtitle`;
        const subtitleVal = t(subtitleKey, locale);
        const subtitle = subtitleVal !== subtitleKey ? subtitleVal : undefined;
        return (
          <KpiCard
            key={wp.widgetId}
            title={t(`cc.kpi.${wp.widgetId}`, locale)}
            value={val as import("@/lib/dashboard-api").KpiValue}
            format={mapping.format as "currency" | "percent" | undefined}
            subtitle={subtitle}
          />
        );
      });
  }

  /** Render trend widgets for a section. */
  function renderTrends(section: DashboardSection) {
    return (
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {sectionPositions[section]
          .filter((wp) => wp.widgetId in TREND_WIDGETS)
          .map((wp) => (
            <TrendWidget
              key={wp.widgetId}
              metric={TREND_WIDGETS[wp.widgetId]}
              title={t(`cc.trend.${TREND_WIDGETS[wp.widgetId]}`, locale)}
              section={section}
              periodPreset={periodPreset}
              customStart={customStart}
              customEnd={customEnd}
              availableMetrics={availableMetrics}
              locale={locale}
            />
          ))}
        {/* revenue-trend: suppressed (R2-12) */}
        {sectionPositions[section].some((wp) => wp.widgetId === "revenue-trend") && (
          <TrendWidget
            metric="revenue"
            title={t("cc.trend.revenue", locale)}
            section={section}
            unsupported
            periodPreset={periodPreset}
            availableMetrics={availableMetrics}
            locale={locale}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {/* ─── Executive Section ─────────────────────────────────────── */}
      {hasSection("executive") && summary.sections.executive && (
        <section aria-labelledby="section-executive">
          <h2 id="section-executive" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.executive.icon} {t(SECTION_META.executive.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {renderKpiCards("executive", summary.sections.executive as Record<string, { current: number | string | null; previous: number | string | null; delta: number | string | null; deltaPercent: number | null }>)}
          </div>
          {renderTrends("executive")}
        </section>
      )}

      {/* ─── Operational Section ───────────────────────────────────── */}
      {hasSection("operational") && summary.sections.operational && (
        <section aria-labelledby="section-operational">
          <h2 id="section-operational" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.operational.icon} {t(SECTION_META.operational.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {renderKpiCards("operational", summary.sections.operational as Record<string, { current: number | string | null; previous: number | string | null; delta: number | string | null; deltaPercent: number | null }>)}
          </div>
        </section>
      )}

      {/* ─── Financial Section ─────────────────────────────────────── */}
      {hasSection("financial") && summary.sections.financial && (
        <section aria-labelledby="section-financial">
          <h2 id="section-financial" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.financial.icon} {t(SECTION_META.financial.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {renderKpiCards("financial", summary.sections.financial as Record<string, { current: number | string | null; previous: number | string | null; delta: number | string | null; deltaPercent: number | null }>)}
          </div>
        </section>
      )}

      {/* ─── Marketplace Section ───────────────────────────────────── */}
      {hasSection("marketplace") && summary.sections.marketplace && (
        <section aria-labelledby="section-marketplace">
          <h2 id="section-marketplace" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.marketplace.icon} {t(SECTION_META.marketplace.titleKey, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {renderKpiCards("marketplace", summary.sections.marketplace as Record<string, { current: number | string | null; previous: number | string | null; delta: number | string | null; deltaPercent: number | null }>)}
          </div>
        </section>
      )}

      {/* ─── Catalog Health Section ────────────────────────────────── */}
      {hasSection("catalog") && summary.sections.catalog && (
        <V3Section id="catalog" data={summary.sections.catalog} locale={locale} />
      )}

      {/* ─── Channel Health Section ────────────────────────────────── */}
      {hasSection("channels") && summary.sections.channels && (
        <V3Section id="channels" data={summary.sections.channels} locale={locale} />
      )}

      {/* ─── Needs Attention → Decision Queue ──────────────────────── */}
      {hasSection("attention") && summary.sections.attention && (
        <DecisionQueue
          signals={summary.sections.attention.signals ?? []}
          summary={summary.sections.attention.summary ?? { open: 0, acknowledged: 0, total: 0, slaBreached: 0 }}
          locale={locale}
          onAction={async (signalId, action) => {
            const res = await fetch(`/api/v1/dashboard/decision-signals/${signalId}/${action}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });
            if (!res.ok) throw new Error(`Action failed: ${res.status}`);
          }}
        />
      )}

      {/* ─── AI Decision Feed Section ──────────────────────────────── */}
      {hasSection("insights") && summary.sections.insights && (
        <AiInsightsSection data={summary.sections.insights} locale={locale} />
      )}
    </div>
  );
}

// ─── V3 Generic Section ───────────────────────────────────────────────────

/** Generic renderer for V3 KPI sections (catalog, channels, attention). */
function V3Section({ id, data, locale = "ru" }: { id: string; data: Record<string, any>; locale?: Locale }) {
  const meta = SECTION_META[id];
  if (!meta) return null;
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === "object" && "current" in v);
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={`section-${id}`}>
      <h2 id={`section-${id}`} className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        {meta.icon} {t(meta.titleKey, locale)}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map(([key, val]) => {
          const v = val as { current: number | string | null; currency?: string; drillDown?: { target: string } };
          const displayValue = v.currency ? `${v.current} ${v.currency}` : String(v.current ?? "—");
          const label = t(`cc.v3.${id}.${key}`, "ru") || key.replace(/([A-Z])/g, " $1").replace(/-/g, " ");
          return (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{displayValue}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── AI Decision Feed ─────────────────────────────────────────────────────

interface AiInsightsSectionProps {
  data: {
    risks: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number>; severity: string }>;
    opportunities: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number>; orders: number; period: number }>;
    catalogInsights: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number> }>;
  };
  locale?: Locale;
}

function AiInsightsSection({ data, locale = "ru" }: AiInsightsSectionProps) {
  const hasContent = data.risks.length > 0 || data.opportunities.length > 0 || data.catalogInsights.length > 0;
  if (!hasContent) return null;

  return (
    <section aria-labelledby="section-insights">
      <h2 id="section-insights" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        {SECTION_META.insights.icon} {t(SECTION_META.insights.titleKey, locale)}
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Risks */}
        {data.risks.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-red-800">⚠️ {t("cc.ai.risks", locale)}</h3>
            {data.risks.map((r, i) => (
              <div key={i} className="mb-2">
                <div className="text-sm font-medium text-red-900">{interpolate(t(r.titleKey, locale), r.titleParams)}</div>
                <div className="text-xs text-red-700">{interpolate(t(r.detailKey, locale), r.detailParams)}</div>
              </div>
            ))}
          </div>
        )}
        {/* Opportunities */}
        {data.opportunities.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-emerald-800">🚀 {t("cc.ai.opportunities", locale)}</h3>
            {data.opportunities.map((o, i) => (
              <div key={i} className="mb-2">
                <div className="text-sm font-medium text-emerald-900">{interpolate(t(o.titleKey, locale), o.titleParams)}</div>
                <div className="text-xs text-emerald-700">{interpolate(t(o.detailKey, locale), o.detailParams)}</div>
              </div>
            ))}
          </div>
        )}
        {/* Catalog Insights */}
        {data.catalogInsights.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-amber-800">📦 {t("cc.ai.catalog", locale)}</h3>
            {data.catalogInsights.map((c, i) => (
              <div key={i} className="mb-2">
                <div className="text-sm font-medium text-amber-900">{interpolate(t(c.titleKey, locale), c.titleParams)}</div>
                <div className="text-xs text-amber-700">{interpolate(t(c.detailKey, locale), c.detailParams)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
