"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";

interface LedgerRow {
  id: string;
  code: string;
  amount: string;
  currency: string;
  type: string;
  sourceType: string;
  businessRef: string | null;
  occurredAt: string | null;
  createdAt: string;
}

interface LedgerResponse {
  items: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export default function FinanceLedgerPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (type) params.set("type", type);
      if (sourceType) params.set("sourceType", sourceType);
      const data = await api.get<LedgerResponse>(`/finance/ledger-transactions?${params}`);
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, type, sourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Финансовый журнал" breadcrumbs={["Navitravel", "Финансы", "Финансовый журнал"]} />
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} placeholder="Тип проводки" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(1); }} placeholder="Источник" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void load()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Обновить</button>
        <span className="text-sm text-slate-500">Всего: {total}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2">Источник</th>
              <th className="px-3 py-2">Бизнес-ссылка</th>
              <th className="px-3 py-2">Дата</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Загрузка…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Проводок нет</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-3 py-2">{row.type}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPrice(row.amount, row.currency, "ru") ?? row.amount}</td>
                <td className="px-3 py-2 text-xs">{row.sourceType}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.businessRef ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{new Date(row.occurredAt ?? row.createdAt).toLocaleString("ru")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Назад</button>
        <span className="text-sm text-slate-500">Страница {page}</span>
        <button type="button" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Вперёд</button>
      </div>
    </div>
  );
}
