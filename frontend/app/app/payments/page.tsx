"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OperationsCenterShell from "@/components/OperationsCenterShell";
import Pagination from "@/components/Pagination";
import { api } from "@/lib/api";
import { useLocale, formatPrice, formatDate } from "@/lib/i18n";
import DateTextInput from "@/components/forms/DateTextInput";
import { useCan } from "@/lib/use-can";

type Tab = "clients" | "suppliers";

interface ClientPayment {
  id: string;
  code: string;
  referenceNumber: string | null;
  orderId: string;
  orderReference: string | null;
  dealNumber?: string | null;
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
  dealNumber?: string | null;
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

const TEXT: Record<string, { az: string; en: string }> = {
  "Платежи и возвраты": { az: "Ödənişlər və qaytarmalar", en: "Payments and refunds" },
  "Платежи и возвраты клиентов и расчёты с поставщиками.": { az: "Müştəri ödənişləri, qaytarmalar və təchizatçı hesablaşmaları.", en: "Client payments and refunds, supplier settlements." },
  "Платежи и возвраты (клиенты)": { az: "Ödənişlər və qaytarmalar (müştərilər)", en: "Payments and refunds (clients)" },
  "Платежи и возвраты (поставщики)": { az: "Ödənişlər və qaytarmalar (təchizatçılar)", en: "Payments and refunds (suppliers)" },
  "Управление возвратами": { az: "Qaytarmaların idarəsi", en: "Manage refunds" },
  "Поиск по номеру оплаты": { az: "Ödəniş nömrəsi ilə axtarış", en: "Search by payment number" },
  "Дата оплаты с": { az: "Ödəniş tarixi (başlanğıc)", en: "Payment date from" },
  "Дата оплаты по": { az: "Ödəniş tarixi (son)", en: "Payment date to" },
  "Сбросить": { az: "Sıfırla", en: "Reset" },
  "Номер сделки": { az: "Sövdə nömrəsi", en: "Deal number" },
  "Код": { az: "Kod", en: "Code" },
  "Дата": { az: "Tarix", en: "Date" },
  "Сумма": { az: "Məbləğ", en: "Amount" },
  "Форма оплаты": { az: "Ödəniş forması", en: "Payment method" },
  "Статус": { az: "Status", en: "Status" },
  "Кто принял": { az: "Kim qəbul etdi", en: "Accepted by" },
  "Загрузка…": { az: "Yüklənir…", en: "Loading…" },
  "Записей нет": { az: "Qeyd yoxdur", en: "No records" },
  "Наличные": { az: "Nağd", en: "Cash" },
  "Карта": { az: "Kart", en: "Card" },
  "Банковский перевод": { az: "Bank köçürməsi", en: "Bank transfer" },
  "Онлайн": { az: "Onlayn", en: "Online" },
  "Другое": { az: "Digər", en: "Other" },
  "Ожидает": { az: "Gözləyir", en: "Pending" },
  "Авторизован": { az: "Avtorizasiya edilib", en: "Authorized" },
  "Принят": { az: "Qəbul edilib", en: "Accepted" },
  "Оплачен": { az: "Ödənilib", en: "Paid" },
  "Ошибка": { az: "Xəta", en: "Error" },
  "Отменён": { az: "Ləğv edilib", en: "Cancelled" },
  "Возвращён": { az: "Qaytarılıb", en: "Refunded" },
  "Отправлен на согласование": { az: "Təsdiqə göndərilib", en: "Submitted for approval" },
  "Согласован": { az: "Razılaşdırılıb", en: "Approved" },
  "Исполнен": { az: "İcra edilib", en: "Processed" },
  "Подтверждён": { az: "Təsdiqlənib", en: "Confirmed" },
};
const METHOD: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  bank_transfer: "Банковский перевод",
  bank: "Банковский перевод",
  online: "Онлайн",
  other: "Другое",
};

function statusLabel(value: string, kind: Tab, tr: (s: string) => string): string {
  return tr((kind === "clients" ? CLIENT_STATUS : SUPPLIER_STATUS)[value] ?? value);
}

function methodLabel(value: string | null, tr: (s: string) => string): string {
  if (!value) return "—";
  return tr(METHOD[value] ?? value);
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return formatDate(value, "ru") ?? new Date(value).toLocaleDateString("ru-RU");
}

