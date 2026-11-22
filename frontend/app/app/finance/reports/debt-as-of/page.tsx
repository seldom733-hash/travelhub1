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
import { financeCenterApi, type ClientDebtAsOfReport, type DebtAsOfReport } from "@/lib/finance-center-api";
import { api } from "@/lib/api";
import { dealStatus } from "@/lib/deals-i18n";
import DateTextInput from "@/components/forms/DateTextInput";

const PAGE_SIZE = 25;
const today = () => new Date().toISOString().slice(0, 10);

function debtStatusLabel(locale: string, status: string): string {
  const labels: Record<string, Record<string, string>> = {
    OPEN: { ru: "Открыт", az: "Açıq", en: "Open" },
    PARTIALLY_PAID: { ru: "Частично оплачен", az: "Qismən ödənilib", en: "Partially paid" },
    CLOSED: { ru: "Закрыт", az: "Bağlı", en: "Closed" },
    CANCELLED: { ru: "Отменён", az: "Ləğv edilib", en: "Cancelled" },
    UNKNOWN: { ru: "Неизвестно", az: "Naməlum", en: "Unknown" },
    OVERDUE: { ru: "Просрочен", az: "Gecikmiş", en: "Overdue" },
  };
  return labels[status]?.[locale] ?? dealStatus(locale as "ru" | "az" | "en", status);
}

function warningLabel(locale: string, warning: string): string {
  const match = warning.match(/^(\d+) obligation/);
  const count = match?.[1] ?? "";
  if (locale === "az") return `${count} öhdəliyin tarixi məbləğ hadisəsi yoxdur; tarixə məbləğ CƏRİ dəyərdir (LEGACY_CURRENT).`;
  if (locale === "en") return `${count} obligation(s) have no historical amount events; their as-of amount is the CURRENT value (LEGACY_CURRENT).`;
  return `${count} обязательств без исторических событий суммы; сумма на дату — ТЕКУЩЕЕ значение (LEGACY_CURRENT).`;
}

function paymentStatusLabel(locale: string, status: string): string {
  const labels: Record<string, Record<string, string>> = {
    UNPAID: { ru: "Не оплачено", az: "Ödənilməyib", en: "Unpaid" },
    PARTIALLY_PAID: { ru: "Частично оплачено", az: "Qismən ödənilib", en: "Partially paid" },
    PAID: { ru: "Оплачено", az: "Ödənilib", en: "Paid" },
    REFUNDED: { ru: "Возвращено", az: "Qaytarılıb", en: "Refunded" },
  };
  return labels[status]?.[locale] ?? status;
}

