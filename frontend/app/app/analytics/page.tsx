"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  analyticsApi,
  type AnalyticsPreset,
  type CompanyKpiResponse,
  type ConversionFunnelResponse,
  type TimeSeriesResponse,
  type PartnerPerformanceResponse,
  type FinancialReconciliationResponse,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import { PeriodSelector } from "@/components/command-center/PeriodSelector";
import { useLocale, t } from "@/lib/i18n";

/**
 * Pre-Step 3.12 — Analytics Data / KPI / UI Contract Remediation
 *
 * Route: /app/analytics
 * Permission: analytics.read (server-authoritative)
 *
 * Deep analysis center with corrected semantics:
 * - Revenue → Customer Payments (not Platform Revenue)
 * - Funnel → Activity by Stage (not conversion funnel)
 * - Completion capped at 100%
 * - Shared PeriodSelector from Command Center
 * - Proper time series metric identity
 * - Bar chart with proportional rendering
 * - Server-side pagination for tables
 */
function AnalyticsContent() {
  const locale = useLocale();
  const [preset, setPreset] = useState<AnalyticsPreset>("MONTH");
  const [comparison, setComparison] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kpi, setKpi] = useState<CompanyKpiResponse | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnelResponse | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesResponse | null>(null);
  const [partners, setPartners] = useState<PartnerPerformanceResponse | null>(null);
  const [finance, setFinance] = useState<FinancialReconciliationResponse | null>(null);

  // Partner pagination
  const [partnerPage, setPartnerPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const opts = { preset, startDate: customStart || undefined, endDate: customEnd || undefined };
      const [k, f, ts, p, fin] = await Promise.all([
        analyticsApi.getCompanyKpi({ ...opts, comparison }),
        analyticsApi.getConversionFunnel(opts),
        analyticsApi.getTimeSeries({ ...opts, metric: "orders" }),
        analyticsApi.getPartnerPerformance(opts),
        analyticsApi.getFinancialReconciliation(opts),
      ]);
      setKpi(k);
      setFunnel(f);
      setTimeSeries(ts);
      setPartners(p);
      setFinance(fin);
      setPartnerPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [preset, comparison, customStart, customEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (v: string | number | null | undefined, currency?: string) => {
    if (v == null) return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return String(v);
    const formatted = n.toLocaleString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return currency ? `${formatted} ${currency}` : formatted;
  };

  const m = kpi?.metrics;

  // Partner pagination
  const allPartners = partners?.partners ?? [];
  const partnerTotal = allPartners.length;
  const partnerPages = Math.ceil(partnerTotal / PAGE_SIZE);
  const pagePartners = allPartners.slice((partnerPage - 1) * PAGE_SIZE, partnerPage * PAGE_SIZE);

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <PageHeader
        title={t("analytics.title", locale)}
        breadcrumbs={["TravelHub", t("analytics.title", locale)]}
        actions={
          <PeriodSelector
            preset={preset}
            comparison={comparison}
            customStart={customStart}
            customEnd={customEnd}
            customError={null}
            onPresetChange={(p) => setPreset(p as AnalyticsPreset)}
            onComparisonChange={setComparison}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            locale={locale}
          />
        }
      />

      <p className="text-sm text-slate-500">{t("analytics.subtitle", locale)}</p>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <div className="text-sm text-slate-400">{t("analytics.loading", locale)}</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="font-medium">{t("analytics.error", locale)}</div>
          <div className="mt-1 text-xs text-red-500">{error}</div>
          <button onClick={() => void load()} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
            {t("analytics.retry", locale)}
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {m && (
        <Kpi items={[
          { label: t("analytics.kpi.gmv", locale), value: fmt(m.gmv.current, m.gmvCurrency), icon: "💰" },
          { label: t("analytics.kpi.revenue", locale), value: fmt(m.revenue.current, m.revenueCurrency), icon: "📈" },
          { label: t("analytics.kpi.net_revenue", locale), value: fmt(m.netRevenue.current, m.revenueCurrency), icon: "📊" },
          { label: t("analytics.kpi.commission", locale), value: fmt(m.commissionAccrued.current), icon: "🏦" },
          { label: t("analytics.kpi.orders", locale), value: m.ordersCreated.current, icon: "🧾" },
          { label: t("analytics.kpi.bookings", locale), value: m.bookingsRequested.current, icon: "📑" },
          { label: t("analytics.kpi.aov", locale), value: fmt(m.averageOrderValue.current, m.gmvCurrency), icon: "🎯" },
          { label: t("analytics.kpi.refunds", locale), value: fmt(m.refunds.current, m.refundsCurrency), icon: "↩️" },
          { label: t("analytics.kpi.sessions", locale), value: (m.marketplaceSessions.current ?? 0) + (m.storefrontSessions.current ?? 0), icon: "🌐" },
          { label: t("analytics.kpi.customers", locale), value: (m.marketplaceCustomers.current ?? 0) + (m.storefrontCustomers.current ?? 0), icon: "👥" },
          { label: t("analytics.kpi.partners", locale), value: (m.marketplacePartners.current ?? 0) + (m.storefrontPartners.current ?? 0), icon: "🤝" },
          { label: t("analytics.kpi.qualified_gmv", locale), value: fmt(m.qualifiedGmv.current, m.gmvCurrency), icon: "✅" },
          { label: t("analytics.kpi.completed_gmv", locale), value: fmt(m.completedGmv.current, m.gmvCurrency), icon: "✔️" },
          { label: t("analytics.kpi.collected_gmv", locale), value: fmt(m.collectedGmv.current, m.gmvCurrency), icon: "💵" },
          { label: t("analytics.kpi.outstanding_gmv", locale), value: fmt(m.outstandingGmv.current, m.gmvCurrency), icon: "⏳" },
        ]} />
      )}

      {/* ── Activity by Stage (formerly Funnel) ── */}
      {funnel && funnel.stages.length > 0 && !loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{t("analytics.funnel.title", locale)}</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {funnel.stages.map((stage) => {
                const max = Math.max(...funnel.stages.map((s) => s.count), 1);
                const pctWidth = max > 0 ? (stage.count / max) * 100 : 0;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-xs font-medium text-slate-600 truncate" title={stage.stage}>
                      {stage.stage}
                    </div>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded bg-slate-100">
                        <div
                          className="h-full rounded bg-blue-500 transition-all"
                          style={{ width: `${pctWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-slate-500">
                      {stage.count.toLocaleString()}
                      {stage.uniqueEntities != null && stage.uniqueEntities !== stage.count && (
                        <span className="text-slate-400"> ({stage.uniqueEntities} u)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Time Series (Orders) ── */}
      {timeSeries && timeSeries.buckets.length > 0 && !loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {t("analytics.timeseries.title", locale)} — {t("analytics.kpi.orders", locale)}
            </h2>
            <span className="text-xs text-slate-400">
              {t("analytics.timeseries.granularity", locale)}: {timeSeries.granularity}
            </span>
          </div>
          <div className="p-5">
            {/* Bar chart with proportional rendering */}
            <div className="relative" style={{ height: 160 }}>
              {/* Y-axis baseline at 0 */}
              <div className="absolute inset-0 flex items-end gap-px">
                {timeSeries.buckets.map((b) => {
                  const max = Math.max(...timeSeries.buckets.map((x) => x.value), 1);
                  const h = max > 0 ? (b.value / max) * 100 : 0;
                  return (
                    <div
                      key={b.label}
                      className="group relative flex flex-1 items-end"
                      title={`${b.label}: ${b.value}`}
                    >
                      <div
                        className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                        style={{ height: `${h}%`, minHeight: b.value > 0 ? 2 : 0 }}
                      />
                      {/* Tooltip on hover */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                        {b.label}: {b.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X-axis labels (sparse) */}
            <div className="mt-1 flex gap-px">
              {timeSeries.buckets.map((b, i) => {
                const showLabel = timeSeries.buckets.length <= 15 || i % Math.ceil(timeSeries.buckets.length / 15) === 0;
                return (
                  <div key={b.label} className="flex-1 text-center">
                    {showLabel && (
                      <span className="text-[8px] text-slate-400 truncate block">{b.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Partner Performance ── */}
      {partners && allPartners.length > 0 && !loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{t("analytics.partners.title", locale)}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">{t("crm.col.name", locale)}</th>
                  <th className="px-4 py-2.5 text-right">GMV</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.kpi.revenue", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.kpi.commission", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.kpi.orders", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.kpi.bookings", locale)}</th>
                  <th className="px-4 py-2.5 text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {pagePartners.map((p) => (
                  <tr key={p.partnerId} className="border-b border-slate-50 hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.partnerName}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.gmv)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.commission)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{p.ordersCount}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{p.bookingsCount}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {p.bookingCompletionRate != null ? `${Math.min(p.bookingCompletionRate, 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {partnerPages > 1 && (
            <Pagination page={partnerPage} pageSize={PAGE_SIZE} total={partnerTotal} onPageChange={setPartnerPage} />
          )}
        </div>
      )}

      {/* ── Financial Summary ── */}
      {finance && finance.currencies.length > 0 && !loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{t("analytics.finance.title", locale)}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Currency</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.payments", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.refunds", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.net", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.commission", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {finance.currencies.map((c) => (
                  <tr key={c.currency} className="border-b border-slate-50 hover:bg-blue-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.currency}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.totalPayments)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{fmt(c.totalRefunds)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.netPayments)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-slate-400">
              {t("analytics.finance.ledger", locale)}: {finance.totalLedgerEntries.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !kpi && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="text-3xl">📈</div>
          <p className="mt-3 text-sm text-slate-500">{t("analytics.no_data", locale)}</p>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6 lg:p-10"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
