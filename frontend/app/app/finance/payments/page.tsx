"use client";

/**
 * RR-FIN-01 — Payment Drill-down from Financial Summary
 *
 * Minimal dedicated Payment registry page for Analytics → Financial Summary drill-down.
 * Uses canonical Payment query/service (GET /finance/payments) with currency/dateFrom/dateTo filters.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import AggregateSummary from "@/components/AggregateSummary";
import { useLocale, t } from "@/lib/i18n";

interface Payment {
  id: string;
  code: string;
  orderId: string;
  customerId: string | null;
  partnerId: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  providerRef: string | null;
  version: number;
  createdAt: string;
}

function PaymentsContent({
  initialCurrency,
  initialDateFrom,
  initialDateTo,
  initialStatus,
}: {
  initialCurrency?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialStatus?: string;
}) {
  const locale = useLocale();
  const [data, setData] = useState<Page<Payment> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState(initialCurrency ?? "");
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialDateTo ?? "");
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (currency) qs.set("currency", currency);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (statusFilter) qs.set("status", statusFilter);
      qs.set("page", String(page));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Payment>>(`/finance/payments?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currency, dateFrom, dateTo, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (v: string, cur?: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    const formatted = n.toLocaleString(
      locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );
    return cur ? `${formatted} ${cur}` : formatted;
  };

  // Compute aggregates over full dataset
  const totalAmount = data?.items?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) ?? 0;
  const totalRecords = data?.total ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("finance.payments.title", locale) || "Платежи"}
        breadcrumbs={["TravelHub", t("analytics.finance.title", locale) || "Финансы", t("finance.payments.title", locale) || "Платежи"]}
        actions={
          <Link
            href="/app/analytics"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ← {t("analytics.title", locale)}
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Period/Currency context badge */}
          {(dateFrom || currency) && (
            <div className="flex items-center gap-3">
              {dateFrom && dateTo && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-600">
                  📊 {dateFrom} → {dateTo}
                </span>
              )}
              {currency && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                  {currency}
                </span>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Все валюты</option>
              <option value="AZN">AZN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Все статусы</option>
              <option value="CAPTURED">Зачислен</option>
              <option value="PENDING">Ожидает</option>
              <option value="FAILED">Ошибка</option>
              <option value="CANCELLED">Отменён</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">С</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">По</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>
            {loading && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          {/* Aggregate Summary */}
          <AggregateSummary
            totalRecords={totalRecords}
            fields={[
              { label: "Сумма", value: totalAmount, isMoney: true, currency: currency || undefined },
            ]}
            currencyTotals={
              !currency && data?.items
                ? (() => {
                    const byCurrency: Record<string, { count: number; amount: number }> = {};
                    for (const p of data.items) {
                      const c = p.currency || "UNK";
                      if (!byCurrency[c]) byCurrency[c] = { count: 0, amount: 0 };
                      byCurrency[c].count++;
                      byCurrency[c].amount += parseFloat(p.amount) || 0;
                    }
                    return Object.entries(byCurrency).map(([c, v]) => ({
                      currency: c,
                      fields: [
                        { label: "Платежей", value: v.count },
                        { label: "Сумма", value: v.amount, isMoney: true },
                      ],
                    }));
                  })()
                : undefined
            }
          />

          {/* Payments Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Дата</th>
                  <th className="px-4 py-2.5 font-medium">Заказ</th>
                  <th className="px-4 py-2.5 font-medium text-right">Сумма</th>
                  <th className="px-4 py-2.5 font-medium">Валюта</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Метод</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{p.code}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString("ru-RU") : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.orderId.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{p.currency}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5 text-slate-500">{p.paymentMethod ?? "—"}</td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      Платежей пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data && data.total > 0 && (
              <Pagination
                page={page}
                pageSize={20}
                total={data.total}
                onPageChange={(p) => setPage(p)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsWithParams() {
  const sp = useSearchParams();
  return (
    <PaymentsContent
      initialCurrency={sp.get("currency") ?? undefined}
      initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? undefined}
      initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? undefined}
      initialStatus={sp.get("status") ?? undefined}
    />
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <PaymentsWithParams />
    </Suspense>
  );
}
