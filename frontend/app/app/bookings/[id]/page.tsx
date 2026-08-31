"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import OperationalNotes from "@/components/OperationalNotes";
import { useLocale, t, formatPrice } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

interface BookingDetail {
  id: string;
  code: string;
  orderId: string;
  productId: string;
  status: string;
  amount: string;
  currency: string | null;
  orderCode: string | null;
  productTitle: string | null;
  createdAt: string;
}

export default function BookingDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<BookingDetail>(`/bookings/${id}`);
      setBooking(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !booking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/bookings" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={booking.code}
        breadcrumbs={["TravelHub", t("bookings.title", locale), booking.code]}
        actions={<Link href="/app/bookings" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{booking.code}</div>
            <div className="mt-1"><StatusBadge status={booking.status} /></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.total_amount", locale)}</div><div className="font-bold text-slate-700">{formatPrice(booking.amount, booking.currency, locale) ?? "—"}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.created", locale)}</div><div className="font-medium text-slate-700">{new Date(booking.createdAt).toLocaleDateString()}</div></div>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
            <div className="text-slate-400">{t("crm.col.order", locale)}</div>
            <Link href={`/app/orders/${booking.orderId}`} className="font-medium text-blue-600 hover:underline">{booking.orderCode ?? booking.orderId}</Link>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
            <div className="text-slate-400">{t("crm.col.service", locale)}</div>
            <Link href={`/app/catalog/${booking.productId}`} className="font-medium text-blue-600 hover:underline">{booking.productTitle ?? booking.productId}</Link>
          </div>

          {/* Notes — Operational Notes */}
          {user && (
            <OperationalNotes
              entityType="Booking"
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
