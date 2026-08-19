/**
 * Step 3.3 Analytics Foundation — Comparison Resolver
 *
 * Derives comparison periods for analytics metrics.
 * Calendar presets → preceding calendar period.
 * Custom → preceding equivalent-duration interval.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3-time-actor-addendum.md
 */

import { AnalyticsPeriodPreset, type ResolvedPeriod } from "./analytics-period.resolver";

export interface ComparisonPeriods {
  current: ResolvedPeriod;
  comparison: ResolvedPeriod;
}

/**
 * Derive a comparison period for the given resolved period.
 *
 * @param current - The resolved current period
 * @param now - Reference instant (for testability)
 * @returns The comparison period (preceding equivalent interval)
 */
export function resolveComparison(
  current: ResolvedPeriod,
  now: Date = new Date(),
): ResolvedPeriod {
  const { timezone: tz, preset } = current;
  const duration = current.endExclusive.getTime() - current.start.getTime();

  switch (preset) {
    case AnalyticsPeriodPreset.TODAY:
      // Yesterday = same-day-minus-1 calendar day
      return makeComparisonFromStart(
        addDaysToStart(current.start, -1),
        tz,
        preset,
      );

    case AnalyticsPeriodPreset.LAST_3_DAYS:
    case AnalyticsPeriodPreset.LAST_7_DAYS: {
      // Preceding N calendar days
      return makeComparisonFromStart(
        addDaysToStart(current.start, -duration / (24 * 60 * 60 * 1000)),
        tz,
        preset,
      );
    }

    case AnalyticsPeriodPreset.MONTH: {
      // Previous calendar month
      const compStart = subtractCalendarMonth(current.start, tz);
      return makeComparisonFromStart(compStart, tz, preset);
    }

    case AnalyticsPeriodPreset.LAST_6_MONTHS: {
      // Preceding 6 calendar months
      const compStart = subtractCalendarMonths(current.start, 6, tz);
      return makeComparisonFromStart(compStart, tz, preset);
    }

    case AnalyticsPeriodPreset.YEAR: {
      // Previous calendar year
      const compStart = subtractCalendarYear(current.start, tz);
      return makeComparisonFromStart(compStart, tz, preset);
    }

    case AnalyticsPeriodPreset.CUSTOM: {
      // Immediately preceding equivalent-duration interval
      const compEnd = new Date(current.start.getTime());
      const compStart = new Date(compEnd.getTime() - duration);
      return {
        start: compStart,
        endExclusive: compEnd,
        timezone: tz,
        preset: AnalyticsPeriodPreset.CUSTOM,
      };
    }

    default:
      throw new Error(`Unknown preset for comparison: ${preset}`);
  }
}

/**
 * Build a comparison period from a start instant, computing endExclusive
 * based on the preset type.
 */
function makeComparisonFromStart(
  start: Date,
  tz: string,
  preset: AnalyticsPeriodPreset,
): ResolvedPeriod {
  const { year, month, day } = getTzDateParts(start, tz);

  switch (preset) {
    case AnalyticsPeriodPreset.TODAY: {
      // Single day comparison
      const endExclusive = addDaysToStart(start, 1);
      return { start, endExclusive, timezone: tz, preset };
    }

    case AnalyticsPeriodPreset.LAST_3_DAYS: {
      const endExclusive = addDaysToStart(start, 3);
      return { start, endExclusive, timezone: tz, preset };
    }

    case AnalyticsPeriodPreset.LAST_7_DAYS: {
      const endExclusive = addDaysToStart(start, 7);
      return { start, endExclusive, timezone: tz, preset };
    }

    case AnalyticsPeriodPreset.MONTH: {
      // Previous calendar month
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endExclusive = getBusinessDayStart(nextYear, nextMonth, 1, tz);
      return { start, endExclusive, timezone: tz, preset };
    }

    case AnalyticsPeriodPreset.LAST_6_MONTHS: {
      // 6 calendar months from start
      const endStart = addCalendarMonths(start, 6, tz);
      return { start, endExclusive: endStart, timezone: tz, preset };
    }

    case AnalyticsPeriodPreset.YEAR: {
      // Calendar year
      const endExclusive = getBusinessDayStart(year + 1, 1, 1, tz);
      return { start, endExclusive, timezone: tz, preset };
    }

    default: {
      throw new Error(`Cannot derive comparison end for preset: ${preset}`);
    }
  }
}

function addDaysToStart(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function subtractCalendarMonth(date: Date, tz: string): Date {
  const { year, month } = getTzDateParts(date, tz);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return getBusinessDayStart(prevYear, prevMonth, 1, tz);
}

function subtractCalendarMonths(date: Date, n: number, tz: string): Date {
  const { year, month } = getTzDateParts(date, tz);
  const totalMonths = year * 12 + (month - 1) - n;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return getBusinessDayStart(targetYear, targetMonth, 1, tz);
}

function addCalendarMonths(date: Date, n: number, tz: string): Date {
  const { year, month } = getTzDateParts(date, tz);
  const totalMonths = year * 12 + (month - 1) + n;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return getBusinessDayStart(targetYear, targetMonth, 1, tz);
}

function subtractCalendarYear(date: Date, tz: string): Date {
  const { year, month, day } = getTzDateParts(date, tz);
  return getBusinessDayStart(year - 1, month, day, tz);
}

function getBusinessDayStart(
  year: number,
  month: number,
  day: number,
  tz: string,
): Date {
  if (tz === "UTC") {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const midnightGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const midnightParts = formatter.formatToParts(new Date(midnightGuess));
  const get = (type: string) =>
    parseInt(midnightParts.find((p) => p.type === type)!.value, 10);

  const midnightTzAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offsetMs = midnightTzAsUTC - midnightGuess;
  return new Date(midnightGuess - offsetMs);
}

function getTzDateParts(
  date: Date,
  tz: string,
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value, 10),
    month: parseInt(parts.find((p) => p.type === "month")!.value, 10),
    day: parseInt(parts.find((p) => p.type === "day")!.value, 10),
  };
}
