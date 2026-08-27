"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Booking, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import { useCan } from "@/lib/use-can";
import ActionButtons from "@/components/ActionButtons";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import { useLocale, t } from "@/lib/i18n";

const ACTIONS = [
  { action: "send", label: "Отправить поставщику", cls: "bg-cyan-600 hover:bg-cyan-700", only: ["NEW", "PREPARING_REQUEST"] },
  { action: "confirm", label: "Подтвердить", cls: "bg-emerald-600 hover:bg-emerald-700", only: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"] },
  { action: "reject", label: "Отклонить", cls: "bg-red-600 hover:bg-red-700", only: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"] },
  { action: "service", label: "Услуга началась", cls: "bg-indigo-600 hover:bg-indigo-700", only: ["CONFIRMED"] },
  { action: "complete", label: "Завершить", cls: "bg-emerald-700 hover:bg-emerald-800", only: ["IN_SERVICE"] },
  { action: "cancel", label: "Отменить", cls: "bg-slate-600 hover:bg-slate-700", only: ["NEW", "PREPARING_REQUEST", "SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION", "CONFIRMED", "IN_SERVICE"] },
] satisfies { action: string; label: string; cls: string; only: string[] }[];

function BookingsContent({ upcomingOnly, statusFilter, overdueOnly, slaMinutes, initialSortBy, initialSortDirection, initialSearch }: { upcomingOnly: boolean; statusFilter?: string; overdueOnly?: boolean; slaMinutes?: string; initialSortBy?: string; initialSortDirection?: SortDirection; initialSearch?: string }) {
  const locale = useLocale();
  const [data, setData] = useState<Page<Booking> | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [orderRef, setOrderRef] = useState<{ code: string; number: string; status: string } | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection);
  const [search, setSearch] = useState(initialSearch || "");
  const [bookingStatusFilter, setBookingStatusFilter] = useState(statusFilter ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Derived filter labels for display
  const activeFilters: string[] = [];
  if (upcomingOnly) activeFilters.push("Предстоящие");
  if (overdueOnly) activeFilters.push(`Подтверждение: SLA нарушен (${slaMinutes ?? 240} мин)`);
  if (bookingStatusFilter) {
    const statusLabels: Record<string, string> = {
      AWAITING_CONFIRMATION: "Ожидает подтверждения",
      CONFIRMED: "Подтверждено",
      CANCELLED: "Отменено",
    };
    activeFilters.push(statusLabels[bookingStatusFilter] ?? `Статус: ${bookingStatusFilter}`);
  }
  // Ролевой UI: права на команды Booking (RBAC Matrix §4).
  const canSend = useCan("booking.send_supplier");
  const canConfirm = useCan("booking.confirm");
  const canCancel = useCan("booking.cancel");
  const permOf: Record<string, boolean> = {
    send: canSend,
    confirm: canConfirm,
    reject: canConfirm,
    service: canConfirm,
    complete: canConfirm,
    cancel: canCancel,
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
    try {
      const qs = new URLSearchParams();
      qs.set('pageSize', '20');
      if (search) qs.set('search', search);
      qs.set('page', String(page));
      if (upcomingOnly) qs.set('upcoming', 'true');
      if (overdueOnly) qs.set('overdue', 'true');
      if (slaMinutes) qs.set('slaMinutes', slaMinutes);
      if (bookingStatusFilter) qs.set('status', bookingStatusFilter);
      if (sortBy) qs.set('sortBy', sortBy);
      if (sortDirection) qs.set('sortDirection', sortDirection);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
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
  }, [upcomingOnly, bookingStatusFilter, overdueOnly, slaMinutes, sortBy, sortDirection, page, search, dateFrom, dateTo]);

  const openDetail = async (id: string) => {
    const booking = await api.get<Booking>(`/bookings/${id}`);
    setSelected(booking);
    try {
      const order = await api.get<{ code: string; number: string; status: string }>(`/orders/${booking.orderId}`);
      setOrderRef(order);
    } catch {
      setOrderRef(null);
    }
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setError("");
    try {
      await api.patch(`/bookings/${selected.id}`, { action });
      await openDetail(selected.id);
      await load();
    } catch (e) {
      // 403 возможен при смене роли на лету или дрейфе маппинга прав → показываем баннер
      setError((e as Error).message);
    }
  };

  const counts = {
    total: data?.total ?? 0,
    awaiting: data?.aggregates?.awaiting ?? data?.items.filter((b) => ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"].includes(b.status)).length ?? 0,
    confirmed: data?.aggregates?.confirmed ?? data?.items.filter((b) => ["CONFIRMED", "IN_SERVICE", "COMPLETED"].includes(b.status)).length ?? 0,
    cancelled: data?.aggregates?.cancelled ?? data?.items.filter((b) => ["CANCELLED", "SUPPLIER_REJECTED"].includes(b.status)).length ?? 0,
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Booking Center"
          breadcrumbs={["TravelHub", "Booking Center"]}
          actions={
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ⟳ Обновить
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: t("admin.kpi.total_bookings", locale), value: counts.total, icon: "📑" },
              { label: t("admin.kpi.awaiting", locale), value: counts.awaiting, icon: "📨", accent: "#06b6d4" },
              { label: t("admin.kpi.confirmed", locale), value: counts.confirmed, icon: "✅", accent: "#059669" },
              { label: t("admin.kpi.cancelled", locale), value: counts.cancelled, icon: "🚫", accent: "#dc2626" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
              placeholder={t("admin.search.placeholder_bookings", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={bookingStatusFilter}
              onChange={(e) => { setBookingStatusFilter(e.target.value); setPage(1); updateUrl({ status: e.target.value }); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("admin.filter.all_statuses", locale)}</option>
              <option value="SENT_TO_SUPPLIER">Отправлен поставщику</option>
              <option value="AWAITING_CONFIRMATION">Ожидает подтверждения</option>
              <option value="CONFIRMED">Подтверждено</option>
              <option value="IN_SERVICE">В обслуживании</option>
              <option value="COMPLETED">Завершено</option>
              <option value="CANCELLED">Отменено</option>
              <option value="SUPPLIER_REJECTED">Отклонено поставщиком</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">С</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">По</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {f}
                </span>
              ))}
            </div>
          )}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
          {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

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
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Код</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Дата</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">Заказ</th>
                  <SortableHeader field="amount" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort} alignRight>Сумма</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">Пассажиры</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Статус</SortableHeader>
                  {(upcomingOnly || overdueOnly) && <SortableHeader field="serviceDate" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Дата услуги</SortableHeader>}
                  {overdueOnly && <th className="px-4 py-2.5 font-medium text-red-600">Ожидание</th>}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => void openDetail(b.id)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${
                      selected?.id === b.id ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{b.code}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{b.createdAt ? new Date(b.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.orderId.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{Number(b.amount).toFixed(2)}</td>
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
                onPageChange={(p) => { setPage(p); setSelected(null); }}
              />
            )}
          </div>
        </div>
      </div>

      {selected && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-mono text-xs text-blue-600">{selected.code}</div>
              <div className="mt-1">
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>

          <div className="space-y-5 p-5 text-sm">
            {orderRef && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <div className="text-slate-400">Связанный заказ (read-only)</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="font-mono text-blue-600">{orderRef.code}</span>
                  <StatusBadge status={orderRef.status} />
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Пассажиры</div>
              {(selected.passengers ?? []).length === 0 && <div className="text-slate-400">Пассажиров нет</div>}
              <div className="space-y-1.5">
                {(selected.passengers ?? []).map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="font-medium text-slate-700">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{p.passportNumber ?? "без паспорта"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Команды (actions)</div>
              <ActionButtons actions={ACTIONS} status={selected.status} permOf={permOf} onRun={(a) => void runAction(a)} />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">История (audit)</div>
              <div className="space-y-1.5">
                {(selected.history ?? []).slice(0, 8).map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">
                      {h.action}
                      {h.from && <span className="text-slate-400"> {h.from} → </span>}
                      {h.to && <span className="text-slate-700">{h.to}</span>}
                    </div>
                    <div className="text-slate-400">{h.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function BookingsWithParams() {
  const sp = useSearchParams();
  return (
    <BookingsContent
      upcomingOnly={sp.get("upcoming") === "true"}
      statusFilter={sp.get("status") || undefined}
      overdueOnly={sp.get("overdue") === "true"}
      slaMinutes={sp.get("slaMinutes") || undefined}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={(sp.get("sortDirection") as SortDirection) ?? undefined}
      initialSearch={sp.get("search") ?? ""}
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
