/**
 * Фронтенд-зеркало backend/src/modules/catalog/period-resolution.ts (DD-026).
 *
 * Precedence (канонический): DATE_OVERRIDE > уже́й PERIOD (dayCount) >
 * период с dayOfWeek > голый период > base price.
 * Specificity ascending: kind (0 < 1), dayCount, hasDow (0 < 1), id tie-break.
 *
 * Плюс утилиты «слоёного» редактора календаря:
 *  - compileLayers:  слои UI (BASE/HOLIDAY/WEEKEND/SPECIAL) → периоды API;
 *  - decompilePeriods: периоды API → слои UI (обратная эвристика);
 *  - findSamePriorityOverlap: клиентский pre-check записи (бэкенд вернёт 422);
 *  - upsertSpecialDay/removeSpecialDay: точечные даты (bulk-матрица);
 *  - pickVariantForView: цепочка exact-вид → строка «-» → null (warning).
 *
 * Чистые функции, без сетевых запросов. Даты — строки "YYYY-MM-DD"
 * (лексикографическое сравнение корректно), день недели — UTC.
 */

export interface ApiPeriod {
  id: string;
  code: string;
  kind: "PERIOD" | "DATE_OVERRIDE";
  startDate: string;
  endDate: string;
  dayOfWeek: number[];
  price: number | null;
  sellable: boolean;
}

export type LayerBlock = "BASE" | "HOLIDAY" | "WEEKEND" | "SPECIAL";

export interface PriceLayer {
  /** id исходного периода (для слоёв, создаваемых в UI — временный ключ). */
  id: string;
  block: LayerBlock;
  startDate: string;
  endDate: string;
  price: number;
  /** Дни недели 0..6 (вс–сб); непусто только у WEEKEND. */
  dayOfWeek: number[];
}

export interface CompiledPeriod {
  startDate: string;
  endDate: string;
  price: number;
  kind: "PERIOD" | "DATE_OVERRIDE";
  dayOfWeek: number[];
}

export interface ResolvedPrice {
  price: number;
  periodId: string;
  code: string;
  kind: "PERIOD" | "DATE_OVERRIDE";
  dayOfWeek: number[];
}

const DAY_MS = 86_400_000;

export const isoToday = (): string => new Date().toISOString().slice(0, 10);

export const addDaysIso = (iso: string, days: number): string =>
  new Date(parseIsoMs(iso) + days * DAY_MS).toISOString().slice(0, 10);

const parseIsoMs = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
};

export const dayOfWeekOf = (iso: string): number => new Date(parseIsoMs(iso)).getUTCDay();

/** Календарных дней включительно (startDate <= endDate). */
export const dayCount = (startDate: string, endDate: string): number =>
  Math.floor((parseIsoMs(endDate) - parseIsoMs(startDate)) / DAY_MS) + 1;

export const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }): boolean =>
  a.startDate <= b.endDate && b.startDate <= a.endDate;

function specificity(p: ApiPeriod): [number, number, number, string] {
  return [p.kind === "DATE_OVERRIDE" ? 0 : 1, dayCount(p.startDate, p.endDate), p.dayOfWeek.length > 0 ? 0 : 1, p.id];
}

function compareSpecificity(a: ApiPeriod, b: ApiPeriod): number {
  const ka = specificity(a);
  const kb = specificity(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  }
  return 0;
}

/** Периоды, применимые к дате (диапазон включительно + условие дня недели). */
export function applicablePeriods(periods: ApiPeriod[], dateIso: string): ApiPeriod[] {
  const dow = dayOfWeekOf(dateIso);
  return periods.filter(
    (p) => p.startDate <= dateIso && dateIso <= p.endDate && (p.dayOfWeek.length === 0 || p.dayOfWeek.includes(dow)),
  );
}

/** Выигравший период для даты (mirror DD-026) либо null → base fallback. */
export function resolvePrice(periods: ApiPeriod[], dateIso: string): ResolvedPrice | null {
  const applicable = applicablePeriods(periods, dateIso);
  if (!applicable.length) return null;
  const winner = [...applicable].sort(compareSpecificity)[0];
  return {
    price: winner.price ?? 0,
    periodId: winner.id,
    code: winner.code,
    kind: winner.kind,
    dayOfWeek: winner.dayOfWeek,
  };
}

