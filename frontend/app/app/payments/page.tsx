"use client";

/**
 * UI-C1.2F — Canonical Payments Operations Center tab (/app/payments).
 *
 * Vertical composition (ADR-OPS-014 / UI-C1.2F contract):
 *   OPERATIONS CENTER SHELL (breadcrumbs, tabs, period context)
 *   ─────────────────────────────────────────────────────────────
 *   TOTAL                                  — ~15–20% larger, NOT full-width
 *   СТАТУСЫ ПЛАТЕЖЕЙ                       — 6/6 canonical PaymentStatus cards
 *   ВАЛЮТЫ                                 — dynamic currency cards (server-authoritative)
 *   СТАТУСЫ ВОЗВРАТОВ                      — 4/4 canonical RefundStatus cards
 *   ─────────────────────────────────────────────────────────────
 *   TOOLBAR: [Search][Date From][To][Reset][CSV][XLSX]
 *   TABLE
 *   PAGINATION
 *
 * KPI interaction model (§9 / §57):
 *   - One active card at a time (PaymentStatus XOR RefundStatus XOR currencyCard)
 *   - Clicked card filters TABLE ONLY — all other cards remain static overview values
 *   - Total resets card-level filter
 *   - URL state survives reload / Back / Forward
 *
 * Backend contract (UI-C1.2E):
 *   GET /finance/payments → { items, total, page, pageSize, hasMore, aggregates }
 *   aggregates = { total, paymentStatus{6}, refundStatus{4}, currency[{currency,count,amount}] }
 *
 * Currency-card compatibility (§10):
 *   - `currency` = global/base scope (affects overview + table)
 *   - `currencyCard` = table-only active-card scope (overview unaffected)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
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

// ── Canonical enum arrays (source: backend payments-registry.ts) ────────────

const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUNDED"] as const;
const REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "FAILED"] as const;

// ── Locale helpers ──────────────────────────────────────────────────────────

function paymentStatusLabel(code: string, locale: Locale): string {
  const key = `status.entity.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function refundStatusLabel(code: string, locale: Locale): string {
  const key = `status.entity.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale]);
}

function fmtMoney(amount: string | number | null | undefined, currency: string | null | undefined, locale: Locale): string {
  if (amount == null) return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return String(amount);
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

// ── Payment row DTO (matches backend paymentDto enrichment) ─────────────────

interface PaymentRow {
  id: string;
  code: string;
  referenceNumber: string | null;
  orderId: string;
  customerId: string | null;
  partnerId: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  providerRef: string | null;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  orderReference: string | null;
}

interface PaymentAggregates {
  total: number;
  paymentStatus: Record<string, number>;
  refundStatus: Record<string, number>;
  currency: { currency: string; count: number; amount: string }[];
}

interface PaymentListResponse {
  items: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  aggregates: PaymentAggregates;
}

// ── Main content component ──────────────────────────────────────────────────

function PaymentsContent({
  initialSearch,
  initialPaymentStatus,
  initialRefundStatus,
  initialCurrencyCard,
  initialDateFrom,
  initialDateTo,
  initialSortBy,
  initialSortDirection,
  initialPage,
}: {
  initialSearch?: string;
  initialPaymentStatus?: string;
  initialRefundStatus?: string;
  initialCurrencyCard?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialSortBy?: string;
  initialSortDirection?: SortDirection;
  initialPage?: number;
}) {
  const locale = useLocale();

  // ── State ───────────────────────────────────────────────────────────────
  const [data, setData] = useState<PaymentListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Search (live debounce)
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination
  const [page, setPage] = useState(initialPage || 1);

  // Active KPI card filters (one dimension at a time)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(initialPaymentStatus || "");
  const [refundStatusFilter, setRefundStatusFilter] = useState(initialRefundStatus || "");
  const [currencyCardFilter, setCurrencyCardFilter] = useState(initialCurrencyCard || "");

  // Global scope filters (may re-scope overview)
  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");

  // Sort
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);

  // ── URL state (ADR-OPS-012) ─────────────────────────────────────────────
  const updateUrl = useCallback((params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  // ── Live search with debounce (~350ms) ──────────────────────────────────
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

  // ── KPI card click handlers ─────────────────────────────────────────────
  const applyPaymentStatus = useCallback((code: string) => {
    setPaymentStatusFilter(code);
    setRefundStatusFilter("");
    setCurrencyCardFilter("");
    setPage(1);
    updateUrl({
      paymentStatus: code || undefined,
      refundStatus: undefined,
      currencyCard: undefined,
      page: undefined,
    });
  }, [updateUrl]);

  const applyRefundStatus = useCallback((code: string) => {
    setRefundStatusFilter(code);
    setPaymentStatusFilter("");
    setCurrencyCardFilter("");
    setPage(1);
    updateUrl({
      refundStatus: code || undefined,
      paymentStatus: undefined,
      currencyCard: undefined,
      page: undefined,
    });
  }, [updateUrl]);

  const applyCurrencyCard = useCallback((code: string) => {
    setCurrencyCardFilter(code);
    setPaymentStatusFilter("");
    setRefundStatusFilter("");
    setPage(1);
    updateUrl({
      currencyCard: code || undefined,
      paymentStatus: undefined,
      refundStatus: undefined,
      page: undefined,
    });
  }, [updateUrl]);

  const handleTotalClick = useCallback(() => {
    setPaymentStatusFilter("");
    setRefundStatusFilter("");
    setCurrencyCardFilter("");
    setPage(1);
    updateUrl({
      paymentStatus: undefined,
      refundStatus: undefined,
      currencyCard: undefined,
      page: undefined,
    });
  }, [updateUrl]);

  // ── Global scope handlers ───────────────────────────────────────────────
  const applyDateFrom = (value: string) => {
    setDateFrom(value);
    setPage(1);
    updateUrl({ dateFrom: value || undefined, page: undefined });
  };
  const applyDateTo = (value: string) => {
    setDateTo(value);
    setPage(1);
    updateUrl({ dateTo: value || undefined, page: undefined });
  };

  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setPaymentStatusFilter("");
    setRefundStatusFilter("");
    setCurrencyCardFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    updateUrl({
      search: undefined, paymentStatus: undefined, refundStatus: undefined,
      currencyCard: undefined, dateFrom: undefined, dateTo: undefined, page: undefined,
    });
  }, [updateUrl]);

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
    updateUrl({ sortBy: field, sortDirection: direction, page: undefined });
  };

  // ── Data loading ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (paymentStatusFilter) qs.set("paymentStatus", paymentStatusFilter);
      if (refundStatusFilter) qs.set("refundStatus", refundStatusFilter);
      if (currencyCardFilter) qs.set("currencyCard", currencyCardFilter);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (sortBy) qs.set("sortBy", sortBy);
      if (sortDirection) qs.set("sortDirection", sortDirection);
      qs.set("page", String(page));
      qs.set("pageSize", "20");

      const res = await api.get<PaymentListResponse>(`/finance/payments?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [search, paymentStatusFilter, refundStatusFilter, currencyCardFilter, dateFrom, dateTo, sortBy, sortDirection, page]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  const agg = data?.aggregates;
  const overviewTotal = agg?.total ?? data?.total ?? 0;
  const total = data?.total ?? 0;

  const hasCardFilter = Boolean(paymentStatusFilter || refundStatusFilter || currencyCardFilter);
  const filtersActive = hasCardFilter || search || dateFrom || dateTo;

  // Sort state for SortableHeader
  const sortState = sortBy ? { sortBy, sortDirection: sortDirection ?? ("desc" as SortDirection) } : null;

  return (
    <OperationsCenterShell activeDomain="payments">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {/* ── TOTAL KPI ─────────────────────────────────────────────── */}
          <div className="w-fit max-w-full">
            <CommerceKpiCard
              variant="total"
              label={t("payments.kpi.total", locale)}
              value={overviewTotal}
              active={!hasCardFilter}
              onClick={handleTotalClick}
            />
          </div>

          {/* ── PAYMENT STATUS GROUP (6/6) ───────────────────────────── */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("payments.group.payment_statuses", locale)}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PAYMENT_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={paymentStatusLabel(code, locale)}
                  value={agg?.paymentStatus?.[code] ?? 0}
                  active={paymentStatusFilter === code}
                  onClick={() => applyPaymentStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* ── CURRENCY GROUP (dynamic) ─────────────────────────────── */}
          {agg?.currency && agg.currency.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("payments.group.currencies", locale)}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {agg.currency.map((c) => (
                  <CommerceKpiCard
                    key={c.currency}
                    label={`${c.currency}`}
                    value={`${c.count} · ${fmtMoney(c.amount, c.currency, locale)}`}
                    active={currencyCardFilter === c.currency}
                    onClick={() => applyCurrencyCard(c.currency)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── REFUND STATUS GROUP (4/4) ────────────────────────────── */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("payments.group.refund_statuses", locale)}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REFUND_STATUSES.map((code) => (
                <CommerceKpiCard
                  key={code}
                  label={refundStatusLabel(code, locale)}
                  value={agg?.refundStatus?.[code] ?? 0}
                  active={refundStatusFilter === code}
                  onClick={() => applyRefundStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* ── TOOLBAR ────────────────────────────────────────────────── */}
          <OperationsToolbarSlot>
            <input
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("payments.search.placeholder", locale)}
              aria-label={t("payments.search.placeholder", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">{t("common.date_from", locale)}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => applyDateFrom(e.target.value)}
                aria-label={t("common.date_from", locale)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
              />
              <span className="text-xs text-slate-400">{t("common.date_to", locale)}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => applyDateTo(e.target.value)}
                aria-label={t("common.date_to", locale)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
              />
            </div>
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
              exportUrl="/api/v1/finance/payments/export"
              extraParams={{
                ...(paymentStatusFilter ? { paymentStatus: paymentStatusFilter } : {}),
                ...(refundStatusFilter ? { refundStatus: refundStatusFilter } : {}),
                ...(currencyCardFilter ? { currencyCard: currencyCardFilter } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
                ...(search ? { search } : {}),
              }}
            />
          </OperationsToolbarSlot>

          {error && <OperationsErrorState message={error} onRetry={() => void load()} />}

          {/* ── TABLE ─────────────────────────────────────────────────── */}
          <OperationsRegistrySlot>
            {!data && busy ? (
              <OperationsLoadingState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "9%" }} />
                  </colgroup>
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>
                        {t("payments.col.code", locale)}
                      </SortableHeader>
                      <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>
                        {t("payments.col.created", locale)}
                      </SortableHeader>
                      <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>
                        {t("payments.col.amount", locale)}
                      </SortableHeader>
                      <th className="px-4 py-2.5 font-medium">{t("payments.col.currency", locale)}</th>
                      <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>
                        {t("payments.col.status", locale)}
                      </SortableHeader>
                      <th className="px-4 py-2.5 font-medium">{t("payments.col.method", locale)}</th>
                      <th className="px-4 py-2.5 font-medium">{t("payments.col.order", locale)}</th>
                      <SortableHeader field="paidAt" currentSort={sortState} onSort={handleSort}>
                        {t("payments.col.paid_at", locale)}
                      </SortableHeader>
                      <th className="px-4 py-2.5 font-medium">{t("payments.col.provider_ref", locale)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.items ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/30">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/app/finance/payments/${p.code}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            {p.referenceNumber ?? p.code}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(p.createdAt, locale)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtMoney(p.amount, p.currency, locale)}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{p.currency}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={p.status} label={paymentStatusLabel(p.status, locale)} /></td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{p.paymentMethod ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {p.orderId ? (
                            <Link href={`/app/orders/${p.orderId}`} className="font-mono text-xs text-blue-600 hover:underline">
                              {p.orderReference ?? `${p.orderId.slice(0, 8)}…`}
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(p.paidAt, locale)}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-400 truncate" title={p.providerRef ?? ""}>
                          {p.providerRef ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {(data?.items ?? []).length === 0 && (
                      <OperationsEmptyState colSpan={9} message={t("payments.table.empty", locale)} />
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {data && total > 0 && (
              <Pagination
                page={page}
                pageSize={20}
                total={total}
                onPageChange={(p) => {
                  setPage(p);
                  updateUrl({ page: p > 1 ? String(p) : undefined });
                }}
              />
            )}
          </OperationsRegistrySlot>
        </div>
      </div>
    </OperationsCenterShell>
  );
}

// ── Wrapper with URL params ─────────────────────────────────────────────────

function PaymentsWithParams() {
  const sp = useSearchParams();
  const rawPage = parseInt(sp.get("page") ?? "", 10);
  return (
    <PaymentsContent
      initialSearch={sp.get("search") ?? ""}
      initialPaymentStatus={sp.get("paymentStatus") ?? ""}
      initialRefundStatus={sp.get("refundStatus") ?? ""}
      initialCurrencyCard={sp.get("currencyCard") ?? ""}
      initialDateFrom={sp.get("dateFrom") ?? ""}
      initialDateTo={sp.get("dateTo") ?? ""}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialPage={Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1}
    />
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <PaymentsWithParams />
    </Suspense>
  );
}
