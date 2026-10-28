"use client";

/**
 * UNIFIED FINANCE CENTER Phase 4 — Supplier Obligations (debts + payouts).
 *
 * Список обязательств поставщиков (AZN) с фильтрами status/supplier и
 * drilldown (деталь + история выплат). Частичная выплата — inline-форма
 * (read — finance.obligation.read; выплата — finance.supplier_payout.manage,
 * иначе кнопка скрыта). UNKNOWN-обязательства (aznAmount null) помечены и
 * блокируют выплату («never zero»). Currency/суммы — строки (Decimal safe).
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import PageHeader from "@/components/PageHeader";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  financeCenterApi,
  obligationStatusTone,
  type SupplierObligation,
  type CreatePayoutInput,
} from "@/lib/finance-center-api";

const PAGE_SIZE = 20;
const STATUSES = ["OPEN", "PARTIALLY_PAID", "CLOSED", "CANCELLED", "ADJUSTED"];

const short = (iso: string | null): string => (iso ? iso.slice(0, 19).replace("T", " ") : "—");

function StatusBadge({ status }: { status: string }) {
  const locale = useLocale();
  const tone = status === "OVERDUE" ? "border-rose-200 bg-rose-50 text-rose-700" : obligationStatusTone(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {t(`finance.obligations.status.${status.toLowerCase()}`, locale)}
    </span>
  );
}

function ObligationsContent() {
  const locale = useLocale();
  const canPay = useCan("finance.supplier_payout.manage");
  const canManage = useCan("finance.obligation.manage");

  const [items, setItems] = useState<SupplierObligation[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<SupplierObligation | null>(null);
  const [terms, setTerms] = useState({ invoiceNumber: "", dueDate: "" });
  const [termsBusy, setTermsBusy] = useState(false);
  const [termsNotice, setTermsNotice] = useState("");
  const [payFor, setPayFor] = useState<SupplierObligation | null>(null);
  const [payForm, setPayForm] = useState<CreatePayoutInput>({ amount: "", currency: "AZN", aznAmount: "", providerRef: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await financeCenterApi.listObligations({
        status: status || undefined,
        supplierCode: supplierCode || undefined,
        overdue: overdueOnly || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setItems(null);
    } finally {
      setBusy(false);
    }
  }, [status, supplierCode, overdueOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (code: string) => {
    try {
      const ob = await financeCenterApi.getObligation(code);
      setDetail(ob);
      setTerms({ invoiceNumber: ob.invoiceNumber ?? "", dueDate: ob.dueDate ? ob.dueDate.slice(0, 10) : "" });
      setTermsNotice("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveTerms = async () => {
    if (!detail) return;
    setTermsBusy(true);
    setTermsNotice("");
    try {
      const updated = await financeCenterApi.updateObligationTerms(detail.code, {
        invoiceNumber: terms.invoiceNumber.trim() || null,
        dueDate: terms.dueDate || null,
      });
      setDetail(updated);
      setTermsNotice(t("finance.obligations.terms.save", locale));
      await load();
    } catch (e) {
      setTermsNotice((e as Error).message);
    } finally {
      setTermsBusy(false);
    }
  };

  const openPay = (ob: SupplierObligation) => {
    setPayFor(ob);
    setPayForm({ amount: "", currency: ob.sourceCurrency, aznAmount: "", providerRef: "", reason: "" });
    setPayError("");
  };

  const submitPay = async () => {
    if (!payFor) return;
    setSaving(true);
    setPayError("");
    try {
      const input: CreatePayoutInput = {
        amount: payForm.amount,
        currency: payForm.currency,
        aznAmount: payForm.aznAmount || undefined,
        providerRef: payForm.providerRef || undefined,
        reason: payForm.reason || undefined,
      };
      await financeCenterApi.createPayout(payFor.code, input);
      setPayFor(null);
      await load();
    } catch (e) {
      setPayError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("finance.obligations.title", locale)}
        breadcrumbs={["TravelHub", t("nav.group.finance", locale), t("finance.obligations.title", locale)]}
        actions={
          <div className="flex items-center gap-2">
            <TableExportButton
              exportUrl="/api/v1/finance/obligations/export"
              extraParams={{ status, supplierCode, overdue: overdueOnly ? "true" : "" }}
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

      <div className="space-y-4 p-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
          >
            <option value="">{t("finance.filter.all_statuses", locale)}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`finance.obligations.status.${s.toLowerCase()}`, locale)}
              </option>
            ))}
          </select>
          <input
            value={supplierCode}
            onChange={(e) => {
              setSupplierCode(e.target.value);
              setPage(1);
            }}
            placeholder={t("finance.obligations.filter.supplier", locale)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => {
                setOverdueOnly(e.target.checked);
                setPage(1);
              }}
              className="size-4 rounded border-slate-300"
            />
            {t("finance.obligations.filter.overdue", locale)}
          </label>
          {busy && <span className="text-xs text-slate-500">{t("admin.table.loading", locale)}</span>}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.code", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.supplier", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.invoice", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.due", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.source", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.azn", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.status", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.remaining", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("finance.obligations.col.actions", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((ob) => (
                  <tr key={ob.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{ob.code}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-900">{ob.partnerCode ?? ob.supplierCode ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{ob.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {ob.dueDate ? (
                        <span className={ob.overdue ? "font-semibold text-rose-600" : "text-slate-700"}>
                          {ob.dueDate.slice(0, 10)}
                          {ob.overdue ? ` · ${t("finance.obligations.overdue", locale)}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                      {ob.sourceAmount} {ob.sourceCurrency}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-900">
                      {ob.amountUnknown ? <span className="text-slate-500">{t("finance.overview.unknown_value", locale)}</span> : ob.aznAmount}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={ob.displayStatus} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-900">{ob.remainingAmount ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => void openDetail(ob.code)} className="text-xs font-medium text-slate-600 hover:text-slate-800">
                          {t("finance.obligations.action.detail", locale)}
                        </button>
                        {canPay && !ob.amountUnknown && (ob.status === "OPEN" || ob.status === "PARTIALLY_PAID" || ob.status === "ADJUSTED") && (
                          <button type="button" onClick={() => openPay(ob)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                            {t("finance.obligations.action.pay", locale)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items !== null && items.length === 0 && !busy && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-900">
                      {t("ops.empty_no_data", locale)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} locale={locale} onPageChange={setPage} />
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {detail && (
        <PanelFrame title={detail.code} subtitle={detail.partnerCode ?? detail.supplierCode ?? undefined} onClose={() => setDetail(null)}>
          <div className="space-y-4 p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-slate-500">{t("finance.obligations.col.source", locale)}</dt>
                <dd className="font-mono text-slate-900">
                  {detail.sourceAmount} {detail.sourceCurrency}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">AZN</dt>
                <dd className="font-mono text-slate-900">{detail.amountUnknown ? t("finance.overview.unknown_value", locale) : `${detail.aznAmount} (${t("finance.obligations.fx_rate", locale)}: ${detail.fxRate ?? "—"})`}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("finance.obligations.col.status", locale)}</dt>
                <dd>
                  <StatusBadge status={detail.displayStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("finance.overview.paid", locale)}</dt>
                <dd className="font-mono text-slate-900">{detail.paidAmount}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("finance.overview.remaining", locale)}</dt>
                <dd className="font-mono text-slate-900">{detail.remainingAmount ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("finance.obligations.col.order", locale)}</dt>
                <dd className="font-mono text-slate-900">{detail.orderCode ?? detail.orderId}</dd>
              </div>
            </dl>

            {/* Счёт поставщика и срок оплаты — метаданные, не суммы (audit). */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("finance.obligations.terms.title", locale)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">
                  {t("finance.obligations.terms.invoice", locale)}
                  <input
                    value={terms.invoiceNumber}
                    disabled={!canManage || detail.status === "CLOSED" || detail.status === "CANCELLED"}
                    onChange={(e) => setTerms((v) => ({ ...v, invoiceNumber: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
                  />
                </label>
                <label className="text-xs font-medium text-slate-700">
                  {t("finance.obligations.terms.due", locale)}
                  <input
                    type="date"
                    value={terms.dueDate}
                    disabled={!canManage || detail.status === "CLOSED" || detail.status === "CANCELLED"}
                    onChange={(e) => setTerms((v) => ({ ...v, dueDate: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
                  />
                </label>
              </div>
              {canManage && detail.status !== "CLOSED" && detail.status !== "CANCELLED" && (
                <button
                  type="button"
                  disabled={termsBusy}
                  onClick={() => void saveTerms()}
                  className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {termsBusy ? t("common.loading", locale) : t("finance.obligations.terms.save", locale)}
                </button>
              )}
              {termsNotice && <p className="mt-2 text-xs text-slate-600">{termsNotice}</p>}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("finance.obligations.payouts", locale)}</h3>
              {(detail.payouts ?? []).length === 0 && <span className="text-xs text-slate-500">{t("ops.empty_no_data", locale)}</span>}
              <ul className="divide-y divide-slate-100">
                {(detail.payouts ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-slate-900">{p.code}</span>
                      <span className="ml-2 font-mono text-xs text-slate-700">
                        {p.amount} {p.currency} → {p.aznAmount} AZN
                      </span>
                      {p.providerRef && <span className="ml-2 text-[11px] text-slate-400">({p.providerRef})</span>}
                    </div>
                    <span className="text-[11px] text-slate-500">{short(p.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PanelFrame>
      )}

      {/* ── Create payout panel ───────────────────────────────────────────── */}
      {payFor && (
        <PanelFrame
          title={t("finance.obligations.pay.title", locale)}
          subtitle={`${payFor.code} · ${t("finance.overview.remaining", locale)}: ${payFor.remainingAmount ?? "—"}`}
          onClose={() => setPayFor(null)}
        >
          <div className="space-y-3 p-4">
            {payError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{payError}</div>}
            <label className="block text-xs font-medium text-slate-900">
              {t("finance.obligations.pay.amount", locale)} ({payFor.sourceCurrency})
              <input
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("finance.obligations.pay.currency", locale)}
              <input
                value={payForm.currency}
                maxLength={3}
                onChange={(e) => setPayForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm uppercase text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("finance.obligations.pay.azn_amount", locale)}
              <input
                value={payForm.aznAmount}
                placeholder={t("finance.obligations.pay.azn_hint", locale)}
                onChange={(e) => setPayForm((f) => ({ ...f, aznAmount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("finance.obligations.pay.provider_ref", locale)}
              <input
                value={payForm.providerRef}
                onChange={(e) => setPayForm((f) => ({ ...f, providerRef: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("finance.obligations.pay.reason", locale)}
              <input
                value={payForm.reason}
                onChange={(e) => setPayForm((f) => ({ ...f, reason: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <button
              type="button"
              disabled={saving || !payForm.amount}
              onClick={() => void submitPay()}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("admin.table.loading", locale) : t("finance.obligations.pay.submit", locale)}
            </button>
          </div>
        </PanelFrame>
      )}
    </div>
  );
}

export default function ObligationsPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton toolbar />}>
      <ObligationsContent />
    </Suspense>
  );
}
