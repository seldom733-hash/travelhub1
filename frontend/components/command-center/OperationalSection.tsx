"use client";

import { type CommandCenterSummary, type KpiValue } from "@/lib/dashboard-api";
import { type WidgetPosition } from "@/lib/workspace-api";
import { t, type Locale } from "@/lib/i18n";

interface Props {
  data: NonNullable<CommandCenterSummary["sections"]["operational"]>;
  positions: WidgetPosition[];
  locale?: Locale;
}

function isVisible(positions: WidgetPosition[], widgetId: string): boolean {
  return positions.some((wp) => wp.widgetId === widgetId && wp.visible);
}

export function OperationalSection({ data, positions, locale = "ru" }: Props) {
  if (!isVisible(positions, "funnel")) return null;
  return (
    <section aria-labelledby="section-operational">
      <h2 id="section-operational" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        ⚙️ {t("cc.section.operational", locale)}
      </h2>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversion Funnel</div>
        <div className="mt-3 space-y-2">
          <FunnelRow label={t("cc.funnel.ordersFulfilled", locale)} kpi={data.ordersFulfilled} />
          <FunnelRow label={t("cc.funnel.bookingsConfirmed", locale)} kpi={data.bookingsConfirmed} />
          <FunnelRow label={t("cc.funnel.bookingsCompleted", locale)} kpi={data.bookingsCompleted} />
          <FunnelRow label={t("cc.funnel.paymentsCaptured", locale)} kpi={data.paymentsCaptured} />
          <FunnelRow label={t("cc.funnel.refundsProcessed", locale)} kpi={data.refundsProcessed} highlight polarityInverted />
          <FunnelRow label={t("cc.funnel.conversion", locale)} kpi={data.funnelConversion} format="percent" />
        </div>
      </div>
    </section>
  );
}

function FunnelRow({
  label, kpi, format = "number", highlight = false, polarityInverted = false,
}: {
  label: string; kpi: KpiValue; format?: "number" | "percent"; highlight?: boolean; polarityInverted?: boolean;
}) {
  const value = kpi.current;
  const formatted = value === null ? "—" : format === "percent"
    ? `${(value / 100).toFixed(1)}%` : new Intl.NumberFormat("ru-RU").format(value);

  let deltaText = ""; let deltaClass = "";
  if (kpi.deltaPercent !== null && kpi.deltaPercent !== undefined) {
    const pct = kpi.deltaPercent;
    const isPositive = polarityInverted ? pct < 0 : pct > 0;
    deltaClass = pct === 0 ? "text-slate-400" : isPositive ? "text-emerald-600" : "text-red-500";
    const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    deltaText = `${arrow} ${Math.abs(pct).toFixed(1)}%`;
  }

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${highlight ? "bg-amber-50 text-amber-700" : "text-slate-700"}`}>
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{formatted}</span>
        {deltaText && <span className={`text-xs font-medium ${deltaClass}`}>{deltaText}</span>}
      </div>
    </div>
  );
}
