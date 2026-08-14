/**
 * PHASE 2 STEP 2.3 — Quote commercial money helpers (PURE, unit-testable).
 *
 * Quote-local monetary contract (sanctioned by Phase 2 entry-audit prerequisite
 * #3 — «часть Quote-local contract может быть определена 2.3»):
 *  - representation: Prisma/Postgres DECIMAL(12,2) — существующий platform
 *    contract (Tariff.price / Order.amount / Booking.amount);
 *  - math: decimal.js (Prisma.Decimal), НИКАКИХ JS floating-point для
 *    authoritative totals;
 *  - line amount = unitPrice * quantity (exact: 2dp * int);
 *  - subtotal = sum(line amounts);
 *  - discount: PERCENTAGE (0..100) → round_half_up(subtotal * pct / 100, 2);
 *    FIXED (>= 0, currency = quote currency) — СТРОГО <= subtotal (422, без silent
 *    clamp: preview и ISSUE используют одну и ту же семантику);
 *  - total = subtotal - discountAmount >= 0;
 *  - rounding: half-up до 2 знаков (ROUND_HALF_UP) — совпадает с точностью
 *    хранения DECIMAL(12,2); детерминированная политика, документируется;
 *  - overflow guard: line/subtotal/discountAmount не могут превысить DECIMAL(12,2)
 *    (максимум 9999999999.99) — иначе 422, а не Prisma numeric overflow (500).
 *
 * РЕКОНСИЛЯЦИЯ (не закрывает): authoritative checkout/order propagation
 * (2.3A/2.4) и Order commercial snapshot (2.5) обязаны сверить эту политику
 * с Payment/Finance (2.10C/2.12) до production денежного потока.
 */
import { Prisma } from "../../generated/prisma/client";
import { ValidationDomainError } from "../../shared/errors";
import { QuoteDiscountType } from "../../generated/prisma/enums";

export type MoneyInput = string | number | Prisma.Decimal;

export const MONEY_SCALE = 2;
export const PERCENT_MAX = 100;
/** Максимум DECIMAL(12,2): 10 целых + 2 дробных знака. Выше — 422, не overflow. */
export const MONEY_MAX = new Prisma.Decimal("9999999999.99");

/** Бросить 422, если значение превышает DECIMAL(12,2). */
function assertMoneyRange(d: Prisma.Decimal, label: string): void {
  if (d.greaterThan(MONEY_MAX)) {
    throw new ValidationDomainError(`${label} exceeds the supported maximum (${MONEY_MAX.toString()})`);
  }
}

/** Строка/число → Decimal с точностью 2dp (half-up), без NaN/Infinity/negative. */
export function toMoney2(value: MoneyInput, label = "amount"): Prisma.Decimal {
  let d: Prisma.Decimal;
  try {
    d = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
  } catch {
    throw new ValidationDomainError(`${label} must be a valid decimal number`);
  }
  if (!d.isFinite()) throw new ValidationDomainError(`${label} must be a finite number`);
  if (d.isNegative()) throw new ValidationDomainError(`${label} must not be negative`);
  const rounded = d.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  assertMoneyRange(rounded, label);
  return rounded;
}

/**
 * Валидация пользовательского discount-value (приходит от клиента строкой):
 * PERCENTAGE — 0..100 (не более 2dp); FIXED — >= 0 (не более 2dp, currency КП).
 * NONE — value игнорируется/должен отсутствовать.
 */
export function validateDiscountValue(type: QuoteDiscountType, value?: MoneyInput | null): Prisma.Decimal | null {
  if (type === QuoteDiscountType.NONE) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      throw new ValidationDomainError("discountValue must be absent when discountType is NONE");
    }
    return null;
  }
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new ValidationDomainError("discountValue is required for the selected discount type");
  }
  const d = toMoney2(value, "discountValue");
  if (type === QuoteDiscountType.PERCENTAGE) {
    if (d.greaterThan(PERCENT_MAX)) {
      throw new ValidationDomainError(`percentage discount must not exceed ${PERCENT_MAX}`);
    }
  }
  // FIXED: >= 0 (toMoney2); верхняя граница (<= subtotal) проверяется при расчёте/ISSUE.
  return d;
}

/** Сумма строки = unitPrice * quantity (exact Decimal). Переполнение DECIMAL(12,2) → 422. */
export function lineAmount(unitPrice: MoneyInput, quantity: number): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationDomainError("quantity must be a positive integer");
  }
  const amount = toMoney2(unitPrice, "unitPrice").mul(quantity).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  assertMoneyRange(amount, "line amount");
  return amount;
}

/** Subtotal = сумма строк. Переполнение DECIMAL(12,2) → 422. */
export function subtotalOf(lineAmounts: MoneyInput[]): Prisma.Decimal {
  const sum = lineAmounts
    .reduce<Prisma.Decimal>((acc, a) => acc.plus(toMoney2(a, "amount")), new Prisma.Decimal(0))
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  assertMoneyRange(sum, "quote subtotal");
  return sum;
}

/**
 * Effective discount amount (backend-authoritative):
 *  - NONE → 0;
 *  - PERCENTAGE → round_half_up(subtotal * pct / 100, 2), pct из validateDiscountValue;
 *  - FIXED → точное значение; FIXED > subtotal → 422 (СТРОГО, без silent clamp).
 */