export default function PaymentsAndRefundsPage() {
  const locale = useLocale();
  const canReadRefunds = useCan("finance.refund.read");
  const tr = (value: string) => locale === "az" ? TEXT[value]?.az ?? value : locale === "en" ? TEXT[value]?.en ?? value : value;
  const [tab, setTab] = useState<Tab>("clients");
  const [clientRows, setClientRows] = useState<TableRow[]>([]);
  const [supplierRows, setSupplierRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      const clientQ = new URLSearchParams();
      if (search.trim()) clientQ.set("search", search.trim());
      if (dateFrom) clientQ.set("dateFrom", dateFrom);
      if (dateTo) clientQ.set("dateTo", dateTo);
      if (dateFrom || dateTo) clientQ.set("dateField", "paidAt");
      const refundQ = new URLSearchParams();
      if (search.trim()) refundQ.set("search", search.trim());
      if (dateFrom) refundQ.set("from", dateFrom);
      if (dateTo) refundQ.set("to", dateTo);
      const supplierQ = new URLSearchParams();
      if (search.trim()) supplierQ.set("search", search.trim());
      if (dateFrom) supplierQ.set("from", dateFrom);
      if (dateTo) supplierQ.set("to", dateTo);
      async function fetchAll<T>(path: string, params: URLSearchParams, size: number): Promise<T[]> {
        const rows: T[] = [];
        let currentPage = 1;
        let total = Infinity;
        while (rows.length < total && currentPage <= 100) {
          const q = new URLSearchParams(params);
          q.set("page", String(currentPage));
          q.set("pageSize", String(size));
          const data = await api.get<{ items: T[]; total: number }>(`${path}?${q.toString()}`);
          rows.push(...(data.items ?? []));
          total = Number(data.total ?? rows.length);
          if (!data.items?.length) break;
          currentPage++;
        }
        return rows;
      }
      const load = async () => {
      if (tab === "clients") {
        const [paymentItems, refundItems] = await Promise.all([
          fetchAll<ClientPayment>("/finance/payments", clientQ, 100),
          fetchAll<ClientRefund>("/finance/refunds", refundQ, 100),
        ]);
        const payments = { items: paymentItems };
        const refunds = { items: refundItems };
        if (!alive) return;
        const payRows: TableRow[] = (payments.items ?? []).map((p) => ({
          id: `pay-${p.id}`,
          deal: p.dealNumber ?? p.orderReference ?? p.orderId,
          code: p.referenceNumber ?? p.code,
          date: p.paidAt ?? p.createdAt,
          amount: p.amount,
          currency: p.currency,
          method: methodLabel(p.paymentMethod, tr),
          status: statusLabel(p.status, "clients", tr),
          acceptedBy: p.acceptedBy ?? "—",
          kind: "payment",
        }));
        const refundRows: TableRow[] = (refunds.items ?? []).map((r) => ({
          id: `ref-${r.id}`,
          deal: r.dealNumber ?? r.orderCode ?? r.orderId,
          code: r.referenceNumber ?? r.code,
          date: r.processedAt ?? r.createdAt,
          amount: r.amount,
          currency: r.currency,
          method: "—",
          status: statusLabel(r.status, "clients", tr),
          acceptedBy: "—",
          kind: "refund",
        }));
        setClientRows([...payRows, ...refundRows].sort((a, b) => +new Date(b.date) - +new Date(a.date)));
      } else {
        const supplierItems = await fetchAll<SupplierPayment>("/finance/supplier-payments", supplierQ, 200);
        if (!alive) return;
        const supplierRows: TableRow[] = supplierItems.map((p) => ({
          id: `sup-${p.id}`,
          deal: p.dealNumber ?? p.orderCode ?? p.orderId ?? "—",
          code: p.code,
          date: p.occurredAt ?? p.createdAt,
          amount: p.amount,
          currency: p.currency,
          method: methodLabel(p.method, tr),
          status: statusLabel(p.status, "suppliers", tr),
          acceptedBy: p.confirmedBy ?? "—",
          kind: p.direction === "INCOMING" ? "refund" : "payment",
        }));
        setSupplierRows(supplierRows.sort((a, b) => +new Date(b.date) - +new Date(a.date)));
      }
    };
    void load()
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [tab, search, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [tab, search, dateFrom, dateTo]);
  const rows = useMemo(() => (tab === "clients" ? clientRows : supplierRows), [tab, clientRows, supplierRows]);
  const pagedRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);

  return (
    <OperationsCenterShell activeDomain="payments" visibleDomains={["payments"]} showPeriod={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{tr("Платежи и возвраты")}</h2>
            <p className="mt-0.5 text-sm text-ink/60">
              {tr("Платежи и возвраты клиентов и расчёты с поставщиками.")}
            </p>
          </div>
          {canReadRefunds && (
            <Link
              href="/app/finance/refunds"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-panel"
            >
              {tr("Управление возвратами")} →
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
          <button
            type="button"
            data-testid="payments-tab-clients"
            onClick={() => setTab("clients")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === "clients" ? "bg-brand/10 text-brand-dark" : "text-ink/60 hover:bg-panel"}`}
          >
            {tr("Платежи и возвраты (клиенты)")}
          </button>
          <button
            type="button"
            data-testid="payments-tab-suppliers"
            onClick={() => setTab("suppliers")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${tab === "suppliers" ? "bg-brand/10 text-brand-dark" : "text-ink/60 hover:bg-panel"}`}
          >
            {tr("Платежи и возвраты (поставщики)")}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3">
          <label className="grid gap-1 text-[11px] font-medium text-ink">{tr("Поиск по номеру оплаты")}<input data-testid="payments-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PAY-00019967 / RFD-... / SPO-..." className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm" /></label>
          <label className="grid gap-1 text-[11px] font-medium text-ink">{tr("Дата оплаты с")}<DateTextInput value={dateFrom} onChange={(v) => setDateFrom(v)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" /></label>
          <label className="grid gap-1 text-[11px] font-medium text-ink">{tr("Дата оплаты по")}<DateTextInput value={dateTo} onChange={(v) => setDateTo(v)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" /></label>
          <button type="button" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-ink/70 hover:bg-panel">{tr("Сбросить")}</button>
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-line bg-panel text-[10px] uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr("Номер сделки")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("Код")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("Дата")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr("Сумма")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("Форма оплаты")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("Статус")}</th>
                  <th className="px-4 py-2.5 font-medium">{tr("Кто принял")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/60">{tr("Загрузка…")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/60">{tr("Записей нет")}</td></tr>
                ) : pagedRows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-panel/60">
                    <td className="px-4 py-2.5 font-medium text-ink">{row.deal}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${row.kind === "refund" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {row.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/60">{dateLabel(row.date)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{formatPrice(row.amount, row.currency, locale) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink/60">{row.method}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-medium text-ink">{row.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/60">{row.acceptedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} locale={locale as "ru" | "az" | "en"} onPageChange={setPage} />
      </div>
    </OperationsCenterShell>
  );
}