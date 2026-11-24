"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { formatDate, formatPrice, t, useLocale } from "@/lib/i18n";

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

const TYPE_LABELS: Record<string, { ru: string; az: string; en: string }> = {
  PAYMENT_CAPTURED: { ru: "Оплата получена", az: "Ödəniş qəbul edildi", en: "Payment captured" },
  REFUND_PROCESSED: { ru: "Возврат клиенту", az: "Müştəriyə qaytarma", en: "Refund to client" },
  SUPPLIER_PAYOUT: { ru: "Оплата поставщику", az: "Təchizatçıya ödəniş", en: "Supplier payment" },
  SUPPLIER_REFUND: { ru: "Возврат от поставщика", az: "Təchizatçıdan qaytarma", en: "Supplier refund" },
  SUPPLIER_PAYOUT_REVERSAL: { ru: "Сторно оплаты поставщику", az: "Təchizatçı ödənişinin ləğvi", en: "Supplier payment reversal" },
  OBLIGATION_ADJUSTED: { ru: "Корректировка обязательства", az: "Öhdəliyin düzəlişi", en: "Obligation adjustment" },
  PLATFORM_PENALTY_SHARE: { ru: "Штраф клиента — доля платформы", az: "Müştəri cəriməsi — platforma payı", en: "Client penalty — platform share" },
  SUPPLIER_PENALTY_SHARE: { ru: "Штраф от поставщика — доля поставщика", az: "Təchizatçı cəriməsi — təchizatçı payı", en: "Supplier penalty — supplier share" },
  PLATFORM_PENALTY_SHARE_REVERSAL: { ru: "Сторно штрафа клиента", az: "Müştəri cəriməsinin ləğvi", en: "Client penalty reversal" },
  SUPPLIER_PENALTY_SHARE_REVERSAL: { ru: "Сторно штрафа поставщика", az: "Təchizatçı cəriməsinin ləğvi", en: "Supplier penalty reversal" },
  UNPAID_WRITE_OFF: { ru: "Списание неоплаченной суммы", az: "Ödənilməmiş məbləğin silinməsi", en: "Unpaid amount write-off" },
  CLIENT_DEBT_WRITE_OFF: { ru: "Списание долга клиента", az: "Müştəri borcunun silinməsi", en: "Client debt write-off" },
  SUPPLIER_DEBT_WRITE_OFF: { ru: "Списание долга поставщику", az: "Təchizatçı borcunun silinməsi", en: "Supplier debt write-off" },
};

const SOURCE_LABELS: Record<string, { ru: string; az: string; en: string }> = {
  PAYMENT: { ru: "Платёж", az: "Ödəniş", en: "Payment" },
  REFUND: { ru: "Возврат", az: "Qaytarma", en: "Refund" },
  SUPPLIER_PAYOUT: { ru: "Платёж поставщику", az: "Təchizatçıya ödəniş", en: "Supplier payout" },
  OBLIGATION: { ru: "Обязательство", az: "Öhdəlik", en: "Obligation" },
  ORDER_FINANCIAL_ADJUSTMENT: { ru: "Финансовая корректировка", az: "Maliyyə düzəlişi", en: "Financial adjustment" },
  CLIENT_DEBT_WRITE_OFF: { ru: "Списание долга клиента", az: "Müştəri borcunun silinməsi", en: "Client debt write-off" },
  SUPPLIER_DEBT_WRITE_OFF: { ru: "Списание долга поставщику", az: "Təchizatçı borcunun silinməsi", en: "Supplier debt write-off" },
};

export default function FinanceLedgerPage() {
  const locale = useLocale();
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

  const label = (map: Record<string, { ru: string; az: string; en: string }>, code: string) =>
    map[code]?.[locale] ?? code;

  return (
    <div>
      <PageHeader
        title={t("nav.ledger", locale)}
        breadcrumbs={["Navitravel", t("nav.group.finance", locale), t("nav.ledger", locale)]}
      />
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          placeholder={t("ledger.filter.type", locale)}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          value={sourceType}
          onChange={(e) => { setSourceType(e.target.value); setPage(1); }}
          placeholder={t("ledger.filter.source", locale)}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void load()} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">
          {t("admin.table.refresh", locale)}
        </button>
        <span className="text-sm text-ink/60">{t("ledger.total", locale)}: {total}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-ink/60">
            <tr>
              <th className="px-3 py-2">{t("ledger.column.code", locale)}</th>
              <th className="px-3 py-2">{t("ledger.column.type", locale)}</th>
              <th className="px-3 py-2 text-right">{t("ledger.column.amount", locale)}</th>
              <th className="px-3 py-2">{t("ledger.column.source", locale)}</th>
              <th className="px-3 py-2">{t("ledger.column.business_ref", locale)}</th>
              <th className="px-3 py-2">{t("ledger.column.date", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink/60">{t("state.loading", locale)}</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink/60">{t("ledger.empty", locale)}</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-3 py-2">{label(TYPE_LABELS, row.type)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPrice(row.amount, row.currency, locale) ?? row.amount}</td>
                <td className="px-3 py-2 text-xs">{label(SOURCE_LABELS, row.sourceType)}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.businessRef ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{formatDate(row.occurredAt ?? row.createdAt, locale) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">
          {t("pagination.prev", locale)}
        </button>
        <span className="text-sm text-ink/60">{t("pagination.page", locale)} {page}</span>
        <button type="button" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">
          {t("pagination.next", locale)}
        </button>
      </div>
    </div>
  );
}
