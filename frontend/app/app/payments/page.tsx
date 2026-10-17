"use client";

/**
 * UI-C1.2F вЂ” Canonical Payments Operations Center tab (/app/payments).
 *
 * Vertical composition (ADR-OPS-014 / UI-C1.2F contract):
 *   OPERATIONS CENTER SHELL (breadcrumbs, tabs, period context)
 *   в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
 *   TOTAL                                  вЂ” ~15вЂ“20% larger, NOT full-width
 *   РЎРўРђРўРЈРЎР« РџР›РђРўР•Р–Р•Р™                       вЂ” 6/6 canonical PaymentStatus cards
 *   Р’РђР›Р®РўР«                                 вЂ” dynamic currency cards (server-authoritative)
 *   РЎРўРђРўРЈРЎР« Р’РћР—Р’Р РђРўРћР’                      вЂ” 4/4 canonical RefundStatus cards
 *   в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
 *   TOOLBAR: [Search][Reset][CSV][XLSX]
 *   TABLE
 *   PAGINATION
 *
 * KPI interaction model (В§9 / В§57):
 *   - One active card at a time (PaymentStatus XOR RefundStatus XOR currencyCard)
 *   - Clicked card filters TABLE ONLY вЂ” all other cards remain static overview values
 *   - Total resets card-level filter
 *   - URL state survives reload / Back / Forward
 *
 * UI-C1.2F.1F вЂ” table-header filtering:
 *   - Payment Status column header filter в†” paymentStatus (KPI same state)
 *   - Currency column header filter в†” currencyCard (KPI same state)
 *   - Refund Status: NO refund column exists in the actual table (row DTO has no
 *     refundStatus field) в†’ per audit-first rule NO invented header filter;
 *     refundStatus remains a full KPI-card + URL + server-query dimension.
 *   - Multi-dimension deep links (?paymentStatus+refundStatus / +currencyCard) are
 *     canonicalized deterministically (paymentStatus > refundStatus > currencyCard)
 *     with PURE render-time derivation + post-render router.replace вЂ” never a
 *     render-phase router/history mutation (same contract as UI-C1.2F.1D-R2).
 *
 * Backend contract (UI-C1.2E):
 *   GET /finance/payments в†’ { items, total, page, pageSize, hasMore, aggregates }
 *   aggregates = { total, paymentStatus{6}, refundStatus{4}, currency[{currency,count,amount}] }
 *
 * Currency-card compatibility (В§10):
 *   - `currency` = global/base scope (affects overview + table)
 *   - `currencyCard` = table-only active-card scope (overview unaffected)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { OperationsPageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import Pagination from "@/components/Pagination";
import { type SortDirection } from "@/components/SortableHeader";
import TableHeaderFilter, { type FilterOption } from "@/components/TableHeaderFilter";
import TableExportButton from "@/components/TableExportButton";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
} from "@/components/OperationsCenterShell";
import { useLocale, t, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import CreatePaymentForm from "@/components/finance/CreatePaymentForm";
import PaymentsTable from "@/components/finance/PaymentsTable";

// в”Ђв”Ђ Canonical enum arrays (source: backend payments-registry.ts) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUNDED"] as const;
const REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "FAILED"] as const;

// в”Ђв”Ђ Locale helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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

/** Build PaymentStatus filter options for TableHeaderFilter from the canonical 6-value array. */
function buildPaymentFilterOptions(locale: Locale): FilterOption[] {
  return PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentStatusLabel(s, locale) }));
}

/** Currency filter options вЂ” server-authoritative dynamic currency list (aggregates overview). */
function currencyFilterOptions(agg?: PaymentAggregates): FilterOption[] {
  return (agg?.currency ?? []).map((c) => ({ value: c.currency, label: c.currency }));
}

