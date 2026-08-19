/**
 * Step 3.3 Analytics Foundation — Period Resolver Tests
 *
 * Deterministic tests for period resolution using controlled reference instants.
 */

import {
  AnalyticsPeriodPreset,
  resolvePeriod,
  isValidTimezone,
  type PeriodRequest,
} from "./analytics-period.resolver";

describe("AnalyticsPeriodResolver", () => {
  // Fixed reference: 2026-08-19T14:30:00Z (Tuesday)
  const NOW = new Date("2026-08-19T14:30:00Z");

  describe("isValidTimezone", () => {
    it("accepts valid IANA timezone", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("Asia/Baku")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
    });

    it("rejects invalid timezone", () => {
      expect(isValidTimezone("Invalid/Zone")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
    });
  });

  describe("TODAY", () => {
    it("resolves to today in UTC", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.TODAY },
        NOW,
      );
      expect(result.start.toISOString()).toBe("2026-08-19T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-08-20T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.TODAY);
    });

    it("resolves to today in business timezone", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.TODAY, timezone: "Asia/Baku" },
        NOW,
      );
      // Asia/Baku is UTC+4, so at NOW (14:30 UTC) it's 18:30 Baku time on Aug 19
      // Today starts at midnight Baku = 20:00 UTC Aug 18
      expect(result.timezone).toBe("Asia/Baku");
      expect(result.preset).toBe(AnalyticsPeriodPreset.TODAY);
      // Verify it's a valid half-open interval
      expect(result.endExclusive.getTime()).toBeGreaterThan(result.start.getTime());
    });
  });

  describe("LAST_3_DAYS", () => {
    it("resolves to 3 calendar days including today", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.LAST_3_DAYS },
        NOW,
      );
      // Aug 17, 18, 19 (3 calendar days)
      expect(result.start.toISOString()).toBe("2026-08-17T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-08-20T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.LAST_3_DAYS);
    });
  });

  describe("LAST_7_DAYS", () => {
    it("resolves to 7 calendar days including today", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.LAST_7_DAYS },
        NOW,
      );
      // Aug 13, 14, 15, 16, 17, 18, 19 (7 calendar days)
      expect(result.start.toISOString()).toBe("2026-08-13T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-08-20T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.LAST_7_DAYS);
    });
  });

  describe("MONTH", () => {
    it("resolves to current calendar month", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.MONTH },
        NOW,
      );
      expect(result.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.MONTH);
    });
  });

  describe("LAST_6_MONTHS", () => {
    it("resolves to 6 complete calendar months before current month", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.LAST_6_MONTHS },
        NOW,
      );
      // Feb 1 through Jul 31 = 6 months (Feb, Mar, Apr, May, Jun, Jul)
      expect(result.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-08-01T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.LAST_6_MONTHS);
    });
  });

  describe("YEAR", () => {
    it("resolves to current calendar year", () => {
      const result = resolvePeriod(
        { preset: AnalyticsPeriodPreset.YEAR },
        NOW,
      );
      expect(result.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.YEAR);
    });
  });

  describe("CUSTOM", () => {
    it("resolves arbitrary date range", () => {
      const result = resolvePeriod(
        {
          preset: AnalyticsPeriodPreset.CUSTOM,
          startDate: "2026-03-15",
          endDate: "2026-06-27",
        },
        NOW,
      );
      expect(result.start.toISOString()).toBe("2026-03-15T00:00:00.000Z");
      // End exclusive = June 28 00:00
      expect(result.endExclusive.toISOString()).toBe("2026-06-28T00:00:00.000Z");
      expect(result.preset).toBe(AnalyticsPeriodPreset.CUSTOM);
    });

    it("resolves single-day custom range", () => {
      const result = resolvePeriod(
        {
          preset: AnalyticsPeriodPreset.CUSTOM,
          startDate: "2026-08-19",
          endDate: "2026-08-19",
        },
        NOW,
      );
      expect(result.start.toISOString()).toBe("2026-08-19T00:00:00.000Z");
      expect(result.endExclusive.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    });

    it("rejects CUSTOM without startDate", () => {
      expect(() =>
        resolvePeriod(
          { preset: AnalyticsPeriodPreset.CUSTOM, endDate: "2026-08-19" },
          NOW,
        ),
      ).toThrow();
    });

    it("rejects CUSTOM without endDate", () => {
      expect(() =>
        resolvePeriod(
          { preset: AnalyticsPeriodPreset.CUSTOM, startDate: "2026-08-19" },
          NOW,
        ),
      ).toThrow();
    });

    it("rejects startDate > endDate", () => {
      expect(() =>
        resolvePeriod(
          {
            preset: AnalyticsPeriodPreset.CUSTOM,
            startDate: "2026-08-20",
            endDate: "2026-08-19",
          },
          NOW,
        ),
      ).toThrow();
    });

    it("rejects invalid date format", () => {
      expect(() =>
        resolvePeriod(
          {
            preset: AnalyticsPeriodPreset.CUSTOM,
            startDate: "not-a-date",
            endDate: "2026-08-19",
          },
          NOW,
        ),
      ).toThrow();
    });
  });

  describe("half-open interval invariant", () => {
    it("start is always <= endExclusive", () => {
      const presets = [
        AnalyticsPeriodPreset.TODAY,
        AnalyticsPeriodPreset.LAST_3_DAYS,
        AnalyticsPeriodPreset.LAST_7_DAYS,
        AnalyticsPeriodPreset.MONTH,
        AnalyticsPeriodPreset.LAST_6_MONTHS,
        AnalyticsPeriodPreset.YEAR,
      ];
      for (const preset of presets) {
        const result = resolvePeriod({ preset }, NOW);
        expect(result.start.getTime()).toBeLessThan(result.endExclusive.getTime());
      }
    });

    it("adjacent periods do not overlap", () => {
      const today = resolvePeriod(
        { preset: AnalyticsPeriodPreset.TODAY },
        NOW,
      );
      // Yesterday would end at today.start
      const yesterday = resolvePeriod(
        {
          preset: AnalyticsPeriodPreset.CUSTOM,
          startDate: "2026-08-18",
          endDate: "2026-08-18",
        },
        NOW,
      );
      expect(yesterday.endExclusive.getTime()).toBe(today.start.getTime());
    });
  });

  describe("unknown preset", () => {
    it("throws for unknown preset", () => {
      expect(() =>
        resolvePeriod({ preset: "UNKNOWN" as AnalyticsPeriodPreset }, NOW),
      ).toThrow();
    });
  });

  describe("invalid timezone", () => {
    it("throws for invalid timezone", () => {
      expect(() =>
        resolvePeriod(
          { preset: AnalyticsPeriodPreset.TODAY, timezone: "Invalid/Zone" },
          NOW,
        ),
      ).toThrow();
    });
  });
});
