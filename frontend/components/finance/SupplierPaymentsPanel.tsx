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
}: {
  orderId: string;
  orderCode: string;
  bookingId?: string;
  bookingCode?: string;
}) {
  const locale = useLocale();
  const [obligations, setObligations] = useState<SupplierObligation[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ obligationCode: "", amount: "", method: "" });

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
    if (!selected || !form.amount) return;
    setBusy(true);
    setError("");
    try {
      await financeCenterApi.createSupplierPayment({
        supplierCode: selected.supplierCode ?? undefined,
        amount: form.amount,
        currency: "AZN",
        method: form.method || undefined,
        purpose: `${orderCode}${bookingCode ? ` / ${bookingCode}` : ""}`,
        allocations: [{ obligationCode: selected.code, amount: form.amount }],
      });
      setForm({ obligationCode: "", amount: "", method: "" });
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
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            <select
              value={form.obligationCode}
              onChange={(event) => setForm({ ...form, obligationCode: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
            >
              <option value="">Выберите заказ / бронь клиента</option>
              {obligations.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.orderCode ?? orderCode} · {item.bookingCode ?? item.bookingId} · {item.supplierCode ?? "—"} · остаток {formatPrice(item.remainingAmount ?? "0", "AZN", locale) ?? "—"}
                </option>
              ))}
            </select>
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
              disabled={busy || !selected || !form.amount}
              onClick={() => void submit()}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "…" : "Записать"}
            </button>
          </div>
          {selected && (
            <p className="mt-2 text-[11px] text-slate-500">
              Заказ: {selected.orderCode ?? orderCode} · Бронь: {selected.bookingCode ?? selected.bookingId} · Поставщик: {selected.supplierCode ?? "—"} · Остаток: {formatPrice(selected.remainingAmount ?? "0", "AZN", locale)}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {loading ? (
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
      )}
    </div>
  );
}
