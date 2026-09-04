"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import OperationalNotes from "@/components/OperationalNotes";
import TravelerCollectionPanel from "@/components/order/TravelerCollectionPanel";
import OrderActionBar from "@/components/order/OrderActionBar";
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
  termsAcceptedAt: string | null;
  finalConfirmedAt: string | null;
  travelerDataCompletedAt: string | null;
  fulfilledAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  travelerCount: number | null;
  pinnedRequirements: unknown;
  availableActions?: string[];
  linkedRequest?: { id: string; referenceNumber: string; status: string } | null;
  linkedBooking?: { id: string; referenceNumber: string; status: string; code?: string } | null;
  items?: { id: string; title: string; type: string; quantity: number; price: string; amount: string; currency: string }[];
}

interface HistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
  fields?: Array<{ field: string; oldValue: string | null; newValue: string | null; redacted?: boolean }> | null;
}
interface HistoryPage {
  items: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Имя",
  lastName: "Фамилия",
  birthDate: "Дата рождения",
  citizenship: "Гражданство",
  gender: "Пол",
  passportNumber: "Номер паспорта",
  passportExpiry: "Срок действия паспорта",
};

/** История жизненного цикла: action → человеко-читаемая запись. */
function describeAction(a: string): string {
  const map: Record<string, string> = {
    process: "Принят в работу",
    markWaitingData: "Ожидание данных",
    resumeProcessing: "Обработка возобновлена",
    confirm: "Готов к бронированию",
    send: "Передан в Booking",
    complete: "Исполнен",
    close: "Закрыт",
    cancel: "Отменён",
    problem: "Проблема",
    suspend: "Приостановлен",
    final_confirm: "Финальное подтверждение данных туристов",
    update_traveler_d3: "Изменение данных туриста (сбор данных)",
    update_travelers: "Изменение данных туристов",
    booking_confirmed: "Согласовано с Booking Center",
    booking_rejected: "Отклонено Booking Center",
    update_order_fields: "Изменение полей заказа",
  };
  return map[a] ?? a;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

function renderFieldValue(field: string, value: string | null): string {
  if (value === null) return "—";
  if (/birthDate|passportExpiry/.test(field)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  }
  return value;
}

export default function OrderDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPage>({ items: [], total: 0, page: 0, pageSize: 20 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [finHistory, setFinHistory] = useState<{ payments: Array<{ id: string; code: string; status: string; amount: string; currency: string; paidAt: string | null; failedAt: string | null; cancelledAt: string | null; createdAt: string }>; refunds: Array<{ id: string; code: string; status: string; amount: string; currency: string; reason: string | null; requestedAt: string | null; approvedAt: string | null; processedAt: string | null; failedAt: string | null; createdAt: string }> }>({ payments: [], refunds: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [finHistoryLoading, setFinHistoryLoading] = useState(false);

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

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get<HistoryPage>(`/orders/${id}/history?page=${page}&pageSize=${history.pageSize}`);
      setHistory((prev) => ({
        items: page === 1 ? res.items : [...prev.items, ...res.items],
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      }));
    } catch {
      // история не блокирует страницу
    } finally {
      setHistoryLoading(false);
    }
  }, [id, history.pageSize]);

  const loadFinHistory = useCallback(async () => {
    setFinHistoryLoading(true);
    try {
      const res = await api.get<{ payments: { payments: typeof finHistory.payments; history: unknown[] }; refunds: { refunds: typeof finHistory.refunds; history: unknown[] } }>(`/orders/${id}/financial-history`);
      setFinHistory({ payments: res.payments.payments ?? [], refunds: res.refunds.refunds ?? [] });
    } catch {
      // financial history does not block the page
    } finally {
      setFinHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
    void loadHistory(1);
    void loadFinHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrder, id]);

  const runAction = async (action: string) => {
    if (!order) return;
    setBusyAction(action);
    try {
      await api.patch(`/orders/${order.id}`, { action });
      await loadOrder();
      await loadHistory(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

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

  const immutableTravelers = order.finalConfirmedAt != null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={order.referenceNumber}
        breadcrumbs={["TravelHub", t("orders.title", locale), order.referenceNumber]}
        actions={<Link href="/app/orders" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{order.referenceNumber} <span className="ml-1 font-sans text-slate-400">{order.number}</span></div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
            </div>
          </div>
          {user && (
            <OrderActionBar
              actions={order.availableActions ?? []}
              onRun={(a) => void runAction(a)}
              busyAction={busyAction}
            />
          )}
        </div>
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          {/* D7 — Financial section: authoritative projection with computed fields */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">{t("bookings.financial", locale)}</h3>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.total_amount", locale)}</div><div className="font-bold text-slate-700">{formatPrice(order.amount, order.currency, locale) ?? "—"}</div></div>
              <div className="rounded-lg bg-green-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.paid_amount", locale)}</div><div className="font-medium text-green-700">{formatPrice(order.paidAmount, order.currency, locale) ?? "—"}</div></div>
              <div className="rounded-lg bg-red-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.refunded_amount", locale)}</div><div className="font-medium text-red-700">{formatPrice(order.refundedAmount, order.currency, locale) ?? "—"}</div></div>
              <div className="rounded-lg bg-amber-50 px-4 py-3"><div className="text-slate-400">{t("finance.due_amount", locale)}</div><div className="font-medium text-amber-700">{formatPrice(Math.max(0, Number(order.amount) - Number(order.paidAmount)).toFixed(2), order.currency, locale) ?? "—"}</div></div>
              <div className="rounded-lg bg-blue-50 px-4 py-3"><div className="text-slate-400">{t("finance.refundable_amount", locale)}</div><div className="font-medium text-blue-700">{formatPrice(Math.max(0, Number(order.paidAmount) - Number(order.refundedAmount)).toFixed(2), order.currency, locale) ?? "—"}</div></div>
              <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.detail.payment_status", locale) || "Статус оплаты"}</div><div className="font-medium text-slate-700"><StatusBadge status={order.paymentStatus} /></div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {order.customerId && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-slate-400">Клиент</div>
                <Link href={`/app/crm/customers/${order.customerId}`} className="font-medium text-blue-600 hover:underline">{order.customerDisplayName ?? order.customerId}</Link>
              </div>
            )}
            {order.sellerPartnerId && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-slate-400">Продавец / партнёр</div>
                <Link href={`/app/crm/partners/${order.sellerPartnerId}`} className="font-medium text-blue-600 hover:underline">{order.partnerDisplayName ?? order.sellerPartnerId}</Link>
              </div>
            )}
            {order.linkedRequest && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-slate-400">Заявка (Request)</div>
                <Link href={`/app/requests/${order.linkedRequest.id}`} className="font-medium text-blue-600 hover:underline">{order.linkedRequest.referenceNumber} · {order.linkedRequest.status}</Link>
              </div>
            )}
            {order.linkedBooking && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-slate-400">Связанная бронь</div>
                <Link href={`/app/bookings/${order.linkedBooking.id}`} className="font-medium text-blue-600 hover:underline">{order.linkedBooking.referenceNumber} · {order.linkedBooking.status}</Link>
              </div>
            )}
            {!order.linkedBooking && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-slate-400">Связанная бронь</div>
                <div className="text-slate-500">Бронирование ещё не создано</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Создан</div><div className="font-medium text-slate-700">{formatTs(order.createdAt)}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Приняты условия</div><div className="font-medium text-slate-700">{formatTs(order.termsAcceptedAt)}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Финальное подтверждение туристов</div><div className="font-medium text-slate-700">{formatTs(order.finalConfirmedAt)}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Исполнен</div><div className="font-medium text-slate-700">{formatTs(order.fulfilledAt)}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Закрыт</div><div className="font-medium text-slate-700">{formatTs(order.closedAt)}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">Отменён</div><div className="font-medium text-slate-700">{formatTs(order.cancelledAt)}</div></div>
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

          {/* Туристы: до final-confirm — редактируемо (permissions); после — read-only */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium text-slate-700">{t("d3.travelers_title", locale)}</div>
              {immutableTravelers && <span className="text-xs text-slate-400">зафиксировано после финального подтверждения</span>}
            </div>
            <TravelerCollectionPanel orderId={id} />
          </div>

          {/* Примечания */}
          {user && (
            <OperationalNotes
              entityType="Order"
              entityId={id}
              permissions={user.permissions}
              currentUserId={user.id}
              currentRole={user.role}
            />
          )}

          {/* История изменений (Entity Change Audit view) */}
          <div>
            <div className="mb-2 font-medium text-slate-700">История изменений</div>
            {history.total === 0 && !historyLoading && (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-400">
                История ведётся с момента включения audit-фреймворка; для старых заказов более ранние изменения не реконструируются.
              </div>
            )}
            <div className="space-y-2">
              {history.items.map((h) => (
                <div key={h.id} className="rounded-lg border border-slate-100 bg-white px-4 py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{describeAction(h.action)}</span>
                    <span className="shrink-0 text-slate-400">{formatTs(h.createdAt)}</span>
                  </div>
                  {(h.from || h.to) && (
                    <div className="mt-0.5 text-slate-500">
                      {h.from ? <StatusBadge status={h.from} /> : null}
                      {h.from && h.to ? <span className="mx-1 text-slate-400">→</span> : null}
                      {h.to ? <StatusBadge status={h.to} /> : null}
                    </div>
                  )}
                  {h.comment && <div className="mt-1 text-slate-500">{h.comment}</div>}
                  {Array.isArray(h.fields) && h.fields.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
                      {h.fields.map((f, idx) => {
                        const labelBase = f.field.includes("traveler[") ? f.field.replace(/^traveler\[\d+\]\./, "") : f.field;
                        return (
                          <li key={idx} className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                            <span className="font-medium">{FIELD_LABELS[labelBase] ?? f.field}:</span>
                            <span className="text-slate-400 line-through">{renderFieldValue(labelBase, f.oldValue)}</span>
                            <span>→</span>
                            <span>{renderFieldValue(labelBase, f.newValue)}</span>
                            {f.redacted && <span className="text-amber-600">(маскировано)</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {h.actorName && <div className="mt-1 text-slate-400">Автор: {h.actorName}</div>}
                </div>
              ))}
            </div>
            {history.items.length < history.total && (
              <button
                disabled={historyLoading}
                onClick={() => void loadHistory(history.page + 1)}
                className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {historyLoading ? "…" : `Показать ещё (${history.total - history.items.length})`}
              </button>
            )}
          </div>

          {/* D7 — Financial History: payment + refund events */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">{t("finance.history", locale) || "Финансовая история"}</h3>
            {finHistoryLoading && <div className="text-xs text-slate-400">{t("crm.loading", locale)}</div>}
            {!finHistoryLoading && finHistory.payments.length === 0 && finHistory.refunds.length === 0 && (
              <div className="text-xs text-slate-400">{t("finance.no_history", locale) || "Нет финансовых событий"}</div>
            )}
            <div className="space-y-2">
              {finHistory.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{p.code}</span>
                    <StatusBadge status={p.status} />
                    <span className="text-slate-600">{formatPrice(p.amount, p.currency, locale)}</span>
                  </div>
                  <span className="text-slate-400">{formatTs(p.paidAt ?? p.failedAt ?? p.cancelledAt ?? p.createdAt)}</span>
                </div>
              ))}
              {finHistory.refunds.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{r.code}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-red-600">{formatPrice(r.amount, r.currency, locale)}</span>
                    {r.reason && <span className="text-slate-400">({r.reason})</span>}
                  </div>
                  <span className="text-slate-400">{formatTs(r.processedAt ?? r.approvedAt ?? r.requestedAt ?? r.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
