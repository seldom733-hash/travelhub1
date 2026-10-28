/**
 * Идентичность ФИЗИЧЕСКОЙ гостиницы — единый каталог фотографий отелей.
 *
 * Тур с проживанием в гостинице, карточка этой же гостиницы в услуге «Отели» и
 * предложения разных поставщиков должны ссылаться на ОДНУ запись отеля, а
 * значит на одну фотографию. Здесь — чистая логика, по которой строится эта
 * единая запись (её использует scripts/hotel-registry.ts и тесты).
 *
 * Два уровня идентичности:
 *  1. supplier-native id: (supplierCode, hotelKey/hotelInc) — один отель у
 *     поставщика. Один и тот же ключ в туре и в услуге «Отели» = один отель.
 *  2. физическая гостиница: нормализованное имя + страна + город. По одному
 *     названию отели НЕ объединяются.
 */

export interface HotelRef {
  supplierCode: string;
  /** supplier-native id отеля (hotelKey / hotelInc). */
  externalKey: string;
  /** Отображаемое имя без хвостов «(Город)» и «N*». */
  name: string;
  normalizedName: string;
  stars: number | null;
  countryCode: string;
  countryName: string;
  cityName: string;
  /** Нормализованный город — входит в ключ группы. */
  cityKey: string;
  resortName: string;
  hotelHref: string;
  source: "product" | "geolink";
}

export interface HotelGroup {
  key: string;
  name: string;
  normalizedName: string;
  stars: number | null;
  countryCode: string;
  countryName: string;
  cityName: string;
  resortName: string;
  refs: HotelRef[];
}

/**
 * Убирает из названия хвосты «(Город)» и «5*» в любом порядке, схлопывает
 * пробелы. «RADISSON BLU ISTANBUL PERA 5* (Пера)» → «RADISSON BLU ISTANBUL PERA».
 */
export function cleanHotelName(raw: string): string {
  let name = (raw ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 5; i += 1) {
    const before = name;
    name = name.replace(/\s*\([^()]*\)\s*$/, "").trim();
    name = name.replace(/(?:\s*\d)?\s*\*+\s*$/, "").trim();
    if (name === before) break;
  }
  return name;
}

/** Звёздность из названия («… 5*»). Нет данных → null. */
export function parseStars(raw: string): number | null {
  const m = (raw ?? "").match(/(\d)\s*\*/);
  return m ? Number(m[1]) : null;
}

/**
 * Ключ сопоставления имён/городов: нижний регистр, буквы и цифры (латиница и
 * кириллица), пробелы схлопнуты. «Zenseana Resort & Spa» → «zenseana resort spa».
 */
export function normalizeName(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ключ физической гостиницы: (имя, страна, город) после нормализации. */
export function hotelGroupKey(ref: Pick<HotelRef, "normalizedName" | "countryCode" | "cityKey">): string {
  return `${ref.normalizedName}|${ref.countryCode}|${ref.cityKey}`;
}

/**
 * Служебные слова, которые не различают отели: «Hotel», «Resort», «Spa» и т. п.
 * Нужны только для оценки похожести названий (кандидаты на ручное слияние); в
 * ключ группы они НЕ входят — ключ строится по полному нормализованному имени.
 */
const GENERIC_NAME_TOKENS = new Set([
  "hotel",
  "hotels",
  "resort",
  "resorts",
  "spa",
  "guest",
  "house",
  "guesthouse",
  "apart",
  "apartments",
  "apartment",
  "suites",
  "suite",
  "inn",
  "hostel",
  "villa",
  "villas",
  "club",
  "beach",
  "by",
  "the",
  "and",
  "of",
  "at",
  "in",
  "city",
  "center",
  "centre",
  "luxury",
  "deluxe",
  "grand",
  "royal",
  "palace",
  "boutique",
  "complex",
  "residence",
  "old",
  "new",
]);

/** Значимые токены названия отеля (без служебных слов и коротких предлогов). */
function significantTokens(raw: string): string[] {
  return normalizeName(cleanHotelName(raw))
    .split(" ")
    .filter((t) => t.length > 2 && !GENERIC_NAME_TOKENS.has(t));
}

/**
 * Похожесть двух названий отелей по Жаккару на значимых токенах: 0 — нет
 * общих слов, 1 — одинаковый набор. Это ТОЛЬКО сигнал для очереди ручной
 * проверки; слияние по одному сходству имён запрещено (аудит 23.10.2026: без
 * адресов/координат совпадение имени не доказывает идентичность).
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(significantTokens(a));
  const tb = new Set(significantTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common += 1;
  const union = ta.size + tb.size - common;
  if (union === 0) return 0;
  return Math.round((common / union) * 100) / 100;
}

/**
 * Подставляет каноническое имя физического отеля в title карточки, сохраняя
 * смысловой хвост: программу тура (« — Baku–Dubai») или гео-хвост карточки
 * отеля (« (Baku, Azerbaijan)»). Пустое каноническое имя — title без изменений.
 */
export function applyCanonicalName(title: string, canonicalName: string | null | undefined): string {
  const canonical = (canonicalName ?? "").trim();
  if (!canonical) return title;
  const programIdx = title.indexOf(" — ");
  if (programIdx >= 0) return `${canonical}${title.slice(programIdx)}`;
  const geoIdx = title.indexOf(" (");
  if (geoIdx >= 0) return `${canonical}${title.slice(geoIdx)}`;
  return canonical;
}

/**
 * Группирует ref-ы поставщиков в физические гостиницы.
 *
 * Правило: одинаковые (имя, страна, город) → одна гостиница. Разные города или
 * страны → разные гостиницы, даже при одинаковом названии (в городе может быть
 * два отеля с одним именем — такие случаи уходят в отчёт на ручную проверку,
 * см. scripts/hotel-registry.ts).
 *
 * Звёздность в ключ СОЗНАТЕЛЬНО не входит: поставщики часто переклассифицируют
 * один отель (например, «Jaz Fanara» 4*→5*), и разделение дало бы две
 * фотографии для одной гостиницы. Конфликты звёзд выносятся в отчёт.
 */
export function groupHotelRefs(refs: HotelRef[]): HotelGroup[] {
  const sorted = [...refs].sort((a, b) =>
    `${a.normalizedName}|${a.countryCode}|${a.cityKey}|${a.supplierCode}|${a.externalKey}`.localeCompare(
      `${b.normalizedName}|${b.countryCode}|${b.cityKey}|${b.supplierCode}|${b.externalKey}`,
    ),
  );
  const groups = new Map<string, HotelGroup>();
  for (const ref of sorted) {
    const key = hotelGroupKey(ref);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: ref.name,
        normalizedName: ref.normalizedName,
        stars: ref.stars,
        countryCode: ref.countryCode,
        countryName: ref.countryName,
        cityName: ref.cityName,
        resortName: ref.resortName,
        refs: [],
      };
      groups.set(key, group);
    }
    // Пустые поля группы заполняем детерминированно (первым непустым значением).
    if (!group.countryName && ref.countryName) group.countryName = ref.countryName;
    if (!group.cityName && ref.cityName) group.cityName = ref.cityName;
    if (!group.resortName && ref.resortName) group.resortName = ref.resortName;
    if (group.stars == null && ref.stars != null) group.stars = ref.stars;
    group.refs.push(ref);
  }
  return [...groups.values()];
}
