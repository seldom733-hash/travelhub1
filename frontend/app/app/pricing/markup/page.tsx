"use client";

/**
 * Supplier Markup (PHASE 4 §4.1/§4.2) — Admin «Supplier × Service» матрица
 * наценок + MarkupRule lifecycle UX.
 *
 * Матрица рендерится из GET /pricing/markup-matrix: строки/колонки приходят
 * из реестров поставщиков (SupplierAdapterRegistry ∪ FlightSupplierRegistry) —
 * на клиенте НЕТ хардкод-списков поставщиков/сервисов (Gate A). Ячейка
 * кликабельна только при pricing.markup.manage (create с prefill key);
 * NOT_CONFIGURED (0%) визуально отличим от CONFIGURED. Lifecycle:
 * create (DRAFT) → update (CAS expectedVersion → серверный 409 показывается
 * как ошибка + reload версий) → activate / archive + history.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  formatRatePercent,
  pricingApi,
  type MarkupMatrix,
  type MarkupRule,
  type MarkupRuleHistoryItem,
  type MarkupRuleList,
} from "@/lib/pricing-api";

interface FormState {
  code?: string;
  supplierCode: string;
  serviceType: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string;
  expectedVersion?: number;
}

const EMPTY_FORM: FormState = {
  supplierCode: "",
  serviceType: "",
  rate: "",
  effectiveFrom: "",
  effectiveTo: "",
};

const PAGE_SIZE = 20;
const RATE_RE = /^0(\.\d{1,6})?$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO → value для <input type="datetime-local"> (локальная зона браузера). */
const isoToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** <input type="datetime-local"> value → ISO (или undefined = server default). */
const localInputToIso = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const shortDate = (iso: string | null): string => (iso ? iso.slice(0, 10) : "—");

