"use client";

import { type CommandCenterSummary } from "@/lib/dashboard-api";
import { type EffectiveLayout, type WidgetPosition } from "@/lib/workspace-api";
import { KpiCard } from "./KpiCard";

interface Props {
  data: NonNullable<CommandCenterSummary["sections"]["operational"]>;
  layout: EffectiveLayout | null;
  editing: boolean;
}

function isVisible(layout: EffectiveLayout | null, widgetId: string, editing: boolean): boolean {
  if (!layout) return false;
  if (editing) return layout.widgets.some((wp: WidgetPosition) => wp.widgetId === widgetId);
  const pos = layout.widgets.find((wp: WidgetPosition) => wp.widgetId === widgetId);
  return pos?.visible === true;
}

export function OperationalSection({ data, layout, editing }: Props) {
  return (
    <section aria-labelledby="section-operational">
      <h2 id="section-operational" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        ⚙️ Operational
      </h2>
      {/* Composite funnel widget */}
      {isVisible(layout, "funnel", editing) && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversion Funnel</div>
          <div className="mt-3 space-y-2">
            <FunnelRow label="Orders Fulfilled" value={data.ordersFulfilled.current} />
            <FunnelRow label="Bookings Confirmed" value={data.bookingsConfirmed.current} />
            <FunnelRow label="Bookings Completed" value={data.bookingsCompleted.current} />
            <FunnelRow label="Payments Captured" value={data.paymentsCaptured.current} />
            <FunnelRow label="Refunds Processed" value={data.refundsProcessed.current} highlight />
            <FunnelRow label="Funnel Conversion" value={data.funnelConversion.current} format="percent" />
          </div>
        </div>
      )}
    </section>
  );
}

function FunnelRow({
  label,
  value,
  format = "number",
  highlight = false,
}: {
  label: string;
  value: number | null;
  format?: "number" | "percent";
  highlight?: boolean;
}) {
  const formatted =
    value === null
      ? "—"
      : format === "percent"
        ? `${(value / 100).toFixed(1)}%`
        : new Intl.NumberFormat("ru-RU").format(value);

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
      highlight ? "bg-amber-50 text-amber-700" : "text-slate-700"
    }`}>
      <span>{label}</span>
      <span className="font-medium">{formatted}</span>
    </div>
  );
}