function fmtMoney(amount: string | number | null | undefined, currency: string | null | undefined, locale: Locale): string {
  if (amount == null) return "вЂ”";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return String(amount);
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

// в”Ђв”Ђ Payment row DTO (matches backend paymentDto enrichment) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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
  // MULTI/PARTIAL В§7 enrichment (paymentDto list)
  orderAmount: string | null;
  ordinal: number | null;
  remainingAfter: string | null;
  acceptedBy: string | null;
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

// в”Ђв”Ђ Main content component в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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

  // в”Ђв”Ђ Create payment (prompt В§1: + РЎРѕР·РґР°С‚СЊ РїР»Р°С‚РµР¶, RBAC finance.payment.create) в”Ђ
  const canCreatePayment = useCan("finance.payment.create");
  const [createOpen, setCreateOpen] = useState(false);

  // в”Ђв”Ђ State в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

  // UI-C1.2F.1B-R1: Sync dateFrom/dateTo when Header Period changes the URL.
  useEffect(() => {
    setDateFrom(initialDateFrom || "");
    setDateTo(initialDateTo || "");
  }, [initialDateFrom, initialDateTo]);

  // Sort
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);

  // в”Ђв”Ђ URL state (ADR-OPS-012) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const updateUrl = useCallback((params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  // в”Ђв”Ђ Live search with debounce (~350ms) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

  // в”Ђв”Ђ KPI card click handlers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

  // UI-C1.2F.1B: Local date controls removed вЂ” period is Header-owned (GLOBAL scope).
  // dateFrom/dateTo state is read from URL and passed to API; Header manages them.

  // Reset clears registry-specific filters but PRESERVES Header Period.
  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setPaymentStatusFilter("");
    setRefundStatusFilter("");
    setCurrencyCardFilter("");
    setPage(1);
    updateUrl({
      search: undefined, paymentStatus: undefined, refundStatus: undefined,
      currencyCard: undefined, page: undefined,
    });
  }, [updateUrl]);

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
    updateUrl({ sortBy: field, sortDirection: direction, page: undefined });
  };

  // в”Ђв”Ђ Data loading в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

  // Prompt В§3: РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ СЃРѕР·РґР°РЅРёСЏ вЂ” РѕР±РЅРѕРІРёС‚СЊ registry. load() С‡РёС‚Р°РµС‚
  // С‚РµРєСѓС‰РµРµ state (filters/search/sort/pagination) вЂ” РѕРЅРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ.
  const handlePaymentCreated = useCallback(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // в”Ђв”Ђ Derived state в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
          {/* в”Ђв”Ђ TOTAL KPI в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
          <div className="w-fit max-w-full">
            <CommerceKpiCard
              variant="total"
              label={t("payments.kpi.total", locale)}
              value={overviewTotal}
              active={!hasCardFilter}
              helpId="payments.kpi.total"
              onClick={handleTotalClick}
            />
          </div>

          {/* в”Ђв”Ђ PAYMENT STATUS GROUP (6/6) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
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
                  helpId={`payments.status.${code.toLowerCase()}`}
                  onClick={() => applyPaymentStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* в”Ђв”Ђ CURRENCY GROUP (dynamic) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
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

          {/* в”Ђв”Ђ REFUND STATUS GROUP (4/4) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
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
                  helpId={`payments.refund.status.${code.toLowerCase()}`}
                  onClick={() => applyRefundStatus(code)}
                />
              ))}
            </div>
          </div>

          {/* в”Ђв”Ђ TOOLBAR в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
          <OperationsToolbarSlot>
            {canCreatePayment && (
              <button
                type="button"
                data-testid="payments-create-button"
                onClick={() => setCreateOpen(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t("payments.create.button", locale)}
              </button>
            )}
            <input
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("payments.search.placeholder", locale)}
              aria-label={t("payments.search.placeholder", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {/* UI-C1.2F.1B: Local date controls removed вЂ” period is Header-owned. */}
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

          {/* в”Ђв”Ђ TABLE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
          <OperationsRegistrySlot>
            {!data && busy ? (
              <OperationsLoadingState />
            ) : (
              <PaymentsTable
                rows={(data?.items ?? []).map((p) => ({
                  id: p.id,
                  ordinal: p.ordinal,
                  code: p.code,
                  referenceNumber: p.referenceNumber,
                  createdAt: p.createdAt,
                  amount: p.amount,
                  currency: p.currency,
                  paymentMethod: p.paymentMethod,
                  status: p.status,
                  acceptedBy: p.acceptedBy,
                  remainingAfter: p.remainingAfter,
                  paymentHref: `/app/payments/${p.code}`,
                  orderHref: p.orderId ? `/app/orders/${p.orderId}` : null,
                  orderLabel: p.orderReference ?? (p.orderId ? `${p.orderId.slice(0, 8)}вЂ¦` : null),
                }))}
                locale={locale}
                emptyMessage={t("payments.table.empty", locale)}
                sortState={sortState}
                onSort={handleSort}
                amountHeaderExtra={
                  <TableHeaderFilter
                    id="payments-filter-currency"
                    label=""
                    options={currencyFilterOptions(agg)}
                    value={currencyCardFilter || ""}
                    onChange={applyCurrencyCard}
                    ariaLabel={t("finance.filter.all_currencies", locale)}
                  />
                }
                statusHeaderExtra={
                  <TableHeaderFilter
                    id="payments-filter-status"
                    label=""
                    options={buildPaymentFilterOptions(locale)}
                    value={paymentStatusFilter || ""}
                    onChange={applyPaymentStatus}
                    ariaLabel={t("finance.filter.all_statuses", locale)}
                  />
                }
                onActionCompleted={handlePaymentCreated}
              />
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

      {/* + РЎРѕР·РґР°С‚СЊ РїР»Р°С‚РµР¶ вЂ” modal (prompt В§1/В§2) */}
      <CreatePaymentForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handlePaymentCreated}
      />
    </OperationsCenterShell>
  );
}

