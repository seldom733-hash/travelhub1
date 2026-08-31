"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Order, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import { useCan } from "@/lib/use-can";
import ActionButtons from "@/components/ActionButtons";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import AggregateSummary from "@/components/AggregateSummary";
import { useLocale, t } from "@/lib/i18n";


const ACTIONS = [
  { action: "process", label: "Принять в работу", cls: "bg-sky-600 hover:bg-sky-700", only: ["NEW"] },
  { action: "confirm", label: "Готов к бронированию", cls: "bg-violet-600 hover:bg-violet-700", only: ["IN_PROCESSING", "WAITING_FOR_DATA"] },
  { action: "send", label: "Передать в Booking", cls: "bg-blue-600 hover:bg-blue-700", only: ["READY_FOR_BOOKING"] },
  { action: "complete", label: "Исполнен", cls: "bg-emerald-600 hover:bg-emerald-700", only: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"] },
  { action: "close", label: "Закрыть", cls: "bg-slate-700 hover:bg-slate-800", only: ["FULFILLED", "READY_TO_CLOSE"] },
  { action: "cancel", label: "Отменить", cls: "bg-red-600 hover:bg-red-700", only: ["NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING", "SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "PROBLEM", "SUSPENDED"] },
] satisfies { action: string; label: string; cls: string; only: string[] }[];

function OrdersContent({ initialStatus, initialSearch, initialPaymentStatus, initialCancelledWithin, initialPaymentFailed, initialPendingRefund, initialSortBy, initialSortDirection, initialDateFrom, initialDateTo }: { initialStatus: string; initialSearch?: string; initialPaymentStatus?: string; initialCancelledWithin?: string; initialPaymentFailed?: string; initialPendingRefund?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialDateFrom?: string; initialDateTo?: string }) {
  const locale = useLocale();
  const [data, setData] = useState<Page<Order> | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [bookings, setBookings] = useState<{ id: string; code: string; status: string }[]>([]);
  const [search, setSearch] = useState(initialSearch || "");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(initialPaymentStatus);
  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");
  const [cancelledWithin] = useState(initialCancelledWithin);
  const [paymentFailed] = useState(initialPaymentFailed);
  const [pendingRefund] = useState(initialPendingRefund);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);


  const updateUrl = (params: Record<string, string>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    window.history.replaceState(null, '', `?${sp.toString()}`);
  };
  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
    updateUrl({ sortBy: field, sortDirection: direction });
  };

  // Derived filter labels for display
  const statusLabels: Record<string, string> = {
    NEW: "Новый", IN_PROCESSING: "В обработке", WAITING_FOR_DATA: "Ожидание данных",
    READY_FOR_BOOKING: "Готов к бронированию", SENT_TO_BOOKING: "Отправлен в бронирование",
    PARTIALLY_FULFILLED: "Частично исполнен", FULFILLED: "Исполнен",
    READY_TO_CLOSE: "Готов к закрытию", CLOSED: "Закрыт", CANCELLED: "Отменён",
    PROBLEM: "Проблема", SUSPENDED: "Приостановлен",
  };
  const activeFilters: string[] = [];
  if (statusFilter) {
    const statuses = statusFilter.split(',').map(s => s.trim());
    if (statuses.length === 1) {
      activeFilters.push(`Статус: ${statusLabels[statuses[0]] ?? statuses[0]}`);
    } else {
      activeFilters.push(`Статус: ${statuses.map(s => statusLabels[s] ?? s).join(', ')}`);
    }
  }
  if (paymentStatusFilter) {
    const psLabels: Record<string, string> = { UNPAID: "Оплата: Не оплачен" };
    activeFilters.push(psLabels[paymentStatusFilter] ?? `Оплата: ${paymentStatusFilter}`);
  }
  if (cancelledWithin) activeFilters.push(`Период: последние ${cancelledWithin} дн.`);
  if (paymentFailed === "true") activeFilters.push("Платёж: Неуспешный");
  if (pendingRefund === "true") activeFilters.push("Возврат: Ожидает обработки");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Ролевой UI: доступные команды определяются granular permissions (RBAC Matrix §4).
  const canAccept = useCan("order.accept");
  const canEdit = useCan("order.edit_noncritical");
  const canSendBooking = useCan("order.request_booking");
  const canClose = useCan("order.close");
  const canCancel = useCan("order.cancel");
  const permOf: Record<string, boolean> = {
    process: canAccept,
    confirm: canEdit,
    send: canSendBooking,
    complete: canEdit,
    close: canClose,
    cancel: canCancel,
  };

  const load = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter) qs.set("status", statusFilter);
      if (paymentStatusFilter) qs.set("paymentStatus", paymentStatusFilter);
      if (cancelledWithin) qs.set("cancelledWithin", cancelledWithin);
      if (paymentFailed) qs.set("paymentFailed", paymentFailed);
      if (pendingRefund) qs.set("pendingRefund", pendingRefund);

      if (sortBy) qs.set("sortBy", sortBy);
      if (sortDirection) qs.set("sortDirection", sortDirection);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      qs.set("page", String(page));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Order>>(`/orders?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, paymentStatusFilter, cancelledWithin, paymentFailed, pendingRefund, sortBy, sortDirection, page, dateFrom, dateTo]);

  const openDetail = async (id: string) => {
    const [order, bk] = await Promise.all([
      api.get<Order>(`/orders/${id}`),
      api.get<{ items: { id: string; code: string; status: string }[] }>(`/bookings?orderId=${id}`),
    ]);
    setSelected(order);
    setBookings(bk.items);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setError("");
    try {
      await api.patch(`/orders/${selected.id}`, { action });
      await openDetail(selected.id);
      await load();
    } catch (e) {
      // 403 возможен при смене роли на лету или дрейфе маппинга прав → показываем баннер
      setError((e as Error).message);
    }
  };

  const counts = {
    total: data?.total ?? 0,
    active: data?.aggregates?.active ?? 0,
    ready: data?.aggregates?.ready ?? 0,
    closed: data?.aggregates?.closed ?? 0,
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Order Center"
          breadcrumbs={["TravelHub", "Order Center"]}
          actions={
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("admin.table.refresh", locale)}
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: t("admin.kpi.total_orders", locale), value: counts.total, icon: "🧾" },
              { label: t("admin.kpi.active", locale), value: counts.active, icon: "⚙️", accent: "#2563eb" },
              { label: t("admin.kpi.ready_booking", locale), value: counts.ready, icon: "✅", accent: "#7c3aed" },
              { label: t("admin.kpi.closed", locale), value: counts.closed, icon: "🔒", accent: "#64748b" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">

            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("admin.search.placeholder_orders", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); updateUrl({ status: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("admin.filter.all_statuses", locale)}</option>
              <option value="NEW">Новый</option>
              <option value="IN_PROCESSING">В обработке</option>
              <option value="WAITING_FOR_DATA">Ожидание данных</option>
              <option value="READY_FOR_BOOKING">Готов к бронированию</option>
              <option value="SENT_TO_BOOKING">Отправлен в бронирование</option>
              <option value="PARTIALLY_FULFILLED">Частично исполнен</option>
              <option value="FULFILLED">Исполнен</option>
              <option value="READY_TO_CLOSE">Готов к закрытию</option>
              <option value="CLOSED">Закрыт</option>
              <option value="CANCELLED">Отменён</option>
              <option value="PROBLEM">Проблема</option>
              <option value="SUSPENDED">Приостановлен</option>
            </select>
            <select
              value={paymentStatusFilter}
              onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1); updateUrl({ paymentStatus: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("admin.filter.all_payments", locale)}</option>
              <option value="UNPAID">Не оплачен</option>
              <option value="PARTIALLY_PAID">Частично оплачен</option>
              <option value="PAID">Оплачен</option>
              <option value="REFUNDED">Возврат</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">С</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">По</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeFilters.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {f}
                  </span>
                ))}
              </div>
            )}
            {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          <AggregateSummary
            totalRecords={counts.total}
            fields={[
              { label: t("admin.kpi.active", locale), value: counts.active },
              { label: t("admin.kpi.ready_booking", locale), value: counts.ready },
              { label: t("admin.kpi.closed", locale), value: counts.closed },
            ]}
            loading={busy}
          />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.code", locale)}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.date", locale)}</SortableHeader>
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort} >{t("admin.table.col.amount", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.items", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  <SortableHeader field="paymentStatus" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.payment", locale)}</SortableHeader>
                  {paymentFailed === "true" && <th className="px-4 py-2.5 font-medium text-red-600">{t("admin.table.col.payment", locale)}</th>}
                  {pendingRefund === "true" && <th className="px-4 py-2.5 font-medium text-amber-600">{t("admin.table.col.refund", locale)}</th>}
                  {cancelledWithin && <SortableHeader field="cancelledAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}> {t("admin.table.col.cancel_date", locale)} </SortableHeader>}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((o) => (
                  <tr
                      key={o.id}
                      onClick={() => void openDetail(o.id)}
                      className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${
                        selected?.id === o.id ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs text-blue-600">{o.referenceNumber ?? o.code}</div>
                        <div className="text-xs text-slate-400">{o.number}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 text-center">
                        {Number(o.amount).toFixed(2)} {o.currency}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{o.items?.length ?? 0}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.paymentStatus} /></td>
                      {paymentFailed === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">Неуспешный</span></td>}
                      {pendingRefund === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">Ожидает обработки</span></td>}
                      {cancelledWithin && <td className="px-4 py-2.5 text-xs text-slate-600">{o.cancelledAt ? new Date(o.cancelledAt).toLocaleDateString("ru-RU") : "—"}</td>}
                    </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5 + (paymentFailed === "true" ? 1 : 0) + (pendingRefund === "true" ? 1 : 0) + (cancelledWithin ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-400">
                      Заказов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data && data.total > 0 && (
              <Pagination
                page={page}
                pageSize={20}
                total={data.total}
                onPageChange={(p) => { setPage(p); setSelected(null); }}
              />
            )}
          </div>
        </div>
      </div>

      {selected && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-600">{selected.referenceNumber ?? selected.code}</span>
                <span className="font-mono text-xs text-slate-400">{selected.number}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.paymentStatus} />
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Позиции заказа</div>
              <div className="space-y-1.5">
                {(selected.items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-medium text-slate-700">{i.title}</div>
                      <div className="font-mono text-[11px] text-slate-400">{i.productCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-700">
                        {i.quantity} × {Number(i.price).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-400">{Number(i.amount).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Туристы</div>
              {(selected.travelers ?? []).map((t) => (
                <div key={t.id} className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">
                    {t.firstName} {t.lastName}
                  </span>
                  <StatusBadge status={t.dataCompleteness === "COMPLETE" ? "CONFIRMED" : "WAITING_FOR_DATA"} />
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Связанные брони</div>
              {bookings.length === 0 && <div className="text-slate-400">Бронирований нет</div>}
              <div className="space-y-1.5">
                {bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-mono text-xs text-blue-600">{b.code}</span>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Команды (actions)</div>
              <ActionButtons actions={ACTIONS} status={selected.status} permOf={permOf} onRun={(a) => void runAction(a)} />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">История (audit)</div>
              <div className="space-y-1.5">
                {(selected.history ?? []).slice(0, 8).map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">
                      {h.action}
                      {h.from && <span className="text-slate-400"> {h.from} → </span>}
                      {h.to && <span className="text-slate-700">{h.to}</span>}
                    </div>
                    <div className="text-slate-400">{h.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function OrdersWithParams() {
  const sp = useSearchParams();
  return (
    <OrdersContent
      initialStatus={sp.get("status") ?? ""}
      initialSearch={sp.get("search") ?? ""}
      initialPaymentStatus={sp.get("paymentStatus") ?? ""}
      initialCancelledWithin={sp.get("cancelledWithin") ?? ""}
      initialPaymentFailed={sp.get("paymentFailed") ?? ""}
      initialPendingRefund={sp.get("pendingRefund") ?? ""}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? ""}
      initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? ""}
    />
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <OrdersWithParams />
    </Suspense>
  );
}
