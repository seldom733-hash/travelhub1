import { VoyagerHotelAdapter, parseHotelStars } from "./voyager-hotel.adapter";
import type { VoyagerHttpService, VoyagerDictionary } from "./voyager-http.service";
import type { VoyagerOfferRow } from "./voyager.response-parser";

/**
 * Voyager HOTEL adapter tests — HTTP is mocked; the row shape mirrors the
 * real stay-only price_info row captured live 2026-10-22 (owner's own
 * request: STATEINC=33/MY + TOURINC=641, hotel «Malibest Resort 2*
 * (Langkawi)» — the trailing parenthetical is the TOWN on stay rows).
 */

function row(overrides: Partial<VoyagerOfferRow> = {}): VoyagerOfferRow {
  return {
    hotelKey: "25110",
    spoKey: "1210222",
    tourKey: "641",
    mealKey: "99",
    roomKey: "32453",
    nights: 7,
    checkIn: "20261022",
    adults: 2,
    children: 0,
    claim: "0x430A0000000E00000000220000002100000BB1000000002986449",
    hotel: "Malibest Resort 2*",
    hotelCity: "Langkawi",
    price: 1200,
    currency: "USD",
    departureDateText: "22.10.2026",
    transport: "Эконом",
    roomText: "Roadside Twin / 2ADL+CHD(5-12,99)NO E-BED",
    mealText: "ONLY ROOM",
    tourText: "Малайзия. Только проживание",
    seatsAvailable: true,
    stopSale: false,
    ...overrides,
  };
}

const DICT: VoyagerDictionary = {
  states: [
    { value: "14", name: "Азербайджан" },
    { value: "15", name: "Грузия" },
    { value: "42", name: "Индонезия" },
    { value: "12", name: "Кыргызстан" },
    { value: "61", name: "Республика Маврикий" },
    { value: "49", name: "Узбекистан" },
    { value: "13", name: "ОАЭ" },
    { value: "33", name: "Малайзия" },
  ],
  programs: [{ value: "641", name: "Малайзия. Только проживание" }],
  meals: [
    { value: "10001", name: "AI" },
    { value: "10002", name: "BB" },
    { value: "99", name: "ONLY ROOM" },
  ],
  towns: [
    { value: "51457", name: "Langkawi" },
    { value: "23", name: "Kuala Lumpur" },
  ],
  stars: [
    { value: "10009", name: "2*" },
    { value: "10012", name: "5*" },
  ],
  hotels: [],
};

interface MockHttp {
  fetchHotelDictionary: jest.Mock;
  fetchHotelPrices: jest.Mock;
}

function makeAdapter(rows: VoyagerOfferRow[] = [row()]): {
  adapter: VoyagerHotelAdapter;
  http: MockHttp;
} {
  const http: MockHttp = {
    fetchHotelDictionary: jest.fn().mockResolvedValue(DICT),
    fetchHotelPrices: jest.fn().mockResolvedValue(rows),
  };
  const adapter = new VoyagerHotelAdapter(http as unknown as VoyagerHttpService);
  return { adapter, http };
}

