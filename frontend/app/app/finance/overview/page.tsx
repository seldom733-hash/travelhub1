"use client";

/**
 * UNIFIED FINANCE CENTER Phase 4 — Finance Overview (сводные KPI).
 *
 * Центральный экран Finance Center: обязательства/выплаты поставщиков (AZN),
 * ожидаемая маржа (из frozen snapshot), поступления/долги клиентов. Каждый
 * метрика — из своего source-of-truth; AZN-итог показывается ТОЛЬКО когда
 * frozen AZN существует, иначе честный UNKNOWN/UNAVAILABLE (never zero).
 * Actual profit / net cash flow честно UNAVAILABLE (recognition policy — Phase 5),
 * НИКОГДА не «captured − payouts». Read — finance.overview.read (nav gate).
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { MetricsPageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import PageHeader from "@/components/PageHeader";
import { useLocale, t, formatPrice } from "@/lib/i18n";
import { financeCenterApi, type FinanceOverview, type AznMetric, type CurrencyAmount } from "@/lib/finance-center-api";

/** Цвет availability-бейджа. */
function availabilityTone(a: string): string {
  switch (a) {
    case "OK":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "UNKNOWN":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "UNAVAILABLE":
      return "border-slate-200 bg-slate-100 text-slate-500";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function AvailabilityBadge({ a }: { a: string }) {
  const locale = useLocale();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${availabilityTone(a)}`}>
      {t(`finance.overview.availability.${a.toLowerCase()}`, locale)}
    </span>
  );
}

/** KPI-карточка AZN-метрики: сумма (или честный UNKNOWN), availability, note. */
function AznCard({ titleKey, metric }: { titleKey: string; metric: AznMetric }) {
  const locale = useLocale();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(titleKey, locale)}</h3>
        <AvailabilityBadge a={metric.availability} />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        {metric.amount !== null ? (
          <>
            <span className="font-mono text-2xl font-semibold text-slate-900">{metric.amount}</span>
            <span className="text-xs font-medium text-slate-500">AZN</span>
          </>
        ) : (
          <span className="text-lg font-medium text-slate-500">{t("finance.overview.unknown_value", locale)}</span>
        )}
      </div>
      {metric.availability === "UNAVAILABLE" && metric.note && (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">{metric.note}</p>
      )}
      {typeof metric.knownCount === "number" && typeof metric.unknownCount === "number" && metric.unknownCount > 0 && (
        <p className="mt-2 text-[11px] text-amber-600">
          {t("finance.overview.partial_note", locale)}: {metric.knownCount} / {metric.knownCount + metric.unknownCount}
        </p>
      )}
    </div>
  );
}

/** Полоска source-currency разбивки (поступления/долги: AZN=UNKNOWN). */
function CurrencyBreakdown({ titleKey, rows, azn }: { titleKey: string; rows: CurrencyAmount[]; azn: AznMetric }) {
  const locale = useLocale();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(titleKey, locale)}</h3>
        <AvailabilityBadge a={azn.availability} />
      </div>
      <div className="mt-3 space-y-1.5">
        {rows.length === 0 && <span className="text-sm text-slate-500">{t("ops.empty_no_data", locale)}</span>}
        {rows.map((r) => (
          <div key={r.currency} className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-semibold text-slate-900">{r.currency}</span>
            <span className="font-mono text-sm text-slate-900">{r.amount}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">{azn.note}</p>
    </div>
  );
}

/** AZN-метрика обязательств/выплат (сумма всегда строка). */
function ObligationsCard({ data }: { data: FinanceOverview }) {
  const locale = useLocale();
  const o = data.obligations;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("finance.overview.obligations", locale)}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold text-slate-900">{o.totalAzn}</span>
        <span className="text-xs font-medium text-slate-500">AZN</span>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">{t("finance.overview.paid", locale)}</dt>
          <dd className="font-mono text-slate-900">{o.paidAzn}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">{t("finance.overview.remaining", locale)}</dt>
          <dd className="font-mono text-slate-900">{o.remainingAzn}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">{t("finance.overview.count", locale)}</dt>
          <dd className="font-mono text-slate-900">{o.count}</dd>
        </div>
      </dl>
      {o.unknownCount > 0 && (
        <p className="mt-2 text-[11px] text-amber-600">
          {t("finance.overview.obligations_unknown", locale)}: {o.unknownCount}
        </p>
      )}
    </div>
  );
}

function OverviewContent() {
  const locale = useLocale();
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await financeCenterApi.overview(from || undefined, to || undefined));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title={t("finance.overview.title", locale)}
        breadcrumbs={["TravelHub", t("nav.group.finance", locale), t("finance.overview.title", locale)]}
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t("admin.table.refresh", locale)}
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        {busy && !data && <div className="text-sm text-slate-500">{t("admin.table.loading", locale)}</div>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ObligationsCard data={data} />
              <AznCard titleKey="finance.overview.supplier_cash_paid" metric={{ amount: data.supplierPayouts.paidAzn, availability: "OK" }} />
              <AznCard titleKey="finance.overview.expected_margin" metric={data.expectedMargin} />
            </div>
            {/* Supplier payments registry KPI: derived from dueDate + allocations. */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <a href="/app/finance/supplier-payments" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-rose-200">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("finance.supplier_payments.kpi.overdue", locale)}</p>
                <p className="mt-2 font-mono text-xl font-semibold text-rose-600">
                  {formatPrice(data.supplierPayables.overdueAzn, "AZN", locale)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {data.supplierPayables.overdueCount} {t("finance.supplier_payments.kpi.items", locale)}
                </p>
              </a>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("finance.supplier_payments.kpi.due_soon", locale)}</p>
                <p className="mt-2 font-mono text-xl font-semibold text-amber-600">
                  {formatPrice(data.supplierPayables.dueSoonAzn, "AZN", locale)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {data.supplierPayables.dueSoonCount} {t("finance.supplier_payments.kpi.items", locale)}
                </p>
              </div>
              <a href="/app/finance/supplier-payments" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("finance.supplier_payments.kpi.pending", locale)}</p>
                <p className="mt-2 font-mono text-xl font-semibold text-slate-800">
                  {formatPrice(data.supplierPayables.pendingPaymentsAzn, "AZN", locale)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {data.supplierPayables.pendingPaymentsCount} {t("finance.supplier_payments.kpi.items", locale)}
                </p>
              </a>
              <a href="/app/finance/supplier-payments?unallocated=true" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-200">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("finance.supplier_payments.kpi.unallocated", locale)}</p>
                <p className="mt-2 font-mono text-xl font-semibold text-violet-600">
                  {formatPrice(data.supplierPayables.unallocatedAzn, "AZN", locale)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {data.supplierPayables.unallocatedCount} {t("finance.supplier_payments.kpi.items", locale)}
                </p>
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CurrencyBreakdown titleKey="finance.overview.customer_receipts" rows={data.customerReceipts.byCurrency} azn={data.customerReceipts.azn} />
              <CurrencyBreakdown titleKey="finance.overview.customer_debt" rows={data.customerDebt.byCurrency} azn={data.customerDebt.azn} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AznCard titleKey="finance.overview.actual_profit" metric={data.actualProfit} />
              <AznCard titleKey="finance.overview.net_cash_flow" metric={data.netCashFlow} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FinanceOverviewPage() {
  return (
    <Suspense fallback={<MetricsPageSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
