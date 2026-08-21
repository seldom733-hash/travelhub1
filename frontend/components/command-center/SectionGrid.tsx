"use client";

import { type CommandCenterSummary, type DashboardSection } from "@/lib/dashboard-api";
import { type EffectiveLayout, type WidgetPosition } from "@/lib/workspace-api";
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
}

/** Check if a widget ID should be rendered based on layout positions. */
function isVisible(layout: EffectiveLayout | null, widgetId: string, editing: boolean): boolean {
  if (!layout) return false;
  if (editing) {
    return layout.widgets.some((wp: WidgetPosition) => wp.widgetId === widgetId);
  }
  const pos = layout.widgets.find((wp: WidgetPosition) => wp.widgetId === widgetId);
  return pos?.visible === true;
}

const SECTION_META: Record<DashboardSection, { title: string; icon: string }> = {
  executive: { title: "Executive Summary", icon: "📈" },
  operational: { title: "Operational", icon: "⚙️" },
  financial: { title: "Financial", icon: "💰" },
  marketplace: { title: "Marketplace", icon: "🏪" },
};

export function SectionGrid({ summary, authorizedSections, loading, layout, editing }: Props) {
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

  const hasSection = (section: DashboardSection) =>
    authorizedSections.includes(section) && summary.sections[section] !== undefined;

  return (
    <div className="mt-8 space-y-8">
      {/* Executive Section */}
      {hasSection("executive") && summary.sections.executive && isVisible(layout, "gmv", editing) && (
        <section aria-labelledby="section-executive">
          <h2 id="section-executive" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.executive.icon} {SECTION_META.executive.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isVisible(layout, "gmv", editing) && (
              <KpiCard title="GMV" value={summary.sections.executive.gmv} format="currency" />
            )}
            {isVisible(layout, "revenue", editing) && (
              <KpiCard title="Revenue" value={summary.sections.executive.revenue} format="currency" />
            )}
            {isVisible(layout, "net-revenue", editing) && (
              <KpiCard title="Net Revenue" value={summary.sections.executive.netRevenue} format="currency" />
            )}
            {isVisible(layout, "orders", editing) && (
              <KpiCard title="Orders" value={summary.sections.executive.ordersCreated} />
            )}
            {isVisible(layout, "bookings", editing) && (
              <KpiCard title="Bookings" value={summary.sections.executive.bookingsRequested} />
            )}
            {isVisible(layout, "aov", editing) && (
              <KpiCard title="AOV" value={summary.sections.executive.averageOrderValue} format="currency" />
            )}
            {isVisible(layout, "conversion", editing) && (
              <KpiCard title="Conversion" value={summary.sections.executive.conversionRate} format="percent" />
            )}
          </div>
          {/* Executive trends */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {isVisible(layout, "orders-trend", editing) && (
              <TrendWidget metric="orders" title="Orders Trend" section="executive" />
            )}
            {isVisible(layout, "bookings-trend", editing) && (
              <TrendWidget metric="bookings" title="Bookings Trend" section="executive" />
            )}
            {isVisible(layout, "revenue-trend", editing) && (
              <TrendWidget metric="revenue" title="Revenue Trend" section="executive" unsupported />
            )}
          </div>
        </section>
      )}

      {/* Operational Section */}
      {hasSection("operational") && summary.sections.operational && isVisible(layout, "funnel", editing) && (
        <OperationalSection
          data={summary.sections.operational}
          layout={layout}
          editing={editing}
        />
      )}

      {/* Financial Section */}
      {hasSection("financial") && summary.sections.financial && isVisible(layout, "commission", editing) && (
        <FinancialSection
          data={summary.sections.financial}
          layout={layout}
          editing={editing}
        />
      )}

      {/* Marketplace Section */}
      {hasSection("marketplace") && summary.sections.marketplace && isVisible(layout, "sessions", editing) && (
        <section aria-labelledby="section-marketplace">
          <h2 id="section-marketplace" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {SECTION_META.marketplace.icon} {SECTION_META.marketplace.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isVisible(layout, "sessions", editing) && (
              <KpiCard title="Sessions" value={summary.sections.marketplace.marketplaceSessions} />
            )}
            {isVisible(layout, "storefront-sessions", editing) && (
              <KpiCard title="Storefront Sessions" value={summary.sections.marketplace.storefrontSessions} />
            )}
            {isVisible(layout, "partners", editing) && (
              <KpiCard title="Partners" value={summary.sections.marketplace.activePartners} />
            )}
            {isVisible(layout, "customers", editing) && (
              <KpiCard title="Customers" value={summary.sections.marketplace.newCustomers} />
            )}
          </div>
          {/* Marketplace trend */}
          <div className="mt-4">
            {isVisible(layout, "customers-trend", editing) && (
              <div className="max-w-md">
                <TrendWidget metric="customers" title="Customers Trend" section="marketplace" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
