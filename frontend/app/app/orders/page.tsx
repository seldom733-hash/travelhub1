"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Order, type Page } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import Pagination from "@/components/Pagination";
import OrderActionBar from "@/components/order/OrderActionBar";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableHeaderFilter, { type FilterOption } from "@/components/TableHeaderFilter";
import TableExportButton from "@/components/TableExportButton";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";
import { useLocale, t, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { orderActionLabel } from "@/lib/commerce-history-labels";

/**
 * UI-C1.2C — canonical Orders registry composition (ADR-OPS-015 / ADR-OPS-005).
 *
 * Semantic groups (never one flat grid):
 *   [ Всего заказов ]                      — Total, ~15-20% larger, NOT full-width
 *   ЖИЗНЕННЫЙ ЦИКЛ                          — truthful happy-path chain (six cards,
 *                                             simple decorative connectors ONLY between
 *                                             the audited sequential transitions)
 *   АЛЬТЕРНАТИВНЫЕ / REWORK                  — WAITING_FOR_DATA / PARTIALLY_FULFILLED /
 *                                             READY_TO_CLOSE (no false linear path)
 *   ИСКЛЮЧЕНИЯ                              — PROBLEM / SUSPENDED / CANCELLED
 *   СТАТУС ОПЛАТЫ                           — 4/4 OrderPaymentStatus (separate dimension)
 *
 * State-machine truth: READY_TO_CLOSE has no audited producer → visible card,
 * but NO incoming arrow is drawn to it. Exception states are never connected.
 *
 * URL state (ADR-OPS-012 subset): ?search=&status=&paymentStatus=&dateFrom=
 * &dateTo=&page= — direct URL, reload, Back/Forward, card clicks, Reset.
 * KPI counts come only from server aggregates computed on the SAME `where` as
 * the table (listOrders groupBy on the identical filtered scope).
 */
// Canonical OrderStatus enum order (source of truth — never reordered)
const ORDER_LIFECYCLE_STATUSES = [
  "NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING",
  "SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "FULFILLED", "READY_TO_CLOSE",
  "CLOSED", "CANCELLED", "PROBLEM", "SUSPENDED",
] as const;

// Primary lifecycle — happy-path chain (all arrows truthful per §5 transitions)
const ORDER_HAPPY_PATH = [
  "NEW", "IN_PROCESSING", "READY_FOR_BOOKING", "SENT_TO_BOOKING", "FULFILLED", "CLOSED",
] as const;

// Alternative / rework states — real, but NOT a linear path (no arrows)
const ORDER_REWORK_STATES = [
  "WAITING_FOR_DATA", "PARTIALLY_FULFILLED", "READY_TO_CLOSE",
] as const;

// Exceptions — terminal/attention states (no arrows, separate group)
const ORDER_EXCEPTION_STATES = [
  "PROBLEM", "SUSPENDED", "CANCELLED",
] as const;

const ORDER_PAYMENT_STATUSES = [
  "UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED",
] as const;

/** Build filter options for TableHeaderFilter from canonical status arrays. */
function buildStatusFilterOptions(locale: Locale): FilterOption[] {
  return ORDER_LIFECYCLE_STATUSES.map((s) => ({ value: s, label: lifecycleLabel(s, locale) }));
}
function buildPaymentFilterOptions(locale: Locale): FilterOption[] {
  return ORDER_PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentLabel(s, locale) }));
}

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

/** Locale-aware date cell (RU/AZ/EN via BCP-47 tags). */
function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale]);
}

