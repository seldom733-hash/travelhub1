/**
 * Step 3.3 Analytics Foundation — Granularity Resolver Tests
 */

import {
  AnalyticsGranularity,
  autoSelectGranularity,
  resolveGranularity,
  generateTimeBuckets,
} from "./analytics-granularity.resolver";
import { AnalyticsPeriodPreset, type ResolvedPeriod } from "./analytics-period.resolver";

describe("AnalyticsGranularityResolver", () => {
  const NOW = new Date("2026-08-19T14:30:00Z");

  function makePeriod(start: string, end: string): ResolvedPeriod {
    return {
      start: new Date(start),
      endExclusive: new Date(end),
      timezone: "UTC",
      preset: AnalyticsPeriodPreset.CUSTOM,
    };
  }

  describe("autoSelectGranularity", () => {
    it("selects HOUR for 1-day period", () => {
      const period = makePeriod("2026-08-19T00:00:00Z", "2026-08-20T00:00:00Z");
      expect(autoSelectGranularity(period)).toBe(AnalyticsGranularity.HOUR);
    });

    it("selects DAY for 7-day period", () => {
      const period = makePeriod("2026-08-13T00:00:00Z", "2026-08-20T00:00:00Z");
      expect(autoSelectGranularity(period)).toBe(AnalyticsGranularity.DAY);
    });

    it("selects DAY for 90-day period", () => {
      const period = makePeriod("2026-05-21T00:00:00Z", "2026-08-19T00:00:00Z");
      expect(autoSelectGranularity(period)).toBe(AnalyticsGranularity.DAY);
    });

    it("selects WEEK for 180-day period", () => {
      const period = makePeriod("2026-02-19T00:00:00Z", "2026-08-19T00:00:00Z");
      expect(autoSelectGranularity(period)).toBe(AnalyticsGranularity.WEEK);
    });

    it("selects MONTH for 400-day period", () => {
      const period = makePeriod("2025-07-15T00:00:00Z", "2026-08-19T00:00:00Z");
      expect(autoSelectGranularity(period)).toBe(AnalyticsGranularity.MONTH);
    });
  });

  describe("resolveGranularity", () => {
    it("uses auto-selection when no override", () => {
      const period = makePeriod("2026-08-19T00:00:00Z", "2026-08-20T00:00:00Z");
      expect(resolveGranularity(period)).toBe(AnalyticsGranularity.HOUR);
    });

    it("uses override when provided", () => {
      const period = makePeriod("2026-08-19T00:00:00Z", "2026-08-20T00:00:00Z");
      expect(resolveGranularity(period, AnalyticsGranularity.DAY)).toBe(
        AnalyticsGranularity.DAY,
      );
    });
  });

  describe("generateTimeBuckets", () => {
    it("generates hourly buckets for 1-day period", () => {
      const period = makePeriod("2026-08-19T00:00:00Z", "2026-08-19T03:00:00Z");
      const buckets = generateTimeBuckets(period, AnalyticsGranularity.HOUR);
      expect(buckets).toHaveLength(3);
      expect(buckets[0].label).toBe("2026-08-19T00:00Z");
      expect(buckets[1].label).toBe("2026-08-19T01:00Z");
      expect(buckets[2].label).toBe("2026-08-19T02:00Z");
    });

    it("generates daily buckets for 5-day period", () => {
      const period = makePeriod("2026-08-17T00:00:00Z", "2026-08-20T00:00:00Z");
      const buckets = generateTimeBuckets(period, AnalyticsGranularity.DAY);
      expect(buckets).toHaveLength(3);
      expect(buckets[0].label).toBe("2026-08-17");
      expect(buckets[1].label).toBe("2026-08-18");
      expect(buckets[2].label).toBe("2026-08-19");
    });

    it("generates monthly buckets for 6-month period", () => {
      const period = makePeriod("2026-02-01T00:00:00Z", "2026-08-01T00:00:00Z");
      const buckets = generateTimeBuckets(period, AnalyticsGranularity.MONTH);
      expect(buckets).toHaveLength(6);
      expect(buckets[0].label).toBe("2026-02");
      expect(buckets[5].label).toBe("2026-07");
    });

    it("buckets cover the full period without gaps", () => {
      const period = makePeriod("2026-08-17T00:00:00Z", "2026-08-20T00:00:00Z");
      const buckets = generateTimeBuckets(period, AnalyticsGranularity.DAY);
      expect(buckets[0].start.toISOString()).toBe("2026-08-17T00:00:00.000Z");
      expect(buckets[buckets.length - 1].endExclusive.toISOString()).toBe(
        "2026-08-20T00:00:00.000Z",
      );
    });
  });
});
