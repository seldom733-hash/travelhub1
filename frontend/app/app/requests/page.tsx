"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale, t, formatPrice } from "@/lib/i18n";
import Pagination from "@/components/Pagination";
import TableExportButton from "@/components/TableExportButton";

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

const STATUS_OPTIONS = [
  "",
  "NEW",
  "CHECKING",
  "PRICE_CHANGED",
  "CONFIRMED",
  "CONVERTED",
  "REJECTED",
  "UNAVAILABLE",
  "EXPIRED",
  "SUPPLIER_TIMEOUT",
  "CUSTOMER_PAYMENT_TIMEOUT",
  "CANCELLED_BY_CUSTOMER",
];

function statusColor(s: string) {
  switch (s) {
    case "NEW": return "bg-blue-100 text-blue-700";
    case "CHECKING": return "bg-yellow-100 text-yellow-700";
    case "PRICE_CHANGED": return "bg-orange-100 text-orange-700";
    case "CONFIRMED": return "bg-green-100 text-green-700";
    case "CONVERTED": return "bg-purple-100 text-purple-700";
    case "REJECTED": return "bg-red-100 text-red-700";
    case "UNAVAILABLE": return "bg-gray-100 text-gray-600";
    case "EXPIRED": return "bg-gray-100 text-gray-500";
    case "SUPPLIER_TIMEOUT": return "bg-red-50 text-red-600";
    case "CUSTOMER_PAYMENT_TIMEOUT": return "bg-red-50 text-red-600";
    case "CANCELLED_BY_CUSTOMER": return "bg-slate-100 text-slate-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function statusKey(s: string) {
  return `requests.status.${s.toLowerCase()}`;
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
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    loadData();
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

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  // Build export URL with current filters
  const exportParams = new URLSearchParams();
  if (statusFilter) exportParams.set("status", statusFilter);
  if (search) exportParams.set("search", search);
  const exportUrl = `/api/v1/requests/export?${exportParams.toString()}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("requests.title", locale)}</h1>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {([
            ["total", "requests.kpi.all"],
            ["new", "requests.kpi.new"],
            ["checking", "requests.kpi.checking"],
            ["price_changed", "requests.kpi.price_changed"],
            ["confirmed", "requests.kpi.confirmed"],
            ["converted", "requests.kpi.converted"],
            ["rejected", "requests.kpi.rejected"],
            ["unavailable", "requests.kpi.unavailable"],
            ["expired", "requests.kpi.expired"],
            ["supplier_timeout", "requests.kpi.supplier_timeout"],
            ["customer_payment_timeout", "requests.kpi.customer_timeout"],
            ["cancelled_by_customer", "requests.kpi.cancelled"],
          ] as [string, string][]).map(([key, labelKey]) => (
            <div
              key={key}
              className={`rounded-lg border px-3 py-2 text-center ${
                key === "total"
                  ? "border-blue-500/30 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="text-xl font-bold text-gray-900">{kpi[key] ?? 0}</div>
              <div className="text-xs text-gray-500">{t(labelKey, locale)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Все статусы</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{t(statusKey(s), locale)}</option>
          ))}
        </select>

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Поиск: MKT-REQ-*, имя клиента, CRM-*, название услуги, поставщик..."
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
        />
        <button
          onClick={handleSearch}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          Поиск
        </button>

        <TableExportButton
          exportUrl={exportUrl}
          label={t("export.label", locale)}
        />

        {loading && <span className="text-xs text-gray-500">{t("common.loading", locale)}</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm" style={{ minWidth: "1100px" }}>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">{t("requests.ref", locale)}</th>
              <th className="px-4 py-3">{t("requests.customer", locale)}</th>
              <th className="px-4 py-3">{t("requests.product", locale)}</th>
              <th className="px-4 py-3">{t("requests.supplier", locale)}</th>
              <th className="px-4 py-3">{t("requests.displayed_price", locale)}</th>
              <th className="px-4 py-3">{t("requests.confirmed_price", locale)}</th>
              <th className="px-4 py-3">Дата подтверждения</th>
              <th className="px-4 py-3">{t("requests.service_date", locale)}</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">{t("requests.created", locale)}</th>
              <th className="px-4 py-3">{t("requests.sla_deadline", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  {t("requests.no_data", locale)}
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/app/requests/${r.id}`)}
                    className="font-mono text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {r.referenceNumber}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-900">
                  <div>{r.customerName || "—"}</div>
                  {r.customerCode && <div className="text-xs text-gray-500">{r.customerCode}</div>}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  <div>{r.productName || "—"}</div>
                  {r.productCode && <div className="text-xs text-gray-500">{r.productCode}</div>}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  <div>{r.partnerName || "—"}</div>
                  {r.partnerCode && <div className="text-xs text-gray-500">{r.partnerCode}</div>}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.supplierRespondedAt
                    ? new Date(r.supplierRespondedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {r.requestedServiceDate ? new Date(r.requestedServiceDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                    {t(statusKey(r.status), locale)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
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
  );
}
