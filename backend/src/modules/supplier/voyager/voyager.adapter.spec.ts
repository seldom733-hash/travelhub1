import { VoyagerAdapter } from "./voyager.adapter";
import type { VoyagerHttpService, VoyagerDictionary } from "./voyager-http.service";
import type { VoyagerOfferRow } from "./voyager.response-parser";

/**
 * Voyager adapter tests — HTTP is mocked; the row shape mirrors the real
 * price_info row captured live 2026-10-21 (see voyager.response-parser.spec
 * for the full row fixture).
 */

function row(overrides: Partial<VoyagerOfferRow> = {}): VoyagerOfferRow {
  return {
    hotelKey: "23597",
    spoKey: "630141",
    tourKey: "2993",
    mealKey: "4",
    roomKey: "24593",
    nights: 5,
    checkIn: "20261022",
    adults: 3,
    children: 1,
    claim: "0x430A0000000E00000000220000002100000BB1000000002986449",
    hotel: "Metro Hotel @ KL Sentral 2*",
    price: 4456,
    currency: "USD",
    departureDateText: "22.10.2026",
    transport: "Эконом",
    roomText: "Family Triple / 3ADL+CHD(5-11,99)E-BED",
    mealText: "BB",
    tourText: "Baku-Kuala Lumpur (Malaysia/Air Arabia)",
    seatsAvailable: true,
    stopSale: false,
    ...overrides,
  };
}

const DICT: VoyagerDictionary = {
  states: [
    { value: "33", name: "Малайзия" },
    { value: "13", name: "ОАЭ" },
  ],
  programs: [],
  meals: [
    { value: "10001", name: "AI" },
    { value: "10002", name: "BB" },
  ],
  towns: [
    { value: "403", name: "Kuala Lumpur" },
    { value: "413", name: "Borneo" },
  ],
  stars: [
    { value: "10011", name: "4*" },
    { value: "10012", name: "5*" },
  ],
  hotels: [],
};

interface MockHttp {
  fetchDictionary: jest.Mock;
  fetchPrices: jest.Mock;
}

function makeAdapter(rows: VoyagerOfferRow[] = [row()]): { adapter: VoyagerAdapter; http: MockHttp } {
  const http: MockHttp = {
    fetchDictionary: jest.fn().mockResolvedValue(DICT),
    fetchPrices: jest.fn().mockResolvedValue(rows),
  };
  const adapter = new VoyagerAdapter(http as unknown as VoyagerHttpService);
  return { adapter, http };
}

