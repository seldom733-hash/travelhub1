"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type PartnerDetail, type PartnerIntakeResult } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import SortableHeader, { type SortState, type SortDirection } from "@/components/SortableHeader";
import OperationalNotes from "@/components/OperationalNotes";
import PartnerActivity from "@/components/PartnerActivity";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { useCan } from "@/lib/use-can";

type Tab = "overview" | "activity" | "services" | "orders" | "bookings" | "customers" | "storefront" | "notes";

function useQueryState() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [periodFrom, setPeriodFrom] = useState<string | null>(null);
  const [periodTo, setPeriodTo] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<string | null>(null);
  const [fromAnalytics, setFromAnalytics] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["overview", "activity", "services", "orders", "bookings", "customers", "storefront", "notes"].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
    const sortByParam = params.get("sortBy");
    const sortDirParam = params.get("sortDirection");
    if (sortByParam) setSortBy(sortByParam);
    if (sortDirParam && (sortDirParam === "asc" || sortDirParam === "desc")) setSortDirection(sortDirParam);
    const fromParam = params.get("from");
    const toParam = params.get("to");
    const presetParam = params.get("preset");
    if (fromParam) setPeriodFrom(fromParam);
    if (toParam) setPeriodTo(toParam);
    if (presetParam) setPeriodPreset(presetParam);
    if (params.get("fromAnalytics") === "true") setFromAnalytics(true);
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

  return { tab, sortBy, sortDirection, periodFrom, periodTo, periodPreset, fromAnalytics, setTab, setSortBy, setSortDirection, updateQuery };
}

