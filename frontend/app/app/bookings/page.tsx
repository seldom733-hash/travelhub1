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
import { useLocale, t, LOCALE_TAGS, type Locale } from "@/lib/i18n";

/**
 * UI-C1.2D — canonical Bookings registry composition (ADR-OPS-015).
 *
 * Semantic groups (never one flat grid) — the Booking state machine (D6) is
 * the source of truth for connectors:
 *
 *   [ Всего бронирований ]                  — Total, ~15-20% larger, NOT full-width
 *   ОСНОВНОЙ ПРОЦЕСС                        — TWO truthful happy-path flows with
 *                                             decorative connectors ONLY between the
 *                                             audited sequential transitions:
 *                                             NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER
 *                                             CONFIRMED → IN_SERVICE → COMPLETED
 *   ОЖИДАНИЕ ПОДТВЕРЖДЕНИЯ                  — AWAITING_CONFIRMATION: visible + filterable,
 *                                             NO producer in the current state machine →
 *                                             NO incoming arrow (like Order READY_TO_CLOSE)
 *   ОПЕРАЦИОННЫЕ СТАТУСЫ                    — NEEDS_CLARIFICATION / CHANGE_REQUESTED /
 *                                             CANCELLATION_REQUESTED / PROBLEM (no arrows)
 *   КОНЕЧНЫЕ ИСХОДЫ                         — SUPPLIER_REJECTED / CANCELLED (no arrows)
 *
 * KPI interaction contract (Requests = canonical reference): a clicked Booking
 * status card becomes SELECTED and filters the TABLE only; the other 12 cards
 * keep their OVERVIEW counts (server computes aggregates on the overview scope
 * minus the status dimension — see backend booking-kpi-scope). Upcoming/overdue
 * are global detector scopes read from the URL (upcomingOnly/overdueOnly) and
 * are never touched by KPI-card selection.
 *
 * URL state (ADR-OPS-012 subset): ?search=&status=&dateFrom=&dateTo=&page=
 * (+ sortBy/sortDirection, preserved detector params) — direct URL, reload,
 * Back/Forward, card clicks, Reset. KPI counts come only from server
 * aggregates — never from visible rows.
 */
// Canonical BookingStatus enum order (source of truth — never reordered)
const BOOKING_STATUSES = [
  "NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION",
  "CONFIRMED", "IN_SERVICE", "COMPLETED", "NEEDS_CLARIFICATION",
  "SUPPLIER_REJECTED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED",
  "CANCELLED", "PROBLEM",
] as const;

// Flow 1 — request/preparation phase (truthful chain)
const BOOKING_FLOW_PREP = ["NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER"] as const;
// Flow 2 — service/fulfillment phase (truthful chain)
const BOOKING_FLOW_SERVICE = ["CONFIRMED", "IN_SERVICE", "COMPLETED"] as const;
// Waiting — real canonical status, no current producer → visible, no arrow
const BOOKING_AWAITING = ["AWAITING_CONFIRMATION"] as const;
// Operational / decision statuses — recoverable markers, no sequential path
const BOOKING_OPERATIONAL = [
  "NEEDS_CLARIFICATION", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "PROBLEM",
] as const;
// Terminal exception outcomes
const BOOKING_TERMINAL = ["SUPPLIER_REJECTED", "CANCELLED"] as const;

function bookingStatusLabel(code: string, locale: Locale): string {
  const key = `booking.status.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Locale-aware date cell (RU/AZ/EN via BCP-47 tags). */
function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale]);
}

/** Locale-aware money cell — D7 stays server authority (raw server amount string). */
function fmtMoney(amount: string | null, currency: string | null | undefined, locale: Locale): string {
  if (!amount) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`;
}

