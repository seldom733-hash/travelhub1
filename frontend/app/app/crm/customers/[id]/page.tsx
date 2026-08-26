"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type CustomerDetail, type CustomerPartner } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import SortableHeader, { type SortState, type SortDirection } from "@/components/SortableHeader";
import OperationalNotes from "@/components/OperationalNotes";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

type Tab = "overview" | "orders" | "bookings" | "payments" | "partners" | "refunds" | "history" | "notes";

function useQueryState() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["overview", "orders", "bookings", "payments", "partners", "refunds", "history", "notes"].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
    const sortByParam = params.get("sortBy");
    const sortDirParam = params.get("sortDirection");
    if (sortByParam) setSortBy(sortByParam);
    if (sortDirParam && (sortDirParam === "asc" || sortDirParam === "desc")) setSortDirection(sortDirParam);
  }, []);

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  return { tab, sortBy, sortDirection, setTab, setSortBy, setSortDirection, updateQuery };
}

export default function Customer360Page() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;
  const { tab, sortBy, sortDirection, setTab, setSortBy, setSortDirection, updateQuery } = useQueryState();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [partners, setPartners] = useState<CustomerPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tabStatusFilter, setTabStatusFilter] = useState<string | undefined>(undefined);

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const sortParam = sortBy ? `?sortBy=${sortBy}&sortDirection=${sortDirection}` : "";
      const [detail, partnersData] = await Promise.all([
        api.get<CustomerDetail>(`/customers/${id}/detail${sortParam}`),
        api.get<{ items: CustomerPartner[] }>(`/customers/${id}/partners`),
      ]);
      setCustomer(detail);
      setPartners(partnersData.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, sortBy, sortDirection]);

  useEffect(() => { void loadCustomer(); }, [loadCustomer]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSortBy(null);
    updateQuery({ tab: newTab, sortBy: null, sortDirection: null });
  };

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    updateQuery({ sortBy: field, sortDirection: direction });
  };

  const sortState: SortState | null = sortBy ? { sortBy, sortDirection } : null;

  const displayName = (c: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—");

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  const tabs: Tab[] = ["overview", "orders", "bookings", "payments", "partners", "refunds", "history", "notes"];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={displayName(customer)}
        breadcrumbs={["TravelHub", t("crm.title", locale), t("crm.tab.customers", locale), displayName(customer)]}
        actions={<Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{customer.code}</div>
            <div className="text-lg font-bold text-slate-900">{displayName(customer)}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={customer.status} />
              <span className="text-xs text-slate-400">{customer.email}</span>
              {customer.phone && <span className="text-xs text-slate-400">· {customer.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
        {tabs.map((dt) => (
          <button key={dt} onClick={() => handleTabChange(dt)} className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === dt ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t(`crm.detail.${dt}`, locale)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          {/* Overview */}
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{customer.email}</div></div>
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.create.form.phone", locale)}</div><div className="font-medium text-slate-700">{customer.phone ?? "—"}</div></div>
              </div>
              <div className="grid grid-cols-5 gap-3 text-xs">
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-center"><div className="font-bold text-blue-700">{customer.summary.totalOrders}</div><div className="text-blue-500">{t("crm.detail.total_orders", locale)}</div></div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center"><div className="font-bold text-green-700">{customer.summary.totalBookings}</div><div className="text-green-500">{t("crm.detail.total_bookings", locale)}</div></div>
                <div className="rounded-lg bg-purple-50 px-4 py-3 text-center"><div className="font-bold text-purple-700">{customer.summary.totalPayments}</div><div className="text-purple-500">{t("crm.detail.total_payments", locale)}</div></div>
                <div className="rounded-lg bg-red-50 px-4 py-3 text-center"><div className="font-bold text-red-700">{customer.summary.totalRefunds ?? 0}</div><div className="text-red-500">{t("crm.detail.total_refunds", locale)}</div></div>
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-center"><div className="font-bold text-amber-700">{partners.length}</div><div className="text-amber-500">{t("crm.detail.total_partners", locale)}</div></div>
              </div>
            </>
          )}

          {/* Orders — TABLE with sortable headers */}
          {tab === "orders" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="NEW">Новый</option>
                  <option value="IN_PROCESSING">В обработке</option>
                  <option value="READY_FOR_BOOKING">Готов к бронированию</option>
                  <option value="FULFILLED">Исполнен</option>
                  <option value="CLOSED">Закрыт</option>
                  <option value="CANCELLED">Отменён</option>
                </select>
                {tabStatusFilter && <button onClick={() => setTabStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                    <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.number", locale)}</SortableHeader>
                    <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>{t("crm.col.created_at", locale)}</SortableHeader>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.amount", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? customer.orders.filter(o => o.status === tabStatusFilter) : customer.orders).length > 0 ? (tabStatusFilter ? customer.orders.filter(o => o.status === tabStatusFilter) : customer.orders).map((o) => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/orders/${o.id}`} className="font-mono text-blue-600 hover:underline">{o.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{o.number}</td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{o.amount} {o.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.detail.no_orders", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Bookings — TABLE with sortable headers */}
          {tab === "bookings" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="NEW">Новое</option>
                  <option value="SENT_TO_SUPPLIER">Отправлено</option>
                  <option value="AWAITING_CONFIRMATION">Ожидает</option>
                  <option value="CONFIRMED">Подтверждено</option>
                  <option value="IN_SERVICE">В сервисе</option>
                  <option value="COMPLETED">Завершено</option>
                  <option value="CANCELLED">Отменено</option>
                </select>
                {tabStatusFilter && <button onClick={() => setTabStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                    <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>{t("crm.col.created_at", locale)}</SortableHeader>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.amount", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? customer.bookings.filter(b => b.status === tabStatusFilter) : customer.bookings).length > 0 ? (tabStatusFilter ? customer.bookings.filter(b => b.status === tabStatusFilter) : customer.bookings).map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/bookings/${b.id}`} className="font-mono text-blue-600 hover:underline">{b.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{b.amount} {b.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.detail.no_bookings", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Payments — TABLE with sortable headers and business context */}
          {tab === "payments" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="CAPTURED">Захвачен</option>
                  <option value="PENDING">Ожидание</option>
                  <option value="FAILED">Ошибка</option>
                </select>
                {tabStatusFilter && <button onClick={() => setTabStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.payment_code", locale)}</SortableHeader>
                    <SortableHeader field="paymentDate" currentSort={sortState} onSort={handleSort}>{t("crm.col.payment_date", locale)}</SortableHeader>
                    <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wide text-slate-400">{t("crm.col.purpose", locale)}</th>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.amount", locale)}</SortableHeader>
                    <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wide text-slate-400">{t("crm.col.method", locale)}</th>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? customer.payments.filter(p => p.status === tabStatusFilter) : customer.payments).length > 0 ? (tabStatusFilter ? customer.payments.filter(p => p.status === tabStatusFilter) : customer.payments).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5 font-mono text-slate-600">{p.code}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {p.orderCode ? (
                          <Link href={`/app/orders/${p.orderId}`} className="text-blue-600 hover:underline">{p.orderCode}</Link>
                        ) : "—"}
                        {p.orderNumber && <span className="ml-1 text-slate-400">({p.orderNumber})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{p.amount} {p.currency}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.paymentMethod ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.detail.no_payments", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Partners — TABLE with commercial aggregates */}
          {tab === "partners" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.partner", locale)}</SortableHeader>
                    <SortableHeader field="orderCount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.detail.orders", locale)}</SortableHeader>
                    <SortableHeader field="bookingCount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.detail.bookings", locale)}</SortableHeader>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.order_amount", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {partners.length > 0 ? partners.map((p) => (
                    <tr key={p.partnerId} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/crm/partners/${p.partnerId}`} className="font-medium text-blue-600 hover:underline">{p.partnerName}</Link></td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{p.orderCount}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{p.totalBookings}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{p.totalAmount.toFixed(2)} {p.currency}</td>
                      <td className="px-4 py-2.5">{p.partnerStatus ? <StatusBadge status={p.partnerStatus} /> : "—"}</td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t("crm.detail.no_partners", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Refunds — TABLE with sortable headers and business context */}
          {tab === "refunds" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="REQUESTED">Запрошен</option>
                  <option value="APPROVED">Одобрен</option>
                  <option value="PROCESSED">Обработан</option>
                  <option value="REJECTED">Отклонён</option>
                </select>
                {tabStatusFilter && <button onClick={() => setTabStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.refund_code", locale)}</SortableHeader>
                    <SortableHeader field="refundDate" currentSort={sortState} onSort={handleSort}>{t("crm.col.refund_date", locale)}</SortableHeader>
                    <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wide text-slate-400">{t("crm.col.purpose", locale)}</th>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.amount", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? (customer.refunds || []).filter(r => r.status === tabStatusFilter) : (customer.refunds || [])).length > 0 ? (tabStatusFilter ? (customer.refunds || []).filter(r => r.status === tabStatusFilter) : (customer.refunds || [])).map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5 font-mono text-slate-600">{r.code}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {r.orderCode ? (
                          <Link href={`/app/orders/${r.orderId}`} className="text-blue-600 hover:underline">{r.orderCode}</Link>
                        ) : "—"}
                        {r.orderNumber && <span className="ml-1 text-slate-400">({r.orderNumber})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{r.amount} {r.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.detail.no_refunds", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* History — TIMELINE (fixed chronological order, no sorting) */}
          {tab === "history" && (
            <div className="space-y-2">
              {customer.history.length > 0 ? customer.history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{h.action}</span>
                      <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                    </div>
                    {h.from && h.to && <div className="mt-1 text-slate-500">{h.from} → {h.to}</div>}
                    {h.comment && <div className="mt-1 text-slate-400">{h.comment}</div>}
                  </div>
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_history", locale)}</div>}
            </div>
          )}

          {/* Notes — Operational Notes */}
          {tab === "notes" && user && (
            <OperationalNotes
              entityType="Customer"
              entityId={id}
              permissions={user.permissions}
              currentUserId={user.id}
              currentRole={user.role}
            />
          )}
        </div>
      </div>
    </div>
  );
}
