/**
 * PHASE 1 STEP 1.8D — Deterministic commercial restriction evaluation (Catalog
 * owner; DD-026/DD-028; Universal Pricing §30).
 *
 * Один canonical resolver/evaluator для sellability: цена (1.8C) + ограничения
 * (1.8D) НЕ могут разойтись — restriction evaluation получает resolved period
 * (победителя 1.8C) и «едет» на нём.
 *
 * Три роли (НЕ три authority):
 *   1. DATE-scope CommercialRestriction — точная сервисная дата (tier 1);
 *   2. PERIOD-scope CommercialRestriction — привязана к resolved period
 *      (tier 2; специфичность наследуется от периода 1.8C, своя НЕ вводится);
 *   3. BASE — Tariff.restrictions (1.8B whitelist-валидированные факты, tier 3).
 *
 * Precedence: DATE > PERIOD-attached > BASE. createdAt/порядок строк НЕ
 * precedence (same-priority contradiction запрещена на write — 422, как 1.8C).
 *
 * Fail-closed правила (runtime ambiguity → детерминированный блок, не угадывание):
 *  - minStay > 1 без durationDays → blocked (min_stay_requires_duration);
 *  - CTD активен (base/period/date) без durationDays → blocked
 *    (closed_to_departure_requires_duration — departure-дата неизвестна);
 *  - serviceDate в прошлом → blocked (past_date; sales-путь дополнительно
 *    guard-ит в parseServiceDate).
 *
 * Чистая функция: НЕ делает запросов/записей. Caller фильтрует ACTIVE rows и
 * передаёт resolved period победителя (или null → base pricing).
 */
export type RestrictionScope = "PERIOD" | "DATE";
export type RestrictionType =
  | "STOP_SELL"
  | "MIN_STAY"
  | "ADVANCE_BOOKING"
  | "CLOSED_TO_ARRIVAL"
  | "CLOSED_TO_DEPARTURE";

export interface RestrictionRow {
  id: string;
  code: string;
  scope: RestrictionScope;
  commercialPeriodId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  type: RestrictionType;
  value: number | null;
}

export interface RestrictionBaseFacts {
  minStay?: number | null;
  maxStay?: number | null;
  advanceBookingDays?: number | null;
  closedToArrival?: boolean | null;
  closedToDeparture?: boolean | null;
}

export interface ResolvedPeriodContext {
  id: string;
  code: string;
  kind: string;
  startDate: Date;
  endDate: Date;
  sellable: boolean;
}

export interface RestrictionEvaluationInput {
  /** Сервисная дата (date-only UTC midnight). */
  serviceDate: Date;
  /** Запрошенная длительность в service-days (1..365); null = не задана. */
  durationDays?: number | null;
  /** Base факты из Tariff.restrictions (1.8B whitelist). */
  base: RestrictionBaseFacts;
  /** Победитель 1.8C (или null → base pricing). */
  resolvedPeriod: ResolvedPeriodContext | null;
  /** ACTIVE restriction rows Tariff (caller фильтрует status). */
  rows: RestrictionRow[];
  /** Инъектируемый «сегодня» (UTC date-only) для тестов; default — now. */
  today?: Date;
}

export interface AppliedRestriction {
  type: RestrictionType | "PERIOD_STOP_SELL";
  value: number | null;
  source: "DATE" | "PERIOD" | "BASE";
  code: string | null;
}

