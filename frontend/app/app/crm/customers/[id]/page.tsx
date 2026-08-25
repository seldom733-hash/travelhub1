"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type CustomerDetail, type CustomerPartner } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t } from "@/lib/i18n";

type Tab = "overview" | "orders" | "bookings" | "payments" | "partners" | "refunds" | "history";

export default function Customer360Page() {
  const params = useParams();
  const locale = useLocale();
  const id = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [partners, setPartners] = useState<CustomerPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["overview", "orders", "bookings", "payments", "partners", "refunds", "history"].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
  }, []);

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [detail, partnersData] = await Promise.all([
        api.get<CustomerDetail>(`/customers/${id}/detail`),
        api.get<{ items: CustomerPartner[] }>(`/customers/${id}/partners`),
      ]);
      setCustomer(detail);
      setPartners(partnersData.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadCustomer(); }, [loadCustomer]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  };

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

  const tabs: Tab[] = ["overview", "orders", "bookings", "payments", "partners", "refunds", "history"];

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
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-center"><div className="font-bold text-blue-700">{customer.summary.totalOrders}</div><div className="text-blue-500">{t("crm.detail.total_orders", locale)}</div></div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center"><div className="font-bold text-green-700">{customer.summary.totalBookings}</div><div className="text-green-500">{t("crm.detail.total_bookings", locale)}</div></div>
                <div className="rounded-lg bg-purple-50 px-4 py-3 text-center"><div className="font-bold text-purple-700">{customer.summary.totalPayments}</div><div className="text-purple-500">{t("crm.detail.total_payments", locale)}</div></div>
                <div className="rounded-lg bg-red-50 px-4 py-3 text-center"><div className="font-bold text-red-700">{customer.summary.totalRefunds ?? 0}</div><div className="text-red-500">{t("crm.detail.total_refunds", locale)}</div></div>
              </div>
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-center">
                <div className="font-bold text-amber-700">{partners.length}</div>
                <div className="text-amber-500">{t("crm.detail.total_partners", locale)}</div>
              </div>
            </>
          )}

          {/* Orders */}
          {tab === "orders" && (
            <div className="space-y-2">
              {customer.orders.length > 0 ? customer.orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/app/orders/${o.id}`} className="font-mono text-blue-600 hover:underline">{o.code}</Link>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 text-slate-500">{o.number} · {o.amount} {o.currency}</div>
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_orders", locale)}</div>}
            </div>
          )}

          {/* Bookings */}
          {tab === "bookings" && (
            <div className="space-y-2">
              {customer.bookings.length > 0 ? customer.bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/app/bookings/${b.id}`} className="font-mono text-blue-600 hover:underline">{b.code}</Link>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-1 text-slate-500">{b.amount} {b.currency}</div>
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_bookings", locale)}</div>}
            </div>
          )}

          {/* Payments — enriched with business context */}
          {tab === "payments" && (
            <div className="space-y-2">
              {customer.payments.length > 0 ? customer.payments.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-blue-600">{p.code}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 font-medium text-slate-700">{p.amount} {p.currency}</div>
                  {p.orderCode && (
                    <div className="mt-1 text-slate-500">
                      {t("crm.detail.pays_for_order", locale)} <Link href={`/app/orders/${p.orderId}`} className="text-blue-600 hover:underline">{p.orderCode}</Link>
                      {p.orderNumber && <span className="text-slate-400"> ({p.orderNumber})</span>}
                    </div>
                  )}
                  {p.paymentMethod && <div className="mt-1 text-slate-400">{p.paymentMethod}</div>}
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_payments", locale)}</div>}
            </div>
          )}

          {/* Partners — derived from commercial transactional activity */}
          {tab === "partners" && (
            <div className="space-y-2">
              {partners.length > 0 ? partners.map((p) => (
                <div key={p.partnerId} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/app/crm/partners/${p.partnerId}`} className="font-medium text-blue-600 hover:underline">{p.partnerName}</Link>
                    {p.partnerStatus && <StatusBadge status={p.partnerStatus} />}
                  </div>
                  <div className="mt-1 flex gap-3 text-slate-500">
                    <span>{p.orderCount} {t("crm.detail.orders", locale)}</span>
                    <span>{p.totalBookings} {t("crm.detail.bookings", locale)}</span>
                    <span>{p.totalAmount} {p.currency}</span>
                  </div>
                  {p.lifecycle && <div className="mt-1 text-slate-400">{t("crm.col.lifecycle", locale)}: {p.lifecycle}</div>}
                  {p.leadSource && <div className="mt-1 text-slate-400">{t("crm.col.lead_source", locale)}: {p.leadSource}</div>}
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_partners", locale)}</div>}
            </div>
          )}

          {/* Refunds — enriched with business context */}
          {tab === "refunds" && (
            <div className="space-y-2">
              {customer.refunds && customer.refunds.length > 0 ? customer.refunds.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-blue-600">{r.code}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 font-medium text-slate-700">{r.amount} {r.currency}</div>
                  {r.orderCode && (
                    <div className="mt-1 text-slate-500">
                      {t("crm.detail.refund_for_order", locale)} <Link href={`/app/orders/${r.orderId}`} className="text-blue-600 hover:underline">{r.orderCode}</Link>
                      {r.orderNumber && <span className="text-slate-400"> ({r.orderNumber})</span>}
                    </div>
                  )}
                  {r.paymentCode && <div className="mt-1 text-slate-400">{t("crm.detail.source_payment", locale)}: {r.paymentCode}</div>}
                  {r.reason && <div className="mt-1 text-slate-400">{t("crm.detail.reason", locale)}: {r.reason}</div>}
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_refunds", locale)}</div>}
            </div>
          )}

          {/* History */}
          {tab === "history" && (
            <div className="space-y-2">
              {customer.history.length > 0 ? customer.history.map((h) => (
                <div key={h.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{h.action}</span>
                    <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                  {h.from && h.to && <div className="mt-1 text-slate-500">{h.from} → {h.to}</div>}
                  {h.comment && <div className="mt-1 text-slate-400">{h.comment}</div>}
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_history", locale)}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
