/**
 * Summer Request Builder — TravelHub generic → Summertour SAMO params.
 *
 * Maps only proven Summer mappings per Tests 1-11.
 * STARS: supplier-native ids resolved by the aggregator from
 * SupplierGeoLink kind=STAR (starKeys["SUMMERTOUR"]) → STARS=<ids>&STARS_ANY=0.
 */

export interface SummerSearchRequest {
  TOWNFROMINC: string;
  STATEINC: string;
  TOURINC: string;
  TOWNS?: string;
  TOWNS_ANY?: string;
  HOTELS?: string;
  HOTELS_ANY: string;
  /** Supplier-native star ids (CSV) — hotel category filter. */
  STARS?: string;
  STARS_ANY?: string;
  CHECKIN_BEG?: string;
  CHECKIN_END?: string;
  NIGHTS_FROM?: string;
  NIGHTS_TILL?: string;
  ADULT?: string;
  CHILD?: string;
  AGE1?: string;
  AGE2?: string;
  AGE3?: string;
  MEALS_ANY: string;
  MEALS?: string;
  ROOMS_ANY: string;
  ROOMS?: string;
  FREIGHT: string;
  FILTER: string;
  CURRENCY: string;
  PARTITION_PRICE?: string;
  /** Use TOWNS action instead of PRICES (for HOTELS_ANY=1 calendar queries). */
  useTownsAction?: boolean;
}

const SUMMER_TOWNFROMINC = "1930";
const SUMMER_STATEINC = "9";

/** Convert ISO YYYY-MM-DD to SAMO DD.MM.YYYY (form input format). */
function isoToSamodate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Convert ISO YYYY-MM-DD to SAMO YYYYMMDD (XHR URL format). */
export function isoToSamodateYmd(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Convert DD.MM.YYYY to YYYYMMDD (XHR URL format). */
function ddmmmyyyyToYmd(d: string): string {
  const [dd, mm, yyyy] = d.split(".");
  return `${yyyy}${mm}${dd}`;
}

/** Build the base Summer search request from a TravelHub query. */
export function buildSummerSearchRequest(query: {
  tourIncValue?: string;
  towns?: string;
  hotelExternalId?: string;
  departureDateFrom?: string;
  departureDateTo?: string;
  nightsFrom?: number;
  nightsTo?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  meal?: string;
  freight?: string;
  filter?: string;
  /** Supplier-native star ids (CSV, starKeys["SUMMERTOUR"]). */
  stars?: string;
}): SummerSearchRequest {
  const req: SummerSearchRequest = {
    TOWNFROMINC: SUMMER_TOWNFROMINC,
    STATEINC: SUMMER_STATEINC,
    TOURINC: query.tourIncValue ?? "0",
    HOTELS_ANY: query.hotelExternalId ? "0" : "1",
    MEALS_ANY: query.meal ? "0" : "1",
    ROOMS_ANY: "1",
    // §9 parity with KOMPAS: FREIGHT=1 → only flights with seats available,
    // FILTER=1 → no sales stop (остановка продаж). Suppliers otherwise return
    // non-bookable rows that we cannot honestly sell.
    FREIGHT: query.freight ?? "1",
    FILTER: query.filter ?? "1",
    CURRENCY: "2",
  };
  if (query.towns) {
    req.TOWNS = query.towns;
    req.TOWNS_ANY = "0";
  }
  if (query.hotelExternalId) req.HOTELS = query.hotelExternalId;
  if (query.stars) {
    req.STARS = query.stars;
    req.STARS_ANY = "0";
  }
  if (query.meal) req.MEALS = query.meal;
  if (query.departureDateFrom) req.CHECKIN_BEG = isoToSamodate(query.departureDateFrom);
  if (query.departureDateTo) req.CHECKIN_END = isoToSamodate(query.departureDateTo);
  if (query.nightsFrom) req.NIGHTS_FROM = String(query.nightsFrom);
  if (query.nightsTo) req.NIGHTS_TILL = String(query.nightsTo);
  if (query.adults) req.ADULT = String(query.adults);
  if (query.children !== undefined) req.CHILD = String(query.children);
  const ages = query.childAges ?? [];
  if (ages[0] !== undefined) req.AGE1 = String(ages[0]);
  if (ages[1] !== undefined) req.AGE2 = String(ages[1]);
  if (ages[2] !== undefined) req.AGE3 = String(ages[2]);
  return req;
}

/**
 * Build a full SAMO XHR URL for fetching prices.
 *
 * Uses YYYYMMDD date format (not DD.MM.YYYY).
 * Includes PRICEPAGE=1, DYN_SEPARATE=1 as proven in Tests 1-11.
 * PARTITION_PRICE=0 — no server-side price grouping: every room/meal
 * variant comes back as its own row (parity with KOMPAS/KazUnion;
 * PARTITION_PRICE=32 was collapsing variants into one grouped row).
 * `rev` and `_` are dynamic cache-busters.
 */
export function buildSummerXhrUrl(req: SummerSearchRequest): string {
  const p = new URLSearchParams();
  const useTowns = req.useTownsAction === true;
  p.set("samo_action", useTowns ? "TOWNS" : "PRICES");
  p.set("TOWNFROMINC", req.TOWNFROMINC);
  p.set("STATEINC", req.STATEINC);
  p.set("TOURINC", req.TOURINC);
  if (req.TOWNS) { p.set("TOWNS", req.TOWNS); p.set("TOWNS_ANY", req.TOWNS_ANY ?? "0"); }
  if (req.CHECKIN_BEG) p.set("CHECKIN_BEG", ddmmmyyyyToYmd(req.CHECKIN_BEG));
  if (req.CHECKIN_END) p.set("CHECKIN_END", ddmmmyyyyToYmd(req.CHECKIN_END));
  if (req.NIGHTS_FROM) p.set("NIGHTS_FROM", req.NIGHTS_FROM);
  if (req.NIGHTS_TILL) p.set("NIGHTS_TILL", req.NIGHTS_TILL);
  if (req.ADULT) p.set("ADULT", req.ADULT);
  if (req.CHILD) p.set("CHILD", req.CHILD);
  p.set("CURRENCY", req.CURRENCY);
  p.set("MEALS_ANY", req.MEALS_ANY);
  p.set("MEALS", req.MEALS ?? "");
  p.set("ROOMS_ANY", req.ROOMS_ANY);
  p.set("ROOMS", req.ROOMS ?? "");
  p.set("HOTELS_ANY", req.HOTELS_ANY);
  if (req.HOTELS) p.set("HOTELS", req.HOTELS);
  p.set("FREIGHT", req.FREIGHT);
  p.set("FILTER", req.FILTER);
  p.set("MOMENT_CONFIRM", "0");
  p.set("hotelsearch", "0");
  if (useTowns) {
    p.set("STARS_ANY", req.STARS ? "0" : "1");
    p.set("STARS", req.STARS ?? "");
    p.set("HOTELTYPES", "");
  } else {
    // §STARS: native form parity — always send both params: a category is
    // STARS=<ids>&STARS_ANY=0, "any category" is STARS=&STARS_ANY=1
    // (same shape as KOMPAS/KazUnion native requests).
    p.set("STARS", req.STARS ?? "");
    p.set("STARS_ANY", req.STARS ? "0" : "1");
    p.set("PARTITION_PRICE", "0");
    p.set("PRICEPAGE", "1");
    p.set("DYN_SEPARATE", "1");
  }
  p.set("rev", String(Math.floor(Math.random() * 1e9)));
  p.set("_", String(Date.now()));
  return `https://summertour.az/search_tour?${p.toString()}`;
}
