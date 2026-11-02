"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface CommissionRule {
  id: string; code: string; supplierCode: string; serviceType: string; commissionType: string;
  rate: string | null; fixedAmount: string | null; fixedCurrency: string | null; calculationBase: string;
  status: string; version: number; effectiveFrom: string; effectiveTo: string | null; updatedAt: string;
}
interface CommissionMatrix {
  services: string[]; suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: Array<{ supplierCode: string; serviceType: string; state: string; commissionType: string; rate: string | null; fixedAmount: string | null; calculationBase: string; ruleCode: string | null }>;
}
interface HistoryItem { id: string; action: string; version: number; actorName: string | null; comment: string | null; createdAt: string }
interface CalcResult { supplierBasePrice: string; storefrontPrice: string; markupAmount: string; commissionAmount: string; netSupplierCost: string; platformGrossIncome: string; currency: string }

const EMPTY = { supplierCode: "", serviceType: "tours", commissionType: "PERCENT", rate: "0.05", fixedAmount: "", fixedCurrency: "AZN", calculationBase: "SUPPLIER_BASE", effectiveFrom: "", effectiveTo: "" };

export default function CommissionRulesPanel() {
  const canManage = useCan("pricing.markup.manage");
  const [tab, setTab] = useState<"rules" | "calculator">("rules");
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [matrix, setMatrix] = useState<CommissionMatrix | null>(null);
  const [history, setHistory] = useState<{ code: string; items: HistoryItem[] } | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [calc, setCalc] = useState({ base: "1000", currency: "AZN", markupRate: "0.08", commissionRate: "0.08" });
  const [result, setResult] = useState<CalcResult | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, matrixData] = await Promise.all([
        api.get<{ items: CommissionRule[] }>("/pricing/commission-rules?pageSize=100"),
        api.get<CommissionMatrix>("/pricing/commission-matrix"),
      ]);
      setRules(data.items ?? []);
      setMatrix(matrixData);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const reset = () => { setForm({ ...EMPTY }); setEditing(null); };
  const edit = (rule: CommissionRule) => {
    setEditing(rule);
    setForm({ supplierCode: rule.supplierCode, serviceType: rule.serviceType, commissionType: rule.commissionType, rate: rule.rate ?? "0", fixedAmount: rule.fixedAmount ?? "", fixedCurrency: rule.fixedCurrency ?? "AZN", calculationBase: rule.calculationBase, effectiveFrom: rule.effectiveFrom.slice(0, 10), effectiveTo: rule.effectiveTo?.slice(0, 10) ?? "" });
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      if (editing) await api.patch(`/pricing/commission-rules/${editing.code}`, { ...form, expectedVersion: editing.version });
      else await api.post("/pricing/commission-rules", form);
      reset(); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const activate = async (rule: CommissionRule) => {
    if (!window.confirm(`Активировать комиссионное правило ${rule.code}? После активации оно начнёт применяться к новым расчётам.`)) return;
    try { await api.post(`/pricing/commission-rules/${rule.code}/activate`, {}); await load(); } catch (e) { setError((e as Error).message); }
  };
  const archive = async (rule: CommissionRule) => {
    if (!window.confirm(`Архивировать комиссионное правило ${rule.code}?`)) return;
    try { await api.post(`/pricing/commission-rules/${rule.code}/archive`, {}); await load(); } catch (e) { setError((e as Error).message); }
  };
  const openHistory = async (rule: CommissionRule) => {
    try { setHistory({ code: rule.code, items: await api.get<HistoryItem[]>(`/pricing/commission-rules/${rule.code}/history`) }); } catch (e) { setError((e as Error).message); }
  };
  const calculate = async () => {
    try { setResult(await api.post<CalcResult>("/pricing/calculate", { supplierBasePrice: calc.base, currency: calc.currency, markupRate: calc.markupRate, commissionType: "PERCENT", commissionRate: calc.commissionRate })); } catch (e) { setError((e as Error).message); }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("rules")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "rules" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Комиссионные</button>
          <button type="button" onClick={() => setTab("calculator")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === "calculator" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Проверить расчёт</button>
        </div>
        <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">+ Добавить правило</button>
      </div>
      {error && <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {tab === "rules" ? (
        <div className="space-y-4 p-4">
          {canManage && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">{editing ? `Редактирование ${editing.code}` : "Новое правило комиссии"}</h3>{editing && <button type="button" onClick={reset} className="text-xs text-slate-500">Отмена</button>}</div>
              <div className="grid gap-2 md:grid-cols-4">
                <input value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value.toUpperCase() })} placeholder="Поставщик (ANEX)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value.toLowerCase() })} placeholder="Категория (tours)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <select value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="PERCENT">Процент</option><option value="FIXED">Фиксированная</option></select>
                {form.commissionType === "PERCENT" ? <input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0.05 = 5%" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /> : <input value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} placeholder="Сумма" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />}
                <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <select value={form.calculationBase} onChange={(e) => setForm({ ...form, calculationBase: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="SUPPLIER_BASE">База: цена поставщика</option><option value="STOREFRONT">База: цена витрины</option></select>
                <button type="button" onClick={() => void save()} disabled={busy || !form.supplierCode} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "…" : editing ? "Сохранить" : "Создать DRAFT"}</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Поставщик</th>{(matrix?.services ?? []).map((s) => <th key={s} className="px-3 py-2">{s}</th>)}</tr></thead>
              <tbody>
                {(matrix?.suppliers ?? []).map((supplier) => (
                  <tr key={supplier.code} className="border-b border-slate-50">
                    <td className="px-3 py-2"><div className="font-mono font-semibold">{supplier.code}</div><div className="text-slate-400">{supplier.name}</div></td>
                    {(matrix?.services ?? []).map((service) => {
                      const cell = matrix?.cells.find((c) => c.supplierCode === supplier.code && c.serviceType === service);
                      return <td key={service} className="px-3 py-2"><button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY, supplierCode: supplier.code, serviceType: service }); }} className={`w-full rounded-lg border px-2 py-2 text-left ${cell?.state === "CONFIGURED" ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><span className="block font-medium">{cell?.state === "CONFIGURED" ? (cell.commissionType === "FIXED" ? `${cell.fixedAmount}` : `${Number(cell.rate ?? 0) * 100}%`) : "Не установлена"}</span><span className="block text-[10px] text-slate-400">{cell?.ruleCode ?? "создать"}</span></button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-700">Правила комиссионных</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Код</th><th className="px-2 py-2">Поставщик</th><th className="px-2 py-2">Категория</th><th className="px-2 py-2">Тип</th><th className="px-2 py-2">Значение</th><th className="px-2 py-2">База</th><th className="px-2 py-2">Период</th><th className="px-2 py-2">Статус</th><th className="px-2 py-2">Действия</th></tr></thead>
                <tbody>
                  {rules.length === 0 && <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-400">Комиссионных правил нет</td></tr>}
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-50">
                      <td className="px-2 py-2 font-mono">{rule.code}</td><td className="px-2 py-2">{rule.supplierCode}</td><td className="px-2 py-2">{rule.serviceType}</td><td className="px-2 py-2">{rule.commissionType}</td><td className="px-2 py-2">{rule.commissionType === "FIXED" ? `${rule.fixedAmount} ${rule.fixedCurrency ?? ""}` : `${Number(rule.rate ?? 0) * 100}%`}</td><td className="px-2 py-2">{rule.calculationBase}</td><td className="px-2 py-2">{rule.effectiveFrom.slice(0, 10)} — {rule.effectiveTo?.slice(0, 10) ?? "∞"}</td><td className="px-2 py-2">{rule.status}</td>
                      <td className="flex gap-2 px-2 py-2">
                        {canManage && rule.status === "DRAFT" && <button type="button" onClick={() => edit(rule)} className="text-blue-600">Изменить</button>}
                        {canManage && rule.status === "DRAFT" && <button type="button" onClick={() => void activate(rule)} className="text-emerald-600">Активировать</button>}
                        {canManage && rule.status === "ACTIVE" && <button type="button" onClick={() => void archive(rule)} className="text-rose-600">Архивировать</button>}
                        <button type="button" onClick={() => void openHistory(rule)} className="text-slate-500">История</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {history && <div className="rounded-lg border border-slate-200 p-3 text-xs"><div className="mb-2 flex justify-between"><b>История {history.code}</b><button type="button" onClick={() => setHistory(null)} className="text-slate-400">✕</button></div>{history.items.length === 0 ? <span className="text-slate-400">Нет записей</span> : history.items.map((h) => <div key={h.id} className="border-b border-slate-100 py-1">{h.action} · v{h.version} · {h.actorName ?? "—"} · {new Date(h.createdAt).toLocaleString("ru-RU")}</div>)}</div>}
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
          {result && <dl className="grid gap-1 text-xs"><Row label="Исходная цена" value={formatPrice(result.supplierBasePrice, result.currency, "ru")} /><Row label="Наценка" value={formatPrice(result.markupAmount, result.currency, "ru")} /><Row label="Цена витрины" value={formatPrice(result.storefrontPrice, result.currency, "ru")} /><Row label="Комиссия" value={formatPrice(result.commissionAmount, result.currency, "ru")} /><Row label="Себестоимость" value={formatPrice(result.netSupplierCost, result.currency, "ru")} /><Row label="Доход платформы" value={formatPrice(result.platformGrossIncome, result.currency, "ru")} /></dl>}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex justify-between border-b border-slate-100 py-1"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value ?? "—"}</dd></div>;
}
