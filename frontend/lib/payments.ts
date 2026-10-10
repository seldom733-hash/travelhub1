"use client";

/**
 * Payment create — frontend клиент canonical backend-контракта
 * `POST /api/v1/finance/payments` (READ-only audit §6/§7, implementation prompt §2).
 *
 * MULTI/PARTIAL: поле «Сумма платежа» РЕДАКТИРУЕМОЕ — клиент отправляет
 * `amount` (0 < amount ≤ due, ≤2 знаков) как convenience; сервер остаётся
 * authority (advisory-lock due-guard возвращает 422 при превышении остатка).
 * Остальные server-owned поля (currency/status/customerId/partnerId/
 * providerRef/version/id/code/timestamps) frontend НИКОГДА не отправляет —
 * payload собирается только из белого списка (buildCreatePaymentPayload);
 * bookingId не отправляется (Payment принадлежит Order).
 *
 * Payment methods — agreed allowlist (prompt AC-7). Существующих
 * стандартизированных значений для этого набора в проекте НЕТ
 * (backend: свободная строка ≤64 без enum; demo-seed использует только
 * CARD/BANK_TRANSFER/MOBILE_PAYMENT — не покрывает набор cash/card/
 * bank_transfer/other), поэтому используется allowlist из промпта.
 */

import { api, HttpError, type Order, type Page } from "./api";

/** Agreed payment-method allowlist (AC-7). */
export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Order-статусы, которые backend отклоняет при create (ORDER_NOT_PAYABLE). */
const NOT_PAYABLE_ORDER_STATUSES = new Set(["CANCELLED", "CLOSED"]);

export interface CreatePaymentInput {
  orderId: string;
  /** Редактируемая сумма платежа (MULTI/PARTIAL §7): 0 < amount ≤ due, ≤2dp. */
  amount?: string;
  paymentMethod?: PaymentMethod;
  /** Required, 1..255 (Step 3.6C.1 — backend валидирует повторно). */
  reason: string;
  initialNote?: string;
}

/** Узкий DTO ответа POST /finance/payments (paymentDto). */
export interface CreatedPayment {
  id: string;
  code: string;
  referenceNumber: string | null;
  orderId: string;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
}

/**
 * Финансовый контекст заказа (GET /orders/:id detail — супер-массив DTO
 * с amount/paidAmount/refundedAmount/dueAmount/paymentStatus/currency).
 * Источник правды для readonly-строк «Стоимость заказа / Оплачено / Осталось»
 * и default'а редактируемого поля «Сумма платежа» (= Осталось).
 */
export interface OrderFinancials {
  amount: string;
  paidAmount: string;
  refundedAmount: string;
  dueAmount: string;
  /** Резерв активных платежей (PENDING/AUTHORIZED); старый DTO может не присылать. */
  reservedAmount?: string | null;
  paymentStatus: string;
  currency: string;
}

export async function fetchOrderFinancials(orderId: string): Promise<OrderFinancials> {
  return api.get<OrderFinancials>(`/orders/${encodeURIComponent(orderId)}`);
}

