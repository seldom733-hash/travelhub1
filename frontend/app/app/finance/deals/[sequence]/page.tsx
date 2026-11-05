"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/i18n";
import { api } from "@/lib/api";
import { dealsApi, type DealRow } from "@/lib/deals-api";
import { documentsApi, type DocumentListItem } from "@/lib/documents-api";
import CreatePaymentForm from "@/components/finance/CreatePaymentForm";
import CreateSupplierPaymentForm from "@/components/finance/CreateSupplierPaymentForm";
import type { WhatsAppConversationRow } from "@/lib/whatsapp";
import OperationalNotes from "@/components/OperationalNotes";
import { useCurrentUser } from "@/lib/use-user";

const TABS = [
  ["overview", "Общая информация"], ["services", "Услуги и расчёты"], ["client", "Платежи клиента"],
  ["supplier", "Расчёты с поставщиком"], ["penalties", "Штрафы и возвраты"], ["docs", "Документы"],
  ["communications", "Коммуникации"], ["history", "История изменений"],
] as const;
type Tab = (typeof TABS)[number][0];

function money(value: string | null | undefined, currency: string) { return formatPrice(value ?? "0", currency, "ru") ?? value ?? "0"; }
function statusRu(status: string) {
  const map: Record<string, string> = { NEW: "Новая", CHECKING: "Проверка", WAITING_FOR_DATA: "Ждём данные", PROBLEM: "Проблема", SUSPENDED: "Приостановлен", READY_TO_CLOSE: "Готов к закрытию", PARTIALLY_FULFILLED: "Частично исполнен", CONFIRMED: "Подтверждён", PRICE_CHANGED: "Цена изменена", CUSTOMER_ACCEPTED: "Принят клиентом", CONVERTED: "Конвертирован в заказ", REJECTED: "Отклонён", UNAVAILABLE: "Недоступен", EXPIRED: "Истёк", CANCELLED_BY_CUSTOMER: "Отменён клиентом", SUPPLIER_TIMEOUT: "Поставщик не ответил", CUSTOMER_PAYMENT_TIMEOUT: "Клиент не оплатил", IN_PROCESSING: "В работе", READY_FOR_BOOKING: "Готова к брони", WAITING_FOR_FIRST_PAYMENT: "Ожидаем первую оплату", SENT_TO_BOOKING: "На бронировании", FULFILLED: "Завершён", COMPLETED: "Завершён", CANCELLED: "Отменён", PENDING: "Ожидает", CAPTURED: "Получен", PAID: "Оплачен", REQUESTED: "Запрошен", APPROVED: "Подтверждён", PROCESSED: "Исполнен", PLANNED: "План", DUE: "К оплате", OVERDUE: "Просрочен", REFUNDED: "Возвращён", PARTIALLY_REFUNDED: "Частичный возврат", FAILED: "Ошибка" };
  return map[status] ?? status;
}
function statusTone(status: string) {
  if (/CANCEL|REJECT|FAIL/.test(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (/PAID|CONFIRM|COMPLETED|FULFILLED/.test(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/PARTIAL|PENDING|SENT/.test(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#d9e6e1] bg-[#f2faf7] text-[#0f6b5f]";
}
const ACTION_LABELS: Record<string, string> = {
  process: "Принять в работу", markWaitingData: "Ждём данные", resumeProcessing: "Вернуть в работу",
  confirm: "Подтвердить заказ", waitFirstPayment: "Ожидаем оплату", send: "Отправить на бронь", complete: "Завершить",
  close: "Закрыть", cancel: "Отменить заказ", problem: "Проблема", suspend: "Приостановить",
  returnToRequest: "Вернуть в заявку",
};
const REQUEST_ACTION_LABELS: Record<string, string> = {
  confirmPrice: "Подтвердить цену", proposePrice: "Изменить цену", reject: "Отклонить заявку",
  unavailable: "Нет в наличии", customerAccept: "Клиент принял", customerDecline: "Клиент отказался",
  convert: "Конвертировать в заказ",
};
const BOOKING_ACTION_LABELS: Record<string, string> = {
  prepare: "Подготовить запрос", send: "Отправить поставщику", requestClarification: "Запросить уточнение",
  resume: "Вернуть в работу", confirm: "Подтвердить бронь", reject: "Отклонить бронь",
  service: "Начать обслуживание", requestChange: "Запросить изменение", resolveChange: "Согласовать изменение",
  requestCancellation: "Запросить отмену", complete: "Завершить бронь", cancel: "Отменить бронь",
  problem: "Проблема", returnToOrder: "Вернуть в заказ",
};

export default function DealDetailPage() {
  const user = useCurrentUser();
  const params = useParams<{ sequence: string }>();
  const sequence = params.sequence;
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [requestActions, setRequestActions] = useState<Record<string, boolean>>({});
  const [bookingActions, setBookingActions] = useState<string[]>([]);
  const [requestTravelers, setRequestTravelers] = useState<Array<{ id: string; position: number; firstName: string; lastName: string; birthDate: string }>>([]);
  const [orderTravelers, setOrderTravelers] = useState<Array<{ id: string; firstName: string; lastName: string; birthDate: string | null; citizenship: string | null; passportSeries: string | null; passportNumber: string | null; passportExpiry: string | null; dataCompleteness: string }>>([]);
  const [orderFinalConfirmedAt, setOrderFinalConfirmedAt] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplierPaymentOpen, setSupplierPaymentOpen] = useState(false);
  const [editingClientPayment, setEditingClientPayment] = useState<any | null>(null);
  const [editingPayout, setEditingPayout] = useState<any | null>(null);
  const [editingRefund, setEditingRefund] = useState<any | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    dealsApi.bySequence(sequence).then((row) => { if (alive) setDeal(row); }).catch((e) => { if (alive) setError((e as Error).message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sequence, reload]);

  useEffect(() => {
    if (!deal?.orderId) { setAvailableActions([]); return; }
    let alive = true;
    api.get<{ availableActions?: string[]; travelers?: typeof orderTravelers; finalConfirmedAt?: string | null }>(`/orders/${deal.orderId}`)
      .then((order) => { if (alive) { setAvailableActions(order.availableActions ?? []); setOrderTravelers(order.travelers ?? []); setOrderFinalConfirmedAt(order.finalConfirmedAt ?? null); } })
      .catch(() => { if (alive) { setAvailableActions([]); setOrderTravelers([]); setOrderFinalConfirmedAt(null); } });
    return () => { alive = false; };
  }, [deal?.orderId, reload]);

  useEffect(() => {
    if (!deal?.requestId) { setRequestActions({}); return; }
    let alive = true;
    api.get<{ availableActions?: Record<string, boolean>; travelers?: typeof requestTravelers }>(`/requests/${deal.requestId}`)
      .then((request) => { if (alive) { setRequestActions(request.availableActions ?? {}); setRequestTravelers(request.travelers ?? []); } })
      .catch(() => { if (alive) { setRequestActions({}); setRequestTravelers([]); } });
    return () => { alive = false; };
  }, [deal?.requestId, reload]);

  useEffect(() => {
    if (!deal?.bookingId) { setBookingActions([]); return; }
    let alive = true;
    api.get<{ availableActions?: string[] }>(`/bookings/${deal.bookingId}`)
      .then((booking) => { if (alive) setBookingActions(booking.availableActions ?? []); })
      .catch(() => { if (alive) setBookingActions([]); });
    return () => { alive = false; };
  }, [deal?.bookingId, reload]);

  async function runAction(action: string) {
    if (!deal?.orderId) return;
    setActionBusy(action); setActionError("");
    try {
      await api.patch(`/orders/${deal.orderId}`, { action });
      setReload((v) => v + 1);
    } catch (e) { setActionError((e as Error).message); } finally { setActionBusy(""); }
  }

  async function finalConfirm() {
    if (!deal?.orderId) return;
    setActionBusy("final-confirm"); setActionError("");
    try {
      await api.post(`/orders/${deal.orderId}/final-confirm`, {});
      setReload((v) => v + 1);
    } catch (e) { setActionError((e as Error).message); } finally { setActionBusy(""); }
  }

  async function runRequestAction(action: string) {
    if (!deal?.requestId) return;
    setActionBusy(action); setActionError("");
    try {
      const body = action === "proposePrice" ? { price: Number(window.prompt("Новая цена") ?? 0) } : {};
      await api.post(`/requests/${deal.requestId}/${action === "proposePrice" ? "propose-price" : action === "confirmPrice" ? "confirm-price" : action === "customerAccept" ? "customer-accept" : action === "customerDecline" ? "customer-decline" : action === "convert" ? "convert" : action}`, body);
      setReload((v) => v + 1);
    } catch (e) { setActionError((e as Error).message); } finally { setActionBusy(""); }
  }

  async function runBookingAction(action: string) {
    if (!deal?.bookingId) return;
    setActionBusy(action); setActionError("");
    try {
      await api.patch(`/bookings/${deal.bookingId}`, { action });
      setReload((v) => v + 1);
    } catch (e) { setActionError((e as Error).message); } finally { setActionBusy(""); }
  }

  if (loading) return <div className="p-8 text-sm text-[#667085]">Загрузка сделки…</div>;
  if (error || !deal) return <div className="p-8 text-sm text-rose-600">Сделка не найдена: {error}</div>;

  const cancelled = /CANCEL|REJECT/.test(deal.status);
  const financialLocked = ["CLOSED", "CANCELLED"].includes(deal.status);
  const clientPayable = Boolean(deal.orderId) && !financialLocked && Number(deal.clientDebt) > 0;
  const supplierPayable = Boolean(deal.orderId) && !financialLocked && Number(deal.supplierDebt) > 0;
  const refundable = Number(deal.clientReceived) > 0 && !cancelled;
  const readOnly = user?.role === "SALES_MANAGER" && deal.managerId !== user.id;
  const effectiveRequestActions = readOnly ? {} : requestActions;
  const effectiveBookingActions = readOnly ? [] : bookingActions;
  const effectiveOrderActions = readOnly ? [] : availableActions;
  const stage = deal.stage === "BOOKING" ? 2 : deal.stage === "ORDER" ? 1 : 0;
  const dateFrom = deal.trip.dateFrom ? new Date(deal.trip.dateFrom).toLocaleDateString("ru-RU") : deal.serviceDate ? new Date(deal.serviceDate).toLocaleDateString("ru-RU") : "—";
  const dateTo = deal.trip.dateTo ? new Date(deal.trip.dateTo).toLocaleDateString("ru-RU") : "—";

  return (
    <div className="min-h-screen bg-[#f6f4ef] pb-8 font-sans">
      <div className="border-b border-[#e5e2da] bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] text-[#98a2b3]"><Link href="/app/finance/deals" className="hover:text-[#0f6b5f]">Финансы</Link><span>/</span><Link href="/app/finance/deals" className="hover:text-[#0f6b5f]">Реестр продаж и взаиморасчётов</Link><span>/</span><span className="text-[#667085]">Сделка № {deal.sequence}</span></div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/app/finance/deals" className="text-lg text-[#667085]">‹</Link>
              <h1 style={{ fontFamily: "var(--font-body), Manrope, sans-serif" }} className="font-sans text-[24px] font-semibold tracking-tight text-[#101828]">Сделка № {deal.sequence}</h1>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Стадия: {deal.stageLabel}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(deal.status)}`}>{statusRu(deal.status)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/finance/deals" className="rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-medium text-[#344054]">‹ К списку</Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">Заявка · {deal.requestCode}</span>
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">Заказ · {deal.orderCode ?? "не создан"}</span>
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">Бронь · {deal.bookingCode ?? "не создана"}</span>
          <span className="ml-auto">Создано: {new Date(deal.createdAt).toLocaleString("ru-RU")}</span>
          <span>Менеджер: {deal.manager ?? "—"}</span>
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {readOnly && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Карточка другого менеджера — только просмотр. Действия и редактирование недоступны.</div>}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <FlowStep title="Заявка" code={deal.requestCode} state={stage === 0 ? "current" : "done"} detail={new Date(deal.createdAt).toLocaleString("ru-RU")} />
              <Arrow />
              <FlowStep title={stage === 1 ? "Заказ (текущий этап)" : "Заказ"} code={deal.orderCode} state={stage === 1 ? "current" : stage > 1 ? "done" : "todo"} detail={deal.orderCode ? `${money(deal.salesAmount, deal.currency)} · ${statusRu(deal.status)}` : "Не создан"} />
              <Arrow />
              <FlowStep title="Бронь" code={deal.bookingCode} state={stage === 2 ? "current" : "todo"} detail={deal.bookingCode ? statusRu(deal.status) : "Не создана"} />
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard title="Клиент" icon="👤" action={<button type="button" onClick={() => setEditOpen(true)} className="text-[#0f6b5f]" title="Редактировать">✎</button>}>
                <div className="text-sm font-semibold text-[#101828]">{deal.customerName}</div>
                <div className="mt-1 text-[11px] text-[#667085]">{deal.customerPhone ?? "—"}</div>
                <div className="text-[11px] text-[#667085]">{deal.customerEmail ?? "—"}</div>
              </InfoCard>
              <InfoCard title="Параметры поездки" icon="▦" action={<button type="button" onClick={() => setEditOpen(true)} className="text-[#0f6b5f]" title="Редактировать">✎</button>}>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Страна</span><span className="font-medium text-[#344054]">{deal.trip.country ?? "—"}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Даты</span><span className="font-medium text-[#344054]">{dateFrom} — {dateTo}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Туристы</span><span className="font-medium text-[#344054]">{deal.travelerCount ?? "—"} чел. ({deal.trip.adults ?? "—"} взр., {deal.trip.children ?? 0} дет.)</span></div>
              </InfoCard>
              <InfoCard title="Источник / канал" icon="◈" action={<span className="text-slate-400">✎</span>}>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Канал</span><span className="max-w-[55%] text-right font-medium text-[#344054]">{deal.channel}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Менеджер</span><span className="font-medium text-[#344054]">{deal.manager ?? "—"}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#98a2b3]">Поставщик</span><span className="font-medium text-[#344054]">{deal.supplierCode ?? "—"}</span></div>
              </InfoCard>
              <div className="rounded-xl border border-[#cfe5dc] bg-[#eef8f3] p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#0f6b5f]"><span>◔</span>Финансовый результат</div>
                <FinRow label="Сумма продажи" value={money(deal.salesAmount, deal.currency)} />
                <FinRow label="Себестоимость" value={money(deal.costAmount, deal.currency)} />
                <FinRow label="Ожидаемый доход" value={money(deal.expectedIncome, deal.currency)} tone={Number(deal.expectedIncome) < 0 ? "text-rose-700" : "text-emerald-700"} />
                <div className="mt-2 flex items-center justify-between rounded-lg bg-white/70 px-2 py-1.5"><span className="text-[10px] text-[#667085]">Текущий доход</span><span className={`font-mono text-sm font-semibold ${Number(deal.currentIncome) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(deal.currentIncome, deal.currency)}</span></div>
              </div>
            </div>

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <Header title={`Услуги в заказе (${deal.services.length})`} right={<><button type="button" onClick={() => setAddOpen(true)} disabled={!deal.orderId} title={deal.orderId ? "Добавить услугу" : "Сначала создайте заказ"} className="rounded-lg border border-[#e5e2da] px-2 py-1 text-[11px] text-[#344054] disabled:text-[#98a2b3]">+ Добавить услугу</button><span className="text-slate-400">•••</span></>} />
              <div className="space-y-2 p-3">
                {deal.services.map((service) => (
                  <div key={service.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2">
                    <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#dcebe4] to-[#b9d8ce] text-lg">🏨</div>
                    <div className="min-w-[220px] flex-1"><div className="text-xs font-semibold text-[#101828]">{service.title}</div><div className="text-[10px] text-[#667085]">{deal.trip.country ?? "—"}{deal.trip.dateFrom ? ` · ${dateFrom} — ${dateTo}` : ""} · {deal.travelerCount ?? "—"} чел.</div></div>
                    <div className="grid grid-cols-3 gap-4 text-right text-[10px]"><div><div className="text-[#98a2b3]">Цена клиента</div><div className="font-mono text-xs font-semibold text-[#101828]">{money(service.clientPrice, deal.currency)}</div></div><div><div className="text-[#98a2b3]">Цена поставщика</div><div className="font-mono text-xs font-semibold text-[#344054]">{money(service.cost, deal.currency)}</div></div><div><div className="text-[#98a2b3]">Доход</div><div className="font-mono text-xs font-semibold text-emerald-700">{money(service.income, deal.currency)}</div></div></div>
                  </div>
                ))}
              </div>
            </section>

            <TravelersTab deal={deal} requestTravelers={requestTravelers} orderTravelers={orderTravelers} readOnly={readOnly} onRefresh={() => setReload((v) => v + 1)} />

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <Header title="Финансовая сводка по сделке" right={<span className="text-slate-400">⌃</span>} />
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-6">
                {[["Сумма продажи", deal.salesAmount], ["Себестоимость", deal.costAmount], ["Получено от клиента", deal.clientReceived], ["Долг клиента", deal.clientDebt], ["Оплачено поставщику", deal.supplierPaid], ["Долг перед поставщиком", deal.supplierDebt], ["Возврат клиента", deal.clientRefunded], ["Возврат от поставщика", deal.supplierRefunded], ["Штрафы клиента", deal.clientPenalty], ["Штрафы от поставщика", deal.supplierPenalty], ["Ожидаемый доход", deal.expectedIncome], ["Текущий доход", deal.currentIncome]].map(([label, value]) => <Mini key={label} label={label} value={money(value, deal.currency)} />)}
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Платежи клиента" action={clientPayable ? <button type="button" onClick={() => setPaymentOpen(true)} className="text-[11px] font-semibold text-[#0f6b5f]">+ Добавить платёж</button> : <span className="text-[10px] text-[#98a2b3]">{!deal.orderId ? "Заказ не создан" : financialLocked ? "Заказ закрыт" : "Долг закрыт"}</span>} totals={[["Всего получено", money(deal.clientReceived, deal.currency)], ["Возвращено", money(deal.clientRefunded, deal.currency)], ["Остаток к оплате", money(deal.clientDebt, deal.currency)]]}>
                {deal.payments.length + deal.refunds.length === 0 ? <Empty text="Платежей клиента нет" /> : <SimpleRows rows={[...deal.payments.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.method ?? "Оплата", statusRu(p.status), p.status !== "REFUNDED" ? <button type="button" onClick={() => setEditingClientPayment(p)} className="text-[10px] font-semibold text-[#0f6b5f]">✎</button> : null]), ...deal.refunds.map((r) => [new Date(r.date).toLocaleDateString("ru-RU"), `−${money(r.amount, r.currency)}`, "Возврат клиенту", statusRu(r.status), r.status === "REQUESTED" || r.status === "APPROVED" ? <button type="button" onClick={() => setEditingRefund(r)} className="text-[10px] font-semibold text-[#0f6b5f]">✎</button> : null])]} head={["Дата", "Поставщик", "Сумма", "Тип", "Статус", ""]} />}
              </Panel>
              <Panel title="Расчёты с поставщиком" action={supplierPayable ? <button type="button" onClick={() => setSupplierPaymentOpen(true)} className="text-[11px] font-semibold text-[#0f6b5f]">+ Добавить платёж</button> : <span className="text-[10px] text-[#98a2b3]">{!deal.orderId ? "Заказ не создан" : financialLocked ? "Заказ закрыт" : "Долг закрыт"}</span>} totals={[["Всего оплачено", money(deal.supplierPaid, deal.currency)], ["Возврат от поставщика", money(deal.supplierRefunded, deal.currency)], ["Остаток поставщику", money(deal.supplierDebt, deal.currency)]]}>
                {deal.payouts.length === 0 ? <Empty text="Расчётов с поставщиком нет" /> : <SimpleRows rows={deal.payouts.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), p.supplierName ?? p.supplierCode ?? "—", money(p.amount, p.currency), p.direction === "INCOMING" ? "Возврат" : "Оплата поставщику", statusRu(p.status), p.direction !== "INCOMING" && p.status !== "CANCELLED" ? <button type="button" onClick={() => setEditingPayout(p)} className="text-[10px] font-semibold text-[#0f6b5f]">✎</button> : null])} head={["Дата", "Поставщик", "Сумма", "Тип", "Статус", ""]} />}
              </Panel>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <PaymentSchedule sequence={deal.sequence} currency={deal.currency} />
              <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title="Штрафы и возвраты" right={<span className="text-slate-400">⌃</span>} /><div className="divide-y divide-[#f0eee8] px-4 text-[11px]"><Line label="Штрафы клиента" value={money(deal.clientPenalty, deal.currency)} /><Line label="Штрафы поставщика" value={money(deal.supplierPenalty, deal.currency)} /><Line label="Возврат клиента" value={money(deal.clientRefunded, deal.currency)} /><Line label="Возврат от поставщика" value={money(deal.supplierRefunded, deal.currency)} /></div></section>
            </div>

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-[#f0eee8] px-2 pt-2">{TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`border-b-2 px-2 py-2 text-[11px] font-medium ${tab === key ? "border-[#0f6b5f] text-[#0f6b5f]" : "border-transparent text-[#667085]"}`}>{label}</button>)}</div>
              <div className="p-4 text-xs">{tab === "overview" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Info label="Общий номер" value={deal.sequence} /><Info label="Заявка" value={deal.requestCode} /><Info label="Заказ" value={deal.orderCode ?? "—"} /><Info label="Бронь" value={deal.bookingCode ?? "—"} /><Info label="Стадия" value={deal.stageLabel} /><Info label="Статус" value={statusRu(deal.status)} /><Info label="Дата услуги" value={dateFrom} /><Info label="Сумма продажи" value={money(deal.salesAmount, deal.currency)} /><Info label="Себестоимость" value={money(deal.costAmount, deal.currency)} /><Info label="Фин. статус" value={deal.financialStatus} /><Info label="Оплата клиента" value={deal.paymentStatus} /><Info label="Оплата поставщику" value={deal.supplierPaymentStatus} /></div>}{tab === "services" && <div className="space-y-2">{deal.services.map((s) => <div key={s.id} className="flex justify-between border-b border-[#f0eee8] py-2"><span>{s.title}</span><span className="font-mono">{money(s.clientPrice, deal.currency)} / {money(s.cost, deal.currency)}</span></div>)}</div>}{tab === "client" && <SimpleRows rows={deal.payments.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.method ?? "Оплата", statusRu(p.status)])} head={["Дата", "Сумма", "Тип", "Статус"]} />}{tab === "supplier" && <SimpleRows rows={deal.payouts.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.direction === "INCOMING" ? "Возврат" : "Оплата", statusRu(p.status)])} head={["Дата", "Сумма", "Тип", "Статус"]} />}{tab === "penalties" && <div className="space-y-2"><Info label="Штраф клиента" value={money(deal.clientPenalty, deal.currency)} /><Info label="Штраф поставщика" value={money(deal.supplierPenalty, deal.currency)} /><Info label="Возвращено клиенту" value={money(deal.clientRefunded, deal.currency)} /><Info label="Возврат поставщика" value={money(deal.supplierRefunded, deal.currency)} /></div>}{tab === "docs" && <DocumentsTab deal={deal} />}{tab === "communications" && <CommunicationsTab deal={deal} />}{tab === "history" && <HistoryTab deal={deal} />}</div>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><span>✎</span>Статус и действия</div><div className="flex items-center justify-between rounded-lg border border-[#e5e2da] px-2 py-2 text-xs"><span className="text-[#667085]">{deal.stage === "REQUEST" ? "Статус заявки" : deal.stage === "BOOKING" ? "Статус брони" : "Статус заказа"}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(deal.status)}`}>{statusRu(deal.status)}</span></div>{actionError && <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700">{actionError}</div>}<div className="mt-2 space-y-1.5">{deal.orderId && ["IN_PROCESSING", "WAITING_FOR_DATA"].includes(deal.status) && orderTravelers.length > 0 && orderTravelers.every((traveler) => traveler.dataCompleteness === "COMPLETE" && Boolean(traveler.citizenship) && Boolean(traveler.passportSeries) && Boolean(traveler.passportNumber)) && !orderFinalConfirmedAt && !readOnly && <button type="button" disabled={Boolean(actionBusy)} onClick={() => void finalConfirm()} className="mb-2 block w-full rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{actionBusy === "final-confirm" ? "Подтверждение…" : "Подтвердить данные туристов"}</button>}{Object.entries(effectiveRequestActions).filter(([, enabled]) => enabled).length > 0 && <div className="mb-2 space-y-1 rounded-lg border border-[#e5e2da] p-2"><div className="text-[9px] font-semibold uppercase tracking-wide text-[#98a2b3]">Заявка</div>{Object.entries(effectiveRequestActions).filter(([, enabled]) => enabled).map(([action]) => <button key={action} type="button" disabled={Boolean(actionBusy)} onClick={() => void runRequestAction(action)} className="block w-full rounded-lg border border-[#e5e2da] px-3 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-50">{actionBusy === action ? "Выполняется…" : REQUEST_ACTION_LABELS[action] ?? action}</button>)}</div>}{effectiveBookingActions.length > 0 && <div className="mb-2 space-y-1 rounded-lg border border-[#e5e2da] p-2"><div className="text-[9px] font-semibold uppercase tracking-wide text-[#98a2b3]">Бронь</div>{effectiveBookingActions.map((action) => <button key={action} type="button" disabled={Boolean(actionBusy)} onClick={() => void runBookingAction(action)} className="block w-full rounded-lg border border-[#e5e2da] px-3 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-50">{actionBusy === action ? "Выполняется…" : BOOKING_ACTION_LABELS[action] ?? action}</button>)}</div>}{effectiveOrderActions.map((action, index) => <button key={action} type="button" disabled={Boolean(actionBusy)} onClick={() => void runAction(action)} className={`block w-full rounded-lg px-3 py-2 text-center text-xs font-semibold disabled:opacity-50 ${/cancel|problem|suspend/.test(action) ? "border border-rose-200 text-rose-700" : index === 0 ? "bg-[#0f6b5f] text-white" : "border border-[#e5e2da] text-[#344054]"}`}>{actionBusy === action ? "Выполняется…" : ACTION_LABELS[action] ?? action}</button>)}{deal.status === "CANCELLED" && Number(deal.supplierRefundDue) > 0 && <button type="button" onClick={() => setWriteOffOpen(true)} className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Признать убытком и закрыть</button>}</div></div>
            <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">История этапов</div><Timeline title="Заявка создана" code={deal.requestCode} date={new Date(deal.createdAt).toLocaleString("ru-RU")} tone="done" /><Timeline title="Заказ создан" code={deal.orderCode} date={deal.orderCode ? "Текущий этап" : "Ожидает"} tone={deal.orderCode ? "current" : "todo"} /><Timeline title="Бронь" code={deal.bookingCode ?? "ожидает создания"} date={deal.bookingCode ? "Создана" : "Ожидает"} tone={deal.bookingCode ? "done" : "todo"} /></div>
            {user && !readOnly ? <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><OperationalNotes entityType={deal.orderId ? "Order" : "Request"} entityId={deal.orderId ?? deal.requestId} permissions={user.permissions} currentUserId={user.id} currentRole={user.role} /></div> : null}
            <ClientChats deal={deal} />
          </aside>
        </div>
      </div>
      {refundOpen && deal.orderId && <CreatePaymentForm open defaultDirection="EXPENSE" onClose={() => setRefundOpen(false)} presetOrder={{ id: deal.orderId, label: deal.orderCode ?? deal.sequence, amount: deal.clientReceived, currency: deal.currency }} onCreated={() => { setRefundOpen(false); setReload((v) => v + 1); }} />}
      {paymentOpen && deal.orderId && <CreatePaymentForm open onClose={() => setPaymentOpen(false)} presetOrder={{ id: deal.orderId, label: deal.orderCode ?? deal.sequence, amount: deal.clientDebt, currency: deal.currency }} onCreated={() => { setPaymentOpen(false); setReload((v) => v + 1); }} />}
      {supplierPaymentOpen && deal.orderId && <CreateSupplierPaymentForm orderId={deal.orderId} orderCode={deal.orderCode ?? deal.sequence} bookingId={deal.bookingId ?? undefined} bookingCode={deal.bookingCode ?? undefined} fallbackCost={deal.supplierDebt} onClose={() => setSupplierPaymentOpen(false)} onCreated={() => { setSupplierPaymentOpen(false); setReload((v) => v + 1); }} />}
      {editingClientPayment && <EditClientPaymentModal payment={editingClientPayment} onClose={() => setEditingClientPayment(null)} onSaved={() => { setEditingClientPayment(null); setReload((v) => v + 1); }} />}
      {editingRefund && <EditRefundModal refund={editingRefund} onClose={() => setEditingRefund(null)} onSaved={() => { setEditingRefund(null); setReload((v) => v + 1); }} />}
      {editingPayout && <EditSupplierPayoutModal payout={editingPayout} onClose={() => setEditingPayout(null)} onSaved={() => { setEditingPayout(null); setReload((v) => v + 1); }} />}
      {editOpen && <DealEditModal deal={deal} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); setReload((v) => v + 1); }} />}
      {writeOffOpen && <WriteOffModal deal={deal} onClose={() => setWriteOffOpen(false)} onSaved={() => { setWriteOffOpen(false); setReload((v) => v + 1); }} />}
      {addOpen && <AddServiceModal deal={deal} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); setReload((v) => v + 1); }} />}
    </div>
  );
}

function Header({ title, right }: { title: string; right?: React.ReactNode }) { return <div className="flex items-center justify-between border-b border-[#f0eee8] px-3 py-2.5"><h3 className="text-xs font-semibold text-[#101828]">{title}</h3><div className="flex items-center gap-2">{right}</div></div>; }
function InfoCard({ title, icon, action, children }: { title: string; icon: string; action?: React.ReactNode; children: React.ReactNode }) { return <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><span className="flex items-center gap-1.5"><span className="text-[#0f6b5f]">{icon}</span>{title}</span>{action}</div>{children}</div>; }
function FlowStep({ title, code, state, detail }: { title: string; code: string | null; state: "done" | "current" | "todo"; detail: string }) { return <div className={`flex-1 rounded-xl border p-3 ${state === "current" ? "border-[#0f6b5f] bg-[#eef8f3]" : state === "done" ? "border-emerald-200 bg-emerald-50" : "border-[#e5e2da] bg-white"}`}><div className="text-[10px] uppercase tracking-wide text-[#667085]">{title}</div><div className="mt-1 font-mono text-xs font-semibold text-[#101828]">{code ?? "Не создан"}</div><div className="mt-1 text-[10px] text-[#667085]">{detail}</div></div>; }
function Arrow() { return <div className="hidden items-center px-1 text-[#98a2b3] md:flex">→</div>; }
function FinRow({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="flex items-center justify-between border-b border-[#d9e6e1] py-1 text-[11px] last:border-0"><span className="text-[#667085]">{label}</span><span className={`font-mono text-xs font-semibold ${tone ?? "text-[#101828]"}`}>{value}</span></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[#f0eee8] bg-[#fbfaf7] px-2 py-1.5"><div className="text-[9px] text-[#98a2b3]">{label}</div><div className="mt-0.5 font-mono text-[12px] font-semibold text-[#101828]">{value}</div></div>; }
function Panel({ title, action, totals, children }: { title: string; action?: React.ReactNode; totals: Array<[string, string]>; children: React.ReactNode }) { return <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title={title} right={action} /><div className="p-3">{children}<div className="mt-2 space-y-1 border-t border-[#f0eee8] pt-2 text-[10px]">{totals.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-[#98a2b3]">{l}</span><span className="font-mono font-semibold text-[#344054]">{v}</span></div>)}</div></div></section>; }
function SimpleRows({ rows, head }: { rows: React.ReactNode[][]; head: string[] }) { if (rows.length === 0) return <Empty text="Нет данных" />; return <table className="w-full text-left text-[10px]"><thead className="text-[#98a2b3]"><tr>{head.map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[#f0eee8]">{r.map((c, j) => <td key={j} className={`py-1.5 ${j === 1 ? "font-mono" : ""}`}>{c}</td>)}</tr>)}</tbody></table>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between py-2"><span className="text-[#667085]">{label}</span><span className="font-mono font-semibold text-[#344054]">{value}</span></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between border-b border-[#f0eee8] py-1.5"><span className="text-[#98a2b3]">{label}</span><span className="font-medium text-[#344054]">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-[#e5e2da] bg-[#fbfaf7] px-3 py-4 text-[10px] text-[#98a2b3]">{text}</div>; }
function Timeline({ title, code, date, tone }: { title: string; code: string | null; date: string; tone: "done" | "current" | "todo" }) { return <div className="relative flex gap-2 pb-3 last:pb-0"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] text-white ${tone === "done" ? "bg-emerald-600" : tone === "current" ? "bg-[#0f6b5f]" : "bg-[#d0d5dd]"}`}>{tone === "done" ? "✓" : "•"}</span><div><div className="text-[10px] font-medium text-[#344054]">{title}</div><div className="font-mono text-[9px] text-[#98a2b3]">{code ?? "—"}</div><div className="text-[9px] text-[#98a2b3]">{date}</div></div></div>; }


