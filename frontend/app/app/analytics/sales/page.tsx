"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const PRESETS: Array<[string, string]> = [
  ["TODAY", "Сегодня"], ["YESTERDAY", "Вчера"], ["LAST_7_DAYS", "Последние 7 дней"],
  ["LAST_30_DAYS", "Последние 30 дней"], ["CURRENT_WEEK", "Текущая неделя"], ["PREVIOUS_WEEK", "Прошлая неделя"],
  ["CURRENT_MONTH", "Текущий месяц"], ["PREVIOUS_MONTH", "Прошлый месяц"], ["CURRENT_QUARTER", "Текущий квартал"],
  ["PREVIOUS_QUARTER", "Прошлый квартал"], ["CURRENT_YEAR", "Текущий год"], ["PREVIOUS_YEAR", "Прошлый год"],
  ["CUSTOM", "Произвольный период"],
];
const TABS: Array<[string, string]> = [
  ["overview", "Общая аналитика"], ["managers", "Менеджеры"], ["activity", "Активность и контроль"],
  ["funnel", "Воронка продаж"], ["deals", "Завершённые сделки"], ["distribution", "Распределение"],
];
const KPI_LABELS: Record<string, string> = {
  requestsTotal: "Всего новых заявок", assigned: "Назначено менеджерам", accepted: "Принято в работу",
  inWork: "Заявки в работе", noFirstResponse: "Без первого ответа", proposalsSent: "Отправлено предложений",
  lostRequests: "Потерянные заявки", overdueRequests: "Просроченные заявки",
  ordersCreated: "Создано заказов", bookingsConfirmed: "Подтверждено бронирований",
  completedDeals: "Завершено сделок", closedDeals: "Окончательно закрыто",
  cancelledOrders: "Отменено заказов", cancelledBookings: "Отменено бронирований",
  conversionRequestOrder: "Request → Order", conversionOrderBooking: "Order → Booking",
  conversionRequestBooking: "Request → Booking", conversionRequestCompleted: "Request → завершено",
  conversionRequestClosed: "Request → закрыто", salesAmount: "Сумма продаж", capturedRevenue: "Фактическая выручка",
  costAmount: "Себестоимость", grossProfit: "Валовая прибыль", avgCheck: "Средний чек",
  refunds: "Сумма возвратов", completedResult: "Фин. результат завершённых",
  closedResult: "Фин. результат закрытых",
};
const GROUPS: Array<[string, string[]]> = [
  ["Заявки", ["requestsTotal", "assigned", "accepted", "inWork", "noFirstResponse", "proposalsSent", "lostRequests", "overdueRequests"]],
  ["Продажи", ["ordersCreated", "bookingsConfirmed", "completedDeals", "closedDeals", "cancelledOrders", "cancelledBookings"]],
  ["Конверсия", ["conversionRequestOrder", "conversionOrderBooking", "conversionRequestBooking", "conversionRequestCompleted", "conversionRequestClosed"]],
  ["Финансы", ["salesAmount", "capturedRevenue", "costAmount", "grossProfit", "avgCheck", "refunds", "completedResult", "closedResult"]],
];

