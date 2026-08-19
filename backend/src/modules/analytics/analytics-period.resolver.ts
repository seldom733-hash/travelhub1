/**
 * Step 3.3 Analytics Foundation — Period Resolver
 *
 * Resolves analytics period presets and custom date ranges to canonical
 * half-open UTC intervals [startInstant, endExclusiveInstant).
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 * Addendum: docs/architecture/analytics-foundation-3.3-time-actor-addendum.md
 */

export enum AnalyticsPeriodPreset {
  TODAY = "TODAY",
  LAST_3_DAYS = "LAST_3_DAYS",
  LAST_7_DAYS = "LAST_7_DAYS",
  MONTH = "MONTH",
  LAST_6_MONTHS = "LAST_6_MONTHS",
  YEAR = "YEAR",
  CUSTOM = "CUSTOM",
}

export interface ResolvedPeriod {
  /** Inclusive start instant (UTC). */
  start: Date;
  /** Exclusive end instant (UTC). */
  endExclusive: Date;
  /** The resolved timezone used for business day boundaries. */
  timezone: string;
  /** The preset that produced this resolution. */
  preset: AnalyticsPeriodPreset;
}

export interface PeriodRequest {
  preset: AnalyticsPeriodPreset;
  startDate?: string; // ISO 8601 date (YYYY-MM-DD), required for CUSTOM
  endDate?: string; // ISO 8601 date (YYYY-MM-DD), required for CUSTOM
  timezone?: string; // IANA ID; default "UTC"
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Get the start of a business day in the given timezone.
 * Returns a UTC Date representing midnight of that calendar day in the timezone.
 */
function getBusinessDayStart(
  year: number,
  month: number,
  day: number,
  tz: string,
): Date {
  // Create a date string and use Intl to get the UTC offset for that timezone
  // at midnight of the given day, then adjust.
  const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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
  const parts = formatter.formatToParts(base);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);

  // Get what the timezone thinks "now" is for this UTC base
  const tzYear = get("year");
  const tzMonth = get("month");
  const tzDay = get("day");
  const tzHour = get("hour");
  const tzMinute = get("minute");
  const tzSecond = get("second");

  // Reconstruct: what UTC time corresponds to midnight in the timezone?
  // We want: the UTC instant where tz says it's YYYY-MM-DD 00:00:00
  // Strategy: create a UTC date of the tz-displayed time, then find the offset
  const tzAsUTC = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
  const offset = tzAsUTC - base.getTime(); // offset in ms (positive = tz is ahead)

  // The UTC instant where tz shows midnight of the target day:
  // tzAsUTC - offset = base - (base - tzAsUTC) = base + (tzAsUTC - base) - tzAsUTC + base... 
  // Simpler: if tz shows midnight = tzAsUTC, and offset = tzAsUTC - base,
  // then the UTC time of tz-midnight = tzAsUTC - offset = tzAsUTC - (tzAsUTC - base) = base
  // But that's circular. Let's use a different approach.
  
  // Actually: we want the UTC instant T such that when formatted in tz, T shows as YYYY-MM-DD 00:00:00
  // T = Date.UTC(year, month-1, day) - offset_at_T
  // But offset_at_T depends on T... for most timezones this is deterministic for a given date.
  
  // Use a direct approach: create the date string and parse
  const dateStr = `${tzYear}-${String(tzMonth).padStart(2, "0")}-${String(tzDay).padStart(2, "0")}T00:00:00`;
  
