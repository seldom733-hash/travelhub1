"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Booking, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import { useCan } from "@/lib/use-can";
import ActionButtons from "@/components/ActionButtons";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import AggregateSummary from "@/components/AggregateSummary";
import TableExportButton from "@/components/TableExportButton";
import { useLocale, t, formatPrice } from "@/lib/i18n";


const ACTIONS = [
  { action: "send", label: "Отправить поставщику", cls: "bg-cyan-600 hover:bg-cyan-700", only: ["NEW", "PREPARING_REQUEST"] },
  { action: "confirm", label: "Подтвердить", cls: "bg-emerald-600 hover:bg-emerald-700", only: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"] },
  { action: "reject", label: "Отклонить", cls: "bg-red-600 hover:bg-red-700", only: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"] },
  { action: "service", label: "Услуга началась", cls: "bg-indigo-600 hover:bg-indigo-700", only: ["CONFIRMED"] },
  { action: "complete", label: "Завершить", cls: "bg-emerald-700 hover:bg-emerald-800", only: ["IN_SERVICE"] },
  { action: "cancel", label: "Отменить", cls: "bg-slate-600 hover:bg-slate-700", only: ["NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "CONFIRMED", "IN_SERVICE"] },
] satisfies { action: string; label: string; cls: string; only: string[] }[];

function BookingsContent({ upcomingOnly, statusFilter, overdueOnly, slaMinutes, initialSortBy, initialSortDirection, initialSearch, initialDateFrom, initialDateTo }: { upcomingOnly: boolean; statusFilter?: string; overdueOnly?: boolean; slaMinutes?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialSearch?: string; initialDateFrom?: string; initialDateTo?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Page<Booking> | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const [search, setSearch] = useState(initialSearch || "");
  const [bookingStatusFilter, setBookingStatusFilter] = useState(statusFilter ?? "");

  const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
  const [dateTo, setDateTo] = useState(initialDateTo || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = {
    total: data?.total ?? 0,
    awaiting: data?.aggregates?.awaiting ?? 0,
    confirmed: data?.aggregates?.confirmed ?? 0,
    cancelled: data?.aggregates?.cancelled ?? 0,
  };

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

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Booking Center"
          breadcrumbs={["TravelHub", "Booking Center"]}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder={t("admin.search.placeholder_bookings", locale)}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={bookingStatusFilter}
              onChange={(e) => { setBookingStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{t("admin.filter.all_statuses", locale)}</option>
              <option value="SENT_TO_SUPPLIER">{t("booking.status.sent_to_supplier", locale)}</option>
              <option value="AWAITING_CONFIRMATION">{t("booking.status.awaiting", locale)}</option>
              <option value="CONFIRMED">{t("booking.status.confirmed", locale)}</option>
              <option value="IN_SERVICE">{t("booking.status.in_service", locale)}</option>
              <option value="COMPLETED">{t("booking.status.completed", locale)}</option>
              <option value="CANCELLED">{t("booking.status.cancelled", locale)}</option>
              <option value="REJECTED">{t("booking.status.rejected", locale)}</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="С" />
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="По" />
            <TableExportButton
              exportUrl="/api/v1/bookings/export"
              extraParams={{
                ...(bookingStatusFilter ? { status: bookingStatusFilter } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
                ...(search ? { search } : {}),
              }}
            />
          </div>

          <AggregateSummary
            totalRecords={counts.total}
            fields={[
              { label: t("admin.kpi.awaiting", locale), value: counts.awaiting },
              { label: t("admin.kpi.confirmed", locale), value: counts.confirmed },
              { label: t("admin.kpi.cancelled", locale), value: counts.cancelled },
            ]}
            loading={busy}
          />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.code", locale)}</th>
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort} > {t("admin.table.col.amount", locale)} </SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.passengers", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  {(upcomingOnly || overdueOnly) && <SortableHeader field="serviceDate" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}> {t("admin.table.col.service_date", locale)} </SortableHeader>}
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
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      Бронирований пока нет — передайте заказ из Order Center
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data && data.total > 0 && (
              <Pagination
                page={page}
                pageSize={20}
                total={data.total}
                onPageChange={(p) => { setPage(p); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
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
