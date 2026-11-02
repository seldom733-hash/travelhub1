"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/i18n";
import { dealsApi, type DealRow } from "@/lib/deals-api";

const TABS = [
  ["overview", "Общая информация"], ["services", "Услуги и расчёты"], ["client", "Платежи клиента"],
  ["supplier", "Расчёты с поставщиком"], ["penalties", "Штрафы и возвраты"], ["docs", "Документы"],
  ["communications", "Коммуникации"], ["history", "История изменений"],
] as const;
type Tab = (typeof TABS)[number][0];

function money(value: string | null | undefined, currency: string) { return formatPrice(value ?? "0", currency, "ru") ?? value ?? "0"; }
function statusRu(status: string) {
  const map: Record<string, string> = { NEW: "Новая", IN_PROCESSING: "В работе", READY_FOR_BOOKING: "Готова к брони", SENT_TO_BOOKING: "На бронировании", FULFILLED: "Завершён", CONFIRMED: "Подтверждён", COMPLETED: "Завершён", CANCELLED: "Отменён", CANCELLED_BY_CUSTOMER: "Отменён клиентом" };
  return map[status] ?? status;
}
function statusTone(status: string) {
  if (/CANCEL|REJECT|FAIL/.test(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (/PAID|CONFIRM|COMPLETED|FULFILLED/.test(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/PARTIAL|PENDING|SENT/.test(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#d9e6e1] bg-[#f2faf7] text-[#0f6b5f]";
}

export default function DealDetailPage() {
  const params = useParams<{ sequence: string }>();
  const sequence = params.sequence;
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let alive = true;
    dealsApi.bySequence(sequence).then((row) => { if (alive) setDeal(row); }).catch((e) => { if (alive) setError((e as Error).message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sequence]);

  if (loading) return <div className="p-8 text-sm text-[#667085]">Загрузка сделки…</div>;
  if (error || !deal) return <div className="p-8 text-sm text-rose-600">Сделка не найдена: {error}</div>;

  const cancelled = /CANCEL|REJECT/.test(deal.status);
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
            {deal.orderId ? <Link href={`/app/orders/${deal.orderId}`} className="rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-medium text-[#344054]">Действия</Link> : <button type="button" disabled className="rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-medium text-[#98a2b3]">Действия</button>}
            <Link href={deal.orderId ? `/app/orders/${deal.orderId}` : "/app/finance/deals"} className="rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white">Открыть заказ</Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">{deal.requestCode}</span>
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">{deal.orderCode ?? "заказ не создан"}</span>
          <span className="rounded-full bg-[#f2faf7] px-2 py-1 font-mono text-[#0f6b5f]">{deal.bookingCode ?? "бронь не создана"}</span>
          <span className="ml-auto">Создано: {new Date(deal.createdAt).toLocaleString("ru-RU")}</span>
          <span>Менеджер: {deal.manager ?? "—"}</span>
        </div>
      </div>

      <div className="p-4 lg:p-6">
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
              <InfoCard title="Клиент" icon="👤" action={<button type="button" disabled title="Редактирование клиента в заказе" className="text-slate-400">✎</button>}>
                <div className="text-sm font-semibold text-[#101828]">{deal.customerName}</div>
                <div className="mt-1 text-[11px] text-[#667085]">{deal.customerPhone ?? "—"}</div>
                <div className="text-[11px] text-[#667085]">{deal.customerEmail ?? "—"}</div>
              </InfoCard>
              <InfoCard title="Параметры поездки" icon="▦" action={<span className="text-slate-400">✎</span>}>
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
                <FinRow label="Ожидаемый доход" value={money(deal.expectedIncome, deal.currency)} tone="text-emerald-700" />
                <div className="mt-2 flex items-center justify-between rounded-lg bg-white/70 px-2 py-1.5"><span className="text-[10px] text-[#667085]">Текущий доход</span><span className="font-mono text-sm font-semibold text-emerald-700">{money(deal.currentIncome, deal.currency)}</span></div>
              </div>
            </div>

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <Header title={`Услуги в заказе (${deal.services.length})`} right={<><button type="button" disabled title="Добавление услуги в backend пока не реализовано" className="rounded-lg border border-[#e5e2da] px-2 py-1 text-[11px] text-[#98a2b3]">+ Добавить услугу</button><span className="text-slate-400">•••</span></>} />
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

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <Header title="Финансовая сводка по сделке" right={<span className="text-slate-400">⌃</span>} />
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-6">
                {[["Сумма продажи", deal.salesAmount], ["Себестоимость", deal.costAmount], ["Получено от клиента", deal.clientReceived], ["Долг клиента", deal.clientDebt], ["Оплачено поставщику", deal.supplierPaid], ["Долг перед поставщиком", deal.supplierDebt], ["Возврат клиента", deal.clientRefunded], ["Возврат от поставщика", deal.supplierRefunded], ["Штрафы клиента", deal.clientPenalty], ["Штрафы от поставщика", deal.supplierPenalty], ["Ожидаемый доход", deal.expectedIncome], ["Текущий доход", deal.currentIncome]].map(([label, value]) => <Mini key={label} label={label} value={money(value, deal.currency)} />)}
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Платежи клиента" action={deal.orderId ? <Link href={`/app/orders/${deal.orderId}`} className="text-[11px] font-semibold text-[#0f6b5f]">+ Добавить платёж</Link> : null} totals={[["Всего получено", money(deal.clientReceived, deal.currency)], ["Возвращено", money(deal.clientRefunded, deal.currency)], ["Остаток к оплате", money(deal.clientDebt, deal.currency)]]}>
                {deal.payments.length === 0 ? <Empty text="Платежей клиента нет" /> : <SimpleRows rows={deal.payments.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.method ?? "Оплата", p.status])} head={["Дата", "Сумма", "Тип", "Статус"]} />}
              </Panel>
              <Panel title="Расчёты с поставщиком" action={deal.orderId ? <Link href={`/app/orders/${deal.orderId}`} className="text-[11px] font-semibold text-[#0f6b5f]">+ Добавить платёж</Link> : null} totals={[["Всего оплачено", money(deal.supplierPaid, deal.currency)], ["Возврат от поставщика", money(deal.supplierRefunded, deal.currency)], ["Остаток поставщику", money(deal.supplierDebt, deal.currency)]]}>
                {deal.payouts.length === 0 ? <Empty text="Расчётов с поставщиком нет" /> : <SimpleRows rows={deal.payouts.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.direction === "INCOMING" ? "Возврат" : "Оплата поставщику", p.status])} head={["Дата", "Сумма", "Тип", "Статус"]} />}
              </Panel>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title="График платежей и штрафов" right={<span className="text-slate-400">⌃</span>} /><div className="p-4"><div className="rounded-lg border border-dashed border-[#cfcabf] bg-[#fbfaf7] p-4 text-[11px] text-[#667085]"><div className="font-medium text-[#344054]">График не настроен</div><p className="mt-1">Бэкенд пока не хранит рассрочку по сделке. Ниже — фактические остатки.</p><div className="mt-3 grid grid-cols-3 gap-2"><Mini label="Остаток клиента" value={money(deal.clientDebt, deal.currency)} /><Mini label="Остаток поставщику" value={money(deal.supplierDebt, deal.currency)} /><Mini label="Штраф клиента" value={money(deal.clientPenalty, deal.currency)} /></div></div></div></section>
              <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm"><Header title="Штрафы и возвраты" right={<span className="text-slate-400">⌃</span>} /><div className="divide-y divide-[#f0eee8] px-4 text-[11px]"><Line label="Штрафы клиента" value={money(deal.clientPenalty, deal.currency)} /><Line label="Штрафы поставщика" value={money(deal.supplierPenalty, deal.currency)} /><Line label="Возврат клиента" value={money(deal.clientRefunded, deal.currency)} /><Line label="Возврат от поставщика" value={money(deal.supplierRefunded, deal.currency)} /></div></section>
            </div>

            <section className="rounded-xl border border-[#e5e2da] bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-[#f0eee8] px-2 pt-2">{TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`border-b-2 px-2 py-2 text-[11px] font-medium ${tab === key ? "border-[#0f6b5f] text-[#0f6b5f]" : "border-transparent text-[#667085]"}`}>{label}</button>)}</div>
              <div className="p-4 text-xs">{tab === "overview" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Info label="Общий номер" value={deal.sequence} /><Info label="Заявка" value={deal.requestCode} /><Info label="Заказ" value={deal.orderCode ?? "—"} /><Info label="Бронь" value={deal.bookingCode ?? "—"} /><Info label="Стадия" value={deal.stageLabel} /><Info label="Статус" value={statusRu(deal.status)} /><Info label="Дата услуги" value={dateFrom} /><Info label="Сумма продажи" value={money(deal.salesAmount, deal.currency)} /><Info label="Себестоимость" value={money(deal.costAmount, deal.currency)} /><Info label="Фин. статус" value={deal.financialStatus} /><Info label="Оплата клиента" value={deal.paymentStatus} /><Info label="Оплата поставщику" value={deal.supplierPaymentStatus} /></div>}{tab === "services" && <div className="space-y-2">{deal.services.map((s) => <div key={s.id} className="flex justify-between border-b border-[#f0eee8] py-2"><span>{s.title}</span><span className="font-mono">{money(s.clientPrice, deal.currency)} / {money(s.cost, deal.currency)}</span></div>)}</div>}{tab === "client" && <SimpleRows rows={deal.payments.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.method ?? "Оплата", p.status])} head={["Дата", "Сумма", "Тип", "Статус"]} />}{tab === "supplier" && <SimpleRows rows={deal.payouts.map((p) => [new Date(p.date).toLocaleDateString("ru-RU"), money(p.amount, p.currency), p.direction === "INCOMING" ? "Возврат" : "Оплата", p.status])} head={["Дата", "Сумма", "Тип", "Статус"]} />}{tab === "penalties" && <div className="space-y-2"><Info label="Штраф клиента" value={money(deal.clientPenalty, deal.currency)} /><Info label="Штраф поставщика" value={money(deal.supplierPenalty, deal.currency)} /><Info label="Возвращено клиенту" value={money(deal.clientRefunded, deal.currency)} /><Info label="Возврат поставщика" value={money(deal.supplierRefunded, deal.currency)} /></div>}{tab === "docs" && <Empty text="Документы не загружены" />}{tab === "communications" && <Empty text="Коммуникации не загружены" />}{tab === "history" && <Empty text="История доступна в карточках заявки, заказа и брони" />}</div>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><span>✎</span>Статус и действия</div><div className="flex items-center justify-between rounded-lg border border-[#e5e2da] px-2 py-2 text-xs"><span className="text-[#667085]">Статус заказа</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(deal.status)}`}>{statusRu(deal.status)}</span></div>{deal.orderId && !cancelled && deal.stage !== "BOOKING" && deal.status !== "CONFIRMED" && <Link href={`/app/orders/${deal.orderId}`} className="mt-2 block rounded-lg bg-[#0f6b5f] px-3 py-2 text-center text-xs font-semibold text-white">→ Перевести в бронь</Link>}{deal.orderId && <Link href={`/app/orders/${deal.orderId}`} className="mt-2 block rounded-lg border border-rose-200 px-3 py-2 text-center text-xs font-semibold text-rose-700">Отменить заказ</Link>}<Link href="/app/finance/refunds" className="mt-2 block rounded-lg border border-[#e5e2da] px-3 py-2 text-center text-xs font-semibold text-[#344054]">Создать возврат</Link></div>
            <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">История этапов</div><Timeline title="Заявка создана" code={deal.requestCode} date={new Date(deal.createdAt).toLocaleString("ru-RU")} tone="done" /><Timeline title="Заказ создан" code={deal.orderCode} date={deal.orderCode ? "Текущий этап" : "Ожидает"} tone={deal.orderCode ? "current" : "todo"} /><Timeline title="Бронь" code={deal.bookingCode ?? "ожидает создания"} date={deal.bookingCode ? "Создана" : "Ожидает"} tone={deal.bookingCode ? "done" : "todo"} /></div>
            <div className="rounded-xl border border-[#e5e2da] bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><span>Заметки</span><button type="button" disabled className="text-[#98a2b3]">+ Добавить</button></div><div className="rounded-lg border border-[#f0eee8] bg-[#fbfaf7] p-2 text-[11px] text-[#667085]">Заметки по сделке не загружены.</div></div>
          </aside>
        </div>
      </div>
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
function SimpleRows({ rows, head }: { rows: string[][]; head: string[] }) { if (rows.length === 0) return <Empty text="Нет данных" />; return <table className="w-full text-left text-[10px]"><thead className="text-[#98a2b3]"><tr>{head.map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[#f0eee8]">{r.map((c, j) => <td key={j} className={`py-1.5 ${j === 1 ? "font-mono" : ""}`}>{c}</td>)}</tr>)}</tbody></table>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between py-2"><span className="text-[#667085]">{label}</span><span className="font-mono font-semibold text-[#344054]">{value}</span></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between border-b border-[#f0eee8] py-1.5"><span className="text-[#98a2b3]">{label}</span><span className="font-medium text-[#344054]">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-[#e5e2da] bg-[#fbfaf7] px-3 py-4 text-[10px] text-[#98a2b3]">{text}</div>; }
function Timeline({ title, code, date, tone }: { title: string; code: string | null; date: string; tone: "done" | "current" | "todo" }) { return <div className="relative flex gap-2 pb-3 last:pb-0"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] text-white ${tone === "done" ? "bg-emerald-600" : tone === "current" ? "bg-[#0f6b5f]" : "bg-[#d0d5dd]"}`}>{tone === "done" ? "✓" : "•"}</span><div><div className="text-[10px] font-medium text-[#344054]">{title}</div><div className="font-mono text-[9px] text-[#98a2b3]">{code ?? "—"}</div><div className="text-[9px] text-[#98a2b3]">{date}</div></div></div>; }
