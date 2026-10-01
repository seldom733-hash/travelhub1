/**
 * Similarity helpers для справочников типов номеров/видов (модерация дублей).
 *
 * Цель: поймать дубли вида Standard / STANDART / STANDART ROOM / Стандарт
 * до и во время модерации. Чистые функции без запросов — тестируются спекой.
 *
 * Pipeline: translit(кириллица→латиница) → UPPER → токенизация →
 * синонимы (ROOM/APARTMENT/НОМЕР/ТИП…) отбрасываются → склейка.
 */

export interface DictEntryLike {
  id: string;
  code: string;
  /** names: { ru?, en?, az? } — Json; допускаются иные языки. */
  names: unknown;
}

export interface SimilarCandidate {
  id: string;
  code: string;
  names: unknown;
  score: number;
}

const SYNONYM_TOKENS = new Set([
  "ROOM", "ROOMS", "APARTMENT", "APARTMENTS", "TYPE", "TYPES", "CLASS",
  // после translit (кириллические формы тоже оставлены — на случай сырого входа)
  "NOMER", "NOMERY", "TIP", "TIPY", "KLASS",
  "НОМЕР", "НОМЕРЫ", "ТИП", "ТИПЫ", "КЛАСС",
]);

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "ZH", З: "Z",
  И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R",
  С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "CH", Ш: "SH",
  Щ: "SCH", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "YU", Я: "YA",
};

/** Кириллица → латиница (по-буквенно), Ё→Е. Латиница проходит как есть. */
export function translit(value: string): string {
  let out = "";
  for (const ch of value.toUpperCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out;
}

/**
 * Каноническая форма для сравнения: translit → UPPER → токены
 * (A-Z0-9) → без синонимов → склейка. "" для пустого/бессмысленного.
 */
export function normalizeTypeName(value: string): string {
  const tokens = translit(value)
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length > 0 && !SYNONYM_TOKENS.has(t));
  return tokens.join("");
}

/** Классическое расстояние Левенштейна (две строки, полная матрица). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function nameValues(entry: DictEntryLike): string[] {
  const values: string[] = [entry.code];
  const names = entry.names;
  if (names && typeof names === "object") {
    for (const v of Object.values(names as Record<string, unknown>)) {
      if (typeof v === "string") values.push(v);
    }
  }
  return values;
}

/** Score одного значения к запросу: 1=точно, 0.92=вхождение, иначе ratio. */
function scoreValue(normalizedQuery: string, raw: string): number {
  const nv = normalizeTypeName(raw);
  if (!nv) return 0;
  if (nv === normalizedQuery) return 1;
  if (normalizedQuery.length >= 3 && nv.length >= 3 && (nv.includes(normalizedQuery) || normalizedQuery.includes(nv))) {
    return 0.92;
  }
  const maxLen = Math.max(normalizedQuery.length, nv.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(normalizedQuery, nv) / maxLen;
}

/**
 * Кандидаты-дубли для запроса. minScore по умолчанию 0.72 —
 * ловит опечатки (STANDART vs STANDART) и близкие формулировки,
 * но не смешивает несвязанные типы.
 */
export function findSimilarCandidates(
  query: string,
  entries: DictEntryLike[],
  opts: { minScore?: number; limit?: number } = {},
): SimilarCandidate[] {
  const minScore = opts.minScore ?? 0.72;
  const limit = opts.limit ?? 5;
  const nq = normalizeTypeName(query);
  if (!nq) return [];
  const out: SimilarCandidate[] = [];
  for (const entry of entries) {
    let best = 0;
    for (const value of nameValues(entry)) {
      best = Math.max(best, scoreValue(nq, value));
      if (best === 1) break;
    }
    if (best >= minScore) out.push({ id: entry.id, code: entry.code, names: entry.names, score: Math.round(best * 1000) / 1000 });
  }
  out.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return out.slice(0, limit);
}
