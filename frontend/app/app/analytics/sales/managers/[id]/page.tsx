"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale, type Locale } from "@/lib/i18n";
import { saStatus, saText } from "@/lib/sales-analytics-i18n";

function formatMoney(v: any, locale: Locale) { const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU"; return Number(v ?? 0).toLocaleString(tag, { maximumFractionDigits: 2 }); }
function formatDate(v: any, locale: Locale) { const tag = locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU"; return v ? new Date(v).toLocaleString(tag) : "—"; }
function pct(v: any) { return `${Number(v ?? 0).toFixed(1)}%`; }

export default function SalesManagerDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const L = (x: string) => saText(locale, x);
  const money = (v: any) => formatMoney(v, locale);
  const dt = (v: any) => formatDate(v, locale);
  const [data, setData] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const q = window.location.search || "";
    setQuery(q);
    api.get<any>(`/sales-analytics/managers/${encodeURIComponent(params.id)}${q}`)
      .then(setData).catch((e) => setError((e as Error).message));
  }, [params.id]);
  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-slate-500">{L("Загрузка карточки менеджера…")}</div>;
  const manager = data.manager ?? {};
  return (
    <div className="min-h-screen bg-[#f6f4ef] p-4 text-slate-800 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><Link href={`/app/analytics/sales/managers?${query.slice(1)}`} className="text-xs text-[#0f6b5f]">{L("← Менеджеры")}</Link><h1 className="mt-1 text-xl font-semibold">{manager.manager ?? "Менеджер"}</h1><p className="text-xs text-slate-500">{L("Карточка эффективности за выбранный период")}</p></div>
        <Link href={`/app/analytics/sales?${query.slice(1)}`} className="rounded-lg border bg-white px-3 py-1.5 text-xs">{L("Общая аналитика")}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Заявки", manager.requests], ["Обработано", manager.processed], ["Заказы", manager.orders], ["Брони", manager.bookings], ["Завершено", manager.completed], ["Закрыто", manager.closed], ["Без ответа", manager.noFirstResponse], ["Просрочено", manager.overdue], ["Конверсия Request→Order", pct(manager.conversionRequestOrder)], ["Ср. первый ответ, ч", manager.avgResponseHours ?? "—"], ["Продажи", money(manager.salesAmount)], ["Выручка", money(manager.capturedRevenue)], ["Прибыль", money(manager.grossProfit)], ["Средний чек", money(manager.avgCheck)]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-3"><div className="text-[10px] uppercase text-slate-400">{L(String(label))}</div><div className="mt-1 text-lg font-semibold">{value ?? 0}</div></div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-white"><div className="border-b p-3 text-xs font-semibold">{L("История назначений")}</div><table className="w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Заявка", "Действие", "Дата", "Кто"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(data.assignments ?? []).map((a: any, i: number) => <tr key={i} className="border-t"><td className="px-2 py-2 font-mono">{a.requestCode ?? "—"}</td><td className="px-2 py-2">{a.action}</td><td className="px-2 py-2">{dt(a.createdAt)}</td><td className="px-2 py-2">{a.actorName ?? "Система"}</td></tr>)}</tbody></table></div>
        <div className="overflow-x-auto rounded-xl border bg-white"><div className="border-b p-3 text-xs font-semibold">{L("Заявки менеджера")}</div><table className="w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-400"><tr>{["Заявка", "Клиент", "Статус", "Создана", "Первый ответ"].map((h) => <th key={h} className="px-2 py-2 font-medium">{L(h)}</th>)}</tr></thead><tbody>{(data.activity ?? []).map((r: any) => <tr key={r.requestId} className="border-t"><td className="px-2 py-2 font-mono">{r.requestCode}</td><td className="px-2 py-2">{r.customer}</td><td className="px-2 py-2">{saStatus(locale, r.status)}</td><td className="px-2 py-2">{dt(r.createdAt)}</td><td className="px-2 py-2">{r.responseHours ?? "—"}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
