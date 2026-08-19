/**
 * Step 3.3 Analytics Foundation — Comparison Resolver Tests
 */

import { AnalyticsPeriodPreset, resolvePeriod } from "./analytics-period.resolver";
import { resolveComparison } from "./analytics-comparison.resolver";

describe("AnalyticsComparisonResolver", () => {
  const NOW = new Date("2026-08-19T14:30:00Z");

  describe("TODAY comparison", () => {
    it("comparison is yesterday", () => {
      const current = resolvePeriod(
        { preset: AnalyticsPeriodPreset.TODAY },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      expect(comparison.start.toISOString()).toBe("2026-08-18T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    });
  });

  describe("LAST_7_DAYS comparison", () => {
    it("comparison is preceding 7 calendar days", () => {
      const current = resolvePeriod(
        { preset: AnalyticsPeriodPreset.LAST_7_DAYS },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      // Aug 6–12 (7 days before Aug 13–19)
      expect(comparison.start.toISOString()).toBe("2026-08-06T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-08-13T00:00:00.000Z");
    });
  });

  describe("MONTH comparison", () => {
    it("comparison is previous calendar month", () => {
      const current = resolvePeriod(
        { preset: AnalyticsPeriodPreset.MONTH },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      expect(comparison.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    });
  });

  describe("YEAR comparison", () => {
    it("comparison is previous calendar year", () => {
      const current = resolvePeriod(
        { preset: AnalyticsPeriodPreset.YEAR },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      expect(comparison.start.toISOString()).toBe("2025-01-01T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("CUSTOM comparison", () => {
    it("comparison is preceding equivalent-duration interval", () => {
      const current = resolvePeriod(
        {
          preset: AnalyticsPeriodPreset.CUSTOM,
          startDate: "2026-04-15",
          endDate: "2026-05-14",
        },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      // 30 days before April 15 = March 16
      expect(comparison.start.toISOString()).toBe("2026-03-16T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-04-15T00:00:00.000Z");
    });

    it("comparison for single day is single day before", () => {
      const current = resolvePeriod(
        {
          preset: AnalyticsPeriodPreset.CUSTOM,
          startDate: "2026-08-19",
          endDate: "2026-08-19",
        },
        NOW,
      );
      const comparison = resolveComparison(current, NOW);
      expect(comparison.start.toISOString()).toBe("2026-08-18T00:00:00.000Z");
      expect(comparison.endExclusive.toISOString()).toBe("2026-08-19T00:00:00.000Z");
    });
  });

  describe("comparison period does not overlap current", () => {
    it("for all presets, comparison.endExclusive <= current.start", () => {
      const presets = [
        AnalyticsPeriodPreset.TODAY,
        AnalyticsPeriodPreset.LAST_3_DAYS,
        AnalyticsPeriodPreset.LAST_7_DAYS,
        AnalyticsPeriodPreset.MONTH,
        AnalyticsPeriodPreset.YEAR,
      ];
      for (const preset of presets) {
        const current = resolvePeriod({ preset }, NOW);
        const comparison = resolveComparison(current, NOW);
        expect(comparison.endExclusive.getTime()).toBeLessThanOrEqual(
          current.start.getTime(),
        );
      }
    });
  });
});
