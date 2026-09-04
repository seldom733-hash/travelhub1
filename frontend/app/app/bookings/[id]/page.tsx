"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EntityDetailShell from "@/components/EntityDetailShell";
import EntitySectionCard from "@/components/commerce/EntitySectionCard";
import OperationalNotes from "@/components/OperationalNotes";
import { useLocale, t, formatPrice } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

interface BookingDetail {
  id: string;
  code: string;
  referenceNumber: string;
  commerceSequence: string | null;
  orderId: string;
  productId: string;
  status: string;
  amount: string;
  currency: string | null;
  serviceDate: string | null;
  serviceTimeType: string;
  serviceTime: string | null;
  serviceEndTime: string | null;
  acquisitionSource: string | null;
  orderCode: string;
  productTitle: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  availableActions?: string[];
  financialSummary?: Record<string, unknown> | null;
  activePayment?: Record<string, unknown> | null;
  passengers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    passportNumber?: string | null;
    dataCompleteness?: string;
  }>;
  supplierConfirmations?: Array<{
    id: string;
    receivedAt: string;
    rawPayload?: string;
  }>;
  reservations?: Array<{
    id: string;
    status: string;
    heldAt?: string;
    confirmedAt?: string;
  }>;
  orderReference?: string | null;
}

interface HistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  prepare: "Запрос готовится к отправке поставщику",
  send: "Запрос отправлен поставщику",
  requestClarification: "Запрошено уточнение у поставщика",
  resume: "Обработка возобновлена",
  confirm: "Бронирование подтверждено",
  reject: "Отклонено поставщиком",
  service: "Услуга началась",
  requestChange: "Запрошено изменение",
  resolveChange: "Изменение обработано",
  requestCancellation: "Запрошена отмена",
  complete: "Бронирование завершено",
  cancel: "Бронирование отменено",
  problem: "Помечено проблемным",
};

const ACTION_CSS: Record<string, string> = {
  send: "bg-blue-600 text-white hover:bg-blue-700",
  confirm: "bg-emerald-600 text-white hover:bg-emerald-700",
  service: "bg-indigo-600 text-white hover:bg-indigo-700",
  complete: "bg-green-700 text-white hover:bg-green-800",
  cancel: "bg-red-600 text-white hover:bg-red-700",
  reject: "bg-red-500 text-white hover:bg-red-600",
  prepare: "bg-sky-600 text-white hover:bg-sky-700",
  resume: "bg-sky-600 text-white hover:bg-sky-700",
  problem: "bg-amber-600 text-white hover:bg-amber-700",
  requestChange: "bg-orange-500 text-white hover:bg-orange-600",
  resolveChange: "bg-emerald-500 text-white hover:bg-emerald-600",
  requestCancellation: "bg-red-400 text-white hover:bg-red-500",
  requestClarification: "bg-slate-500 text-white hover:bg-slate-600",
};

const ACTION_LABELS_SHORT: Record<string, string> = {
  prepare: "Подготовить",
  send: "Отправить",
  requestClarification: "Уточнить",
  resume: "Возобновить",
  confirm: "Подтвердить",
  reject: "Отклонить",
  service: "Начать услугу",
  requestChange: "Запросить изменение",
  resolveChange: "Обработать изменение",
  requestCancellation: "Запросить отмену",
  complete: "Завершить",
  cancel: "Отменить",
  problem: "Проблема",
};

const MILESTONES: Array<{ key: string; label: string; timestamp: string | null }> = [
  { key: "created", label: "Создано", timestamp: "" },
  { key: "requestedAt", label: "Запрос поставщику", timestamp: "" },
  { key: "confirmedAt", label: "Подтверждено поставщиком", timestamp: "" },
  { key: "completedAt", label: "Исполнено", timestamp: "" },
  { key: "cancelledAt", label: "Отменено", timestamp: "" },
  { key: "rejectedAt", label: "Отклонено", timestamp: "" },
];

