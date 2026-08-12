import { ValidationDomainError } from "../../shared/errors";
import { RATE_PLAN_PRICE_MAX, validateRatePlanPrice } from "./rate-plan.validation";
import type { CommercialPeriodKind } from "../../generated/prisma/enums";

/**
 * PHASE 1 STEP 1.8C — CommercialPeriod validation (structure & commercial form).
 *
 * - date-only inclusive range: startDate <= endDate (midnight-UTC, YYYY-MM-DD);
 * - kind: PERIOD (range) | DATE_OVERRIDE (startDate == endDate, самый высокий
 *   приоритет DD-026); DATE_OVERRIDE + dayOfWeek противоречивы (одна дата —
 *   один weekday) → 422;
 * - dayOfWeek: 0=Sunday..6=Saturday (JS getUTCDay-совместимо), dedup, min 1
 *   max 7 элементов, пустой массив = bare период;
 * - price: Decimal(12,2), неотрицательный (0 = легитимная бесплатная дата,
 *   НЕ missing/unavailable — price ≠ availability §19);
 * - sellable: boolean; currency НЕ передаётся (наследуется из Tariff §10);
 * - client НЕ контролирует id/code/tariffId/status/version/timestamps/history/
 *   Quote/Sale/Order/reservation/hold/1.8D-enforcement.
 */
export const COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "tariffId",
  "productId",
  "partnerId",
  "sellerId",
  "ownerId",
  "currency",
  "priceBasis",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "actorId",
  "actorName",
  "source",
  // Quote/Sales/hold/1.8D — НЕ реализованы здесь; forged факты → 422.
  "quoteId",
  "saleId",
  "checkoutId",
  "orderId",
  "bookingId",
  "reservationId",
  "reservationIds",
  "holdIds",
  "correlationId",
  "causationId",
  "enforcement",
  "rules",
  "resolverResult",
  "resolvedPrice",
  // 2.8A time-model: time-slot/departure/timezone факты НЕ реализованы (гейт).
  "timeSlot",
  "timeSlots",
  "startTime",
  "endTime",
  "departureTime",
  "departure",
  "timezone",
  "duration",
  "occupancy",
  "occupancyRestriction",
  "pax",
  "ageBand",
  "route",
  "tier",
] as const;

export const COMMERCIAL_PERIOD_UPDATE_FORBIDDEN_KEYS = COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS;

export const PERIOD_KIND_VALUES: CommercialPeriodKind[] = ["PERIOD", "DATE_OVERRIDE"];

/** ISO date-only (YYYY-MM-DD) → midnight-UTC Date. */
export function parsePeriodDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationDomainError(`${field} must be a calendar date (YYYY-MM-DD)`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationDomainError(`${field} must be a valid calendar date`);
  }
  return d;
}

export interface PeriodDates {
  startDate: Date;
  endDate: Date;
}

/** Inclusive date-only range: startDate <= endDate. */
export function validatePeriodRange(start: unknown, end: unknown): PeriodDates {
  const startDate = parsePeriodDate(start, "startDate");
  const endDate = parsePeriodDate(end, "endDate");
  if (startDate.getTime() > endDate.getTime()) {
    throw new ValidationDomainError("startDate must not be after endDate");
  }
  return { startDate, endDate };
}

export function validatePeriodKind(value: unknown): CommercialPeriodKind {
  if (value === undefined || value === null) return "PERIOD";
  if (typeof value !== "string" || !(PERIOD_KIND_VALUES as string[]).includes(value)) {
    throw new ValidationDomainError(`Invalid period kind; allowed: ${PERIOD_KIND_VALUES.join(", ")}`);
  }
  return value as CommercialPeriodKind;
}

/** dayOfWeek: 0=Sun..6=Sat, dedup, 1..7 элементов; пустой = bare период. */
export function validateDayOfWeek(value: unknown): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationDomainError("dayOfWeek must be an array of weekday numbers (0=Sunday..6=Saturday)");
  }
  if (value.length > 7) {
    throw new ValidationDomainError("dayOfWeek must have at most 7 entries");
  }
  for (const v of value) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 6) {
      throw new ValidationDomainError("dayOfWeek entries must be integers 0-6 (0=Sunday..6=Saturday)");
    }
  }
  return [...new Set(value)];
}

export function validatePeriodPrice(value: unknown): number {
  return validateRatePlanPrice(value);
}

export function validatePeriodSellable(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "boolean") {
    throw new ValidationDomainError("sellable must be a boolean");
  }
  return value;
}

export interface ValidatedPeriodInput {
  kind: CommercialPeriodKind;
  startDate: Date;
  endDate: Date;
  dayOfWeek: number[];
  price: number;
  sellable: boolean;
}

/** Полная валидация одного периода (create/bulk); DATE_OVERRIDE → 1 день. */
export function validatePeriodInput(input: {
  kind?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  dayOfWeek?: unknown;
  price?: unknown;
  sellable?: unknown;
}): ValidatedPeriodInput {
  const kind = validatePeriodKind(input.kind);
  const { startDate, endDate } = validatePeriodRange(input.startDate, input.endDate);
  const dayOfWeek = validateDayOfWeek(input.dayOfWeek);
  const price = validatePeriodPrice(input.price);
  const sellable = validatePeriodSellable(input.sellable);

  if (kind === "DATE_OVERRIDE" && startDate.getTime() !== endDate.getTime()) {
    throw new ValidationDomainError("DATE_OVERRIDE period must be a single date (startDate == endDate)");
  }
  if (kind === "DATE_OVERRIDE" && dayOfWeek.length > 0) {
    throw new ValidationDomainError("DATE_OVERRIDE period cannot carry a dayOfWeek condition (single date has one weekday)");
  }
  return { kind, startDate, endDate, dayOfWeek, price, sellable };
}

/** Лимиты для защиты от unbounded annual calendar abuse (не frozen business limit). */
export const PERIOD_MAX_PRICE = RATE_PLAN_PRICE_MAX;
export const PERIOD_BULK_MAX_ROWS = 366;
export const PERIOD_RANGE_MAX_DAYS = 3660; // ~10 лет — защита от абсурдных диапазонов