describe("VoyagerHotelAdapter", () => {
  describe("parseHotelStars", () => {
    it("parses a trailing star count from a hotel name", () => {
      expect(parseHotelStars("Malibest Resort 2*")).toBe(2);
      expect(parseHotelStars("Rixos Jumeirah Beach 5*")).toBe(5);
    });
    it("returns null when no stars are present", () => {
      expect(parseHotelStars("Hotel Langkawi")).toBeNull();
    });
  });

  describe("search", () => {
    it("resolves via the hotel-form dictionary and calls /search_hotel", async () => {
      const { adapter, http } = makeAdapter();
      const offers = await adapter.search({
        service: "hotels",
        adults: 2,
        country: "MY",
        departureDateFrom: "2026-10-22",
        departureDateTo: "2026-10-23",
        nightsFrom: 7,
        nightsTo: 7,
      });

      expect(http.fetchHotelDictionary).toHaveBeenCalledWith("33");
      expect(http.fetchHotelPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          stateInc: "33",
          tourInc: undefined, // engine fan-out
          checkInBeg: "2026-10-22",
          checkInEnd: "2026-10-23",
          nightsFrom: 7,
          nightsTill: 7,
          adults: 2,
        }),
        5, // UI default maxPages
      );
      expect(offers).toHaveLength(1);
      const o = offers[0];
      expect(o.service).toBe("hotels");
      expect(o.supplierCode).toBe("VOYAGER");
      expect(o.hotel).toBe("Malibest Resort 2*");
      expect(o.hotelExternalId).toBe("25110");
      expect(o.departureDate).toBe("2026-10-22");
      expect(o.nights).toBe(7);
      expect(o.price.amount).toBe(1200);
      expect(o.price.currency).toBe("USD");
      expect(o.country).toBe("Малайзия");
      // The stay row's trailing parenthetical is the TOWN («(Langkawi)»).
      expect(o.destination).toBe("Langkawi");
      expect(o.rawMetadata?.stars).toBe(2);
      expect(o.externalOfferId).toContain("VOYAGERHTL");
    });

    it("serves the 6 hotel-only countries absent from the tour dictionary", async () => {
      for (const [country, stateInc] of [
        ["AZ", "14"],
        ["GE", "15"],
        ["ID", "42"],
        ["KG", "12"],
        ["MU", "61"],
        ["UZ", "49"],
      ] as const) {
        const { adapter, http } = makeAdapter();
        await adapter.search({ service: "hotels", adults: 2, country });
        expect(http.fetchHotelPrices).toHaveBeenCalledWith(
          expect.objectContaining({ stateInc }),
          expect.any(Number),
        );
      }
    });

    it("skips the supplier honestly for a country outside the hotel dictionary", async () => {
      const { adapter, http } = makeAdapter();
      const offers = await adapter.search({ service: "hotels", adults: 2, country: "TR" });
      expect(offers).toEqual([]);
      expect(http.fetchHotelPrices).not.toHaveBeenCalled();
    });

    it("clamps nights to the verified stay bounds 1..30", async () => {
      const { adapter, http } = makeAdapter();
      await adapter.search({ service: "hotels", adults: 2, country: "MY", nightsFrom: 45, nightsTo: 45 });
      expect(http.fetchHotelPrices).toHaveBeenCalledWith(
        expect.objectContaining({ nightsFrom: 30, nightsTill: 30 }),
        expect.any(Number),
      );
    });

    it("drops rows whose occupancy does not match the request", async () => {
      const { adapter } = makeAdapter([
        row(), // 2 adults + 2 children — matches
        row({ adults: 3, children: 0 }), // 3 adults — mismatch
      ]);
      const offers = await adapter.search({
        service: "hotels",
        adults: 2,
        children: 2,
        country: "MY",
      });
      expect(offers).toHaveLength(1);
      expect(offers[0].adults).toBe(2);
    });

    it("passes an explicit hotel id upstream (HOTELS filter) and locally", async () => {
      const { adapter, http } = makeAdapter([
        row(),
        row({ hotelKey: "25999", hotel: "Other Resort 4*" }),
      ]);
      const offers = await adapter.search({
        service: "hotels",
        adults: 2,
        country: "MY",
        hotelExternalId: "25110",
      });
      expect(http.fetchHotelPrices).toHaveBeenCalledWith(
        expect.objectContaining({ hotelsCsv: "25110" }),
        expect.any(Number),
      );
      expect(offers).toHaveLength(1);
      expect(offers[0].hotelExternalId).toBe("25110");
    });

    it("filters by hotel name locally when no id is given", async () => {
      const { adapter } = makeAdapter([
        row(),
        row({ hotelKey: "25999", hotel: "Grand Palace 5*" }),
      ]);
      const offers = await adapter.search({
        service: "hotels",
        adults: 2,
        country: "MY",
        hotel: "Malibest",
      });
      expect(offers).toHaveLength(1);
      expect(offers[0].hotel).toBe("Malibest Resort 2*");
    });
  });

  describe("getPriceCalendar", () => {
    it("maps rows into dated entries and reports the scan count", async () => {
      const { adapter, http } = makeAdapter([row(), row({ checkIn: "20261023", departureDateText: "23.10.2026", price: 900 })]);
      http.fetchHotelPrices.mockResolvedValue([row(), row({ checkIn: "20261023", departureDateText: "23.10.2026", price: 900 })]);

      const result = await adapter.getPriceCalendar({
        supplierCode: "VOYAGER",
        adults: 2,
        country: "MY",
        dateFrom: "2026-10-22",
        dateTo: "2026-10-23",
        nights: 7,
      });

      expect(result.supplierCode).toBe("VOYAGER");
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].date).toBe("2026-10-22");
      expect(result.entries[0].price).toBe(1200);
      expect(result.entries[1].date).toBe("2026-10-23");
      expect(result.entries[1].price).toBe(900);
      expect(result.totalOffersScanned).toBe(2);
      expect(result.entries[0].bestOfferRef?.searchContext.service).toBe("hotels");
    });

    it("returns an empty result for an unsupported country (no fake prices)", async () => {
      const { adapter, http } = makeAdapter();
      const result = await adapter.getPriceCalendar({
        supplierCode: "VOYAGER",
        adults: 2,
        country: "TR",
        dateFrom: "2026-10-22",
        dateTo: "2026-10-23",
        nights: 7,
      });
      expect(result.entries).toEqual([]);
      expect(http.fetchHotelPrices).not.toHaveBeenCalled();
    });
  });
});
