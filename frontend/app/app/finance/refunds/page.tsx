"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { financeCenterApi } from "@/lib/finance-center-api";
import { formatPrice, useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface PaymentRow { id: string; code: string; referenceNumber?: string | null; amount: string; status: string; currency: string; orderCode?: string }
interface RefundRow { code: string; referenceNumber?: string | null; status: string; amount: string; currency: string; paymentCode?: string | null; orderCode?: string | null; dealNumber?: string | null }

function statusRu(status: string) {
  return ({ REQUESTED: "Запрошен", APPROVED: "Подтверждён", PROCESSED: "Исполнен", FAILED: "Ошибка" } as Record<string, string>)[status] ?? status;
}

export default function RefundsPage() {
  const locale = useLocale();
  const canWrite = useCan("finance.refund.write");
  const canApprove = useCan("finance.refund.approve");
  const canExecute = useCan("finance.refund.execute");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, r] = await Promise.all([
        financeCenterApi.listPayments({ status: "CAPTURED", pageSize: 100 }),
        financeCenterApi.listRefunds({ pageSize: 100 }),
      ]);
      setPayments(p.items);
      setRefunds(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!paymentId || !amount.trim() || !reason.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const refund = await financeCenterApi.createRefund({ paymentId, amount: amount.trim(), reason: reason.trim() });
      setNotice(`Создан ${refund.code} · ${refund.status}`);
      setAmount("");
      setReason("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (code: string, action: "approve" | "process") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const refund = action === "approve"
        ? await financeCenterApi.approveRefund(code)
        : await financeCenterApi.processRefund(code);
      setNotice(`${refund.code} · ${refund.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Возвраты клиентам" breadcrumbs={["Navitravel", "Финансы", "Возвраты"]} />
      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {canWrite && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Создать возврат</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Выберите оплаченный платёж</option>
              {payments.map((p) => <option key={p.id} value={p.id}>{p.referenceNumber ?? p.code} · {p.amount} {p.currency} · {p.orderCode ?? ""}</option>)}
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" disabled={busy || !paymentId || !amount.trim() || !reason.trim()} onClick={() => void create()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Создать</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Платёж</th><th className="px-3 py-2">Номер сделки</th><th className="px-3 py-2 text-right">Сумма</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2">Действия</th></tr>
          </thead>
          <tbody>
            {refunds.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Возвратов нет</td></tr>}
            {refunds.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.referenceNumber ?? r.code}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.paymentCode ?? "—"}</td><td className="px-3 py-2 font-mono text-xs">{r.dealNumber ? `Сделка № ${r.dealNumber}` : (r.orderCode ?? "—")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPrice(r.amount, r.currency, locale) ?? r.amount}</td>
                <td className="px-3 py-2 text-xs">{statusRu(r.status)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {canApprove && r.status === "REQUESTED" && <button type="button" disabled={busy} onClick={() => void act(r.code, "approve")} className="rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50">Подтвердить</button>}
                    {canExecute && r.status === "APPROVED" && <button type="button" disabled={busy} onClick={() => void act(r.code, "process")} className="rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50">Исполнить</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
