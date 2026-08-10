/**
 * PHASE 2 STEP 2.3A — Checkout / Commercial Intent — PURE helpers (unit-testable).
 *
 * Семантика (см. docs/architecture/checkout-commercial-intent.md):
 *  - serviceDate — date-only (YYYY-MM-DD → UTC midnight), НЕ в прошлом;
 *    время-суток/timezone — Step 2.8A (IANA timezone), здесь не симулируются;
 *  - availability — read-only "checked, not reserved": classify по фактической
 *    catalog.Availability строке (total - booked - reserved); отсутствие строки —
 *    честный NOT_CONFIGURED (не «available=true по stale read», §15);
 *  - quote expiry — issued Quote с validUntil <= now больше не является
 *    authoritative price (без молчаливого продления, §46/§68).
 */
import { ValidationDomainError } from "../../shared/errors";
// STRICT REVIEW 2.5 (§17): единый канонический date-only helper в src/shared —
// re-export для обратной совместимости (потребители sales.checkout не меняются).
export { isDateOnly } from "../../shared/date-only";
import { isDateOnly } from "../../shared/date-only";

/**
 * Service date: date-only (YYYY-MM-DD), НЕ раньше текущей календарной даты (UTC).
 * Возвращает UTC midnight (без day-shift). Невалидная/прошедшая дата → 422.
 */
export function parseServiceDate(value: string, now = new Date()): Date {
  if (!isDateOnly(value)) {
    throw new ValidationDomainError("serviceDate must be a calendar date (YYYY-MM-DD)");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (d.getTime() < todayStart) {
    throw new ValidationDomainError("serviceDate must not be in the past");
  }
  return d;
}

export type AvailabilityLevel = "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED";

export interface AvailabilityRowInput {
  slotsTotal: number;
  slotsBooked: number;
  slotsReserved: number;
}

/**
 * Классификация capacity (read-only): available = total - booked - reserved.
 *  - row === null → NOT_CONFIGURED (capacity для (product, tariff, date) не
 *    настроена — честно, без изобретения availability);
 *  - AVAILABLE когда availableSlots >= required, иначе UNAVAILABLE;
 *  - отрицательный availableSlots (несогласованные catalog-данные) НЕ маскируется
 *    (максимум честности) и всегда даёт UNAVAILABLE;
 *  - НИКОГДА не резервирует capacity и не пишет в catalog.Availability (ADR-0001).
 */
export function classifyAvailability(required: number, row: AvailabilityRowInput | null): {
  level: AvailabilityLevel;
  availableSlots: number | null;
} {
  if (!row) return { level: "NOT_CONFIGURED", availableSlots: null };
  const available = row.slotsTotal - row.slotsBooked - row.slotsReserved;
  return { level: available >= required ? "AVAILABLE" : "UNAVAILABLE", availableSlots: available };
}

/**
 * Quote validity (server-side). issued Quote с validUntil <= now — expired:
 * цена больше НЕ authoritative, intent честно флагается (никогда не считается
 * валидным молча). validUntil === null — defensively not expired (ISSUE требует
 * validUntil; null не должен встречаться у issued Quote).
 */
export function quoteExpiry(validUntil: Date | null, now = new Date()): {
  quoteExpired: boolean;
  priceAuthoritative: boolean;
} {
  const expired = validUntil !== null && validUntil.getTime() <= now.getTime();
  return { quoteExpired: expired, priceAuthoritative: !expired };
}