function MarkupAdminContent() {
  const locale = useLocale();
  const canManage = useCan("pricing.markup.manage");

  const [matrix, setMatrix] = useState<MarkupMatrix | null>(null);
  const [list, setList] = useState<MarkupRuleList | null>(null);
  const [page, setPage] = useState(1);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ code: string; items: MarkupRuleHistoryItem[] } | null>(null);

  const loadMatrix = useCallback(async () => {
    try {
      setMatrix(await pricingApi.matrix());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadRules = useCallback(
    async (p: number, supplier: string, service: string, status: string) => {
      setBusy(true);
      try {
        setList(
          await pricingApi.rules.list({
            page: p,
            pageSize: PAGE_SIZE,
            supplierCode: supplier || undefined,
            serviceType: service || undefined,
            status: status || undefined,
          }),
        );
      } catch (e) {
        setError((e as Error).message);
        setList(null);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const reload = useCallback(
    (p = page, supplier = supplierFilter, service = serviceFilter, status = statusFilter) => {
      void loadMatrix();
      void loadRules(p, supplier, service, status);
    },
    [loadMatrix, loadRules, page, supplierFilter, serviceFilter, statusFilter],
  );

  useEffect(() => {
    reload(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = (prefill: Partial<FormState> = {}) => {
    setForm({ ...EMPTY_FORM, ...prefill });
    setShowForm(true);
    setError("");
  };

  const openEdit = (rule: MarkupRule) => {
    setForm({
      code: rule.code,
      supplierCode: rule.supplierCode,
      serviceType: rule.serviceType,
      rate: rule.rate,
      effectiveFrom: isoToLocalInput(rule.effectiveFrom),
      effectiveTo: isoToLocalInput(rule.effectiveTo),
      expectedVersion: rule.version,
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    const supplierCode = form.supplierCode.trim();
    const serviceType = form.serviceType.trim();
    if (!supplierCode || !serviceType || !form.rate.trim()) {
      setError(t("markup.form.required", locale));
      return;
    }
    if (!RATE_RE.test(form.rate.trim())) {
      setError(t("markup.form.rate_invalid", locale));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (form.code) {
        const effectiveTo = form.effectiveTo.trim();
        await pricingApi.rules.update(form.code, {
          rate: form.rate.trim(),
          effectiveFrom: localInputToIso(form.effectiveFrom),
          effectiveTo: effectiveTo ? localInputToIso(effectiveTo) ?? null : null,
          expectedVersion: form.expectedVersion,
        });
      } else {
        await pricingApi.rules.create({
          supplierCode,
          serviceType,
          rate: form.rate.trim(),
          effectiveFrom: localInputToIso(form.effectiveFrom),
          effectiveTo: localInputToIso(form.effectiveTo),
        });
      }
      setShowForm(false);
      reload();
    } catch (e) {
      // 409 (stale expectedVersion / overlap) — показать серверное сообщение
      // и перечитать список, чтобы версии в UI были свежими.
      setError((e as Error).message);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (rule: MarkupRule) => {
    setError("");
    try {
      await pricingApi.rules.activate(rule.code);
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload();
    }
  };

  const handleArchive = async (rule: MarkupRule) => {
    setError("");
    try {
      await pricingApi.rules.archive(rule.code);
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload();
    }
  };

  const openHistory = async (rule: MarkupRule) => {
    setError("");
    try {
      const res = await pricingApi.rules.history(rule.code);
      setHistory({ code: rule.code, items: res.items });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cellOf = (supplierCode: string, serviceType: string) =>
    matrix?.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);

  const rules = list?.items ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("nav.markup_matrix", locale)}
        breadcrumbs={["TravelHub", t("nav.markup_matrix", locale)]}
        actions={
          <button
            type="button"
            onClick={() => reload()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t("admin.table.refresh", locale)}
          </button>
        }
      />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* ── §4.1 Supplier × Service matrix ─────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("markup.matrix.title", locale)}</h2>
            <span className="text-xs text-slate-500">{t("markup.matrix.hint", locale)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("markup.matrix.supplier", locale)}</th>
                  {(matrix?.services ?? []).map((svc) => (
                    <th key={svc} className="px-4 py-2.5 font-medium">
                      {svc}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(matrix?.suppliers ?? []).map((supplier) => (
                  <tr key={supplier.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs font-semibold text-slate-900">{supplier.code}</div>
                      <div className="text-xs text-slate-500">{supplier.name}</div>
                    </td>
                    {(matrix?.services ?? []).map((svc) => {
                      const cell = cellOf(supplier.code, svc);
                      if (!cell) {
                        return (
                          <td key={svc} className="px-4 py-2.5 text-slate-300">
                            —
                          </td>
                        );
                      }
                      const configured = cell.state === "CONFIGURED";
                      const inner = (
                        <>
                          <span className={`font-semibold ${configured ? "text-slate-900" : "text-slate-500"}`}>
                            {formatRatePercent(cell.rate)}
                          </span>
                          {!configured && (
                            <span className="ml-1 block text-[11px] text-slate-400">
                              {t("markup.matrix.not_configured", locale)}
                            </span>
                          )}
                        </>
                      );
                      const cls = `block w-full rounded-lg px-2 py-1 text-left text-sm transition-colors ${
                        configured
                          ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "bg-slate-50 hover:bg-slate-100"
                      }`;
                      const title = cell.ruleCode
                        ? `${cell.ruleCode} v${cell.ruleVersion ?? ""}`
                        : t("markup.matrix.hint", locale);
                      return (
                        <td key={svc} className="px-4 py-2.5">
                          {canManage ? (
                            <button
                              type="button"
                              title={title}
                              onClick={() => openCreate({ supplierCode: supplier.code, serviceType: svc })}
                              className={cls}
                            >
                              {inner}
                            </button>
                          ) : (
                            <span className={cls} title={title}>
                              {inner}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(matrix?.suppliers ?? []).length === 0 && (
                  <tr>
                    <td colSpan={(matrix?.services.length ?? 0) + 1} className="px-4 py-8 text-center text-sm text-slate-900">
                      {t("markup.matrix.empty", locale)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── §4.2 MarkupRule list ───────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{t("markup.rules.title", locale)}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                  reload(1, e.target.value, serviceFilter, statusFilter);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                <option value="">{t("markup.filter.all_suppliers", locale)}</option>
                {(matrix?.suppliers ?? []).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
              <select
                value={serviceFilter}
                onChange={(e) => {
                  setServiceFilter(e.target.value);
                  setPage(1);
                  reload(1, supplierFilter, e.target.value, statusFilter);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                <option value="">{t("markup.filter.all_services", locale)}</option>
                {(matrix?.services ?? []).map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                  reload(1, supplierFilter, serviceFilter, e.target.value);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                <option value="">{t("markup.filter.all_statuses", locale)}</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  {t("markup.actions.create", locale)}
                </button>
              )}
              {busy && <span className="text-xs text-slate-900">{t("admin.table.loading", locale)}</span>}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.code", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.supplier", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.service", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.rate", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.status", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.period", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.version", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("markup.table.actions", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{rule.code}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{rule.supplierCode}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-900">{rule.serviceType}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{formatRatePercent(rule.rate)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={rule.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-900">
                      {shortDate(rule.effectiveFrom)} → {shortDate(rule.effectiveTo)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-900">v{rule.version}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {canManage && rule.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(rule)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              {t("markup.actions.edit", locale)}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleActivate(rule)}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                            >
                              {t("markup.actions.activate", locale)}
                            </button>
                          </>
                        )}
                        {canManage && rule.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            onClick={() => void handleArchive(rule)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            {t("markup.actions.archive", locale)}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void openHistory(rule)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-800"
                        >
                          {t("markup.actions.history", locale)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && !busy && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-900">
                      {t("ops.empty_no_data", locale)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {list && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} onPageChange={(p) => {
              setPage(p);
              reload(p);
            }} />
          )}
        </section>
      </div>

      {/* ── Create / edit rule panel (CAS) ───────────────────────────────── */}
      {showForm && (
        <PanelFrame
          title={form.code ? t("markup.form.edit_title", locale) : t("markup.form.create_title", locale)}
          subtitle={form.code ?? undefined}
          onClose={() => {
            setShowForm(false);
          }}
        >
          <div className="space-y-3 p-4">
            <label className="block text-xs font-medium text-slate-900">
              {t("markup.form.supplier", locale)}
              <input
                list="markup-supplier-codes"
                value={form.supplierCode}
                disabled={Boolean(form.code)}
                onChange={(e) => setForm((f) => ({ ...f, supplierCode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("markup.form.service", locale)}
              <input
                list="markup-service-types"
                value={form.serviceType}
                disabled={Boolean(form.code)}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("markup.form.rate", locale)}
              <input
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder="0.05"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{t("markup.form.rate_hint", locale)}</span>
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("markup.form.effective_from", locale)}
              <input
                type="datetime-local"
                value={form.effectiveFrom}
                onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("markup.form.effective_to", locale)}
              <input
                type="datetime-local"
                value={form.effectiveTo}
                onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("admin.table.loading", locale) : t("markup.actions.save", locale)}
            </button>
          </div>
          <datalist id="markup-supplier-codes">
            {(matrix?.suppliers ?? []).map((s) => (
              <option key={s.code} value={s.code} />
            ))}
          </datalist>
          <datalist id="markup-service-types">
            {(matrix?.services ?? []).map((svc) => (
              <option key={svc} value={svc} />
            ))}
          </datalist>
        </PanelFrame>
      )}

      {/* ── Rule history (MarkupRuleHistory audit) ───────────────────────── */}
      {history && (
        <PanelFrame
          title={t("markup.history.title", locale)}
          subtitle={history.code}
          onClose={() => setHistory(null)}
        >
          <div className="divide-y divide-slate-100">
            {history.items.map((item) => (
              <div key={item.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {item.action} · v{item.version}
                  </span>
                  <span className="text-xs text-slate-500">{item.createdAt.slice(0, 19).replace("T", " ")}</span>
                </div>
                {item.comment && <div className="mt-0.5 text-xs text-slate-600">{item.comment}</div>}
                {item.actorName && <div className="text-xs text-slate-500">{item.actorName}</div>}
              </div>
            ))}
            {history.items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">{t("markup.history.empty", locale)}</div>
            )}
          </div>
        </PanelFrame>
      )}
    </div>
  );
}

export default function MarkupAdminPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton />}>
      <MarkupAdminContent />
    </Suspense>
  );
}
