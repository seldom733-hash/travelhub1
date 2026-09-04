"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import StatusBadge from "@/components/StatusBadge";
import EntityDetailShell from "@/components/EntityDetailShell";
import EntityDetailHeader from "@/components/EntityDetailHeader";
import EntitySectionCard from "@/components/commerce/EntitySectionCard";
import EntityField from "@/components/commerce/EntityField";

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
  travelerCount: number | null;
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
    travelerCount: number | null;
    travelerProgress: "AWAITING_TRAVELERS" | "DATA_FILLED" | "FINAL_CONFIRMED" | null;
    finalConfirmedAt: string | null;
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
    paidAt: string | null;
  }>;
}



function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <EntityField label={label} value={value || "—"} />;
}

function ProgressBadge({ progress, locale }: { progress: "AWAITING_TRAVELERS" | "DATA_FILLED" | "FINAL_CONFIRMED" | null; locale: "ru" | "az" | "en" }) {
  if (!progress) return null;
  const key = progress === "FINAL_CONFIRMED" ? "reqflow.progress.final" : progress === "DATA_FILLED" ? "reqflow.progress.filled" : "reqflow.progress.awaiting";
  const cls = progress === "FINAL_CONFIRMED"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : progress === "DATA_FILLED"
      ? "bg-sky-100 text-sky-700 border-sky-200"
      : "bg-amber-100 text-amber-700 border-amber-200";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{t(key, locale)}</span>;
}

function btn(base: string, tone: string) {
  return `rounded-lg px-3 py-1.5 text-xs font-medium ${base} ${tone}`;
}

const TONES = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
};

