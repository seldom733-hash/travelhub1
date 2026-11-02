"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { formatPrice } from "@/lib/i18n";
import { dealsApi, type DealKpi, type DealList, type DealQuery, type DealRow } from "@/lib/deals-api";

const KPI: Array<{ key: keyof DealKpi; label: string; color: string }> = [
  { key: "salesAmount", label: "Сумма продаж", color: "text-blue-600" },
  { key: "costAmount", label: "Себестоимость", color: "text-violet-600" },
  { key: "grossMargin", label: "Валовая разница", color: "text-slate-700" },
  { key: "clientReceived", label: "Получено от клиентов", color: "text-emerald-600" },
  { key: "clientDebt", label: "Долги клиентов", color: "text-amber-600" },
  { key: "clientRefunded", label: "Возвращено клиентам", color: "text-rose-600" },
  { key: "supplierPaid", label: "Оплачено поставщикам", color: "text-blue-600" },
  { key: "supplierDebt", label: "Долги перед поставщиками", color: "text-orange-600" },
  { key: "supplierRefunded", label: "Возврат от поставщика", color: "text-sky-600" },
  { key: "clientPenalty", label: "Штрафы клиентам", color: "text-rose-600" },
  { key: "supplierPenalty", label: "Штрафы от поставщика", color: "text-violet-600" },
  { key: "expectedIncome", label: "Ожидаемый доход", color: "text-emerald-600" },  { key: "currentIncome", label: "Текущий доход", color: "text-emerald-700" },
];

const PAGE_SIZE = 20;
const EMPTY_KPI: DealKpi = {
  salesAmount: "0", costAmount: "0", grossMargin: "0", clientReceived: "0", clientDebt: "0", clientRefunded: "0",
  supplierPaid: "0", supplierDebt: "0", supplierRefunded: "0", clientPenalty: "0",
  supplierPenalty: "0", expectedIncome: "0", currentIncome: "0", currency: "AZN", count: 0,
};

function fmt(value: string, currency = "AZN") {
  return formatPrice(value, currency, "ru") ?? value;
}

