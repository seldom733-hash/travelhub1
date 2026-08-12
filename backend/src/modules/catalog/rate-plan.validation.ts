import { ValidationDomainError } from "../../shared/errors";

/**
 * PHASE 1 STEP 1.8B — Rate Plan (Tariff → canonical Rate Plan foundation) — чистые валидаторы.
 *
 * DD-024 / Universal Pricing §5-§17. Здесь только structure-and-commercial валидация:
 *  - Seller-определённое коммерческое название — verbatim (только trim);
 *  - одна canonical валюта на Rate Plan (ISO 4217, immutable после создания);
 *  - priceBasis — одиночный семантический тег (STRICT REVIEW §22, без compound);
 *  - PRICE_ON_REQUEST — явное состояние (missing price ≠ PRICE_ON_REQUEST);
 *  - price Decimal(12,2) — неотрицательный, конечный; 0 = легитимная бесплатная услуга;
 *  - inclusions/restrictions — структурированные metadata (whitelist-ключи),
 *    engine/enforcement — 1.8D;
 *  - legacy validFrom/validTo — коммерческая/booking validity window (НЕ stay-period),
 *    не переинтерпретируется как CommercialPeriod (STRICT REVIEW §32);
 *  - client не контролирует ownership/lifecycle/identity/temporal/audit.
 */

/** Допустимые price basis (одиночный тег, Universal Pricing §5). */
export const PRICE_BASIS_VALUES = [
  "PER_UNIT",
  "PER_ROOM",
  "PER_PERSON",
  "PER_NIGHT",
  "PER_DAY",
  "PER_HOUR",
  "PER_TRIP",
  "PER_SERVICE",
  "PACKAGE_TOTAL",
] as const;
export type PriceBasisValue = (typeof PRICE_BASIS_VALUES)[number];

/** Допустимые refundability-состояния (минимальная явная семантика, §13). */
export const REFUNDABILITY_VALUES = ["REFUNDABLE", "NON_REFUNDABLE"] as const;
export type RefundabilityValue = (typeof REFUNDABILITY_VALUES)[number];

/** Pricing mode (явное inquiry-only состояние, §17/Universal §9). */
export const PRICING_MODE_VALUES = ["FIXED", "PRICE_ON_REQUEST"] as const;
export type PricingModeValue = (typeof PRICING_MODE_VALUES)[number];

/** Максимальная длина коммерческого названия Rate Plan (после trim). */
export const RATE_PLAN_NAME_MAX = 200;

/** Максимальная сумма (Decimal(12,2)): 9_999_999_999.99. */
export const RATE_PLAN_PRICE_MAX = 9_999_999_999.99;

/**
 * Поля, которые клиент НИКОГДА не может передать при create Rate Plan:
 * ownership (partnerId/sellerId/ownerId), identity (id/code/productId),
 * lifecycle/status/version, audit/temporal, acquisitionSource, будущие
 * CommercialPeriod/resolver/availability/reservation/sales refs.
 * serviceUnitId НЕ запрещён на create — легитимный вход (сервер валидирует
 * unit.productId == tariff.productId + ownership).
 */
export const RATE_PLAN_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "productId",
  "partnerId",
  "sellerId",
  "ownerId",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "actorId",
  "actorName",
  "schemaVersion",
  "acquisitionSource",
  "source",
  // 1.8C/1.8D — НЕ реализованы; forged period/calendar/resolver факты → 422.
  "commercialPeriod",
  "commercialPeriods",
  "periods",
  "calendar",
  "overrides",
  "rules",
  "resolver",
  "availability",
  "availabilitySlots",
  "reservation",
  "reservationIds",
  "quoteId",
  "saleId",
  "checkoutId",
  "orderId",
  "bookingId",
  "correlationId",
  "causationId",
] as const;

/**
 * PATCH: те же server-owned поля ПЛЮС currency (immutable после создания —
 * смена валюты = новый Rate Plan; одна canonical валюта на план, DD-029).
 */
export const RATE_PLAN_UPDATE_FORBIDDEN_KEYS = [...RATE_PLAN_CREATE_FORBIDDEN_KEYS, "currency"] as const;

/** ISO 4217: ровно 3 заглавные латинские буквы. */
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Валидация Seller-определённого коммерческого названия Rate Plan.
 * Verbatim (только trim): case/порядок слов/пунктуация НЕ нормализуются.
 */
export function validateRatePlanName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationDomainError("Rate plan name must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationDomainError("Rate plan name is required");
  }
  if (trimmed.length > RATE_PLAN_NAME_MAX) {
    throw new ValidationDomainError(`Rate plan name must be at most ${RATE_PLAN_NAME_MAX} characters`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new ValidationDomainError("Rate plan name contains invalid control characters");
  }
  return trimmed;
}

