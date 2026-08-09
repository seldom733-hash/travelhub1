/**
 * Phase 1 Step 1.13A — Temporal & Analytics Readiness: shared temporal helpers.
 *
 * UTC discipline (§20):
 *  - system/business timestamps — однозначные UTC instants (Prisma DateTime →
 *    ISO-8601 с суффиксом Z). Никакой локальной timezone в serialization.
 * Null semantics (§24):
 *  - `isoOrNull` — NULL = milestone ещё не происходил ИЛИ historical value unknown
 *    (legacy data). Не выдумываем fake timestamps.
 * Temporal invariants (§19):
 *  - `assertNonDecreasing` — хронологический порядок lifecycle timestamps там,
 *    где семантика гарантирует (activatedAt <= deprecatedAt и т.п.); NULL
 *    пропускаются (semantics их не связывает).
 */

/** ISO-8601 UTC instant (Prisma DateTime → UTC string). */
export function isoUtc(d: Date): string {
  return d.toISOString();
}

/** NULL-safe UTC serialization: null/undefined → null (legacy unknown / not yet). */
export function isoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Temporal invariant: значения не убывают хронологически (в переданном порядке).
 * NULL пропускаются — для них семантика порядка не гарантируется (§19).
 * Бросает ошибку при нарушении (developer/defensive check; runtime — на записи).
 */
export function assertNonDecreasing(label: string, ...values: Array<Date | null | undefined>): void {
  let prevMs: number | null = null;
  for (const v of values) {
    if (!v) continue;
    const ms = v.getTime();
    if (prevMs !== null && ms < prevMs) {
      throw new Error(
        `${label}: timestamps violate chronological order (${new Date(prevMs).toISOString()} > ${v.toISOString()})`,
      );
    }
    prevMs = ms;
  }
}