/** Округление до центов (целочисленное сравнение — без FP-погрешностей). */
function toCents(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Клиентская валидация суммы (зеркало серверного validatePaymentAmount):
 * >0, ≤2 знаков после запятой, ≤ due (если известен). Сервер валидирует
 * повторно — это только UX-guard до отправки.
 */
export function isValidPaymentAmount(raw: string, due?: string | null): boolean {
  const v = raw.trim();
  if (!/^\d{1,18}(\.\d{1,2})?$/.test(v)) return false;
  const cents = toCents(v);
  if (cents === null || cents <= 0) return false;
  if (due != null && due !== "") {
    const dueCents = toCents(due);
    if (dueCents !== null && cents > dueCents) return false;
  }
  return true;
}

/**
 * Доступно к СОЗДАНИЮ нового платежа: due − reserved (PENDING/AUTHORIZED) ≥ 0 —
 * зеркало серверного due-guard (payment.service: available = amount − paid − reserved).
 * Без reservedAmount (старый DTO / резерва нет) возвращает due как есть.
 * Canonical «Осталось» (dueAmount) при этом НЕ меняется (prompt §5).
 */
export function availableToCreate(f: Pick<OrderFinancials, "dueAmount" | "reservedAmount"> | null): string | null {
  if (!f) return null;
  const due = f.dueAmount;
  if (due == null || due === "") return null;
  const reserved = f.reservedAmount;
  if (reserved == null || reserved === "") return due;
  const dueCents = toCents(due);
  const reservedCents = toCents(reserved);
  if (dueCents === null || reservedCents === null || reservedCents <= 0) return due;
  return (Math.max(0, dueCents - reservedCents) / 100).toFixed(2);
}

/**
 * Whitelist-payload: только разрешённые поля (prompt §2 + MULTI/PARTIAL amount).
 * Любые server-owned поля (currency/status/…) и bookingId сюда не попадают
 * по построению — тесты фиксируют этот контракт.
 */
export function buildCreatePaymentPayload(
  input: CreatePaymentInput,
): { orderId: string; amount?: string; reason: string; paymentMethod?: PaymentMethod; initialNote?: string } {
  const payload: { orderId: string; amount?: string; reason: string; paymentMethod?: PaymentMethod; initialNote?: string } = {
    orderId: input.orderId.trim(),
    reason: input.reason.trim(),
  };
  const amount = input.amount?.trim();
  if (amount) payload.amount = amount;
  if (input.paymentMethod) payload.paymentMethod = input.paymentMethod;
  const note = input.initialNote?.trim();
  if (note) payload.initialNote = note;
  return payload;
}

/**
 * External Idempotency-Key (Step 2.12H / §13): POST /finance/payments —
 * обязательный заголовок (@Idempotent("payment.create")). Формат backend-regex
 * `IDEMPOTENCY_KEY_RE` (`[A-Za-z0-9._~-]`, ≤128 chars).
 */
export function newPaymentIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `payment.create-${Date.now()}-${rand()}-${rand()}`.replace(/[^A-Za-z0-9._~-]/g, "-");
}

/** POST /finance/payments (RBAC: finance.payment.create). */
export async function createPayment(
  input: CreatePaymentInput,
  opts?: { idempotencyKey?: string },
): Promise<CreatedPayment> {
  return api.post<CreatedPayment>("/finance/payments", buildCreatePaymentPayload(input), {
    "Idempotency-Key": opts?.idempotencyKey ?? newPaymentIdempotencyKey(),
  });
}

/**
 * Статусные переходы PENDING-платежа (CAS state machine, server-owned):
 * confirm → CAPTURED («Зачислен»), cancel → CANCELLED («Отменён»).
 * RBAC: finance.payment.manage (ADMIN/FINANCE); без Idempotency-Key
 * (только create в защищённом set §13). 409 = невалидный переход
 * (статус уже не PENDING — нужен refresh).
 */
export async function confirmPayment(code: string): Promise<unknown> {
  return api.post(`/finance/payments/${encodeURIComponent(code)}/confirm`);
}

export async function cancelPayment(code: string): Promise<unknown> {
  return api.post(`/finance/payments/${encodeURIComponent(code)}/cancel`);
}

/**
 * Order-selector source: GET /orders (RBAC: order.read) — recent payable orders.
 * CANCELLED/CLOSED исключаются: backend отклоняет их 422 (ORDER_NOT_PAYABLE),
 * поэтому в селекте их быть не должно.
 */
export async function fetchPayableOrdersForSelect(pageSize = 100): Promise<Order[]> {
  const res = await api.get<Page<Order>>(`/orders?pageSize=${pageSize}`);
  return (res.items ?? []).filter((o) => !NOT_PAYABLE_ORDER_STATUSES.has(o.status));
}

/**
 * i18n-key для ошибки создания: по HTTP status (403/404/409/422); для 422
 * дополнительно различаем amount-ошибки due-guard'а сервера
 * («payment amount …» / «no remaining amount due») — ошибка суммы, а не
 * общий validation.
 */
export function paymentCreateErrorKey(e: unknown): string | null {
  const status = e instanceof HttpError ? e.status : 0;
  switch (status) {
    case 403:
      return "payments.create.error.forbidden";
    case 404:
      return "payments.create.error.not_found";
    case 409:
      return "payments.create.error.conflict";
    case 422: {
      const msg = e instanceof HttpError ? e.message : "";
      if (/payment amount|remaining amount due/i.test(msg)) return "payments.create.error.amount";
      return "payments.create.error.validation";
    }
    default:
      return null;
  }
}
