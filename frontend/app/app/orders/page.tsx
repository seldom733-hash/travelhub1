"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Order, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import Pagination from "@/components/Pagination";
import OrderActionBar from "@/components/order/OrderActionBar";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableExportButton from "@/components/TableExportButton";
import { useLocale, t, type Locale } from "@/lib/i18n";
import { orderActionLabel } from "@/lib/commerce-history-labels";

const ORDER_LIFECYCLE_STATUSES = [
  "NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING",
  "SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "FULFILLED", "READY_TO_CLOSE",
  "CLOSED", "CANCELLED", "PROBLEM", "SUSPENDED",
] as const;

const ORDER_PAYMENT_STATUSES = [
  "UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED",
] as const;

function lifecycleLabel(code: string, locale: Locale): string {
  const key = `order.status.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function paymentLabel(code: string, locale: Locale): string {
  const key = `order.payment.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function OrdersContent({ initialStatus, initialSearch, initialPaymentStatus, initialCancelledWithin, initialPaymentFailed, initialPendingRefund, initialSortBy, initialSortDirection, initialDateFrom, initialDateTo }: { initialStatus: string; initialSearch?: string; initialPaymentStatus?: string; initialCancelledWithin?: string; initialPaymentFailed?: string; initialPendingRefund?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialDateFrom?: string; initialDateTo?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<Order> | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [bookings, setBookings] = useState<{ id: string; referenceNumber: string; status: string }[]>([]);
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Live search with debounce
  const onSearchChange = useCallback((value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  }, []);

  const onSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && debounceRef.current) {
      clearTimeout(debounceRef.current);
      setSearch(searchDraft);
      setPage(1);
    }
  }, [searchDraft]);

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

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const openDetail = async (id: string) => {
    const [order, bk] = await Promise.all([
      api.get<Order>(`/orders/${id}`),
      api.get<{ items: { id: string; referenceNumber: string; status: string }[] }>(`/bookings?orderId=${id}`),
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
      setError((e as Error).message);
    }
  };

  // KPI data from backend aggregates
  const lifecycleCounts = (data?.aggregates?.lifecycle ?? {}) as Record<string, number>;
  const paymentCounts = (data?.aggregates?.payment ?? {}) as Record<string, number>;
  const total = data?.total ?? 0;

  // Selected KPI state
  const selectedLifecycle = statusFilter || "";
  const selectedPayment = paymentStatusFilter || "";

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
          {/* TOTAL KPI — canonical naming, ~15-20% larger, NOT full-width */}
          <div className="w-fit max-w-full">
            <CommerceKpiCard
              variant="total"
              label={t("admin.kpi.total_orders", locale)}
              value={total}
              active={!selectedLifecycle && !selectedPayment}
              onClick={() => { setStatusFilter(""); setPaymentStatusFilter(""); setPage(1); updateUrl({ status: "", paymentStatus: "" }); }}
            />
          </div>

          {/* LIFECYCLE STATUS KPI */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin.kpi.lifecycle_statuses", locale) || "Статусы заказов"}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {ORDER_LIFECYCLE_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={lifecycleLabel(code, locale)}
                  value={lifecycleCounts[code] ?? 0}
                  active={selectedLifecycle === code}
                  onClick={() => { setStatusFilter(code); setPaymentStatusFilter(""); setPage(1); updateUrl({ status: code, paymentStatus: "" }); }}
                />
              ))}
            </div>
          </div>

          {/* PAYMENT STATUS KPI */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin.kpi.payment_statuses", locale) || "Статусы оплаты"}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ORDER_PAYMENT_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={paymentLabel(code, locale)}
                  value={paymentCounts[code] ?? 0}
                  active={selectedPayment === code}
                  onClick={() => { setPaymentStatusFilter(code); setStatusFilter(""); setPage(1); updateUrl({ paymentStatus: code, status: "" }); }}
                />
              ))}
            </div>
          </div>

          {/* Toolbar: search first, then filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("admin.search.placeholder_orders", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); updateUrl({ status: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("admin.filter.all_statuses", locale)}</option>
              {ORDER_LIFECYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>{lifecycleLabel(s, locale)}</option>
              ))}
            </select>
            <select
              value={paymentStatusFilter}
              onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1); updateUrl({ paymentStatus: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("admin.filter.all_payments", locale)}</option>
              {ORDER_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{paymentLabel(s, locale)}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">{t("common.date_from", locale)}</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">{t("common.date_to", locale)}</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>
            {busy && <span className="text-xs text-slate-400">{t("common.loading_short", locale)}</span>}
            <TableExportButton
              exportUrl="/api/v1/orders/export"
              extraParams={{
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
                ...(search ? { search } : {}),
              }}
            />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

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
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.amount", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.items", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  <SortableHeader field="paymentStatus" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.payment", locale)}</SortableHeader>
                  {paymentFailed === "true" && <th className="px-4 py-2.5 font-medium text-red-600">{t("admin.table.col.payment", locale)}</th>}
                  {pendingRefund === "true" && <th className="px-4 py-2.5 font-medium text-amber-600">{t("admin.table.col.refund", locale)}</th>}
                  {cancelledWithin && <SortableHeader field="cancelledAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.cancel_date", locale)}</SortableHeader>}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => { setSelected(null); router.push(`/app/orders/${o.id}`); }}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${selected?.id === o.id ? "bg-blue-50/60" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/app/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-blue-600 hover:underline">{o.referenceNumber}</Link>
                        <button
                          title="Быстрый просмотр"
                          onClick={(e) => { e.stopPropagation(); void openDetail(o.id); }}
                          className="rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >👁</button>
                      </div>
                      <div className="text-xs text-slate-400">{o.number}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 text-center">
                      {o.amount ? `${Number(o.amount).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${o.currency ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{o.items?.length ?? 0}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={o.paymentStatus} /></td>
                    {paymentFailed === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">{t("orders.quick.payment_failed", locale)}</span></td>}
                    {pendingRefund === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">{t("orders.quick.pending_refund", locale)}</span></td>}
                    {cancelledWithin && <td className="px-4 py-2.5 text-xs text-slate-600">{o.cancelledAt ? new Date(o.cancelledAt).toLocaleDateString("ru-RU") : "—"}</td>}
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5 + (paymentFailed === "true" ? 1 : 0) + (pendingRefund === "true" ? 1 : 0) + (cancelledWithin ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-400">
                      {t("orders.empty", locale)}
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
                <span className="font-mono text-xs text-blue-600">{selected.referenceNumber}</span>
                <span className="font-mono text-xs text-slate-400">{selected.number}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.paymentStatus} />
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("order.items", locale)}</div>
              <div className="space-y-1.5">
                {(selected.items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-medium text-slate-700">{i.title}</div>
                      <div className="font-mono text-[11px] text-slate-400">{i.productCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-700">
                        {i.quantity} × {i.price ? `${Number(i.price).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selected?.currency ?? ""}` : "—"}
                      </div>
                      <div className="text-xs text-slate-400">{i.amount ? `${Number(i.amount).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selected?.currency ?? ""}` : "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("reqflow.travelers", locale)}</div>
              {(selected.travelers ?? []).map((tr) => (
                <div key={tr.id} className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{tr.firstName} {tr.lastName}</span>
                  <StatusBadge status={tr.dataCompleteness === "COMPLETE" ? "CONFIRMED" : "WAITING_FOR_DATA"} />
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("orders.quick.bookings", locale)}</div>
              {bookings.length === 0 && <div className="text-slate-400">{t("orders.quick.no_bookings", locale)}</div>}
              <div className="space-y-1.5">
                {bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-mono text-xs text-blue-600">{b.referenceNumber}</span>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            </div>

            {(selected as Order & { availableActions?: string[] }).availableActions?.length ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("detail.sections.actions", locale)}</div>
                <OrderActionBar
                  actions={(selected as Order & { availableActions?: string[] }).availableActions ?? []}
                  onRun={(a) => void runAction(a)}
                  busyAction={null}
                />
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("crm.detail.history", locale)}</div>
              <div className="space-y-1.5">
                {(selected.history ?? []).slice(0, 8).map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">
                      {orderActionLabel(h.action, locale)}
                      {h.from && <span className="text-slate-400"> <StatusBadge status={h.from} /> → </span>}
                      {h.to && <span className="text-slate-700"><StatusBadge status={h.to} /></span>}
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
