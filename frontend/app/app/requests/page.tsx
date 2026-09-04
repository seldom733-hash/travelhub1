"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale, t, type Locale } from "@/lib/i18n";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";
import StatusBadge from "@/components/StatusBadge";
import CommerceKpiCard from "@/components/commerce/CommerceKpiCard";

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

const REQUEST_LIFECYCLE_STATUSES = [
  "NEW", "CHECKING", "SUPPLIER_TIMEOUT", "PRICE_CHANGED",
  "CUSTOMER_ACCEPTED", "CONFIRMED", "CONVERTED", "REJECTED",
  "UNAVAILABLE", "EXPIRED", "CUSTOMER_PAYMENT_TIMEOUT", "CANCELLED_BY_CUSTOMER",
] as const;

function requestStatusLabel(code: string, locale: Locale): string {
  const key = `requests.kpi.${code.toLowerCase()}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function RequestsPage() {
  const locale = useLocale();
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadKpi();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const d = await api.get(`/requests?${params.toString()}`) as any;
      setRequests(d.data);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch (err: any) {
      setError(err.message || "Error loading requests");
    } finally {
      setLoading(false);
    }
  }

  async function loadKpi() {
    try {
      const d: any = await api.get("/requests/kpi");
      setKpi(d);
    } catch { /* noop */ }
  }

  const selectedStatus = statusFilter || "";

  // Build export URL with current filters
  const exportParams = new URLSearchParams();
  if (statusFilter) exportParams.set("status", statusFilter);
  if (search) exportParams.set("search", search);
  const exportUrl = `/api/v1/requests/export?${exportParams.toString()}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("requests.title", locale)}</h1>
      </div>

      {/* TOTAL KPI */}
      {kpi && (
        <div className="grid grid-cols-1">
          <CommerceKpiCard
            label={t("requests.kpi.all", locale)}
            value={kpi.total ?? 0}
            active={!selectedStatus}
            onClick={() => { setStatusFilter(""); setPage(1); }}
          />
        </div>
      )}

      {/* STATUS KPI CARDS — one per canonical status */}
      {kpi && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin.kpi.request_statuses", locale) || "Статусы заявок"}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {REQUEST_LIFECYCLE_STATUSES.map((code) => (
              <CommerceKpiCard
                key={code}
                label={requestStatusLabel(code, locale)}
                value={kpi[code.toLowerCase()] ?? 0}
                active={selectedStatus === code}
                onClick={() => { setStatusFilter(code); setPage(1); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filters: search first, no Search button */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Поиск: MKT-REQ-*, имя клиента, CRM-*, название услуги, поставщик..."
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Все статусы</option>
          {REQUEST_LIFECYCLE_STATUSES.map((s) => (
            <option key={s} value={s}>{requestStatusLabel(s, locale)}</option>
          ))}
        </select>

        <TableExportButton
          exportUrl={exportUrl}
          label={t("export.label", locale)}
        />

        {loading && <span className="text-xs text-slate-400">{t("common.loading", locale)}</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("requests.ref", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.customer", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.product", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.supplier", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.displayed_price", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.confirmed_price", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.service_date", locale)}</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.created", locale)}</th>
              <th className="px-4 py-2.5 font-medium">{t("requests.sla_deadline", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                  {t("requests.no_data", locale)}
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50"
                onClick={() => router.push(`/app/requests/${r.id}`)}
              >
                <td className="px-4 py-2.5">
                  <Link href={`/app/requests/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-blue-600 hover:underline">
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
                <td className="px-4 py-2.5 text-slate-900">
                  {r.requestedServiceDate ? new Date(r.requestedServiceDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {r.supplierResponseDeadline
                    ? new Date(r.supplierResponseDeadline).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        locale={locale}
        onPageChange={setPage}
      />
          </div>
        </div>
      </div>
    </div>
  );
}
