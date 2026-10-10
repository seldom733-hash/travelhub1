"use client";

/**
 * CreatePaymentForm — modal создания платежа (Payments registry / Order detail /
 * Booking detail), implementation prompt §2/§8 + MULTI/PARTIAL §7.
 *
 * Backend contract: POST /api/v1/finance/payments
 *   { orderId, amount?, reason (1..255, required), paymentMethod?, initialNote? }
 * «Сумма платежа» РЕДАКТИРУЕМОЕ (MULTI/PARTIAL): default = «доступно к созданию»
 * (due − reserved, GET /orders/:id: dueAmount/reservedAmount), readonly-строки
 * Стоимость/Оплачено/Осталось, клиентская валидация 0 < amount ≤ available ≤2dp,
 * сервер — authority (422 due-guard).
 * currency — server-owned (frozen Order snapshot), frontend его не отправляет
 * и не отправляет bookingId (Payment принадлежит Order).
 *
 * States (§8): idle → loading (selector) → submitting → success (+error).
 * Submit disabled во время отправки — два POST из одного действия невозможны.
 * POST идёт с обязательным Idempotency-Key (Step 2.12H, @Idempotent
 * "payment.create"): ключ стабилен для одинакового payload внутри сессии
 * диалога, обновляется при изменении payload/переоткрытии.
 */

import { useEffect, useRef, useState } from "react";
import { t, ti, useLocale, LOCALE_TAGS } from "@/lib/i18n";
import {
  PAYMENT_METHODS,
  availableToCreate,
  createPayment,
  fetchOrderFinancials,
  fetchPayableOrdersForSelect,
  isValidPaymentAmount,
  newPaymentIdempotencyKey,
  paymentCreateErrorKey,
  type CreatedPayment,
  type CreatePaymentInput,
  type OrderFinancials,
  type PaymentMethod,
} from "@/lib/payments";
import type { Order } from "@/lib/api";

/** Fixed order context (Order/Booking detail) — заказ нельзя заменить. */
export interface PaymentFormPresetOrder {
  id: string;
  label: string;
  amount: string | null;
  currency: string | null;
}

