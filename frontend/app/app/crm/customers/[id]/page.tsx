"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type CustomerDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t } from "@/lib/i18n";

type Tab = "overview" | "orders" | "bookings" | "payments" | "relations" | "refunds" | "history";

export default function Customer360Page() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const id = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  // Read tab from URL search params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["overview", "orders", "bookings", "payments", "relations", "refunds", "history"].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
  }, []);

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<CustomerDetail>(`/customers/${id}/detail`);
      setCustomer(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  };

  const displayName = (c: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-slate-400">{t("crm.loading", locale)}</div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/crm" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("crm.back_to_list", locale)}
        </Link>
      </div>
    );
  }

  const tabs: Tab[] = ["overview", "orders", "bookings", "payments", "relations", "refunds", "history"];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={displayName(customer)}
        breadcrumbs={["TravelHub", t("crm.title", locale), t("crm.tab.customers", locale), displayName(customer)]}
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
            {t(`crm.detail.${dt}`, locale)}
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
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{customer.email}</div></div>
                <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.create.form.phone", locale)}</div><div className="font-medium text-slate-700">{customer.phone ?? "—"}</div></div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-center"><div className="font-bold text-blue-700">{customer.summary.totalOrders}</div><div className="text-blue-500">{t("crm.detail.total_orders", locale)}</div></div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-center"><div className="font-bold text-green-700">{customer.summary.totalBookings}</div><div className="text-green-500">{t("crm.detail.total_bookings", locale)}</div></div>
                <div className="rounded-lg bg-purple-50 px-4 py-3 text-center"><div className="font-bold text-purple-700">{customer.summary.totalPayments}</div><div className="text-purple-500">{t("crm.detail.total_payments", locale)}</div></div>
                <div className="rounded-lg bg-red-50 px-4 py-3 text-center"><div className="font-bold text-red-700">{customer.summary.totalRefunds ?? 0}</div><div className="text-red-500">{t("crm.detail.total_refunds", locale)}</div></div>
              </div>
            </>
          )}

          {/* Orders */}
          {tab === "orders" && (
            <div className="space-y-2">
              {customer.orders.length > 0 ? (
                customer.orders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/orders`} className="font-mono text-blue-600 hover:underline">{o.code}</Link>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{o.number} · {o.amount} {o.currency}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_orders", locale)}</div>
              )}
            </div>
          )}

          {/* Bookings */}
          {tab === "bookings" && (
            <div className="space-y-2">
              {customer.bookings.length > 0 ? (
                customer.bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/bookings`} className="font-mono text-blue-600 hover:underline">{b.code}</Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{b.amount} {b.currency}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_bookings", locale)}</div>
              )}
            </div>
          )}

          {/* Payments */}
          {tab === "payments" && (
            <div className="space-y-2">
              {customer.payments.length > 0 ? (
                customer.payments.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-600">{p.code}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{p.amount} {p.currency}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_payments", locale)}</div>
              )}
            </div>
          )}

          {/* Relations */}
          {tab === "relations" && (
            <div className="space-y-2">
              {customer.partnerRelations.length > 0 ? (
                customer.partnerRelations.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/crm/partners/${r.partnerId}`} className="font-medium text-blue-600 hover:underline">{r.partner?.name ?? r.partnerId}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.lifecycle && <div className="mt-1 text-slate-500">{r.lifecycle}</div>}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_relations", locale)}</div>
              )}
            </div>
          )}

          {/* Refunds */}
          {tab === "refunds" && (
            <div className="space-y-2">
              {customer.refunds && customer.refunds.length > 0 ? (
                customer.refunds.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-600">{r.code}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1 text-slate-500">{r.amount} {r.currency}</div>
                    {r.reason && <div className="mt-1 text-slate-400">{r.reason}</div>}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_refunds", locale)}</div>
              )}
            </div>
          )}

          {/* History */}
          {tab === "history" && (
            <div className="space-y-2">
              {customer.history.length > 0 ? (
                customer.history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{h.action}</span>
                      <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                    </div>
                    {h.from && h.to && <div className="mt-1 text-slate-500">{h.from} → {h.to}</div>}
                    {h.comment && <div className="mt-1 text-slate-400">{h.comment}</div>}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t("crm.detail.no_history", locale)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
