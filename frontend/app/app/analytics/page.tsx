"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { METRIC_CONFIGS, type PeriodContext, resolveTableCellDrilldown, resolveDrilldownUrl } from "@/lib/metric-drilldown";
import AggregateSummary from "@/components/AggregateSummary";

/**
 * Pre-Step 3.12 — Analytics Round 4 Strict Remediation
 *
 * Shared Metric Drill-down: all KPI cards use MetricDrilldownConfig
 * for source traceability with period/filter preservation.
 *
 * R4-02E: Shared drill-down framework
 * R4-02A: Orders with period filter
 * R4-02B: Bookings with period filter
 * R4-02C: Customers = all-time stock
 * R4-02D: Partners → CRM Partners tab
 * R4-03: Commission rate = effective (Commission/GMV), clearly labeled
 * Financial Summary: Payment Count column
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

  const [partnerPage, setPartnerPage] = useState(1);
  const PAGE_SIZE = 20;

  // R4-01: CUSTOM period — only fetch when BOTH dates are valid
  const isCustomValid = preset !== "CUSTOM" || (customStart !== "" && customEnd !== "");

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
    if (isCustomValid) {
      void load();
    }
  }, [load, isCustomValid]);

  const fmt = (v: string | number | null | undefined, currency?: string) => {
    if (v == null) return "\u2014";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return String(v);
    const formatted = n.toLocaleString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return currency ? `${formatted} ${currency}` : formatted;
  };

  const m = kpi?.metrics;

  // Build period context for drill-down filter transfer
  const periodContext: PeriodContext = useMemo(() => {
    if (kpi?.period) {
      return {
        preset,
        from: kpi.period.start.split("T")[0],
        to: kpi.period.endExclusive.split("T")[0],
      };
    }
    return { preset };
  }, [kpi, preset]);

  const allPartners = partners?.partners ?? [];
  const partnerTotal = allPartners.length;
  const partnerPages = Math.ceil(partnerTotal / PAGE_SIZE);
  const pagePartners = allPartners.slice((partnerPage - 1) * PAGE_SIZE, partnerPage * PAGE_SIZE);

  const ordersBucketSum = useMemo(() => {
    if (!timeSeries) return null;
    return timeSeries.buckets.reduce((sum, b) => sum + b.value, 0);
  }, [timeSeries]);

  const chartMax = useMemo(() => {
    if (!timeSeries || timeSeries.buckets.length === 0) return 1;
    return Math.max(...timeSeries.buckets.map((b) => b.value), 1);
  }, [timeSeries]);

  const stageLabel = (stage: string): string => {
    const map: Record<string, string> = {
      "Product Impression": t("analytics.stage.impression", locale),
      "Product Viewed": t("analytics.stage.viewed", locale),
      "Checkout Started": t("analytics.stage.checkout", locale),
      "Order Created": t("analytics.stage.order_created", locale),
      "Payment Succeeded": t("analytics.stage.payment", locale),
      "Booking Confirmed": t("analytics.stage.booking_confirmed", locale),
      "Booking Completed": t("analytics.stage.booking_completed", locale),
    };
    return map[stage] ?? stage;
  };

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

      {preset === "CUSTOM" && !isCustomValid && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("analytics.custom_dates_required", locale)}
        </div>
      )}

      {loading && isCustomValid && (
        <div className="flex h-32 items-center justify-center">
          <div className="text-sm text-slate-400">{t("analytics.loading", locale)}</div>
        </div>
      )}

      {error && isCustomValid && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <div className="font-medium">{t("analytics.error", locale)}</div>
          <div className="mt-1 text-xs text-red-500">{error}</div>
          <button onClick={() => void load()} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
            {t("analytics.retry", locale)}
          </button>
        </div>
      )}

      {/* ── KPI Cards with Shared Drill-down ── */}
      {m && (
        <Kpi
          period={periodContext}
          items={[
            { label: t("analytics.kpi.gmv", locale), value: fmt(m.gmv.current, m.gmvCurrency), icon: "\uD83D\uDCB0", drilldown: METRIC_CONFIGS["analytics.gmv"] },
            { label: t("analytics.kpi.revenue", locale), value: fmt(m.revenue.current, m.revenueCurrency), icon: "\uD83D\uDCC8", drilldown: METRIC_CONFIGS["analytics.revenue"] },
            { label: t("analytics.kpi.net_revenue", locale), value: fmt(m.netRevenue.current, m.revenueCurrency), icon: "\uD83D\uDCCA", drilldown: METRIC_CONFIGS["analytics.revenue"] },
            { label: t("analytics.kpi.commission", locale), value: fmt(m.commissionAccrued.current, m.commissionCurrency), icon: "\uD83C\uDFE6", drilldown: METRIC_CONFIGS["analytics.commission"] },
            { label: t("analytics.kpi.orders", locale), value: m.ordersCreated.current, icon: "\uD83D\uDDCE\uFE0F", drilldown: METRIC_CONFIGS["analytics.orders"] },
            { label: t("analytics.kpi.bookings", locale), value: m.bookingsRequested.current, icon: "\uD83D\uDCD1", drilldown: METRIC_CONFIGS["analytics.bookings"] },
            { label: t("analytics.kpi.aov", locale), value: fmt(m.averageOrderValue.current, m.gmvCurrency), icon: "\uD83C\uDFAF", drilldown: METRIC_CONFIGS["analytics.aov"] },
            { label: t("analytics.kpi.refunds", locale), value: fmt(m.refunds.current, m.refundsCurrency), icon: "\u21A9\uFE0F", drilldown: METRIC_CONFIGS["analytics.refunds"] },
            { label: t("analytics.kpi.sessions", locale), value: (m.marketplaceSessions.current ?? 0) + (m.storefrontSessions.current ?? 0), icon: "\uD83C\uDF10", drilldown: METRIC_CONFIGS["analytics.sessions"] },
            { label: t("analytics.kpi.customers", locale), value: m.totalActiveCustomers?.current ?? (m.marketplaceCustomers.current ?? 0) + (m.storefrontCustomers.current ?? 0), icon: "\uD83D\uDC65", drilldown: METRIC_CONFIGS["analytics.customers"] },
            { label: t("analytics.kpi.partners", locale), value: m.totalActivePartners?.current ?? (m.marketplacePartners.current ?? 0) + (m.storefrontPartners.current ?? 0), icon: "\uD83E\uDD1D", drilldown: METRIC_CONFIGS["analytics.partners"] },
            { label: t("analytics.kpi.qualified_gmv", locale), value: fmt(m.qualifiedGmv.current, m.gmvCurrency), icon: "\u2705", drilldown: METRIC_CONFIGS["analytics.qualified_gmv"] },
            { label: t("analytics.kpi.collected_gmv", locale), value: fmt(m.collectedGmv.current, m.gmvCurrency), icon: "\uD83D\uDCB5", drilldown: METRIC_CONFIGS["analytics.collected_gmv"] },
            { label: t("analytics.kpi.outstanding_gmv", locale), value: fmt(m.outstandingGmv.current, m.gmvCurrency), icon: "\u23F3", drilldown: METRIC_CONFIGS["analytics.outstanding_gmv"] },
          ]}
        />
      )}

      {ordersBucketSum != null && m && ordersBucketSum !== m.ordersCreated.current && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          RT2A reconciliation: SUM(buckets)={ordersBucketSum} {"\u2260"} headline={m.ordersCreated.current}
          {" "}(different timestamp/status semantics — see report)
        </div>
      )}

      {/* ── Activity by Stage ── */}
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
                    <div className="w-36 shrink-0 text-xs font-medium text-slate-600 truncate" title={stageLabel(stage.stage)}>
                      {stageLabel(stage.stage)}
                    </div>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded bg-slate-100">
                        <div className="h-full rounded bg-blue-500 transition-all" style={{ width: `${pctWidth}%` }} />
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

      {/* ── Time Series Bar Chart ── */}
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
            <div className="relative" style={{ height: 200 }}>
              <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-[9px] text-slate-400 pr-1 text-right">
                <span>{chartMax}</span>
                <span>{Math.round(chartMax * 0.75)}</span>
                <span>{Math.round(chartMax * 0.5)}</span>
                <span>{Math.round(chartMax * 0.25)}</span>
                <span>0</span>
              </div>
              <div className="absolute left-10 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-b border-slate-100 w-full" />
                ))}
              </div>
              <div className="absolute left-10 right-0 bottom-6 top-0 flex items-end gap-[2px]">
                {timeSeries.buckets.map((b) => {
                  const h = chartMax > 0 ? (b.value / chartMax) * 100 : 0;
                  return (
                    <div key={b.label} className="group relative flex-1 h-full flex items-end">
                      <div className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-600" style={{ height: `${h}%` }} />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white whitespace-nowrap group-hover:block">
                        {b.label}: {b.value.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 ml-10 flex gap-[2px]">
              {timeSeries.buckets.map((b, i) => {
                const showLabel = timeSeries.buckets.length <= 15 || i % Math.ceil(timeSeries.buckets.length / 15) === 0 || i === timeSeries.buckets.length - 1;
                return (
                  <div key={b.label} className="flex-1 text-center">
                    {showLabel && <span className="text-[8px] text-slate-400 truncate block">{b.label}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Partner Performance ── */}
      {partners && allPartners.length > 0 && !loading && (
        <>
        <AggregateSummary
          totalRecords={partnerTotal}
          fields={[
            { label: "GMV", value: allPartners.reduce((sum, p) => sum + (parseFloat(p.gmv) || 0), 0), isMoney: true },
            { label: t("analytics.kpi.orders", locale), value: allPartners.reduce((sum, p) => sum + p.ordersCount, 0) },
            { label: t("analytics.kpi.bookings", locale), value: allPartners.reduce((sum, p) => sum + p.bookingsCount, 0) },
          ]}
        />
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
                  <th className="px-4 py-2.5 text-right">{t("analytics.partners.completion", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.partners.effective_rate", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {pagePartners.map((p) => {
                  const partnerNameUrl = resolveTableCellDrilldown(
                    { ...METRIC_CONFIGS["analytics.partner.name"], partnerId: p.partnerId },
                    periodContext,
                    p.partnerId,
                  );
                  const partnerOrdersUrl = resolveTableCellDrilldown(
                    { ...METRIC_CONFIGS["analytics.partner.orders"], partnerId: p.partnerId },
                    periodContext,
                    p.partnerId,
                  );
                  const partnerBookingsUrl = resolveTableCellDrilldown(
                    { ...METRIC_CONFIGS["analytics.partner.bookings"], partnerId: p.partnerId },
                    periodContext,
                    p.partnerId,
                  );
                  return (
                    <tr key={p.partnerId} className="border-b border-slate-50 hover:bg-blue-50/50">
                      <td className="px-4 py-2.5 font-medium">
                        <Link href={partnerNameUrl} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {p.partnerName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.gmv)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(p.commission)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={partnerOrdersUrl} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {p.ordersCount}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={partnerBookingsUrl} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {p.bookingsCount}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {p.bookingCompletionRate != null
                          ? `${Math.min(p.bookingCompletionRate, 100).toFixed(1)}%`
                          : "\u2014"}
                      </td>
                      {/* R4-03: Effective rate = Commission / GMV (clearly labeled as derived) */}
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {parseFloat(p.gmv) > 0
                          ? `${((parseFloat(p.commission) / parseFloat(p.gmv)) * 100).toFixed(1)}%`
                          : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {partnerPages > 1 && (
            <Pagination page={partnerPage} pageSize={PAGE_SIZE} total={partnerTotal} onPageChange={setPartnerPage} />
          )}
        </div>
        </>
      )}

      {/* ── Financial Summary with Payment Count ── */}
      {finance && finance.currencies.length > 0 && !loading && (
        <>
        <AggregateSummary
          totalRecords={finance.totalLedgerEntries}
          fields={[
            { label: t("analytics.finance.payments", locale), value: finance.currencies.reduce((sum, c) => sum + (parseFloat(c.totalPayments) || 0), 0), isMoney: true },
            { label: t("analytics.finance.refunds", locale), value: finance.currencies.reduce((sum, c) => sum + (parseFloat(c.totalRefunds) || 0), 0), isMoney: true },
            { label: t("analytics.finance.commission", locale), value: finance.currencies.reduce((sum, c) => sum + (parseFloat(c.totalCommission) || 0), 0), isMoney: true },
          ]}
          currencyTotals={finance.currencies.map((c) => ({
            currency: c.currency,
            fields: [
              { label: t("analytics.finance.payments", locale), value: c.totalPayments, isMoney: true },
              { label: t("analytics.finance.refunds", locale), value: c.totalRefunds, isMoney: true },
              { label: t("analytics.finance.net", locale), value: c.netPayments, isMoney: true },
            ],
          }))}
        />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{t("analytics.finance.title", locale)}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">{t("analytics.finance.currency", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.payment_count", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.payments", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.refunds", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.net", locale)}</th>
                  <th className="px-4 py-2.5 text-right">{t("analytics.finance.commission", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {finance.currencies.map((c) => {
                  const paymentUrl = resolveDrilldownUrl(
                    { ...METRIC_CONFIGS["analytics.finance.payment_count"], currency: c.currency },
                    periodContext,
                  );
                  return (
                    <tr key={c.currency} className="border-b border-slate-50 hover:bg-blue-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{c.currency}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={paymentUrl} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {(c as any).paymentCount ?? "\u2014"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.totalPayments)}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{fmt(c.totalRefunds)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.netPayments)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(c.totalCommission)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-slate-400">
              {t("analytics.finance.ledger", locale)}: {finance.totalLedgerEntries.toLocaleString()}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !kpi && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="text-3xl">{"\uD83D\uDCC8"}</div>
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
