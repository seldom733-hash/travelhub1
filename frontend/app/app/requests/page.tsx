"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale, t, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableHeaderFilter from "@/components/TableHeaderFilter";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";

interface RequestItem {
  id: string;
  code: string;
  commerceSequence: string;
  referenceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerCode: string | null;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerCode: string | null;
  status: string;
  requestedServiceDate: string | null;
  quantity: number;
  displayedPrice: string | null;
  displayedCurrency: string | null;
  confirmedPrice: string | null;
  confirmedCurrency: string | null;
  supplierResponseDeadline: string | null;
  supplierRespondedAt: string | null;
  supplierDecision: string | null;
  customerActionDeadline: string | null;
  customerAcceptedAt: string | null;
  convertedOrderId: string | null;
  createdAt: string | null;
}

interface KpiData {
  [key: string]: number;
  total: number;
  new: number;
  checking: number;
  price_changed: number;
  confirmed: number;
  converted: number;
  rejected: number;
  unavailable: number;
  expired: number;
  supplier_timeout: number;
  customer_payment_timeout: number;
  cancelled_by_customer: number;
}

/**
 * UI-C1.2B — canonical Requests status overview (ADR-OPS-015).
 *
 * All 12 ACTUAL RequestStatus enum values are visible as KPI cards
 * (RequestStatus source of truth, UI-C1.2 §7/§13). Order = enum declaration
 * order from the C1.2 audit — NOT alphabetical, NOT a lifecycle flow
 * (Requests registry cards, not Orders lifecycle chain cards).
 */
const REQUEST_LIFECYCLE_STATUSES = [
  "NEW",
  "CHECKING",
  "SUPPLIER_TIMEOUT",
  "PRICE_CHANGED",
  "CUSTOMER_ACCEPTED",
  "CONFIRMED",
  "CONVERTED",
  "REJECTED",
  "UNAVAILABLE",
  "EXPIRED",
  "CUSTOMER_PAYMENT_TIMEOUT",
  "CANCELLED_BY_CUSTOMER",
] as const;

/**
 * One canonical localized label per Request status (UI-C1.2B §19):
 * KPI card label = filter option = table badge = Help label all resolve
 * through requests.kpi.<status> — the exact label source bound in the
 * UI-C1.2 visual-composition micro-closure coverage matrix.
 */
