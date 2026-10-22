import {
  buildVoyagerPricesParams,
  buildVoyagerPricesUrl,
  buildVoyagerHotelPricesParams,
  buildVoyagerHotelPricesUrl,
  buildVoyagerHotelFormUrl,
  toSamodate,
  VOYAGER_REV,
  VOYAGER_TOWN_FROM_BAKU,
} from "./voyager.request-builder";

/**
 * Voyager request-builder tests — the param contract mirrors the supplier's
 * own PRICES request (captured live 2026-10-21): CURRENCY=2 (USD), TOWNFROMINC
 * =34 (Баку), TOURINC=0 → all programs of the country, PRICEPAGE pagination,
 * rev=4091891869 (verified accepted).
 */

describe("Voyager request builder", () => {
  const base = {
    stateInc: "33", // Малайзия
    checkInBeg: "2026-11-05",
    checkInEnd: "2026-11-12",
  };

  it("converts ISO dates to SAMO YYYYMMDD", () => {
    expect(toSamodate("2026-11-05")).toBe("20261105");
  });

  it("builds the verified default contract (USD, Baku, any program)", () => {
    const p = buildVoyagerPricesParams({ ...base, adults: 2 }, 1);
    expect(p.TOWNFROMINC).toBe(VOYAGER_TOWN_FROM_BAKU);
    expect(p.TOWNFROMINC).toBe("34");
    expect(p.STATEINC).toBe("33");
    expect(p.TOURINC).toBe("0"); // engine fan-out over all programs
    expect(p.CHECKIN_BEG).toBe("20261105");
    expect(p.CHECKIN_END).toBe("20261112");
    expect(p.NIGHTS_FROM).toBe("3"); // default min
    expect(p.NIGHTS_TILL).toBe("14"); // default max (verified options 1..14)
    expect(p.ADULT).toBe("2");
    expect(p.CHILD).toBe("0");
    // CURRENCY=2 (USD) — the ONLY code Voyager prices in (verified live).
    expect(p.CURRENCY).toBe("2");
    expect(p.PRICEPAGE).toBe("1");
    expect(p.DOLOAD).toBe("1");
    expect(p.rev).toBe(VOYAGER_REV);
    expect(p.FREIGHT).toBe("1");
    expect(p.FILTER).toBe("1");
  });

  it("sets *_ANY=1 when no filter is given", () => {
    const p = buildVoyagerPricesParams({ ...base }, 1);
    expect(p.HOTELS_ANY).toBe("1");
    expect(p.HOTELS).toBe("");
    expect(p.MEALS_ANY).toBe("1");
    expect(p.MEALS).toBe("");
    expect(p.STARS_ANY).toBe("1");
    expect(p.STARS).toBe("");
    expect(p.TOWNS_ANY).toBe("1");
    expect(p.TOWNS).toBe("");
    expect(p.ROOMS_ANY).toBe("1");
    expect(p.ROOMS).toBe("");
  });

  it("flips *_ANY=0 when a filter is given", () => {
    const p = buildVoyagerPricesParams(
      { ...base, starsKey: "10012", mealKey: "10002", townsCsv: "403, 413", hotelsCsv: "23597" },
      1,
    );
    expect(p.STARS).toBe("10012");
    expect(p.STARS_ANY).toBe("0");
    expect(p.MEALS).toBe("10002");
    expect(p.MEALS_ANY).toBe("0");
    // Whitespace in the CSV is normalized BEFORE the ANY decision.
    expect(p.TOWNS).toBe("403,413");
    expect(p.TOWNS_ANY).toBe("0");
    expect(p.HOTELS).toBe("23597");
    expect(p.HOTELS_ANY).toBe("0");
  });

  it("treats a whitespace-only CSV as «no filter»", () => {
    const p = buildVoyagerPricesParams({ ...base, townsCsv: "   " }, 1);
    expect(p.TOWNS_ANY).toBe("1");
    expect(p.TOWNS).toBe("");
  });

  it("passes the AGES CSV of all children", () => {
    const p = buildVoyagerPricesParams({ ...base, children: 3, childAges: [1, 5, 11] }, 1);
    expect(p.CHILD).toBe("3");
    expect(p.AGES).toBe("1,5,11");
  });

  it("omits AGES when there are no children", () => {
    const p = buildVoyagerPricesParams({ ...base, children: 0 }, 1);
    expect(p.AGES).toBeUndefined();
  });

  it("pins an explicit TOURINC program when given", () => {
    const p = buildVoyagerPricesParams({ ...base, tourInc: "2993" }, 1);
    expect(p.TOURINC).toBe("2993");
  });

  it("builds a full URL with encoded params", () => {
    const url = buildVoyagerPricesUrl({ ...base, children: 2, childAges: [4, 8] }, 2);
    expect(url.startsWith("https://online.voyagergroup.az/search_tour?")).toBe(true);
    expect(url).toContain("PRICEPAGE=2");
    expect(url).toContain("AGES=4%2C8");
  });
});

