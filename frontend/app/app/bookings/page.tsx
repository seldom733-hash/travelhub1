"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Booking, type Page } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import Pagination from "@/components/Pagination";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableExportButton from "@/components/TableExportButton";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";
import { useLocale, t, formatPrice, type Locale } from "@/lib/i18n";

const BOOKING_LIFECYCLE_STATUSES = [
  "NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION",
  "CONFIRMED", "IN_SERVICE", "COMPLETED", "NEEDS_CLARIFICATION",
  "SUPPLIER_REJECTED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED",
  "CANCELLED", "PROBLEM",
] as const;

function bookingStatusLabel(code: string, locale: Locale): string {
  const key = `booking.status.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function BookingsContent({ upcomingOnly, statusFilter, overdueOnly, slaMinutes, initialSortBy, initialSortDirection, initialSearch, initialDateFrom, initialDateTo }: { upcomingOnly: boolean; statusFilter?: string; overdueOnly?: boolean; slaMinutes?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialSearch?: string; initialDateFrom?: string; initialDateTo?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<Booking> | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState(statusFilter ?? "");
  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");
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
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (sortBy) { params.set("sortBy", sortBy); params.set("sortDirection", sortDirection ?? "desc"); }
      if (search) params.set("search", search);
      if (bookingStatusFilter) params.set("status", bookingStatusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await api.get<Page<Booking>>(`/bookings?${params.toString()}`);
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
  }, [upcomingOnly, bookingStatusFilter, overdueOnly, slaMinutes, sortBy, sortDirection, page, search, dateFrom, dateTo]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // KPI data from backend aggregates
  const lifecycleCounts = (data?.aggregates?.lifecycle ?? {}) as Record<string, number>;
  const total = data?.total ?? 0;
  const selectedStatus = bookingStatusFilter || "";

  return (
    <OperationsCenterShell activeDomain="bookings">
      <div className="space-y-4">
        {/* TOTAL KPI — canonical naming, ~15-20% larger, NOT full-width */}
        <div className="w-fit max-w-full">
          <CommerceKpiCard
            variant="total"
            label={t("admin.kpi.total_bookings", locale)}
            value={total}
            active={!selectedStatus}
            onClick={() => { setBookingStatusFilter(""); setPage(1); updateUrl({ status: "" }); }}
          />
        </div>

        {/* LIFECYCLE STATUS KPI */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin.kpi.booking_statuses", locale) || "Статусы бронирований"}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {BOOKING_LIFECYCLE_STATUSES.map((code) => (
              <CommerceKpiCard
                key={code}
                label={bookingStatusLabel(code, locale)}
                value={lifecycleCounts[code] ?? 0}
                active={selectedStatus === code}
                onClick={() => { setBookingStatusFilter(code); setPage(1); updateUrl({ status: code }); }}
              />
            ))}
          </div>
        </div>

        {/* Toolbar: search first */}
        <OperationsToolbarSlot>
          <input
            type="text"
            placeholder={t("admin.search.placeholder_bookings", locale)}
            value={searchDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            className="w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <select
            value={bookingStatusFilter}
            onChange={(e) => { setBookingStatusFilter(e.target.value); setPage(1); updateUrl({ status: e.target.value }); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">{t("admin.filter.all_statuses", locale)}</option>
            {BOOKING_LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>{bookingStatusLabel(s, locale)}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" placeholder={t("common.date_from", locale)} />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" placeholder={t("common.date_to", locale)} />
          {busy && <span className="text-xs text-slate-400">{t("common.loading_short", locale)}</span>}
          <TableExportButton
            exportUrl="/api/v1/bookings/export"
            extraParams={{
              ...(bookingStatusFilter ? { status: bookingStatusFilter } : {}),
              ...(dateFrom ? { dateFrom } : {}),
              ...(dateTo ? { dateTo } : {}),
              ...(search ? { search } : {}),
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
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.code", locale)}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.date", locale)}</SortableHeader>
                  <SortableHeader field="orderId" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.code", locale)}</SortableHeader>
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.amount", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.passengers", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  {(upcomingOnly || overdueOnly) && <SortableHeader field="serviceDate" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.service_date", locale)}</SortableHeader>}
                  {overdueOnly && <th className="px-4 py-2.5 font-medium text-red-600">{t("admin.table.col.waiting", locale)}</th>}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/app/bookings/${b.id}`)}
                    className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50"
                  >
                    <td className="px-4 py-2.5">
                      <Link href={`/app/bookings/${b.id}`} className="font-mono text-xs text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {b.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{b.createdAt ? new Date(b.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.orderReference ?? b.orderId.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 text-center">{formatPrice(b.amount, b.currency, locale) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{b.passengers?.length ?? 0}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    {(upcomingOnly || overdueOnly) && <td className="px-4 py-2.5 text-xs text-slate-600">{b.serviceDate ? new Date(b.serviceDate).toLocaleDateString("ru-RU") : "—"}</td>}
                    {overdueOnly && <td className="px-4 py-2.5">
                      {(() => {
                        const created = new Date(b.createdAt).getTime();
                        const mins = Math.floor((Date.now() - created) / 60000);
                        const h = Math.floor(mins / 60);
                        const d = Math.floor(h / 24);
                        if (d > 0) return <span className="text-xs font-medium text-red-600">{d} дн. {h % 24} ч.</span>;
                        if (h > 0) return <span className="text-xs font-medium text-red-600">{h} ч. {mins % 60} мин</span>;
                        return <span className="text-xs text-slate-500">{mins} мин</span>;
                      })()}
                    </td>}
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <OperationsEmptyState colSpan={5} message={t("bookings.empty", locale)} />
                )}
              </tbody>
            </table>
          )}
          {data && data.total > 0 && (
            <Pagination
              page={page}
              pageSize={20}
              total={data.total}
              onPageChange={(p) => { setPage(p); }}
            />
          )}
        </OperationsRegistrySlot>
      </div>
    </OperationsCenterShell>
  );
}

export default function BookingsPage() {
  const sp = useSearchParams();
  const upcomingOnly = sp.get("upcomingOnly") === "true";
  const statusFilter = sp.get("status") ?? undefined;
  const overdueOnly = sp.get("overdueOnly") === "true";
  const slaMinutes = sp.get("slaMinutes") ?? undefined;

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Загрузка…</div>}>
      <BookingsContent
        upcomingOnly={upcomingOnly}
        statusFilter={statusFilter}
        overdueOnly={overdueOnly}
        slaMinutes={slaMinutes}
        initialSortBy={sp.get("sortBy") ?? undefined}
        initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
        initialSearch={sp.get("search") ?? undefined}
        initialDateFrom={sp.get("dateFrom") ?? undefined}
        initialDateTo={sp.get("dateTo") ?? undefined}
      />
    </Suspense>
  );
}