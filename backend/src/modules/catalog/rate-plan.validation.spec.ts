import { ValidationDomainError } from "../../shared/errors";
import {
  RATE_PLAN_CREATE_FORBIDDEN_KEYS,
  RATE_PLAN_UPDATE_FORBIDDEN_KEYS,
  validateCurrency,
  validateInclusions,
  validatePriceBasis,
  validatePricingMode,
  validateRatePlanName,
  validateRatePlanPrice,
  validateRatePlanValidity,
  validateRefundability,
  validateRestrictions,
} from "./rate-plan.validation";
import { findForbiddenKeys } from "../../shared/field-validation";

describe("Phase 1 Step 1.8B — Rate Plan validation (unit)", () => {
  // ── name verbatim ─────────────────────────────────────────────────────────

  it("name: verbatim, только trim (case/порядок слов не меняются)", () => {
    expect(validateRatePlanName("  Room Only — Refundable  ")).toBe("Room Only — Refundable");
    expect(validateRatePlanName("Breakfast Included — Non-refundable")).toBe("Breakfast Included — Non-refundable");
    expect(validateRatePlanName("Premium Tour")).toBe("Premium Tour");
  });

  it("name: пустое/не-строка/control-символы/переполнение → 422", () => {
    expect(() => validateRatePlanName("")).toThrow(ValidationDomainError);
    expect(() => validateRatePlanName("   ")).toThrow(ValidationDomainError);
    expect(() => validateRatePlanName(42)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanName("a\u0000b")).toThrow(ValidationDomainError);
    expect(() => validateRatePlanName("x".repeat(201))).toThrow(ValidationDomainError);
  });

  // ── currency ──────────────────────────────────────────────────────────────

  it("currency: ISO 4217 валиден (3 заглавные буквы); null для legacy default", () => {
    expect(validateCurrency("AZN")).toBe("AZN");
    expect(validateCurrency("usd")).toBe("USD"); // нормализация в верхний регистр
    expect(validateCurrency("USD")).toBe("USD");
    expect(validateCurrency(undefined)).toBeNull();
    expect(validateCurrency(null)).toBeNull();
  });

  it("currency: невалидные → 422", () => {
    expect(() => validateCurrency("US")).toThrow(ValidationDomainError);
    expect(() => validateCurrency("USDD")).toThrow(ValidationDomainError);
    expect(() => validateCurrency("US1")).toThrow(ValidationDomainError);
    expect(() => validateCurrency(123)).toThrow(ValidationDomainError);
  });

  // ── price basis ───────────────────────────────────────────────────────────

  it("priceBasis: одиночный валидный тег; null для legacy", () => {
    expect(validatePriceBasis("PER_NIGHT")).toBe("PER_NIGHT");
    expect(validatePriceBasis("PER_TRIP")).toBe("PER_TRIP");
    expect(validatePriceBasis("PACKAGE_TOTAL")).toBe("PACKAGE_TOTAL");
    expect(validatePriceBasis(undefined)).toBeNull();
    expect(validatePriceBasis(null)).toBeNull();
  });

  it("priceBasis: compound/неизвестный → 422 (single semantic tag, §22)", () => {
    expect(() => validatePriceBasis("PER_ROOM_PER_NIGHT")).toThrow(ValidationDomainError);
    expect(() => validatePriceBasis("per_night")).toThrow(ValidationDomainError);
    expect(() => validatePriceBasis("PER_ROOM+NIGHT")).toThrow(ValidationDomainError);
  });

  // ── refundability / pricingMode ───────────────────────────────────────────

  it("refundability: REFUNDABLE/NON_REFUNDABLE; null legacy", () => {
    expect(validateRefundability("REFUNDABLE")).toBe("REFUNDABLE");
    expect(validateRefundability("NON_REFUNDABLE")).toBe("NON_REFUNDABLE");
    expect(validateRefundability(undefined)).toBeNull();
    expect(() => validateRefundability("PARTIAL")).toThrow(ValidationDomainError);
  });

  it("pricingMode: FIXED default; PRICE_ON_REQUEST явный (не inferred from null)", () => {
    expect(validatePricingMode(undefined)).toBe("FIXED");
    expect(validatePricingMode("FIXED")).toBe("FIXED");
    expect(validatePricingMode("PRICE_ON_REQUEST")).toBe("PRICE_ON_REQUEST");
    expect(() => validatePricingMode("DYNAMIC")).toThrow(ValidationDomainError);
  });

  // ── price Decimal ─────────────────────────────────────────────────────────

  it("price: конечное неотрицательное, ≤2 знака; 0 — легитимная бесплатная услуга", () => {
    expect(validateRatePlanPrice(0)).toBe(0);
    expect(validateRatePlanPrice(35)).toBe(35);
    expect(validateRatePlanPrice(35.5)).toBe(35.5);
    expect(validateRatePlanPrice(100.25)).toBe(100.25);
  });

  it("price: отрицательные/NaN/Infinity/переполнение Decimal(12,2)/>2 знака → 422", () => {
    expect(() => validateRatePlanPrice(-1)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanPrice(NaN)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanPrice(Infinity)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanPrice(10_000_000_000)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanPrice(1.001)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanPrice("100")).toThrow(ValidationDomainError);
  });

  // ── inclusions / restrictions ─────────────────────────────────────────────

  it("inclusions: whitelist-ключи и типы", () => {
    expect(
      validateInclusions({ mealPlan: "Breakfast", includedServices: ["Transfer", "Guide"], notes: "x" }),
    ).toEqual({ mealPlan: "Breakfast", includedServices: ["Transfer", "Guide"], notes: "x" });
    expect(validateInclusions(null)).toBeNull();
    expect(validateInclusions(undefined)).toBeNull();
  });

  it("inclusions: неизвестный ключ / неверный тип → 422", () => {
    expect(() => validateInclusions({ roomService: true })).toThrow(ValidationDomainError);
    expect(() => validateInclusions({ mealPlan: 42 })).toThrow(ValidationDomainError);
    expect(() => validateInclusions({ includedServices: "Transfer" })).toThrow(ValidationDomainError);
    expect(() => validateInclusions([1, 2])).toThrow(ValidationDomainError);
  });

  it("restrictions: whitelist metadata (minStay/maxStay/closedToArrival/...)", () => {
    expect(
      validateRestrictions({ minStay: 1, maxStay: 7, closedToArrival: true, advanceBookingDays: 3 }),
    ).toEqual({ minStay: 1, maxStay: 7, closedToArrival: true, advanceBookingDays: 3 });
    expect(validateRestrictions(null)).toBeNull();
  });

  it("restrictions: maxStay < minStay / неверные типы / неизвестный ключ → 422", () => {
    expect(() => validateRestrictions({ minStay: 5, maxStay: 2 })).toThrow(ValidationDomainError);
    expect(() => validateRestrictions({ minStay: -1 })).toThrow(ValidationDomainError);
    expect(() => validateRestrictions({ closedToArrival: "yes" })).toThrow(ValidationDomainError);
    expect(() => validateRestrictions({ releasePolicy: "x" })).toThrow(ValidationDomainError);
  });

  // ── legacy validFrom/validTo ──────────────────────────────────────────────

  it("validity: ISO даты; оба null допустимы; validFrom <= validTo", () => {
    const both = validateRatePlanValidity("2026-06-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z");
    expect(both.validFrom?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(both.validTo?.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(validateRatePlanValidity(undefined, undefined)).toEqual({ validFrom: null, validTo: null });
  });

  it("validity: невалидные даты / validFrom после validTo → 422", () => {
    expect(() => validateRatePlanValidity("not-a-date", undefined)).toThrow(ValidationDomainError);
    expect(() => validateRatePlanValidity(undefined, "bad")).toThrow(ValidationDomainError);
    expect(() => validateRatePlanValidity("2026-08-31", "2026-06-01")).toThrow(ValidationDomainError);
  });

  // ── forbidden keys (mass assignment) ──────────────────────────────────────

  it("create forbidden keys: ownership/identity/lifecycle/temporal/1.8C+1.8D факты", () => {
    const hit = findForbiddenKeys(
      {
        name: "X",
        price: 100,
        serviceUnitId: "uni-1",
        productId: "p1",
        partnerId: "p2",
        status: "ACTIVE",
        version: 5,
        commercialPeriods: [{ from: "2026-01-01" }],
        availability: { slots: 1 },
        acquisitionSource: "X",
        createdAt: "2020-01-01",
      },
      RATE_PLAN_CREATE_FORBIDDEN_KEYS,
    );
    expect(hit).toEqual(
      expect.arrayContaining(["productId", "partnerId", "status", "version", "commercialPeriods", "availability", "acquisitionSource", "createdAt"]),
    );
    // serviceUnitId — легитимный вход (не forbidden).
    expect(hit).not.toContain("serviceUnitId");
  });

  it("update forbidden keys: create + currency immutable", () => {
    const hit = findForbiddenKeys({ name: "X", currency: "EUR" }, RATE_PLAN_UPDATE_FORBIDDEN_KEYS);
    expect(hit).toContain("currency");
    expect(() => {
      // sanity: валидный update-body (name/price) не содержит forbidden ключей.
      const ok = findForbiddenKeys({ name: "Y", price: 5 }, RATE_PLAN_UPDATE_FORBIDDEN_KEYS);
      if (ok.length > 0) throw new Error(`unexpected forbidden keys: ${ok.join(",")}`);
    }).not.toThrow();
  });
});