describe("Voyager HOTEL request builder (stay-only /search_hotel)", () => {
  // The owner's own PRICES request, captured live 2026-10-22 (MY + program
  // «Малайзия. Только проживание», 2 adults + 3 kids, USD).
  const base = {
    stateInc: "33",
    checkInBeg: "2026-10-22",
    checkInEnd: "2026-10-23",
  };

  it("mirrors the verified stay contract: no TOWNFROMINC, FILTER=0, stay flags", () => {
    const p = buildVoyagerHotelPricesParams(
      { ...base, adults: 2, children: 3, childAges: [1, 5, 11], tourInc: "641", nightsFrom: 5, nightsTill: 14 },
      1,
    );
    // Stay form has NO departure city — never send TOWNFROMINC/FREIGHT.
    expect(p.TOWNFROMINC).toBeUndefined();
    expect(p.FREIGHT).toBeUndefined();
    expect(p.STATEINC).toBe("33");
    expect(p.TOURINC).toBe("641");
    expect(p.samo_action).toBe("PRICES");
    // Check-in range + nights range (verified form bounds 1..30).
    expect(p.CHECKIN_BEG).toBe("20261022");
    expect(p.CHECKIN_END).toBe("20261023");
    expect(p.NIGHTS_FROM).toBe("5");
    expect(p.NIGHTS_TILL).toBe("14");
    expect(p.ADULT).toBe("2");
    expect(p.CHILD).toBe("3");
    expect(p.AGES).toBe("1,5,11");
    expect(p.CURRENCY).toBe("2");
    // The form defaults of the owner's captured request.
    expect(p.FILTER).toBe("0");
    expect(p.CHILD_IN_BED).toBe("0");
    expect(p.MOMENT_CONFIRM).toBe("0");
    expect(p.DYN_SEPARATE).toBe("1");
    expect(p.townssearch).toBe("0");
    expect(p.hotelsearch).toBe("0");
    expect(p.UFILTER).toBe("");
    expect(p.HOTELTYPES).toBe("");
    expect(p.rev).toBe(VOYAGER_REV);
  });

  it("defaults TOURINC to 0 (engine fans out every program — verified live)", () => {
    const p = buildVoyagerHotelPricesParams(base, 1);
    expect(p.TOURINC).toBe("0");
  });

  it("defaults nights to 1..30 (verified form bounds)", () => {
    const p = buildVoyagerHotelPricesParams(base, 1);
    expect(p.NIGHTS_FROM).toBe("1");
    expect(p.NIGHTS_TILL).toBe("30");
  });

  it("flips *_ANY=0 when a filter is given and paginates with DOLOAD=1", () => {
    const p = buildVoyagerHotelPricesParams(
      { ...base, starsKey: "10012", mealKey: "10002", townsCsv: "51457", hotelsCsv: "25110" },
      2,
    );
    expect(p.STARS).toBe("10012");
    expect(p.STARS_ANY).toBe("0");
    expect(p.MEALS).toBe("10002");
    expect(p.MEALS_ANY).toBe("0");
    expect(p.TOWNS).toBe("51457");
    expect(p.TOWNS_ANY).toBe("0");
    expect(p.HOTELS).toBe("25110");
    expect(p.HOTELS_ANY).toBe("0");
    // Page 2 without DOLOAD=1 replays page 1 (verified live 2026-10-22).
    expect(p.PRICEPAGE).toBe("2");
    expect(p.DOLOAD).toBe("1");
  });

  it("builds the stay-form URL and the dictionary form URL", () => {
    const url = buildVoyagerHotelPricesUrl({ ...base, adults: 2 }, 1);
    expect(url.startsWith("https://online.voyagergroup.az/search_hotel?")).toBe(true);
    expect(url).toContain("PRICEPAGE=1");
    expect(buildVoyagerHotelFormUrl("13")).toBe(
      "https://online.voyagergroup.az/search_hotel?STATEINC=13",
    );
  });
});
