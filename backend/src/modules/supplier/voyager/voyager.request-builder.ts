/**
 * Voyager PRICES request builder (pure functions, no I/O).
 *
 * Engine: SAMO (same family as Summertour/KazUnion) served over plain HTTP
 * at online.voyagergroup.az/search_tour — verified live 2026-10-21 without a
 * browser session or captcha.
 *
 * Verified parameter contract (live probes 2026-10-21):
 *  • TOWNFROMINC=34 — Баку, единственный пункт вылета в словаре;
 *  • CURRENCY=2 (USD) — единственный код, на который поставщик отдаёт цены
 *    (CURRENCY=1,3..10 → «Нет данных»); AZN считается на нашей стороне через
 *    SupplierFxRateService;
 *  • TOURINC опционален: без него (или TOURINC=0) движок сам отдаёт все
 *    программы страны одним запросом — фен-аут по турам НЕ нужен;
 *  • пагинация PRICEPAGE=N (100 строк/страница), DOLOAD=1;
 *  • rev=4091891869 — проверенная ревизия (принимается, фиксируем).
 */

/** Verified fixed revision accepted by the Voyager PRICES endpoint. */
export const VOYAGER_REV = "4091891869";

/** Only departure town served by Voyager (Баку). */
export const VOYAGER_TOWN_FROM_BAKU = "34";

/** Voyager PRICES params (ISO dates → SAMO YYYYMMDD inside the builder). */
export interface VoyagerPricesParams {
  /** STATEINC country id (verified dictionary, see voyager.adapter). */
  stateInc: string;
  /** TOURINC program id. Optional: absent/"0" → all programs of the country. */
  tourInc?: string;
  /** Departure date range, ISO YYYY-MM-DD (inclusive). */
  checkInBeg: string;
  checkInEnd: string;
  nightsFrom?: number;
  nightsTill?: number;
  adults?: number;
  children?: number;
  /** Child ages as the AGES CSV (AGES=1,6,7 — verified accepted). */
  childAges?: number[];
  /** Supplier currency code. Default "2" (USD) — the only working code. */
  currency?: string;
  /** STARS checklistbox id (verified: 5* → 10012). */
  starsKey?: string;
  /** TOWNS checklistbox ids CSV (city/district filter). */
  townsCsv?: string;
  /** HOTELS checklistbox ids CSV. */
  hotelsCsv?: string;
  /** MEALS checklistbox id (verified: AI=10001 … RO=10005). */
  mealKey?: string;
  /** ROOMS checklistbox id CSV. */
  roomsCsv?: string;
}

/** ISO YYYY-MM-DD → SAMO YYYYMMDD. */
export function toSamodate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Build the full param map for one PRICES page (pure). */
export function buildVoyagerPricesParams(
  params: VoyagerPricesParams,
  page: number,
): Record<string, string> {
  // Whitespace/CSV normalization BEFORE the ANY-flag decision (a whitespace
  // CSV would flip *_ANY=0 with an empty filter → supplier ignores it or
  // errors out; same rule as KazUnion's builder).
  const towns = params.townsCsv?.replace(/\s+/g, "");
  const hotels = params.hotelsCsv?.replace(/\s+/g, "");
  const rooms = params.roomsCsv?.replace(/\s+/g, "");

  const p: Record<string, string> = {
    samo_action: "PRICES",
    TOWNFROMINC: VOYAGER_TOWN_FROM_BAKU,
    STATEINC: params.stateInc,
    // TOURINC=0 → «все программы страны» (engine fan-out, verified live:
    // ОАЭ без TOURINC вернули две программы одной страницей).
    TOURINC: params.tourInc ?? "0",
    CHECKIN_BEG: toSamodate(params.checkInBeg),
    CHECKIN_END: toSamodate(params.checkInEnd),
    NIGHTS_FROM: String(params.nightsFrom ?? 3),
    NIGHTS_TILL: String(params.nightsTill ?? params.nightsFrom ?? 14),
    ADULT: String(params.adults ?? 2),
    CHILD: String(params.children ?? 0),
    // USD — the only currency Voyager publishes prices in (verified).
    CURRENCY: params.currency ?? "2",
    hotelsearch: "0",
    HOTELS_ANY: hotels ? "0" : "1",
    HOTELS: hotels ?? "",
    MEALS_ANY: params.mealKey ? "0" : "1",
    MEALS: params.mealKey ?? "",
    TOWNS_ANY: towns ? "0" : "1",
    TOWNS: towns ?? "",
    STARS_ANY: params.starsKey ? "0" : "1",
    STARS: params.starsKey ?? "",
    ROOMS_ANY: rooms ? "0" : "1",
    ROOMS: rooms ?? "",
    // Форма вылета по умолчанию: FREIGHT=1 (любой транспорт) + FILTER=1.
    FREIGHT: "1",
    FILTER: "1",
    PRICEPAGE: String(page),
    DOLOAD: "1",
    rev: VOYAGER_REV,
  };

  // AGES=<ages of ALL children> (verified accepted; no AGE1..AGE4 split).
  const ages = params.childAges ?? [];
  if (ages.length) p.AGES = ages.join(",");

  return p;
}

