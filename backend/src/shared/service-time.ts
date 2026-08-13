/**
 * PHASE 2 STEP 2.8A — canonical service occurrence time model (PURE, unit-testable).
 *
 * Семантика (Roadmap 2.8A, §6-§9/§13/§37):
 *  - serviceDate      — local calendar date (date-only UTC-midnight storage);
 *  - serviceTime      — local wall-clock "HH:mm" (optional; TIME_SLOT only);
 *  - serviceEndTime   — local wall-clock end "HH:mm" (optional, только с serviceTime);
 *  - serviceTimeZone  — authoritative IANA zone (frozen из Catalog при binding);
 *  - serviceStartsAt/EndsAt — derived UTC instants (persisted только на Booking).
 *
 * Authority (§8): IANA IDs валидируются через Intl.supportedValuesOf("timeZone")
 * (Node ≥ 18.12, full-icu) — НЕ выдумываются, НЕ берутся из browser/locale/IP.
 * Conversion local → UTC через Intl.DateTimeFormat (timeZoneName: "longOffset") —
 * БЕЗ ручной offset-арифметики (§9).
 *
 * DST-правила (детерминированные, задокументированные, протестированы):
 *  - нормальный день — единственный валидный instant;
 *  - ambiguous (fall-back, локальное время встречается дважды) → РАННИЙ instant
 *    (первое наступление, pre-transition offset);
 *  - nonexistent (spring-forward gap, время пропущено) → instant сразу ПОСЛЕ
 *    разрыва: wall time интерпретируется в пост-переходном offset + сдвиг на gap
 *    (02:30 в разрыве 02:00→03:00 → 03:30).
 *
 * Date-only услуга: UTC instant НЕ фабрикуется как 00:00 (§7) — функции
 * деривации возвращают null при отсутствии времени/зоны.
 */

import { ValidationDomainError } from "./errors";
import { isDateOnly } from "./date-only";

export type ServiceTimeType = "DATE_ONLY" | "TIME_SLOT" | "DATE_RANGE" | "OPEN_DATE";

const LOCAL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Local wall-clock "HH:mm" (00:00–23:59). Не accepts "24:00". */
export function isLocalTime(value: string): boolean {
  return typeof value === "string" && LOCAL_TIME_RE.test(value);
}

/** Канонический IANA timezone ID (Intl — standards-compliant, no hand-written list). */
let ianaZoneSet: Set<string> | null = null;
export function isIanaTimeZone(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  ianaZoneSet ??= new Set(Intl.supportedValuesOf("timeZone"));
  return ianaZoneSet.has(value);
}

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = offsetFormatterCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "longOffset",
    });
    offsetFormatterCache.set(zone, f);
  }
  return f;
}

/** UTC offset (minutes) зоны в заданный UTC instant — через Intl (не арифметика). */
export function offsetMinutesAt(zone: string, instantMs: number): number {
  const tz = formatterFor(zone)
    .formatToParts(new Date(instantMs))
    .find((p) => p.type === "timeZoneName")?.value;
  // 1-2 цифры часа — ICU-варианты могут выдавать "GMT+4:00"; канон Node — "+04:00".
  const m = /([+-])(\d{1,2}):(\d{2})/.exec(tz ?? "");
  if (!m) return 0; // "GMT"/"UTC" → 0 (robustness; IANA zones дают +/-HH:mm)
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Local wall-clock (date + HH:mm) → UTC instant в зоне. Детерминированно,
 * через Intl-оффсеты. Бросает ValidationDomainError на невалидные входы.
 *
 * Алгоритм: кандидаты строятся для offset'ов вокруг wall-времени (±12ч —
 * перехватывает любой DST-переход у этого времени). Валидный кандидат — тот,
 * чей offset в получившемся instant совпадает с использованным.
 */
