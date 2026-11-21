"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useLocale, type Locale } from "@/lib/i18n";
import { saStatus, saText } from "@/lib/sales-analytics-i18n";

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
  lostRequests: "Потерянные заявки", overdueRequests: "Просроченные заявки", slaCompliance: "SLA первого ответа",
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
  ["Заявки", ["requestsTotal", "assigned", "accepted", "inWork", "noFirstResponse", "proposalsSent", "lostRequests", "overdueRequests", "slaCompliance"]],
  ["Продажи", ["ordersCreated", "bookingsConfirmed", "completedDeals", "closedDeals", "cancelledOrders", "cancelledBookings"]],
  ["Конверсия", ["conversionRequestOrder", "conversionOrderBooking", "conversionRequestBooking", "conversionRequestCompleted", "conversionRequestClosed"]],
];

function formatMoney(v: any, locale: Locale) { const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU"; return Number(v ?? 0).toLocaleString(tag, { maximumFractionDigits: 2 }); }
function formatDate(v: any, locale: Locale) { const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU"; return v ? new Date(v).toLocaleString(tag) : "—"; }
function pct(v: any) { return `${Number(v ?? 0).toFixed(1)}%`; }
function deltaText(x: any, locale: Locale) {
  if (x?.pct == null) return x?.delta > 0 ? `+${formatMoney(x.delta, locale)}` : x?.delta < 0 ? formatMoney(x.delta, locale) : "—";
  return `${x.pct > 0 ? "+" : ""}${x.pct.toFixed(1)}%`;
}

export function SalesAnalyticsView({ initialTab = "overview" }: { initialTab?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const L = (s: string) => saText(locale, s);
  const money = (v: any) => formatMoney(v, locale);
  const dt = (v: any) => formatDate(v, locale);
  const [preset, setPreset] = useState("CURRENT_MONTH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerId, setManagerId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [tab] = useState(initialTab);
  const [dealTab, setDealTab] = useState<"completed" | "closed">("completed");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [managerOptions, setManagerOptions] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Array<{ code: string; names: Record<string, string> }>>([]);
  const [activityFilter, setActivityFilter] = useState("all");
  const [drill, setDrill] = useState<any>(null);
  const [drillLoading, setDrillLoading] = useState("");
  const [dailyView, setDailyView] = useState<"chart" | "table">("chart");
  const [financeKpi, setFinanceKpi] = useState<any>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("preset")) setPreset(q.get("preset")!);
    if (q.get("startDate")) setStartDate(q.get("startDate")!);
    if (q.get("endDate")) setEndDate(q.get("endDate")!);
    if (q.get("managerId")) setManagerId(q.get("managerId")!);
    if (q.get("serviceType")) setServiceType(q.get("serviceType")!);
    if (q.get("source")) setSource(q.get("source")!);
    if (q.get("status")) setStatus(q.get("status")!);
    if (q.get("dealTab") === "closed") setDealTab("closed");
  }, []);

  useEffect(() => {
    api.get<Array<{ code: string; names: Record<string, string> }>>("/hotel-directory/service-types")
      .then((rows) => setServiceTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setServiceTypes([]));
  }, []);

  useEffect(() => {
    const period = data?.period;
    if (!period?.start || !period?.end) return;
    const start = String(period.start).slice(0, 10);
    const end = new Date(new Date(period.end).getTime() - 1).toISOString().slice(0, 10);
    api.get<any>(`/finance/deals?pageSize=1&dateFrom=${start}&dateTo=${end}`)
      .then((r) => setFinanceKpi(r.kpi ?? null))
      .catch(() => setFinanceKpi(null));
  }, [data?.period?.start, data?.period?.end]);

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
    if (status) qs.set("status", status);
    return qs.toString();
  }, [preset, startDate, endDate, managerId, serviceType, source, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.search = query;
    window.history.replaceState(null, "", url);
  }, [query]);


  useEffect(() => {
    let alive = true;
    if (preset === "CUSTOM" && (!startDate || !endDate)) { setLoading(false); return; }
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
  const accumulatedCash = financeKpi
    ? Number(financeKpi.clientReceived ?? 0) - Number(financeKpi.clientRefunded ?? 0) - Number(financeKpi.supplierPaid ?? 0) + Number(financeKpi.supplierRefunded ?? 0)
    : 0;

  return (
    <div className="analytics-sales min-h-screen bg-[#f6f4ef] p-4 text-ink lg:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{L("Аналитика продаж")}</h1>
          <p className="mt-1 text-xs text-ink/60">{L("Заявки → заказы → бронирования → завершённые и закрытые сделки. Период:")} {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-1"><span className="text-ink/60">{L("Период")}</span>
            <select value={preset} onChange={(e) => {
              const next = e.target.value;
              if (next === "CUSTOM" && (!startDate || !endDate)) {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                setStartDate(`${y}-${m}-01`);
                setEndDate(`${y}-${m}-${String(d.getDate()).padStart(2, "0")}`);
              }
              setPreset(next);
            }} className="rounded-lg border bg-white px-2 py-1.5">
              {PRESETS.map(([v, l]) => <option key={v} value={v}>{L(l)}</option>)}
            </select>
          </label>
          {preset === "CUSTOM" && <>
            <label className="flex flex-col gap-1"><span className="text-ink/60">{L("С")}</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5" /></label>
            <label className="flex flex-col gap-1"><span className="text-ink/60">{L("По")}</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5" /></label>
          </>}
          <label className="flex flex-col gap-1"><span className="text-ink/60">{L("Менеджер")}</span>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="min-w-40 rounded-lg border bg-white px-2 py-1.5">
              <option value="">{L("Все")}</option>
              {managerOptions.map((m: any) => <option key={m.managerId ?? "none"} value={m.managerId ?? ""}>{m.manager}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="text-ink/60">{L("Услуга")}</span>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5">
              <option value="">{L("Все")}</option>{serviceTypes.map((x) => <option key={x.code} value={x.code === "TOUR" ? "TOUR_PACKAGE" : x.code}>{x.names?.[locale] ?? x.names?.ru ?? x.code}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="text-ink/60">{L("Источник")}</span><input value={source} onChange={(e) => setSource(e.target.value)} placeholder={L("Все")} className="w-28 rounded-lg border bg-white px-2 py-1.5" /></label><label className="flex flex-col gap-1"><span className="text-ink/60">{L("Статус")}</span><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="">{L("Все")}</option><option value="NEW">{L("Новая")}</option><option value="CHECKING">{L("Проверка")}</option><option value="SUPPLIER_TIMEOUT">{L("Поставщик не ответил")}</option><option value="PRICE_CHANGED">{L("Цена изменилась")}</option><option value="CUSTOMER_ACCEPTED">{L("Клиент подтвердил")}</option><option value="CONFIRMED">{L("Подтверждена")}</option><option value="CONVERTED">{L("Сконвертирована")}</option><option value="REJECTED">{L("Отклонена")}</option><option value="UNAVAILABLE">{L("Недоступна")}</option><option value="EXPIRED">{L("Истекла")}</option><option value="CUSTOMER_PAYMENT_TIMEOUT">{L("Клиент не оплатил")}</option><option value="CANCELLED_BY_CUSTOMER">{L("Клиент отказался")}</option></select></label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-[#e5e2da] bg-white p-1">
        {TABS.map(([v, l]) => { const href = `${v === "overview" ? "/app/analytics/sales" : `/app/analytics/sales/${v}`}?${query}`; return <Link key={v} href={href} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tab === v ? "bg-[#0f6b5f] text-white" : "text-ink/60 hover:bg-panel"}`}>{L(l)}</Link>; })}
      </div>

      {loading && <div className="rounded-xl bg-white p-6 text-sm text-ink/60">{L("Загрузка аналитики…")}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {!loading && !error && data && <>
        {tab === "overview" && <>
          <div className="mb-3 rounded-xl border border-[#cfe5dc] bg-[#f2faf7] p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-ink/60">{L("Накопленные денежные средства по сделкам")}</div>
                <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-[#0f6b5f]">{money(accumulatedCash)}</div>
                <div className="mt-1 text-[11px] text-ink/50">{L("Поступления клиентов минус выплаты поставщикам. Не является остатком на банковском счёте.")}</div>
              </div>
              <div className="text-right text-[11px] text-ink/60">
                <div>{L("Поступления от клиентов")}: <span className="font-mono font-semibold">{money(financeKpi?.clientReceived)}</span></div>
                <div>{L("− Выплаты поставщикам")}: <span className="font-mono font-semibold">{money(financeKpi?.supplierPaid)}</span></div>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">{L("Продажи и прибыль")}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Сумма продаж", "Общая стоимость продаж", financeKpi?.salesAmount, "🧾"],
                ["Себестоимость", "Закупочная стоимость услуг", financeKpi?.costAmount, "📦"],
                ["Прибыль", "Продажи минус себестоимость", financeKpi?.grossMargin, "📈"],
              ].map(([title, subtitle, value, icon]) => <div key={String(title)} className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-wide text-ink/60">{L(String(title))}</span><span className="text-lg">{icon}</span></div><div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">{money(value)}</div><div className="mt-1 text-[11px] text-ink/50">{L(String(subtitle))}</div></div>)}
            </div>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Поступления от клиентов", "Фактические поступления", financeKpi?.clientReceived, "💰"],
              ["Оплачено поставщикам", "Фактические выплаты", financeKpi?.supplierPaid, "📤"],
              ["Дебиторская задолженность", "Клиенты должны компании", financeKpi?.clientDebt, "⏳"],
              ["Кредиторская задолженность", "Компания должна поставщикам", financeKpi?.supplierDebt, "📌"],
            ].map(([title, subtitle, value, icon]) => <div key={String(title)} className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-wide text-ink/60">{L(String(title))}</span><span className="text-lg">{icon}</span></div><div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">{money(value)}</div><div className="mt-1 text-[11px] text-ink/50">{L(String(subtitle))}</div></div>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {GROUPS.map(([title, keys]) => (
              <div key={title} className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">{L(title)}</div>
                <div className="space-y-1.5">{keys.map((k) => <button type="button" key={k} onClick={() => void openDrilldown(k)} className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-emerald-50"><span className="text-ink/60">{L(KPI_LABELS[k] ?? k)}</span><span className="text-right font-semibold">{k.startsWith("conversion") || k === "slaCompliance" ? pct(kpis[k]?.value) : k.toLowerCase().includes("amount") || k.toLowerCase().includes("revenue") || k.toLowerCase().includes("profit") || k.toLowerCase().includes("result") || k === "avgCheck" || k === "refunds" ? money(kpis[k]?.value) : kpis[k]?.value ?? 0}<span className={`ml-1 text-[9px] ${(kpis[k]?.delta ?? 0) < 0 ? "text-rose-500" : "text-emerald-600"}`}>{deltaText(kpis[k], locale)}</span></span></button>)}</div>
              </div>
            ))}
          </div>
          {(data.reconciliation?.issues ?? []).length > 0 && <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px]"><div className="mb-1 font-semibold text-amber-800">Расхождения</div>{(data.reconciliation.issues ?? []).slice(0, 20).map((x: any, i: number) => <div key={i} className="flex justify-between border-t border-amber-100 py-1"><span className="font-mono">{x.orderCode}</span><span>{x.kind}</span><b>{money(x.amount)}</b></div>)}</div>}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border bg-white p-3"><div className="mb-2 text-xs font-semibold">{L("Причины потерь")}</div>{(data.lossReasons ?? []).length === 0 ? <div className="text-[11px] text-ink/60">{L("Потерь за период нет")}</div> : (data.lossReasons ?? []).map((r: any) => <div key={r.reason} className="flex justify-between border-t border-line py-1 text-[11px]"><span className="truncate text-ink/60">{r.reason}</span><b>{r.count}</b></div>)}</div>
            <div className="rounded-xl border bg-white p-3 lg:col-span-2"><div className="mb-2 text-xs font-semibold">{L("Динамика заявок и заказов")}</div><div className="flex h-28 items-end gap-1">{(data.series ?? []).slice(-30).map((r: any) => <div key={r.date} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${r.date}: заявки ${r.requests}, заказы ${r.orders}`}><div className="w-2 rounded-t bg-[#0f6b5f]" style={{ height: `${Math.max(2, (r.requests / Math.max(1, ...(data.series ?? []).map((x: any) => x.requests))) * 100)}%` }} /><div className="w-2 rounded-t bg-amber-400" style={{ height: `${Math.max(2, (r.orders / Math.max(1, ...(data.series ?? []).map((x: any) => x.orders))) * 100)}%` }} /></div>)}</div><div className="mt-1 flex gap-3 text-[9px] text-ink/60"><span>■ {L("Заявки")}</span><span className="text-amber-500">■ {L("Заказы")}</span></div></div>
          </div>
          <div className="mt-3 rounded-xl border border-[#e5e2da] bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold">{L("Динамика по дням")}</div>
              <div className="flex rounded-lg border border-[#e5e2da] p-0.5 text-[11px]">
                <button type="button" onClick={() => setDailyView("chart")} className={`rounded px-2 py-1 ${dailyView === "chart" ? "bg-[#0f6b5f] text-white" : "text-ink/60"}`}>{L("График")}</button>
                <button type="button" onClick={() => setDailyView("table")} className={`rounded px-2 py-1 ${dailyView === "table" ? "bg-[#0f6b5f] text-white" : "text-ink/60"}`}>{L("Таблица")}</button>
              </div>
            </div>
            {dailyView === "chart" ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(data.series ?? []).slice(-30)} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ece9e2" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: "#e5e2da" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="requests" name={L("Заявки")} stroke="#2f80ed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="orders" name={L("Заказы")} stroke="#0f6b5f" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="bookings" name={L("Брони")} stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[11px]"><thead className="text-ink/60"><tr>{["Дата", "Заявки", "Заказы", "Брони", "Завершено", "Закрыто", "Продажи"].map((h) => <th key={h} className="px-2 py-1 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(data.series ?? []).slice(-30).map((r: any) => <tr key={r.date} className="border-t border-line"><td className="px-2 py-1">{r.date}</td><td className="px-2 py-1">{r.requests}</td><td className="px-2 py-1">{r.orders}</td><td className="px-2 py-1">{r.bookings}</td><td className="px-2 py-1">{r.completed}</td><td className="px-2 py-1">{r.closed}</td><td className="px-2 py-1">{money(r.salesAmount)}</td></tr>)}</tbody></table></div>
            )}
          </div>
        </>}

        {tab === "managers" && <div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white">
          <table className="w-full min-w-[1100px] text-left text-[11px]"><thead className="bg-panel text-ink/60"><tr>{["Менеджер", "Заявки", "Обработано", "Без ответа", "Просрочено", "Заказы", "Брони", "Завершено", "Закрыто", "Конверсия", "Продажи", "Выручка", "Прибыль", "Ср. ответ, ч", "Нагрузка", "SLA"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{managers.map((m: any) => <tr key={m.managerId ?? "none"} onClick={() => setSelectedManager(m)} className="cursor-pointer border-t border-line hover:bg-emerald-50/40"><td className="px-2 py-2 font-medium">{m.managerId ? <Link href={`/app/analytics/sales/managers/${m.managerId}?${query}`} className="text-[#0f6b5f] hover:underline">{m.manager}</Link> : m.manager}</td><td className="px-2 py-2">{m.requests}</td><td className="px-2 py-2">{m.processed}</td><td className="px-2 py-2">{m.noFirstResponse}</td><td className="px-2 py-2">{m.overdue}</td><td className="px-2 py-2">{m.orders}</td><td className="px-2 py-2">{m.bookings}</td><td className="px-2 py-2">{m.completed}</td><td className="px-2 py-2">{m.closed}</td><td className="px-2 py-2">{pct(m.conversionRequestOrder)}</td><td className="px-2 py-2">{money(m.salesAmount)}</td><td className="px-2 py-2">{money(m.capturedRevenue)}</td><td className="px-2 py-2">{money(m.grossProfit)}</td><td className="px-2 py-2">{m.avgResponseHours ?? "—"}</td><td className="px-2 py-2">{m.currentLoad ?? 0}</td><td className="px-2 py-2">{pct(m.slaCompliance)}</td></tr>)}</tbody></table>
          {selectedManager && <div className="border-t bg-emerald-50/40 p-3 text-xs"><div className="mb-1 flex justify-between"><b>{selectedManager.manager}</b><button onClick={() => setSelectedManager(null)} className="text-ink/60">×</button></div><div className="grid gap-2 sm:grid-cols-4"><div>Заявки: {selectedManager.requests}</div><div>Заказы: {selectedManager.orders}</div><div>Завершено: {selectedManager.completed}</div><div>Закрыто: {selectedManager.closed}</div><div>Продажи: {money(selectedManager.salesAmount)}</div><div>Выручка: {money(selectedManager.capturedRevenue)}</div><div>Прибыль: {money(selectedManager.grossProfit)}</div><div>Ср. ответ: {selectedManager.avgResponseHours ?? "—"} ч</div></div></div>}
        </div>}

        {tab === "activity" && <div className="space-y-2"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-ink/60">{L("Контроль:")}</span><select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="all">{L("Все заявки")}</option><option value="no_manager">{L("Без менеджера")}</option><option value="unprocessed">{L("Не приняты в работу")}</option><option value="no_response">{L("Без первого ответа")}</option><option value="overdue">{L("Просроченные")}</option><option value="no_proposal">{L("Без предложения")}</option><option value="waiting_customer">{L("Ожидают клиента")}</option><option value="waiting_supplier">{L("Ожидают поставщика")}</option></select><span className="text-ink/60">{L("Показано:")} {filteredActivity.length}</span></div><div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white"><table className="w-full min-w-[1000px] text-left text-[11px]"><thead className="bg-panel text-ink/60"><tr>{["Заявка", "Создана", "Назначена", "Менеджер", "Клиент", "Телефон", "Услуга", "Направление", "Источник", "Статус", "Первый ответ, ч", "Просрочка"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{filteredActivity.map((r: any) => <tr key={r.requestId} className="border-t border-line"><td className="px-2 py-2 font-mono">{r.requestCode}</td><td className="px-2 py-2">{dt(r.createdAt)}</td><td className="px-2 py-2">{dt(r.assignedAt)}</td><td className="px-2 py-2">{r.manager}</td><td className="px-2 py-2">{r.customer}</td><td className="px-2 py-2">{r.phone ?? "—"}</td><td className="px-2 py-2">{r.requestType ?? "—"}</td><td className="px-2 py-2">{r.destination ?? "—"}</td><td className="px-2 py-2">{r.source ?? "—"}</td><td className="px-2 py-2">{saStatus(locale, r.status)}</td><td className="px-2 py-2">{r.responseHours ?? "—"}</td><td className={`px-2 py-2 ${r.overdue ? "font-semibold text-rose-600" : "text-ink/60"}`}>{r.overdue ? L("Да") : L("Нет")}</td></tr>)}</tbody></table></div></div>}

        {tab === "funnel" && <div className="space-y-2">{(data.funnel ?? []).map((s: any, i: number, arr: any[]) => <div key={s.stage} className="rounded-xl border border-[#e5e2da] bg-white p-3"><div className="mb-1 flex justify-between text-xs"><b>{L(s.label)}</b><span>{s.count} · {pct(s.conversion)}</span></div><div className="h-2 overflow-hidden rounded bg-panel"><div className="h-full rounded bg-[#0f6b5f]" style={{ width: `${Math.min(100, s.conversion)}%` }} /></div>{i < arr.length - 1 && <div className="mt-1 text-[10px] text-ink/60">{L("Потери к следующему этапу:")} {Math.max(0, s.count - arr[i + 1].count)}</div>}</div>)}</div>}

        {tab === "distribution" && <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[["Поступило", data.distribution?.received], ["Авто", data.distribution?.autoAssigned], ["Вручную", data.distribution?.manualAssigned], ["Без менеджера", data.distribution?.unassigned], ["Переназначения", data.distribution?.reassigned], ["События назначения", data.distribution?.assignmentEvents]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-3"><div className="text-[10px] uppercase text-ink/60">{L(String(label))}</div><div className="mt-1 text-xl font-semibold">{value ?? 0}</div></div>)}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-panel text-ink/60"><tr>{["Менеджер", "Назначено за период", "Текущая нагрузка", "Без обработки", "Просрочено"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(data.distribution?.managers ?? []).map((m: any) => <tr key={m.managerId ?? "none"} className="border-t"><td className="px-2 py-2">{m.manager}</td><td className="px-2 py-2">{m.assigned}</td><td className="px-2 py-2">{m.currentLoad}</td><td className="px-2 py-2">{m.unprocessed}</td><td className="px-2 py-2">{m.overdue}</td></tr>)}</tbody></table></div>
        </div>}

        {tab === "deals" && <>
          <div className="mb-2 flex gap-1 rounded-lg border bg-white p-1"><button onClick={() => setDealTab("completed")} className={`rounded px-3 py-1.5 text-xs ${dealTab === "completed" ? "bg-[#0f6b5f] text-white" : ""}`}>{L("Завершённые")}</button><button onClick={() => setDealTab("closed")} className={`rounded px-3 py-1.5 text-xs ${dealTab === "closed" ? "bg-[#0f6b5f] text-white" : ""}`}>{L("Закрытые")}</button></div>
          <div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white"><table className="w-full min-w-[1200px] text-left text-[10px]"><thead className="bg-panel text-ink/60"><tr>{["Request", "Order", "Booking", "Клиент", "Телефон", "Менеджер", "Услуга", "Направление", "Заявка", "Заказ", "Бронь", "Завершение", "Закрытие", "Цена", "Себестоимость", "Выручка", "Прибыль", "Фин. статус"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(data.deals?.[dealTab] ?? []).map((d: any) => <tr key={d.orderId} className="border-t border-line"><td className="px-2 py-2">{d.requestCode ?? "—"}</td><td className="px-2 py-2">{d.orderCode}</td><td className="px-2 py-2">{d.bookingCode ?? "—"}</td><td className="px-2 py-2">{d.customer}</td><td className="px-2 py-2">{d.phone ?? "—"}</td><td className="px-2 py-2">{d.manager ?? "—"}</td><td className="px-2 py-2">{d.services?.length ? d.services.map((s: any) => s.title).join(", ") : d.requestType ?? "—"}</td><td className="px-2 py-2">{d.destination ?? "—"}</td><td className="px-2 py-2">{dt(d.requestCreatedAt)}</td><td className="px-2 py-2">{dt(d.orderCreatedAt)}</td><td className="px-2 py-2">{dt(d.bookingConfirmedAt)}</td><td className="px-2 py-2">{dt(d.serviceCompletedAt)}</td><td className="px-2 py-2">{dt(d.closedAt)}</td><td className="px-2 py-2">{money(d.clientPrice)}</td><td className="px-2 py-2">{money(d.cost)}</td><td className="px-2 py-2">{money(d.revenue)}</td><td className="px-2 py-2">{money(d.grossProfit)}</td><td className="px-2 py-2">{d.financialStatus ?? "—"}</td></tr>)}</tbody></table>{(data.deals?.[dealTab] ?? []).length === 0 && <div className="p-6 text-center text-xs text-ink/60">{L("Нет сделок за период")}</div>}</div>
        </>}
      </>}
      {drill && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDrill(null)}><div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div><b className="text-sm">{L(KPI_LABELS[drill.metric] ?? drill.metric)}</b><span className="ml-2 text-xs text-ink/60">{L("записей:")} {drill.total}</span></div><button onClick={() => setDrill(null)} className="text-ink/60">×</button></div><table className="w-full text-left text-[11px]"><thead className="bg-panel text-ink/60"><tr>{["Заявка", "Заказ", "Клиент", "Менеджер", "Статус", "Сумма"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(drill.rows ?? []).slice(0, 200).map((r: any, i: number) => <tr key={i} className="border-t"><td className="px-2 py-1.5 font-mono">{r.requestCode ?? "—"}</td><td className="px-2 py-1.5 font-mono">{r.orderCode ?? "—"}</td><td className="px-2 py-1.5">{r.customer ?? "—"}</td><td className="px-2 py-1.5">{r.manager ?? "—"}</td><td className="px-2 py-1.5">{r.status ? saStatus(locale, String(r.status)) : "—"}</td><td className="px-2 py-1.5">{money(r.clientPrice ?? r.amount ?? r.salesAmount ?? 0)}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  return <SalesAnalyticsView />;
}
