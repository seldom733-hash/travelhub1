"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, t, useLocale } from "@/lib/i18n";
import {
  financeCenterApi,
  type SupplierObligation,
} from "@/lib/finance-center-api";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import { financeFxApi, type FxSupplier } from "@/lib/finance-fx-api";

/**
 * Supplier payment form — deliberately mirrors CreatePaymentForm (client
 * payment), with two differences:
 *   - the financial headline is «Себестоимость» (supplier cost), not order price;
 *   - directions are reversed: EXPENSE = payment to supplier, INCOME = supplier refund.
 *
 * Order/booking is fixed by the page and is never selected here.
 */
export default function CreateSupplierPaymentForm({
  orderId,
  orderCode,
  bookingId,
  bookingCode,
  fallbackCost,
  onClose,
  onCreated,
}: {
  orderId: string;
  orderCode: string;
  bookingId?: string;
  bookingCode?: string;
  /** Order/booking amount used when no supplier obligations exist yet. */
  fallbackCost?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const locale = useLocale();
  const [obligations, setObligations] = useState<SupplierObligation[]>([]);
  const [payments, setPayments] = useState<Array<{ aznAmount: string; status: string; direction?: string }>>([]);
  const [suppliers, setSuppliers] = useState<FxSupplier[]>([]);
  const [supplierCode, setSupplierCode] = useState("");
  const [direction, setDirection] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const amountTouchedRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    financeFxApi.suppliers()
      .then((rows) => {
        setSuppliers(rows);
        setSupplierCode((current) => current || rows[0]?.supplierCode || "");
      })
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    let alive = true;
    financeCenterApi.listObligations({ orderId, pageSize: 200 })
      .then((result) => {
        if (!alive) return;
        const rows = result.items.filter(
          (item) =>
            !["CLOSED", "CANCELLED"].includes(item.status) &&
            (!bookingId || item.bookingId === bookingId),
        );
        setObligations(rows);
        setSupplierCode((current) => current || rows[0]?.supplierCode || "");
      })
      .catch(() => {
        if (!alive) return;
        setObligations([]);
      });
    financeCenterApi.listSupplierPayments({ orderId, pageSize: 100 })
      .then((result) => { if (alive) setPayments(result.items); })
      .catch(() => { if (alive) setPayments([]); });
    return () => { alive = false; };
  }, [orderId, bookingId, fallbackCost]);

  const selected = useMemo(() => {
    const open = obligations.filter((item) => Number(item.remainingAmount ?? 0) > 0);
    return open[0] ?? obligations[0] ?? null;
  }, [obligations]);

  const cost = obligations.length > 0
    ? obligations.reduce((sum, item) => sum + Number(item.aznAmount ?? 0), 0)
    : Number(fallbackCost ?? 0);
  const activePayments = payments.filter((payment) => !["CANCELLED", "FAILED"].includes(payment.status));
  const paid = activePayments
    .filter((payment) => payment.direction !== "INCOMING")
    .reduce((sum, payment) => sum + Number(payment.aznAmount), 0);
  const refunded = activePayments
    .filter((payment) => payment.direction === "INCOMING")
    .reduce((sum, payment) => sum + Number(payment.aznAmount), 0);
  const remaining = Math.max(0, cost - paid + refunded);

  useEffect(() => {
    if (!amountTouchedRef.current) setAmount(remaining.toFixed(2));
  }, [remaining]);

  const amountValue = Number(amount);
  const amountValid =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    (direction === "INCOME" || obligations.length === 0 || amountValue <= remaining + 0.005);
  const canSubmit =
    !busy &&
    Boolean(orderId) &&
    reason.trim().length > 0 &&
    reason.trim().length <= 255 &&
    amountValid &&
    Boolean(supplierCode);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await financeCenterApi.createSupplierPayment({
        supplierCode: supplierCode || selected?.supplierCode || undefined,
        direction: direction === "INCOME" ? "INCOMING" : "OUTGOING",
        orderId,
        bookingId,
        amount,
        currency: "AZN",
        method: paymentMethod,
        purpose: `${direction === "INCOME" ? "Supplier refund" : "Supplier payment"} ${orderCode}${bookingCode ? ` / ${bookingCode}` : ""}`,
        comment: [reason.trim(), note].filter(Boolean).join(" · ") || undefined,
        allocations:
          direction === "EXPENSE" && selected
            ? [{ obligationCode: selected.code, amount }]
            : undefined,
      });
      setSuccess(true);
      onCreated?.();
      setTimeout(onClose, 900);
    } catch (e) {
      setError((e as Error).message || "Не удалось создать платёж поставщику");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Создать платёж поставщику"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-900">Создать платёж поставщику</h2>

        {success ? (
          <div className="space-y-4">
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Платёж поставщику создан.
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setDirection("EXPENSE")}
                className={`flex-1 rounded-md px-3 py-2 font-semibold ${direction === "EXPENSE" ? "bg-rose-100 text-rose-700" : "text-slate-500"}`}
              >
                Расход · платёж поставщику
              </button>
              <button
                type="button"
                onClick={() => setDirection("INCOME")}
                className={`flex-1 rounded-md px-3 py-2 font-semibold ${direction === "INCOME" ? "bg-emerald-100 text-emerald-800" : "text-slate-500"}`}
              >
                Приход · возврат от поставщика
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Заказ</label>
              <input value={`${orderCode}${bookingCode ? ` · ${bookingCode}` : ""}`} readOnly disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="supplier-payment-supplier">
                Поставщик
              </label>
              <select
                id="supplier-payment-supplier"
                value={supplierCode}
                onChange={(event) => setSupplierCode(event.target.value)}
                disabled={busy || suppliers.length === 0 || obligations.length > 0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Выберите поставщика</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplierCode} value={supplier.supplierCode}>
                    {supplier.partnerName ? `${supplier.partnerName} (${supplier.supplierCode})` : supplier.supplierCode}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
              <div>
                <div className="font-semibold uppercase tracking-wide text-slate-500">Себестоимость</div>
                <div className="mt-1 font-semibold text-slate-900">{formatPrice(cost.toFixed(2), "AZN", locale) ?? "—"}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-slate-500">Оплачено</div>
                <div className="mt-1 font-semibold text-emerald-700">{formatPrice(paid.toFixed(2), "AZN", locale) ?? "—"}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-slate-500">Осталось</div>
                <div className="mt-1 font-semibold text-amber-700">{formatPrice(remaining.toFixed(2), "AZN", locale) ?? "—"}</div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="supplier-payment-amount">
                Сумма платежа *
              </label>
              <input
                id="supplier-payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  amountTouchedRef.current = true;
                  setAmount(event.target.value);
                }}
                disabled={busy}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-1 text-xs text-slate-400">
                {direction === "EXPENSE" ? "Не больше остатка к оплате поставщику" : "Сумма возврата от поставщика"}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="supplier-payment-method">
                {t("payments.create.method", locale)}
              </label>
              <select
                id="supplier-payment-method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                disabled={busy}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`payments.create.method.${method}`, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="supplier-payment-reason">
                Причина *
              </label>
              <input
                id="supplier-payment-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                maxLength={255}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-1 text-xs text-slate-400">Обязательно, 1–255 символов</div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="supplier-payment-note">
                Примечание
              </label>
              <textarea
                id="supplier-payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={busy}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            {direction === "EXPENSE" && obligations.length === 0 && (
              <p className="text-xs text-slate-500">
                По заказу нет обязательств — платёж будет создан без распределения, только с привязкой к заказу.
              </p>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : "Создать"}
              </button>
              <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
