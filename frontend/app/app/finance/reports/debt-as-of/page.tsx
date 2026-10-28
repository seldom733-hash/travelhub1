"use client";

/**
 * Finance Center — отчёт «задолженность перед поставщиками на дату».
 *
 * Историческая реконструкция: сумма обязательства — последний
 * CREATED/ADJUSTED event <= asOf; оплачено — только CONFIRMED allocations,
 * созданные <= asOf и не сторнированные к этой дате; отмена после asOf не
 * уменьшает прошлое. Legacy-обязательства без событий помечены
 * `LEGACY_CURRENT` (приближение раскрыто, а не выдаётся за точное).
 */
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";
import { t, useLocale, formatPrice } from "@/lib/i18n";
import { financeCenterApi, type DebtAsOfReport } from "@/lib/finance-center-api";

const PAGE_SIZE = 50;
const today = () => new Date().toISOString().slice(0, 10);

export default function SupplierDebtAsOfPage() {
  const locale = useLocale();
  const [asOf, setAsOf] = useState(today());
  const [supplierCode, setSupplierCode] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<DebtAsOfReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await financeCenterApi.supplierDebtAsOf({
        asOf: asOf || undefined,
        supplierCode: supplierCode || undefined,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setReport(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setReport(null);
    } finally {
      setBusy(false);
    }
  }, [asOf, supplierCode, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const tone = (status: string) =>
    status === "OVERDUE" || status === "PARTIALLY_PAID"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "CLOSED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "CANCELLED"
          ? "border-slate-200 bg-slate-100 text-slate-500"
          : status === "UNKNOWN"
            ? "border-violet-200 bg-violet-50 text-violet-700"
            : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div>
      <PageHeader
        title={t("finance.debt_as_of.title", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("finance.debt_as_of.title", locale)]}
        actions={
          <TableExportButton
            exportUrl="/api/v1/finance/reports/supplier-debt/export"
            extraParams={{ asOf, supplierCode, search }}
          />
        }
      />

      <div className="space-y-4 p-6">
        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">{t("finance.debt_as_of.as_of", locale)}</span>
            <input
              type="date"
              value={asOf}
              max={today()}
              onChange={(e) => {
                setAsOf(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">{t("finance.debt_as_of.supplier", locale)}</span>
            <input
              value={supplierCode}
              onChange={(e) => {
                setSupplierCode(e.target.value);
                setPage(1);
              }}
              placeholder="SUMMERTOUR"
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-slate-600">{t("finance.debt_as_of.search", locale)}</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="SBO-… / INV-… / ORD-…"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {t("common.refresh", locale)}
          </button>
        </div>

        {report?.warnings.map((warning) => (
          <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {warning}
          </div>
        ))}

        {report && report.totalsByCurrency.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {report.totalsByCurrency.map((total) => (
              <div key={total.currency} className="rounded-xl border border-line bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("finance.debt_as_of.totals", locale)} · {total.currency}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatPrice(total.remainingAzn, "AZN", locale)}
                </p>
                <p className="text-xs text-slate-500">
                  {t("finance.debt_as_of.paid", locale)}: {formatPrice(total.paidAzn, "AZN", locale)} ·{" "}
                  {total.count} {t("finance.supplier_payments.kpi.items", locale)}
                  {total.unknownCount > 0 ? ` · UNKNOWN: ${total.unknownCount}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          {busy && !report ? (
            <div className="h-40 animate-pulse bg-slate-100" />
          ) : report && report.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-900">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.obligation", locale)}</th>
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.invoice", locale)}</th>
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.supplier", locale)}</th>
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.order", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.debt_as_of.col.amount", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.debt_as_of.paid", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.debt_as_of.col.remaining", locale)}</th>
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.due", locale)}</th>
                    <th className="px-3 py-2">{t("finance.debt_as_of.col.status", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((row) => (
                    <tr key={row.obligationCode} className="border-b border-line/60 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.obligationCode}</td>
                      <td className="px-3 py-2 text-xs">{row.invoiceNumber ?? "—"}</td>
                      <td className="px-3 py-2">{row.partnerCode ?? row.supplierCode ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.orderCode ?? row.bookingCode ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.sourceAmount} {row.sourceCurrency}
                        <span className="ml-1 text-[10px] text-slate-400">{row.aznAmount ? `(${row.aznAmount} AZN)` : ""}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{row.paidAzn}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.remainingAzn ?? "UNKNOWN"}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.dueDate ? (
                          <span className={row.overdue ? "font-semibold text-rose-600" : ""}>
                            {row.dueDate}
                            {row.overdue ? ` · ${t("finance.obligations.overdue", locale)}` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone(row.status)}`}>
                          {row.status}
                        </span>
                        {row.precision === "LEGACY_CURRENT" && (
                          <span className="ml-1 text-[10px] text-amber-600">legacy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">{t("finance.debt_as_of.empty", locale)}</p>
          )}
        </section>

        {report && report.total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={report.total} locale={locale} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