function money(v: any) { return Number(v ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }
function dt(v: any) { return v ? new Date(v).toLocaleString("ru-RU") : "—"; }
function pct(v: any) { return `${Number(v ?? 0).toFixed(1)}%`; }
function deltaText(x: any) {
  if (x?.pct == null) return x?.delta > 0 ? `+${money(x.delta)}` : x?.delta < 0 ? money(x.delta) : "—";
  return `${x.pct > 0 ? "+" : ""}${x.pct.toFixed(1)}%`;
}

export function SalesAnalyticsView({ initialTab = "overview" }: { initialTab?: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState("CURRENT_MONTH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerId, setManagerId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [source, setSource] = useState("");
  const [tab] = useState(initialTab);
  const [dealTab, setDealTab] = useState<"completed" | "closed">("completed");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [managerOptions, setManagerOptions] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState("all");
  const [drill, setDrill] = useState<any>(null);
  const [drillLoading, setDrillLoading] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("preset")) setPreset(q.get("preset")!);
    if (q.get("startDate")) setStartDate(q.get("startDate")!);
    if (q.get("endDate")) setEndDate(q.get("endDate")!);
    if (q.get("managerId")) setManagerId(q.get("managerId")!);
    if (q.get("serviceType")) setServiceType(q.get("serviceType")!);
    if (q.get("source")) setSource(q.get("source")!);
    if (q.get("dealTab") === "closed") setDealTab("closed");
  }, []);

  async function openDrilldown(k: string) {
    setDrillLoading(k); setError("");
    try {
      const r = await api.get<any>(`/sales-analytics/drilldown?metric=${encodeURIComponent(k)}&${query}`);
      setDrill(r);
    } catch (e) { setError((e as Error).message); }
    finally { setDrillLoading(""); }
  }

  function focusKpi(k: string) {    if (["completedDeals", "closedDeals", "salesAmount", "capturedRevenue", "grossProfit", "completedResult", "closedResult"].includes(k)) {
      setDealTab(k === "closedDeals" || k === "closedResult" ? "closed" : "completed");
      router.push(`/app/analytics/sales/deals?${query}&dealTab=${k === "closedDeals" || k === "closedResult" ? "closed" : "completed"}`);
      return;
    }
    if (k === "ordersCreated" || k === "bookingsConfirmed" || k.startsWith("conversion")) { router.push(`/app/analytics/sales/funnel?${query}`); return; }
    router.push(`/app/analytics/sales/activity?${query}`);
  }

  const query = useMemo(() => {
    const qs = new URLSearchParams({ preset, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
    if (preset === "CUSTOM") { qs.set("startDate", startDate); qs.set("endDate", endDate); }
    if (managerId) qs.set("managerId", managerId);
    if (serviceType) qs.set("serviceType", serviceType);
    if (source) qs.set("source", source);
    return qs.toString();
  }, [preset, startDate, endDate, managerId, serviceType, source]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.search = query;
    window.history.replaceState(null, "", url);
  }, [query]);


  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    api.get<any>(`/sales-analytics/dashboard?${query}`)
      .then((r) => { if (alive) { setData(r); if (!managerId) setManagerOptions(r.managers ?? []); } })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  const managers = data?.managers ?? [];
  const kpis = data?.kpis ?? {};
  const filteredActivity = useMemo(() => {
    const rows = data?.activity ?? [];
    if (activityFilter === "no_manager") return rows.filter((r: any) => !r.managerId);
    if (activityFilter === "no_response") return rows.filter((r: any) => !r.firstContactAt);
    if (activityFilter === "overdue") return rows.filter((r: any) => r.overdue);
    if (activityFilter === "unprocessed") return rows.filter((r: any) => !r.processingStartedAt);
    if (activityFilter === "no_proposal") return rows.filter((r: any) => !r.proposalSent);
    if (activityFilter === "waiting_customer") return rows.filter((r: any) => r.waitingCustomer);
    if (activityFilter === "waiting_supplier") return rows.filter((r: any) => r.waitingSupplier);
    return rows;
  }, [data, activityFilter]);
  const periodLabel = data?.period ? `${new Date(data.period.start).toLocaleDateString("ru-RU")} — ${new Date(new Date(data.period.end).getTime() - 1).toLocaleDateString("ru-RU")}` : "";

  return (
    <div className="min-h-screen bg-[#f6f4ef] p-4 text-slate-800 lg:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Аналитика продаж</h1>
          <p className="mt-1 text-xs text-slate-500">Заявки → заказы → бронирования → завершённые и закрытые сделки. Период: {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-1"><span className="text-slate-500">Период</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5">
              {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {preset === "CUSTOM" && <>
            <label className="flex flex-col gap-1"><span className="text-slate-500">С</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5" /></label>
            <label className="flex flex-col gap-1"><span className="text-slate-500">По</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5" /></label>
          </>}
          <label className="flex flex-col gap-1"><span className="text-slate-500">Менеджер</span>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="min-w-40 rounded-lg border bg-white px-2 py-1.5">
              <option value="">Все</option>
              {managerOptions.map((m: any) => <option key={m.managerId ?? "none"} value={m.managerId ?? ""}>{m.manager}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="text-slate-500">Услуга</span>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5">
              <option value="">Все</option>{["TOUR_PACKAGE", "HOTEL", "FLIGHT", "TRANSFER", "INSURANCE", "VISA", "CRUISE", "OTHER"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="text-slate-500">Источник</span><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Все" className="w-28 rounded-lg border bg-white px-2 py-1.5" /></label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-[#e5e2da] bg-white p-1">
        {TABS.map(([v, l]) => { const href = `${v === "overview" ? "/app/analytics/sales" : `/app/analytics/sales/${v}`}?${query}`; return <Link key={v} href={href} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === v ? "bg-[#0f6b5f] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</Link>; })}
      </div>

      {loading && <div className="rounded-xl bg-white p-6 text-sm text-slate-500">Загрузка аналитики…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {!loading && !error && data && <>
        {tab === "overview" && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {GROUPS.map(([title, keys]) => (
              <div key={title} className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
                <div className="space-y-1.5">{keys.map((k) => <button type="button" key={k} onClick={() => void openDrilldown(k)} className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-emerald-50"><span className="text-slate-500">{KPI_LABELS[k] ?? k}</span><span className="text-right font-semibold">{k.startsWith("conversion") ? pct(kpis[k]?.value) : k.toLowerCase().includes("amount") || k.toLowerCase().includes("revenue") || k.toLowerCase().includes("profit") || k.toLowerCase().includes("result") || k === "avgCheck" || k === "refunds" ? money(kpis[k]?.value) : kpis[k]?.value ?? 0}<span className={`ml-1 text-[9px] ${(kpis[k]?.delta ?? 0) < 0 ? "text-rose-500" : "text-emerald-600"}`}>{deltaText(kpis[k])}</span></span></button>)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border bg-white p-3"><div className="mb-2 text-xs font-semibold">Причины потерь</div>{(data.lossReasons ?? []).length === 0 ? <div className="text-[11px] text-slate-400">Потерь за период нет</div> : (data.lossReasons ?? []).map((r: any) => <div key={r.reason} className="flex justify-between border-t border-slate-100 py-1 text-[11px]"><span className="truncate text-slate-500">{r.reason}</span><b>{r.count}</b></div>)}</div>
            <div className="rounded-xl border bg-white p-3 lg:col-span-2"><div className="mb-2 text-xs font-semibold">Динамика заявок и заказов</div><div className="flex h-28 items-end gap-1">{(data.series ?? []).slice(-30).map((r: any) => <div key={r.date} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${r.date}: заявки ${r.requests}, заказы ${r.orders}`}><div className="w-2 rounded-t bg-[#0f6b5f]" style={{ height: `${Math.max(2, (r.requests / Math.max(1, ...(data.series ?? []).map((x: any) => x.requests))) * 100)}%` }} /><div className="w-2 rounded-t bg-amber-400" style={{ height: `${Math.max(2, (r.orders / Math.max(1, ...(data.series ?? []).map((x: any) => x.orders))) * 100)}%` }} /></div>)}</div><div className="mt-1 flex gap-3 text-[9px] text-slate-400"><span>■ заявки</span><span className="text-amber-500">■ заказы</span></div></div>
          </div>
          <div className="mt-3 rounded-xl border border-[#e5e2da] bg-white p-3">
            <div className="mb-2 text-xs font-semibold">Динамика по дням</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[11px]"><thead className="text-slate-400"><tr>{["Дата", "Заявки", "Заказы", "Брони", "Завершено", "Закрыто", "Продажи"].map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead><tbody>{(data.series ?? []).slice(-30).map((r: any) => <tr key={r.date} className="border-t border-slate-100"><td className="px-2 py-1">{r.date}</td><td className="px-2 py-1">{r.requests}</td><td className="px-2 py-1">{r.orders}</td><td className="px-2 py-1">{r.bookings}</td><td className="px-2 py-1">{r.completed}</td><td className="px-2 py-1">{r.closed}</td><td className="px-2 py-1">{money(r.salesAmount)}</td></tr>)}</tbody></table></div>
          </div>
        </>}

        {tab === "managers" && <div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white">
          <table className="w-full min-w-[1100px] text-left text-[11px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Менеджер", "Заявки", "Обработано", "Без ответа", "Просрочено", "Заказы", "Брони", "Завершено", "Закрыто", "Конверсия", "Продажи", "Выручка", "Прибыль", "Ср. ответ, ч"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{managers.map((m: any) => <tr key={m.managerId ?? "none"} onClick={() => setSelectedManager(m)} className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/40"><td className="px-2 py-2 font-medium">{m.managerId ? <Link href={`/app/analytics/sales/managers/${m.managerId}?${query}`} className="text-[#0f6b5f] hover:underline">{m.manager}</Link> : m.manager}</td><td className="px-2 py-2">{m.requests}</td><td className="px-2 py-2">{m.processed}</td><td className="px-2 py-2">{m.noFirstResponse}</td><td className="px-2 py-2">{m.overdue}</td><td className="px-2 py-2">{m.orders}</td><td className="px-2 py-2">{m.bookings}</td><td className="px-2 py-2">{m.completed}</td><td className="px-2 py-2">{m.closed}</td><td className="px-2 py-2">{pct(m.conversionRequestOrder)}</td><td className="px-2 py-2">{money(m.salesAmount)}</td><td className="px-2 py-2">{money(m.capturedRevenue)}</td><td className="px-2 py-2">{money(m.grossProfit)}</td><td className="px-2 py-2">{m.avgResponseHours ?? "—"}</td></tr>)}</tbody></table>
          {selectedManager && <div className="border-t bg-emerald-50/40 p-3 text-xs"><div className="mb-1 flex justify-between"><b>{selectedManager.manager}</b><button onClick={() => setSelectedManager(null)} className="text-slate-500">×</button></div><div className="grid gap-2 sm:grid-cols-4"><div>Заявки: {selectedManager.requests}</div><div>Заказы: {selectedManager.orders}</div><div>Завершено: {selectedManager.completed}</div><div>Закрыто: {selectedManager.closed}</div><div>Продажи: {money(selectedManager.salesAmount)}</div><div>Выручка: {money(selectedManager.capturedRevenue)}</div><div>Прибыль: {money(selectedManager.grossProfit)}</div><div>Ср. ответ: {selectedManager.avgResponseHours ?? "—"} ч</div></div></div>}
        </div>}

        {tab === "activity" && <div className="space-y-2"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-500">Контроль:</span><select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="all">Все заявки</option><option value="no_manager">Без менеджера</option><option value="unprocessed">Не приняты в работу</option><option value="no_response">Без первого ответа</option><option value="overdue">Просроченные</option><option value="no_proposal">Без предложения</option><option value="waiting_customer">Ожидают клиента</option><option value="waiting_supplier">Ожидают поставщика</option></select><span className="text-slate-400">Показано: {filteredActivity.length}</span></div><div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white"><table className="w-full min-w-[1000px] text-left text-[11px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Заявка", "Создана", "Назначена", "Менеджер", "Клиент", "Телефон", "Услуга", "Направление", "Источник", "Статус", "Первый ответ, ч", "Просрочка"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{filteredActivity.map((r: any) => <tr key={r.requestId} className="border-t border-slate-100"><td className="px-2 py-2 font-mono">{r.requestCode}</td><td className="px-2 py-2">{dt(r.createdAt)}</td><td className="px-2 py-2">{dt(r.assignedAt)}</td><td className="px-2 py-2">{r.manager}</td><td className="px-2 py-2">{r.customer}</td><td className="px-2 py-2">{r.phone ?? "—"}</td><td className="px-2 py-2">{r.requestType ?? "—"}</td><td className="px-2 py-2">{r.destination ?? "—"}</td><td className="px-2 py-2">{r.source ?? "—"}</td><td className="px-2 py-2">{r.status}</td><td className="px-2 py-2">{r.responseHours ?? "—"}</td><td className={`px-2 py-2 ${r.overdue ? "font-semibold text-rose-600" : "text-slate-400"}`}>{r.overdue ? "Да" : "Нет"}</td></tr>)}</tbody></table></div></div>}

        {tab === "funnel" && <div className="space-y-2">{(data.funnel ?? []).map((s: any, i: number, arr: any[]) => <div key={s.stage} className="rounded-xl border border-[#e5e2da] bg-white p-3"><div className="mb-1 flex justify-between text-xs"><b>{s.label}</b><span>{s.count} · {pct(s.conversion)}</span></div><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-[#0f6b5f]" style={{ width: `${Math.min(100, s.conversion)}%` }} /></div>{i < arr.length - 1 && <div className="mt-1 text-[10px] text-slate-400">Потери к следующему этапу: {Math.max(0, s.count - arr[i + 1].count)}</div>}</div>)}</div>}

        {tab === "distribution" && <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[["Поступило", data.distribution?.received], ["Авто", data.distribution?.autoAssigned], ["Вручную", data.distribution?.manualAssigned], ["Без менеджера", data.distribution?.unassigned], ["Переназначения", data.distribution?.reassigned], ["События назначения", data.distribution?.assignmentEvents]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-3"><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-xl font-semibold">{value ?? 0}</div></div>)}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr>{["Менеджер", "Назначено за период", "Текущая нагрузка", "Без обработки", "Просрочено"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{(data.distribution?.managers ?? []).map((m: any) => <tr key={m.managerId ?? "none"} className="border-t"><td className="px-2 py-2">{m.manager}</td><td className="px-2 py-2">{m.assigned}</td><td className="px-2 py-2">{m.currentLoad}</td><td className="px-2 py-2">{m.unprocessed}</td><td className="px-2 py-2">{m.overdue}</td></tr>)}</tbody></table></div>
        </div>}

        {tab === "deals" && <>
          <div className="mb-2 flex gap-1 rounded-lg border bg-white p-1"><button onClick={() => setDealTab("completed")} className={`rounded px-3 py-1.5 text-xs ${dealTab === "completed" ? "bg-[#0f6b5f] text-white" : ""}`}>Завершённые</button><button onClick={() => setDealTab("closed")} className={`rounded px-3 py-1.5 text-xs ${dealTab === "closed" ? "bg-[#0f6b5f] text-white" : ""}`}>Закрытые</button></div>
          <div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white"><table className="w-full min-w-[1200px] text-left text-[10px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Request", "Order", "Booking", "Клиент", "Телефон", "Менеджер", "Услуга", "Направление", "Заявка", "Заказ", "Бронь", "Завершение", "Закрытие", "Цена", "Себестоимость", "Выручка", "Прибыль", "Фин. статус"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{(data.deals?.[dealTab] ?? []).map((d: any) => <tr key={d.orderId} className="border-t border-slate-100"><td className="px-2 py-2">{d.requestCode ?? "—"}</td><td className="px-2 py-2">{d.orderCode}</td><td className="px-2 py-2">{d.bookingCode ?? "—"}</td><td className="px-2 py-2">{d.customer}</td><td className="px-2 py-2">{d.phone ?? "—"}</td><td className="px-2 py-2">{d.manager ?? "—"}</td><td className="px-2 py-2">{d.requestType ?? "—"}</td><td className="px-2 py-2">{d.destination ?? "—"}</td><td className="px-2 py-2">{dt(d.requestCreatedAt)}</td><td className="px-2 py-2">{dt(d.orderCreatedAt)}</td><td className="px-2 py-2">{dt(d.bookingConfirmedAt)}</td><td className="px-2 py-2">{dt(d.serviceCompletedAt)}</td><td className="px-2 py-2">{dt(d.closedAt)}</td><td className="px-2 py-2">{money(d.clientPrice)}</td><td className="px-2 py-2">{money(d.cost)}</td><td className="px-2 py-2">{money(d.revenue)}</td><td className="px-2 py-2">{money(d.grossProfit)}</td><td className="px-2 py-2">{d.financialStatus ?? "—"}</td></tr>)}</tbody></table>{(data.deals?.[dealTab] ?? []).length === 0 && <div className="p-6 text-center text-xs text-slate-400">Нет сделок за период</div>}</div>
        </>}
      </>}
      {drill && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDrill(null)}><div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div><b className="text-sm">{KPI_LABELS[drill.metric] ?? drill.metric}</b><span className="ml-2 text-xs text-slate-400">записей: {drill.total}</span></div><button onClick={() => setDrill(null)} className="text-slate-500">×</button></div><table className="w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Заявка", "Заказ", "Клиент", "Менеджер", "Статус", "Сумма"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{(drill.rows ?? []).slice(0, 200).map((r: any, i: number) => <tr key={i} className="border-t"><td className="px-2 py-1.5 font-mono">{r.requestCode ?? "—"}</td><td className="px-2 py-1.5 font-mono">{r.orderCode ?? "—"}</td><td className="px-2 py-1.5">{r.customer ?? "—"}</td><td className="px-2 py-1.5">{r.manager ?? "—"}</td><td className="px-2 py-1.5">{r.status ?? "—"}</td><td className="px-2 py-1.5">{money(r.clientPrice ?? r.salesAmount ?? 0)}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  return <SalesAnalyticsView />;
}
