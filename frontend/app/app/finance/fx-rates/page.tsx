"use client";

/**
 * UNIFIED FINANCE CENTER Phase 1 — SupplierFxRate admin.
 *
 * «1 <sourceCurrency> = N AZN» по паре (supplierCode, sourceCurrency).
 * Таблица: ВСЕ поставщики реестра, колонки USD и EUR (курс к AZN) — в каждой
 * ячейке значок ✏️ для редактирования значения; append-only история
 * изменений. Read — finance.fx_rate.read; create/edit —
 * finance.fx_rate.manage (иначе кнопки скрыты, read-only просмотр). AZN→AZN
 * всегда 1 — строка не хранится (валидация формы). Изменение курса влияет
 * только на будущие расчёты — frozen snapshot'ы заявок не мутируют.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import PageHeader from "@/components/PageHeader";
import PanelFrame from "@/components/PanelFrame";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  financeFxApi,
  isValidFxRate,
  type FxSupplier,
  type SupplierFxRate,
  type SupplierFxRateHistoryItem,
} from "@/lib/finance-fx-api";

interface FormState {
  supplierCode: string;
  sourceCurrencyIso: string;
  rate: string;
}

const EMPTY_FORM: FormState = { supplierCode: "", sourceCurrencyIso: "", rate: "" };

const ISO_RE = /^[A-Z]{3}$/;

const shortDateTime = (iso: string | null): string =>
  iso ? iso.slice(0, 19).replace("T", " ") : "—";

/** Строка таблицы: поставщик из реестра + текущие курсы USD/EUR к AZN. */
interface SupplierRow {
  supplierCode: string;
  partnerCode: string | null;
  partnerName: string | null;
  usd: SupplierFxRate | null;
  eur: SupplierFxRate | null;
}