function FlowRow({ codes, counts, selected, onSelect, label, locale }: {
  codes: readonly string[];
  counts: Record<string, number>;
  selected: string;
  onSelect: (code: string) => void;
  label: string;
  locale: Locale;
}) {
  return (
    <ol className="flex flex-wrap gap-2 xl:flex-nowrap xl:gap-0" aria-label={label}>
      {codes.flatMap((code, idx) => [
        <li key={code} className="w-[calc((100%-0.5rem)/2)] min-w-0 sm:w-[calc((100%-1rem)/3)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-4rem)/3)]">
          <CommerceKpiCard
            className="w-full"
            label={bookingStatusLabel(code, locale)}
            value={counts[code] ?? 0}
            active={selected === code}
            onClick={() => onSelect(code)}
          />
        </li>,
        // decorative connector between adjacent happy-path cards (xl row only)
        ...(idx < codes.length - 1
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
  );
}

function BookingsContent({ initialUpcoming, initialOverdue, initialSlaMinutes, initialStatus, initialSearch, initialSortBy, initialSortDirection, initialDateFrom, initialDateTo, initialPage }: {
  initialUpcoming: boolean;
  initialOverdue: boolean;
  initialSlaMinutes?: string;
  initialStatus: string;
  initialSearch?: string;
  initialSortBy?: string;
  initialSortDirection?: SortDirection;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialPage?: number;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<Booking> | null>(null);
  // Detector scope comes from the URL only (deep-link; no UI toggle) and is
  // preserved verbatim in the request — KPI-card selection never removes it.
  const [upcoming] = useState(initialUpcoming);
  const [overdue] = useState(initialOverdue);
  const [slaMinutes] = useState(initialSlaMinutes);
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(initialPage || 1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ── URL-state writes (replaceState — ADR-OPS-012). Detector params that
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

  // KPI card click: this status becomes selected and filters the TABLE only;
  // the other 12 cards keep their overview counts (Requests contract).
  const applyStatus = useCallback((code: string) => {
    setStatusFilter(code);
    setPage(1);
    updateUrl({ status: code || undefined, page: undefined });
  }, [updateUrl]);

  const handleTotalClick = useCallback(() => {
    setStatusFilter("");
    setPage(1);
    updateUrl({ status: undefined, page: undefined });
  }, [updateUrl]);

  // UI-C1.2F.1B: Local date controls removed — period is Header-owned (GLOBAL scope).
  // dateFrom/dateTo state is read from URL and passed to API; Header manages them.

  const filtersActive = Boolean(statusFilter || search);
  // Reset clears registry-specific filters but PRESERVES Header Period.
  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setStatusFilter("");
    setPage(1);
    updateUrl({ search: undefined, status: undefined, page: undefined });
  }, [updateUrl]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter) qs.set("status", statusFilter);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (sortBy) { qs.set("sortBy", sortBy); qs.set("sortDirection", sortDirection ?? "desc"); }
      // Detector scope (upcoming/overdue) is sent verbatim as a global scope.
      if (upcoming) qs.set("upcoming", "true");
      if (overdue) qs.set("overdue", "true");
      if (slaMinutes) qs.set("slaMinutes", slaMinutes);
      qs.set("page", String(page));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Booking>>(`/bookings?${qs.toString()}`);
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
  }, [search, statusFilter, sortBy, sortDirection, page, dateFrom, dateTo]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // KPI data from server aggregates (OVERVIEW scope — stable across card clicks).
  const lifecycleCounts = (data?.aggregates?.lifecycle ?? {}) as Record<string, number>;
  const overviewTotal = (data?.aggregates?.lifecycle as Record<string, number> | undefined)?.total ?? data?.total ?? 0;
  const selectedStatus = statusFilter || "";
  // Detector-scoped table columns (upcoming/overdue arrive via deep link).
  const showServiceDate = upcoming || overdue;
  const showWaiting = overdue;

  return (
    <OperationsCenterShell activeDomain="bookings">
      <div className="space-y-4">
        {/* TOTAL KPI — canonical naming, ~15-20% larger, NOT full-width */}
        <div className="w-fit max-w-full">
          <CommerceKpiCard
            variant="total"
            label={t("admin.kpi.total_bookings", locale)}
            value={overviewTotal}
            active={!selectedStatus}
            onClick={handleTotalClick}
          />
        </div>

        {/* FLOW 1 — request/preparation phase (NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER) */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bookings.group.lifecycle", locale)}</div>
          <FlowRow
            codes={BOOKING_FLOW_PREP}
            counts={lifecycleCounts}
            selected={selectedStatus}
            onSelect={applyStatus}
            label={t("bookings.group.lifecycle", locale)}
            locale={locale}
          />
        </div>

        {/* FLOW 2 — service/fulfillment phase (CONFIRMED → IN_SERVICE → COMPLETED) */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bookings.group.lifecycle", locale)}</div>
          <FlowRow
            codes={BOOKING_FLOW_SERVICE}
            counts={lifecycleCounts}
            selected={selectedStatus}
            onSelect={applyStatus}
            label={t("bookings.group.lifecycle", locale)}
            locale={locale}
          />
        </div>

        {/* AWAITING — visible + filterable, NO false incoming arrow (no producer) */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bookings.group.awaiting", locale)}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {BOOKING_AWAITING.map((code) => (
              <CommerceKpiCard
                key={code}
                label={bookingStatusLabel(code, locale)}
                value={lifecycleCounts[code] ?? 0}
                active={selectedStatus === code}
                onClick={() => applyStatus(code)}
              />
            ))}
          </div>
        </div>

        {/* OPERATIONAL / DECISION — recoverable markers, no sequential path */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bookings.group.decisions", locale)}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BOOKING_OPERATIONAL.map((code) => (
              <CommerceKpiCard
                key={code}
                label={bookingStatusLabel(code, locale)}
                value={lifecycleCounts[code] ?? 0}
                active={selectedStatus === code}
                onClick={() => applyStatus(code)}
              />
            ))}
          </div>
        </div>

        {/* TERMINAL EXCEPTION OUTCOMES — no arrows */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bookings.group.terminal", locale)}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {BOOKING_TERMINAL.map((code) => (
              <CommerceKpiCard
                key={code}
                label={bookingStatusLabel(code, locale)}
                value={lifecycleCounts[code] ?? 0}
                active={selectedStatus === code}
                onClick={() => applyStatus(code)}
              />
            ))}
          </div>
        </div>

        {/* Toolbar: canonical order [Search][Status][From][To][Reset][CSV][XLSX].
            Period is exposed: /bookings filters createdAt [from,to) server-side
            and the overview aggregates share that same global scope. */}
        <OperationsToolbarSlot>
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("admin.search.placeholder_bookings", locale)}
            aria-label={t("admin.search.placeholder_bookings", locale)}
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => applyStatus(e.target.value)}
            aria-label={t("admin.filter.all_statuses", locale)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{t("admin.filter.all_statuses", locale)}</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{bookingStatusLabel(s, locale)}</option>
            ))}
          </select>
          {/* UI-C1.2F.1B: Local date controls removed — period is Header-owned. */}
          <button
            type="button"
            onClick={handleReset}
            disabled={!filtersActive}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("filters.reset", locale)}
          </button>
          {busy && <span className="text-xs text-slate-400">{t("common.loading_short", locale)}</span>}
          <TableExportButton
            exportUrl="/api/v1/bookings/export"
            extraParams={{
              ...(statusFilter ? { status: statusFilter } : {}),
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
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "14%" }} />
                {showServiceDate && <col style={{ width: "13%" }} />}
                {showWaiting && <col style={{ width: "12%" }} />}
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.code", locale)}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.date", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.code", locale)}</th>
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.amount", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.passengers", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  {showServiceDate && <SortableHeader field="serviceDate" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.service_date", locale)}</SortableHeader>}
                  {showWaiting && <th className="px-4 py-2.5 font-medium text-red-600">{t("admin.table.col.waiting", locale)}</th>}
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
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(b.createdAt, locale)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.orderReference ?? `${b.orderId.slice(0, 8)}…`}</td>
                    <td className="px-4 py-2.5 text-center font-medium text-slate-800">{fmtMoney(b.amount, b.currency, locale)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{b.passengers?.length ?? 0}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={b.status} label={bookingStatusLabel(b.status, locale)} /></td>
                    {showServiceDate && <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(b.serviceDate, locale)}</td>}
                    {showWaiting && (
                      <td className="px-4 py-2.5">
                        {(() => {
                          const created = new Date(b.createdAt).getTime();
                          const mins = Math.floor((Date.now() - created) / 60000);
                          const h = Math.floor(mins / 60);
                          const d = Math.floor(h / 24);
                          if (d > 0) return <span className="text-xs font-medium text-red-600">{d} дн. {h % 24} ч.</span>;
                          if (h > 0) return <span className="text-xs font-medium text-red-600">{h} ч. {mins % 60} мин</span>;
                          return <span className="text-xs text-slate-500">{mins} мин</span>;
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <OperationsEmptyState colSpan={6 + (showServiceDate ? 1 : 0) + (showWaiting ? 1 : 0)} message={t("bookings.empty", locale)} />
                )}
              </tbody>
            </table>
          )}
          {data && data.total > 0 && (
            <Pagination
              page={page}
              pageSize={20}
              total={data.total}
              onPageChange={(p) => { setPage(p); updateUrl({ page: p > 1 ? String(p) : undefined }); }}
            />
          )}
        </OperationsRegistrySlot>
      </div>
    </OperationsCenterShell>
  );
}

function BookingsWithParams() {
  const sp = useSearchParams();
  const rawPage = parseInt(sp.get("page") ?? "", 10);
  return (
    <BookingsContent
      initialUpcoming={sp.get("upcomingOnly") === "true" || sp.get("upcoming") === "true"}
      initialOverdue={sp.get("overdueOnly") === "true" || sp.get("overdue") === "true"}
      initialSlaMinutes={sp.get("slaMinutes") ?? undefined}
      initialStatus={sp.get("status") ?? ""}
      initialSearch={sp.get("search") ?? ""}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialDateFrom={sp.get("dateFrom") ?? ""}
      initialDateTo={sp.get("dateTo") ?? ""}
      initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}
    />
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <BookingsWithParams />
    </Suspense>
  );
}
