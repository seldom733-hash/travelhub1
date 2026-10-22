/**
 * Voyager verified dictionaries (live 2026-10-21).
 *
 * STATEINC (select STATEINC of /search_tour?TOWNFROMINC=34):
 *   25 Занзибар (Танзания) · 22 Индия · 31 Катар · 33 Малайзия ·
 *   24 Мальдивы · 13 ОАЭ · 21 Оман · 46 Сингапур · 23 Тайланд · 19 Шри-Ланка
 *
 * STARS (checklistbox, identical ids across states; verified MY + AE):
 *   2* → 10009 · 3* → 10010 · 4* → 10011 · 5* → 10012 · Apartments → 10013
 *
 * MEALS (checklistbox, identical ids across states; verified MY + AE):
 *   AI → 10001 · BB → 10002 · HB → 10003 · FB → 10004 · RO → 10005
 *   (+ AI SOFT → 3, UAL → 10006 — not mapped, engine accepts text via dict).
 */

/** ISO-2 → supplier STATEINC id. */
export const VOYAGER_STATEINC_BY_ISO: Record<string, string> = {
  TZ: "25", // Занзибар (Танзания)
  IN: "22",
  QA: "31",
  MY: "33",
  MV: "24",
  AE: "13",
  OM: "21",
  SG: "46",
  TH: "23",
  LK: "19",
};

/** Country aliases (ISO-2 / ru / en) → STATEINC. Keyed by lowercase. */
export const VOYAGER_COUNTRY_ALIASES: Record<string, string> = {
  tz: "25", tanzania: "25", танзания: "25", zanzibar: "25", занзибар: "25",
  "занзибар (танзания)": "25",
  in: "22", india: "22", индия: "22",
  qa: "31", qatar: "31", катар: "31",
  my: "33", malaysia: "33", малайзия: "33",
  mv: "24", maldives: "24", мальдивы: "24",
  ae: "13", uae: "13", emirates: "13", "united arab emirates": "13",
  оаэ: "13", эмираты: "13",
  om: "21", oman: "21", оман: "21",
  sg: "46", singapore: "46", сингапур: "46",
  th: "23", thailand: "23", тайланд: "23", таиланд: "23",
  lk: "19", "sri lanka": "19", "шри-ланка": "19", lanka: "19",
};

/** Supplier-neutral star rating (numeric) → Voyager STARS checklistbox id. */
export const VOYAGER_STARS_KEY: Record<number, string> = {
  2: "10009",
  3: "10010",
  4: "10011",
  5: "10012",
};

/** Meal code (uppercase) → Voyager MEALS checklistbox id. */
export const VOYAGER_MEALS_KEY: Record<string, string> = {
  AI: "10001",
  BB: "10002",
  HB: "10003",
  FB: "10004",
  RO: "10005",
};

/**
 * Resolve an arbitrary country input (ISO-2 / ru / en) → STATEINC id.
 */
export function voyagerStateInc(input: string): string | undefined {
  return VOYAGER_COUNTRY_ALIASES[input.trim().toLowerCase()];
}

/** STATEINC → display country name (supplier's own label, verified). */
export const VOYAGER_STATE_NAMES: Record<string, string> = {
  "25": "Занзибар (Танзания)",
  "22": "Индия",
  "31": "Катар",
  "33": "Малайзия",
  "24": "Мальдивы",
  "13": "ОАЭ",
  "21": "Оман",
  "46": "Сингапур",
  "23": "Тайланд",
  "19": "Шри-Ланка",
};

/** ISO-2 codes Voyager serves (capability matrix source). */
export const VOYAGER_ISO_CODES: string[] = Object.keys(VOYAGER_STATEINC_BY_ISO);

// ── HOTEL form dictionary (stay-only /search_hotel) ─────────────────────────
/**
 * STATEINC of the SEPARATE stay-only form (verified live 2026-10-22:
 * `/search_hotel` select — 16 states). The hotel dictionary is WIDER than
 * the tour one: + AZ (14), GE (15), ID (42), KG (12), MU (61), UZ (49).
 * Shared countries keep the same STATEINC ids as the tour form.
 */
export const VOYAGER_HOTEL_STATEINC_BY_ISO: Record<string, string> = {
  AZ: "14",
  GE: "15",
  TZ: "25",
  IN: "22",
  ID: "42",
  QA: "31",
  KG: "12",
  MY: "33",
  MV: "24",
  AE: "13",
  OM: "21",
  MU: "61",
  SG: "46",
  TH: "23",
  UZ: "49",
  LK: "19",
};

/** Hotel-form country aliases (ISO-2 / ru / en) → STATEINC (lowercase keys). */
export const VOYAGER_HOTEL_COUNTRY_ALIASES: Record<string, string> = {
  az: "14", azerbaijan: "14", азербайджан: "14", баку: "14",
  ge: "15", georgia: "15", грузия: "15",
  tz: "25", tanzania: "25", танзания: "25", zanzibar: "25", занзибар: "25",
  "занзибар (танзания)": "25",
  in: "22", india: "22", индия: "22",
  id: "42", indonesia: "42", индонезия: "42",
  qa: "31", qatar: "31", катар: "31",
  kg: "12", kyrgyzstan: "12", кыргызстан: "12",
  my: "33", malaysia: "33", малайзия: "33",
  mv: "24", maldives: "24", мальдивы: "24",
  ae: "13", uae: "13", emirates: "13", "united arab emirates": "13",
  оаэ: "13", эмираты: "13",
  om: "21", oman: "21", оман: "21",
  mu: "61", mauritius: "61", маврикий: "61", "республика маврикий": "61",
  sg: "46", singapore: "46", сингапур: "46",
  th: "23", thailand: "23", тайланд: "23", таиланд: "23",
  uz: "49", uzbekistan: "49", узбекистан: "49",
  lk: "19", "sri lanka": "19", "шри-ланка": "19", lanka: "19",
};

/** Hotel-form STATEINC → display country name (supplier's own label, verified). */
export const VOYAGER_HOTEL_STATE_NAMES: Record<string, string> = {
  "14": "Азербайджан",
  "15": "Грузия",
  "25": "Занзибар (Танзания)",
  "22": "Индия",
  "42": "Индонезия",
  "31": "Катар",
  "12": "Кыргызстан",
  "33": "Малайзия",
  "24": "Мальдивы",
  "13": "ОАЭ",
  "21": "Оман",
  "61": "Республика Маврикий",
  "46": "Сингапур",
  "23": "Тайланд",
  "49": "Узбекистан",
  "19": "Шри-Ланка",
};

/** ISO-2 codes Voyager HOTELS serves (capability matrix source). */
export const VOYAGER_HOTEL_ISO_CODES: string[] = Object.keys(
  VOYAGER_HOTEL_STATEINC_BY_ISO,
);