/** Пиктограмма «карандаш» для кнопки редактирования. */
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FxRatesContent() {
  const locale = useLocale();
  const canManage = useCan("finance.fx_rate.manage");

  const [rows, setRows] = useState<SupplierFxRate[] | null>(null);
  const [suppliers, setSuppliers] = useState<FxSupplier[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ title: string; items: SupplierFxRateHistoryItem[] } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await financeFxApi.list());
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setRows(null);
    } finally {
      setBusy(false);
    }
  }, []);

  // Реестр поставщиков (НЕ из строк): best-effort — падение не ломает страницу.
  useEffect(() => {
    financeFxApi.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Строки таблицы = ВСЕ поставщики реестра (даже без курсов) + курсы USD/EUR.
  // Реестр — источник строк (НЕ строки): таблица не пустеет при 0 курсах.
  const groups = useMemo<SupplierRow[]>(() => {
    const bySupplier = new Map<string, SupplierRow>();
    for (const s of suppliers) {
      bySupplier.set(s.supplierCode, {
        supplierCode: s.supplierCode,
        partnerCode: s.partnerCode,
        partnerName: s.partnerName,
        usd: null,
        eur: null,
      });
    }
    for (const r of rows ?? []) {
      let g = bySupplier.get(r.supplierCode);
      if (!g) {
        g = {
          supplierCode: r.supplierCode,
          partnerCode: r.partnerCode,
          partnerName: r.partnerName,
          usd: null,
          eur: null,
        };
        bySupplier.set(r.supplierCode, g);
      }
      if (r.sourceCurrencyIso === "USD") g.usd = r;
      else if (r.sourceCurrencyIso === "EUR") g.eur = r;
    }
    return [...bySupplier.values()];
  }, [rows, suppliers]);

  const openSet = (row?: SupplierFxRate) => {
    setForm(
      row
        ? { supplierCode: row.supplierCode, sourceCurrencyIso: row.sourceCurrencyIso, rate: row.rate }
        : EMPTY_FORM,
    );
    setShowForm(true);
    setError("");
  };

  /** Значок ✏️ в ячейке USD/EUR: панель предзаполнена поставщиком/валютой/курсом. */
  const openEditCell = (supplierCode: string, sourceCurrencyIso: string, rate: string) => {
    setForm({ supplierCode, sourceCurrencyIso, rate });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    const supplierCode = form.supplierCode.trim();
    const sourceCurrencyIso = form.sourceCurrencyIso.trim().toUpperCase();
    const rate = form.rate.trim();
    if (!supplierCode || !sourceCurrencyIso || !rate) {
      setError(t("fx.form.required", locale));
      return;
    }
    if (!ISO_RE.test(sourceCurrencyIso)) {
      setError(t("fx.form.rate_invalid", locale));
      return;
    }
    if (sourceCurrencyIso === "AZN") {
      setError(t("fx.form.azn_reject", locale));
      return;
    }
    if (!isValidFxRate(rate)) {
      setError(t("fx.form.rate_invalid", locale));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await financeFxApi.set({ supplierCode, sourceCurrencyIso, rate });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (group: SupplierRow) => {
    setError("");
    try {
      const res = await financeFxApi.history({ supplierCode: group.supplierCode, pageSize: 50 });
      setHistory({
        title: `${group.partnerCode ?? group.supplierCode}${group.partnerName ? ` · ${group.partnerName}` : ""}`,
        items: res.items,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("nav.fx_rates", locale)}
        breadcrumbs={["TravelHub", t("nav.group.finance", locale), t("nav.fx_rates", locale)]}
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => openSet()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t("fx.actions.add", locale)}
              </button>
            )}
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          {t("fx.page.hint", locale)}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("nav.fx_rates", locale)}</h2>
            {busy && <span className="text-xs text-slate-900">{t("admin.table.loading", locale)}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("fx.table.supplier_code", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("fx.table.supplier_name", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">USD</th>
                  <th className="px-4 py-2.5 font-medium">EUR</th>
                  <th className="px-4 py-2.5 font-medium">{t("fx.table.actions", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.supplierCode} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                      {g.partnerCode ?? g.supplierCode}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-900">{g.partnerName ?? g.supplierCode}</td>
                    {(["USD", "EUR"] as const).map((iso) => {
                      const rate = iso === "USD" ? g.usd : g.eur;
                      return (
                        <td key={iso} className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              {rate ? rate.rate : "—"}
                            </span>
                            {rate && <span className="text-xs text-slate-400">AZN</span>}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => openEditCell(g.supplierCode, iso, rate?.rate ?? "")}
                                title={t("fx.table.edit", locale)}
                                aria-label={`${t("fx.table.edit", locale)} ${iso}`}
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                              >
                                <PencilIcon />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => void openHistory(g)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-800"
                      >
                        {t("fx.actions.history", locale)}
                      </button>
                    </td>
                  </tr>
                ))}
                {rows !== null && groups.length === 0 && !busy && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-900">
                      {t("ops.empty_no_data", locale)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Set / edit rate panel ────────────────────────────────────────── */}
      {showForm && (
        <PanelFrame title={t("fx.form.title", locale)} onClose={() => setShowForm(false)}>
          <div className="space-y-3 p-4">
            <label className="block text-xs font-medium text-slate-900">
              {t("fx.form.supplier", locale)}
              <input
                list="fx-supplier-codes"
                value={form.supplierCode}
                onChange={(e) => setForm((f) => ({ ...f, supplierCode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("fx.form.source_currency", locale)}
              <input
                value={form.sourceCurrencyIso}
                placeholder="USD"
                maxLength={3}
                onChange={(e) => setForm((f) => ({ ...f, sourceCurrencyIso: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm uppercase text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              {t("fx.form.rate", locale)}
              <input
                value={form.rate}
                placeholder="1.70"
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{t("fx.form.rate_hint", locale)}</span>
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
          <datalist id="fx-supplier-codes">
            {(suppliers.length > 0
              ? suppliers
              : (rows ?? []).map((r) => ({ supplierCode: r.supplierCode, partnerCode: r.partnerCode, partnerName: r.partnerName }))
            ).map((s) => (
              <option
                key={s.supplierCode}
                value={s.supplierCode}
                label={s.partnerCode ? `${s.partnerCode}${s.partnerName ? ` · ${s.partnerName}` : ""}` : s.supplierCode}
              />
            ))}
          </datalist>
        </PanelFrame>
      )}

      {/* ── Append-only history ──────────────────────────────────────────── */}
      {history && (
        <PanelFrame title={t("fx.history.title", locale)} subtitle={history.title} onClose={() => setHistory(null)}>
          <div className="divide-y divide-slate-100">
            {history.items.map((item) => (
              <div key={item.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {item.action}: {item.oldRate ?? "—"} → {item.newRate}
                  </span>
                  <span className="text-xs text-slate-500">{shortDateTime(item.changedAt)}</span>
                </div>
                {item.actorName && <div className="mt-0.5 text-xs text-slate-500">{item.actorName}</div>}
              </div>
            ))}
            {history.items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">{t("fx.history.empty", locale)}</div>
            )}
          </div>
        </PanelFrame>
      )}
    </div>
  );
}

export default function FxRatesPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton />}>
      <FxRatesContent />
    </Suspense>
  );
}
