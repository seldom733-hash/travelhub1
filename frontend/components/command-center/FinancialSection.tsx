"use client";

import { type CommandCenterSummary } from "@/lib/dashboard-api";
import { type WidgetPosition } from "@/lib/workspace-api";
import { t, type Locale } from "@/lib/i18n";
import { KpiCard } from "./KpiCard";

interface Props {
  data: NonNullable<CommandCenterSummary["sections"]["financial"]>;
  positions: WidgetPosition[];
  locale?: Locale;
}

function isVisible(positions: WidgetPosition[], widgetId: string): boolean {
  return positions.some((wp) => wp.widgetId === widgetId && wp.visible);
}

export function FinancialSection({ data, positions, locale = "ru" }: Props) {
  return (
    <section aria-labelledby="section-financial">
      <h2 id="section-financial" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        💰 {t("cc.section.financial", locale)}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isVisible(positions, "commission") && (
          <KpiCard title={t("cc.kpi.commission", locale)} value={data.commissionAccrued} format="currency" locale={locale} />
        )}
        {isVisible(positions, "payments") && (
          <KpiCard title={t("cc.kpi.payments", locale)} value={data.totalPayments} format="currency" locale={locale} />
        )}
        {isVisible(positions, "net-payments") && (
          <KpiCard title={t("cc.kpi.netPayments", locale)} value={data.netPayments} format="currency" locale={locale} />
        )}
        {isVisible(positions, "reconciliation") && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("cc.kpi.reconciliation", locale)}</div>
            <div className="mt-2">
              <ReconciliationBadge status={data.reconciliationStatus.current} locale={locale} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

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
