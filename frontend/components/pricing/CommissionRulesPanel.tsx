"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface CommissionRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  commissionType: string;
  rate: string | null;
  fixedAmount: string | null;
  fixedCurrency: string | null;
  calculationBase: string;
  status: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface CalcResult {
  supplierBasePrice: string;
  storefrontPrice: string;
  markupAmount: string;
  commissionAmount: string;
  netSupplierCost: string;
  platformGrossIncome: string;
  currency: string;
}

interface CommissionMatrix {
  services: string[];
  suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: Array<{ supplierCode: string; serviceType: string; state: string; commissionType: string; rate: string | null; fixedAmount: string | null; calculationBase: string; ruleCode: string | null }>;
}

export default function CommissionRulesPanel() {
  const canManage = useCan("pricing.markup.manage");
  const [tab, setTab] = useState<"rules" | "calculator">("rules");
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [matrix, setMatrix] = useState<CommissionMatrix | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ supplierCode: "", serviceType: "tours", commissionType: "PERCENT", rate: "0.05", fixedAmount: "", fixedCurrency: "AZN", calculationBase: "SUPPLIER_BASE", effectiveFrom: "", effectiveTo: "" });
  const [calc, setCalc] = useState({ base: "1000", currency: "AZN", markupRate: "0.08", commissionType: "PERCENT", commissionRate: "0.08" });
  const [result, setResult] = useState<CalcResult | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, matrixData] = await Promise.all([
        api.get<{ items: CommissionRule[] }>("/pricing/commission-rules?pageSize=100"),
        api.get<CommissionMatrix>("/pricing/commission-matrix"),
      ]);
      setRules(data.items ?? []);
      setMatrix(matrixData);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/pricing/commission-rules", form);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activate = async (code: string) => {
    try {
      await api.post(`/pricing/commission-rules/${code}/activate`, {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const calculate = async () => {
    try {
      const data = await api.post<CalcResult>("/pricing/calculate", {
        supplierBasePrice: calc.base,
        currency: calc.currency,
        markupRate: calc.markupRate,
        commissionType: calc.commissionType,
        commissionRate: calc.commissionRate,
      });
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("rules")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "rules" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Комиссионные</button>
          <button type="button" onClick={() => setTab("calculator")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "calculator" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Проверить расчёт</button>
        </div>
        <span className="text-xs text-slate-400">Комиссия уменьшает себестоимость, наценка — увеличивает цену витрины</span>
      </div>
      {error && <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {tab === "rules" ? (
        <div className="p-4">
          {canManage && (
            <div className="mb-3 grid gap-2 md:grid-cols-4">
              <input value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value.toUpperCase() })} placeholder="Поставщик (ANEX)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value.toLowerCase() })} placeholder="Категория (tours)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <select value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="PERCENT">Процент</option><option value="FIXED">Фиксированная</option></select>
              {form.commissionType === "PERCENT" ? <input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0.05 = 5%" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /> : <input value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} placeholder="Сумма" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />}
              <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <button type="button" onClick={() => void create()} disabled={busy || !form.supplierCode} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Добавить правило</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Поставщик</th>
                  {(matrix?.services ?? []).map((service) => <th key={service} className="px-3 py-2.5">{service}</th>)}
                </tr>
              </thead>
              <tbody>
                {(matrix?.suppliers ?? []).map((supplier) => (
                  <tr key={supplier.code} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2"><div className="font-mono font-semibold text-slate-800">{supplier.code}</div><div className="text-slate-400">{supplier.name}</div></td>
                    {(matrix?.services ?? []).map((service) => {
                      const cell = matrix?.cells.find((c) => c.supplierCode === supplier.code && c.serviceType === service);
                      return (
                        <td key={service} className="px-3 py-2">
                          <button type="button" onClick={() => { setForm({ ...form, supplierCode: supplier.code, serviceType: service }); }} className={`w-full rounded-lg border px-2 py-2 text-left ${cell?.state === "CONFIGURED" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                            <span className="block font-medium">{cell?.state === "CONFIGURED" ? (cell.commissionType === "FIXED" ? `${cell.fixedAmount} ${cell.calculationBase === "STOREFRONT" ? "storefront" : ""}` : `${Number(cell.rate ?? 0) * 100}%`) : "Не установлена"}</span>
                            <span className="block text-[10px] text-slate-400">{cell?.ruleCode ?? "нажмите для правила"}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.length > 0 && <p className="mt-2 text-[11px] text-slate-400">Правил комиссии: {rules.length}. Нажмите ячейку, чтобы заполнить поставщика и категорию в форме выше.</p>}
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={calc.base} onChange={(e) => setCalc({ ...calc, base: e.target.value })} placeholder="Цена поставщика" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
            <input value={calc.currency} onChange={(e) => setCalc({ ...calc, currency: e.target.value.toUpperCase() })} placeholder="Валюта" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
            <input value={calc.markupRate} onChange={(e) => setCalc({ ...calc, markupRate: e.target.value })} placeholder="Наценка 0.08" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
            <input value={calc.commissionRate} onChange={(e) => setCalc({ ...calc, commissionRate: e.target.value })} placeholder="Комиссия 0.08" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
            <button type="button" onClick={() => void calculate()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white sm:col-span-2">Рассчитать</button>
          </div>
          {result && (
            <dl className="grid gap-1 text-xs">
              <Row label="Исходная цена" value={formatPrice(result.supplierBasePrice, result.currency, "ru")} />
              <Row label="Наценка" value={formatPrice(result.markupAmount, result.currency, "ru")} />
              <Row label="Цена витрины" value={formatPrice(result.storefrontPrice, result.currency, "ru")} />
              <Row label="Комиссия" value={formatPrice(result.commissionAmount, result.currency, "ru")} />
              <Row label="Себестоимость" value={formatPrice(result.netSupplierCost, result.currency, "ru")} />
              <Row label="Доход платформы" value={formatPrice(result.platformGrossIncome, result.currency, "ru")} />
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex justify-between border-b border-slate-100 py-1"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value ?? "—"}</dd></div>;
}
