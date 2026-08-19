/**
 * Step 3.3 Analytics Foundation — Granularity Resolver
 *
 * Auto-selects aggregation granularity based on period duration,
 * with optional explicit override.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3-time-actor-addendum.md
 */

import { AnalyticsPeriodPreset, type ResolvedPeriod } from "./analytics-period.resolver";

export enum AnalyticsGranularity {
  HOUR = "HOUR",
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  QUARTER = "QUARTER",
  YEAR = "YEAR",
}

/**
 * Auto-select granularity based on period duration.
 *
 * Rules:
 * - 1 day → HOUR
 * - 2–7 days → DAY
 * - 8–90 days → DAY
 * - 91–365 days → WEEK
 * - > 365 days → MONTH
 */
export function autoSelectGranularity(period: ResolvedPeriod): AnalyticsGranularity {
  const durationMs = period.endExclusive.getTime() - period.start.getTime();
  const durationDays = durationMs / (24 * 60 * 60 * 1000);

  if (durationDays <= 1) return AnalyticsGranularity.HOUR;
  if (durationDays <= 7) return AnalyticsGranularity.DAY;
  if (durationDays <= 90) return AnalyticsGranularity.DAY;
  if (durationDays <= 365) return AnalyticsGranularity.WEEK;
  return AnalyticsGranularity.MONTH;
}

/**
 * Resolve the final granularity, using auto-selection or explicit override.
 *
 * @param period - The resolved period
 * @param override - Optional explicit granularity
 * @returns The resolved granularity
 */
export function resolveGranularity(
  period: ResolvedPeriod,
  override?: AnalyticsGranularity,
): AnalyticsGranularity {
  if (override) {
    return override;
  }
  return autoSelectGranularity(period);
}

/**
 * Generate time buckets for the given period and granularity.
 * Each bucket is a half-open interval [start, endExclusive).
 */
export interface TimeBucket {
  start: Date;
  endExclusive: Date;
  label: string; // ISO-like label for the bucket
}

export function generateTimeBuckets(
  period: ResolvedPeriod,
  granularity: AnalyticsGranularity,
): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  let cursor = new Date(period.start.getTime());

  while (cursor.getTime() < period.endExclusive.getTime()) {
    const bucketEnd = advanceBucket(cursor, granularity, period.endExclusive);
    const label = formatBucketLabel(cursor, granularity);
    buckets.push({
      start: new Date(cursor.getTime()),
      endExclusive: new Date(bucketEnd.getTime()),
      label,
    });
    cursor = bucketEnd;
  }

  return buckets;
}

function advanceBucket(
  start: Date,
  granularity: AnalyticsGranularity,
  periodEnd: Date,
): Date {
  const end = new Date(start.getTime());

  switch (granularity) {
    case AnalyticsGranularity.HOUR:
      end.setUTCHours(end.getUTCHours() + 1);
      break;
    case AnalyticsGranularity.DAY:
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case AnalyticsGranularity.WEEK:
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    case AnalyticsGranularity.MONTH:
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
    case AnalyticsGranularity.QUARTER:
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
    case AnalyticsGranularity.YEAR:
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
  }

  // Clamp to period end
  if (end.getTime() > periodEnd.getTime()) {
    return new Date(periodEnd.getTime());
  }
  return end;
}

function formatBucketLabel(start: Date, granularity: AnalyticsGranularity): string {
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  const d = String(start.getUTCDate()).padStart(2, "0");
  const h = String(start.getUTCHours()).padStart(2, "0");

  switch (granularity) {
    case AnalyticsGranularity.HOUR:
      return `${y}-${m}-${d}T${h}:00Z`;
    case AnalyticsGranularity.DAY:
      return `${y}-${m}-${d}`;
    case AnalyticsGranularity.WEEK:
      return `${y}-W${String(getISOWeek(start)).padStart(2, "0")}`;
    case AnalyticsGranularity.MONTH:
      return `${y}-${m}`;
    case AnalyticsGranularity.QUARTER: {
      const q = Math.floor(start.getUTCMonth() / 3) + 1;
      return `${y}-Q${q}`;
    }
    case AnalyticsGranularity.YEAR:
      return `${y}`;
    default:
      return `${y}-${m}-${d}`;
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
