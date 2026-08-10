import {
  normalizeRequestDates,
  normalizePax,
  normalizeBudget,
  normalizePreferences,
} from "./requests.validation";
import { ValidationDomainError } from "../../shared/errors";

describe("reverse.requests.validation", () => {
  describe("normalizeRequestDates", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    it("accepts exact date (from == to)", () => {
      const r = normalizeRequestDates("2026-09-01", "2026-09-01", now);
      expect(r.serviceDateFrom?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(r.serviceDateTo?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    });

    it("accepts range and open dates", () => {
      expect(normalizeRequestDates("2026-09-01", "2026-09-10", now).serviceDateTo?.toISOString()).toBe(
        "2026-09-10T00:00:00.000Z",
      );
      expect(normalizeRequestDates(undefined, undefined, now)).toEqual({});
    });

    it("rejects from > to", () => {
      expect(() => normalizeRequestDates("2026-09-10", "2026-09-01", now)).toThrow(ValidationDomainError);
    });

    it("rejects past / malformed dates", () => {
      expect(() => normalizeRequestDates("2020-01-01", undefined, now)).toThrow(ValidationDomainError);
      expect(() => normalizeRequestDates("not-a-date", undefined, now)).toThrow(ValidationDomainError);
    });
  });

  describe("normalizePax", () => {
    it("accepts minimal and larger compositions", () => {
      expect(normalizePax(1, 0, 0)).toEqual({ adults: 1, children: 0, infants: 0 });
      expect(normalizePax(2, 1, 1)).toEqual({ adults: 2, children: 1, infants: 1 });
    });

    it("rejects zero adults, negatives, non-integers, over-limit", () => {
      expect(() => normalizePax(0, 0, 0)).toThrow(ValidationDomainError);
      expect(() => normalizePax(-1, 0, 0)).toThrow(ValidationDomainError);
      expect(() => normalizePax(1.5, 0, 0)).toThrow(ValidationDomainError);
      expect(() => normalizePax(1, 51, 0)).toThrow(ValidationDomainError);
    });
  });

  describe("normalizeBudget", () => {
    it("accepts currency-only and range", () => {
      expect(normalizeBudget({ currency: "USD" })).toEqual({ currency: "USD" });
      expect(normalizeBudget({ currency: "USD", min: 100, max: 500 })).toEqual({ currency: "USD", min: 100, max: 500 });
    });

    it("returns undefined for null/undefined", () => {
      expect(normalizeBudget(undefined)).toBeUndefined();
      expect(normalizeBudget(null)).toBeUndefined();
    });

    it("rejects invalid currency, negatives, min > max, unknown keys", () => {
      expect(() => normalizeBudget({ currency: "usd" })).toThrow(ValidationDomainError);
      expect(() => normalizeBudget({ currency: "USD", min: -1 })).toThrow(ValidationDomainError);
      expect(() => normalizeBudget({ currency: "USD", min: 500, max: 100 })).toThrow(ValidationDomainError);
      expect(() => normalizeBudget({ currency: "USD", foo: 1 })).toThrow(ValidationDomainError);
    });
  });

  describe("normalizePreferences", () => {
    it("accepts free-form demand hints", () => {
      expect(normalizePreferences({ hotelCategory: "4*", mealPlan: "BB", transport: "private" })).toEqual({
        hotelCategory: "4*",
        mealPlan: "BB",
        transport: "private",
      });
    });

    it("rejects contact/PII keys (top-level и вложенные)", () => {
      expect(() => normalizePreferences({ email: "a@b.c" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ contactPhone: "123" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ whatsapp: "123" })).toThrow(ValidationDomainError);
      // Nested bypass: top-level ключ безопасен, контакт вложен.
      expect(() => normalizePreferences({ details: { phone: "+994501234567" } })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ notes: { wa: "123" } })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ list: [{ email: "a@b.c" }] })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ deep: { a: { b: { c: { tel: "1" } } } } })).toThrow(ValidationDomainError);
      // Альтернативные контакт-ключи (word-boundary):
      expect(() => normalizePreferences({ mobile: "123" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ tel: "123" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ mail: "a@b" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ "e-mail": "a@b" })).toThrow(ValidationDomainError);
      expect(() => normalizePreferences({ wa: "123" })).toThrow(ValidationDomainError);
    });

    it("НЕ блокирует легитимные travel-ключи (нет false positives на substring)", () => {
      expect(
        normalizePreferences({ travelStyle: "leisure", hotelCategory: "4*", roomNumber: "101", contactlessCheckin: true, automobile: "compact" }),
      ).toEqual({ travelStyle: "leisure", hotelCategory: "4*", roomNumber: "101", contactlessCheckin: true, automobile: "compact" });
    });

    it("rejects non-object and oversized", () => {
      expect(() => normalizePreferences([1] as never)).toThrow(ValidationDomainError);
      const many: Record<string, number> = {};
      for (let i = 0; i < 21; i++) many[`k${i}`] = i;
      expect(() => normalizePreferences(many)).toThrow(ValidationDomainError);
    });
  });
});
