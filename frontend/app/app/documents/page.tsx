"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  documentsApi,
  type DocumentListItem,
  type DocumentType,
  type DocumentStatus,
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
} from "@/lib/documents-api";
import { type Page } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";
import Pagination from "@/components/Pagination";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableHeaderFilter, { type FilterOption } from "@/components/TableHeaderFilter";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";
import { useLocale, t, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { fmtDate } from "@/lib/temporal-display";

function documentTypeLabel(code: string, locale: Locale): string {
  const key = `documents.type.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function documentStatusLabel(code: string, locale: Locale): string {
  const key = `documents.status.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTypeFilterOptions(locale: Locale): FilterOption[] {
  return DOCUMENT_TYPES.map((s) => ({ value: s, label: documentTypeLabel(s, locale) }));
}

function buildStatusFilterOptions(locale: Locale): FilterOption[] {
  return DOCUMENT_STATUSES.map((s) => ({ value: s, label: documentStatusLabel(s, locale) }));
}

function fmtMoney(amount: string | null, currency: string | null | undefined, locale: Locale): string {
  if (!amount) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`;
}

function DocumentsContent({
  initialType,
  initialStatus,
  initialSearch,
  initialSortBy,
  initialSortDirection,
  initialPage,
}: {
  initialType: string;
  initialStatus: string;
  initialSearch?: string;
  initialSortBy?: string;
  initialSortDirection?: SortDirection;
  initialPage?: number;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<DocumentListItem> | null>(null);
  const [searchDraft, setSearchDraft] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(initialPage || 1);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const updateUrl = useCallback((params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

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

  const applyType = useCallback((code: string) => {
    setTypeFilter(code);
    setPage(1);
    updateUrl({ type: code || undefined, page: undefined });
  }, [updateUrl]);

  const applyStatus = useCallback((code: string) => {
    setStatusFilter(code);
    setPage(1);
    updateUrl({ status: code || undefined, page: undefined });
  }, [updateUrl]);

  const handleTotalClick = useCallback(() => {
    setTypeFilter("");
    setStatusFilter("");
    setPage(1);
    updateUrl({ type: undefined, status: undefined, page: undefined });
  }, [updateUrl]);

  const filtersActive = Boolean(typeFilter || statusFilter || search || sortBy);

  const handleReset = useCallback(() => {
    setSearchDraft("");
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setSortBy(undefined);
    setSortDirection(undefined);
    setPage(1);
    updateUrl({ search: undefined, type: undefined, status: undefined, sortBy: undefined, sortDirection: undefined, page: undefined });
  }, [updateUrl]);

  const load = async () => {
    setBusy(true);
    try {
      const res = await documentsApi.list({
        page,
        pageSize: 20,
        type: typeFilter ? (typeFilter as DocumentType) : undefined,
        status: statusFilter ? (statusFilter as DocumentStatus) : undefined,
      });
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
  }, [search, typeFilter, statusFilter, sortBy, sortDirection, page]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Client-side search filter (code / bookingCode)
  const filteredItems = (data?.items ?? []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.code.toLowerCase().includes(q) ||
      (item.bookingCode ?? "").toLowerCase().includes(q)
    );
  });

  // Client-side sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortBy || !sortDirection) return 0;
    const av = a[keyOf(sortBy)] ?? "";
    const bv = b[keyOf(sortBy)] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const total = data?.total ?? 0;
  const typeCounts = (data?.aggregates?.type ?? {}) as Record<string, number>;

  return (
    <OperationsCenterShell activeDomain="documents">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {/* KPI */}
          <div className="flex flex-wrap gap-2">
            <div className="w-fit">
              <CommerceKpiCard
                variant="total"
                label={t("documents.kpi.total", locale)}
                value={total}
                active={!typeFilter}
                onClick={handleTotalClick}
              />
            </div>
            {DOCUMENT_TYPES.map((dt) => (
              <div key={dt} className="w-fit">
                <CommerceKpiCard
                  label={documentTypeLabel(dt, locale)}
                  value={typeCounts[dt] ?? 0}
                  active={typeFilter === dt}
                  onClick={() => applyType(typeFilter === dt ? "" : dt)}
                />
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <OperationsToolbarSlot>
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t("documents.search.placeholder", locale)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <TableHeaderFilter
                id="doc-type"
                label={t("documents.table.type", locale)}
                options={buildTypeFilterOptions(locale)}
                value={typeFilter}
                onChange={applyType}
              />
              <TableHeaderFilter
                id="doc-status"
                label={t("documents.table.status", locale)}
                options={buildStatusFilterOptions(locale)}
                value={statusFilter}
                onChange={applyStatus}
              />
              {filtersActive && (
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {t("filters.reset", locale)}
                </button>
              )}
            </div>
          </OperationsToolbarSlot>

          {/* Table */}
          {error && <OperationsErrorState message={error} onRetry={load} />}

          <OperationsRegistrySlot>
            {busy && !data ? (
              <OperationsLoadingState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">
                        <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.code", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2">
                        <SortableHeader field="type" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.type", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2">
                        <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.status", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2">{t("documents.table.booking", locale)}</th>
                      <th className="px-3 py-2">
                        <SortableHeader field="serviceDate" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.service_date", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortableHeader field="totalAmount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort} alignRight>{t("documents.table.amount", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortableHeader field="paidAmount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort} alignRight>{t("documents.table.paid", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2 text-center">
                        <SortableHeader field="version" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.version", locale)}</SortableHeader>
                      </th>
                      <th className="px-3 py-2">
                        <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? "asc" } : null} onSort={handleSort}>{t("documents.table.created", locale)}</SortableHeader>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <Link href={`/app/documents/${doc.id}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                            {doc.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{documentTypeLabel(doc.type, locale)}</td>
                        <td className="px-3 py-2"><StatusBadge status={doc.status} /></td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{doc.bookingCode ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{doc.serviceDate ? fmtDate(doc.serviceDate, locale) : "—"}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-700">{fmtMoney(doc.totalAmount, doc.currency, locale)}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-700">{fmtMoney(doc.paidAmount, doc.currency, locale)}</td>
                        <td className="px-3 py-2 text-center text-xs text-slate-500">v{doc.version}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(doc.createdAt, locale)}</td>
                      </tr>
                    ))}
                    {sortedItems.length === 0 && (
                      <OperationsEmptyState colSpan={9} message={filtersActive ? t("documents.empty_filtered", locale) : t("documents.empty", locale)} />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </OperationsRegistrySlot>

          {data && (
            <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
          )}
        </div>
      </div>
    </OperationsCenterShell>
  );
}

function keyOf(field: string): keyof DocumentListItem {
  const map: Record<string, keyof DocumentListItem> = {
    code: "code",
    type: "type",
    status: "status",
    serviceDate: "serviceDate",
    totalAmount: "totalAmount",
    paidAmount: "paidAmount",
    version: "version",
    createdAt: "createdAt",
  };
  return map[field] ?? "createdAt";
}

function DocumentsWithParams() {
  const sp = useSearchParams();

  return (
    <DocumentsContent
      initialType={sp.get("type") ?? ""}
      initialStatus={sp.get("status") ?? ""}
      initialSearch={sp.get("search") ?? ""}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialPage={Number(sp.get("page")) || 1}
    />
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <DocumentsWithParams />
    </Suspense>
  );
}
