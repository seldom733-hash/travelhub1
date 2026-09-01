"use client";

/**
 * Payment Detail page — canonical source for a single Payment record.
 * Backend endpoint: GET /finance/payments/:code
 * Shows: code, status, amount, currency, dates, orderId, customerId, partnerId.
 * Related Order links to canonical Order Detail.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t, formatPrice } from "@/lib/i18n";

interface PaymentDetail {
  id: string;
  code: string;
  referenceNumber: string;
  orderId: string;
  customerId: string | null;
  partnerId: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  providerRef: string | null;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span className="w-40 shrink-0 text-xs font-medium text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value ?? "—"}</span>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const code = params.id as string; // route param is [id] but backend uses :code

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<PaymentDetail>(`/finance/payments/${code}`);
      setPayment(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (v: string, cur?: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    if (cur) return formatPrice(n, cur, locale) ?? v;
    return n.toLocaleString(
      locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US") : "—";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={payment?.referenceNumber ?? t("common.detail", locale)}
        breadcrumbs={[
          "TravelHub",
          t("finance.payments.title", locale) || "Платежи",
          payment?.code ?? "…",
        ]}
        actions={
          <Link
            href="/app/finance/payments"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("common.back", locale)}
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {payment && (
          <div className="space-y-6">
            {/* Status + Amount hero */}
            <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex-1">
                <div className="mb-1 text-2xl font-bold text-slate-800">
                  {fmt(payment.amount, payment.currency)}
                </div>
                <div className="text-xs text-slate-400">
                  {t("common.id", locale)}: {payment.referenceNumber}
                </div>
              </div>
              <StatusBadge status={payment.status} />
            </div>

            {/* Detail card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                {t("common.detail", locale)}
              </h3>
              <div className="divide-y divide-slate-100">
                <DetailRow label={t("finance.col.code", locale) || "Код"} value={payment.referenceNumber} />
                <DetailRow label={t("finance.col.status", locale) || "Статус"} value={<StatusBadge status={payment.status} />} />
                <DetailRow label={t("finance.col.amount", locale) || "Сумма"} value={fmt(payment.amount, payment.currency)} />
                <DetailRow label={t("finance.col.currency", locale) || "Валюта"} value={payment.currency} />
                <DetailRow label={t("finance.col.date", locale) || "Дата"} value={fmtDate(payment.createdAt)} />
                {payment.paidAt && <DetailRow label={locale === "ru" ? "Оплачен" : locale === "az" ? "Ödənilib" : "Paid at"} value={fmtDate(payment.paidAt)} />}
                {payment.failedAt && <DetailRow label={locale === "ru" ? "Ошибка" : locale === "az" ? "Xəta" : "Failed at"} value={fmtDate(payment.failedAt)} />}
                {payment.cancelledAt && <DetailRow label={locale === "ru" ? "Отменён" : locale === "az" ? "Ləğv edilib" : "Cancelled at"} value={fmtDate(payment.cancelledAt)} />}
                <DetailRow
                  label={t("finance.col.order", locale) || "Заказ"}
                  value={
                    <Link
                      href={`/app/orders/${payment.orderId}`}
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {payment.orderId.slice(0, 8)}…
                    </Link>
                  }
                />
                {payment.paymentMethod && <DetailRow label={locale === "ru" ? "Метод" : "Method"} value={payment.paymentMethod} />}
                {payment.providerRef && <DetailRow label="Provider Ref" value={payment.providerRef} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
