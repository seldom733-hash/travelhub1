"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale, t } from "@/lib/i18n";

interface RequestDetail {
  id: string;
  code: string;
  commerceSequence: string;
  referenceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerCode: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  productType: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerCode: string | null;
  partnerCountry: string | null;
  status: string;
  requestedServiceDate: string | null;
  quantity: number;
  displayedPrice: string | null;
  displayedCurrency: string | null;
  confirmedPrice: string | null;
  confirmedCurrency: string | null;
  supplierResponseDeadline: string | null;
  supplierRespondedAt: string | null;
  supplierDecision: string | null;
  supplierPriceProposal: string | null;
  supplierNote: string | null;
  customerActionDeadline: string | null;
  customerAcceptedAt: string | null;
  customerDecision: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  convertedOrder?: {
    id: string;
    referenceNumber: string;
    status: string;
    amount: string | null;
    currency: string | null;
    createdAt: string | null;
  };
  convertedBooking?: {
    id: string;
    referenceNumber: string;
    status: string;
    createdAt: string | null;
  };
  convertedPayments?: Array<{
    id: string;
    referenceNumber: string;
    status: string;
    amount: string | null;
    currency: string | null;
    createdAt: string | null;
  }>;
}

function statusColor(s: string) {
  switch (s) {
    case "NEW": return "bg-blue-100 text-blue-700";
    case "CHECKING": return "bg-yellow-100 text-yellow-700";
    case "PRICE_CHANGED": return "bg-orange-100 text-orange-700";
    case "CONFIRMED": return "bg-green-100 text-green-700";
    case "CONVERTED": return "bg-purple-100 text-purple-700";
    case "REJECTED": return "bg-red-100 text-red-700";
    case "UNAVAILABLE": return "bg-gray-100 text-gray-600";
    case "EXPIRED": return "bg-gray-100 text-gray-500";
    case "SUPPLIER_TIMEOUT": return "bg-red-50 text-red-600";
    case "CUSTOMER_PAYMENT_TIMEOUT": return "bg-red-50 text-red-600";
    case "CANCELLED_BY_CUSTOMER": return "bg-slate-100 text-slate-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function statusKey(s: string) {
  return `requests.status.${s.toLowerCase()}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      <span className="text-sm text-gray-900">{value || "—"}</span>
    </div>
  );
}

export default function RequestDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadRequest();
  }, [id]);

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get(`/requests/${id}`) as any;
      setRequest(d);
    } catch (err: any) {
      setError(err.message || "Error loading request");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">{t("common.loading", locale)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Заявка не найдена</div>
      </div>
    );
  }

  const r = request;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/app/requests")}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Назад к списку
        </button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{r.referenceNumber}</h1>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor(r.status)}`}>
          {t(statusKey(r.status), locale)}
        </span>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-lg border border-gray-200 bg-white p-6">
        <InfoRow label="Клиент" value={
          <>
            <span className="font-medium">{r.customerName || "—"}</span>
            {r.customerCode && <span className="ml-2 text-xs text-gray-500">{r.customerCode}</span>}
          </>
        } />
        <InfoRow label="Услуга" value={
          <>
            <span className="font-medium">{r.productName || "—"}</span>
            {r.productCode && <span className="ml-2 text-xs text-gray-500">{r.productCode}</span>}
          </>
        } />
        <InfoRow label="Поставщик" value={
          <>
            <span className="font-medium">{r.partnerName || "—"}</span>
            {r.partnerCode && <span className="ml-2 text-xs text-gray-500">{r.partnerCode}</span>}
          </>
        } />

        <InfoRow label="Цена витрины" value={
          r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : "—"
        } />
        <InfoRow label="Подтверждённая цена" value={
          r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : "—"
        } />
        <InfoRow label="Количество" value={r.quantity} />

        <InfoRow label="Дата услуги" value={
          r.requestedServiceDate ? new Date(r.requestedServiceDate).toLocaleDateString() : "—"
        } />
        <InfoRow label="Дата подтверждения" value={
          r.supplierRespondedAt ? new Date(r.supplierRespondedAt).toLocaleDateString() : "—"
        } />
        <InfoRow label="Создана" value={
          r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"
        } />
      </div>

      {/* Supplier SLA */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Поставщик</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoRow label="Дедлайн ответа" value={
            r.supplierResponseDeadline ? new Date(r.supplierResponseDeadline).toLocaleString() : "—"
          } />
          <InfoRow label="Ответил" value={
            r.supplierRespondedAt ? new Date(r.supplierRespondedAt).toLocaleString() : "—"
          } />
          <InfoRow label="Решение" value={r.supplierDecision || "—"} />
        </div>
        {r.supplierPriceProposal && (
          <InfoRow label="Предложенная цена" value={`${r.supplierPriceProposal} ${r.displayedCurrency ?? ""}`} />
        )}
        {r.supplierNote && (
          <InfoRow label="Примечание поставщика" value={r.supplierNote} />
        )}
      </div>

      {/* Customer TTL */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Клиент</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoRow label="Дедлайн клиента" value={
            r.customerActionDeadline ? new Date(r.customerActionDeadline).toLocaleString() : "—"
          } />
          <InfoRow label="Принял" value={
            r.customerAcceptedAt ? new Date(r.customerAcceptedAt).toLocaleString() : "—"
          } />
          <InfoRow label="Решение" value={r.customerDecision || "—"} />
        </div>
      </div>

      {/* Price Change Info */}
      {(r.rejectedAt || r.rejectionReason) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Отклонение</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow label="Дата" value={
              r.rejectedAt ? new Date(r.rejectedAt).toLocaleString() : "—"
            } />
            <InfoRow label="Кем" value={r.rejectedBy || "—"} />
            <InfoRow label="Причина" value={r.rejectionReason || "—"} />
          </div>
        </div>
      )}

      {/* Converted Commerce Chain */}
      {r.convertedOrder && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Конвертировано в</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Заказ" value={
              <button
                onClick={() => router.push(`/app/orders`)}
                className="font-mono text-sm text-blue-600 hover:underline"
              >
                {r.convertedOrder.referenceNumber}
              </button>
            } />
            <InfoRow label="Статус заказа" value={r.convertedOrder.status} />
            {r.convertedOrder.amount && (
              <InfoRow label="Сумма" value={`${r.convertedOrder.amount} ${r.convertedOrder.currency ?? ""}`} />
            )}
          </div>
          {r.convertedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-purple-200">
              <InfoRow label="Бронирование" value={
                <button
                  onClick={() => router.push(`/app/bookings`)}
                  className="font-mono text-sm text-blue-600 hover:underline"
                >
                  {r.convertedBooking.referenceNumber}
                </button>
              } />
              <InfoRow label="Статус бронирования" value={r.convertedBooking.status} />
            </div>
          )}
          {r.convertedPayments && r.convertedPayments.length > 0 && (
            <div className="pt-2 border-t border-purple-200">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Платежи</div>
              {r.convertedPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-4 py-1">
                  <span className="font-mono text-xs text-blue-600">{p.referenceNumber}</span>
                  <span className="text-sm text-gray-700">{p.amount} {p.currency}</span>
                  <span className="text-xs text-gray-500">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