export interface RestrictionEvaluation {
  sellable: boolean;
  /** Детерминированный первый reason блокировки (null — sellable). */
  blockedReason: string | null;
  /** Провенанс применённых фактов (для snapshot/audit). */
  applied: AppliedRestriction[];
  /** Эффективные значения после tier-resolution (BASE/PERIOD/DATE). */
  minStay: number | null;
  maxStay: number | null;
  advanceBookingDays: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

const DAY_MS = 86_400_000;

function dateOnly(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function sameDate(a: Date | null, b: Date): boolean {
  return a !== null && dateOnly(a) === dateOnly(b);
}

function inRange(a: Date | null, b: Date | null, d: Date): boolean {
  if (!a || !b) return false;
  const t = dateOnly(d);
  return dateOnly(a) <= t && t <= dateOnly(b);
}

/** DATE-scope row применим к сервисной дате (дата-точная). */
function dateApplies(row: RestrictionRow, d: Date): boolean {
  return row.scope === "DATE" && sameDate(row.startDate, d);
}

/** PERIOD-scope row привязана к resolved period. */
function periodApplies(row: RestrictionRow, period: ResolvedPeriodContext | null): boolean {
  return row.scope === "PERIOD" && period !== null && row.commercialPeriodId === period.id;
}

/**
 * Выбор effective-факта: DATE > PERIOD > BASE. Возвращает {value, source, code}
 * (source BASE → code null).
 */
function effective<T>(
  dateVal: { value: T; code: string } | null,
  periodVal: { value: T; code: string } | null,
  baseVal: T,
): { value: T; source: "DATE" | "PERIOD" | "BASE"; code: string | null } {
  if (dateVal) return { value: dateVal.value, source: "DATE", code: dateVal.code };
  if (periodVal) return { value: periodVal.value, source: "PERIOD", code: periodVal.code };
  return { value: baseVal, source: "BASE", code: null };
}

export function evaluateRestrictions(input: RestrictionEvaluationInput): RestrictionEvaluation {
  const { serviceDate, durationDays, base, resolvedPeriod, rows, today } = input;
  const todayStart = dateOnly(today ?? new Date());
  const dateStart = dateOnly(serviceDate);
  const duration = durationDays != null && Number.isFinite(durationDays) ? Math.floor(durationDays) : null;
  const departureDate = duration !== null ? new Date(dateStart + (duration - 1) * DAY_MS) : null;

  const applied: AppliedRestriction[] = [];
  const push = (a: AppliedRestriction) => {
    applied.push(a);
  };

  // ── Ограничение: serviceDate в прошлом (fail-closed; sales guard-ит тоже) ──
  if (dateStart < todayStart) {
    return { sellable: false, blockedReason: "past_date", applied, minStay: null, maxStay: null, advanceBookingDays: null, closedToArrival: false, closedToDeparture: false };
  }

  // ── STOP_SELL (DATE rows) + периодный stop-sell (1.8C sellable) ──────────
  // Range-семантика (§42, hotel-like): при заданном durationDays stop-sold
  // ЛЮБАЯ обязательная дата диапазона [serviceDate .. serviceDate+duration-1]
  // блокирует новый binding (не только start). Без durationDays — start-дата.
  const stopDates: Array<{ code: string; t: number }> = [];
  for (const r of rows) {
    if (r.type === "STOP_SELL" && r.scope === "DATE" && r.startDate !== null) {
      stopDates.push({ code: r.code, t: dateOnly(r.startDate) });
    }
  }
  const stopBlocked = (d: number): { code: string } | null => {
    const hit = stopDates.find((s) => s.t === d);
    return hit ? { code: hit.code } : null;
  };
  let dateStopHit: { code: string } | null = null;
  if (duration !== null) {
    for (let d = dateStart; d <= dateStart + (duration - 1) * DAY_MS; d += DAY_MS) {
      const hit = stopBlocked(d);
      if (hit) {
        dateStopHit = hit;
        break;
      }
    }
  } else {
    dateStopHit = stopBlocked(dateStart);
  }
  if (dateStopHit) {
    push({ type: "STOP_SELL", value: null, source: "DATE", code: dateStopHit.code });
  }
  if (resolvedPeriod && !resolvedPeriod.sellable) {
    push({ type: "PERIOD_STOP_SELL", value: null, source: "PERIOD", code: resolvedPeriod.code });
  }
  if (dateStopHit || (resolvedPeriod && !resolvedPeriod.sellable)) {
    return {
      sellable: false,
      blockedReason: dateStopHit ? "date_stop_sell" : "period_stop_sell",
      applied,
      minStay: null,
      maxStay: null,
      advanceBookingDays: null,
      closedToArrival: false,
      closedToDeparture: false,
    };
  }

  // ── MIN_STAY / MAX_STAY ───────────────────────────────────────────────────
  const minStayDate = rows.find((r) => r.type === "MIN_STAY" && dateApplies(r, serviceDate)) ?? null;
  const minStayPeriod = rows.find((r) => r.type === "MIN_STAY" && periodApplies(r, resolvedPeriod)) ?? null;
  const minStayEff = effective(
    minStayDate ? { value: minStayDate.value, code: minStayDate.code } : null,
    minStayPeriod ? { value: minStayPeriod.value, code: minStayPeriod.code } : null,
    base.minStay ?? null,
  );
  const maxStay = base.maxStay ?? null;
  if (minStayEff.value !== null) push({ type: "MIN_STAY", value: minStayEff.value, source: minStayEff.source, code: minStayEff.code });
  if (maxStay !== null) push({ type: "MIN_STAY", value: maxStay, source: "BASE", code: null });

  let stayBlocked: { reason: string; value: number } | null = null;
  if (minStayEff.value !== null && minStayEff.value > 1) {
    if (duration === null) stayBlocked = { reason: "min_stay_requires_duration", value: minStayEff.value };
    else if (duration < minStayEff.value) stayBlocked = { reason: "min_stay", value: minStayEff.value };
  }
  if (maxStay !== null && duration !== null && duration > maxStay) {
    stayBlocked = { reason: "max_stay", value: maxStay };
  }

  // ── ADVANCE_BOOKING (date-only UTC; serviceDate >= today + N days) ────────
  const advDate = rows.find((r) => r.type === "ADVANCE_BOOKING" && dateApplies(r, serviceDate)) ?? null;
  const advPeriod = rows.find((r) => r.type === "ADVANCE_BOOKING" && periodApplies(r, resolvedPeriod)) ?? null;
  const advEff = effective(
    advDate ? { value: advDate.value, code: advDate.code } : null,
    advPeriod ? { value: advPeriod.value, code: advPeriod.code } : null,
    base.advanceBookingDays ?? 0,
  );
  if (advEff.value !== null && advEff.value > 0) {
    push({ type: "ADVANCE_BOOKING", value: advEff.value, source: advEff.source, code: advEff.code });
  }
  const advanceDays = advEff.value ?? 0;
  const advanceBlocked = dateStart < todayStart + advanceDays * DAY_MS;

  // ── CTA (запрет заезда/начала; проверяется ТОЛЬКО start-дата) ─────────────
  // Presence-семантика: value у CTA/CTD НЕ существует — активность определяется
  // наличием применяемого DATE/PERIOD row или base-флага (не value).
  const ctaDate = rows.find((r) => r.type === "CLOSED_TO_ARRIVAL" && dateApplies(r, serviceDate)) ?? null;
  const ctaPeriod = rows.find((r) => r.type === "CLOSED_TO_ARRIVAL" && periodApplies(r, resolvedPeriod)) ?? null;
  const ctaActive = ctaDate !== null || ctaPeriod !== null || base.closedToArrival === true;
  const ctaSource: "DATE" | "PERIOD" | "BASE" = ctaDate ? "DATE" : ctaPeriod ? "PERIOD" : "BASE";
  if (ctaActive) push({ type: "CLOSED_TO_ARRIVAL", value: null, source: ctaSource, code: (ctaDate ?? ctaPeriod)?.code ?? null });

  // ── CTD (запрет выезда/окончания; проверяется end-дата = start+duration-1) ─
  const ctdDate = departureDate !== null ? (rows.find((r) => r.type === "CLOSED_TO_DEPARTURE" && r.scope === "DATE" && sameDate(r.startDate, departureDate)) ?? null) : null;
  const ctdPeriod =
    departureDate !== null
      ? (rows.find(
          (r) => r.type === "CLOSED_TO_DEPARTURE" && r.scope === "PERIOD" && resolvedPeriod !== null && r.commercialPeriodId === resolvedPeriod.id && inRange(resolvedPeriod.startDate, resolvedPeriod.endDate, departureDate),
        ) ?? null)
      : null;
  const ctdActive = ctdDate !== null || ctdPeriod !== null || base.closedToDeparture === true;
  const ctdSource: "DATE" | "PERIOD" | "BASE" = ctdDate ? "DATE" : ctdPeriod ? "PERIOD" : "BASE";
  if (ctdActive) push({ type: "CLOSED_TO_DEPARTURE", value: null, source: ctdSource, code: (ctdDate ?? ctdPeriod)?.code ?? null });

  // ── Финальный вердикт (детерминированный приоритет reason) ────────────────
  const minStayApplied = minStayEff.value !== null ? minStayEff.value : null;
  const maxStayApplied = maxStay;

  if (advanceBlocked) {
    return { sellable: false, blockedReason: "advance_booking", applied, minStay: minStayApplied, maxStay: maxStayApplied, advanceBookingDays: advanceDays, closedToArrival: ctaActive, closedToDeparture: ctdActive };
  }
  if (ctaActive) {
    return { sellable: false, blockedReason: "closed_to_arrival", applied, minStay: minStayApplied, maxStay: maxStayApplied, advanceBookingDays: advanceDays, closedToArrival: true, closedToDeparture: ctdActive };
  }
  if (ctdActive && duration === null) {
    return { sellable: false, blockedReason: "closed_to_departure_requires_duration", applied, minStay: minStayApplied, maxStay: maxStayApplied, advanceBookingDays: advanceDays, closedToArrival: ctaActive, closedToDeparture: true };
  }
  if (ctdActive) {
    return { sellable: false, blockedReason: "closed_to_departure", applied, minStay: minStayApplied, maxStay: maxStayApplied, advanceBookingDays: advanceDays, closedToArrival: ctaActive, closedToDeparture: true };
  }
  if (stayBlocked) {
    return { sellable: false, blockedReason: stayBlocked.reason, applied, minStay: minStayApplied, maxStay: maxStayApplied, advanceBookingDays: advanceDays, closedToArrival: ctaActive, closedToDeparture: ctdActive };
  }

  return {
    sellable: true,
    blockedReason: null,
    applied,
    minStay: minStayApplied,
    maxStay: maxStayApplied,
    advanceBookingDays: advanceDays,
    closedToArrival: ctaActive,
    closedToDeparture: ctdActive,
  };
}