describe("VoyagerAdapter", () => {
  describe("search", () => {
    it("resolves the country via the static STATEINC dictionary and normalizes rows", async () => {
      const { adapter, http } = makeAdapter();
      const offers = await adapter.search({
        adults: 2,
        country: "MY",
        departureDateFrom: "2026-11-05",
        departureDateTo: "2026-11-12",
        nightsFrom: 7,
        nightsTo: 7,
      });

      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          stateInc: "33",
          tourInc: undefined, // engine fan-out: no TOURINC pin
          checkInBeg: "2026-11-05",
          checkInEnd: "2026-11-12",
          nightsFrom: 7,
          nightsTill: 7,
          adults: 2,
        }),
        5, // UI default maxPages
      );
      expect(offers).toHaveLength(1);
      const o = offers[0];
      expect(o.supplierCode).toBe("VOYAGER");
      expect(o.hotel).toBe("Metro Hotel @ KL Sentral 2*");
      expect(o.departureDate).toBe("2026-10-22");
      expect(o.nights).toBe(5);
      expect(o.price.amount).toBe(4456);
      expect(o.price.currency).toBe("USD");
      expect(o.availability).toBe("AVAILABLE"); // fr_place markers
      expect(o.transport).toBe("Эконом");
      expect(o.meal).toBe("BB");
      expect(o.country).toBe("Малайзия");
      expect(o.externalOfferId).toBe("630141-23597-20261022-24593-4");
    });

    it("accepts ru/en country aliases", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({ adults: 2, country: "ОАЭ" });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ stateInc: "13" }),
        expect.any(Number),
      );

      await adapter.search({ adults: 2, country: "Malaysia" });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ stateInc: "33" }),
        expect.any(Number),
      );
    });

    it("skips the supplier honestly for an unsupported country", async () => {
      const { adapter, http } = makeAdapter();
      const offers = await adapter.search({ adults: 2, country: "TR" });
      expect(offers).toEqual([]);
      expect(http.fetchPrices).not.toHaveBeenCalled();
    });

    it("maps «5*» to the verified STARS id 10012", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({ adults: 2, country: "MY", hotelStars: ["5*"] });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ starsKey: "10012" }),
        expect.any(Number),
      );
    });

    it("drops a star label with no Voyager equivalent («HV-1») instead of sending a wrong id", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({ adults: 2, country: "MY", hotelStars: ["HV-1"] });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ starsKey: undefined }),
        expect.any(Number),
      );
    });

    it("prefers supplier-native starKeys over labels", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({
        adults: 2,
        country: "MY",
        hotelStars: ["5*"],
        starKeys: { VOYAGER: "10009,10012" },
      });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ starsKey: "10009" }),
        expect.any(Number),
      );
    });

    it("maps meal codes via the verified MEALS dictionary", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({ adults: 2, country: "MY", meal: "BB" });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ mealKey: "10002" }),
        expect.any(Number),
      );
    });

    it("passes the TOWNS csv and AGES csv through", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({
        adults: 2,
        country: "MY",
        towns: "403,413",
        children: 2,
        childAges: [4, 9],
      });
      expect(http.fetchPrices).toHaveBeenCalledWith(
        expect.objectContaining({ townsCsv: "403,413", children: 2, childAges: [4, 9] }),
        expect.any(Number),
      );
    });

    it("dedupes identical rows", async () => {
      const { adapter } = makeAdapter([row(), row(), row({ spoKey: "630142" })]);
      const offers = await adapter.search({ adults: 2, country: "MY" });
      expect(offers).toHaveLength(2);
    });

    it("keeps stop-sale rows as NOT_AVAILABLE (never AVAILABLE)", async () => {
      const { adapter } = makeAdapter([row({ stopSale: true, seatsAvailable: false })]);
      const offers = await adapter.search({ adults: 2, country: "MY" });
      expect(offers[0].availability).toBe("NOT_AVAILABLE");
    });

    it("marks rows without seat markers as UNKNOWN (honest)", async () => {
      const { adapter } = makeAdapter([row({ seatsAvailable: false })]);
      const offers = await adapter.search({ adults: 2, country: "MY" });
      expect(offers[0].availability).toBe("UNKNOWN");
    });
  });

  describe("getOffer / refreshPrice / refreshAvailability", () => {
    const ref = {
      supplierCode: "VOYAGER",
      externalOfferId: "630141-23597-20261022-24593-4",
      searchContext: { adults: 2, country: "MY" },
    };

    it("getOffer returns the found offer", async () => {
      const { adapter } = makeAdapter();
      const detail = await adapter.getOffer(ref);
      expect(detail.hotel).toBe("Metro Hotel @ KL Sentral 2*");
    });

    it("getOffer throws the controlled PRICE_UNAVAILABLE error when gone", async () => {
      const { adapter } = makeAdapter([row({ spoKey: "999" })]);
      await expect(adapter.getOffer(ref)).rejects.toThrow(/PRICE_UNAVAILABLE|not found/i);
    });

    it("refreshPrice returns the fresh price snapshot", async () => {
      const { adapter } = makeAdapter([row({ price: 5000 })]);
      const snap = await adapter.refreshPrice(ref);
      expect(snap.amount).toBe(5000);
      expect(snap.currency).toBe("USD");
    });

    it("refreshAvailability reports NOT_AVAILABLE when the offer vanished", async () => {
      const { adapter } = makeAdapter([row({ spoKey: "999" })]);
      const snap = await adapter.refreshAvailability(ref);
      expect(snap.availability).toBe("NOT_AVAILABLE");
    });
  });

  describe("getPriceCalendar", () => {
    it("groups rows by departure date, cheapest first, with bestOfferRef", async () => {
      const { adapter } = makeAdapter([
        row({ checkIn: "20261105", departureDateText: "05.11.2026", price: 5000, spoKey: "1" }),
        row({ checkIn: "20261105", departureDateText: "05.11.2026", price: 4400, spoKey: "2" }),
        row({ checkIn: "20261107", departureDateText: "07.11.2026", price: 4700, spoKey: "3" }),
      ]);
      const cal = await adapter.getPriceCalendar({
        supplierCode: "VOYAGER",
        adults: 2,
        country: "MY",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-10",
        nights: 7,
      });

      expect(cal.supplierCode).toBe("VOYAGER");
      expect(cal.entries).toHaveLength(2);
      const first = cal.entries[0];
      expect(first.date).toBe("2026-11-05");
      expect(first.price).toBe(4400); // cheapest of the date
      expect(first.offerCount).toBe(2);
      expect(first.bestOfferRef?.externalOfferId).toBe("2-23597-20261105-24593-4");
      expect(cal.entries[1].date).toBe("2026-11-07");
      expect(cal.totalOffersScanned).toBe(3);
    });

    it("returns an empty calendar for an unsupported country", async () => {
      const { adapter, http } = makeAdapter();
      const cal = await adapter.getPriceCalendar({
        supplierCode: "VOYAGER",
        adults: 2,
        country: "TR",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-10",
        nights: 7,
      });
      expect(cal.entries).toEqual([]);
      expect(cal.totalOffersScanned).toBe(0);
      expect(http.fetchPrices).not.toHaveBeenCalled();
    });
  });

  describe("discoverGeoOptions", () => {
    it("returns TOWN + STAR options from the dictionary", async () => {
      const { adapter } = makeAdapter();
      const opts = await adapter.discoverGeoOptions("33");
      const towns = opts.filter((o) => o.kind === "TOWN");
      const stars = opts.filter((o) => o.kind === "STAR");
      expect(towns.map((o) => o.externalId)).toEqual(["403", "413"]);
      expect(stars.map((o) => o.label)).toEqual(["4*", "5*"]);
      expect(towns[0].countryExternalId).toBe("33");
    });
  });
});