export function discountAmountOf(subtotal: MoneyInput, type: QuoteDiscountType, value: Prisma.Decimal | null): Prisma.Decimal {
  const s = toMoney2(subtotal, "subtotal");
  if (type === QuoteDiscountType.NONE || value === null) return new Prisma.Decimal(0);
  const v = toMoney2(value, "discountValue");
  if (type === QuoteDiscountType.PERCENTAGE) {
    const amount = s.mul(v).div(PERCENT_MAX).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
    assertMoneyRange(amount, "discount amount");
    return amount;
  }
  // FIXED: строгий контракт — скидка не может превышать subtotal.
  if (v.greaterThan(s)) {
    throw new ValidationDomainError("Fixed discount must not exceed quote subtotal");
  }
  return v;
}

/** Итог = subtotal - discountAmount (>= 0). */
export function totalOf(subtotal: MoneyInput, discountAmount: MoneyInput): Prisma.Decimal {
  const t = toMoney2(subtotal, "subtotal").minus(toMoney2(discountAmount, "discountAmount"));
  if (t.isNegative()) throw new ValidationDomainError("total must not be negative");
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.11 — CANONICAL PRICING / FINANCIAL SNAPSHOT CONTRACT
//
// Единый кросс-доменный контракт frozen money facts (Quote → CheckoutIntent →
// Sale → Order → Booking): DECIMAL(12,2), half-up 2dp, decimal.js, overflow
// guard — та же authority, что и выше (finance.money переиспользует этот
// модуль как single source of truth, Step 2.10 §7). НЕ пересчитывает цену из
// mutable Catalog/Tax/FX — только проверяет, что frozen snapshot внутренне
// консистентен (невалидный snapshot → controlled 422, никогда не bind-ится
// молча). Требует НЕ только итоговые суммы, но и их происхождение (lines).
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 4217 (валюта): ровно 3 заглавные латинские буквы (та же семантика, что
 *  finance.validateIsoCode; локально, чтобы sales не зависел от finance). */
const ISO_CODE_RE = /^[A-Z]{3}$/;

/** Строка frozen snapshot (canonical money component vocabulary, §9 2.11). */
export interface FrozenSnapshotLine {
  unitPrice: MoneyInput;
  quantity: number;
  amount: MoneyInput;
}

export interface FrozenSnapshotInput {
  currency: string;
  lines: FrozenSnapshotLine[];
  subtotal: MoneyInput;
  discountType: QuoteDiscountType;
  discountValue?: MoneyInput | null;
  discountAmount?: MoneyInput | null;
  total: MoneyInput;
}

/**
 * Единичный frozen money fact (напр. Booking.amount + Booking.currency):
 * сумма — валидный Decimal (>= 0, ≤2dp, overflow guard), валюта — ISO 4217.
 * Деньги БЕЗ валюты не имеют однозначной семантики — оба обязательны.
 */
export function validateFrozenMoneyFact(amount: MoneyInput, currency: string, label = "frozen money fact"): void {
  toMoney2(amount, `${label} amount`);
  if (typeof currency !== "string" || !ISO_CODE_RE.test(currency)) {
    throw new ValidationDomainError(`${label} currency must be a 3-letter ISO 4217 code`);
  }
}

function snapshotDiscountValue(value: MoneyInput | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return toMoney2(value, "discountValue");
}

/**
 * Consistency gate для canonical frozen snapshot (binding boundary, §25 2.11):
 *  - line amount == round_half_up(unitPrice × quantity);
 *  - subtotal == Σ line amounts;
 *  - discountAmount == NONE→0 | PERCENTAGE→round_half_up(subtotal×pct/100) |
 *    FIXED→value (≤ subtotal); discountType ≠ NONE без value → 422;
 *  - total == subtotal − discountAmount >= 0;
 *  - currency — ISO 4217; все суммы — Decimal ≤2dp с overflow guard.
 * Тот же математический контракт, что в quoteTotals/ISSUE (2.3) — расхождение
 * = producer-дефект/дрейф, громкий 422, НЕ молчаливый bind.
 */
export function validateFrozenSnapshot(input: FrozenSnapshotInput): void {
  validateFrozenMoneyFact(input.subtotal, input.currency, "snapshot");
  if (input.lines.length === 0) {
    throw new ValidationDomainError("snapshot must contain at least one line");
  }
  const expectedLines = input.lines.map((l) => lineAmount(l.unitPrice, l.quantity));
  input.lines.forEach((l, i) => {
    if (!toMoney2(l.amount, `line ${i} amount`).equals(expectedLines[i]!)) {
      throw new ValidationDomainError(`snapshot line ${i} amount is inconsistent with unitPrice × quantity`);
    }
  });
  const subtotal = toMoney2(input.subtotal, "snapshot subtotal");
  if (!subtotal.equals(subtotalOf(expectedLines))) {
    throw new ValidationDomainError("snapshot subtotal is inconsistent with line amounts");
  }
  if (input.discountType === QuoteDiscountType.NONE) {
    if (snapshotDiscountValue(input.discountValue) !== null) {
      throw new ValidationDomainError("snapshot discountValue must be absent when discountType is NONE");
    }
  } else if (snapshotDiscountValue(input.discountValue) === null) {
    throw new ValidationDomainError("snapshot discountValue is required for the selected discount type");
  }
  const expectedDiscount = discountAmountOf(subtotal, input.discountType, snapshotDiscountValue(input.discountValue));
  const discountAmount = snapshotDiscountValue(input.discountAmount) ?? new Prisma.Decimal(0);
  if (!discountAmount.equals(expectedDiscount)) {
    throw new ValidationDomainError("snapshot discountAmount is inconsistent with discount type/value");
  }
  if (!toMoney2(input.total, "snapshot total").equals(totalOf(subtotal, discountAmount))) {
    throw new ValidationDomainError("snapshot total is inconsistent with subtotal − discountAmount");
  }
}