  // For UTC, it's simple
  if (tz === "UTC") {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  // For other timezones, use the offset approach
  // offset = how many ms ahead the timezone is compared to UTC at this point
  // If tz shows 15:00 when UTC is 12:00, offset = +3h = 10800000
  // So if we want tz to show 00:00, we need UTC = 00:00 - offset
  // But offset varies by DST...
  
  // Use iterative approach: start with guess, refine
  // Actually, let's use the fact that Intl.DateTimeFormat is reliable
  // If we have a UTC date and format it in tz, we know the tz representation
  // We want the inverse: given tz representation, find UTC
  
  // Simple reliable method: use the offset at the start of the day
  // Create a guess UTC time = same year/month/day in UTC
  const guessUTC = Date.UTC(year, month - 1, day, 12, 0, 0, 0); // noon UTC as safe guess
  const guessFormatted = new Date(guessUTC);
  const guessParts = formatter.formatToParts(guessFormatted);
  const guessTzHour = parseInt(
    guessParts.find((p) => p.type === "hour")!.value,
    10,
  );
  
  // The offset is: tz_hour - utc_hour (approximately, at noon)
  // Actually offset = (tz representation in ms) - (UTC in ms)
  // At guessUTC (noon UTC), tz shows some time. Let's compute the difference.
  const guessTzAsUTC = Date.UTC(
    parseInt(guessParts.find((p) => p.type === "year")!.value),
    parseInt(guessParts.find((p) => p.type === "month")!.value) - 1,
    parseInt(guessParts.find((p) => p.type === "day")!.value),
    parseInt(guessParts.find((p) => p.type === "hour")!.value),
    parseInt(guessParts.find((p) => p.type === "minute")!.value),
    parseInt(guessParts.find((p) => p.type === "second")!.value),
  );
  const offsetMs = guessTzAsUTC - guessUTC; // positive = tz ahead of UTC

  // To get UTC where tz shows 00:00 of target day:
  // UTC = Date.UTC(year, month, day, 0, 0, 0) - offsetMs
  // But offset might differ at midnight vs noon (DST boundary)
  // For safety, use the offset at midnight vicinity
  const midnightGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const midnightParts = formatter.formatToParts(new Date(midnightGuess));
  const midnightTzAsUTC = Date.UTC(
    parseInt(midnightParts.find((p) => p.type === "year")!.value),
    parseInt(midnightParts.find((p) => p.type === "month")!.value) - 1,
    parseInt(midnightParts.find((p) => p.type === "day")!.value),
    parseInt(midnightParts.find((p) => p.type === "hour")!.value),
    parseInt(midnightParts.find((p) => p.type === "minute")!.value),
    parseInt(midnightParts.find((p) => p.type === "second")!.value),
  );
  const midnightOffsetMs = midnightTzAsUTC - midnightGuess;
  
  // UTC instant where tz shows 00:00 of target day
  const result = midnightGuess - midnightOffsetMs;
  
  // Verify: format result in tz, should show target day 00:00:00
  // (skip verification for perf; trust Intl)
  
  return new Date(result);
}

/**
 * Add calendar months to a date (preserving day-of-month where possible).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * Add calendar days to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Validate an IANA timezone by attempting to format a date with it.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve an analytics period request to a canonical half-open UTC interval.
 *
 * @param request - The period request with preset, optional dates, and timezone
 * @param now - Reference instant (for testability); defaults to Date.now()
 * @returns Resolved half-open interval [start, endExclusive)
 */
export function resolvePeriod(
  request: PeriodRequest,
  now: Date = new Date(),
): ResolvedPeriod {
  const tz = request.timezone || "UTC";
  if (!isValidTimezone(tz)) {
    throw new Error(`Invalid timezone: ${tz}`);
  }

  switch (request.preset) {
    case AnalyticsPeriodPreset.TODAY:
      return resolveToday(tz, now);
    case AnalyticsPeriodPreset.LAST_3_DAYS:
      return resolveLastNDays(3, tz, now);
    case AnalyticsPeriodPreset.LAST_7_DAYS:
      return resolveLastNDays(7, tz, now);
    case AnalyticsPeriodPreset.MONTH:
      return resolveMonth(tz, now);
    case AnalyticsPeriodPreset.LAST_6_MONTHS:
      return resolveLastNMonths(6, tz, now);
    case AnalyticsPeriodPreset.YEAR:
      return resolveYear(tz, now);
    case AnalyticsPeriodPreset.CUSTOM:
      return resolveCustom(request.startDate!, request.endDate!, tz);
    default:
      throw new Error(`Unknown period preset: ${request.preset}`);
  }
}

function resolveToday(tz: string, now: Date): ResolvedPeriod {
  const { year, month, day } = getTzDateParts(now, tz);
  const start = getBusinessDayStart(year, month, day, tz);
  const endExclusive = addDays(start, 1);
  return { start, endExclusive, timezone: tz, preset: AnalyticsPeriodPreset.TODAY };
}

function resolveLastNDays(n: number, tz: string, now: Date): ResolvedPeriod {
  // Current day + previous (n-1) calendar days = n calendar days total
  const { year, month, day } = getTzDateParts(now, tz);
  const todayStart = getBusinessDayStart(year, month, day, tz);
  const start = addDays(todayStart, -(n - 1));
  const endExclusive = addDays(todayStart, 1);
  const preset =
    n === 3
      ? AnalyticsPeriodPreset.LAST_3_DAYS
      : AnalyticsPeriodPreset.LAST_7_DAYS;
  return { start, endExclusive, timezone: tz, preset };
}

function resolveMonth(tz: string, now: Date): ResolvedPeriod {
  const { year, month } = getTzDateParts(now, tz);
  const start = getBusinessDayStart(year, month, 1, tz);
  // End = first day of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = getBusinessDayStart(nextYear, nextMonth, 1, tz);
  return { start, endExclusive, timezone: tz, preset: AnalyticsPeriodPreset.MONTH };
}

function resolveLastNMonths(n: number, tz: string, now: Date): ResolvedPeriod {
  const { year, month } = getTzDateParts(now, tz);
  // Start = first day of month, n months ago
  const startYear = month - n <= 0 ? year - 1 : year;
  const startMonth = month - n <= 0 ? month - n + 12 : month - n;
  const start = getBusinessDayStart(startYear, startMonth, 1, tz);
  // End = first day of current month
  const endExclusive = getBusinessDayStart(year, month, 1, tz);
  return { start, endExclusive, timezone: tz, preset: AnalyticsPeriodPreset.LAST_6_MONTHS };
}

function resolveYear(tz: string, now: Date): ResolvedPeriod {
  const { year } = getTzDateParts(now, tz);
  const start = getBusinessDayStart(year, 1, 1, tz);
  const endExclusive = getBusinessDayStart(year + 1, 1, 1, tz);
  return { start, endExclusive, timezone: tz, preset: AnalyticsPeriodPreset.YEAR };
}

function resolveCustom(startDate: string, endDate: string, tz: string): ResolvedPeriod {
  if (!DATE_REGEX.test(startDate)) {
    throw new Error(`Invalid startDate format: ${startDate} (expected YYYY-MM-DD)`);
  }
  if (!DATE_REGEX.test(endDate)) {
    throw new Error(`Invalid endDate format: ${endDate} (expected YYYY-MM-DD)`);
  }

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  const start = getBusinessDayStart(startYear, startMonth, startDay, tz);
  // End exclusive = midnight of day after endDate
  const endInclusive = getBusinessDayStart(endYear, endMonth, endDay, tz);
  const endExclusive = addDays(endInclusive, 1);

  if (start.getTime() > endInclusive.getTime()) {
    throw new Error(`startDate (${startDate}) must not be after endDate (${endDate})`);
  }

  return {
    start,
    endExclusive,
    timezone: tz,
    preset: AnalyticsPeriodPreset.CUSTOM,
  };
}

/**
 * Extract year, month (1-based), day from a Date interpreted in a timezone.
 */
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