// в”Ђв”Ђ Wrapper with URL params в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function PaymentsWithParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const rawPage = parseInt(sp.get("page") ?? "", 10);

  // UI-C1.2F.1F вЂ” deterministic canonicalization of multi-dimension deep links.
  // The Payments KPI contract permits at most ONE active table-only dimension
  // (paymentStatus XOR refundStatus XOR currencyCard). Render phase is PURE:
  // when 2+ dimensions arrive together the UI immediately renders from the
  // canonical values with deterministic precedence paymentStatus > refundStatus
  // > currencyCard (mirrors the KPI group order) вЂ” no setState/router/history
  // mutation during render. The URL is normalized ONCE post-render via
  // router.replace (same contract as UI-C1.2F.1D-R2).
  const rawPaymentStatus = sp.get("paymentStatus") ?? "";
  const rawRefundStatus = sp.get("refundStatus") ?? "";
  const rawCurrencyCard = sp.get("currencyCard") ?? "";
  const multiDimensionConflict =
    (rawPaymentStatus ? 1 : 0) + (rawRefundStatus ? 1 : 0) + (rawCurrencyCard ? 1 : 0) > 1;

  const initialPaymentStatus = rawPaymentStatus;
  const initialRefundStatus = multiDimensionConflict
    ? (rawPaymentStatus ? "" : rawRefundStatus)
    : rawRefundStatus;
  const initialCurrencyCard = multiDimensionConflict
    ? (rawPaymentStatus || rawRefundStatus ? "" : rawCurrencyCard)
    : rawCurrencyCard;

  // Post-render: normalize the URL once via the Next router so the browser URL,
  // Next Router state, useSearchParams(), and Back/Forward stay synchronized.
  useEffect(() => {
    if (!multiDimensionConflict) return;

    // Preserve ALL unrelated query params; clear only the losing KPI dims + page.
    const params = new URLSearchParams(sp.toString());
    params.delete("paymentStatus");
    params.delete("refundStatus");
    params.delete("currencyCard");
    params.delete("page");
    if (rawPaymentStatus) params.set("paymentStatus", rawPaymentStatus);
    else if (rawRefundStatus) params.set("refundStatus", rawRefundStatus);
    else if (rawCurrencyCard) params.set("currencyCard", rawCurrencyCard);
    const qs = params.toString();
    router.replace(qs ? `/app/payments?${qs}` : "/app/payments", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiDimensionConflict]);

  return (
    <PaymentsContent
      initialSearch={sp.get("search") ?? ""}
      initialPaymentStatus={initialPaymentStatus}
      initialRefundStatus={initialRefundStatus}
      initialCurrencyCard={initialCurrencyCard}
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
    <Suspense fallback={<OperationsPageSkeleton />}>
      <PaymentsWithParams />
    </Suspense>
  );
}