function requestStatusLabel(code: string, locale: Locale): string {
  const key = `requests.kpi.${code.toLowerCase()}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Locale-aware table cell formatting (RU/AZ/EN via BCP-47 tags). */
function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale]);
}

function fmtDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE_TAGS[locale]);
}

/**
 * UI-C1.2B/UI-C1.2F.1G — Requests registry with URL-state synchronization.
 *
 * Canonical query params (ADR-OPS-012 subset; Header Period is global scope
 * and server-side sorting is allowlisted on the Requests list endpoint):
 *
 *   ?search=&status=&dateFrom=&dateTo=&sortBy=&sortDirection=&page=
 *
 * - status KPI cards AND the Status table-header filter share ONE state and
 *   both set ?status= (server-side fetch, page → 1);
 * - Total card click / "All" header option clears ?status= (page → 1);
 * - sortable column headers (SortableHeader) set ?sortBy=&sortDirection=
 *   (server-side fetch, page → 1);
 * - debounced search syncs ?search=;
 * - Reset clears search+status+sort+page but PRESERVES Header Period;
 * - reload / direct URL / browser Back-Forward restore state from the URL;
 * - Header Period (?dateFrom=/dateTo=) is GLOBAL scope: KPI overview AND table
 *   recompute together, while status/sort stay table-only (KPI counts static
 *   under status filtering, UI-C1.2F.1G §9).
 */
function RequestsContent({
  initialStatus,
  initialSearch,
  initialPage,
  initialDateFrom,
  initialDateTo,
  initialSortBy,
  initialSortDirection,
}: {
  initialStatus: string;
  initialSearch: string;
  initialPage: number;
  initialDateFrom: string;
  initialDateTo: string;
  initialSortBy: string;
  initialSortDirection: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage || 1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus || "");
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const [sortBy, setSortBy] = useState(initialSortBy || "");
  const [sortDirection, setSortDirection] = useState<SortDirection>((initialSortDirection as SortDirection) || "desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── URL-state writes (replaceState — ADR-OPS-012: filter changes rewrite the
  // current history entry; Back/Forward stays for route navigation) ──────────
  // UI-C1.2F.1G: updateUrl touches ONLY the keys the caller passes (undefined =
  // delete that key). Unrelated params — Header Period (dateFrom/dateTo), search,
  // status, sort — are preserved across every write (URL authority §16/§18): a
  // sort change never drops the active status/search filter, and vice versa.
  const updateUrl = useCallback(
    (params: { search?: string; status?: string; page?: string; sortBy?: string; sortDirection?: string }) => {
      const sp = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(params)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      const qs = sp.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [],
  );

  // Live search with debounce — search reflected in URL after commit.
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearch(value);
        setPage(1);
        updateUrl({ search: value || undefined, page: undefined });
      }, 350);
    },
    [updateUrl],
  );

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && debounceRef.current) {
        clearTimeout(debounceRef.current);
        setSearch(searchDraft);
        setPage(1);
        updateUrl({ search: searchDraft || undefined, page: undefined });
      }
    },
    [searchDraft, updateUrl],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Apply a canonical status — shared by the KPI card click and the Status
  // table-header filter (TableHeaderFilter onChange). One state, one URL param.
  // UI-C1.2F.1G §7: header filter ↔ KPI card stay in sync. Server-side.
  const applyStatus = useCallback(
    (code: string) => {
      setStatusFilter(code);
      setPage(1);
      updateUrl({ status: code || undefined, page: undefined });
    },
    [updateUrl],
  );

  // Sort handler for SortableHeader (shared sort UX — UI-C1.2F.1G §14).
  // Sort change resets page → 1 (URL authority, §16) and is server-side.
  const handleSort = useCallback(
    (field: string, direction: SortDirection) => {
      setSortBy(field);
      setSortDirection(direction);
      setPage(1);
      updateUrl({ sortBy: field, sortDirection: direction, page: undefined });
    },
    [updateUrl],
  );

  const currentSort = sortBy ? { sortBy, sortDirection } : null;

  // UI-C1.2F.1B: Period state from shared Header — synced from URL via initial* props.
  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");
  // Sync when Header Period changes the URL (parent re-renders with new initial*).
  useEffect(() => {
    setDateFrom(initialDateFrom || "");
    setDateTo(initialDateTo || "");
  }, [initialDateFrom, initialDateTo]);

  // Reset — clears search + status + sort, page → 1, but PRESERVES Header Period.
  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setStatusFilter("");
    setSortBy("");
    setSortDirection("desc");
    setPage(1);
    updateUrl({ search: undefined, status: undefined, sortBy: undefined, sortDirection: undefined, page: undefined });
  }, [updateUrl]);

  // Server-side registry fetch under the active query scope (status + search + period + sort).
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search, dateFrom, dateTo, sortBy, sortDirection]);

  // UI-C1.2F.1B: KPI re-fetches when period changes (GLOBAL scope → KPI + table).
  useEffect(() => {
    loadKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortBy) params.set("sortDirection", sortDirection);
      const d = (await api.get(`/requests?${params.toString()}`)) as any;
      setRequests(d.data);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch (err: any) {
      setError(err.message || "Error loading requests");
    } finally {
      setLoading(false);
    }
  }

  // UI-C1.2F.1B: KPI with shared Header Period scope.
  async function loadKpi() {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const qs = params.toString();
      const d: any = await api.get(`/requests/kpi${qs ? `?${qs}` : ""}`);
      setKpi(d);
    } catch {
      /* noop */
    }
  }

  const selectedStatus = statusFilter || "";
  const filtersActive = Boolean(statusFilter || search || sortBy);
  const pageChange = (p: number) => {
    setPage(p);
    updateUrl({ page: p > 1 ? String(p) : undefined });
  };

  // Build export URL with the current server-side table scope (UI-C1.2F.1G §21:
  // period + search + status). Sorting is intentionally NOT forwarded — the
  // Requests export endpoint keeps its existing default createdAt desc order.
  const exportParams = new URLSearchParams();
  if (statusFilter) exportParams.set("status", statusFilter);
  if (search) exportParams.set("search", search);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  const exportUrl = `/api/v1/requests/export?${exportParams.toString()}`;

  // TableHeaderFilter options for Status column
  const statusFilterOptions = REQUEST_LIFECYCLE_STATUSES.map((code) => ({
    value: code,
    label: requestStatusLabel(code, locale),
  }));

  return (
    <OperationsCenterShell activeDomain="requests">
      <div className="space-y-4">
        {/* TOTAL KPI — canonical naming, ~15-20% larger, NOT full-width */}
        {kpi && (
          <div className="w-fit max-w-full">
            <CommerceKpiCard
              variant="total"
              label={t("requests.kpi.total", locale)}
              value={kpi.total ?? 0}
              active={!selectedStatus}
              onClick={() => {
                setStatusFilter("");
                setPage(1);
                updateUrl({ status: undefined, page: undefined });
              }}
            />
          </div>
        )}

        {/* STATUS KPI CARDS — one visible card per canonical status (12/12) */}
        {kpi && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.kpi.request_statuses", locale) || "Статусы заявок"}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {REQUEST_LIFECYCLE_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={requestStatusLabel(code, locale)}
                  value={kpi[code.toLowerCase()] ?? 0}
                  active={selectedStatus === code}
                  onClick={() => applyStatus(code)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Toolbar — canonical visible order: [Search][Reset][CSV][XLSX].
            UI-C1.2F.1G: Status filter lives in the Status table header (shared
            TableHeaderFilter), never duplicated in the toolbar. Period is
            Header-owned (GLOBAL scope, UI-C1.2F.1B). */}
        <OperationsToolbarSlot>
          <input
            value={searchDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("requests.search_placeholder", locale)}
            aria-label={t("requests.search_placeholder", locale)}
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={handleReset}
            disabled={!filtersActive}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("filters.reset", locale)}
          </button>

          {loading && <span className="text-xs text-slate-400">{t("common.loading", locale)}</span>}

          <TableExportButton exportUrl={exportUrl} label={t("export.label", locale)} />
        </OperationsToolbarSlot>

        {/* Error */}
        {error && <OperationsErrorState message={error} onRetry={() => void loadData()} />}

        {/* Table */}
        <OperationsRegistrySlot>
          {loading && requests.length === 0 ? (
            <OperationsLoadingState />
          ) : (
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="referenceNumber" currentSort={currentSort} onSort={handleSort}>{t("requests.ref", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("requests.customer", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("requests.product", locale)}</th>
                  <th className="px-4 py-2.5 font-medium">{t("requests.supplier", locale)}</th>
                  <SortableHeader field="displayedPrice" currentSort={currentSort} onSort={handleSort}>{t("requests.displayed_price", locale)}</SortableHeader>
                  <SortableHeader field="confirmedPrice" currentSort={currentSort} onSort={handleSort}>{t("requests.confirmed_price", locale)}</SortableHeader>
                  <SortableHeader field="serviceDate" currentSort={currentSort} onSort={handleSort}>{t("requests.service_date", locale)}</SortableHeader>
                  <SortableHeader field="status" currentSort={currentSort} onSort={handleSort} filterSlot={<TableHeaderFilter id="requests-status-filter" label="" options={statusFilterOptions} value={statusFilter} onChange={applyStatus} ariaLabel={t("admin.filter.all_statuses", locale)} />}>{t("admin.table.col.status", locale)}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={currentSort} onSort={handleSort}>{t("requests.created", locale)}</SortableHeader>
                  <SortableHeader field="slaDeadline" currentSort={currentSort} onSort={handleSort}>{t("requests.sla_deadline", locale)}</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && !loading && (
                  <OperationsEmptyState
                    colSpan={10}
                    message={filtersActive ? t("ops.empty_no_results", locale) : t("requests.no_data", locale)}
                  />
                )}
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50"
                    onClick={() => router.push(`/app/requests/${r.id}`)}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/app/requests/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {r.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      <div>{r.customerName || "—"}</div>
                      {r.customerCode && <div className="text-xs text-slate-400">{r.customerCode}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      <div>{r.productName || "—"}</div>
                      {r.productCode && <div className="text-xs text-slate-400">{r.productCode}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      <div>{r.partnerName || "—"}</div>
                      {r.partnerCode && <div className="text-xs text-slate-400">{r.partnerCode}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">{fmtDate(r.requestedServiceDate, locale)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} label={requestStatusLabel(r.status, locale)} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(r.createdAt, locale)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(r.supplierResponseDeadline, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              locale={locale}
              onPageChange={pageChange}
            />
          )}
        </OperationsRegistrySlot>
      </div>
    </OperationsCenterShell>
  );
}

function RequestsWithParams() {
  const sp = useSearchParams();
  const rawPage = parseInt(sp.get("page") ?? "", 10);
  const rawSortDirection = sp.get("sortDirection");
  return (
    <RequestsContent
      initialStatus={sp.get("status") ?? ""}
      initialSearch={sp.get("search") ?? ""}
      initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}
      initialDateFrom={sp.get("dateFrom") ?? ""}
      initialDateTo={sp.get("dateTo") ?? ""}
      initialSortBy={sp.get("sortBy") ?? ""}
      initialSortDirection={
        rawSortDirection === "asc" || rawSortDirection === "desc" ? rawSortDirection : ""
      }
    />
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <RequestsWithParams />
    </Suspense>
  );
}
