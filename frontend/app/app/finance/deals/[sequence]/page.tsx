"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { formatPrice } from "@/lib/i18n";
import { dealsApi, type DealRow } from "@/lib/deals-api";

const TABS = [
  ["overview", "Общая информация"],
  ["services", "Услуги и расчёты"],
  ["client", "Платежи клиента"],
  ["supplier", "Расчёты с поставщиком"],
  ["penalties", "Штрафы и возвраты"],
  ["docs", "Документы"],
  ["communications", "Коммуникации"],
  ["history", "История изменений"],
] as const;

type Tab = (typeof TABS)[number][0];

function money(value: string, currency: string) {
  return formatPrice(value, currency, "ru") ?? value;
}

function StageBlock({ title, code, active, completed, detail }: { title: string; code: string | null; active: boolean; completed: boolean; detail: string }) {
  return (
    <div className={`flex-1 rounded-xl border p-4 ${active ? "border-blue-400 bg-blue-50/60" : completed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-blue-600 text-white" : completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>
          {active ? "Активен" : completed ? "Завершён" : "Не начат"}
        </span>
      </div>
      <div className="mt-2 font-mono text-sm font-semibold text-slate-800">{code ?? "—"}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
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
    dealsApi.bySequence(sequence)
      .then((row) => { if (alive) setDeal(row); })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sequence]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Загрузка сделки…</div>;
  if (error || !deal) return <div className="p-6 text-sm text-rose-600">Сделка не найдена: {error}</div>;

  const stageIndex = deal.stage === "BOOKING" ? 2 : deal.stage === "ORDER" ? 1 : 0;
  const tabs = TABS;
  return (
    <div>
      <PageHeader
        title={`Сделка № ${deal.sequence}`}
        breadcrumbs={["Navitravel", "Финансы", "Реестр продаж и взаиморасчётов", `Сделка № ${deal.sequence}`]}
        actions={<Link href="/app/finance/deals" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">← К списку</Link>}
      />
      <div className="space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono">{deal.requestCode}</span>
          {deal.orderCode && <span className="rounded-full bg-slate-100 px-2 py-1 font-mono">{deal.orderCode}</span>}
          {deal.bookingCode && <span className="rounded-full bg-slate-100 px-2 py-1 font-mono">{deal.bookingCode}</span>}
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">{deal.stageLabel}</span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">{deal.status}</span>
          <span className="ml-auto text-slate-400">Создано: {new Date(deal.createdAt).toLocaleString("ru-RU")}</span>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row">
          <StageBlock title="Заявка" code={deal.requestCode} active={stageIndex === 0} completed={stageIndex > 0} detail={`${deal.customerName} · ${new Date(deal.createdAt).toLocaleDateString("ru-RU")}`} />
          <div className="flex items-center justify-center text-slate-300">→</div>
          <StageBlock title="Заказ" code={deal.orderCode} active={stageIndex === 1} completed={stageIndex > 1} detail={deal.orderCode ? `${money(deal.salesAmount, deal.currency)} · ${deal.manager ?? "—"}` : "Не создан"} />
          <div className="flex items-center justify-center text-slate-300">→</div>
          <StageBlock title="Бронь" code={deal.bookingCode} active={stageIndex === 2} completed={false} detail={deal.bookingCode ? `Статус: ${deal.status}` : "Не создана"} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] uppercase text-slate-400">Клиент</div><div className="mt-1 text-sm font-semibold">{deal.customerName}</div><div className="text-xs text-slate-500">{deal.customerPhone ?? "—"} · {deal.customerEmail ?? "—"}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] uppercase text-slate-400">Услуга</div><div className="mt-1 text-sm font-semibold">{deal.productTitle}</div><div className="text-xs text-slate-500">{deal.productType || "—"} · {deal.travelerCount != null ? `${deal.travelerCount} чел.` : "—"}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] uppercase text-slate-400">Поставщик</div><div className="mt-1 text-sm font-semibold">{deal.supplierCode ?? "—"}</div><div className="text-xs text-slate-500">Менеджер: {deal.manager ?? "—"}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] uppercase text-slate-400">Финансовый статус</div><div className="mt-1 text-sm font-semibold">{deal.financialStatus}</div><div className="text-xs text-slate-500">Клиент: {deal.paymentStatus}</div></div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
            {tabs.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-xs font-medium ${tab === key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          <div className="p-4 text-sm">
            {tab === "overview" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Общий номер" value={deal.sequence} />
                <Info label="Заявка" value={deal.requestCode} />
                <Info label="Заказ" value={deal.orderCode ?? "—"} />
                <Info label="Бронь" value={deal.bookingCode ?? "—"} />
                <Info label="Стадия" value={deal.stageLabel} />
                <Info label="Статус" value={deal.status} />
                <Info label="Дата услуги" value={deal.serviceDate ? new Date(deal.serviceDate).toLocaleDateString("ru-RU") : "—"} />
                <Info label="Сумма продажи" value={money(deal.salesAmount, deal.currency)} />
                <Info label="Себестоимость" value={money(deal.costAmount, deal.currency)} />
                <Info label="Ожидаемый доход" value={money(deal.expectedIncome, deal.currency)} />
                <Info label="Текущий доход" value={money(deal.currentIncome, deal.currency)} />
                <Info label="Долг клиента" value={money(deal.clientDebt, deal.currency)} />
                <Info label="Долг поставщику" value={money(deal.supplierDebt, deal.currency)} />
                <Info label="Штраф клиента" value={money(deal.clientPenalty, deal.currency)} />
                <Info label="Штраф поставщика" value={money(deal.supplierPenalty, deal.currency)} />
              </div>
            )}
            {tab === "services" && (
              <div className="space-y-2">
                <Info label="Услуга" value={deal.productTitle} />
                <Info label="Тип" value={deal.productType || "—"} />
                <Info label="Поставщик" value={deal.supplierCode ?? "—"} />
                <Info label="Цена клиента" value={money(deal.salesAmount, deal.currency)} />
                <Info label="Себестоимость" value={money(deal.costAmount, deal.currency)} />
                <Info label="Доход" value={money(deal.expectedIncome, deal.currency)} />
              </div>
            )}
            {tab === "client" && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3"><Info label="Всего получено" value={money(deal.clientReceived, deal.currency)} /><Info label="Возвращено" value={money(deal.clientRefunded, deal.currency)} /><Info label="Остаток к оплате" value={money(deal.clientDebt, deal.currency)} /></div>
                {deal.payments.length === 0 ? <div className="text-slate-400">Платежей нет</div> : deal.payments.map((p) => <div key={p.id} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span className="font-mono">{p.code} · {new Date(p.date).toLocaleDateString("ru-RU")}</span><span>{money(p.amount, p.currency)}</span><span>{p.status}</span></div>)}
              </div>
            )}
            {tab === "supplier" && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3"><Info label="Оплачено поставщику" value={money(deal.supplierPaid, deal.currency)} /><Info label="Возврат от поставщика" value={money(deal.supplierRefunded, deal.currency)} /><Info label="Остаток поставщику" value={money(deal.supplierDebt, deal.currency)} /></div>
                {deal.payouts.length === 0 ? <div className="text-slate-400">Расчётов с поставщиком нет</div> : deal.payouts.map((p) => <div key={p.id} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span className="font-mono">{p.code} · {new Date(p.date).toLocaleDateString("ru-RU")}</span><span>{p.direction === "INCOMING" ? "Возврат" : "Оплата"} {money(p.amount, p.currency)}</span><span>{p.status}</span></div>)}
              </div>
            )}
            {tab === "penalties" && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2"><Info label="Штраф клиента" value={money(deal.clientPenalty, deal.currency)} /><Info label="Штраф поставщика" value={money(deal.supplierPenalty, deal.currency)} /></div>
                {deal.refunds.length === 0 ? <div className="text-slate-400">Возвратов нет</div> : deal.refunds.map((r) => <div key={r.id} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span className="font-mono">{r.code} · {new Date(r.date).toLocaleDateString("ru-RU")}</span><span>{money(r.amount, r.currency)}</span><span>{r.status}</span></div>)}
              </div>
            )}
            {tab === "docs" && <div className="text-slate-400">Документы не загружены</div>}
            {tab === "communications" && <div className="text-slate-400">Коммуникации не загружены</div>}
            {tab === "history" && <div className="text-slate-400">История доступна в карточках заявки, заказа и брони</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-slate-100 py-2 text-xs"><span className="text-slate-400">{label}: </span><span className="font-medium text-slate-700">{value}</span></div>;
}