export default function BookingDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<BookingDetail>(`/bookings/${id}`);
      setBooking(detail);
      // Load history
      try {
        const hist = await api.get<{ items: HistoryRow[] }>(`/bookings/${id}/history`);
        setHistory(hist.items ?? []);
      } catch {
        // History endpoint may not exist yet — non-blocking
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  const executeAction = useCallback(async (action: string) => {
    if (!booking) return;
    setExecuting(action);
    try {
      await api.patch(`/bookings/${booking.id}`, { action });
      await loadBooking();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(null);
    }
  }, [booking, loadBooking]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !booking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/bookings" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleString("ru-RU") : "—";
  const milestones = MILESTONES.map(m => ({
    ...m,
    timestamp: m.key === "created" ? booking.createdAt : (booking as any)[m.key] ?? null,
  }));

  return (
    <EntityDetailShell
      header={
        <>
          <PageHeader
            title={booking.referenceNumber}
            breadcrumbs={["TravelHub", t("bookings.title", locale), booking.referenceNumber]}
            actions={
              <Link href="/app/bookings" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                ← {t("crm.back_to_list", locale)}
              </Link>
            }
          />
          {/* Status + Actions bar */}
          <div className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-mono text-xs text-blue-600">{booking.referenceNumber}</div>
                  <div className="mt-1"><StatusBadge status={booking.status} /></div>
                </div>
              </div>
              {/* Available Actions */}
              <div className="flex flex-wrap gap-2">
                {(booking.availableActions ?? []).map(action => (
                  <button
                    key={action}
                    onClick={() => executeAction(action)}
                    disabled={executing !== null}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${ACTION_CSS[action] ?? "bg-slate-100 text-slate-700 hover:bg-slate-200"} ${executing !== null ? "opacity-50" : ""}`}
                  >
                    {executing === action ? "…" : (ACTION_LABELS_SHORT[action] ?? action)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      }
    >

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <EntitySectionCard title={t("bookings.financial", locale)}>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-slate-400">{t("crm.detail.total_amount", locale)}</div>
                  <div className="font-bold text-slate-700">{formatPrice(booking.amount, booking.currency, locale) ?? "—"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-slate-400">{t("crm.detail.service_date", locale)}</div>
                  <div className="font-medium text-slate-700">{fmtDate(booking.serviceDate)}</div>
                </div>
                {booking.financialSummary && (
                  <>
                    <div className="rounded-lg bg-green-50 px-4 py-3">
                      <div className="text-slate-400">{t("crm.detail.paid_amount", locale)}</div>
                      <div className="font-medium text-green-700">{formatPrice((booking.financialSummary as any).paidAmount, (booking.financialSummary as any).currency, locale) ?? "—"}</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-4 py-3">
                      <div className="text-slate-400">{t("finance.due_amount", locale)}</div>
                      <div className="font-medium text-amber-700">{formatPrice((booking.financialSummary as any).dueAmount, (booking.financialSummary as any).currency, locale) ?? "—"}</div>
                    </div>
                  </>
                )}
                {booking.financialSummary && (
                  <>
                    <div className="rounded-lg bg-red-50 px-4 py-3">
                      <div className="text-slate-400">{t("crm.detail.refunded_amount", locale)}</div>
                      <div className="font-medium text-red-700">{formatPrice((booking.financialSummary as any).refundedAmount, (booking.financialSummary as any).currency, locale) ?? "—"}</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-4 py-3">
                      <div className="text-slate-400">{t("finance.refundable_amount", locale)}</div>
                      <div className="font-medium text-blue-700">{formatPrice((booking.financialSummary as any).refundableAmount, (booking.financialSummary as any).currency, locale) ?? "—"}</div>
                    </div>
                  </>
                )}
                {booking.financialSummary && (
                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                    <div className="text-slate-400">{t("crm.detail.payment_status", locale) || "Статус оплаты"}</div>
                    <div className="font-medium text-slate-700"><StatusBadge status={(booking.financialSummary as any).paymentStatus} /></div>
                  </div>
                )}
              </div>
              {booking.activePayment && (
                <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{t("finance.payment_method", locale)}: {(booking.activePayment as any).paymentMethod || "—"}</span>
                  <span>{t("crm.detail.payment_status", locale)}: <StatusBadge status={(booking.activePayment as any).status} /></span>
                </div>
              )}
            </EntitySectionCard>

            <EntitySectionCard title={t("bookings.service", locale) || "Услуга"}>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{t("crm.col.order", locale)}:</span>
                  <Link href={`/app/orders/${booking.orderId}`} className="font-medium text-blue-600 hover:underline">
                    {booking.orderReference ?? booking.orderCode ?? booking.orderId.slice(0, 8)}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{t("crm.col.service", locale)}:</span>
                  <Link href={`/app/catalog/${booking.productId}`} className="font-medium text-blue-600 hover:underline">
                    {booking.productTitle ?? booking.productId.slice(0, 8)}
                  </Link>
                </div>
                {booking.acquisitionSource && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Канал:</span>
                    <span className="font-medium text-slate-700">{booking.acquisitionSource}</span>
                  </div>
                )}
              </div>
            </EntitySectionCard>

            {booking.passengers && booking.passengers.length > 0 && (
              <EntitySectionCard title={t("bookings.passengers", locale) || "Пассажиры"}>
                <div className="space-y-2">
                  {booking.passengers.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2 text-xs">
                      <span className="font-medium text-slate-700">{i + 1}.</span>
                      <span className="text-slate-700">{p.firstName} {p.lastName}</span>
                      {p.passportNumber && <span className="text-slate-400">••••{p.passportNumber.slice(-4)}</span>}
                      <span className="ml-auto text-slate-400">{p.dataCompleteness}</span>
                    </div>
                  ))}
                </div>
              </EntitySectionCard>
            )}

            {booking.supplierConfirmations && booking.supplierConfirmations.length > 0 && (
              <EntitySectionCard title="Подтверждения поставщика">
                <div className="space-y-2">
                  {booking.supplierConfirmations.map(sc => (
                    <div key={sc.id} className="rounded-lg bg-slate-50 px-4 py-2 text-xs">
                      <div className="text-slate-500">{fmtDate(sc.receivedAt)}</div>
                      {sc.rawPayload && <div className="mt-1 text-slate-400 truncate">{sc.rawPayload.slice(0, 120)}</div>}
                    </div>
                  ))}
                </div>
              </EntitySectionCard>
            )}

            {/* Notes */}
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

          {/* Sidebar: timeline + metadata */}
          <div className="space-y-4">
            <EntitySectionCard title={t("bookings.timeline", locale) || "Хронология"}>
              <div className="space-y-3">
                {milestones.filter(m => m.timestamp).map(m => (
                  <div key={m.key} className="flex items-start gap-3">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-700">{m.label}</div>
                      <div className="text-[11px] text-slate-400">{fmtDate(m.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </EntitySectionCard>

            <EntitySectionCard title={t("bookings.details", locale) || "Детали"}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Код</span>
                  <span className="font-mono text-slate-700">{booking.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Создан</span>
                  <span className="text-slate-700">{fmtDate(booking.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Обновлён</span>
                  <span className="text-slate-700">{fmtDate(booking.updatedAt)}</span>
                </div>
                {booking.commerceSequence && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sequence</span>
                    <span className="font-mono text-slate-700">{booking.commerceSequence}</span>
                  </div>
                )}
              </div>
            </EntitySectionCard>

            {history.length > 0 && (
              <EntitySectionCard title={t("bookings.change_history", locale) || "История изменений"}>
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="text-xs">
                      <div className="font-medium text-slate-700">
                        {ACTION_LABELS[h.action] ?? h.action}
                      </div>
                      {h.from && h.to && (
                        <div className="text-slate-400">{h.from} → {h.to}</div>
                      )}
                      {h.comment && <div className="text-slate-400">{h.comment}</div>}
                      <div className="text-[11px] text-slate-300">{fmtDate(h.createdAt)} · {h.actorName ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </EntitySectionCard>
            )}
          </div>
        </div>
    </EntityDetailShell>
  );
}
