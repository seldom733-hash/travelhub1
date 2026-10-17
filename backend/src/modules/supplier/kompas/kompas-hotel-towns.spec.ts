import { KompasSupplierAdapter, KompasHotelRawRow } from "./kompas.adapter";
import { KompasHotelAdapter } from "./kompas-hotel.adapter";
import type { SupplierSearchQuery } from "../supplier.types";

/**
 * KOMPAS hotels TOWNS wiring + city-channel precedence (locks both ends):
 *
 * URL end — buildHotelPricesUrl injects TOWNS=<csv>&TOWNS_ANY=0 when the
 * aggregator resolved Master Geography town ids, and keeps the form default
 * TOWNS_ANY=1 for a country-level search. Verified probe (2026-10-13):
 * TOWNS=941 (Батуми, discovered on search_tour) → search_hotel PRICES returns
 * rows city=Батуми only — the id space is SHARED between the two forms.
 *
 * Filter end — applyLocalFilters precedence: upstream `towns` → no local city
 * filter (group labels like «Аджария» are not row cities); else `townNames`
 * name channel (norm+translit, same as ANEX); else free-text `destination`
 * with the country-level skip («Грузия» must not drop every row).
 */

function row(partial: Partial<KompasHotelRawRow>): KompasHotelRawRow {
  return {
    stateInc: "30",
    hotelKey: "50183",
    tourKey: "0",
    spoKey: "0",
    mealKey: "0",
    roomKey: "0",
    nights: 3,
    checkIn: "20261110",
    adults: 2,
    children: 0,
    hotelName: "ANIKO 3*",
    city: "Батуми",
    meal: "BB",
    room: "DBL",
    price: 300,
    currency: "USD",
    hotelHref: "",
    ...partial,
  };
}

describe("KOMPAS hotels TOWNS precision (buildHotelPricesUrl)", () => {
  const adapter = new KompasSupplierAdapter();
  const build = (towns?: string) =>
    (
      adapter as unknown as {
        buildHotelPricesUrl(
          o: {
            stateInc: string;
            checkInBeg: string;
            checkInEnd: string;
            nightsFrom: number;
            nightsTo: number;
            adults: number;
            children: number;
            towns?: string;
          },
          p: number,
        ): string;
      }
    ).buildHotelPricesUrl(
      {
        stateInc: "30",
        checkInBeg: "20261110",
        checkInEnd: "20261110",
        nightsFrom: 3,
        nightsTo: 3,
        adults: 2,
        children: 0,
        ...(towns ? { towns } : {}),
      },
      1,
    );

  it("injects TOWNS=<csv>&TOWNS_ANY=0 when towns are provided", () => {
    const url = build("941,180");
    expect(url).toContain("TOWNS_ANY=0");
    expect(url).toContain("TOWNS=941%2C180");
    expect(url).not.toContain("TOWNS_ANY=1");
  });

  it("keeps the form default TOWNS_ANY=1 for a country-level search", () => {
    const url = build();
    expect(url).toContain("TOWNS_ANY=1");
    expect(url).toContain("townssearch=0&TOWNS=&");
  });

  it("trims stray whitespace from the ids CSV", () => {
    const url = build(" 941 , 180 ");
    expect(url).toContain("TOWNS=941%20%2C%20180");
  });

  it("requests the prices in AZN (§AZN CURRENCY=13, never the form default USD)", () => {
    const url = build();
    expect(url).toContain("CURRENCY=13");
    expect(url).not.toContain("CURRENCY=2&");
  });
});

describe("KOMPAS hotels city-channel precedence (applyLocalFilters)", () => {
  const adapter = new KompasHotelAdapter({} as KompasSupplierAdapter);
  const filter = (rows: KompasHotelRawRow[], query: Partial<SupplierSearchQuery>) =>
    (
      adapter as unknown as {
        applyLocalFilters(r: KompasHotelRawRow[], q: SupplierSearchQuery, s: string): KompasHotelRawRow[];
      }
    ).applyLocalFilters(rows, query as SupplierSearchQuery, "30");

  it("towns ids → skips the local city filter (upstream TOWNS already narrowed)", () => {
    const out = filter([row({ city: "Тбилиси" }), row({ city: "Кутаиси" })], {
      towns: "941",
      destination: "Батуми",
    });
    expect(out).toHaveLength(2);
  });

  it("townNames → name channel keeps only matching row cities", () => {
    const out = filter([row({ city: "Батуми" }), row({ city: "Тбилиси" })], {
      townNames: ["Батуми"],
      destination: "Батуми",
    });
    expect(out.map((r) => r.city)).toEqual(["Батуми"]);
  });

  it("townNames → transliteration bridges «Гёйнюк» (label) and «Гойнюк» (row)", () => {
    const out = filter([row({ city: "Гойнюк" }), row({ city: "Стамбул" })], {
      townNames: ["Гёйнюк"],
    });
    expect(out.map((r) => r.city)).toEqual(["Гойнюк"]);
  });

  it("rows without a city survive the name channel (cannot disprove)", () => {
    const out = filter([row({ city: "" }), row({ city: "Тбилиси" })], {
      townNames: ["Батуми"],
    });
    expect(out.map((r) => r.city)).toEqual([""]);
  });

  it("free-text destination filters by city (no geo channels present)", () => {
    const out = filter([row({ city: "Батуми" }), row({ city: "Тбилиси" })], {
      destination: "Батуми",
    });
    expect(out.map((r) => r.city)).toEqual(["Батуми"]);
  });

  it("country-level destination («Грузия»/GE) does NOT drop row cities", () => {
    const out = filter([row({ city: "Батуми" }), row({ city: "Тбилиси" })], {
      destination: "Грузия",
      country: "GE",
    });
    expect(out).toHaveLength(2);
  });

  it("hotelExternalId → upstream HOTELS filter wins, no local city filter", () => {
    const out = filter([row({ city: "Тбилиси" })], {
      hotelExternalId: "50183",
      destination: "Батуми",
    });
    expect(out).toHaveLength(1);
  });
});