export default function Partner360Page() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;
  const { tab, sortBy, sortDirection, periodFrom, periodTo, periodPreset, fromAnalytics, setTab, setSortBy, setSortDirection, updateQuery } = useQueryState();

  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Per-tab status filters (server-side for orders/bookings/services)
  const [serviceStatusFilter, setServiceStatusFilter] = useState<string | undefined>(undefined);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | undefined>(undefined);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string | undefined>(undefined);
  const [customerStatusFilter, setCustomerStatusFilter] = useState<string | undefined>(undefined);
  // ── Step 3.5C — Platform CRM intake ──
  const [showIntake, setShowIntake] = useState(false);
  const [intaking, setIntaking] = useState(false);
  const [intakeSuccess, setIntakeSuccess] = useState<{ customerId: string; customerCreated: boolean; relationCreated: boolean } | null>(null);
  const [intakeError, setIntakeError] = useState("");
  const [intakeForm, setIntakeForm] = useState({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "", initialNote: "" });
  const canWrite = useCan("crm.partner.write");

  const loadPartner = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (sortBy) params.set("sortBy", sortBy);
      if (sortDirection) params.set("sortDirection", sortDirection);
      if (orderStatusFilter) params.set("status", orderStatusFilter);
      if (bookingStatusFilter) params.set("bookingStatus", bookingStatusFilter);
      if (serviceStatusFilter) params.set("productStatus", serviceStatusFilter);
      if (periodFrom) params.set("dateFrom", periodFrom);
      if (periodTo) params.set("dateTo", periodTo);
      const qs = params.toString();
      const sortParam = qs ? `?${qs}` : "";
      const detail = await api.get<PartnerDetail>(`/partners/${id}${sortParam}`);
      setPartner(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, sortBy, sortDirection, orderStatusFilter, bookingStatusFilter, serviceStatusFilter, periodFrom, periodTo]);

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

  const createIntake = async () => {
    if (!intakeForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intakeForm.email.trim())) {
      setIntakeError(t("crm.intake.error.email_invalid", locale));
      return;
    }
    setIntaking(true);
    setIntakeError("");
    setIntakeSuccess(null);
    try {
      const result = await api.post<PartnerIntakeResult>(`/partners/${id}/intake`, {
        firstName: intakeForm.firstName.trim() || undefined,
        lastName: intakeForm.lastName.trim() || undefined,
        companyName: intakeForm.companyName.trim() || undefined,
        email: intakeForm.email.trim(),
        phone: intakeForm.phone.trim() || undefined,
        leadSource: intakeForm.leadSource || undefined,
        notes: intakeForm.notes.trim() || undefined,
        initialNote: intakeForm.initialNote.trim() || undefined,
      });
      setIntakeSuccess({ customerId: result.customerId, customerCreated: result.customerCreated, relationCreated: result.relationCreated });
      setIntakeForm({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "", initialNote: "" });
      void loadPartner();
    } catch (e) {
      setIntakeError((e as Error).message);
    } finally {
      setIntaking(false);
    }
  };

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

  const tabs: Tab[] = ["overview", "activity", "services", "orders", "bookings", "customers", "storefront", "notes"];

  // Client-side status filter for Customers tab (bounded commercialCustomers dataset)
  const filteredCustomers = customerStatusFilter
    ? partner.commercialCustomers.filter((c) => c.customerStatus === customerStatusFilter)
    : partner.commercialCustomers;

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
        {fromAnalytics && (periodFrom || periodPreset) && (
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-600">
              📊 {t("partner360.period_from_analytics", locale)}: {periodPreset ?? ""}
              {periodFrom && periodTo && <span className="text-blue-400"> ({periodFrom} → {periodTo})</span>}
            </span>
          </div>
        )}
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

          {/* Services — TABLE with sortable headers + server-side status filter */}
          {tab === "services" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={serviceStatusFilter ?? ''} onChange={(e) => setServiceStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">{t('crm.filter.status.all', locale)}</option>
                  <option value="ACTIVE">{t('status.common.ACTIVE', locale)}</option>
                  <option value="INACTIVE">{t('status.common.INACTIVE', locale)}</option>
                  <option value="DRAFT">{t('status.product.DRAFT', locale)}</option>
                  <option value="ARCHIVED">{t('status.product.ARCHIVED', locale)}</option>
                </select>
                {serviceStatusFilter && <button onClick={() => setServiceStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
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
                  {partner.products.length > 0 ? partner.products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/catalog/${p.id}`} className="font-mono text-blue-600 hover:underline">{p.code}</Link></td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{p.title}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.type}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{serviceStatusFilter ? t("crm.filter.status.none", locale) : t("crm.partner_detail.no_services", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Orders — TABLE with sortable headers + server-side status filter */}
          {tab === "orders" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={orderStatusFilter ?? ''} onChange={(e) => setOrderStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">{t('crm.filter.status.all', locale)}</option>
                  <option value="NEW">{t('status.order.NEW', locale)}</option>
                  <option value="IN_PROCESSING">{t('status.order.IN_PROCESSING', locale)}</option>
                  <option value="FULFILLED">{t('status.order.FULFILLED', locale)}</option>
                  <option value="CLOSED">{t('status.order.CLOSED', locale)}</option>
                  <option value="CANCELLED">{t('status.order.CANCELLED', locale)}</option>
                </select>
                {orderStatusFilter && <button onClick={() => setOrderStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
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
                  {partner.orders.length > 0 ? partner.orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/orders/${o.id}`} className="font-mono text-blue-600 hover:underline">{o.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{o.amount} {o.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{orderStatusFilter ? t("crm.filter.status.none", locale) : t("crm.partner_detail.no_orders", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Bookings — TABLE with sortable headers + server-side status filter (NEW) */}
          {tab === "bookings" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <select value={bookingStatusFilter ?? ''} onChange={(e) => setBookingStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">{t('crm.filter.status.all', locale)}</option>
                  <option value="NEW">{t('status.booking.NEW', locale)}</option>
                  <option value="SENT_TO_SUPPLIER">{t('status.booking.SENT_TO_SUPPLIER', locale)}</option>
                  <option value="AWAITING_CONFIRMATION">{t('status.booking.AWAITING_CONFIRMATION', locale)}</option>
                  <option value="CONFIRMED">{t('status.booking.CONFIRMED', locale)}</option>
                  <option value="IN_SERVICE">{t('status.booking.IN_SERVICE', locale)}</option>
                  <option value="COMPLETED">{t('status.booking.COMPLETED', locale)}</option>
                  <option value="CANCELLED">{t('status.booking.CANCELLED', locale)}</option>
                </select>
                {bookingStatusFilter && <button onClick={() => setBookingStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
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
                  {partner.bookings.length > 0 ? partner.bookings.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/bookings/${b.id}`} className="font-mono text-blue-600 hover:underline">{b.code}</Link></td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{b.amount} {b.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{bookingStatusFilter ? t("crm.filter.status.none", locale) : t("crm.partner_detail.no_bookings", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Customers — TABLE with commercial aggregates + client-side status filter */}
          {tab === "customers" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                {canWrite && (
                  <button onClick={() => { setShowIntake(!showIntake); setIntakeSuccess(null); setIntakeError(""); }} className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-700">
                    ＋ {t("crm.add_customer", locale)}
                  </button>
                )}
                <select value={customerStatusFilter ?? ''} onChange={(e) => setCustomerStatusFilter(e.target.value || undefined)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400">
                  <option value="">{t('crm.filter.status.all', locale)}</option>
                  <option value="ACTIVE">{t('status.common.ACTIVE', locale)}</option>
                  <option value="INACTIVE">{t('status.common.INACTIVE', locale)}</option>
                  <option value="LOCKED">{t('status.common.LOCKED', locale)}</option>
                </select>
                {customerStatusFilter && <button onClick={() => setCustomerStatusFilter(undefined)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
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
                  {filteredCustomers.length > 0 ? filteredCustomers.map((c) => (
                    <tr key={c.customerId} className="border-b border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-2.5"><Link href={`/app/crm/customers/${c.customerId}`} className="font-medium text-blue-600 hover:underline">{c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}</Link></td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.orderCount}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.bookingCount}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{c.totalAmount.toFixed(2)} {c.currency}</td>
                      <td className="px-4 py-2.5 text-slate-500">{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-2.5">{c.customerStatus ? <StatusBadge status={c.customerStatus} /> : "—"}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{customerStatusFilter ? t("crm.filter.status.none", locale) : t("crm.partner_detail.no_customers", locale)}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 3.5C — Platform CRM intake panel */}
          {showIntake && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900">{t("crm.intake.title", locale)}</h3>
                <button onClick={() => setShowIntake(false)} className="text-blue-400 hover:text-blue-600">✕</button>
              </div>
              {intakeSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                  {intakeSuccess.customerCreated
                    ? t("crm.intake.success.new_customer", locale)
                    : t("crm.intake.success.existing_customer", locale)}
                  {intakeSuccess.relationCreated
                    ? ` ${t("crm.intake.success.relation_created", locale)}`
                    : ` ${t("crm.intake.success.relation_reused", locale)}`}
                  <Link href={`/app/crm/customers/${intakeSuccess.customerId}`} className="ml-2 font-medium text-blue-600 hover:underline">
                    → {t("crm.intake.view_customer", locale)}
                  </Link>
                </div>
              )}
              {intakeError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">{intakeError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.create.form.firstName", locale)}</label>
                  <input value={intakeForm.firstName} onChange={(e) => setIntakeForm({ ...intakeForm, firstName: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.create.form.lastName", locale)}</label>
                  <input value={intakeForm.lastName} onChange={(e) => setIntakeForm({ ...intakeForm, lastName: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.create.form.companyName", locale)}</label>
                <input value={intakeForm.companyName} onChange={(e) => setIntakeForm({ ...intakeForm, companyName: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.create.form.email", locale)} *</label>
                <input type="email" value={intakeForm.email} onChange={(e) => setIntakeForm({ ...intakeForm, email: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" placeholder="email@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.create.form.phone", locale)}</label>
                <input value={intakeForm.phone} onChange={(e) => setIntakeForm({ ...intakeForm, phone: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.intake.lead_source", locale)}</label>
                <select value={intakeForm.leadSource} onChange={(e) => setIntakeForm({ ...intakeForm, leadSource: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400">
                  <option value="DIRECT">{t("crm.lead_source.direct", locale)}</option>
                  <option value="STOREFRONT">{t("crm.lead_source.storefront", locale)}</option>
                  <option value="PHONE">{t("crm.lead_source.phone", locale)}</option>
                  <option value="OFFICE">{t("crm.lead_source.office", locale)}</option>
                  <option value="EMAIL">{t("crm.lead_source.email", locale)}</option>
                  <option value="MARKETPLACE">{t("crm.lead_source.marketplace", locale)}</option>
                  <option value="REFERRAL">{t("crm.lead_source.referral", locale)}</option>
                  <option value="OTHER">{t("crm.lead_source.other", locale)}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("crm.intake.notes", locale)}</label>
                <textarea value={intakeForm.notes} onChange={(e) => setIntakeForm({ ...intakeForm, notes: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" rows={2} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-blue-400">{t("notes.initial_note", locale)}</label>
                <textarea value={intakeForm.initialNote} onChange={(e) => setIntakeForm({ ...intakeForm, initialNote: e.target.value })} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400" rows={2} maxLength={5000} />
              </div>
              <button onClick={() => void createIntake()} disabled={intaking || !intakeForm.email.trim()} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {intaking ? t("crm.detail.creating", locale) : t("crm.intake.submit", locale)}
              </button>
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

          {/* Activity — Timeline via CrmActivity read model */}
          {tab === "activity" && (
            <PartnerActivity partnerId={id} />
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