function statusTone(status: string) {
  if (/CANCEL|REJECT|FAIL/.test(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (/PAID|CONFIRM|COMPLETED|CONVERTED/.test(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/PARTIAL|PENDING|CHECK/.test(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function DealsRegistryPage() {
  const [data, setData] = useState<DealList | null>(null);
  const [kpi, setKpi] = useState<DealKpi>(EMPTY_KPI);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<(typeof KPI)[number] | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [columns, setColumns] = useState({ customer: true, supplier: true, travelers: true, cost: true, currentIncome: true });
  const [query, setQuery] = useState({ search: "", stage: "", status: "", financialStatus: "", clientPayment: "", supplierPayment: "", serviceType: "", dateField: "createdAt", dateFrom: "", dateTo: "", supplierId: "", manager: "" });

  const apiQuery = useMemo<DealQuery>(() => ({ ...query, page, pageSize: PAGE_SIZE }), [query, page]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await dealsApi.list(apiQuery);
      setData(result);
      setKpi(result.kpi);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiQuery]);
  useEffect(() => { void load(); }, [load]);

  const exportXlsx = async () => {
    const blob = await dealsApi.exportXlsx(query);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deals.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const setFilter = (patch: Partial<typeof query>) => {
    setPage(1);
    setQuery((current) => ({ ...current, ...patch }));
  };

  return (
    <div>
      <PageHeader
        title="Реестр продаж и взаиморасчётов"
        breadcrumbs={["Navitravel", "Финансы", "Реестр продаж и взаиморасчётов"]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Период:</span>
            <select value={query.dateField} onChange={(e) => setFilter({ dateField: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
              <option value="createdAt">Дата создания</option>
              <option value="serviceDate">Дата поездки</option>
              <option value="financial">Дата фин. операции</option>
            </select>
            <input type="date" value={query.dateFrom} onChange={(e) => setFilter({ dateFrom: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
            <span className="text-xs text-slate-400">—</span>
            <input type="date" value={query.dateTo} onChange={(e) => setFilter({ dateTo: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
            <button type="button" onClick={() => void exportXlsx()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">Экспорт XLSX</button>
            <div className="relative">
              <button type="button" onClick={() => setColumnsOpen((v) => !v)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">+ Колонки</button>
              {columnsOpen && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {Object.entries(columns).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-600">
                      <input type="checkbox" checked={value} onChange={() => setColumns((c) => ({ ...c, [key]: !c[key as keyof typeof c] }))} />
                      {key === "customer" ? "Клиент" : key === "supplier" ? "Поставщик" : key === "travelers" ? "Туристы" : key === "cost" ? "Себестоимость" : "Текущий доход"}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
      />
      <div className="space-y-4 p-4 lg:p-6">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {KPI.map((card) => (
            <button key={card.key} type="button" title={card.key === "expectedIncome" ? "Доход по правилам признания: активные/завершённые — маржа, отменённые — штрафы" : card.key === "grossMargin" ? "Сумма продаж − себестоимость по неотменённым сделкам" : undefined} onClick={() => setSelectedKpi(card)} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.label}</span>
              <span className={`mt-1 block font-mono text-lg font-semibold ${card.color}`}>{fmt(String(kpi[card.key] ?? "0"), kpi.currency)}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input value={query.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder="Поиск по общему №, коду заявки/заказа/брони, ФИО клиента или телефону" className="min-w-[280px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <select value={query.stage} onChange={(e) => setFilter({ stage: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
              <option value="">Все стадии</option><option value="REQUEST">Заявка</option><option value="ORDER">Заказ</option><option value="BOOKING">Бронь</option>
            </select>
            <select value={query.status} onChange={(e) => setFilter({ status: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
              <option value="">Все статусы</option>
              {["NEW","IN_PROCESSING","READY_FOR_BOOKING","SENT_TO_BOOKING","FULFILLED","CANCELLED","CONFIRMED","COMPLETED","CANCELLED_BY_CUSTOMER"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={query.financialStatus} onChange={(e) => setFilter({ financialStatus: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
              <option value="">Фин. статус</option><option value="OPEN">OPEN</option><option value="PENDING_SETTLEMENT">PENDING_SETTLEMENT</option><option value="FINANCIALLY_SETTLED">FINANCIALLY_SETTLED</option><option value="FINANCIALLY_SETTLED_WITH_PENALTY">WITH_PENALTY</option><option value="FINANCIALLY_SETTLED_FULL_REFUND">FULL_REFUND</option>
            </select>
            <button type="button" onClick={() => setAdvanced((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">Ещё фильтры</button>
          </div>
          {advanced && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select value={query.clientPayment} onChange={(e) => setFilter({ clientPayment: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Оплата клиента</option><option value="UNPAID">Не оплачено</option><option value="PARTIALLY_PAID">Частично</option><option value="PAID">Оплачено</option></select>
              <select value={query.supplierPayment} onChange={(e) => setFilter({ supplierPayment: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Оплата поставщику</option><option value="UNPAID">Не оплачено</option><option value="PARTIALLY_PAID">Частично</option><option value="PAID">Оплачено</option></select>
              <select value={query.serviceType} onChange={(e) => setFilter({ serviceType: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Тип услуги</option><option value="TOUR">Тур</option><option value="HOTEL">Отель</option><option value="FLIGHT">Авиабилет</option><option value="CRUISE">Круиз</option></select>
              <input value={query.supplierId} onChange={(e) => setFilter({ supplierId: e.target.value })} placeholder="ID поставщика" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <input value={query.manager} onChange={(e) => setFilter({ manager: e.target.value })} placeholder="Менеджер" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
            </div>
          )}
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-3" />
                  <th className="px-2 py-3">Общий №</th>
                  <th className="px-2 py-3">Коды</th>
                  <th className="px-2 py-3">Стадия</th>
                  {columns.customer && <th className="px-2 py-3">Клиент</th>}
                  <th className="px-2 py-3">Услуга</th>
                  {columns.supplier && <th className="px-2 py-3">Поставщик</th>}
                  {columns.travelers && <th className="px-2 py-3">Туристы</th>}
                  <th className="px-2 py-3 text-right">Сумма продажи</th>
                  {columns.cost && <th className="px-2 py-3 text-right">Себестоимость</th>}
                  <th className="px-2 py-3 text-right">Оплата клиента</th>
                  <th className="px-2 py-3 text-right">Оплата поставщику</th>
                  <th className="px-2 py-3 text-right">Ожидаемый доход</th>
                  {columns.currentIncome && <th className="px-2 py-3 text-right">Текущий доход</th>}
                  <th className="px-2 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={16} className="px-3 py-10 text-center text-slate-400">Загрузка…</td></tr>}
                {!loading && data?.items.length === 0 && <tr><td colSpan={16} className="px-3 py-10 text-center text-slate-400">Сделки не найдены</td></tr>}
                {data?.items.map((row) => (
                  <DealTableRow key={row.sequence} row={row} expanded={expanded === row.sequence} onToggle={() => setExpanded((v) => v === row.sequence ? null : row.sequence)} columns={columns} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>Показано: {data ? (data.page - 1) * data.pageSize + 1 : 0}–{data ? Math.min(data.page * data.pageSize, data.total) : 0} из {data?.total ?? 0}</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">←</button>
              <span className="rounded bg-blue-600 px-2 py-1 text-white">{data?.page ?? 1}</span>
              <button type="button" disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">→</button>
            </div>
          </div>
        </div>
      </div>

      {selectedKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedKpi(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">{selectedKpi.label}: {fmt(String(kpi[selectedKpi.key] ?? "0"), kpi.currency)}</h3><button type="button" onClick={() => setSelectedKpi(null)} className="text-slate-400">✕</button></div>
            {data?.items.map((row) => (
              <Link key={row.sequence} href={`/app/finance/deals/${row.sequence}`} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs hover:bg-slate-50">
                <span>{row.sequence} · {row.customerName} · {row.productTitle}</span>
                <span className="font-mono">{fmt(String(row[selectedKpi.key as keyof DealRow] ?? "0"), row.currency)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DealTableRow({ row, expanded, onToggle, columns }: { row: DealRow; expanded: boolean; onToggle: () => void; columns: { customer: boolean; supplier: boolean; travelers: boolean; cost: boolean; currentIncome: boolean } }) {
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/70">
        <td className="px-2 py-2"><button type="button" onClick={onToggle} className="text-slate-400">{expanded ? "▾" : "›"}</button></td>
        <td className="px-2 py-2"><Link href={`/app/finance/deals/${row.sequence}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">{row.sequence}</Link></td>
        <td className="px-2 py-2 font-mono text-[10px] leading-4 text-slate-500">
          <Link href={`/app/finance/deals/${row.sequence}`} className="block hover:text-blue-600">REQ {row.requestCode}</Link>
          <Link href={`/app/finance/deals/${row.sequence}`} className="block hover:text-blue-600">ORD {row.orderCode ?? "—"}</Link>
          <Link href={`/app/finance/deals/${row.sequence}`} className="block hover:text-blue-600">BKG {row.bookingCode ?? "—"}</Link>
        </td>
        <td className="px-2 py-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px]">{row.stageLabel}</span></td>
        {columns.customer && <td className="px-2 py-2"><div className="font-medium text-slate-700">{row.customerName}</div><div className="text-[10px] text-slate-400">{row.customerPhone ?? "—"}</div></td>}
        <td className="max-w-[220px] px-2 py-2"><div className="truncate font-medium text-slate-700" title={row.productTitle}>{row.productTitle}</div><div className="text-[10px] text-slate-400">{row.productType || "—"}</div></td>
        {columns.supplier && <td className="px-2 py-2 text-slate-600">{row.supplierCode ?? "—"}</td>}
        {columns.travelers && <td className="px-2 py-2 text-slate-600">{row.travelerCount != null ? `${row.travelerCount} чел.` : "—"}</td>}
        <td className="px-2 py-2 text-right font-mono">{fmt(row.salesAmount, row.currency)}</td>
        {columns.cost && <td className="px-2 py-2 text-right font-mono">{fmt(row.costAmount, row.currency)}</td>}
        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(row.clientReceived, row.currency)}<div className="text-[10px] text-amber-600">долг {fmt(row.clientDebt, row.currency)}</div></td>
        <td className="px-2 py-2 text-right font-mono text-slate-600">{fmt(row.supplierPaid, row.currency)}<div className="text-[10px] text-orange-600">долг {fmt(row.supplierDebt, row.currency)}</div></td>
        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(row.expectedIncome, row.currency)}</td>
        {columns.currentIncome && <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(row.currentIncome, row.currency)}</td>}
        <td className="px-2 py-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(row.status)}`}>{row.status}</span></td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50/60">
          <td colSpan={16} className="px-4 py-3">
            <div className="grid gap-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
              <div><div className="text-slate-400">База поставщика</div><div>{fmt(row.supplierBasePrice, row.currency)}</div></div>
              <div><div className="text-slate-400">Наценка</div><div>{fmt(row.markupAmount, row.currency)}</div></div>
              <div><div className="text-slate-400">Комиссия</div><div>{fmt(row.commissionAmount, row.currency)}</div></div>
              <div><div className="text-slate-400">Финансовый статус</div><div className="font-semibold">{row.financialStatus}</div></div>
              <div><div className="text-slate-400">Оплата клиента</div><div>{row.paymentStatus}</div></div>
              <div><div className="text-slate-400">Оплата поставщику</div><div>{row.supplierPaymentStatus}</div></div>
              <div><div className="text-slate-400">Возвращено клиенту</div><div>{fmt(row.clientRefunded, row.currency)}</div></div>
              <div><div className="text-slate-400">Возврат поставщика</div><div>{fmt(row.supplierRefunded, row.currency)}</div></div>
              <div><div className="text-slate-400">Штраф клиента</div><div>{fmt(row.clientPenalty, row.currency)}</div></div>
              <div><div className="text-slate-400">Штраф поставщика</div><div>{fmt(row.supplierPenalty, row.currency)}</div></div>
              <div><div className="text-slate-400">Дата услуги</div><div>{row.serviceDate ? new Date(row.serviceDate).toLocaleDateString("ru-RU") : "—"}</div></div>
              <div><div className="text-slate-400">Менеджер</div><div>{row.manager ?? "—"}</div></div>
              <div><Link href={`/app/finance/deals/${row.sequence}`} className="font-semibold text-blue-600">Открыть карточку сделки →</Link></div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