/** Build the full PRICES URL for one page (pure). */
export function buildVoyagerPricesUrl(
  params: VoyagerPricesParams,
  page: number,
): string {
  const p = buildVoyagerPricesParams(params, page);
  const qs = Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `https://online.voyagergroup.az/search_tour?${qs}`;
}

/** URL of the search form for a country (dictionary discovery). */
export function buildVoyagerFormUrl(stateInc: string): string {
  return `https://online.voyagergroup.az/search_tour?TOWNFROMINC=${VOYAGER_TOWN_FROM_BAKU}&STATEINC=${encodeURIComponent(stateInc)}`;
}

// ── HOTEL form (stay-only /search_hotel) ────────────────────────────────────

/** Base URL of the stay-only PRICES endpoint. */
export const VOYAGER_HOTEL_BASE_URL = "https://online.voyagergroup.az/search_hotel";

/**
 * Hotel-form PRICES params — mirrors the supplier's OWN request captured
 * live 2026-10-22 (owner-supplied example, STATEINC=33/MY + TOURINC=641):
 *
 *  • no TOWNFROMINC — the stay form has no departure city;
 *  • TOURINC pins a hotel program («Малайзия. Только проживание»); "0" (or
 *    absent) = the engine fans out every program of the country (verified
 *    live: TOURINC=0 returned the same 641 rows);
 *  • CHILD_IN_BED=0, MOMENT_CONFIRM=0, FILTER=0, DYN_SEPARATE=1,
 *    townssearch=0/hotelsearch=0, UFILTER=/HOTELTYPES= — the form defaults
 *    (verified accepted);
 *  • CURRENCY=2 (USD) — the only currency Voyager publishes prices in;
 *  • AGES=<ages of ALL children> CSV (verified: CHILD=3 + AGES=1,5,11);
 *  • PRICEPAGE pagination with DOLOAD=1 (verified: page 2 without DOLOAD
 *    replays page 1, with DOLOAD it advances).
 */
export function buildVoyagerHotelPricesParams(
  params: VoyagerPricesParams,
  page: number,
): Record<string, string> {
  const towns = params.townsCsv?.replace(/\s+/g, "");
  const hotels = params.hotelsCsv?.replace(/\s+/g, "");
  const rooms = params.roomsCsv?.replace(/\s+/g, "");

  const p: Record<string, string> = {
    samo_action: "PRICES",
    STATEINC: params.stateInc,
    TOURINC: params.tourInc ?? "0",
    CHECKIN_BEG: toSamodate(params.checkInBeg),
    CHECKIN_END: toSamodate(params.checkInEnd),
    NIGHTS_FROM: String(params.nightsFrom ?? 1),
    NIGHTS_TILL: String(params.nightsTill ?? params.nightsFrom ?? 30),
    ADULT: String(params.adults ?? 2),
    CHILD: String(params.children ?? 0),
    // USD — the only currency Voyager publishes prices in (verified).
    CURRENCY: params.currency ?? "2",
    TOWNS_ANY: towns ? "0" : "1",
    townssearch: "0",
    TOWNS: towns ?? "",
    STARS_ANY: params.starsKey ? "0" : "1",
    STARS: params.starsKey ?? "",
    HOTELS_ANY: hotels ? "0" : "1",
    hotelsearch: "0",
    HOTELS: hotels ?? "",
    MEALS_ANY: params.mealKey ? "0" : "1",
    MEALS: params.mealKey ?? "",
    ROOMS_ANY: rooms ? "0" : "1",
    ROOMS: rooms ?? "",
    CHILD_IN_BED: "0",
    FILTER: "0",
    MOMENT_CONFIRM: "0",
    UFILTER: "",
    HOTELTYPES: "",
    PRICEPAGE: String(page),
    DOLOAD: "1",
    DYN_SEPARATE: "1",
    rev: VOYAGER_REV,
  };

  const ages = params.childAges ?? [];
  if (ages.length) p.AGES = ages.join(",");

  return p;
}

/** Build the full HOTEL PRICES URL for one page (pure). */
export function buildVoyagerHotelPricesUrl(
  params: VoyagerPricesParams,
  page: number,
): string {
  const p = buildVoyagerHotelPricesParams(params, page);
  const qs = Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${VOYAGER_HOTEL_BASE_URL}?${qs}`;
}

/** URL of the stay-only search form for a country (dictionary discovery). */
export function buildVoyagerHotelFormUrl(stateInc: string): string {
  return `${VOYAGER_HOTEL_BASE_URL}?STATEINC=${encodeURIComponent(stateInc)}`;
}
