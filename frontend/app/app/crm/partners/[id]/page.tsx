"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type PartnerDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import SortableHeader, { type SortState, type SortDirection } from "@/components/SortableHeader";
import OperationalNotes from "@/components/OperationalNotes";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

type Tab = "overview" | "services" | "orders" | "bookings" | "customers" | "storefront" | "notes";

function useQueryState() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["overview", "services", "orders", "bookings", "customers", "storefront", "notes"].includes(tabParam)) {
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

export default function Partner360Page() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;
  const { tab, sortBy, sortDirection, setTab, setSortBy, setSortDirection, updateQuery } = useQueryState();

  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tabStatusFilter, setTabStatusFilter] = useState<string | undefined>(undefined);

  const loadPartner = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const sortParam = sortBy ? `?sortBy=${sortBy}&sortDirection=${sortDirection}` : "";
      const detail = await api.get<PartnerDetail>(`/partners/${id}${sortParam}`);
      setPartner(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, sortBy, sortDirection]);

  useEffect(() => { void loadPartner(); }, [loadPartner]);

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

  // Build customer lookup for cross-referencing orders
  const customerMap = useMemo(() => {
    if (!partner) return new Map<string, { firstName: string | null; lastName: string | null; companyName: string | null }>();
    return new Map(
      partner.commercialCustomers.map((c) => [
        c.customerId,
        { firstName: c.firstName, lastName: c.lastName, companyName: c.companyName },
      ])
    );
  }, [partner]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !partner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  const tabs: Tab[] = ["overview", "services", "orders", "bookings", "customers", "storefront", "notes"];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={partner.name}
        breadcrumbs={["TravelHub", t("crm.title", locale), t("crm.tab.partners", locale), partner.name]}
        actions={<Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{partner.code}</div>
            <div className="text-lg font-bold text-slate-900">{partner.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={partner.status} />
              <span className="text-xs text-slate-400">{partner.contactEmail ?? "—"}</span>
              {partner.countryCode && <span className="text-xs text-slate-400">· {partner.countryCode}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
        {tabs.map((dt) => (
          <button key={dt} onClick={() => handleTabChange(dt)} className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === dt ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t(`crm.partner_detail.${dt}`, locale)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          {/* Overview */}
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{partner.contactEmail ?? "—"}</div></div>
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.country", locale)}</div><div className="font-medium text-slate-700">{partner.countryCode ?? "—"}</div></div>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
                <div className="text-slate-400">{t("crm.col.registration_number", locale)}</div>
                <div className="font-medium text-slate-700">{partner.registrationNumber ?? "—"}</div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-center"><div className="font-bold text-blue-700">{partner.totalProducts}</div><div className="text-blue-500">{t("crm.partner_detail.total_services", locale)}</div></div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center"><div className="font-bold text-green-700">{partner.totalOrders}</div><div className="text-green-500">{t("crm.partner_detail.total_orders", locale)}</div></div>
                <div className="rounded-lg bg-purple-50 px-4 py-3 text-center"><div className="font-bold text-purple-700">{partner.totalBookings}</div><div className="text-purple-500">{t("crm.partner_detail.total_bookings", locale)}</div></div>
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-center"><div className="font-bold text-amber-700">{partner.totalCustomers}</div><div className="text-amber-500">{t("crm.partner_detail.total_relations", locale)}</div></div>
              </div>
              {partner.storefront && (
                <div className="rounded-lg bg-emerald-50 px-4 py-3 text-xs">
                  <div className="text-emerald-400">{t("crm.partner_detail.storefront", locale)}</div>
                  <div className="font-medium text-emerald-700">{partner.storefront.businessName ?? partner.storefront.slug}</div>
                  <div className="mt-1 flex gap-2"><StatusBadge status={partner.storefront.status} /><StatusBadge status={partner.storefront.entitlementStatus} /></div>
                </div>
              )}
            </>
          )}

          {/* Services — TABLE with sortable headers */}
          {tab === "services" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="ACTIVE">Активна</option>
                  <option value="INACTIVE">Неактивна</option>
                  <option value="DRAFT">Черновик</option>
                  <option value="ARCHIVED">В архиве</option>
                </select>
                {tabStatusFilter && <button onClick={() => setTabStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                    <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.name", locale)}</SortableHeader>
                    <SortableHeader field="type" currentSort={sortState} onSort={handleSort}>{t("crm.col.type", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                    <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>{t("crm.col.created_at", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? partner.products.filter(p => p.status === tabStatusFilter) : partner.products).length > 0 ? (tabStatusFilter ? partner.products.filter(p => p.status === tabStatusFilter) : partner.products).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/catalog/${p.id}`} className="font-mono text-blue-600 hover:underline">{p.code}</Link></td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{p.title}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.type}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.partner_detail.no_services", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Orders — TABLE with sortable headers */}
          {tab === "orders" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={tabStatusFilter ?? ''} onChange={(e) => setTabStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">Все статусы</option>
                  <option value="NEW">Новый</option>
                  <option value="IN_PROCESSING">В обработке</option>
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
                    <SortableHeader field="createdAt" currentSort={sortState} onSort={handleSort}>{t("crm.col.created_at", locale)}</SortableHeader>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.amount", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {(tabStatusFilter ? partner.orders.filter(o => o.status === tabStatusFilter) : partner.orders).length > 0 ? (tabStatusFilter ? partner.orders.filter(o => o.status === tabStatusFilter) : partner.orders).map((o) => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/orders/${o.id}`} className="font-mono text-blue-600 hover:underline">{o.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{o.amount} {o.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{tabStatusFilter ? 'Нет данных по выбранным фильтрам' : t("crm.partner_detail.no_orders", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Bookings — TABLE with sortable headers */}
          {tab === "bookings" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  {partner.bookings.length > 0 ? partner.bookings.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/bookings/${b.id}`} className="font-mono text-blue-600 hover:underline">{b.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{b.amount} {b.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t("crm.partner_detail.no_bookings", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Customers — TABLE with commercial aggregates and sortable headers */}
          {tab === "customers" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.customer", locale)}</SortableHeader>
                    <SortableHeader field="orderCount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.detail.orders", locale)}</SortableHeader>
                    <SortableHeader field="bookingCount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.detail.bookings", locale)}</SortableHeader>
                    <SortableHeader field="amount" currentSort={sortState} onSort={handleSort} alignRight>{t("crm.col.order_amount", locale)}</SortableHeader>
                    <SortableHeader field="lastActivity" currentSort={sortState} onSort={handleSort}>{t("crm.col.last_activity", locale)}</SortableHeader>
                    <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {partner.commercialCustomers.length > 0 ? partner.commercialCustomers.map((c) => (
                    <tr key={c.customerId} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/crm/customers/${c.customerId}`} className="font-medium text-blue-600 hover:underline">{c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}</Link></td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.orderCount}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.bookingCount}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{c.totalAmount.toFixed(2)} {c.currency}</td>
                      <td className="px-4 py-2.5 text-slate-500">{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-2.5">{c.customerStatus ? <StatusBadge status={c.customerStatus} /> : "—"}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t("crm.partner_detail.no_customers", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Storefront — structured summary (no sorting needed) */}
          {tab === "storefront" && (
            <div className="space-y-3">
              {partner.storefront ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.partner_detail.storefront_code", locale)}</div><div className="font-mono font-medium text-slate-700">{partner.storefront.code}</div></div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.partner_detail.storefront_slug", locale)}</div><div className="font-medium text-slate-700">/{partner.storefront.slug}</div></div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
                    <div className="text-slate-400">{t("crm.partner_detail.storefront_name", locale)}</div>
                    <div className="font-medium text-slate-700">{partner.storefront.businessName ?? "—"}</div>
                  </div>
                  {partner.storefront.tagline && (
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
                      <div className="text-slate-400">{t("crm.partner_detail.storefront_tagline", locale)}</div>
                      <div className="font-medium text-slate-700">{partner.storefront.tagline}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.partner_detail.storefront_status", locale)}</div><div className="mt-1"><StatusBadge status={partner.storefront.status} /></div></div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.partner_detail.storefront_entitlement", locale)}</div><div className="mt-1"><StatusBadge status={partner.storefront.entitlementStatus} /></div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.partner_detail.storefront_locale", locale)}</div><div className="font-medium text-slate-700">{partner.storefront.defaultLocale}</div></div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.country", locale)}</div><div className="font-medium text-slate-700">{partner.storefront.countryCode ?? "—"}</div></div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.partner_detail.no_storefront", locale)}</div>
              )}
            </div>
          )}

          {/* Notes — Operational Notes */}
          {tab === "notes" && user && (
            <OperationalNotes
              entityType="Partner"
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