function PaymentSchedule({ sequence, currency }: { sequence: string; currency: string }) {
  const [items, setItems] = React.useState<Array<{ id: string; stage: string; dueDate: string; amount: string; percent: number | null; condition: string | null; status: string }>>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [noOrder, setNoOrder] = React.useState(false);
  const [form, setForm] = React.useState({ stage: "", dueDate: "", amount: "", percent: "", condition: "" });
  const load = React.useCallback(() => { dealsApi.schedule(sequence).then((rows) => { setItems(rows); setNoOrder(false); }).catch((e) => { const msg = (e as Error).message; if (msg.includes("no order")) { setNoOrder(true); setError(""); } else setError(msg); }); }, [sequence]);
  React.useEffect(() => { load(); }, [load]);
  async function add() {
    if (!form.stage.trim() || !form.dueDate || !Number(form.amount)) { setError("Заполните этап, срок и сумму"); return; }
    setBusy(true); setError("");
    try {
      await dealsApi.createSchedule(sequence, { stage: form.stage.trim(), dueDate: form.dueDate, amount: Number(form.amount), percent: form.percent ? Number(form.percent) : undefined, condition: form.condition.trim() || undefined });
      setForm({ stage: "", dueDate: "", amount: "", percent: "", condition: "" }); setOpen(false); load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function setStatus(id: string, status: string) { setBusy(true); try { await dealsApi.updateSchedule(sequence, id, { status }); load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  return <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title="График платежей и штрафов" right={!noOrder ? <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-[#e5e2da] px-2 py-1 text-[11px] text-[#344054]">+ Добавить этап</button> : null} /><div className="p-3">
    {error && <div className="mb-2 rounded-lg bg-rose-50 px-2 py-1 text-[10px] text-rose-700">{error}</div>}
    {noOrder && <div className="rounded-lg border border-dashed border-[#cfcabf] bg-[#fbfaf7] p-4 text-[11px] text-[#667085]"><div className="font-medium text-[#344054]">График появится после создания заказа</div><p className="mt-1">Сначала сконвертируйте заявку в заказ, затем добавьте этапы оплаты и штрафы.</p></div>}
    {open && <div className="mb-3 grid gap-2 rounded-lg border border-[#d9e6e1] bg-[#f2faf7] p-2 sm:grid-cols-2"><input value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} placeholder="Этап (например, Первоначальная оплата)" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Сумма" inputMode="decimal" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="Процент, %" inputMode="numeric" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="Условие / штраф" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] sm:col-span-2" /><button type="button" disabled={busy} onClick={() => void add()} className="rounded bg-[#0f6b5f] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-2">Сохранить этап</button></div>}
    {items.length === 0 ? <div className="rounded-lg border border-dashed border-[#cfcabf] bg-[#fbfaf7] p-4 text-[11px] text-[#667085]"><div className="font-medium text-[#344054]">График не настроен</div><p className="mt-1">Добавьте этапы оплаты: срок, сумму, процент и условие штрафа.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[10px]"><thead className="text-[#98a2b3]"><tr><th className="py-1">Этап</th><th>Срок</th><th className="text-right">Сумма</th><th className="text-right">%</th><th>Условие</th><th>Статус</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[#f0eee8]"><td className="py-2 font-medium text-[#344054]">{item.stage}</td><td>{new Date(item.dueDate).toLocaleDateString("ru-RU")}</td><td className="text-right font-mono">{money(item.amount, currency)}</td><td className="text-right">{item.percent ?? "—"}</td><td className="max-w-[180px] text-[#667085]">{item.condition ?? "—"}</td><td><select value={item.status} disabled={busy} onChange={(e) => void setStatus(item.id, e.target.value)} className="rounded border border-[#e5e2da] bg-white px-1 py-0.5 text-[10px]"><option value="PLANNED">План</option><option value="DUE">Ожидает</option><option value="PAID">Оплачен</option><option value="OVERDUE">Просрочен</option><option value="CANCELLED">Отменён</option></select></td></tr>)}</tbody></table><div className="mt-2 flex justify-between border-t border-[#f0eee8] pt-2 text-[10px]"><span className="text-[#98a2b3]">Итого по графику</span><span className="font-mono font-semibold text-[#344054]">{money(String(total), currency)}</span></div></div>}
  </div></section>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}><div className="w-full max-w-lg rounded-xl border border-[#e5e2da] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}><Header title={title} right={<button type="button" onClick={onClose} className="text-lg leading-none text-[#98a2b3]">×</button>} /><div className="p-4">{children}</div></div></div>;
}

function DealEditModal({ deal, onClose, onSaved }: { deal: DealRow; onClose: () => void; onSaved: () => void }) {
  const [customers, setCustomers] = React.useState<Array<{ id: string; firstName?: string | null; lastName?: string | null }>>([]);
  const [form, setForm] = React.useState({ customerId: deal.customerId ?? "", tripCountry: deal.trip.country ?? "", sourceChannel: deal.channel ?? "", requestedServiceDate: deal.trip.dateFrom?.slice(0, 10) ?? "", travelerCount: deal.travelerCount ? String(deal.travelerCount) : "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { api.get<{ items: Array<{ id: string; firstName?: string | null; lastName?: string | null }> }>("/customers?pageSize=100").then((r) => setCustomers(r.items ?? [])).catch(() => undefined); }, []);
  async function save() {
    setBusy(true); setErr("");
    try {
      await api.patch(`/requests/${deal.requestId}/details`, { customerId: form.customerId || null, tripCountry: form.tripCountry || null, sourceChannel: form.sourceChannel || null, requestedServiceDate: form.requestedServiceDate || null, travelerCount: form.travelerCount ? Number(form.travelerCount) : null });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Редактировать сделку" onClose={onClose}><div className="grid gap-3 text-xs">
    <label className="grid gap-1">Клиент<select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5"><option value="">— не выбран —</option>{customers.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.id}</option>)}</select></label>
    <label className="grid gap-1">Страна<input value={form.tripCountry} onChange={(e) => setForm({ ...form, tripCountry: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label>
    <label className="grid gap-1">Дата услуги<input type="date" value={form.requestedServiceDate} onChange={(e) => setForm({ ...form, requestedServiceDate: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label>
    <label className="grid gap-1">Туристы<input type="number" min={1} value={form.travelerCount} onChange={(e) => setForm({ ...form, travelerCount: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label>
    <label className="grid gap-1">Канал<input value={form.sourceChannel} onChange={(e) => setForm({ ...form, sourceChannel: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label>
    {err && <div className="rounded bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
    <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#0f6b5f] px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button>
  </div></Modal>;
}

function AddServiceModal({ deal, onClose, onSaved }: { deal: DealRow; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = React.useState<Array<{ id: string; title: string }>>([]);
  const [form, setForm] = React.useState({ productId: "", quantity: "1", price: "", serviceDate: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { api.get<{ items: Array<{ id: string; title: string }> }>("/products?pageSize=100&status=PUBLISHED").then((r) => setProducts(r.items ?? [])).catch(() => undefined); }, []);
  async function save() {
    if (!form.productId || !Number(form.price)) { setErr("Выберите услугу и укажите цену"); return; }
    setBusy(true); setErr("");
    try {
      await api.post(`/orders/${deal.orderId}/items`, { productId: form.productId, quantity: Number(form.quantity) || 1, price: Number(form.price), serviceDate: form.serviceDate || undefined });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Добавить услугу в заказ" onClose={onClose}><div className="grid gap-3 text-xs">
    <label className="grid gap-1">Услуга<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5"><option value="">— выберите —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2"><label className="grid gap-1">Количество<input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label><label className="grid gap-1">Цена<input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label></div>
    <label className="grid gap-1">Дата услуги<input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" /></label>
    {err && <div className="rounded bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
    <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#0f6b5f] px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Добавление…" : "Добавить услугу"}</button>
  </div></Modal>;
}

function DocumentsTab({ deal }: { deal: DealRow }) {
  const [items, setItems] = React.useState<DocumentListItem[]>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!deal.bookingCode) return;
    documentsApi.list({ pageSize: 100 }).then((page) => setItems(page.items.filter((d) => d.bookingCode === deal.bookingCode))).catch((e) => setError((e as Error).message));
  }, [deal.bookingCode]);
  if (!deal.bookingCode) return <Empty text="Документы появятся после создания брони" />;
  if (error) return <Empty text={error} />;
  if (items.length === 0) return <Empty text="Документов по этой брони нет" />;
  return <div className="space-y-2">{items.map((d) => <Link key={d.id} href={`/app/documents/${d.id}`} className="flex items-center justify-between rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2 text-[11px]"><span className="font-mono font-semibold text-[#0f6b5f]">{d.code}</span><span>{d.type}</span><span>{d.status}</span><span className="font-mono">{money(d.totalAmount, d.currency ?? "AZN")}</span></Link>)}</div>;
}

function CommunicationsTab({ deal }: { deal: DealRow }) {
  const [items, setItems] = React.useState<Array<{ id: string; code: string; type: string; subject: string | null; body: string; occurredAt: string }>>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!deal.orderId) return;
    api.get<{ items: Array<{ id: string; code: string; type: string; subject: string | null; body: string; occurredAt: string }> }>(`/communications/context/ORDER/${deal.orderId}?pageSize=50`).then((r) => setItems(r.items ?? [])).catch((e) => setError((e as Error).message));
  }, [deal.orderId]);
  if (!deal.orderId) return <Empty text="Коммуникации появятся после создания заказа" />;
  if (error) return <Empty text={error} />;
  if (items.length === 0) return <Empty text="Коммуникаций по заказу нет" />;
  return <div className="space-y-2">{items.map((c) => <div key={c.id} className="rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2 text-[11px]"><div className="flex justify-between"><span className="font-semibold">{c.subject ?? c.type}</span><span className="text-[#98a2b3]">{new Date(c.occurredAt).toLocaleString("ru-RU")}</span></div><div className="mt-1 text-[#667085]">{c.body}</div></div>)}</div>;
}

function WriteOffModal({ deal, onClose, onSaved }: { deal: DealRow; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = React.useState(deal.supplierRefundDue);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  async function submit() {
    if (!reason.trim()) { setErr("Укажите причину"); return; }
    setBusy(true); setErr("");
    try {
      await api.post(`/orders/${deal.orderId}/financial-settlement/write-off-supplier`, { amount, reason: reason.trim() });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Признать убытком и закрыть" onClose={onClose}><div className="grid gap-3 text-xs">
    <div className="rounded-lg bg-amber-50 p-2 text-amber-800">Поставщик не вернул {money(deal.supplierRefundDue, deal.currency)}. Сумма будет списана в убыток, клиентский штраф рассчитан по штрафу поставщика.</div>
    <label className="grid gap-1">Сумма списания<input value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" inputMode="decimal" /></label>
    <label className="grid gap-1">Причина<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-lg border border-[#e5e2da] px-2 py-1.5" placeholder="Почему поставщик не возвращает деньги" /></label>
    {err && <div className="rounded bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
    <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Списание…" : "Признать убытком и закрыть"}</button>
  </div></Modal>;
}

function TravelersTab({ deal, requestTravelers, orderTravelers, readOnly, onRefresh }: { deal: DealRow; requestTravelers: Array<{ id: string; position: number; firstName: string; lastName: string; birthDate: string; citizenship?: string | null; passportSeries?: string | null; passportNumber?: string | null; passportExpiry?: string | null }>; orderTravelers: Array<{ id: string; firstName: string; lastName: string; birthDate: string | null; citizenship: string | null; passportSeries: string | null; passportNumber: string | null; passportExpiry: string | null; dataCompleteness: string }>; readOnly: boolean; onRefresh: () => void }) {
  const [form, setForm] = React.useState({ firstName: "", lastName: "", phone: "", birthDate: "", passportSeries: "", passportNumber: "", passportExpiry: "", citizenship: "" });
  const [sameAsClient, setSameAsClient] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [editingTravelerId, setEditingTravelerId] = React.useState<string | null>(null);
  const [addingTraveler, setAddingTraveler] = React.useState(false);
  const expected = deal.travelerCount ?? requestTravelers.length;
  const isOrder = Boolean(deal.orderId);
  const canFill = false;
  React.useEffect(() => {
    if (!sameAsClient || requestTravelers.length > 0) return;
    const parts = (deal.customerName ?? "").trim().split(/\s+/).filter(Boolean);
    setForm((f) => ({ ...f, firstName: f.firstName || parts[0] || "", lastName: f.lastName || parts.slice(1).join(" ") || "", phone: f.phone || deal.customerPhone || "" }));
  }, [sameAsClient, deal.customerName, deal.customerPhone, requestTravelers.length]);
  if (isOrder) {
    const canEditOrder = !readOnly;
    return <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title={`Туристы (${orderTravelers.length})`} /><div className="space-y-2 p-3">{orderTravelers.length === 0 ? <Empty text="Туристы не заполнены" /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[10px]"><thead className="text-[#98a2b3]"><tr>{["Фамилия и имя", "Гражданство", "Дата рождения", "Паспорт", "Срок", "Статус", ""].map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead><tbody>{orderTravelers.map((traveler) => editingTravelerId === traveler.id ? <tr key={traveler.id}><td colSpan={7} className="py-2"><OrderTravelerEditRow orderId={deal.orderId!} traveler={traveler} onSaved={() => { setEditingTravelerId(null); onRefresh(); }} /></td></tr> : <tr key={traveler.id} className="border-t border-[#f0eee8]"><td className="px-2 py-1.5 font-semibold">{traveler.lastName} {traveler.firstName}</td><td className="px-2 py-1.5">{traveler.citizenship ?? "—"}</td><td className="px-2 py-1.5">{traveler.birthDate ? new Date(traveler.birthDate).toLocaleDateString("ru-RU") : "—"}</td><td className="px-2 py-1.5 font-mono">{traveler.passportSeries ?? "—"} {traveler.passportNumber ?? ""}</td><td className="px-2 py-1.5">{traveler.passportExpiry ? new Date(traveler.passportExpiry).toLocaleDateString("ru-RU") : "—"}</td><td className={`px-2 py-1.5 ${traveler.dataCompleteness === "COMPLETE" ? "text-emerald-700" : "text-amber-700"}`}>{traveler.dataCompleteness === "COMPLETE" ? "Полные" : "Неполные"}</td><td className="px-2 py-1.5">{!readOnly && <button type="button" onClick={() => setEditingTravelerId(traveler.id)} className="rounded border border-[#e5e2da] px-1.5 py-0.5 text-[10px] text-[#0f6b5f]">✎</button>}</td></tr>)}</tbody></table></div>}{canEditOrder && <div className="mt-2">{addingTraveler ? <OrderTravelerAddRow orderId={deal.orderId!} isFirst={orderTravelers.length === 0} customerName={deal.customerName} customerPhone={deal.customerPhone} onSaved={() => { setAddingTraveler(false); onRefresh(); }} onCancel={() => setAddingTraveler(false)} /> : <button type="button" onClick={() => setAddingTraveler(true)} className="rounded border border-[#0f6b5f] px-2 py-1 text-[10px] font-semibold text-[#0f6b5f]">+ Добавить туриста</button>}</div>}</div></section>;
  }
  
  async function add() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate) { setError("Заполните имя, фамилию и дату рождения"); return; }
    if (!form.passportSeries.trim() || !form.passportNumber.trim()) { setError("Заполните серию и номер паспорта"); return; }
    setBusy(true); setError("");
    try {
      await api.post(`/requests/${deal.requestId}/travelers`, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), birthDate: form.birthDate, citizenship: form.citizenship || null, passportSeries: form.passportSeries.trim(), passportNumber: form.passportNumber.trim(), passportExpiry: form.passportExpiry || null, position: requestTravelers.length + 1 });
      setForm({ firstName: "", lastName: "", phone: "", birthDate: "", passportSeries: "", passportNumber: "", passportExpiry: "", citizenship: "" });
      setSameAsClient(false);
      onRefresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
    <Header title="Туристы" right={<span className={requestTravelers.length === expected ? "text-[11px] text-emerald-700" : "text-[11px] text-amber-700"}>{requestTravelers.length} из {expected}</span>} />
    <div className="space-y-3 p-3">
      {requestTravelers.length === 0 ? <Empty text="Туристы ещё не заполнены" /> : <div className="space-y-1">{requestTravelers.map((traveler) => <div key={traveler.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2 text-[11px]"><span className="font-semibold">{traveler.position}. {traveler.lastName} {traveler.firstName}</span><span>{new Date(traveler.birthDate).toLocaleDateString("ru-RU")}</span><span className="text-[#667085]">{traveler.citizenship ?? "—"}</span><span className="font-mono text-[#667085]">{traveler.passportSeries ?? "—"} {traveler.passportNumber ?? ""}</span></div>)}</div>}
      {canFill ? <div className="space-y-2 rounded-lg border border-[#d9e6e1] bg-[#f2faf7] p-3">
        {requestTravelers.length === 0 && <label className="flex items-center gap-2 text-[11px] font-medium text-[#344054]"><input type="checkbox" checked={sameAsClient} onChange={(e) => setSameAsClient(e.target.checked)} />Клиент является туристом</label>}
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Фамилия" disabled={sameAsClient} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] disabled:bg-slate-100" />
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Имя" disabled={sameAsClient} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] disabled:bg-slate-100" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Телефон" disabled={sameAsClient} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] disabled:bg-slate-100" />
          <label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Дата рождения<input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] text-[#344054]" /></label>
          <input value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} placeholder="Гражданство" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value })} placeholder="Серия паспорта" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" />
          <input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="Номер паспорта" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" />
          <label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Срок паспорта<input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px] text-[#344054]" /></label>
        </div>
        <button type="button" disabled={busy} onClick={() => void add()} className="rounded bg-[#0f6b5f] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Добавить туриста"}</button>
      </div> : requestTravelers.length < expected ? <p className="text-[11px] text-[#667085]">Заполнение туристов станет доступно после подтверждения клиентом.</p> : null}
      {error && <div className="rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700">{error}</div>}
      <p className="text-[10px] text-[#98a2b3]">Все туристы должны быть заполнены до конвертации заказа.</p>
    </div>
  </section>;
}

function OrderTravelerEditRow({ orderId, traveler, onSaved }: { orderId: string; traveler: { id: string; firstName: string; lastName: string; birthDate: string | null; citizenship: string | null; passportSeries: string | null; passportNumber: string | null; passportExpiry: string | null; dataCompleteness: string }; onSaved: () => void }) {
  const [form, setForm] = React.useState({ firstName: traveler.firstName, lastName: traveler.lastName, birthDate: traveler.birthDate?.slice(0, 10) ?? "", citizenship: traveler.citizenship ?? "", passportSeries: traveler.passportSeries ?? "", passportNumber: traveler.passportNumber ?? "", passportExpiry: traveler.passportExpiry?.slice(0, 10) ?? "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await api.patch(`/orders/${orderId}/travelers/${traveler.id}`, form);
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="rounded-lg border border-[#e5e2da] bg-[#fbfaf7] p-2"><div className="grid gap-2 sm:grid-cols-4"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Фамилия" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Имя" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Дата рождения<input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /></label><input value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} placeholder="Гражданство" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value })} placeholder="Серия паспорта" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="Номер паспорта" className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /><label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Срок паспорта<input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} className="rounded border border-[#e5e2da] px-2 py-1.5 text-[11px]" /></label><button type="button" disabled={busy} onClick={() => void save()} className="rounded bg-[#0f6b5f] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button></div>{error && <div className="mt-1 text-[10px] text-rose-700">{error}</div>}</div>;
}

function EditClientPaymentModal({ payment, onClose, onSaved }: { payment: any; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = React.useState(payment.amount);
  const [date, setDate] = React.useState(payment.date.slice(0, 10));
  const [method, setMethod] = React.useState(payment.method ?? "cash");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() { setBusy(true); setError(""); try { await api.patch(`/finance/payments/${payment.code}`, { amount, paidAt: date, paymentMethod: method }); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><h3 className="mb-1 text-base font-semibold">Редактировать платёж клиента</h3><p className="mb-3 font-mono text-xs text-slate-500">{payment.code}</p><div className="grid gap-2"><label className="text-xs text-slate-500">Сумма<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs text-slate-500">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs text-slate-500">Форма оплаты<select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="cash">Наличные</option><option value="card">Карта</option><option value="bank_transfer">Банковский перевод</option><option value="online">Онлайн</option></select></label>{error && <div className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</div>}<div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs">Отмена</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button></div></div></div></div>;
}

function EditSupplierPayoutModal({ payout, onClose, onSaved }: { payout: any; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = React.useState(payout.amount);
  const [date, setDate] = React.useState(payout.date.slice(0, 10));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() { setBusy(true); setError(""); try { await api.patch(`/finance/supplier-payments/${payout.code}`, { amount, occurredAt: date }); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><h3 className="mb-1 text-base font-semibold">Редактировать расчёт с поставщиком</h3><p className="mb-3 font-mono text-xs text-slate-500">{payout.code}</p><div className="grid gap-2"><label className="text-xs text-slate-500">Сумма<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs text-slate-500">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>{error && <div className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</div>}<div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs">Отмена</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button></div></div></div></div>;
}

function HistoryTab({ deal }: { deal: DealRow }) {
  const [items, setItems] = React.useState<Array<any>>([]);
  const [loading, setLoading] = React.useState(true);
  const actionLabels: Record<string, string> = { "finance.payment.edited": "Платёж клиента изменён", "finance.supplier_payment.edited": "Расчёт с поставщиком изменён", "finance.supplier_payment.confirmed": "Расчёт с поставщиком подтверждён", "finance.supplier_payment.created": "Расчёт с поставщиком создан", "finance.supplier_payment.cancelled": "Расчёт с поставщиком отменён", "finance.supplier_payment.allocation_reversed": "Распределение сторнировано", "finance.supplier_payment.allocated": "Распределение изменено", "finance.refund.edited": "Возврат изменён", "order.returned_to_request": "Заказ возвращён в заявку", "order.updated": "Заказ изменён", "request.updated": "Заявка изменена" };
  const resourceLabels: Record<string, string> = { SupplierPayout: "Расчёт с поставщиком", Payment: "Платёж", Refund: "Возврат", Request: "Заявка", Order: "Заказ", Booking: "Бронь" };
  const fieldLabels: Record<string, string> = { code: "Код", actor: "Пользователь", aznAmount: "Сумма, AZN", allocationCount: "Распределений", fromAmount: "Было", toAmount: "Стало", fromStatus: "Статус был", toStatus: "Статус стал", reason: "Причина" };
  function detailsText(details: any): string {
    if (!details || typeof details !== "object") return "—";
    return Object.entries(details).filter(([key]) => key !== "correlation").map(([key, value]) => `${fieldLabels[key] ?? key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ");
  }
  React.useEffect(() => {
    let alive = true;
    api.get<any>(`/finance/deals/${deal.sequence}/history`).then((data) => {
      if (!alive) return;
      setItems((data.items ?? []).map((x: any) => ({ ...x, label: actionLabels[x.action] ?? x.action ?? "Изменение", actor: x.actorName && x.actorName !== "Система" ? x.actorName : (x.details?.actor ?? x.actorName ?? "Система") })));
    }).catch(() => { if (alive) setItems([]); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [deal.sequence]);
  if (loading) return <Empty text="Загрузка истории…" />;
  if (items.length === 0) return <Empty text="История изменений пуста" />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-[10px]"><thead className="text-[#98a2b3]"><tr>{["Дата и время", "Кто", "Действие", "Объект", "Детали"].map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead><tbody>{items.map((x, i) => <tr key={x.id ?? i} className="border-t border-[#f0eee8] align-top"><td className="px-2 py-1.5 whitespace-nowrap">{x.createdAt ? new Date(x.createdAt).toLocaleString("ru-RU") : "—"}</td><td className="px-2 py-1.5">{x.actor}</td><td className="px-2 py-1.5 font-medium">{x.label}</td><td className="px-2 py-1.5">{resourceLabels[x.resource] ?? x.resource ?? "—"}</td><td className="px-2 py-1.5">{detailsText(x.details)}</td></tr>)}</tbody></table></div>;
}

function ClientChats({ deal }: { deal: DealRow }) {
  const [rows, setRows] = React.useState<WhatsAppConversationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    api.get<WhatsAppConversationRow[]>("/whatsapp/conversations").then((data) => {
      if (!alive) return;
      const digits = (deal.customerPhone ?? "").replace(/\D/g, "").slice(-9);
      setRows(digits ? data.filter((row) => ((row.canonicalPhone ?? row.remoteJid ?? "").replace(/\D/g, "").slice(-9) === digits)) : []);
    }).catch(() => { if (alive) setRows([]); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [deal.customerPhone]);
  return <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><span>💬</span>Общение с клиентом</div>{loading ? <div className="text-[10px] text-[#98a2b3]">Загрузка диалогов…</div> : rows.length === 0 ? <div className="rounded-lg border border-dashed border-[#e5e2da] bg-[#fbfaf7] px-3 py-4 text-[10px] text-[#98a2b3]">Диалогов WhatsApp по номеру {deal.customerPhone ?? "—"} нет</div> : <div className="space-y-1">{rows.slice(0, 5).map((row) => <a key={row.id} href={`/app/whatsapp?conversation=${row.id}`} className="block rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2 hover:border-[#0f6b5f]"><div className="flex justify-between gap-2 text-[10px]"><span className="font-semibold text-[#344054]">{row.canonicalPhone ?? row.remoteJid}</span><span className="text-[#98a2b3]">{row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleDateString("ru-RU") : "—"}</span></div><div className="mt-0.5 truncate text-[10px] text-[#667085]">{row.lastMessagePreview ?? "Нет сообщений"}</div></a>)}</div>}</div>;
}

function EditRefundModal({ refund, onClose, onSaved }: { refund: any; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = React.useState(refund.amount);
  const [reason, setReason] = React.useState(refund.reason ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() { setBusy(true); setError(""); try { await api.patch(`/finance/refunds/${refund.code}`, { amount, reason }); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><h3 className="mb-1 text-base font-semibold">Редактировать возврат</h3><p className="mb-3 font-mono text-xs text-slate-500">{refund.code}</p><div className="grid gap-2"><label className="text-xs text-slate-500">Сумма<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs text-slate-500">Причина<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>{error && <div className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</div>}<div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs">Отмена</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button></div></div></div></div>;
}

function OrderTravelerAddRow({ orderId, isFirst, customerName, customerPhone, onSaved, onCancel }: { orderId: string; isFirst: boolean; customerName: string | null; customerPhone: string | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = React.useState({ firstName: "", lastName: "", birthDate: "", citizenship: "", passportSeries: "", passportNumber: "", passportExpiry: "" });
  const [sameAsClient, setSameAsClient] = React.useState(isFirst);
  React.useEffect(() => {
    if (!isFirst || !sameAsClient) return;
    const parts = (customerName ?? "").trim().split(/\s+/).filter(Boolean);
    setForm((f) => ({ ...f, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || parts[0] || "" }));
  }, [sameAsClient, customerName, isFirst]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("Укажите имя и фамилию"); return; }
    setBusy(true); setError("");
    try { await api.post(`/orders/${orderId}/travelers`, form); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="rounded-lg border border-[#d9e6e1] bg-[#f2faf7] p-2">{isFirst && <label className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[#344054]"><input type="checkbox" checked={sameAsClient} onChange={(e) => setSameAsClient(e.target.checked)} />Клиент является туристом</label>}<div className="grid gap-2 sm:grid-cols-4"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Фамилия" disabled={sameAsClient} className="rounded border px-2 py-1.5 text-[11px] disabled:bg-slate-100" /><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Имя" disabled={sameAsClient} className="rounded border px-2 py-1.5 text-[11px] disabled:bg-slate-100" /><input value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} placeholder="Гражданство" className="rounded border px-2 py-1.5 text-[11px]" /><label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Дата рождения<input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="rounded border px-2 py-1.5 text-[11px]" /></label><input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value })} placeholder="Серия паспорта" className="rounded border px-2 py-1.5 text-[11px]" /><input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="Номер паспорта" className="rounded border px-2 py-1.5 text-[11px]" /><label className="grid gap-0.5 text-[9px] text-[#98a2b3]">Срок паспорта<input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} className="rounded border px-2 py-1.5 text-[11px]" /></label><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => void save()} className="rounded bg-[#0f6b5f] px-2 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить"}</button><button type="button" onClick={onCancel} className="rounded border px-2 py-1.5 text-[10px]">Отмена</button></div></div>{error && <div className="mt-1 text-[10px] text-rose-700">{error}</div>}</div>;
}
