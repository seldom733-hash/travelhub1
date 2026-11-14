import { resolveSalesPeriod } from "./sales-analytics.service";

const now = new Date("2026-11-15T12:00:00.000Z");

describe("resolveSalesPeriod", () => {
  it("resolves today in the requested timezone", () => {
    const p = resolveSalesPeriod({ preset: "TODAY", timezone: "Asia/Baku" }, now);
    expect(p.start.toISOString()).toBe("2026-11-14T20:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-11-15T20:00:00.000Z");
  });

  it("resolves current month", () => {
    const p = resolveSalesPeriod({ preset: "CURRENT_MONTH", timezone: "Asia/Baku" }, now);
    expect(p.start.toISOString()).toBe("2026-10-31T20:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-11-30T20:00:00.000Z");
  });

  it("resolves previous quarter", () => {
    const p = resolveSalesPeriod({ preset: "PREVIOUS_QUARTER", timezone: "Asia/Baku" }, now);
    expect(p.start.toISOString()).toBe("2026-06-30T20:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-09-30T20:00:00.000Z");
  });

  it("resolves custom inclusive dates", () => {
    const p = resolveSalesPeriod({ preset: "CUSTOM", startDate: "2026-11-01", endDate: "2026-11-15", timezone: "Asia/Baku" }, now);
    expect(p.start.toISOString()).toBe("2026-10-31T20:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-11-15T20:00:00.000Z");
  });

  it("rejects custom ranges without dates", () => {
    expect(() => resolveSalesPeriod({ preset: "CUSTOM", timezone: "UTC" }, now)).toThrow();
  });
});
