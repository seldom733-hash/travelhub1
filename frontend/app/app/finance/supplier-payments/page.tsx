"use client";

/**
 * Finance Center — Supplier payments registry (2026-10-25).
 *
 * Поток: зарегистрировать платёж (PENDING) → распределить по обязательствам
 * (allocation) → подтвердить исполнение (CONFIRMED; только это уменьшает долг).
 * Нераспределённый остаток виден отдельно; отмена подтверждённого платежа
 * выполняет сторно распределений (аудит).
 *
 * Права: чтение — finance.supplier_payout.read; регистрация/распределение/
 * отмена — finance.supplier_payout.manage; подтверждение —
 * finance.supplier_payment.confirm.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";
import { t, useLocale, formatPrice, formatDate } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { financeFxApi, type FxSupplier } from "@/lib/finance-fx-api";
import {
  financeCenterApi,
  type FinanceOverview,
  type SupplierPayment,
  type SupplierPaymentDocument,
  type CreateSupplierPaymentInput,
} from "@/lib/finance-center-api";

const PAGE_SIZE = 20;
const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"];

const short = (iso: string | null): string => (iso ? iso.slice(0, 10) : "—");

const statusTone = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CONFIRMED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-500";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

function StatusBadge({ status }: { status: string }) {
  const locale = useLocale();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(status)}`}>
      {t(`finance.supplier_payments.status.${status.toLowerCase()}`, locale)}
    </span>
  );
}

export default function SupplierPaymentsPage() {
  const locale = useLocale();
  const canManage = useCan("finance.supplier_payout.manage");
  const canConfirm = useCan("finance.supplier_payment.confirm");

  const [items, setItems] = useState<SupplierPayment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [unallocatedOnly, setUnallocatedOnly] = useState(false);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [suppliers, setSuppliers] = useState<FxSupplier[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateSupplierPaymentInput>({
    supplierCode: "",
    amount: "",
    currency: "AZN",
    aznAmount: "",
    method: "",
    providerRef: "",
    purpose: "",
    comment: "",
  });
  const [allocationDraft, setAllocationDraft] = useState({ obligationCode: "", amount: "", aznAmount: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [selected, setSelected] = useState<SupplierPayment | null>(null);
  const [allocateForm, setAllocateForm] = useState({ obligationCode: "", amount: "", aznAmount: "" });
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [documents, setDocuments] = useState<SupplierPaymentDocument[]>([]);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createIdemRef = useRef<{ key: string; payload: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [list, kpi] = await Promise.all([
        financeCenterApi.listSupplierPayments({
          status: status || undefined,
          search: search || undefined,
          unallocated: unallocatedOnly || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        financeCenterApi.overview(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setOverview(kpi);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setItems(null);
    } finally {
      setBusy(false);
    }
  }, [status, search, unallocatedOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    financeFxApi.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unallocated") === "true") setUnallocatedOnly(true);
  }, []);

  const openDetail = async (code: string) => {
    setActionError("");
    try {
      const [payment, docs] = await Promise.all([
        financeCenterApi.getSupplierPayment(code),
        financeCenterApi.listSupplierPaymentDocuments(code),
      ]);
      setSelected(payment);
      setDocuments(docs.items);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const refreshSelected = async () => {
    if (!selected) return;
    try {
      const [payment, docs] = await Promise.all([
        financeCenterApi.getSupplierPayment(selected.code),
        financeCenterApi.listSupplierPaymentDocuments(selected.code),
      ]);
      setSelected(payment);
      setDocuments(docs.items);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const uploadDocuments = async (files: FileList | null) => {
    if (!selected || !files || files.length === 0) return;
    setDocBusy(true);
    setDocError("");
    try {
      await financeCenterApi.uploadSupplierPaymentDocuments(selected.code, Array.from(files));
      if (fileInputRef.current) fileInputRef.current.value = "";
      const docs = await financeCenterApi.listSupplierPaymentDocuments(selected.code);
      setDocuments(docs.items);
    } catch (e) {
      setDocError((e as Error).message);
    } finally {
      setDocBusy(false);
    }
  };

  const downloadDocument = async (documentId: string) => {
    if (!selected) return;
    setDocError("");
    try {
      const { url } = await financeCenterApi.downloadSupplierPaymentDocument(selected.code, documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDocError((e as Error).message);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!selected) return;
    setDocBusy(true);
    setDocError("");
    try {
      await financeCenterApi.deleteSupplierPaymentDocument(selected.code, documentId);
      const docs = await financeCenterApi.listSupplierPaymentDocuments(selected.code);
      setDocuments(docs.items);
    } catch (e) {
      setDocError((e as Error).message);
    } finally {
      setDocBusy(false);
    }
  };

  const submitCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const allocations =
        allocationDraft.obligationCode.trim() && allocationDraft.amount.trim()
          ? [
              {
                obligationCode: allocationDraft.obligationCode.trim(),
                amount: allocationDraft.amount,
                aznAmount: allocationDraft.aznAmount || undefined,
              },
            ]
          : undefined;
      const input: CreateSupplierPaymentInput = {
        supplierCode: form.supplierCode || undefined,
        amount: form.amount,
        currency: form.currency,
        aznAmount: form.aznAmount || undefined,
        method: form.method || undefined,
        providerRef: form.providerRef || undefined,
        purpose: form.purpose || undefined,
        comment: form.comment || undefined,
        allocations,
      };
      // Retry after lost response with the SAME form payload reuses the key;
      // editing the payload issues a new key (divergent reuse would be a 409).
      const payload = JSON.stringify(input);
      const reused = createIdemRef.current?.payload === payload ? createIdemRef.current.key : null;
      const key = reused ?? crypto.randomUUID();
      createIdemRef.current = { key, payload };
      const created = await financeCenterApi.createSupplierPayment(input, key);
      createIdemRef.current = null;
      setShowCreate(false);
      setForm({ supplierCode: "", amount: "", currency: "AZN", aznAmount: "", method: "", providerRef: "", purpose: "", comment: "" });
      setAllocationDraft({ obligationCode: "", amount: "", aznAmount: "" });
      setNotice(t("finance.supplier_payments.created", locale).replace("{code}", created.code));
      setPage(1);
      await load();
      await openDetail(created.code);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const submitAllocation = async () => {
    if (!selected) return;
    setActionBusy(true);
    setActionError("");
    try {
      await financeCenterApi.allocateSupplierPayment(selected.code, {
        obligationCode: allocateForm.obligationCode.trim(),
        amount: allocateForm.amount,
        aznAmount: allocateForm.aznAmount || undefined,
      });
      setAllocateForm({ obligationCode: "", amount: "", aznAmount: "" });
      await refreshSelected();
      await load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  const runAction = async (kind: "confirm" | "cancel") => {
    if (!selected) return;
    setActionBusy(true);
    setActionError("");
    try {
      if (kind === "confirm") await financeCenterApi.confirmSupplierPayment(selected.code);
      else await financeCenterApi.cancelSupplierPayment(selected.code, t("finance.supplier_payments.cancel_reason", locale));
      await refreshSelected();
      await load();
      setNotice(t(`finance.supplier_payments.${kind}ed`, locale).replace("{code}", selected.code));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  const kpi = overview?.supplierPayables;
  const supplierLabel = useMemo(
    () => new Map(suppliers.map((s) => [s.supplierCode, s.partnerName || s.supplierCode])),
    [suppliers],
  );

  return (
    <div>
      <PageHeader
        title={t("finance.supplier_payments.title", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("finance.supplier_payments.title", locale)]}
        actions={
          <div className="flex items-center gap-2">
            <TableExportButton
              exportUrl="/api/v1/finance/supplier-payments/export"
              extraParams={{ status, search }}
            />
            {canManage ? (
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {t("finance.supplier_payments.create", locale)}
              </button>
            ) : null}
          </div>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {kpi && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-slate-500">{t("finance.supplier_payments.kpi.overdue", locale)}</p>
            <p className="mt-1 text-lg font-semibold text-rose-600">{formatPrice(kpi.overdueAzn, "AZN", locale)}</p>
            <p className="text-xs text-slate-400">
              {kpi.overdueCount} {t("finance.supplier_payments.kpi.items", locale)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-slate-500">{t("finance.supplier_payments.kpi.due_soon", locale)}</p>
            <p className="mt-1 text-lg font-semibold text-amber-600">{formatPrice(kpi.dueSoonAzn, "AZN", locale)}</p>
            <p className="text-xs text-slate-400">
              {kpi.dueSoonCount} {t("finance.supplier_payments.kpi.items", locale)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-slate-500">{t("finance.supplier_payments.kpi.pending", locale)}</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{formatPrice(kpi.pendingPaymentsAzn, "AZN", locale)}</p>
            <p className="text-xs text-slate-400">
              {kpi.pendingPaymentsCount} {t("finance.supplier_payments.kpi.items", locale)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-slate-500">{t("finance.supplier_payments.kpi.unallocated", locale)}</p>
            <p className="mt-1 text-lg font-semibold text-violet-600">{formatPrice(kpi.unallocatedAzn, "AZN", locale)}</p>
            <p className="text-xs text-slate-400">
              {kpi.unallocatedCount} {t("finance.supplier_payments.kpi.items", locale)}
            </p>
          </div>
        </div>
      )}

      {showCreate && canManage && (
        <PanelFrame
          title={t("finance.supplier_payments.create_title", locale)}
          onClose={() => setShowCreate(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.supplier", locale)}</span>
              <select
                value={form.supplierCode}
                onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              >
                <option value="">{t("finance.supplier_payments.field.supplier_placeholder", locale)}</option>
                {suppliers.map((s) => (
                  <option key={s.supplierCode} value={s.supplierCode}>
                    {s.partnerName ? `${s.partnerName} (${s.supplierCode})` : s.supplierCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.amount", locale)}</span>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.currency", locale)}</span>
              <input
                value={form.currency}
                maxLength={3}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.azn", locale)}</span>
              <input
                inputMode="decimal"
                value={form.aznAmount ?? ""}
                onChange={(e) => setForm({ ...form, aznAmount: e.target.value })}
                placeholder={t("finance.supplier_payments.field.azn_hint", locale)}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.method", locale)}</span>
              <input
                value={form.method ?? ""}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.provider_ref", locale)}</span>
              <input
                value={form.providerRef ?? ""}
                onChange={(e) => setForm({ ...form, providerRef: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.purpose", locale)}</span>
              <input
                value={form.purpose ?? ""}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2 xl:col-span-3">
              <span className="mb-1 block text-slate-600">{t("finance.supplier_payments.field.comment", locale)}</span>
              <input
                value={form.comment ?? ""}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-line p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("finance.supplier_payments.allocate_now", locale)}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={allocationDraft.obligationCode}
                onChange={(e) => setAllocationDraft({ ...allocationDraft, obligationCode: e.target.value })}
                placeholder={t("finance.supplier_payments.field.obligation", locale)}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                value={allocationDraft.amount}
                onChange={(e) => setAllocationDraft({ ...allocationDraft, amount: e.target.value })}
                placeholder={t("finance.supplier_payments.field.allocation_amount", locale)}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                value={allocationDraft.aznAmount}
                onChange={(e) => setAllocationDraft({ ...allocationDraft, aznAmount: e.target.value })}
                placeholder={t("finance.supplier_payments.field.allocation_azn", locale)}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>

          {createError && <p className="mt-3 text-sm text-rose-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={creating || !form.amount || !form.currency || !form.supplierCode}
              onClick={() => void submitCreate()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? t("common.loading", locale) : t("finance.supplier_payments.register", locale)}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-slate-600"
            >
              {t("common.close", locale)}
            </button>
          </div>
        </PanelFrame>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm"
          aria-label={t("finance.supplier_payments.field.status", locale)}
        >
          <option value="">{t("finance.supplier_payments.all_statuses", locale)}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`finance.supplier_payments.status.${s.toLowerCase()}`, locale)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unallocatedOnly}
            onChange={(e) => {
              setUnallocatedOnly(e.target.checked);
              setPage(1);
            }}
            className="size-4 rounded border-slate-300"
          />
          {t("finance.supplier_payments.only_unallocated", locale)}
        </label>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("finance.supplier_payments.search", locale)}
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-slate-600"
        >
          {t("common.refresh", locale)}
        </button>
      </div>

      <section className="rounded-xl border border-line bg-white">
        {busy && !items ? (
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
        ) : items && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.date", locale)}</th>
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.code", locale)}</th>
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.supplier", locale)}</th>
                  <th className="px-2 py-2 text-right">{t("finance.supplier_payments.col.amount", locale)}</th>
                  <th className="px-2 py-2 text-right">{t("finance.supplier_payments.col.azn", locale)}</th>
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.status", locale)}</th>
                  <th className="px-2 py-2 text-right">{t("finance.supplier_payments.col.allocated", locale)}</th>
                  <th className="px-2 py-2 text-right">{t("finance.supplier_payments.col.unallocated", locale)}</th>
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.reason", locale)}</th>
                  <th className="px-2 py-2">{t("finance.supplier_payments.col.actions", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 hover:bg-slate-50">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDate(p.occurredAt, locale)}</td>
                    <td className="px-2 py-2 font-medium text-slate-800">{p.code}</td>
                    <td className="px-2 py-2">{supplierLabel.get(p.supplierCode ?? "") ?? p.partnerCode ?? p.supplierCode ?? "—"}</td>
                    <td className="px-2 py-2 text-right">{formatPrice(p.amount, p.currency, locale)}</td>
                    <td className="px-2 py-2 text-right">{formatPrice(p.aznAmount, "AZN", locale)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-2 py-2 text-right">{formatPrice(p.allocatedAzn, "AZN", locale)}</td>
                    <td className="px-2 py-2 text-right">{formatPrice(p.unallocatedAzn, "AZN", locale)}</td>
                    <td className="px-2 py-2 text-xs">
                      {p.unallocatedReason === "NONE" ? (
                        "—"
                      ) : (
                        <span
                          className={
                            p.unallocatedReason === "FX_VARIANCE"
                              ? "rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700"
                              : p.unallocatedReason === "NOT_ALLOCATED"
                                ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
                                : "rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600"
                          }
                        >
                          {t(`finance.supplier_payments.reason.${p.unallocatedReason.toLowerCase()}`, locale)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => void openDetail(p.code)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        {t("finance.supplier_payments.open", locale)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">{t("finance.supplier_payments.empty", locale)}</p>
        )}
        {total > PAGE_SIZE && (
          <div className="mt-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} locale={locale} onPageChange={setPage} />
          </div>
        )}
      </section>

      {selected && (
        <PanelFrame
          title={`${selected.code} · ${t("finance.supplier_payments.detail_title", locale)}`}
          subtitle={`${selected.amount} ${selected.currency} · ${selected.status}`}
          onClose={() => setSelected(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">{t("finance.supplier_payments.col.status", locale)}</p>
              <StatusBadge status={selected.status} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t("finance.supplier_payments.col.amount", locale)}</p>
              <p className="font-medium">{formatPrice(selected.amount, selected.currency, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t("finance.supplier_payments.col.allocated", locale)}</p>
              <p className="font-medium">{formatPrice(selected.allocatedAzn, "AZN", locale)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t("finance.supplier_payments.col.unallocated", locale)}</p>
              <p className="font-medium text-violet-700">{formatPrice(selected.unallocatedAzn, "AZN", locale)}</p>
            </div>
          </div>

          {Number(selected.unallocatedAzn) > 0 && (
            <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              {t(`finance.supplier_payments.reason.${selected.unallocatedReason.toLowerCase()}`, locale)}
              {selected.unallocatedReason === "FX_VARIANCE"
                ? ` · ${t("finance.supplier_payments.fx_variance_hint", locale)}`
                : ""}
            </div>
          )}

          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p>
              {t("finance.supplier_payments.field.supplier", locale)}: <span className="font-medium">{selected.supplierCode ?? "—"}</span>
            </p>
            <p>
              {t("finance.supplier_payments.field.method", locale)}: <span className="font-medium">{selected.method ?? "—"}</span>
            </p>
            <p>
              {t("finance.supplier_payments.field.provider_ref", locale)}: <span className="font-medium">{selected.providerRef ?? "—"}</span>
            </p>
            <p>
              {t("finance.supplier_payments.field.occurred", locale)}: <span className="font-medium">{formatDate(selected.occurredAt, locale)}</span>
            </p>
            {selected.purpose && <p className="sm:col-span-2">{selected.purpose}</p>}
            {selected.comment && <p className="sm:col-span-2 text-slate-500">{selected.comment}</p>}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-slate-700">{t("finance.supplier_payments.allocations", locale)}</h3>
          {selected.allocations.length > 0 ? (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {selected.allocations.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium">{a.obligationCode}</span>
                  <span>
                    {formatPrice(a.amount, selected.currency, locale)} · {formatPrice(a.aznAmount, "AZN", locale)}
                  </span>
                  {a.reversedAt && <span className="text-xs text-rose-600">{t("finance.supplier_payments.reversed", locale)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{t("finance.supplier_payments.no_allocations", locale)}</p>
          )}

          {canManage && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-700">{t("finance.supplier_payments.documents", locale)}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("finance.supplier_payments.documents_hint", locale)}</p>
              {documents.length > 0 ? (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{doc.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {doc.mimeType} · {Math.max(1, Math.round(doc.size / 1024))} KB · {formatDate(doc.createdAt, locale)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void downloadDocument(doc.id)}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          {t("finance.supplier_payments.document_download", locale)}
                        </button>
                        {selected.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={docBusy}
                            onClick={() => void deleteDocument(doc.id)}
                            className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
                          >
                            {t("finance.supplier_payments.document_delete", locale)}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">{t("finance.supplier_payments.documents_empty", locale)}</p>
              )}
              {selected.status !== "CANCELLED" && (
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={docBusy}
                    onChange={(e) => void uploadDocuments(e.target.files)}
                    className="block w-full max-w-md text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                  />
                  {docBusy && <span className="mt-1 inline-block text-xs text-slate-500">{t("common.loading", locale)}</span>}
                </div>
              )}
              {docError && <p className="mt-2 text-xs text-rose-600">{docError}</p>}
            </div>
          )}

          {canManage && selected.status !== "CANCELLED" && (
            <div className="mt-4 rounded-lg border border-dashed border-line p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("finance.supplier_payments.allocate", locale)}
              </p>
              <div className="grid gap-2">
                <input
                  value={allocateForm.obligationCode}
                  onChange={(e) => setAllocateForm({ ...allocateForm, obligationCode: e.target.value })}
                  placeholder={t("finance.supplier_payments.field.obligation", locale)}
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                />
                <input
                  value={allocateForm.amount}
                  onChange={(e) => setAllocateForm({ ...allocateForm, amount: e.target.value })}
                  placeholder={t("finance.supplier_payments.field.allocation_amount", locale)}
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                />
                <input
                  value={allocateForm.aznAmount}
                  onChange={(e) => setAllocateForm({ ...allocateForm, aznAmount: e.target.value })}
                  placeholder={t("finance.supplier_payments.field.allocation_azn", locale)}
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={actionBusy || !allocateForm.obligationCode || !allocateForm.amount}
                onClick={() => void submitAllocation()}
                className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand disabled:opacity-50"
              >
                {t("finance.supplier_payments.add_allocation", locale)}
              </button>
            </div>
          )}

          {actionError && <p className="mt-3 text-sm text-rose-600">{actionError}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {canConfirm && selected.status === "PENDING" && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void runAction("confirm")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("finance.supplier_payments.confirm", locale)}
              </button>
            )}
            {canManage && selected.status !== "CANCELLED" && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void runAction("cancel")}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 disabled:opacity-50"
              >
                {t("finance.supplier_payments.cancel", locale)}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-slate-600"
            >
              {t("common.close", locale)}
            </button>
          </div>
        </PanelFrame>
      )}
    </div>
  );
}
