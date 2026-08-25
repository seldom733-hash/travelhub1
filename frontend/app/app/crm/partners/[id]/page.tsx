"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type PartnerDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t } from "@/lib/i18n";

type Tab = "overview" | "services" | "orders" | "bookings" | "customers" | "storefront";

export default function Partner360Page() {
  const params = useParams();
  const locale = useLocale();
  const id = params.id as string;

  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  // Read tab from URL search params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["overview", "services", "orders", "bookings", "customers", "storefront"].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
  }, []);

  const loadPartner = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<PartnerDetail>(`/partners/${id}`);
      setPartner(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPartner();
  }, [loadPartner]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-slate-400">{t("crm.loading", locale)}</div>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("crm.back_to_list", locale)}
        </Link>
      </div>
    );
  }

  const tabs: Tab[] = ["overview", "services", "orders", "bookings", "customers", "storefront"];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={partner.name}
        breadcrumbs={["TravelHub", t("crm.title", locale), t("crm.tab.partners", locale), partner.name]}
        actions={
          <Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            ← {t("crm.back_to_list", locale)}
          </Link>
        }
      />

      {/* Entity header */}
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
        {tabs.map((dt) => (
          <button
            key={dt}
            onClick={() => handleTabChange(dt)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === dt ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t(`crm.partner_detail.${dt}`, locale)}
          </button>
        ))}
      </div>

      {/* Tab content */}
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
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-center"><div className="font-bold text-blue-700">{partner.totalProducts}</div><div className="text-blue-500">{t("crm.partner_detail.total_services", locale)}</div></div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center"><div className="font-bold text-green-700">{partner.totalOrders}</div><div className="text-green-500">{t("crm.partner_detail.total_orders", locale)}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
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

          {/* Services */}
          {tab === "services" && (
            <div className="space-y-2">
              {partner.products.length > 0 ? (
                partner.products.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/catalog`} className="font-mono text-blue-600 hover:underline">{p.code}</Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 font-medium text-slate-700">{p.title}</div>
                    <div className="mt-1 text-slate-400">{p.type}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.partner_detail.no_services", locale)}</div>
              )}
              {partner.totalProducts > 20 && (
                <div className="text-center text-xs text-slate-400">{t("crm.showing_of", locale)}</div>
              )}
            </div>
          )}

          {/* Orders */}
          {tab === "orders" && (
            <div className="space-y-2">
              {partner.orders.length > 0 ? (
                partner.orders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/orders`} className="font-mono text-blue-600 hover:underline">{o.code}</Link>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{o.number} · {o.amount} {o.currency}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.partner_detail.no_orders", locale)}</div>
              )}
              {partner.totalOrders > 20 && (
                <div className="text-center text-xs text-slate-400">{t("crm.showing_of", locale)}</div>
              )}
            </div>
          )}

          {/* Bookings */}
          {tab === "bookings" && (
            <div className="space-y-2">
              {partner.bookings.length > 0 ? (
                partner.bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/bookings`} className="font-mono text-blue-600 hover:underline">{b.code}</Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{b.amount} {b.currency}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.partner_detail.no_bookings", locale)}</div>
              )}
              {partner.totalBookings > 20 && (
                <div className="text-center text-xs text-slate-400">{t("crm.showing_of", locale)}</div>
              )}
            </div>
          )}

          {/* Customers */}
          {tab === "customers" && (
            <div className="space-y-2">
              {partner.customerRelations.length > 0 ? (
                partner.customerRelations.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/crm/customers/${r.customerId}`} className="font-medium text-blue-600 hover:underline">{r.customer?.firstName} {r.customer?.lastName}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.lifecycle && <div className="mt-1 text-slate-500">{r.lifecycle}</div>}
                    {r.leadSource && <div className="mt-1 text-slate-400">{t("crm.col.lead_source", locale)}: {r.leadSource}</div>}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.partner_detail.no_customers", locale)}</div>
              )}
            </div>
          )}

          {/* Storefront */}
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
        </div>
      </div>
    </div>
  );
}
