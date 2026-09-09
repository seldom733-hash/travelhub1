/**
 * D8 (B-06) — canonical registry query-param date validation contract.
 *
 * Proves the shared helper `parseDateParam` (backend/src/shared/date-param.ts)
 * enforces the accepted C2 contract exactly:
 *   - absent/empty param  → undefined (no filter)
 *   - valid value         → Date
 *   - malformed value     → BadRequestException (HTTP 400)
 *                          "<paramName> must be a valid date"
 *
 * This is the single validation mechanism for registry query-param date
 * filters; no surface may reintroduce a second competing helper.
 */
import { BadRequestException } from "@nestjs/common";
import { parseDateParam } from "./date-param";

describe("D8 B-06 — canonical parseDateParam contract", () => {
  it("absent param → undefined (no filter)", () => {
    expect(parseDateParam(undefined, "dateFrom")).toBeUndefined();
  });

  it("empty string → undefined (treated as absent, no filter)", () => {
    expect(parseDateParam("", "dateFrom")).toBeUndefined();
  });

  it("valid date string → Date", () => {
    const d = parseDateParam("2026-09-01", "dateFrom");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getTime()).not.toBeNaN();
  });

  it("malformed value → BadRequestException (400) with canonical message", () => {
    expect(() => parseDateParam("not-a-date", "dateFrom")).toThrowError(BadRequestException);
    expect(() => parseDateParam("not-a-date", "dateFrom")).toThrowError(/dateFrom must be a valid date/);
  });

  it("each param is validated independently under its own name", () => {
    expect(() => parseDateParam("nope", "dateTo")).toThrowError(/dateTo must be a valid date/);
  });

  it("error message uses the caller-supplied param name, not a hardcoded one", () => {
    expect(() => parseDateParam("nope", "availableFrom")).toThrowError(/availableFrom must be a valid date/);
  });

  it("throws synchronously before any Date value is produced (no Invalid Date can escape)", () => {
    let produced: Date | undefined;
    expect(() => {
      produced = parseDateParam("garbage", "dateFrom");
    }).toThrowError(BadRequestException);
    expect(produced).toBeUndefined();
  });

  it("accepts a valid YYYY-MM-DD date at UTC midnight", () => {
    expect(parseDateParam("2026-09-01", "dateFrom")!.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects timestamps and impossible calendar dates", () => {
    expect(() => parseDateParam("2026-09-01T10:30:00Z", "dateTo")).toThrowError(BadRequestException);
    expect(() => parseDateParam("2026-02-30", "dateTo")).toThrowError(BadRequestException);
  });
});
