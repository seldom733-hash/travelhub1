"use client";

/**
 * Finance Center — условия оплаты поставщиков (минимальная модель).
 *
 * Правило применяется ТОЛЬКО к новым обязательствам; срок и snapshot
 * фиксируются при создании (SupplierObligation.paymentTerms*). Поэтому
 * изменение здесь не переписывает уже существующие сроки.
 */
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { t, useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { financeCenterApi, type SupplierPaymentTerms } from "@/lib/finance-center-api";

export default function SupplierPaymentTermsPage() {
  const locale = useLocale();
  const canManage = useCan("finance.obligation.manage");
  const [items, setItems] = useState<SupplierPaymentTerms[] | null>(null);
  const [supplierCode, setSupplierCode] = useState("");
  const [rule, setRule] = useState<"IMMEDIATE" | "NET_DAYS">("NET_DAYS");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await financeCenterApi.listSupplierPaymentTerms());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!supplierCode.trim()) {
      setError(t("finance.payment_terms.supplier_required", locale));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await financeCenterApi.upsertSupplierPaymentTerms({
        supplierCode: supplierCode.trim().toUpperCase(),
        rule,
        days: rule === "IMMEDIATE" ? 0 : days,
      });
      setNotice(t("finance.payment_terms.saved", locale));
      setSupplierCode("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("finance.payment_terms.title", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("finance.payment_terms.title", locale)]}
      />
      <div className="space-y-4 p-6">
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          {t("finance.payment_terms.hint", locale)}
        </p>
        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
        )}

        {canManage && (
          <section className="rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">{t("finance.payment_terms.set", locale)}</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">{t("finance.payment_terms.supplier", locale)}</span>
                <input
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  placeholder="SUMMERTOUR"
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">{t("finance.payment_terms.rule", locale)}</span>
                <select
                  value={rule}
                  onChange={(e) => setRule(e.target.value as "IMMEDIATE" | "NET_DAYS")}
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                >
                  <option value="IMMEDIATE">{t("finance.payment_terms.rule.immediate", locale)}</option>
                  <option value="NET_DAYS">{t("finance.payment_terms.rule.net_days", locale)}</option>
                </select>
              </label>
              {rule === "NET_DAYS" && (
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t("finance.payment_terms.days", locale)}</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-24 rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </label>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {t("common.save", locale)}
              </button>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          {items && items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-900">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">{t("finance.payment_terms.supplier", locale)}</th>
                    <th className="px-3 py-2">{t("finance.payment_terms.rule", locale)}</th>
                    <th className="px-3 py-2">{t("finance.payment_terms.days", locale)}</th>
                    <th className="px-3 py-2">{t("finance.payment_terms.active", locale)}</th>
                    <th className="px-3 py-2">{t("finance.payment_terms.updated", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.supplierCode} className="border-b border-line/60">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.supplierCode}</td>
                      <td className="px-3 py-2">
                        {t(`finance.payment_terms.rule.${row.rule.toLowerCase()}`, locale)}
                      </td>
                      <td className="px-3 py-2">{row.rule === "IMMEDIATE" ? "0" : row.days}</td>
                      <td className="px-3 py-2">{row.active ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{row.updatedAt.slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">{t("finance.payment_terms.empty", locale)}</p>
          )}
        </section>
      </div>
    </div>
  );
}