export default function SupplierDebtAsOfPage() {
  const locale = useLocale();
  const [asOf, setAsOf] = useState(today());
  const [supplierCode, setSupplierCode] = useState("");
  const [partners, setPartners] = useState<Array<{ code: string; name: string }>>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [report, setReport] = useState<DebtAsOfReport | null>(null);
  const [clientReport, setClientReport] = useState<ClientDebtAsOfReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadClientDebt = useCallback(async () => {
    try {
      setClientReport(await financeCenterApi.clientDebtAsOf({ asOf: asOf || undefined, search: search || undefined, page: clientPage, pageSize: PAGE_SIZE }));
    } catch {
      setClientReport(null);
    }
  }, [asOf, search, clientPage]);

  useEffect(() => {
    api.get<{ items?: Array<{ code: string; name: string }> }>("/partners?pageSize=300")
      .then((data) => setPartners(data.items ?? [])).catch(() => setPartners([]));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await financeCenterApi.supplierDebtAsOf({
        asOf: asOf || undefined,
        supplierCode: supplierCode || undefined,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        excludeClosed: true,
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
    void loadClientDebt();
  }, [load, loadClientDebt]);

  const tone = (status: string) =>
    status === "OVERDUE" || status === "PARTIALLY_PAID"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "CLOSED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "CANCELLED"
          ? "border-line bg-panel text-ink/60"
          : status === "UNKNOWN"
            ? "border-violet-200 bg-violet-50 text-violet-700"
            : "border-brand/20 bg-brand/10 text-brand-dark";

  return (
    <div>
      <PageHeader
        title={t("finance.debt_as_of.title", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("finance.debt_as_of.title", locale)]}
        actions={
          <TableExportButton
            exportUrl="/api/v1/finance/reports/supplier-debt/export"
            extraParams={{ asOf, supplierCode, search, excludeClosed: "1" }}
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
            <span className="mb-1 block text-ink/60">{t("finance.debt_as_of.as_of", locale)}</span>
            <DateTextInput
              value={asOf}
              max={today()}
              onChange={(v) => {
                setAsOf(v);
                setPage(1);
                setClientPage(1);
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/60">{t("finance.debt_as_of.supplier", locale)}</span>
            <select
              value={supplierCode}
              onChange={(e) => {
                setSupplierCode(e.target.value);
                setPage(1);
              }}
              className="min-w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("finance.debt_as_of.supplier", locale)}</option>
              {partners.map((partner) => <option key={partner.code} value={partner.code}>{partner.name}</option>)}
            </select>
          </label>
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-ink/60">{t("finance.debt_as_of.search", locale)}</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setClientPage(1);
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
            {warningLabel(locale, warning)}
          </div>
        ))}

        {report && report.totalsByCurrency.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {report.totalsByCurrency.map((total) => (
              <div key={total.currency} className="rounded-xl border border-line bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/60">
                  {t("finance.debt_as_of.totals", locale)} · {total.currency}
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {formatPrice(total.remainingAzn, "AZN", locale)}
                </p>
                <p className="text-xs text-ink/60">
                  {t("finance.debt_as_of.paid", locale)}: {formatPrice(total.paidAzn, "AZN", locale)} ·{" "}
                  {total.count} {t("finance.supplier_payments.kpi.items", locale)}
                  {total.unknownCount > 0 ? ` · UNKNOWN: ${total.unknownCount}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{t("finance.debt_as_of.section_title", locale)}</h2>
            <p className="mt-0.5 text-xs text-ink/60">{t("finance.debt_as_of.section_hint", locale)}</p>
          </div>
          {busy && !report ? (
            <div className="h-40 animate-pulse bg-panel" />
          ) : report && report.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-ink">
                <thead>
                  <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-ink/60">
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
                    <tr key={row.obligationCode} className="border-b border-line/60 hover:bg-panel">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.obligationCode}</td>
                      <td className="px-3 py-2 text-xs">{row.invoiceNumber ?? "—"}</td>
                      <td className="px-3 py-2">{row.partnerName ?? row.partnerCode ?? row.supplierCode ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.orderCode ?? row.bookingCode ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.sourceAmount} {row.sourceCurrency}
                        <span className="ml-1 text-[10px] text-ink/60">{row.aznAmount ? `(${row.aznAmount} AZN)` : ""}</span>
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
                          {debtStatusLabel(locale, row.status)}
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
            <p className="py-10 text-center text-sm text-ink/60">{t("finance.debt_as_of.empty", locale)}</p>
          )}
        </section>

        {report && report.total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={report.total} locale={locale} onPageChange={setPage} />
        )}

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{t("finance.client_debt.title", locale)}</h2>
            <p className="mt-0.5 text-xs text-ink/60">{t("finance.client_debt.hint", locale)}</p>
          </div>
          {clientReport && clientReport.totalsByCurrency.length > 0 && (
            <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-3">
              {clientReport.totalsByCurrency.map((total) => (
                <div key={total.currency} className="rounded-xl border border-line bg-white p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink/60">{total.currency} · {total.count}</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{formatPrice(total.debt, total.currency, locale)}</div>
                  <div className="text-xs text-ink/60">{t("finance.client_debt.paid_of", locale)} {formatPrice(total.amount, total.currency, locale)} {t("finance.debt_as_of.paid", locale).toLowerCase()} {formatPrice(total.paid, total.currency, locale)}</div>
                </div>
              ))}
            </div>
          )}
          {clientReport && clientReport.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-ink">
                <thead>
                  <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-ink/60">
                    <th className="px-3 py-2">{t("finance.client_debt.col.order", locale)}</th>
                    <th className="px-3 py-2">{t("finance.client_debt.col.customer", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.client_debt.col.amount", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.client_debt.col.paid", locale)}</th>
                    <th className="px-3 py-2 text-right">{t("finance.client_debt.col.debt", locale)}</th>
                    <th className="px-3 py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {clientReport.items.map((row) => (
                    <tr key={row.orderCode} className="border-b border-line/60 hover:bg-panel">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.sequence ?? row.orderCode}</td>
                      <td className="px-3 py-2"><div>{row.customerName}</div><div className="text-[10px] text-ink/60">{row.customerPhone ?? "—"}</div></td>
                      <td className="px-3 py-2 text-right font-mono">{formatPrice(row.amount, row.currency, locale)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">{formatPrice(row.paid, row.currency, locale)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-rose-700">{formatPrice(row.debt, row.currency, locale)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone(row.status)}`}>{dealStatus(locale, row.status)}</span>
                        <span className="ml-1 text-[10px] text-ink/60">{paymentStatusLabel(locale, row.paymentStatus)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-ink/60">{t("finance.client_debt.empty", locale)}</p>
          )}
        </section>

        {clientReport && clientReport.total > PAGE_SIZE && (
          <Pagination page={clientPage} pageSize={PAGE_SIZE} total={clientReport.total} locale={locale} onPageChange={setClientPage} />
        )}
      </div>
    </div>
  );
}