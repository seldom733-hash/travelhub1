/**
 * Summer Request Builder — TravelHub generic → Summertour SAMO params.
 *
 * Maps only proven Summer mappings per Tests 1-11.
 * STARS mapping NOT PROVEN — left empty / extensible.
 */

export interface SummerSearchRequest {
  TOWNFROMINC: string;
  STATEINC: string;
  TOURINC: string;
  TOWNS?: string;
  TOWNS_ANY?: string;
  HOTELS?: string;
  HOTELS_ANY: string;
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
}): SummerSearchRequest {
  const req: SummerSearchRequest = {
    TOWNFROMINC: SUMMER_TOWNFROMINC,
    STATEINC: SUMMER_STATEINC,
    TOURINC: query.tourIncValue ?? "0",
    HOTELS_ANY: query.hotelExternalId ? "0" : "1",
    MEALS_ANY: query.meal ? "0" : "1",
    ROOMS_ANY: "1",
    FREIGHT: query.freight ?? "0",
    FILTER: query.filter ?? "0",
    CURRENCY: "2",
  };
  if (query.towns) {
    req.TOWNS = query.towns;
    req.TOWNS_ANY = "0";
  }
  if (query.hotelExternalId) req.HOTELS = query.hotelExternalId;
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
 * Includes PARTITION_PRICE=32, PRICEPAGE=1, DYN_SEPARATE=1 as proven in Tests 1-11.
 * `rev` and `_` are dynamic cache-busters.
 */
export function buildSummerXhrUrl(req: SummerSearchRequest): string {
  const p = new URLSearchParams();
  p.set("samo_action", "PRICES");
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
  if (req.MEALS) p.set("MEALS", req.MEALS);
  p.set("ROOMS_ANY", req.ROOMS_ANY);
  p.set("HOTELS_ANY", req.HOTELS_ANY);
  if (req.HOTELS) p.set("HOTELS", req.HOTELS);
  p.set("FREIGHT", req.FREIGHT);
  p.set("FILTER", req.FILTER);
  p.set("MOMENT_CONFIRM", "0");
  p.set("PARTITION_PRICE", "32");
  p.set("PRICEPAGE", "1");
  p.set("DYN_SEPARATE", "1");
  p.set("rev", String(Math.floor(Math.random() * 1e9)));
  p.set("_", String(Date.now()));
  return `https://summertour.az/search_tour?${p.toString()}`;
}
