/**
 * Summer Request Builder — TravelHub generic → Summertour SAMO params.
 *
 * Maps only proven Summer mappings per Tests 1-11.
 * STARS mapping NOT PROVEN — left empty / extensible.
 */

export interface SummerSearchRequest {
  TOWNFROMINC: string; // 1930 Baku
  STATEINC: string; // 9 Turkey
  TOURINC: string; // program, e.g. 229
  TOWNS?: string; // resort, e.g. 1948 Bogazkent (Test 4)
  TOWNS_ANY?: string;
  HOTELS?: string; // hotelKey, e.g. 885
  HOTELS_ANY: string; // 0 when HOTELS set, 1 otherwise
  CHECKIN_BEG?: string; // DD.MM.YYYY
  CHECKIN_END?: string;
  NIGHTS_FROM?: string;
  NIGHTS_TILL?: string;
  ADULT?: string;
  CHILD?: string;
  AGE1?: string;
  AGE2?: string;
  AGE3?: string;
  MEALS_ANY: string;
  MEALS?: string; // mealKey, e.g. 4 BB (Test 9)
  ROOMS_ANY: string;
  ROOMS?: string;
  FREIGHT: string; // 0/1 flight seats filter (Test 10)
  FILTER: string; // 0/1 stop-sale filter (Test 11)
  CURRENCY: string; // 2 USD
  PARTITION_PRICE?: string;
}

const SUMMER_TOWNFROMINC = "1930";
const SUMMER_STATEINC = "9";

function isoToSamodate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

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
  meal?: string; // mealKey numeric string
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
