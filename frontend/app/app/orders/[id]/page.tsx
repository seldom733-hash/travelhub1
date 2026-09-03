"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import OperationalNotes from "@/components/OperationalNotes";
import TravelerCollectionPanel from "@/components/order/TravelerCollectionPanel";
import { useLocale, t, formatPrice } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

interface OrderDetail {
  id: string;
  code: string;
  number: string;
  referenceNumber: string;
  status: string;
  paymentStatus: string;
  amount: string;
  paidAmount: string;
  refundedAmount: string;
  currency: string;
  customerId: string | null;
  sellerPartnerId: string | null;
  customerDisplayName: string | null;
  partnerDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  items?: { id: string; title: string; type: string; quantity: number; price: string; amount: string; currency: string }[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<OrderDetail>(`/orders/${id}`);
      setOrder(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/orders" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={order.referenceNumber}
        breadcrumbs={["TravelHub", t("orders.title", locale), order.referenceNumber]}
        actions={<Link href="/app/orders" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{order.referenceNumber}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.total_amount", locale)}</div><div className="font-bold text-slate-700">{formatPrice(order.amount, order.currency, locale) ?? "—"}</div></div>
            <div className="rounded-lg bg-green-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.paid_amount", locale)}</div><div className="font-medium text-green-700">{formatPrice(order.paidAmount, order.currency, locale) ?? "—"}</div></div>
            <div className="rounded-lg bg-red-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.refunded_amount", locale)}</div><div className="font-medium text-red-700">{formatPrice(order.refundedAmount, order.currency, locale) ?? "—"}</div></div>
          </div>

          {order.customerId && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
              <div className="text-slate-400">{t("crm.col.customer", locale)}</div>
              <Link href={`/app/crm/customers/${order.customerId}`} className="font-medium text-blue-600 hover:underline">{order.customerDisplayName ?? order.customerId}</Link>
            </div>
          )}

          {order.sellerPartnerId && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
              <div className="text-slate-400">{t("crm.col.seller_partner", locale)}</div>
              <Link href={`/app/crm/partners/${order.sellerPartnerId}`} className="font-medium text-blue-600 hover:underline">{order.partnerDisplayName ?? order.sellerPartnerId}</Link>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.created", locale)}</div><div className="font-medium text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.updated", locale)}</div><div className="font-medium text-slate-700">{new Date(order.updatedAt).toLocaleDateString()}</div></div>
          </div>

          {order.items && order.items.length > 0 && (
            <div>
              <div className="mb-2 font-medium text-slate-700">{t("order.items", locale)}</div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-100 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Link href={`/app/catalog/${item.id}`} className="font-medium text-blue-600 hover:underline">{item.title}</Link>
                      <span className="text-slate-500">{formatPrice(item.amount, item.currency, locale) ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-slate-400">{item.type} · ×{item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* D3 — Traveler Collection (pinned requirements + save/resume + final confirmation) */}
          <div>
            <div className="mb-2 font-medium text-slate-700">{t("d3.travelers_title", locale)}</div>
            <TravelerCollectionPanel orderId={id} />
          </div>

          {/* Notes — Operational Notes */}
          {user && (
            <OperationalNotes
              entityType="Order"
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
