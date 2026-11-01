"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice, t, useLocale } from "@/lib/i18n";
import {
  financeCenterApi,
  type SupplierObligation,
  type SupplierPayment,
} from "@/lib/finance-center-api";

/**
 * Order/booking-scoped supplier payments.
 *
 * The operator selects the client order/booking (already fixed by the page)
 * and the exact obligation to pay; the backend links the payout to
 * order/booking/customer and generates SPO-<order id>-<ordinal>.
 */
export default function SupplierPaymentsPanel({
  orderId,
  orderCode,
  bookingId,
  bookingCode,
  onClose,
  compact = false,
}: {
  orderId: string;
  orderCode: string;
  bookingId?: string;
  bookingCode?: string;
  onClose?: () => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  const [obligations, setObligations] = useState<SupplierObligation[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(compact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    obligationCode: "",
    direction: "OUTGOING" as "OUTGOING" | "INCOMING",
    amount: "",
    method: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [obligationResult, paymentResult] = await Promise.all([
        financeCenterApi.listObligations({ orderId, pageSize: 200 }),
        financeCenterApi.listSupplierPayments({
          orderId,
          bookingId,
          pageSize: 100,
        }),
      ]);
      setObligations(
        obligationResult.items.filter(
          (item) =>
            !["CLOSED", "CANCELLED"].includes(item.status) &&
            Number(item.remainingAmount ?? 0) > 0 &&
            (!bookingId || item.bookingId === bookingId),
        ),
      );
      setPayments(paymentResult.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId, bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.obligationCode && obligations.length > 0) {
      setForm((current) => ({ ...current, obligationCode: obligations[0].code }));
    }
  }, [obligations, form.obligationCode]);

  const selected = useMemo(
    () => obligations.find((item) => item.code === form.obligationCode) ?? null,
    [obligations, form.obligationCode],
  );
  const paidAzn = payments
    .filter((payment) => payment.status === "CONFIRMED")
    .reduce((sum, payment) => sum + Number(payment.aznAmount), 0);
  const remainingAzn = obligations.reduce(
    (sum, item) => sum + Number(item.remainingAmount ?? 0),
    0,
  );

  const submit = async () => {
    if (!form.amount || (form.direction === "OUTGOING" && !selected)) return;
    setBusy(true);
    setError("");
    try {
      await financeCenterApi.createSupplierPayment({
        supplierCode: selected?.supplierCode ?? obligations[0]?.supplierCode ?? undefined,
        direction: form.direction,
        orderId,
        amount: form.amount,
        currency: "AZN",
        method: form.method || undefined,
        purpose: `${form.direction === "INCOMING" ? "Supplier refund" : "Supplier payment"} ${orderCode}`,
        comment: form.reason || undefined,
        allocations:
          form.direction === "OUTGOING" && selected
            ? [{ obligationCode: selected.code, amount: form.amount }]
            : undefined,
      });
      setForm({ obligationCode: "", direction: form.direction, amount: "", method: "", reason: "" });
      setOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Платежи поставщикам</h3>
          <p className="mt-1 text-xs text-slate-500">
            {orderCode}
            {bookingCode ? ` · ${bookingCode}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Оплачено: <b className="text-slate-800">{formatPrice(paidAzn.toFixed(2), "AZN", locale) ?? "—"}</b></span>
          <span className="text-amber-700">Осталось: <b>{formatPrice(remainingAzn.toFixed(2), "AZN", locale) ?? "—"}</b></span>
          <button
            type="button"
            disabled={obligations.length === 0 || loading}
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 disabled:opacity-50"
          >
            + Платёж поставщику
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="mb-2 flex gap-1 rounded-lg bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setForm({ ...form, direction: "OUTGOING" })}
              className={`rounded-md px-3 py-1.5 font-medium ${form.direction === "OUTGOING" ? "bg-rose-100 text-rose-700" : "text-slate-500"}`}
            >
              Расход · платёж поставщику
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, direction: "INCOMING" })}
              className={`rounded-md px-3 py-1.5 font-medium ${form.direction === "INCOMING" ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}`}
            >
              Приход · возврат от поставщика
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            {form.direction === "OUTGOING" && (
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600">
                {selected ? `Услуга: ${selected.supplierCode ?? "—"} · остаток ${formatPrice(selected.remainingAmount ?? "0", "AZN", locale) ?? "—"}` : "Услуга не выбрана"}
              </div>
            )}
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="Сумма, AZN"
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
            />
            <input
              value={form.method}
              onChange={(event) => setForm({ ...form, method: event.target.value })}
              placeholder={t("finance.supplier_payments.field.method", locale)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
            />
            <button
              type="button"
              disabled={busy || !form.amount || (form.direction === "OUTGOING" && !selected)}
              onClick={() => void submit()}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "…" : "Записать"}
            </button>
          </div>
          <input
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="Основание / комментарий"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
          />
          {form.direction === "OUTGOING" && selected && (
            <p className="mt-2 text-[11px] text-slate-500">
              Заказ: {selected.orderCode ?? orderCode} · Бронь: {selected.bookingCode ?? selected.bookingId} · Поставщик: {selected.supplierCode ?? "—"} · Остаток: {formatPrice(selected.remainingAmount ?? "0", "AZN", locale)}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {!compact && (loading ? (
        <p className="mt-3 text-xs text-slate-400">Загрузка…</p>
      ) : payments.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">Платежей поставщикам по этому заказу пока нет.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2">Оплата</th>
                <th className="py-2">Заказ / бронь</th>
                <th className="py-2">Поставщик</th>
                <th className="py-2 text-right">Сумма</th>
                <th className="py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-50">
                  <td className="py-2 font-mono text-slate-700">{payment.code}</td>
                  <td className="py-2 text-slate-500">{payment.orderCode ?? orderCode}{payment.bookingCode ? ` · ${payment.bookingCode}` : ""}</td>
                  <td className="py-2 text-slate-600">{payment.supplierCode ?? "—"}</td>
                  <td className="py-2 text-right text-slate-700">{formatPrice(payment.amount, payment.currency, locale)}</td>
                  <td className="py-2 text-slate-600">{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
