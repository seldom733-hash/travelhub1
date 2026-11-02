"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice, useLocale } from "@/lib/i18n";
import { financeCenterApi, type OrderFinancialSettlement } from "@/lib/finance-center-api";
import { useCan } from "@/lib/use-can";

/**
 * Cancellation settlement panel. Deliberately never derives CANCELLED → zero
 * by itself: a finance user confirms the final liability/penalty, and the
 * backend either closes the order financially or returns PENDING_SETTLEMENT.
 */
export default function OrderFinancialSettlementPanel({
  orderId,
  orderStatus,
  initial,
}: {
  orderId: string;
  orderStatus: string;
  initial?: OrderFinancialSettlement | null;
}) {
  const locale = useLocale();
  const canManage = useCan("finance.settlement.manage");
  const [settlement, setSettlement] = useState<OrderFinancialSettlement | null>(initial ?? null);
  const [preview, setPreview] = useState<OrderFinancialSettlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    finalCustomerLiability: "",
    penaltyAmount: "0",
    clientPenaltyAmount: "0",
    clientPenaltyStatus: "CONFIRMED",
    supplierPenaltyStatus: "CONFIRMED",
    platformPenaltyShare: "0",
    supplierPenaltyShare: "0",
    reason: "",
  });

  const terminal = ["CANCELLED", "FULFILLED", "CLOSED"].includes(orderStatus);
  const load = useCallback(async () => {
    try {
      setSettlement(await financeCenterApi.getOrderSettlement(orderId));
    } catch {
      setSettlement(null);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  if (!terminal) return null;

  const runPreview = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await financeCenterApi.previewOrderSettlement(orderId, form);
      setPreview(result);
      if (!form.finalCustomerLiability && result.finalCustomerLiability) {
        setForm((current) => ({ ...current, finalCustomerLiability: result.finalCustomerLiability ?? "" }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await financeCenterApi.confirmOrderSettlement(orderId, {
        ...form,
        reason: form.reason.trim(),
      });
      setSettlement(result);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refundClient = async () => {
    if (!shown || Number(shown.remainingToRefund) <= 0) return;
    setBusy(true);
    setError("");
    try {
      const payments = await financeCenterApi.listOrderPayments(orderId);
      const captured = payments.items.find((p) => p.status === "CAPTURED");
      if (!captured) throw new Error("Нет CAPTURED-платежа для возврата");
      const refund = await financeCenterApi.createRefund({
        paymentId: captured.id,
        amount: shown.remainingToRefund,
        reason: form.reason.trim() || "Возврат при отмене заказа",
      });
      await financeCenterApi.approveRefund(refund.code);
      await financeCenterApi.processRefund(refund.code);
      setPreview(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelPenalty = async (kind: "client" | "supplier") => {
    if (!settlement) return;
    if (!window.confirm(`Отменить штраф (${kind === "client" ? "клиент" : "поставщик"})?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await financeCenterApi.cancelOrderPenalty(orderId, {
        [kind]: true,
        reason: form.reason.trim() || "Отмена начисленного штрафа",
      });
      setSettlement(result);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shown = settlement ?? preview;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Финансовый расчёт отмены</h3>
        {shown?.status && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {shown.status}
          </span>
        )}
      </div>

      {shown && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div><div className="text-slate-400">Стоимость</div><div className="font-semibold">{formatPrice(shown.originalAmount, shown.currency, locale)}</div></div>
          <div><div className="text-slate-400">Получено</div><div className="font-semibold text-emerald-700">{formatPrice(shown.capturedAmount, shown.currency, locale)}</div></div>
          <div><div className="text-slate-400">Возвращено</div><div className="font-semibold text-rose-600">{formatPrice(shown.refundedAmount, shown.currency, locale)}</div></div>
          <div><div className="text-slate-400">Штраф</div><div className="font-semibold">{formatPrice(shown.penaltyAmount, shown.currency, locale)}</div></div>
          <div><div className="text-slate-400">Аннулировано</div><div className="font-semibold text-slate-700">{formatPrice(shown.annulledUnpaidAmount, shown.currency, locale)}</div></div>
          <div><div className="text-slate-400">К оплате / к возврату</div><div className="font-semibold">{formatPrice(shown.remainingToPay, shown.currency, locale)} / {formatPrice(shown.remainingToRefund, shown.currency, locale)}</div></div>
        </div>
      )}

      {settlement && canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {["CONFIRMED", "WITHHELD", "RECEIVED"].includes(settlement.clientPenaltyStatus) && Number(settlement.clientPenaltyAmount) > 0 && (
            <button type="button" disabled={busy} onClick={() => void cancelPenalty("client")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">
              Отменить штраф клиента
            </button>
          )}
          {["CONFIRMED", "WITHHELD", "RECEIVED"].includes(settlement.supplierPenaltyStatus) && Number(settlement.supplierPenaltyShare) > 0 && (
            <button type="button" disabled={busy} onClick={() => void cancelPenalty("supplier")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">
              Отменить штраф поставщика
            </button>
          )}
          {Number(settlement.remainingToRefund) > 0 && (
            <button type="button" disabled={busy} onClick={() => void refundClient()} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
              Вернуть клиенту {settlement.remainingToRefund} {settlement.currency}
            </button>
          )}
        </div>
      )}

      {!settlement && canManage && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={form.finalCustomerLiability} onChange={(e) => setForm({ ...form, finalCustomerLiability: e.target.value })} placeholder="Окончательное обязательство клиента" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <input value={form.penaltyAmount} onChange={(e) => setForm({ ...form, penaltyAmount: e.target.value })} placeholder="Штраф" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <input value={form.clientPenaltyAmount} onChange={(e) => setForm({ ...form, clientPenaltyAmount: e.target.value })} placeholder="Штраф клиента" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <select value={form.clientPenaltyStatus} onChange={(e) => setForm({ ...form, clientPenaltyStatus: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
            <option value="CONFIRMED">Клиент: подтверждён</option>
            <option value="WITHHELD">Клиент: удержан</option>
            <option value="RECEIVED">Клиент: получен</option>
            <option value="PENDING">Клиент: ожидает</option>
            <option value="WAIVED">Клиент: отменён</option>
          </select>
          <select value={form.supplierPenaltyStatus} onChange={(e) => setForm({ ...form, supplierPenaltyStatus: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
            <option value="CONFIRMED">Поставщик: подтверждён</option>
            <option value="WITHHELD">Поставщик: удержан</option>
            <option value="RECEIVED">Поставщик: получен</option>
            <option value="PENDING">Поставщик: ожидает</option>
            <option value="WAIVED">Поставщик: отменён</option>
          </select>
          <input value={form.platformPenaltyShare} onChange={(e) => setForm({ ...form, platformPenaltyShare: e.target.value })} placeholder="Доля штрафа платформы" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <input value={form.supplierPenaltyShare} onChange={(e) => setForm({ ...form, supplierPenaltyShare: e.target.value })} placeholder="Доля штрафа поставщика" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Основание (обязательно)" className="rounded-lg border border-slate-200 px-2 py-2 text-xs sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => void runPreview()} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">Рассчитать</button>
            <button type="button" onClick={() => void confirm()} disabled={busy || !form.reason.trim()} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Подтвердить закрытие</button>
            {shown && Number(shown.remainingToRefund) > 0 && (
              <button type="button" onClick={() => void refundClient()} disabled={busy} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
                Вернуть клиенту {shown.remainingToRefund} {shown.currency}
              </button>
            )}
          </div>
        </div>
      )}
      {settlement?.reason && <p className="mt-2 text-[11px] text-slate-500">Основание: {settlement.reason}</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
