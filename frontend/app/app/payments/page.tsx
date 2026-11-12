"use client";

import { useEffect, useMemo, useState } from "react";
import OperationsCenterShell from "@/components/OperationsCenterShell";
import { api } from "@/lib/api";
import { useLocale, formatPrice, formatDate } from "@/lib/i18n";

type Tab = "clients" | "suppliers";

interface ClientPayment {
  id: string;
  code: string;
  referenceNumber: string | null;
  orderId: string;
  orderReference: string | null;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  status: string;
  acceptedBy: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface ClientRefund {
  id: string;
  code: string;
  referenceNumber: string | null;
  orderId: string;
  orderCode: string | null;
  dealNumber: string | null;
  amount: string;
  currency: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

interface SupplierPayment {
  id: string;
  code: string;
  orderId: string | null;
  orderCode: string | null;
  direction: "OUTGOING" | "INCOMING";
  amount: string;
  currency: string;
  method: string | null;
  status: string;
  confirmedBy?: string | null;
  occurredAt: string;
  createdAt: string;
}

interface TableRow {
  id: string;
  deal: string;
  code: string;
  date: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  acceptedBy: string;
  kind: "payment" | "refund";
}

const CLIENT_STATUS: Record<string, string> = {
  PENDING: "Ожидает",
  AUTHORIZED: "Авторизован",
  CAPTURED: "Принят",
  PAID: "Оплачен",
  FAILED: "Ошибка",
  CANCELLED: "Отменён",
  REFUNDED: "Возвращён",
  REQUESTED: "Отправлен на согласование",
  APPROVED: "Согласован",
  PROCESSED: "Исполнен",
};

const SUPPLIER_STATUS: Record<string, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждён",
  CANCELLED: "Отменён",
  FAILED: "Ошибка",
};

const METHOD: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  bank_transfer: "Банковский перевод",
  bank: "Банковский перевод",
  online: "Онлайн",
  other: "Другое",
};

function statusLabel(value: string, kind: Tab): string {
  return (kind === "clients" ? CLIENT_STATUS : SUPPLIER_STATUS)[value] ?? value;
}

function methodLabel(value: string | null): string {
  if (!value) return "—";
  return METHOD[value] ?? value;
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return formatDate(value, "ru") ?? new Date(value).toLocaleDateString("ru-RU");
}

export default function PaymentsAndRefundsPage() {
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("clients");
  const [clientRows, setClientRows] = useState<TableRow[]>([]);
  const [supplierRows, setSupplierRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const load = async () => {
      if (tab === "clients") {
        const [payments, refunds] = await Promise.all([
          api.get<{ items: ClientPayment[] }>("/finance/payments?pageSize=100"),
          api.get<{ items: ClientRefund[] }>("/finance/refunds?pageSize=100"),
        ]);
        if (!alive) return;
        const payRows: TableRow[] = (payments.items ?? []).map((p) => ({
          id: `pay-${p.id}`,
          deal: p.orderReference ?? p.orderId,
          code: p.referenceNumber ?? p.code,
          date: p.paidAt ?? p.createdAt,
          amount: p.amount,
          currency: p.currency,
          method: methodLabel(p.paymentMethod),
          status: statusLabel(p.status, "clients"),
          acceptedBy: p.acceptedBy ?? "—",
          kind: "payment",
        }));
        const refundRows: TableRow[] = (refunds.items ?? []).map((r) => ({
          id: `ref-${r.id}`,
          deal: r.orderCode ?? r.dealNumber ?? r.orderId,
          code: r.referenceNumber ?? r.code,
          date: r.processedAt ?? r.createdAt,
          amount: r.amount,
          currency: r.currency,
          method: "—",
          status: statusLabel(r.status, "clients"),
          acceptedBy: "—",
          kind: "refund",
        }));
        setClientRows([...payRows, ...refundRows].sort((a, b) => +new Date(b.date) - +new Date(a.date)));
      } else {
        const data = await api.get<{ items: SupplierPayment[] }>("/finance/supplier-payments?pageSize=100");
        if (!alive) return;
        const supplierRows: TableRow[] = (data.items ?? []).map((p) => ({
          id: `sup-${p.id}`,
          deal: p.orderCode ?? p.orderId ?? "—",
          code: p.code,
          date: p.occurredAt ?? p.createdAt,
          amount: p.amount,
          currency: p.currency,
          method: methodLabel(p.method),
          status: statusLabel(p.status, "suppliers"),
          acceptedBy: p.confirmedBy ?? "—",
          kind: p.direction === "INCOMING" ? "refund" : "payment",
        }));
        setSupplierRows(supplierRows.sort((a, b) => +new Date(b.date) - +new Date(a.date)));
      }
    };
    void load()
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab]);

  const rows = useMemo(() => (tab === "clients" ? clientRows : supplierRows), [tab, clientRows, supplierRows]);

  return (
    <OperationsCenterShell activeDomain="payments" visibleDomains={["payments"]}>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Платежи и возвраты</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Платежи и возвраты клиентов и расчёты с поставщиками.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            data-testid="payments-tab-clients"
            onClick={() => setTab("clients")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === "clients" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Платежи и возвраты (клиенты)
          </button>
          <button
            type="button"
            data-testid="payments-tab-suppliers"
            onClick={() => setTab("suppliers")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === "suppliers" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Платежи и возвраты (поставщики)
          </button>
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Номер сделки</th>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Дата</th>
                  <th className="px-4 py-2.5 text-right font-medium">Сумма</th>
                  <th className="px-4 py-2.5 font-medium">Форма оплаты</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Кто принял</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Загрузка…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Записей нет</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{row.deal}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${row.kind === "refund" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {row.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{dateLabel(row.date)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatPrice(row.amount, row.currency, locale) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.method}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{row.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{row.acceptedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OperationsCenterShell>
  );
}