/**
 * Валидация цены: конечное неотрицательное число, ≤ Decimal(12,2) максимума,
 * ≤ 2 знака после запятой. 0 — легитимная бесплатная услуга (НЕ missing/ПОР).
 * Возвращает number (конвертация в Decimal — в сервисе).
 */
export function validateRatePlanPrice(price: unknown): number {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new ValidationDomainError("Rate plan price must be a finite number");
  }
  if (price < 0) {
    throw new ValidationDomainError("Rate plan price must be non-negative");
  }
  if (price > RATE_PLAN_PRICE_MAX) {
    throw new ValidationDomainError(`Rate plan price must be at most ${RATE_PLAN_PRICE_MAX}`);
  }
  // Не более 2 знаков после запятой (Decimal(12,2) — без silent rounding).
  const cents = Math.round(price * 100);
  if (Math.abs(price * 100 - cents) > 1e-9) {
    throw new ValidationDomainError("Rate plan price must have at most 2 decimal places");
  }
  return price;
}

/** Валидация canonical валюты (ISO 4217). undefined/null → null (default USD в сервисе). */
export function validateCurrency(currency: unknown): string | null {
  if (currency === undefined || currency === null) return null;
  if (typeof currency !== "string") {
    throw new ValidationDomainError("Rate plan currency must be a string");
  }
  const trimmed = currency.trim().toUpperCase();
  if (!ISO_CURRENCY_PATTERN.test(trimmed)) {
    throw new ValidationDomainError("Rate plan currency must be a valid ISO 4217 code (3 uppercase letters)");
  }
  return trimmed;
}

/** Price basis: одиночный тег. undefined/null → null (legacy-compatible). */
export function validatePriceBasis(basis: unknown): PriceBasisValue | null {
  if (basis === undefined || basis === null) return null;
  if (typeof basis !== "string" || !(PRICE_BASIS_VALUES as readonly string[]).includes(basis)) {
    throw new ValidationDomainError(`Invalid price basis; allowed: ${PRICE_BASIS_VALUES.join(", ")}`);
  }
  return basis as PriceBasisValue;
}

/** Refundability: минимальная явная семантика. undefined/null → null. */
export function validateRefundability(value: unknown): RefundabilityValue | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !(REFUNDABILITY_VALUES as readonly string[]).includes(value)) {
    throw new ValidationDomainError(`Invalid refundability; allowed: ${REFUNDABILITY_VALUES.join(", ")}`);
  }
  return value as RefundabilityValue;
}

/** Pricing mode: FIXED (default) | PRICE_ON_REQUEST (явное состояние, не inferred from null). */
export function validatePricingMode(value: unknown): PricingModeValue {
  if (value === undefined || value === null) return "FIXED";
  if (typeof value !== "string" || !(PRICING_MODE_VALUES as readonly string[]).includes(value)) {
    throw new ValidationDomainError(`Invalid pricing mode; allowed: ${PRICING_MODE_VALUES.join(", ")}`);
  }
  return value as PricingModeValue;
}

// ── inclusions / restrictions (metadata foundations; enforcement — 1.8D) ───

const INCLUSIONS_KEYS = ["mealPlan", "includedServices", "includedMeals", "amenities", "notes"] as const;
const RESTRICTIONS_KEYS = [
  "minStay",
  "maxStay",
  "advanceBookingDays",
  "closedToArrival",
  "closedToDeparture",
  "occupancyRestriction",
  "notes",
] as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const MAX_STR = 500;
const MAX_STR_ITEM = 200;
const MAX_ARRAY_ITEMS = 50;

function validateStringArray(v: unknown, key: string, maxItems = MAX_ARRAY_ITEMS, maxLen = MAX_STR_ITEM): string[] {
  if (!Array.isArray(v) || v.some((i) => typeof i !== "string")) {
    throw new ValidationDomainError(`Rate plan ${key} must be an array of strings`);
  }
  if (v.length > maxItems) {
    throw new ValidationDomainError(`Rate plan ${key} must have at most ${maxItems} items`);
  }
  if (v.some((i) => i.trim() === "" || i.length > maxLen)) {
    throw new ValidationDomainError(`Rate plan ${key} items must be non-empty and at most ${maxLen} characters`);
  }
  return v;
}

function validateShortString(v: unknown, key: string, maxLen = MAX_STR): string {
  if (typeof v !== "string" || v.trim() === "" || v.length > maxLen) {
    throw new ValidationDomainError(`Rate plan ${key} must be a non-empty string of at most ${maxLen} characters`);
  }
  return v;
}

function validateNonNegativeInt(v: unknown, key: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3650) {
    throw new ValidationDomainError(`Rate plan ${key} must be an integer between 0 and 3650`);
  }
  return v;
}

