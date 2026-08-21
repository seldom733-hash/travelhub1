"use client";

import { type CommandCenterSummary } from "@/lib/dashboard-api";
import { type EffectiveLayout, type WidgetPosition } from "@/lib/workspace-api";
import { KpiCard } from "./KpiCard";
import { TrendWidget } from "./TrendWidget";

interface Props {
  data: NonNullable<CommandCenterSummary["sections"]["financial"]>;
  layout: EffectiveLayout | null;
  editing: boolean;
}

function isVisible(layout: EffectiveLayout | null, widgetId: string, editing: boolean): boolean {
  if (!layout) return false;
  if (editing) return layout.widgets.some((wp: WidgetPosition) => wp.widgetId === widgetId);
  const pos = layout.widgets.find((wp: WidgetPosition) => wp.widgetId === widgetId);
  return pos?.visible === true;
}

export function FinancialSection({ data, layout, editing }: Props) {
  return (
    <section aria-labelledby="section-financial">
      <h2 id="section-financial" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        💰 Financial
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isVisible(layout, "commission", editing) && (
          <KpiCard title="Commission" value={data.commissionAccrued} format="currency" />
        )}
        {isVisible(layout, "payments", editing) && (
          <KpiCard title="Payments" value={data.totalPayments} format="currency" />
        )}
        {isVisible(layout, "net-payments", editing) && (
          <KpiCard title="Net Payments" value={data.netPayments} format="currency" />
        )}
        {isVisible(layout, "reconciliation", editing) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Reconciliation</div>
            <div className="mt-2">
              <ReconciliationBadge status={data.reconciliationStatus.current} />
            </div>
          </div>
        )}
      </div>
      {/* Financial trend */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {isVisible(layout, "payments-trend", editing) && (
          <TrendWidget metric="payments" title="Payments Trend" section="financial" />
        )}
        {isVisible(layout, "commissions-trend", editing) && (
          <TrendWidget metric="commissions" title="Commissions Trend" section="financial" />
        )}
      </div>
    </section>
  );
}

function ReconciliationBadge({ status }: { status: number | null }) {
  if (status === null || status === undefined) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  if (status === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        ✓ Баланс
      </span>
    );
  }
  if (status > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        ⚠ Расхождение: {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      ✗ Критическое
    </span>
  );
}