/** Locale-aware money cell — canonical amount formatting, D7 stays server authority. */
function fmtMoney(amount: string | null, currency: string | null | undefined, locale: Locale): string {
  if (!amount) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`;
}

function OrdersContent({ initialStatus, initialSearch, initialPaymentStatus, initialCancelledWithin, initialPaymentFailed, initialPendingRefund, initialSortBy, initialSortDirection, initialDateFrom, initialDateTo, initialPage }: { initialStatus: string; initialSearch?: string; initialPaymentStatus?: string; initialCancelledWithin?: string; initialPaymentFailed?: string; initialPendingRefund?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialDateFrom?: string; initialDateTo?: string; initialPage?: number }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<Order> | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [bookings, setBookings] = useState<{ id: string; referenceNumber: string; status: string }[]>([]);
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(initialPage || 1);
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

  // UI-C1.2F.1B-R1: Sync dateFrom/dateTo when Header Period changes the URL.
  useEffect(() => {
    setDateFrom(initialDateFrom || "");
    setDateTo(initialDateTo || "");
  }, [initialDateFrom, initialDateTo]);

  // ── URL-state writes (replaceState — ADR-OPS-012). Detector/sort params that
  // arrive via deep links are preserved unless explicitly reset. ─────────────
  const updateUrl = useCallback((params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  // Live search with debounce (~350 ms) — committed value reflected in URL.
  const onSearchChange = useCallback((value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      updateUrl({ search: value || undefined, page: undefined });
    }, 350);
  }, [updateUrl]);

  const onSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && debounceRef.current) {
      clearTimeout(debounceRef.current);
      setSearch(searchDraft);
      setPage(1);
      updateUrl({ search: searchDraft || undefined, page: undefined });
    }
  }, [searchDraft, updateUrl]);

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
    updateUrl({ sortBy: field, sortDirection: direction });
  };

  const applyStatus = useCallback((code: string) => {
    setStatusFilter(code);
    setPaymentStatusFilter("");
    setPage(1);
    updateUrl({ status: code || undefined, paymentStatus: undefined, page: undefined });
  }, [updateUrl]);

  const applyPaymentStatus = useCallback((code: string) => {
    setPaymentStatusFilter(code);
    setStatusFilter("");
    setPage(1);
    updateUrl({ paymentStatus: code || undefined, status: undefined, page: undefined });
  }, [updateUrl]);

  // Total — clears the applicable Order status dimensions (status + paymentStatus).
  const handleTotalClick = useCallback(() => {
    setStatusFilter("");
    setPaymentStatusFilter("");
    setPage(1);
    updateUrl({ status: undefined, paymentStatus: undefined, page: undefined });
  }, [updateUrl]);

  // UI-C1.2F.1B: Local date controls removed — period is Header-owned (GLOBAL scope).
  // dateFrom/dateTo state is read from URL and passed to API; Header manages them.

  const filtersActive = Boolean(statusFilter || paymentStatusFilter || search || sortBy);
  // Reset clears registry-specific filters but PRESERVES Header Period.
  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setStatusFilter("");
    setPaymentStatusFilter("");
    setSortBy(undefined);
    setSortDirection(undefined);
    setPage(1);
    updateUrl({ search: undefined, status: undefined, paymentStatus: undefined, sortBy: undefined, sortDirection: undefined, page: undefined });
  }, [updateUrl]);

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

  // KPI data from server aggregates. UI-C1.2C REMEDIATION R1: the aggregates are
  // computed by the backend on the OVERVIEW scope (global registry scope WITHOUT
  // the active KPI-card dimensions status/paymentStatus), so selecting a card
  // filters the TABLE only and the other cards keep their overview counts.
  const lifecycleCounts = (data?.aggregates?.lifecycle ?? {}) as Record<string, number>;
  const paymentCounts = (data?.aggregates?.payment ?? {}) as Record<string, number>;
  // Total card = overview total (stable across KPI-card selection); the table's
  // own `total` (data.total) stays the pagination scope.
  const overviewTotal = (data?.aggregates?.lifecycle as Record<string, number> | undefined)?.total ?? data?.total ?? 0;
  const total = data?.total ?? 0;

  // Selected KPI state
  const selectedLifecycle = statusFilter || "";
  const selectedPayment = paymentStatusFilter || "";

  return (
    <OperationsCenterShell
      activeDomain="orders"
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {/* TOTAL KPI — canonical naming, ~15-20% larger, NOT full-width */}
          <div className="w-fit max-w-full">
            <CommerceKpiCard
              variant="total"
              label={t("admin.kpi.total_orders", locale)}
              value={overviewTotal}
              active={!selectedLifecycle && !selectedPayment}
              onClick={handleTotalClick}
            />
          </div>

          {/* LIFECYCLE — truthful happy-path process chain (six canonical cards).
              Simple decorative connectors render ONLY between adjacent happy-path
              statuses (NEW→IN_PROCESSING→READY_FOR_BOOKING→SENT_TO_BOOKING→
              FULFILLED→CLOSED). No arrow can target rework/exception states. */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orders.group.lifecycle", locale)}</div>
            <ol
              className="flex flex-wrap gap-2 xl:flex-nowrap xl:gap-0"
              aria-label={t("orders.group.lifecycle", locale)}
            >
              {ORDER_HAPPY_PATH.flatMap((code, idx) => [
                <li
                  key={code}
                  className="w-[calc((100%-0.5rem)/2)] min-w-0 sm:w-[calc((100%-1rem)/3)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-5rem)/6)]"
                >
                  <CommerceKpiCard
                    className="w-full"
                    label={lifecycleLabel(code, locale)}
                    value={lifecycleCounts[code] ?? 0}
                    active={selectedLifecycle === code}
                    onClick={() => applyStatus(code)}
                  />
                </li>,
                // decorative connector between adjacent happy-path cards (xl row only)
                ...(idx < ORDER_HAPPY_PATH.length - 1
                  ? [
                      <li
                        key={`conn-${code}`}
                        aria-hidden="true"
                        className="hidden w-4 shrink-0 items-center justify-center self-center text-slate-300 xl:flex"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </li>,
                    ]
                  : []),
              ])}
            </ol>
          </div>

          {/* ALTERNATIVE / REWORK — visible, never forced into the happy path */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orders.group.rework", locale)}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ORDER_REWORK_STATES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={lifecycleLabel(code, locale)}
                  value={lifecycleCounts[code] ?? 0}
                  active={selectedLifecycle === code}
                  onClick={() => applyStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* EXCEPTIONS — separate group, no sequential implication */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orders.group.exceptions", locale)}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ORDER_EXCEPTION_STATES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={lifecycleLabel(code, locale)}
                  value={lifecycleCounts[code] ?? 0}
                  active={selectedLifecycle === code}
                  onClick={() => applyStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* PAYMENT STATUS — separate dimension, 4/4 OrderPaymentStatus */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("orders.group.payment", locale)}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ORDER_PAYMENT_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={paymentLabel(code, locale)}
                  value={paymentCounts[code] ?? 0}
                  active={selectedPayment === code}
                  onClick={() => applyPaymentStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* Toolbar: canonical order [Search][Lifecycle status][Payment status]
              [From][To][Reset][CSV][XLSX]. Period is exposed: Orders aggregates and
              table share the same createdAt [from,to) server scope. */}
          <OperationsToolbarSlot>
            <input
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("admin.search.placeholder_orders", locale)}
              aria-label={t("admin.search.placeholder_orders", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {/* UI-C1.2F.1D: Status + Payment filters moved to table header */}
            <button
              type="button"
              onClick={handleReset}
              disabled={!filtersActive}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("filters.reset", locale)}
            </button>
            {busy && <span className="text-xs text-slate-400">{t("common.loading", locale)}</span>}
            <TableExportButton
              exportUrl="/api/v1/orders/export"
              extraParams={{
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(paymentStatusFilter ? { paymentStatus: paymentStatusFilter } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
                ...(search ? { search } : {}),
                ...(cancelledWithin ? { cancelledWithin } : {}),
                ...(paymentFailed ? { paymentFailed } : {}),
                ...(pendingRefund ? { pendingRefund } : {}),
              }}
            />
          </OperationsToolbarSlot>

          {error && <OperationsErrorState message={error} onRetry={() => void load()} />}

          <OperationsRegistrySlot>
            {!data && busy ? (
              <OperationsLoadingState />
            ) : (
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
                    <SortableHeader
                      field="status"
                      currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null}
                      onSort={handleSort}
                      filterSlot={
                        <TableHeaderFilter
                          id="orders-filter-status"
                          label=""
                          options={buildStatusFilterOptions(locale)}
                          value={statusFilter || ""}
                          onChange={applyStatus}
                          ariaLabel={t("admin.filter.all_statuses", locale)}
                        />
                      }
                    >{t("admin.table.col.status", locale)}</SortableHeader>
                    <SortableHeader
                      field="paymentStatus"
                      currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null}
                      onSort={handleSort}
                      filterSlot={
                        <TableHeaderFilter
                          id="orders-filter-payment"
                          label=""
                          options={buildPaymentFilterOptions(locale)}
                          value={paymentStatusFilter || ""}
                          onChange={applyPaymentStatus}
                          ariaLabel={t("admin.filter.all_payments", locale)}
                        />
                      }
                    >{t("admin.table.col.payment", locale)}</SortableHeader>
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
                      <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(o.createdAt, locale)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 text-center">
                        {fmtMoney(o.amount, o.currency, locale)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{o.items?.length ?? 0}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} label={lifecycleLabel(o.status, locale)} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.paymentStatus} label={paymentLabel(o.paymentStatus, locale)} /></td>
                      {paymentFailed === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">{t("orders.quick.payment_failed", locale)}</span></td>}
                      {pendingRefund === "true" && <td className="px-4 py-2.5"><span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">{t("orders.quick.pending_refund", locale)}</span></td>}
                      {cancelledWithin && <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(o.cancelledAt, locale)}</td>}
                    </tr>
                  ))}
                  {(data?.items ?? []).length === 0 && (
                    <OperationsEmptyState colSpan={6 + (paymentFailed === "true" ? 1 : 0) + (pendingRefund === "true" ? 1 : 0) + (cancelledWithin ? 1 : 0)} message={t("orders.empty", locale)} />
                  )}
                </tbody>
              </table>
            )}
            {data && data.total > 0 && (
              <Pagination
                page={page}
                pageSize={20}
                total={data.total}
                onPageChange={(p) => { setPage(p); setSelected(null); updateUrl({ page: p > 1 ? String(p) : undefined }); }}
              />
            )}
          </OperationsRegistrySlot>
        </div>

        {selected && (
          <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-blue-600">{selected.referenceNumber}</span>
                  <span className="font-mono text-xs text-slate-400">{selected.number}</span>
                </div>
                <div className="mt-1 flex gap-2">
                  <StatusBadge status={selected.status} label={lifecycleLabel(selected.status, locale)} />
                  <StatusBadge status={selected.paymentStatus} label={paymentLabel(selected.paymentStatus, locale)} />
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
                          {i.quantity} × {fmtMoney(i.price, selected?.currency, locale)}
                        </div>
                        <div className="text-xs text-slate-400">{fmtMoney(i.amount, selected?.currency, locale)}</div>
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
                        {h.from && <span className="text-slate-400"> <StatusBadge status={h.from} label={lifecycleLabel(h.from, locale)} /> → </span>}
                        {h.to && <span className="text-slate-700"><StatusBadge status={h.to} label={lifecycleLabel(h.to, locale)} /></span>}
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
    </OperationsCenterShell>
  );
}

function OrdersWithParams() {
  const sp = useSearchParams();
  const rawPage = parseInt(sp.get("page") ?? "", 10);

  // UI-C1.2F.1D-R1: canonicalize dual-filter URLs. Orders KPI contract permits
  // at most ONE active KPI dimension (status xor paymentStatus). If a deep link,
  // reload, or Back/Forward restores both, normalize deterministically to a single
  // dimension so the UI never renders two pressed KPI cards.
  // Canonical precedence: lifecycle status wins over payment status.
  const rawStatus = sp.get("status") ?? "";
  const rawPaymentStatus = sp.get("paymentStatus") ?? "";
  let initialStatus = rawStatus;
  let initialPaymentStatus = rawPaymentStatus;
  if (initialStatus && initialPaymentStatus) {
    // status wins on conflict — deterministic, documented rule (§6).
    initialPaymentStatus = "";
    window.history.replaceState(null, "", `?${new URLSearchParams([
      ['status', initialStatus],
      ...(rawPaymentStatus ? [] : []),
      ['search', sp.get('search') ?? ''],
      ['sortBy', sp.get('sortBy') ?? ''],
      ['sortDirection', sp.get('sortDirection') ?? ''],
      ['from', sp.get('from') ?? sp.get('dateFrom') ?? ''],
      ['to', sp.get('to') ?? sp.get('dateTo') ?? ''],
      ['page', sp.get('page') ?? ''],
      ['cancelledWithin', sp.get('cancelledWithin') ?? ''],
      ['paymentFailed', sp.get('paymentFailed') ?? ''],
      ['pendingRefund', sp.get('pendingRefund') ?? ''],
    ].filter(([, v]) => v !== undefined && v !== '')).toString()}`);
  }

  return (
    <OrdersContent
      initialStatus={initialStatus}
      initialSearch={sp.get("search") ?? ""}
      initialPaymentStatus={initialPaymentStatus}
      initialCancelledWithin={sp.get("cancelledWithin") ?? ""}
      initialPaymentFailed={sp.get("paymentFailed") ?? ""}
      initialPendingRefund={sp.get("pendingRefund") ?? ""}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? ""}
      initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? ""}
      initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}
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