export default function RequestDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const canEdit = useCan("order.edit_noncritical");

  const loadRequest = useCallback(async () => {
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
  }, [id]);

  useEffect(() => { void loadRequest(); }, [loadRequest]);

  async function runPost(path: string, body?: Record<string, unknown>) {
    setBusy(path);
    setActionMsg(null);
    try {
      await api.post(path, body ?? {});
      await loadRequest();
    } catch (err: any) {
      setActionMsg(err.message || "Ошибка выполнения действия");
    } finally {
      setBusy(null);
    }
  }

  async function propose() {
    const price = Number(proposePrice);
    if (!proposePrice || !Number.isFinite(price) || price <= 0) {
      setActionMsg("Укажите корректную цену");
      return;
    }
    await runPost(`/requests/${id}/propose-price`, { price });
    setProposeOpen(false);
    setProposePrice("");
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
  const showSupplier = canEdit && ["NEW", "CHECKING", "PRICE_CHANGED"].includes(r.status);
  const showCustomer = canEdit && ["CONFIRMED", "PRICE_CHANGED"].includes(r.status);
  const showConvert = canEdit && r.status === "CUSTOMER_ACCEPTED" && !r.convertedOrderId;
  const progress = r.convertedOrder?.travelerProgress ?? null;

  return (
    <EntityDetailShell
      header={
        <EntityDetailHeader
          breadcrumbs={["TravelHub", t("requests.title", locale) || "Заявки", r.referenceNumber]}
          reference={r.referenceNumber}
          lifecycleStatus={<StatusBadge status={r.status} />}
          actions={
            <Link href="/app/requests" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              ← {t("crm.back_to_list", locale)}
            </Link>
          }
        />
      }
    >

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InfoRow label={t("requests.customer", locale)} value={
          <>
            <span className="font-medium">{r.customerName || "—"}</span>
            {r.customerCode && <span className="ml-2 text-xs text-gray-500">{r.customerCode}</span>}
          </>
        } />
        <InfoRow label={t("requests.product", locale)} value={
          <>
            <span className="font-medium">{r.productName || "—"}</span>
            {r.productCode && <span className="ml-2 text-xs text-gray-500">{r.productCode}</span>}
          </>
        } />
        <InfoRow label={t("requests.supplier", locale)} value={
          <>
            <span className="font-medium">{r.partnerName || "—"}</span>
            {r.partnerCode && <span className="ml-2 text-xs text-gray-500">{r.partnerCode}</span>}
          </>
        } />

        <InfoRow label={t("requests.displayed_price", locale)} value={
          r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : "—"
        } />
        <InfoRow label={t("requests.confirmed_price", locale)} value={
          r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : "—"
        } />
        <InfoRow label="Количество" value={r.quantity} />

        <InfoRow label={t("reqflow.party_size", locale)} value={r.travelerCount ?? "—"} />
        <InfoRow label={t("requests.service_date", locale)} value={
          r.requestedServiceDate ? new Date(r.requestedServiceDate).toLocaleDateString() : "—"
        } />
        <InfoRow label="Дата подтверждения" value={
          r.supplierRespondedAt ? new Date(r.supplierRespondedAt).toLocaleDateString() : "—"
        } />
      </div>

      {(showSupplier || showCustomer || showConvert) && (
        <EntitySectionCard title="Действия">
          {actionMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{actionMsg}</div>
          )}
          {showSupplier && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase">{t("reqflow.supplier_actions", locale)}</div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/confirm-price`)} className={btn("", TONES.success)}>{busy === `/requests/${id}/confirm-price` ? t("reqflow.busy", locale) : t("reqflow.confirm_price", locale)}</button>
                {!proposeOpen ? (
                  <button disabled={busy !== null} onClick={() => setProposeOpen(true)} className={btn("", TONES.primary)}>{t("reqflow.propose_price", locale)}</button>
                ) : (
                  <span className="flex items-center gap-2">
                    <input
                      value={proposePrice}
                      onChange={(e) => setProposePrice(e.target.value)}
                      placeholder="Цена"
                      className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400"
                    />
                    <button onClick={() => void propose()} className={btn("", TONES.primary)}>OK</button>
                    <button onClick={() => { setProposeOpen(false); setProposePrice(""); }} className={btn("", TONES.neutral)}>✕</button>
                  </span>
                )}
                <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/reject`, { reason: "rejected" })} className={btn("", TONES.danger)}>{t("reqflow.reject", locale)}</button>
                <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/unavailable`, { reason: "unavailable" })} className={btn("", TONES.neutral)}>{t("reqflow.unavailable", locale)}</button>
              </div>
            </div>
          )}
          {showCustomer && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase">{t("reqflow.customer_actions", locale)}</div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/customer-accept`)} className={btn("", TONES.success)}>{t("reqflow.customer_accept", locale)}</button>
                <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/customer-decline`)} className={btn("", TONES.danger)}>{t("reqflow.customer_decline", locale)}</button>
              </div>
            </div>
          )}
          {showConvert && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 uppercase">{t("reqflow.converted_hint", locale)}</div>
              <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/convert`)} className={btn("", TONES.primary)}>
                {busy === `/requests/${id}/convert` ? t("reqflow.busy", locale) : t("reqflow.convert_action", locale)}
              </button>
            </div>
          )}
        </EntitySectionCard>
      )}

      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t("reqflow.linked_order", locale)}</h2>
        {r.convertedOrder ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push(`/app/orders/${r.convertedOrder!.id}`)}
                className="font-mono text-sm font-semibold text-blue-700 hover:underline"
              >
                {r.convertedOrder.referenceNumber}
              </button>
              <ProgressBadge progress={r.convertedOrder.travelerProgress ?? null} locale={locale} />
              {r.convertedOrder.travelerCount != null && (
                <span className="text-xs text-gray-500">{r.convertedOrder.travelerCount} {t("reqflow.travelers", locale).toLowerCase()}</span>
              )}
            </div>
            {r.convertedOrder.travelerProgress !== "FINAL_CONFIRMED" && (
              <button
                onClick={() => router.push(`/app/orders/${r.convertedOrder!.id}`)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${TONES.primary}`}
              >
                {t("reqflow.continue_order", locale)} →
              </button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-purple-200">
              <InfoRow label={t("crm.col.created", locale)} value={
                r.convertedOrder.createdAt ? new Date(r.convertedOrder.createdAt).toLocaleString() : "—"
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
                    {p.paidAt && <span className="text-xs text-green-600">Оплачено: {new Date(p.paidAt).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            )}
            {(r as any).convertedRefund && (
              <div className="pt-2 border-t border-purple-200">
                <div className="text-xs font-medium text-gray-500 uppercase mb-2">Возврат</div>
                <div className="flex items-center gap-4 py-1">
                  <span className="font-mono text-xs text-blue-600">{(r as any).convertedRefund.referenceNumber}</span>
                  <span className="text-sm text-gray-700">{(r as any).convertedRefund.amount} {(r as any).convertedRefund.currency}</span>
                  <span className="text-xs text-gray-500">{(r as any).convertedRefund.status}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">{t("reqflow.no_linked_order", locale)}</div>
        )}
      </div>

      <EntitySectionCard title="Поставщик">
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
      </EntitySectionCard>

      <EntitySectionCard title="Клиент">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoRow label="Дедлайн клиента" value={
            r.customerActionDeadline ? new Date(r.customerActionDeadline).toLocaleString() : "—"
          } />
          <InfoRow label={t("reqflow.accepted_at", locale)} value={
            r.customerAcceptedAt ? new Date(r.customerAcceptedAt).toLocaleString() : "—"
          } />
          <InfoRow label="Решение" value={r.customerDecision || "—"} />
        </div>
      </EntitySectionCard>

      {(r.rejectedAt || r.rejectionReason) && (
        <EntitySectionCard title="Отклонение">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow label="Дата" value={
              r.rejectedAt ? new Date(r.rejectedAt).toLocaleString() : "—"
            } />
            <InfoRow label="Кем" value={r.rejectedBy || "—"} />
            <InfoRow label="Причина" value={r.rejectionReason || "—"} />
          </div>
        </EntitySectionCard>
      )}

      {(r as any).timeline && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Хронология</h2>
          <div className="space-y-1">
            {(r as any).timeline.map((item: { label: string; timestamp: string | null }, idx: number) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className="w-60 text-gray-600 shrink-0">{item.label}</span>
                <span className="text-gray-900 font-mono text-xs">
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </EntityDetailShell>
  );
}
