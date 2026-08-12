import { ValidationDomainError } from "../../shared/errors";
import {
  assertCategorySupportsRestriction,
  assertStopSellScope,
  baseRestrictionKeysToTypes,
  validateRestrictionInput,
} from "./restriction.validation";

describe("Step 1.8D restriction validation", () => {
  it("valid DATE-scope STOP_SELL passes", () => {
    const v = validateRestrictionInput({ scope: "DATE", type: "STOP_SELL", startDate: "2026-08-20", endDate: "2026-08-20" });
    expect(v.scope).toBe("DATE");
    expect(v.value).toBeNull();
  });

  it("STOP_SELL is DATE-scope only", () => {
    expect(() => assertStopSellScope("PERIOD", "STOP_SELL")).toThrow(ValidationDomainError);
  });

  it("invalid scope/type rejected", () => {
    expect(() => validateRestrictionInput({ scope: "TARIFF", type: "STOP_SELL" })).toThrow(ValidationDomainError);
    expect(() => validateRestrictionInput({ scope: "DATE", type: "NO_SHOW" })).toThrow(ValidationDomainError);
  });

  it("MIN_STAY requires value 1..365", () => {
    expect(() => validateRestrictionInput({ scope: "DATE", type: "MIN_STAY", startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/requires a numeric value/);
    expect(() => validateRestrictionInput({ scope: "DATE", type: "MIN_STAY", value: 0, startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/between 1 and 365/);
    expect(() => validateRestrictionInput({ scope: "DATE", type: "MIN_STAY", value: 366, startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/between 1 and 365/);
    const ok = validateRestrictionInput({ scope: "DATE", type: "MIN_STAY", value: 3, startDate: "2026-08-20", endDate: "2026-08-20" });
    expect(ok.value).toBe(3);
  });

  it("ADVANCE_BOOKING allows 0..365", () => {
    const zero = validateRestrictionInput({ scope: "DATE", type: "ADVANCE_BOOKING", value: 0, startDate: "2026-08-20", endDate: "2026-08-20" });
    expect(zero.value).toBe(0);
    expect(() => validateRestrictionInput({ scope: "DATE", type: "ADVANCE_BOOKING", value: -1, startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/between 0 and 365/);
  });

  it("CTA/CTD are presence-only (value rejected)", () => {
    expect(() => validateRestrictionInput({ scope: "DATE", type: "CLOSED_TO_ARRIVAL", value: 1, startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/presence-only/);
    const ok = validateRestrictionInput({ scope: "DATE", type: "CLOSED_TO_DEPARTURE", startDate: "2026-08-20", endDate: "2026-08-20" });
    expect(ok.value).toBeNull();
  });

  it("DATE scope requires startDate == endDate (exact date)", () => {
    expect(() => validateRestrictionInput({ scope: "DATE", type: "STOP_SELL", startDate: "2026-08-20", endDate: "2026-08-21" })).toThrow(/startDate == endDate/);
    expect(() => validateRestrictionInput({ scope: "DATE", type: "STOP_SELL", startDate: "2026-13-99", endDate: "2026-13-99" })).toThrow(/calendar date/);
  });

  it("PERIOD scope derives dates from the period (dates rejected)", () => {
    expect(() => validateRestrictionInput({ scope: "PERIOD", type: "MIN_STAY", value: 2, startDate: "2026-08-20", endDate: "2026-08-20" })).toThrow(/derive dates/);
    const ok = validateRestrictionInput({ scope: "PERIOD", type: "MIN_STAY", value: 2 });
    expect(ok.startDate).toBeNull();
  });

  it("base metadata keys map to 1.8D restriction types", () => {
    const types = baseRestrictionKeysToTypes(["minStay", "maxStay", "advanceBookingDays", "closedToArrival", "closedToDeparture", "occupancyRestriction", "notes"]);
    expect(types.sort()).toEqual(["ADVANCE_BOOKING", "CLOSED_TO_ARRIVAL", "CLOSED_TO_DEPARTURE", "MIN_STAY"]);
  });

  it("category allowlist enforcement (DD-028)", () => {
    expect(() => assertCategorySupportsRestriction("MIN_STAY", ["STOP_SELL", "ADVANCE_BOOKING"], "CAT-A")).toThrow(/not supported by category CAT-A/);
    expect(() => assertCategorySupportsRestriction("MIN_STAY", null, "CAT-A")).not.toThrow();
    expect(() => assertCategorySupportsRestriction("MIN_STAY", [], "CAT-A")).not.toThrow();
    expect(() => assertCategorySupportsRestriction("STOP_SELL", ["STOP_SELL"], "CAT-A")).not.toThrow();
  });
});