export function localToUtc(dateOnly: string, time: string, zone: string): Date {
  if (!isDateOnly(dateOnly)) throw new ValidationDomainError("serviceDate must be a calendar date (YYYY-MM-DD)");
  if (!isLocalTime(time)) throw new ValidationDomainError("serviceTime must be local wall-clock HH:mm");
  if (!isIanaTimeZone(zone)) throw new ValidationDomainError(`serviceTimeZone ${zone} is not a valid IANA timezone`);

  const [y, mo, d] = dateOnly.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, min);

  const offsets = new Set([offsetMinutesAt(zone, wall - 12 * 3_600_000), offsetMinutesAt(zone, wall + 12 * 3_600_000)]);
  const candidates: number[] = [];
  for (const off of offsets) {
    const inst = wall - off * 60_000;
    if (offsetMinutesAt(zone, inst) === off) candidates.push(inst);
  }

  if (candidates.length === 1) return new Date(candidates[0]);
  if (candidates.length === 2) {
    // ambiguous (fall-back): детерминированный выбор — РАННИЙ instant.
    return new Date(Math.min(candidates[0], candidates[1]));
  }
  // nonexistent (spring-forward gap): instant сразу после разрыва —
  // wall time в пост-переходном offset + сдвиг на величину gap.
  const [offA, offB] = [...offsets];
  const gap = Math.abs(offA - offB);
  const postOffset = Math.max(offA, offB);
  return new Date(wall - postOffset * 60_000 + gap * 60_000);
}

/**
 * Derived UTC start instant (TIME_SLOT): serviceDate + serviceTime в
 * serviceTimeZone. Date-only (нет времени/зоны) → null — 00:00 НЕ фабрикуется (§7).
 * serviceTime без зоны → ValidationDomainError (defensive: canonical chain
 * гарантирует zone вместе с time на Checkout; mismatch = дефект ленты → FAILED).
 */
export function deriveServiceStartsAt(
  serviceDate: Date | null,
  serviceTime: string | null,
  serviceTimeZone: string | null,
): Date | null {
  if (!serviceDate || !serviceTime) return null;
  if (!serviceTimeZone) {
    throw new ValidationDomainError("serviceTime requires serviceTimeZone (canonical timezone authority)");
  }
  const dateOnly = serviceDate.toISOString().slice(0, 10);
  return localToUtc(dateOnly, serviceTime, serviceTimeZone);
}

/**
 * Derived UTC end instant (TIME_SLOT с serviceEndTime): end wall-time на дате
 * старта, а если end <= start — на следующем local календарном дне (cross-midnight).
 * Без endTime / date-only → null.
 */
export function deriveServiceEndsAt(
  serviceDate: Date | null,
  serviceTime: string | null,
  serviceEndTime: string | null,
  serviceTimeZone: string | null,
): Date | null {
  if (!serviceDate || !serviceTime || !serviceEndTime) return null;
  if (!serviceTimeZone) {
    throw new ValidationDomainError("serviceTime requires serviceTimeZone (canonical timezone authority)");
  }
  const startDateOnly = serviceDate.toISOString().slice(0, 10);
  const start = localToUtc(startDateOnly, serviceTime, serviceTimeZone);
  const endSameDay = localToUtc(startDateOnly, serviceEndTime, serviceTimeZone);
  if (endSameDay.getTime() > start.getTime()) return endSameDay;
  // cross-midnight: следующий local календарный день (дата берётся по UTC-midnight
  // представлению serviceDate +1 сутки — same date-only convention, без DST-гадания).
  const [y, m, d] = startDateOnly.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return localToUtc(next.toISOString().slice(0, 10), serviceEndTime, serviceTimeZone);
}

/**
 * Канонический тип occurrence (§6, Roadmap): OPEN_DATE (дата неизвестна) >
 * TIME_SLOT (дата + точное local время) > DATE_ONLY. DATE_RANGE НЕ продуцируется
 * текущим flow (требует canonical duration/end-авторитета §14) — зарезервирован.
 */
export function deriveServiceTimeType(serviceDate: Date | null, serviceTime: string | null): ServiceTimeType {
  if (!serviceDate) return "OPEN_DATE";
  if (serviceTime) return "TIME_SLOT";
  return "DATE_ONLY";
}
