"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type BonusBasis = "closed_at" | "service_completed";

interface BonusReport {
  period: string;
  periods: string[];
  basis: BonusBasis;
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
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(() => [new Date().toISOString().slice(0, 7)]);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [managerDeals, setManagerDeals] = useState<Record<string, any[]>>({});
  const [dealsLoading, setDealsLoading] = useState<string | null>(null);
  const [basis, setBasis] = useState<BonusBasis>("closed_at");
  const [report, setReport] = useState<BonusReport | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const months = useMemo(monthOptions, []);
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  const monthLabel = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    const names: Record<string, string[]> = {
      az: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"],
      en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
    };
    const key = locale === "az" ? "az" : locale === "en" ? "en" : "ru";
    return `${names[key][month - 1]} ${year}`;
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<BonusReport>(`/finance/manager-bonuses?periods=${encodeURIComponent(selectedPeriods.join(","))}&basis=${basis}`);
      setReport(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selectedPeriods, basis]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setExpanded(null);
    setManagerDeals({});
  }, [selectedPeriods, basis]);

  const toggleManager = async (row: BonusRow) => {
    if (expanded === row.managerId) { setExpanded(null); return; }
    setExpanded(row.managerId);
    if (managerDeals[row.managerId]) return;
    setDealsLoading(row.managerId);
    try {
      const data = await api.get<{ items: any[] }>(`/finance/deals?manager=${encodeURIComponent(row.manager)}&pageSize=100`);
      const months = new Set(selectedPeriods);
      const monthOf = (value: string | null | undefined) => value ? String(value).slice(0, 7) : "";
      const items = (data.items ?? []).filter((deal) => {
        if (basis === "closed_at") return months.has(monthOf(deal.closedAt));
        const services = deal.services ?? [];
        if (services.length === 0) return false;
        const dates = services.map((service: any) => service.dateTo ?? service.serviceDate);
        if (dates.some((date: string | null | undefined) => !date)) return false;
        const latest = dates.reduce((max: string, date: string) => date > max ? date : max, "");
        return months.has(monthOf(latest));
      });
      setManagerDeals((current) => ({ ...current, [row.managerId]: items }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDealsLoading(null);
    }
  };

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
      await api.post("/finance/manager-bonuses", { managerId: row.managerId, periods: selectedPeriods, basis, percent: row.percent });
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
        <div className="relative text-sm">
          <span className="mb-1 block text-ink/60">{tr("Период", "Dövr", "Period")}</span>
          <button type="button" onClick={() => setMonthsOpen((open) => !open)} className="min-w-52 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm">
            <span className="block truncate">{selectedPeriods.map(monthLabel).join(", ")}</span>
            <span className="pointer-events-none absolute right-2 top-9 text-ink/50">▾</span>
          </button>
          {monthsOpen && <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
            <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-ink/60">
              <span>{tr("Выбрано", "Seçilib", "Selected")}: {selectedPeriods.length}</span>
              <button type="button" onClick={() => setSelectedPeriods([new Date().toISOString().slice(0, 7)])} className="text-brand hover:underline">{tr("Сбросить", "Sıfırla", "Reset")}</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {months.map((value) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-panel">
                <input
                  type="checkbox"
                  checked={selectedPeriods.includes(value)}
                  onChange={() => setSelectedPeriods((current) => {
                    if (current.includes(value)) return current.length > 1 ? current.filter((item) => item !== value) : current;
                    return [...current, value].sort();
                  })}
                  className="size-4 accent-brand"
                />
                {monthLabel(value)}
              </label>)}
            </div>
            <button type="button" onClick={() => setMonthsOpen(false)} className="mt-2 w-full rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">{tr("Готово", "Hazırdır", "Done")}</button>
          </div>}
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-ink/60">{tr("Считать бонус", "Bonusu hesabla", "Calculate bonus")}</span>
          <select value={basis} onChange={(e) => setBasis(e.target.value as BonusBasis)} className="min-w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <option value="closed_at">{tr("По дате закрытия сделки", "Sövdənin bağlanma tarixinə görə", "By deal closing date")}</option>
            <option value="service_completed">{tr("По дате завершения услуги", "Xidmətin tamamlanma tarixinə görə", "By service completion date")}</option>
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
        {basis === "service_completed"
          ? tr(
            "Бонус = маржа по сделкам, все услуги которых завершены в периоде, × процент менеджера. Если в сделке 2+ услуги, она учитывается только после завершения всех услуг.",
            "Bonus = bütün xidmətləri dövrdə tamamlanmış sövdələrin marjası × menecerin faizi. Sövdədə 2+ xidmət varsa, yalnız hamısı tamamlandıqdan sonra hesablanır.",
            "Bonus = margin of deals whose services are all completed in the period × manager percent. A deal with 2+ services counts only after all services are completed.",
          )
          : tr(
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
              <th className="px-4 py-3 text-right">{tr("Завершённых услуг", "Tamamlanmış xidmətlər", "Completed services")}</th>
              <th className="px-4 py-3 text-right">{basis === "service_completed" ? tr("Доход завершённых услуг", "Tamamlanmış xidmətlərin gəliri", "Completed services income") : tr("Маржа за период", "Dövr üzrə marja", "Period margin")}</th>
              <th className="px-4 py-3 text-right">{tr("Процент, %", "Faiz, %", "Percent, %")}</th>
              <th className="px-4 py-3 text-right">{tr("Бонус", "Bonus", "Bonus")}</th>
              <th className="px-4 py-3 text-right">{tr("Действие", "Əməliyyat", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {(report?.items ?? []).map((row) => {
              const bonus = Math.round(row.marginBase * row.percent) / 100;
              const deals = managerDeals[row.managerId] ?? [];
              return <Fragment key={row.managerId}>
                <tr className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">
                    <button type="button" onClick={() => void toggleManager(row)} className="flex items-center gap-1 text-left text-brand hover:underline">
                      <span>{row.manager}</span>
                      <span className="text-[10px] text-ink/50">{expanded === row.managerId ? "▴" : "▾"}</span>
                    </button>
                  </td>
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
                </tr>
                {expanded === row.managerId && <tr className="border-t border-line bg-panel/40">
                  <td colSpan={7} className="px-4 py-3">
                    {dealsLoading === row.managerId ? <div className="text-xs text-ink/60">{tr("Загрузка сделок…", "Sövdələr yüklənir…", "Loading deals…")}</div> : (
                      <div className="overflow-x-auto rounded-lg border border-line bg-white">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-panel text-[10px] uppercase tracking-wide text-ink/60"><tr>
                            <th className="px-2 py-2">{tr("Сделка", "Sövdə", "Deal")}</th>
                            <th className="px-2 py-2">{tr("Клиент", "Müştəri", "Customer")}</th>
                            <th className="px-2 py-2">{tr("Статус", "Status", "Status")}</th>
                            <th className="px-2 py-2 text-right">{tr("Услуг", "Xidmətlər", "Services")}</th>
                            <th className="px-2 py-2 text-right">{tr("Маржа", "Marja", "Margin")}</th>
                          </tr></thead>
                          <tbody>{deals.map((deal) => <tr key={deal.sequence} className="border-t border-line">
                            <td className="px-2 py-2 font-mono"><Link href={`/app/finance/deals/${deal.sequence}`} className="text-brand hover:underline">{deal.sequence}</Link></td>
                            <td className="px-2 py-2">{deal.customerName ?? "—"}</td>
                            <td className="px-2 py-2">{deal.status ?? "—"}</td>
                            <td className="px-2 py-2 text-right font-mono">{(deal.services ?? []).length}</td>
                            <td className="px-2 py-2 text-right font-mono">{money(Number(deal.grossMargin ?? 0))}</td>
                          </tr>)}</tbody>
                        </table>
                        {deals.length === 0 && <div className="px-2 py-4 text-center text-xs text-ink/60">{tr("Сделок за выбранный период нет", "Seçilmiş dövr üçün sövdə yoxdur", "No deals for selected period")}</div>}
                      </div>
                    )}
                  </td>
                </tr>}
              </Fragment>;
            })}
            {report && report.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink/60">{tr("Менеджеров нет", "Menecer yoxdur", "No managers")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
