"use client";

/**
 * UI-C1.2A — canonical Payments Operations Center tab (/app/payments).
 *
 * Renders the Operations Center shell with «Платежи» active and mounts the
 * existing read-only Payments registry content (Finance-owned operational
 * journal; D7 authority untouched — no money computed client-side beyond the
 * pre-existing page-level summary that UI-C1.2E replaces with server
 * aggregates). The historical /app/finance/payments route redirects here,
 * preserving its query params (analytics drill-down compatibility).
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Page } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import AggregateSummary from "@/components/AggregateSummary";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import TableExportButton from "@/components/TableExportButton";
import OperationsCenterShell, {
  OperationsToolbarSlot,
  OperationsRegistrySlot,
  OperationsErrorState,
  OperationsLoadingState,
  OperationsEmptyState,
} from "@/components/OperationsCenterShell";
import { useLocale, t, formatPrice } from "@/lib/i18n";

interface Payment {
  id: string;
  code: string;
  referenceNumber: string;
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
}

/** Every actual PaymentStatus enum value (ADR-OPS-015 journal completeness). */
const PAYMENT_STATUSES = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "REFUNDED"] as const;

function PaymentsContent({
  initialCurrency,
  initialDateFrom,
  initialDateTo,
  initialStatus,
  initialSortBy,
  initialSortDirection,
  initialDateField,
  fromAnalytics,
}: {
  initialCurrency?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialStatus?: string;
  initialSortBy?: string;
  initialSortDirection?: SortDirection;
  initialDateField?: string;
  fromAnalytics?: boolean;
}) {
  const locale = useLocale();
  const [data, setData] = useState<Page<Payment> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState(initialCurrency ?? "");
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialDateTo ?? "");
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "");
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const dateField = initialDateField;

  const updateUrl = (params: Record<string, string>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    window.history.replaceState(null, "", `?${sp.toString()}`);
  };

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
    updateUrl({ sortBy: field, sortDirection: direction });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (currency) qs.set("currency", currency);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (statusFilter) qs.set("status", statusFilter);
      if (dateField) qs.set("dateField", dateField);

      if (sortBy) qs.set("sortBy", sortBy);
      if (sortDirection) qs.set("sortDirection", sortDirection);
      qs.set("page", String(page));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Payment>>(`/finance/payments?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currency, dateFrom, dateTo, statusFilter, sortBy, sortDirection, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (v: string, cur?: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    if (cur) return formatPrice(n, cur, locale) ?? v;
    return n.toLocaleString(
      locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );
  };

  // Compute aggregates over full filtered population (server-side total)
  const totalAmount = data?.items?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) ?? 0;
  const totalRecords = data?.total ?? 0;

  const sortState = sortBy ? { sortBy, sortDirection: sortDirection ?? ("desc" as SortDirection) } : null;

  return (
    <OperationsCenterShell
      activeDomain="payments"
      headerActions={
        fromAnalytics ? (
          <Link
            href="/app/analytics"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ← {t("analytics.title", locale)}
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Period/Currency/Status context badges */}
        {(dateFrom || currency || statusFilter) && (
          <div className="flex items-center gap-3">
            {dateFrom && dateTo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-600">
                📊 {dateFrom} → {dateTo}
              </span>
            )}
            {currency && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                {currency}
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
                <StatusBadge status={statusFilter} />
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <OperationsToolbarSlot>
          <select
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">{t("finance.filter.all_currencies", locale) || "Все валюты"}</option>
            <option value="AZN">AZN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">{t("finance.filter.all_statuses", locale) || "Все статусы"}</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.entity.${s}`, locale)}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">{t("common.from", locale)}</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            <span className="text-xs text-slate-400">{t("common.to", locale)}</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
          </div>
          {statusFilter && (
            <button onClick={() => { setStatusFilter(""); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              ✕ {t("finance.filter.clear_status", locale) || "Статус"}
            </button>
          )}
          {loading && <span className="text-xs text-slate-400">{t("common.loading", locale)}</span>}
          <TableExportButton
            exportUrl="/api/v1/finance/payments/export"
            extraParams={{
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(dateFrom ? { dateFrom } : {}),
              ...(dateTo ? { dateTo } : {}),
              ...(currency ? { currency } : {}),
            }}
          />
        </OperationsToolbarSlot>

        {error && <OperationsErrorState message={error} onRetry={() => void load()} />}

        {/* Aggregate Summary */}
        <AggregateSummary
          totalRecords={totalRecords}
          fields={[
            { label: t("finance.aggregate.amount", locale) || "Сумма", value: totalAmount, isMoney: true, currency: currency || undefined },
          ]}
          currencyTotals={
            !currency && data?.items
              ? (() => {
                  const byCurrency: Record<string, { count: number; amount: number }> = {};
                  for (const p of data.items) {
                    const c = p.currency || "UNK";
                    if (!byCurrency[c]) byCurrency[c] = { count: 0, amount: 0 };
                    byCurrency[c].count++;
                    byCurrency[c].amount += parseFloat(p.amount) || 0;
                  }
                  return Object.entries(byCurrency).map(([c, v]) => ({
                    currency: c,
                    fields: [
                      { label: t("finance.aggregate.payments", locale) || "Платежей", value: v.count },
                      { label: t("finance.aggregate.amount", locale) || "Сумма", value: v.amount, isMoney: true },
                    ],
                  }));
                })()
              : undefined
          }
        />

        {/* Payments Table with sortable headers */}
        <OperationsRegistrySlot>
          {!data && loading ? (
            <OperationsLoadingState />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("finance.col.code", locale) || "Код"}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>{t("finance.col.date", locale) || "Дата"}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("finance.col.order", locale) || "Заказ"}</th>
                  <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("finance.col.amount", locale) || "Сумма"}</SortableHeader>
                  <SortableHeader field="currency" currentSort={sortState} onSort={handleSort}>{t("finance.col.currency", locale) || "Валюта"}</SortableHeader>
                  <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("finance.col.status", locale) || "Статус"}</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/app/finance/payments/${p.code}`}
                        className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {p.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US") : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.orderId.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{p.currency}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <OperationsEmptyState colSpan={6} message={t("finance.payments.empty", locale) || "Платежей пока нет"} />
                )}
              </tbody>
            </table>
          )}
          {data && data.total > 0 && (
            <Pagination
              page={page}
              pageSize={20}
              total={data.total}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </OperationsRegistrySlot>
      </div>
    </OperationsCenterShell>
  );
}

function PaymentsWithParams() {
  const sp = useSearchParams();
  const fromAnalytics = sp.get("fromAnalytics") === "true";
  return (
    <PaymentsContent
      initialCurrency={sp.get("currency") ?? undefined}
      initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? undefined}
      initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? undefined}
      initialStatus={sp.get("status") ?? undefined}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialDateField={fromAnalytics ? "paidAt" : undefined}
      fromAnalytics={fromAnalytics}
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