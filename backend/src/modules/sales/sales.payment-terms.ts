/**
 * PHASE 2 STEP 2.3B — Payment Terms / Payment Scheme — PURE helpers.
 *
 * Каноническая семантика (Roadmap v3 §2.3B, Baseline 1.6, 2.12F):
 *  - payment terms ОПИСЫВАЮТ обязательство покупателя и график/условия оплаты;
 *    НЕ Payment/PSP/intent/authorization/capture/refund/invoice/ledger/paid;
 *  - источник денег: frozen Checkout total (НЕ Catalog/Tariff текущая цена);
 *  - derived amounts (initialAmount/remainingAmount) — server-side, Decimal
 *    (тот же sales.money контракт: DECIMAL(12,2), half-up 2dp), без JS float;
 *  - инвариант: initialAmount + remainingAmount == total (для всех схем, где
 *    prepayment — часть total; для PAY_LATER/PAY_AT_SERVICE initial=0);
 *  - due semantics несёт enum scheme (BEFORE_SERVICE / AT_SERVICE), БЕЗ fake
 *    due timestamp (time-model — 2.8A; due dates/reminders — 2.12F/Finance);
 *  - DEPOSIT — ЧАСТЬ total (Roadmap 2.12F: «Deposit, 30/70»): remaining =
 *    total - depositAmount; НЕ отдельное обязательство сверх total.
 */

import { Prisma } from "../../generated/prisma/client";
import { ValidationDomainError } from "../../shared/errors";
import { MONEY_SCALE, MONEY_MAX, toMoney2 } from "./sales.money";
import { PaymentPrepaymentType, PaymentScheme } from "../../generated/prisma/enums";

/** Максимум процента предоплаты для PARTIAL/DEPOSIT: строго < 100 (100% → FULL_PREPAYMENT). */
export const PREPAYMENT_PERCENT_MAX = 100;

export interface PaymentTermsInput {
  scheme: PaymentScheme;
  prepaymentType?: PaymentPrepaymentType | null;
  prepaymentValue?: string | number | Prisma.Decimal | null;
}

export interface PaymentTermsComputed {
  scheme: PaymentScheme;
  prepaymentType: PaymentPrepaymentType | null;
  prepaymentValue: Prisma.Decimal | null;
  initialAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
}

/**
 * Вычислить derived amounts для выбранной схемы (server-authoritative).
 * total — frozen Checkout total (Decimal, неотрицательный).
 *
 * Валидация:
 *  - FULL_PREPAYMENT: initial = total, remaining = 0; параметры запрещены;
 *  - PARTIAL_PREPAYMENT / DEPOSIT: prepaymentType ОБЯЗАТЕЛЕН (PERCENTAGE|FIXED);
 *    PERCENTAGE: 0 < p < 100 (100 → 422 «use FULL_PREPAYMENT», 0 → 422);
 *    FIXED: 0 < v < total (v >= total → 422 «use FULL_PREPAYMENT», 0 → 422);
 *    initial = round_half_up(расчёт), remaining = total - initial;
 *    строгий инвариант 0 < initial < total (после округления initial не может
 *    стать 0 или total — иначе 422; никакого silent clamp);
 *  - PAY_LATER / PAY_AT_SERVICE: initial = 0, remaining = total; параметры
 *    запрещены.
 *
 * Исключение: округление PERCENTAGE не может обнулить initial при total > 0
 * (0.5% от 0.01 → 0.00005 → round 0.00 → 422, т.к. initial < 1 cent).
 */
export function computePaymentTerms(total: Prisma.Decimal, input: PaymentTermsInput): PaymentTermsComputed {
  if (total.isNegative()) throw new ValidationDomainError("total must not be negative");
  const t = total.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

  switch (input.scheme) {
    case PaymentScheme.FULL_PREPAYMENT:
      if (input.prepaymentType || input.prepaymentValue !== undefined && input.prepaymentValue !== null) {
        throw new ValidationDomainError("FULL_PREPAYMENT does not accept prepaymentType/prepaymentValue");
      }
      return { scheme: PaymentScheme.FULL_PREPAYMENT, prepaymentType: null, prepaymentValue: null, initialAmount: t, remainingAmount: new Prisma.Decimal(0) };

    case PaymentScheme.PAY_LATER:
    case PaymentScheme.PAY_AT_SERVICE:
      if (input.prepaymentType || input.prepaymentValue !== undefined && input.prepaymentValue !== null) {
        throw new ValidationDomainError(`${input.scheme} does not accept prepaymentType/prepaymentValue`);
      }
      return { scheme: input.scheme, prepaymentType: null, prepaymentValue: null, initialAmount: new Prisma.Decimal(0), remainingAmount: t };

    case PaymentScheme.PARTIAL_PREPAYMENT:
    case PaymentScheme.DEPOSIT:
      return computePrepaid(t, input);

    default:
      throw new ValidationDomainError(`Unknown payment scheme: ${String(input.scheme)}`);
  }
}

function computePrepaid(t: Prisma.Decimal, input: PaymentTermsInput): PaymentTermsComputed {
  if (!input.prepaymentType) {
    throw new ValidationDomainError(`${input.scheme} requires prepaymentType (PERCENTAGE|FIXED)`);
  }
  if (input.prepaymentValue === undefined || input.prepaymentValue === null || String(input.prepaymentValue).trim() === "") {
    throw new ValidationDomainError(`${input.scheme} requires prepaymentValue`);
  }
  const v = toMoney2(input.prepaymentValue, "prepaymentValue");
  if (v.isZero()) throw new ValidationDomainError(`${input.scheme} prepaymentValue must be > 0`);

  let initial: Prisma.Decimal;
  if (input.prepaymentType === PaymentPrepaymentType.PERCENTAGE) {
    if (v.greaterThanOrEqualTo(PREPAYMENT_PERCENT_MAX)) {
      throw new ValidationDomainError(`percentage prepayment must be < ${PREPAYMENT_PERCENT_MAX} (use FULL_PREPAYMENT for 100%)`);
    }
    initial = t.mul(v).div(PREPAYMENT_PERCENT_MAX).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  } else if (input.prepaymentType === PaymentPrepaymentType.FIXED) {
    if (v.greaterThanOrEqualTo(t)) {
      throw new ValidationDomainError("fixed prepayment must be < total (use FULL_PREPAYMENT for the full amount)");
    }
    initial = v;
  } else {
    throw new ValidationDomainError(`Unknown prepaymentType: ${String(input.prepaymentType)}`);
  }

  // Строгий инвариант после округления: 0 < initial < total.
  if (initial.isZero()) {
    throw new ValidationDomainError("computed initial amount is 0 after rounding; choose a larger prepayment");
  }
  if (initial.greaterThanOrEqualTo(t)) {
    throw new ValidationDomainError("computed initial amount equals total after rounding; use FULL_PREPAYMENT");
  }
  assertMoneyRange(initial);

  const remaining = t.minus(initial);
  if (remaining.isNegative()) throw new ValidationDomainError("remaining amount must not be negative");

  return {
    scheme: input.scheme,
    prepaymentType: input.prepaymentType,
    // prepaymentValue: для PERCENTAGE — процент; для FIXED v === initial (оба
    // нормализованы через toMoney2 2dp) — единая семантика поля.
    prepaymentValue: v,
    initialAmount: initial,
    remainingAmount: remaining,
  };
}

function assertMoneyRange(d: Prisma.Decimal): void {
  if (d.greaterThan(MONEY_MAX)) {
    throw new ValidationDomainError(`amount exceeds the supported maximum (${MONEY_MAX.toString()})`);
  }
}
