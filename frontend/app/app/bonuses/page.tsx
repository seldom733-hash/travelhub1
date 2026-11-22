"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface BonusRow {
  managerId: string;
  manager: string;
  closedDeals: number;
  closedServices: number;
  marginBase: number;
  percent: number;
  bonusAmount: number;
  saved: boolean;
}

interface BonusReport {
  period: string;
  start: string;
  end: string;
  items: BonusRow[];
}

function monthOptions(): string[] {
  const now = new Date();
  const values: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    values.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return values;
}

export default function ManagerBonusesPage() {
  const locale = useLocale();
  const canEdit = useCan("finance.deal.amounts.write");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<BonusReport | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const months = useMemo(monthOptions, []);
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  const monthLabel = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
      locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<BonusReport>(`/finance/manager-bonuses?period=${period}`);
      setReport(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const setPercent = (managerId: string, value: string) => {
    setReport((current) => current ? {
      ...current,
      items: current.items.map((row) => row.managerId === managerId ? { ...row, percent: Number(value) || 0 } : row),
    } : current);
  };

  const save = async (row: BonusRow) => {
    setSaving(row.managerId);
    setError("");
    setNotice("");
    try {
      await api.post("/finance/manager-bonuses", { managerId: row.managerId, period, percent: row.percent });
      setNotice(tr("Процент сохранён", "Faiz saxlanıldı", "Percent saved"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const money = (value: number) => `${value.toLocaleString(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;

  return <div className="space-y-4 p-4 lg:p-6">
    <PageHeader
      title={tr("Бонусы менеджерам", "Menecerlərə bonuslar", "Manager bonuses")}
      breadcrumbs={["Navitravel", tr("Коммерция", "Kommersiya", "Commercial"), tr("Бонусы менеджерам", "Menecerlərə bonuslar", "Manager bonuses")]}
    />

    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-ink/60">{tr("Период", "Dövr", "Period")}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm">
            {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-panel">
          {tr("Обновить", "Yenilə", "Refresh")}
        </button>
        <div className="text-xs text-ink/60">
          {report ? `${report.start} — ${report.end}` : ""}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink/60">
        {tr(
          "Бонус = маржа закрытых сделок за период × процент менеджера. Процент задаётся вручную для каждого менеджера.",
          "Bonus = dövr üzrə bağlanmış sövdələrin marjası × menecerin faizi. Faiz hər menecer üçün əl ilə təyin edilir.",
          "Bonus = closed-deal margin for the period × manager percent. The percent is set manually per manager.",
        )}
      </p>
    </section>

    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-panel text-[11px] uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">{tr("Менеджер", "Menecer", "Manager")}</th>
              <th className="px-4 py-3 text-right">{tr("Закрытых сделок", "Bağlanmış sövdələr", "Closed deals")}</th>
              <th className="px-4 py-3 text-right">{tr("Закрытых услуг", "Bağlanmış xidmətlər", "Closed services")}</th>
              <th className="px-4 py-3 text-right">{tr("Маржа за период", "Dövr üzrə marja", "Period margin")}</th>
              <th className="px-4 py-3 text-right">{tr("Процент, %", "Faiz, %", "Percent, %")}</th>
              <th className="px-4 py-3 text-right">{tr("Бонус", "Bonus", "Bonus")}</th>
              <th className="px-4 py-3 text-right">{tr("Действие", "Əməliyyat", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {(report?.items ?? []).map((row) => {
              const bonus = Math.round(row.marginBase * row.percent) / 100;
              return <tr key={row.managerId} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{row.manager}</td>
                <td className="px-4 py-3 text-right font-mono">{row.closedDeals}</td>
                <td className="px-4 py-3 text-right font-mono">{row.closedServices}</td>
                <td className="px-4 py-3 text-right font-mono">{money(row.marginBase)}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={row.percent}
                    disabled={!canEdit}
                    onChange={(e) => setPercent(row.managerId, e.target.value)}
                    className="w-24 rounded-lg border border-line px-2 py-1.5 text-right text-sm disabled:bg-panel"
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-ink">{money(bonus)}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && <button type="button" disabled={saving === row.managerId} onClick={() => void save(row)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving === row.managerId ? tr("Сохранение…", "Saxlanılır…", "Saving…") : tr("Сохранить", "Saxla", "Save")}
                  </button>}
                  {!canEdit && row.saved && <span className="text-xs text-ink/50">{tr("Сохранено", "Saxlanıb", "Saved")}</span>}
                </td>
              </tr>;
            })}
            {report && report.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink/60">{tr("Менеджеров нет", "Menecer yoxdur", "No managers")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
