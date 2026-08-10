/**
 * PHASE 2 STEP 2.3A — Checkout pure logic unit tests (§81).
 *  - service date: date-only contract, past/невалидные календарные даты → 422;
 *  - availability classification: NOT_CONFIGURED / AVAILABLE / UNAVAILABLE
 *    (boundary required == available), отрицательные available — честно;
 *  - quote expiry: past/future/equal-now/null validUntil → флаги §46/§68.
 */
import { classifyAvailability, parseServiceDate, quoteExpiry } from "./sales.checkout";
import { ValidationDomainError } from "../../shared/errors";

describe("Step 2.3A — sales.checkout pure helpers", () => {
  describe("parseServiceDate", () => {
    const now = new Date("2026-08-10T12:34:56.789Z");

    it("валидная date-only → UTC midnight (без day-shift)", () => {
      const d = parseServiceDate("2026-08-20", now);
      expect(d.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    });

    it("сегодняшняя календарная дата допустима (UTC)", () => {
      expect(parseServiceDate("2026-08-10", now).toISOString()).toBe("2026-08-10T00:00:00.000Z");
    });

    it("прошедшая дата → 422", () => {
      expect(() => parseServiceDate("2026-08-09", now)).toThrow(ValidationDomainError);
    });

    it("не date-only (time/timezone/ISO instant) → 422", () => {
      for (const bad of ["2026-08-20T10:00:00Z", "2026-08-20T10:00:00", "2026-08-20 10:00:00", "20.08.2026"]) {
        expect(() => parseServiceDate(bad, now)).toThrow(/calendar date/);
      }
    });

    it("невалидная календарная дата (2026-02-30) → 422", () => {
      expect(() => parseServiceDate("2026-02-30", now)).toThrow(ValidationDomainError);
    });
  });

  describe("classifyAvailability", () => {
    it("без строки capacity → NOT_CONFIGURED (честно, без изобретения availability)", () => {
      expect(classifyAvailability(2, null)).toEqual({ level: "NOT_CONFIGURED", availableSlots: null });
    });

    it("available >= required → AVAILABLE (boundary равенство)", () => {
      expect(classifyAvailability(5, { slotsTotal: 10, slotsBooked: 2, slotsReserved: 3 })).toEqual({
        level: "AVAILABLE",
        availableSlots: 5,
      });
    });

    it("available < required → UNAVAILABLE", () => {
      expect(classifyAvailability(6, { slotsTotal: 10, slotsBooked: 2, slotsReserved: 3 })).toEqual({
        level: "UNAVAILABLE",
        availableSlots: 5,
      });
    });

    it("нулевой available → UNAVAILABLE", () => {
      expect(classifyAvailability(1, { slotsTotal: 5, slotsBooked: 5, slotsReserved: 0 })).toEqual({
        level: "UNAVAILABLE",
        availableSlots: 0,
      });
    });

    it("отрицательный available (несогласованные catalog-данные) НЕ маскируется → UNAVAILABLE", () => {
      const r = classifyAvailability(1, { slotsTotal: 3, slotsBooked: 4, slotsReserved: 1 });
      expect(r.level).toBe("UNAVAILABLE");
      expect(r.availableSlots).toBe(-2);
    });
  });

  describe("quoteExpiry", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    it("validUntil в будущем → не expired, price authoritative", () => {
      expect(quoteExpiry(new Date("2026-08-11T00:00:00.000Z"), now)).toEqual({
        quoteExpired: false,
        priceAuthoritative: true,
      });
    });

    it("validUntil в прошлом → expired, price НЕ authoritative", () => {
      expect(quoteExpiry(new Date("2026-08-09T00:00:00.000Z"), now)).toEqual({
        quoteExpired: true,
        priceAuthoritative: false,
      });
    });

    it("validUntil == now (boundary) → expired (validUntil <= now)", () => {
      expect(quoteExpiry(new Date("2026-08-10T12:00:00.000Z"), now).quoteExpired).toBe(true);
    });

    it("validUntil === null → defensively not expired", () => {
      expect(quoteExpiry(null, now)).toEqual({ quoteExpired: false, priceAuthoritative: true });
    });
  });
});