/** Цена ячейки календаря: резолвер, иначе базовая цена тарифа. */
export function cellPrice(periods: ApiPeriod[], dateIso: string, basePrice: number): { price: number; sourceId: string | null } {
  const r = resolvePrice(periods, dateIso);
  return r ? { price: r.price, sourceId: r.periodId } : { price: basePrice, sourceId: null };
}

/**
 * Same-priority overlap (клиентский pre-check, mirror бэкенд-валидации):
 * пересечение + идентичный (kind, dayCount, hasDow) → недопустимо.
 */
export function findSamePriorityOverlap(periods: Array<Pick<ApiPeriod, "kind" | "startDate" | "endDate" | "dayOfWeek">>): boolean {
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];
      if (!overlaps(a, b)) continue;
      if (a.kind !== b.kind) continue;
      if (dayCount(a.startDate, a.endDate) !== dayCount(b.startDate, b.endDate)) continue;
      if ((a.dayOfWeek.length > 0 ? 1 : 0) !== (b.dayOfWeek.length > 0 ? 1 : 0)) continue;
      return true;
    }
  }
  return false;
}

/* ── Слои UI ⇄ периоды API ───────────────────────────────────────────────── */

/** Слои → тело saveAccommodationCalendar (SPECIAL ⇒ DATE_OVERRIDE без dow). */
export function compileLayers(layers: PriceLayer[]): CompiledPeriod[] {
  return layers.map((l) => ({
    startDate: l.startDate,
    endDate: l.endDate,
    price: l.price,
    kind: l.block === "SPECIAL" ? "DATE_OVERRIDE" : "PERIOD",
    dayOfWeek: l.block === "SPECIAL" ? [] : l.dayOfWeek,
  }));
}

/**
 * Обратная эвристика (периоды → слои):
 *  - dayOfWeek непусто        → WEEKEND;
 *  - kind DATE_OVERRIDE       → SPECIAL;
 *  - самый широкий PERIOD/bow → BASE, остальные PERIOD/bow → HOLIDAY
 *    (tie: раньше 시작 → BASE; стабильно для round-trip).
 */
export function decompilePeriods(periods: ApiPeriod[]): PriceLayer[] {
  const bare = periods.filter((p) => p.kind === "PERIOD" && p.dayOfWeek.length === 0);
  let baseId: string | null = null;
  let bestWidth = -1;
  for (const p of [...bare].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id.localeCompare(b.id)))) {
    const w = dayCount(p.startDate, p.endDate);
    if (w > bestWidth) {
      bestWidth = w;
      baseId = p.id;
    }
  }
  return periods.map((p) => {
    let block: LayerBlock;
    if (p.dayOfWeek.length > 0) block = "WEEKEND";
    else if (p.kind === "DATE_OVERRIDE") block = "SPECIAL";
    else block = p.id === baseId ? "BASE" : "HOLIDAY";
    return {
      id: p.id,
      block,
      startDate: p.startDate,
      endDate: p.endDate,
      price: p.price ?? 0,
      dayOfWeek: p.dayOfWeek,
    };
  });
}

/** Точечная дата (bulk-матрица): заменить/добавить SPECIAL-слой на дату. */
export function upsertSpecialDay(layers: PriceLayer[], dateIso: string, price: number): PriceLayer[] {
  const rest = layers.filter((l) => !(l.block === "SPECIAL" && l.startDate <= dateIso && dateIso <= l.endDate));
  return [...rest, { id: `special:${dateIso}`, block: "SPECIAL", startDate: dateIso, endDate: dateIso, price, dayOfWeek: [] }];
}

/** Убрать точечную дату. */
export function removeSpecialDay(layers: PriceLayer[], dateIso: string): PriceLayer[] {
  return layers.filter((l) => !(l.block === "SPECIAL" && l.startDate <= dateIso && dateIso <= l.endDate));
}

/* ── Выбор варианта по виду из окна (decision #4) ────────────────────────── */

export interface ViewCandidate {
  viewCode?: string | null;
}

/**
 * Цепочка: точный вид → строка без вида («-», пометка «без вида») → null
 * (caller показывает warning «для вида X нет варианта»).
 */
export function pickVariantForView<T extends ViewCandidate>(
  rows: T[],
  exactView: string | null,
): { row: T; fallback: "none" | "blank" } | null {
  if (exactView) {
    const exact = rows.find((r) => (r.viewCode ?? null) === exactView);
    if (exact) return { row: exact, fallback: "none" };
  }
  const blank = rows.find((r) => r.viewCode == null || r.viewCode === "");
  if (blank) return { row: blank, fallback: exactView ? "blank" : "none" };
  return null;
}
