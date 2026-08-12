import {
  validatePeriodInput,
  validatePeriodRange,
  validatePeriodKind,
  validateDayOfWeek,
  validatePeriodPrice,
  validatePeriodSellable,
  COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS,
} from "./period.validation";
import { ValidationDomainError } from "../../shared/errors";

describe("period.validation (Step 1.8C)", () => {
  it("validatePeriodRange: inclusive; reverse range → 422", () => {
    const { startDate, endDate } = validatePeriodRange("2026-07-10", "2026-07-15");
    expect(startDate.toISOString().slice(0, 10)).toBe("2026-07-10");
    expect(endDate.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(() => validatePeriodRange("2026-07-15", "2026-07-10")).toThrow(ValidationDomainError);
    expect(() => validatePeriodRange("2026-07-1", "2026-07-15")).toThrow(ValidationDomainError);
    expect(() => validatePeriodRange("2026-13-01", "2026-07-15")).toThrow(ValidationDomainError);
  });

  it("validatePeriodKind: default PERIOD; invalid → 422", () => {
    expect(validatePeriodKind(undefined)).toBe("PERIOD");
    expect(validatePeriodKind("DATE_OVERRIDE")).toBe("DATE_OVERRIDE");
    expect(() => validatePeriodKind("OVERRIDE")).toThrow(ValidationDomainError);
  });

  it("validateDayOfWeek: 0-6, dedup, bounds", () => {
    expect(validateDayOfWeek([0, 6, 0])).toEqual([0, 6]);
    expect(validateDayOfWeek([])).toEqual([]);
    expect(validateDayOfWeek(null)).toEqual([]);
    expect(() => validateDayOfWeek([7])).toThrow(ValidationDomainError);
    expect(() => validateDayOfWeek([-1])).toThrow(ValidationDomainError);
    expect(() => validateDayOfWeek(["monday"])).toThrow(ValidationDomainError);
  });

  it("validatePeriodPrice: non-negative, 2dp, bounds; zero allowed (free date ≠ missing)", () => {
    expect(validatePeriodPrice(0)).toBe(0);
    expect(validatePeriodPrice(120.5)).toBe(120.5);
    expect(() => validatePeriodPrice(-1)).toThrow(ValidationDomainError);
    expect(() => validatePeriodPrice(1.234)).toThrow(ValidationDomainError);
    expect(() => validatePeriodPrice(Number.NaN)).toThrow(ValidationDomainError);
  });

  it("validatePeriodSellable: boolean; default true", () => {
    expect(validatePeriodSellable(undefined)).toBe(true);
    expect(validatePeriodSellable(false)).toBe(false);
    expect(() => validatePeriodSellable("no")).toThrow(ValidationDomainError);
  });

  it("validatePeriodInput: DATE_OVERRIDE must be single date; cannot carry dayOfWeek", () => {
    expect(() =>
      validatePeriodInput({ kind: "DATE_OVERRIDE", startDate: "2026-07-12", endDate: "2026-07-13", price: 100 }),
    ).toThrow(ValidationDomainError);
    expect(() =>
      validatePeriodInput({ kind: "DATE_OVERRIDE", startDate: "2026-07-12", endDate: "2026-07-12", dayOfWeek: [0], price: 100 }),
    ).toThrow(ValidationDomainError);
    const ok = validatePeriodInput({ kind: "DATE_OVERRIDE", startDate: "2026-07-12", endDate: "2026-07-12", price: 260 });
    expect(ok.kind).toBe("DATE_OVERRIDE");
  });

  it("forbidden keys protect server-owned/1.8D/Quote/hold/currency facts", () => {
    const forbidden = COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS;
    for (const key of ["id", "code", "tariffId", "partnerId", "currency", "status", "version", "createdAt", "quoteId", "saleId", "reservationIds", "resolvedPrice", "rules"]) {
      expect(forbidden).toContain(key);
    }
  });
});