type Phase = "idle" | "submitting" | "success";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function fmtMoney(amount: string | null | undefined, currency: string | null | undefined, locale: "ru" | "az" | "en"): string {
  if (amount == null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency ?? ""}`.trim();
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

export default function CreatePaymentForm({
  open,
  onClose,
  presetOrder,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Фиксированный контекст заказа (Order/Booking detail); без него — селект. */
  presetOrder?: PaymentFormPresetOrder | null;
  onCreated?: (payment: CreatedPayment) => void;
}) {
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>("idle");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reason, setReason] = useState("");
  const [initialNote, setInitialNote] = useState("");
  // MULTI/PARTIAL: редактируемая сумма + финансовый контекст заказа.
  const [amount, setAmount] = useState("");
  const amountTouchedRef = useRef(false);
  const [financials, setFinancials] = useState<OrderFinancials | null>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Idempotency-Key (2.12H): стабилен для ОДИНАКОВОГО payload внутри сессии
  // диалога (retry после сетевой ошибки = replay, не дубль); меняется при
  // любом изменении payload (иначе 409 divergent) и при переоткрытии.
  const idemRef = useRef<{ sig: string; key: string } | null>(null);

  // Состояние формы (детерминированное значение контекста, не объект —
  // чтобы parent-re-render с новым литералом presetOrder не сбрасывал ввод).
  const presetId = presetOrder?.id ?? null;
  const presetAmount = presetOrder?.amount ?? null;
  const presetCurrency = presetOrder?.currency ?? null;
  const presetLabel = presetOrder?.label ?? null;

  // Сброс при каждом открытии (или смене фиксированного контекста заказа).
  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setOrderId(presetId ?? "");
    setPaymentMethod("cash");
    setReason("");
    setInitialNote("");
    setAmount("");
    amountTouchedRef.current = false;
    setFinancials(null);
    setFinancialsLoading(false);
    setFinancialsError(false);
    setErrorKey(null);
    setErrorMessage(null);
    idemRef.current = null;
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open, presetId]);

  // Финансовый контекст заказа (MULTI/PARTIAL): GET /orders/:id → total/paid/
  // due/reserved; default редактируемого поля = «доступно» (due − reserved,
  // зеркало серверского due-guard) — не затирает ввод пользователя.
  const activeOrderId = (presetOrder?.id ?? orderId).trim();
  useEffect(() => {
    if (!open || !activeOrderId) {
      setFinancials(null);
      setFinancialsLoading(false);
      setFinancialsError(false);
      return;
    }
    let alive = true;
    amountTouchedRef.current = false;
    setFinancials(null);
    setFinancialsError(false);
    setFinancialsLoading(true);
    fetchOrderFinancials(activeOrderId)
      .then((f) => {
        if (!alive) return;
        setFinancials(f);
        // dueAmount может отсутствовать в неполном DTO — не затираем ввод.
        // Default = доступно к созданию (due − reserved): при активных платежах
        // полный «Осталось» завышен относительно серверского due-guard.
        const available = availableToCreate(f);
        setAmount((prev) => (amountTouchedRef.current || available == null ? prev : available));
      })
      .catch(() => {
        if (alive) setFinancialsError(true);
      })
      .finally(() => {
        if (alive) setFinancialsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, activeOrderId]);

  // Order selector source (только когда заказ не предзадан).
  useEffect(() => {
    if (!open || presetId) return;
    let alive = true;
    setOrdersLoading(true);
    setOrdersError(null);
    fetchPayableOrdersForSelect()
      .then((items) => {
        if (alive) setOrders(items);
      })
      .catch((e: unknown) => {
        if (alive) setOrdersError((e as Error).message);
      })
      .finally(() => {
        if (alive) setOrdersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, presetId]);

  // Esc — закрыть (не во время submit).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "submitting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  const trimmedReason = reason.trim();
  const trimmedAmount = amount.trim();
  // Cap клиентской проверки = доступно к созданию (due − reserved) — зеркало
  // серверского due-guard; без финансового контекста — только формат.
  // Сервер (due-guard) остаётся authority в любом случае.
  const availableForValidation = availableToCreate(financials);
  // Пустое поле допустимо: amount опционален сервер-side (платёж на весь
  // остаток); блокируем только НЕКОРРЕКТНОЕ непустое значение.
  const amountValid =
    Boolean(activeOrderId) &&
    !financialsLoading &&
    (trimmedAmount.length === 0 || isValidPaymentAmount(trimmedAmount, availableForValidation));
  const amountTouchedButInvalid = trimmedAmount.length > 0 && !isValidPaymentAmount(trimmedAmount, availableForValidation);
  const canSubmit =
    phase !== "submitting" &&
    phase !== "success" &&
    Boolean(activeOrderId) &&
    trimmedReason.length > 0 &&
    trimmedReason.length <= 255 &&
    amountValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return; // double-click / двойной POST — guarded
    setPhase("submitting");
    setErrorKey(null);
    setErrorMessage(null);
    try {
      const input: CreatePaymentInput = {
        orderId: activeOrderId,
        amount: trimmedAmount,
        paymentMethod,
        reason: trimmedReason,
        ...(initialNote.trim() ? { initialNote: initialNote.trim() } : {}),
      };
      const sig = JSON.stringify(input);
      if (!idemRef.current || idemRef.current.sig !== sig) {
        idemRef.current = { sig, key: newPaymentIdempotencyKey() };
      }
      const payment = await createPayment(input, { idempotencyKey: idemRef.current.key });
      setPhase("success");
      onCreated?.(payment);
      closeTimerRef.current = setTimeout(onClose, 900);
    } catch (err) {
      const key = paymentCreateErrorKey(err);
      if (key) setErrorKey(key);
      else setErrorMessage((err as Error).message || t("payments.create.error.generic", locale));
      setPhase("idle");
    }
  }

  if (!open) return null;

  const submitting = phase === "submitting";
  const success = phase === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("payments.create.title", locale)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-900">{t("payments.create.title", locale)}</h2>

        {success ? (
          <div className="space-y-4">
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {t("payments.create.success", locale)}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("payments.create.cancel", locale)}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {/* Заказ */}
            <div>
              <label className={labelCls} htmlFor="create-payment-order">
                {t("payments.create.order", locale)}
              </label>
              {presetOrder ? (
                // Фиксированный контекст (Order/Booking detail) — заменить нельзя.
                <input
                  id="create-payment-order"
                  data-testid="create-payment-order-fixed"
                  value={presetOrder.label}
                  readOnly
                  disabled
                  className={inputCls}
                />
              ) : (
                <select
                  id="create-payment-order"
                  data-testid="create-payment-order-select"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  disabled={ordersLoading || submitting}
                  className={inputCls}
                >
                  <option value="">{t("payments.create.select_order", locale)}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.referenceNumber} · {fmtMoney(o.amount, o.currency, locale)}
                    </option>
                  ))}
                </select>
              )}
              {ordersLoading && <div className="mt-1 text-xs text-slate-400">{t("payments.create.loading_orders", locale)}</div>}
              {!presetOrder && !ordersLoading && !ordersError && orders.length === 0 && (
                <div className="mt-1 text-xs text-slate-400">{t("payments.create.no_orders", locale)}</div>
              )}
              {ordersError && <div className="mt-1 text-xs text-red-500">{ordersError}</div>}
            </div>

            {/* Финансовый контекст заказа — readonly (MULTI/PARTIAL §7) */}
            {activeOrderId && (
              <div data-testid="create-payment-financials" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                {financialsLoading ? (
                  <div className="text-xs text-slate-400">{t("payments.create.financials_loading", locale)}</div>
                ) : financialsError ? (
                  <div className="text-xs text-red-500">{t("payments.create.financials_error", locale)}</div>
                ) : financials ? (
                  <>
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-500">{t("payments.create.order_total", locale)}</dt>
                        <dd className="mt-0.5 text-sm text-slate-700" data-testid="create-payment-order-total">
                          {fmtMoney(financials.amount, financials.currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-500">{t("payments.create.paid", locale)}</dt>
                        <dd className="mt-0.5 text-sm text-emerald-700" data-testid="create-payment-paid">
                          {fmtMoney(financials.paidAmount, financials.currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-500">{t("payments.create.due", locale)}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-amber-700" data-testid="create-payment-due">
                          {fmtMoney(financials.dueAmount, financials.currency, locale)}
                        </dd>
                      </div>
                    </dl>
                    {financials.reservedAmount != null && Number(financials.reservedAmount) > 0 ? (
                      <p
                        data-testid="create-payment-reserved-hint"
                        className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"
                      >
                        {ti("payments.create.reserved_hint", locale, {
                          reserved: fmtMoney(financials.reservedAmount, financials.currency, locale),
                          available: fmtMoney(availableForValidation ?? "0", financials.currency, locale),
                        })}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}

            {/* Сумма платежа — EDITABLE (MULTI/PARTIAL): 0 < amount ≤ available
                (due − reserved), ≤2dp; default = доступно; сервер — authority. */}
            <div>
              <label className={labelCls} htmlFor="create-payment-amount">
                {t("payments.create.amount_label", locale)} *
              </label>
              <input
                id="create-payment-amount"
                data-testid="create-payment-amount"
                value={amount}
                onChange={(e) => {
                  amountTouchedRef.current = true;
                  setAmount(e.target.value);
                }}
                disabled={submitting || financialsLoading}
                inputMode="decimal"
                autoComplete="off"
                maxLength={32}
                placeholder={availableForValidation ?? ""}
                className={inputCls}
              />
              <div className="mt-1 text-xs text-slate-400">{t("payments.create.amount_hint", locale)}</div>
              {amountTouchedButInvalid && !financialsLoading && (
                <div role="alert" data-testid="create-payment-amount-error" className="mt-1 text-xs text-red-500">
                  {t("payments.create.error.amount", locale)}
                </div>
              )}
            </div>

            {/* Способ оплаты — allowlist AC-7 */}
            <div>
              <label className={labelCls} htmlFor="create-payment-method">
                {t("payments.create.method", locale)}
              </label>
              <select
                id="create-payment-method"
                data-testid="create-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                disabled={submitting}
                className={inputCls}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`payments.create.method.${m}`, locale)}
                  </option>
                ))}
              </select>
            </div>

            {/* Причина — обязательна */}
            <div>
              <label className={labelCls} htmlFor="create-payment-reason">
                {t("payments.create.reason", locale)} *
              </label>
              <input
                id="create-payment-reason"
                data-testid="create-payment-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                maxLength={255}
                className={inputCls}
              />
              <div className="mt-1 text-xs text-slate-400">{t("payments.create.reason_hint", locale)}</div>
            </div>

            {/* Примечание — опционально */}
            <div>
              <label className={labelCls} htmlFor="create-payment-note">
                {t("payments.create.note", locale)}
              </label>
              <textarea
                id="create-payment-note"
                data-testid="create-payment-note"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                disabled={submitting}
                rows={2}
                maxLength={5000}
                className={inputCls}
              />
            </div>

            {errorKey && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t(errorKey, locale)}
              </div>
            )}
            {errorMessage && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                data-testid="create-payment-submit"
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "…" : t("payments.create.submit", locale)}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("payments.create.cancel", locale)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
