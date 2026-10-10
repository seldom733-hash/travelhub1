"use client";

/**
 * MULTI/PARTIAL §7 — canonical payments table, единый контракт колонок:
 *   № | Дата | Сумма | Остаток | Форма оплаты | Статус | Кто принял
 *
 * Используется в трёх контекстах:
 *   - реестр /app/payments (серверная enrichment-строка + сортировка/фильтры);
 *   - Order detail (источник GET /orders/:id/financial-history);
 *   - Booking detail (тот же источник через linked Order, permission-tolerant).
 *
 * Код платежа, заказ и валюта НЕ вытесняют обязательные колонки — они
 * показываются внутри ячеек (№: ordinal + code-ссылка + ref заказа;
 * Сумма/Остаток: fmtMoney с валютой).
 *
 * buildPaymentsTableRows — клиентское зеркало серверной enrichment-логики
 * (payment.service list): хронологический № 1..N по заказу, накопленная
 * оплата Σ(CAPTURED, REFUNDED), remainingAfter = max(0, total − paid) на
 * момент строки, acceptedBy = первый PaymentHistory action='created'.
 */

import Link from "next/link";
import { useState } from "react";
import SortableHeader, { type SortState, type SortDirection } from "@/components/SortableHeader";
import StatusBadge from "@/components/StatusBadge";
import { OperationsEmptyState } from "@/components/OperationsCenterShell";
import { t, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { fmtDate } from "@/lib/temporal-display";
import { useCan } from "@/lib/use-can";
import { confirmPayment, cancelPayment } from "@/lib/payments";

// ── Row model ───────────────────────────────────────────────────────────────

export interface PaymentsTableRow {
  id: string;
  /** Хронологический № платежа внутри заказа (1..N). */
  ordinal: number | null;
  code: string;
  referenceNumber?: string | null;
  createdAt: string;
  amount: string;
  currency: string | null;
  paymentMethod: string | null;
  status: string;
  acceptedBy: string | null;
  /** Остаток к оплате ПОСЛЕ этого платежа (total − Σ CAPTURED/REFUNDED). */
  remainingAfter: string | null;
  /** Ссылка на карточку платежа (реестр). */
  paymentHref?: string | null;
  /** Контекст заказа (реестр): ссылка + подпись. */
  orderHref?: string | null;
  orderLabel?: string | null;
}

/** Минимальная форма платёжной строки financial-history (структурная). */
export interface PaymentsTableSourcePayment {
  id: string;
  code: string;
  status: string;
  amount: string;
  createdAt: string;
  currency?: string | null;
  referenceNumber?: string | null;
  paymentMethod?: string | null;
}

/** Минимальная форма события PaymentHistory (структурная). */
export interface PaymentsTableSourceEvent {
  paymentId: string;
  action: string;
  actorName?: string | null;
}

/** Целочисленные копейки — без FP-погрешностей. */
function toCents(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Клиентское зеркало серверной enrichment-логики §7 (см. шапку файла).
 * Данные НЕ пересчитывают серверные значения реестра — оно применяется
 * только там, где источник (financial-history) не отдаёт enrichment.
 */
export function buildPaymentsTableRows(opts: {
  payments: PaymentsTableSourcePayment[];
  history?: PaymentsTableSourceEvent[];
  orderTotal?: string | number | null;
}): PaymentsTableRow[] {
  const asc = [...opts.payments].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const createdActors = new Map<string, string | null>();
  for (const h of opts.history ?? []) {
    if (h.action === "created" && !createdActors.has(h.paymentId)) {
      createdActors.set(h.paymentId, h.actorName ?? null);
    }
  }

  const totalRaw = opts.orderTotal == null ? null : String(opts.orderTotal);
  const totalCents = totalRaw !== null && totalRaw !== "" ? toCents(totalRaw) : null;
  let paidCents = 0;
  let ordinal = 0;

  return asc.map((p) => {
    ordinal += 1;
    if (p.status === "CAPTURED" || p.status === "REFUNDED") {
      paidCents += toCents(p.amount) ?? 0;
    }
    let remainingAfter: string | null = null;
    if (totalCents !== null) {
      const rest = Math.max(0, totalCents - paidCents);
      remainingAfter = String(rest / 100);
    }
    return {
      id: p.id,
      ordinal,
      code: p.code,
      referenceNumber: p.referenceNumber ?? null,
      createdAt: p.createdAt,
      amount: p.amount,
      currency: p.currency ?? null,
      paymentMethod: p.paymentMethod ?? null,
      status: p.status,
      acceptedBy: createdActors.get(p.id) ?? null,
      remainingAfter,
    };
  });
}

// ── Cell helpers ────────────────────────────────────────────────────────────

function fmtMoney(amount: string | number | null | undefined, currency: string | null | undefined, locale: Locale): string {
  if (amount == null) return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return String(amount);
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

function statusLabel(code: string, locale: Locale): string {
  const key = `status.entity.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Известные значения метода локализуемся, остальные — как пришло. */
function methodLabel(method: string | null, locale: Locale): string {
  if (!method) return "—";
  const key = `payments.create.method.${method.toLowerCase()}`;
  const localized = t(key, locale);
  return localized !== key ? localized : method;
}

// ── Table ───────────────────────────────────────────────────────────────────

interface PaymentsTableProps {
  rows: PaymentsTableRow[];
  locale: Locale;
  /** Пустое состояние (реестр передаёт translations; detail-страницы по умолчанию). */
  emptyMessage?: string;
  /** Реестр: состояние сортировки; null = не отсортировано. */
  sortState?: SortState | null;
  /** Реестр: обработчик сортировки; если не задан — заголовки статичные. */
  onSort?: (field: string, direction: SortDirection) => void;
  /** Реестр: slot фильтра в заголовке «Сумма» (фильтр по валюте). */
  amountHeaderExtra?: React.ReactNode;
  /** Реестр: slot фильтра в заголовке «Статус». */
  statusHeaderExtra?: React.ReactNode;
  /** confirm/cancel успешен — родитель перезагружает данные (реестр/Order/Booking). */
  onActionCompleted?: () => void;
}

export default function PaymentsTable({
  rows,
  locale,
  emptyMessage,
  sortState,
  onSort,
  amountHeaderExtra,
  statusHeaderExtra,
  onActionCompleted,
}: PaymentsTableProps) {
  // Статусные действия — только finance.payment.manage (ADMIN/FINANCE).
  const canManage = useCan("finance.payment.manage");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; detail: string } | null>(null);

  const runAction = async (row: PaymentsTableRow, action: "confirm" | "cancel") => {
    setActionBusyId(row.id);
    setActionError(null);
    try {
      if (action === "confirm") await confirmPayment(row.code);
      else await cancelPayment(row.code);
      onActionCompleted?.();
    } catch (e) {
      setActionError({ id: row.id, detail: (e as Error).message });
    } finally {
      setActionBusyId(null);
    }
  };

  const plainTh = (label: string, alignRight = false) => (
    <th className={`px-4 py-2.5 font-medium${alignRight ? " text-right" : ""}`}>{label}</th>
  );

  const dateTh = onSort ? (
    <SortableHeader field="createdAt" currentSort={sortState ?? null} onSort={onSort}>
      {t("payments.table.col_date", locale)}
    </SortableHeader>
  ) : (
    plainTh(t("payments.table.col_date", locale))
  );
  const amountTh = onSort ? (
    <SortableHeader field="amount" currentSort={sortState ?? null} onSort={onSort} alignRight filterSlot={amountHeaderExtra}>
      {t("payments.col.amount", locale)}
    </SortableHeader>
  ) : (
    plainTh(t("payments.col.amount", locale), true)
  );
  const statusTh = onSort ? (
    <SortableHeader field="status" currentSort={sortState ?? null} onSort={onSort} filterSlot={statusHeaderExtra}>
      {t("payments.col.status", locale)}
    </SortableHeader>
  ) : (
    plainTh(t("payments.col.status", locale))
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }} data-testid="payments-table">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("payments.table.col_ordinal", locale)}</th>
            {dateTh}
            {amountTh}
            {plainTh(t("payments.col.remaining", locale), true)}
            {plainTh(t("payments.table.col_method", locale))}
            {statusTh}
            {plainTh(t("payments.col.accepted_by", locale))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const codeLabel = row.referenceNumber ?? row.code;
            return (
              <tr key={row.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/30" data-testid="payments-table-row">
                <td className="px-4 py-2.5 align-top">
                  <div className="text-sm font-medium text-slate-700">{row.ordinal ?? "—"}</div>
                  <div className="truncate font-mono text-[10px] text-slate-400" title={row.code}>
                    {row.paymentHref ? (
                      <Link href={row.paymentHref} className="text-blue-600 hover:underline">
                        {codeLabel}
                      </Link>
                    ) : (
                      codeLabel
                    )}
                  </div>
                  {row.orderHref && row.orderLabel && (
                    <div className="truncate font-mono text-[10px] text-slate-400">
                      <Link href={row.orderHref} className="text-blue-600 hover:underline">
                        {row.orderLabel}
                      </Link>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top text-xs text-slate-500">{fmtDate(row.createdAt, locale)}</td>
                <td className="px-4 py-2.5 text-right align-top font-medium text-slate-700">
                  {fmtMoney(row.amount, row.currency, locale)}
                </td>
                <td className="px-4 py-2.5 text-right align-top text-slate-600">
                  {row.remainingAfter != null ? fmtMoney(row.remainingAfter, row.currency, locale) : "—"}
                </td>
                <td className="px-4 py-2.5 align-top text-xs text-slate-500">{methodLabel(row.paymentMethod, locale)}</td>
                <td className="px-4 py-2.5 align-top">
                  <StatusBadge status={row.status} label={statusLabel(row.status, locale)} />
                  {canManage && row.status === "PENDING" && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button
                        type="button"
                        data-testid="payment-confirm-button"
                        disabled={actionBusyId !== null}
                        onClick={() => void runAction(row, "confirm")}
                        className="rounded border border-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {t("payments.action.confirm", locale)}
                      </button>
                      <button
                        type="button"
                        data-testid="payment-cancel-button"
                        disabled={actionBusyId !== null}
                        onClick={() => void runAction(row, "cancel")}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {t("payments.action.cancel", locale)}
                      </button>
                    </div>
                  )}
                  {actionError?.id === row.id && (
                    <div
                      className="mt-1 text-[10px] text-red-500"
                      data-testid="payment-action-error"
                      title={actionError.detail}
                    >
                      {t("payments.action.error", locale)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top text-xs text-slate-500">{row.acceptedBy ?? "—"}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <OperationsEmptyState colSpan={7} message={emptyMessage ?? t("payments.table.empty", locale)} />
          )}
        </tbody>
      </table>
    </div>
  );
}