/**
 * Структурированные inclusions (meal plan / included services) — whitelist-ключи.
 * Seller display name остаётся в name (verbatim); здесь — normalized metadata.
 */
export function validateInclusions(v: unknown): Record<string, unknown> | null {
  if (v === undefined || v === null) return null;
  if (!isPlainObject(v)) {
    throw new ValidationDomainError("Rate plan inclusions must be an object");
  }
  for (const key of Object.keys(v)) {
    if (!(INCLUSIONS_KEYS as readonly string[]).includes(key)) {
      throw new ValidationDomainError(
        `Unknown inclusions key "${key}"; allowed: ${INCLUSIONS_KEYS.join(", ")}`,
      );
    }
  }
  const out: Record<string, unknown> = {};
  if (v.mealPlan !== undefined) out.mealPlan = validateShortString(v.mealPlan, "inclusions.mealPlan", 100);
  if (v.includedServices !== undefined) out.includedServices = validateStringArray(v.includedServices, "inclusions.includedServices");
  if (v.includedMeals !== undefined) out.includedMeals = validateStringArray(v.includedMeals, "inclusions.includedMeals");
  if (v.amenities !== undefined) out.amenities = validateStringArray(v.amenities, "inclusions.amenities");
  if (v.notes !== undefined) out.notes = validateShortString(v.notes, "inclusions.notes");
  return out;
}

/**
 * Структурированные restrictions metadata (foundation, НЕ engine): minStay/
 * maxStay/advanceBookingDays/closedToArrival/closedToDeparture/occupancyRestriction.
 * Enforcement/поведение — 1.8D; здесь только хранение и валидация формы.
 */
export function validateRestrictions(v: unknown): Record<string, unknown> | null {
  if (v === undefined || v === null) return null;
  if (!isPlainObject(v)) {
    throw new ValidationDomainError("Rate plan restrictions must be an object");
  }
  for (const key of Object.keys(v)) {
    if (!(RESTRICTIONS_KEYS as readonly string[]).includes(key)) {
      throw new ValidationDomainError(
        `Unknown restrictions key "${key}"; allowed: ${RESTRICTIONS_KEYS.join(", ")}`,
      );
    }
  }
  const out: Record<string, unknown> = {};
  if (v.minStay !== undefined) out.minStay = validateNonNegativeInt(v.minStay, "restrictions.minStay");
  if (v.maxStay !== undefined) out.maxStay = validateNonNegativeInt(v.maxStay, "restrictions.maxStay");
  if (out.minStay !== undefined && out.maxStay !== undefined && (out.maxStay as number) < (out.minStay as number)) {
    throw new ValidationDomainError("restrictions.maxStay must not be less than minStay");
  }
  if (v.advanceBookingDays !== undefined) out.advanceBookingDays = validateNonNegativeInt(v.advanceBookingDays, "restrictions.advanceBookingDays");
  if (v.closedToArrival !== undefined) {
    if (typeof v.closedToArrival !== "boolean") {
      throw new ValidationDomainError("restrictions.closedToArrival must be a boolean");
    }
    out.closedToArrival = v.closedToArrival;
  }
  if (v.closedToDeparture !== undefined) {
    if (typeof v.closedToDeparture !== "boolean") {
      throw new ValidationDomainError("restrictions.closedToDeparture must be a boolean");
    }
    out.closedToDeparture = v.closedToDeparture;
  }
  if (v.occupancyRestriction !== undefined) out.occupancyRestriction = validateShortString(v.occupancyRestriction, "restrictions.occupancyRestriction", 200);
  if (v.notes !== undefined) out.notes = validateShortString(v.notes, "restrictions.notes");
  return out;
}

/**
 * Legacy validFrom/validTo — коммерческая/booking validity window (НЕ stay-period).
 * Оба опциональны; validFrom <= validTo когда оба заданы. Дата принимается как
 * ISO-строка (UTC date-only семантика — как Availability.date; timezone — гейт 2.8A).
 */
export function validateRatePlanValidity(
  validFrom: unknown,
  validTo: unknown,
): { validFrom: Date | null; validTo: Date | null } {
  let from: Date | null = null;
  let to: Date | null = null;
  if (validFrom !== undefined && validFrom !== null) {
    if (typeof validFrom !== "string" || Number.isNaN(Date.parse(validFrom))) {
      throw new ValidationDomainError("validFrom must be a valid ISO date string");
    }
    from = new Date(validFrom);
  }
  if (validTo !== undefined && validTo !== null) {
    if (typeof validTo !== "string" || Number.isNaN(Date.parse(validTo))) {
      throw new ValidationDomainError("validTo must be a valid ISO date string");
    }
    to = new Date(validTo);
  }
  if (from && to && from.getTime() > to.getTime()) {
    throw new ValidationDomainError("validFrom must not be after validTo");
  }
  return { validFrom: from, validTo: to };
}
