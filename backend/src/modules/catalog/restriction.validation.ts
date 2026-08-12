import { ValidationDomainError } from "../../shared/errors";
import type { CommercialRestrictionScope, CommercialRestrictionType } from "../../generated/prisma/enums";
import { parsePeriodDate } from "./period.validation";

/**
 * PHASE 1 STEP 1.8D — CommercialRestriction validation.
 *
 * - scope: PERIOD (привязка к commercialPeriodId, даты НЕ передаются) |
 *   DATE (startDate == endDate, date-only UTC);
 * - type: STOP_SELL (DATE-scope only — периодный stop-sell = 1.8C sellable),
 *   MIN_STAY (1..365 service-days), ADVANCE_BOOKING (0..365 дней),
 *   CLOSED_TO_ARRIVAL / CLOSED_TO_DEPARTURE (presence — value NULL);
 * - value: только для MIN_STAY/ADVANCE_BOOKING; STOP_SELL/CTA/CTD с value → 422
 *   (fail loudly, не игнор);
 * - client НЕ контролирует id/code/tariffId/ownership/status/version/
 *   timestamps/audit/Quote/Sale/Order/hold/1.8D-facts/time-slot (2.8A gate).
 */
export const COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS = [
  "id",
  "code",
  "tariffId",
  "productId",
  "partnerId",
  "sellerId",
  "ownerId",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "createdBy",
  "updatedBy",
  "createdById",
  "actorId",
  "actorName",
  "history",
  "source",
  // Quote/Sales/hold — forged факты → 422.
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
  "resolvedEligibility",
  "sellable",
  // 2.8A time-model (гейт): time-slot/departure/timezone факты НЕ реализованы.
  "timeSlot",
  "timeSlots",
  "startTime",
  "endTime",
  "departureTime",
  "departure",
  "timezone",
  "duration",
  "occupancy",
  "pax",
  "ageBand",
  "route",
  "tier",
] as const;

export const RESTRICTION_SCOPE_VALUES: CommercialRestrictionScope[] = ["PERIOD", "DATE"];
export const RESTRICTION_TYPE_VALUES: CommercialRestrictionType[] = [
  "STOP_SELL",
  "MIN_STAY",
  "ADVANCE_BOOKING",
  "CLOSED_TO_ARRIVAL",
  "CLOSED_TO_DEPARTURE",
];

export const RESTRICTION_VALUE_MAX = 365;
export const RESTRICTION_ADVANCE_MAX = 365;

export function validateRestrictionScope(value: unknown): CommercialRestrictionScope {
  if (typeof value !== "string" || !(RESTRICTION_SCOPE_VALUES as string[]).includes(value)) {
    throw new ValidationDomainError(`Invalid restriction scope; allowed: ${RESTRICTION_SCOPE_VALUES.join(", ")}`);
  }
  return value as CommercialRestrictionScope;
}

export function validateRestrictionType(value: unknown): CommercialRestrictionType {
  if (typeof value !== "string" || !(RESTRICTION_TYPE_VALUES as string[]).includes(value)) {
    throw new ValidationDomainError(`Invalid restriction type; allowed: ${RESTRICTION_TYPE_VALUES.join(", ")}`);
  }
  return value as CommercialRestrictionType;
}

/** value: только для MIN_STAY/ADVANCE_BOOKING; STOP_SELL/CTA/CTD — presence. */
export function validateRestrictionValue(type: CommercialRestrictionType, value: unknown): number | null {
  if (value === undefined || value === null) {
    if (type === "MIN_STAY" || type === "ADVANCE_BOOKING") {
      throw new ValidationDomainError(`Restriction ${type} requires a numeric value`);
    }
    return null;
  }
  if (type === "STOP_SELL" || type === "CLOSED_TO_ARRIVAL" || type === "CLOSED_TO_DEPARTURE") {
    throw new ValidationDomainError(`Restriction ${type} is presence-only (no value allowed)`);
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationDomainError(`Restriction ${type} value must be an integer`);
  }
  const max = type === "MIN_STAY" ? RESTRICTION_VALUE_MAX : RESTRICTION_ADVANCE_MAX;
  const min = type === "ADVANCE_BOOKING" ? 0 : 1;
  if (value < min || value > max) {
    throw new ValidationDomainError(`Restriction ${type} value must be between ${min} and ${max}`);
  }
  return value;
}

export interface ValidatedRestrictionInput {
  scope: CommercialRestrictionScope;
  type: CommercialRestrictionType;
  value: number | null;
  /** DATE-scope: точная дата; PERIOD-scope: null (даты из периода). */
  startDate: Date | null;
  endDate: Date | null;
}

/** Полная валидация restriction (create/update). */
export function validateRestrictionInput(input: {
  scope?: unknown;
  type?: unknown;
  value?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}): ValidatedRestrictionInput {
  const scope = validateRestrictionScope(input.scope);
  const type = validateRestrictionType(input.type);
  const value = validateRestrictionValue(type, input.value);

  if (scope === "PERIOD") {
    if (input.startDate !== undefined || input.endDate !== undefined) {
      throw new ValidationDomainError("PERIOD-scope restrictions derive dates from the commercial period; startDate/endDate must not be sent");
    }
    return { scope, type, value, startDate: null, endDate: null };
  }

  // DATE scope: startDate == endDate (date-only UTC).
  if (input.startDate === undefined || input.endDate === undefined) {
    throw new ValidationDomainError("DATE-scope restrictions require startDate and endDate");
  }
  const startDate = parsePeriodDate(input.startDate, "startDate");
  const endDate = parsePeriodDate(input.endDate, "endDate");
  if (startDate.getTime() !== endDate.getTime()) {
    throw new ValidationDomainError("DATE-scope restrictions require startDate == endDate (exact service date)");
  }
  return { scope, type, value, startDate, endDate };
}

/** STOP_SELL — DATE-scope only (периодный stop-sell = 1.8C CommercialPeriod.sellable). */
export function assertStopSellScope(scope: CommercialRestrictionScope, type: CommercialRestrictionType): void {
  if (type === "STOP_SELL" && scope !== "DATE") {
    throw new ValidationDomainError("STOP_SELL restrictions are DATE-scope only (period stop-sell = CommercialPeriod.sellable)");
  }
}

/** Категорийная поддержка (DD-028): необъявленная allowedRestrictions = все типы. */
export function assertCategorySupportsRestriction(
  type: CommercialRestrictionType,
  allowed: readonly string[] | null,
  categoryLabel: string,
): void {
  if (allowed === null || allowed.length === 0) return;
  if (!allowed.includes(type)) {
    throw new ValidationDomainError(
      `Restriction ${type} is not supported by category ${categoryLabel}; supported: ${allowed.join(", ")}`,
    );
  }
}

/** Base-метаданные Tariff.restrictions → типы 1.8D (для категорийного гейта). */
export function baseRestrictionKeysToTypes(keys: string[]): CommercialRestrictionType[] {
  const map: Record<string, CommercialRestrictionType> = {
    minStay: "MIN_STAY",
    maxStay: "MIN_STAY",
    advanceBookingDays: "ADVANCE_BOOKING",
    closedToArrival: "CLOSED_TO_ARRIVAL",
    closedToDeparture: "CLOSED_TO_DEPARTURE",
  };
  const out: CommercialRestrictionType[] = [];
  for (const k of keys) {
    const t = map[k];
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
