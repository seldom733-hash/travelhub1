import type { CommercialPeriodKind } from "../../generated/prisma/enums";

/**
 * PHASE 1 STEP 1.8C — Deterministic CommercialPeriod resolution (DD-026 §3.6).
 *
 * Precedence (canonical, Roadmap GATE RESOLVED):
 *
 *   DATE_OVERRIDE > явный PERIOD (уже диапазон выигрывает) >
 *   DAY_OF_WEEK-условие (внутри периода) > сезон/base PERIOD > FIXED base
 *
 * Deterministic specificity key (ascending = more specific):
 *   1. kind: DATE_OVERRIDE (0) < PERIOD (1);
 *   2. dayCount (endDate - startDate + 1): уже диапазон (меньше дней) выигрывает;
 *   3. hasDayOfWeek: true (0) < false (1) — период с условием специфичнее
 *      «голого» периода того же диапазона (Universal Pricing STRICT REVIEW);
 *   4. tie-break: createdAt asc, id asc (детерминизм; same-priority overlap
 *      НЕ допускается на write — 422, поэтому tie в проде не встречается).
 *
 * Чистая функция: НЕ делает запросов/записей. Вход — ACTIVE периоды одного
 * Tariff (сервер фильтрует status), выход — выигравший период или null
 * (null → base/FIXED Tariff.price fallback).
 */
export interface PeriodRow {
  id: string;
  code: string;
  kind: CommercialPeriodKind;
  startDate: Date;
  endDate: Date;
  dayOfWeek: number[];
  price: { toNumber(): number; toString(): string };
  sellable: boolean;
  createdAt: Date;
}

const DAY_MS = 86_400_000;

/** Количество календарных дней включительно (startDate <= endDate гарантирован). */
export function periodDayCount(startDate: Date, endDate: Date): number {
  return Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
}

function specificity(period: PeriodRow): number[] {
  const kindWeight = period.kind === "DATE_OVERRIDE" ? 0 : 1;
  const dayCount = periodDayCount(period.startDate, period.endDate);
  const hasDow = period.dayOfWeek.length > 0 ? 0 : 1;
  return [kindWeight, dayCount, hasDow, period.createdAt.getTime()];
}

/**
 * Applicable ACTIVE periods для сервисной даты:
 *  - startDate <= date <= endDate (date-only inclusive);
 *  - dayOfWeek условие (если не пусто): date.getUTCDay() in dayOfWeek.
 */
export function applicablePeriods(periods: PeriodRow[], serviceDate: Date): PeriodRow[] {
  const dow = serviceDate.getUTCDay();
  return periods.filter(
    (p) => p.startDate.getTime() <= serviceDate.getTime() && serviceDate.getTime() <= p.endDate.getTime() && (p.dayOfWeek.length === 0 || p.dayOfWeek.includes(dow)),
  );
}

/**
 * Детерминированный winner по DD-026 precedence. null → base fallback.
 * Сортировка стабильна: Date.getTime() и localeCompare дают полный порядок.
 */
export function resolveApplicablePeriod(periods: PeriodRow[], serviceDate: Date): PeriodRow | null {
  const applicable = applicablePeriods(periods, serviceDate);
  if (applicable.length === 0) return null;
  const sorted = [...applicable].sort((a, b) => {
    const ka = specificity(a);
    const kb = specificity(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

/** Same-priority overlap (для write-валидации): оба периода одного Tariff
 * пересекаются по датам И имеют идентичный (kind, dayCount, hasDayOfWeek) ключ —
 * недетерминированный выбор цен запрещён (422, DD-026 §3.6). */
export function samePriorityOverlap(a: PeriodRow, b: PeriodRow): boolean {
  const overlap = a.startDate.getTime() <= b.endDate.getTime() && b.startDate.getTime() <= a.endDate.getTime();
  if (!overlap) return false;
  if (a.kind !== b.kind) return false;
  if (periodDayCount(a.startDate, a.endDate) !== periodDayCount(b.startDate, b.endDate)) return false;
  if ((a.dayOfWeek.length > 0 ? 1 : 0) !== (b.dayOfWeek.length > 0 ? 1 : 0)) return false;
  return true;
}
