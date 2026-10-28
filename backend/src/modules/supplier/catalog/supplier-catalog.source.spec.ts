import { SupplierCatalogSource } from "./supplier-catalog.source";
import type { SupplierOffer } from "../supplier.types";

const offer = (overrides: Partial<SupplierOffer> = {}): SupplierOffer => ({
  supplierCode: "VOYAGER",
  service: "tours",
  externalOfferId: "o1",
  hotel: "Test Hotel",
  hotelExternalId: "456",
  country: "Thailand",
  departureDate: "2026-11-01",
  nights: 7,
  room: "DBL",
  meal: "AI",
  adults: 2,
  children: 0,
  childAges: [],
  price: { amount: 100, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), source: "VOYAGER", queryHash: "q" },
  availability: "AVAILABLE",
  fetchedAt: new Date(),
  expiresAt: new Date(),
  rawMetadata: { tourKey: "123", tourIncName: "Thailand", hotelKey: "456", stateInc: "23", country: "Thailand" },
  ...overrides,
});

function makeSource(offers: SupplierOffer[]) {
  const anex = { search: jest.fn() };
  const provider = { states: jest.fn().mockResolvedValue([]) };
  const pricing = {
    publicAmountWithFxFor: jest.fn().mockResolvedValue({ amount: 110, currency: "AZN" }),
    publicAmountFor: jest.fn(async (amount: number) => amount),
  };
  const offerService = { search: jest.fn().mockResolvedValue(offers) };
  return new SupplierCatalogSource(anex as never, provider as never, pricing as never, offerService as never);
}

describe("SupplierCatalogSource", () => {
  it("maps Voyager tour offers to the established supplierRef scope", async () => {
    const source = makeSource([offer()]);
    const result = await source.fetch({ supplierCode: "VOYAGER", serviceType: "tours", countryKey: "TH" });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      externalKey: "VOYAGER-123-456",
      productType: "TOUR",
      categorySlug: "tours",
      startingPrice: 110,
      currency: "AZN",
      countryCode: "TH",
    });
    expect(result.records[0].attributes).toMatchObject({
      priceDate: "2026-11-01",
      priceNights: 7,
      priceAdults: 2,
    });
  });

  it("maps hotel identity with state and skips non-positive prices", async () => {
    const source = makeSource([
      offer({ service: "hotels", price: { ...offer().price, amount: 0 } }),
      offer({ service: "hotels", externalOfferId: "o2", rawMetadata: { hotelKey: "456", stateInc: "23" } }),
    ]);
    const result = await source.fetch({ supplierCode: "VOYAGER", serviceType: "hotels", countryKey: "TH" });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].externalKey).toBe("VOYAGERHTL-456-23");
    expect(result.records[0].productType).toBe("HOTEL");
  });

  it("exposes only implemented catalog capabilities", async () => {
    const source = makeSource([]);
    const caps = await source.capabilities();
    expect(caps.map((c) => c.supplierCode)).toEqual(expect.arrayContaining(["ANEX", "VOYAGER", "KOMPAS", "KAZUNION", "SUMMERTOUR", "FSTRAVEL"]));
    expect(caps.find((c) => c.supplierCode === "ANEX" && c.serviceTypes.includes("hotels"))?.unavailableReason).toBeTruthy();
  });

  it("keeps tour and hotel country dictionaries separate", async () => {
    const source = makeSource([]);
    const caps = await source.capabilities();
    const kompasTours = caps.find((c) => c.supplierCode === "KOMPAS" && c.serviceTypes.includes("tours"));
    const kompasHotels = caps.find((c) => c.supplierCode === "KOMPAS" && c.serviceTypes.includes("hotels"));
    const kazunionTours = caps.find((c) => c.supplierCode === "KAZUNION" && c.serviceTypes.includes("tours"));
    const kazunionHotels = caps.find((c) => c.supplierCode === "KAZUNION" && c.serviceTypes.includes("hotels"));
    expect(kompasTours?.countries).toHaveLength(23);
    expect(kompasHotels?.countries).toHaveLength(53);
    expect(kazunionTours?.countries).toHaveLength(8);
    expect(kazunionHotels?.countries).toHaveLength(22);
    expect(kompasTours?.serviceTypes).toEqual(["tours"]);
    expect(kompasHotels?.serviceTypes).toEqual(["hotels"]);
  });

  it("sweeps eleven ANEX weeks date-by-date with six night lengths", async () => {
    const anexSearchCatalog = jest.fn().mockResolvedValue({
      offers: [offer({ supplierCode: "ANEX", service: "tours", hotel: "Hotel", hotelExternalId: "H1" })],
      coverage: {
        pagesFetched: 1,
        pageCount: 1,
        hasMore: false,
        truncated: false,
        programsComplete: true,
        windowsComplete: true,
        errors: [],
      },
    });
    const source = new SupplierCatalogSource(
      { searchCatalog: anexSearchCatalog } as never,
      { states: jest.fn().mockResolvedValue([{ id: 1, name: "Austria", nameAlt: "Austria", stateISO: "AT" }]) } as never,
      {
        publicAmountWithFxFor: jest.fn(),
        publicAmountFor: jest.fn(async (amount: number) => amount),
      } as never,
      {} as never,
    );

    const result = await source.fetch({ supplierCode: "ANEX", serviceType: "tours", countryKey: "AT" });

    expect(anexSearchCatalog).toHaveBeenCalledTimes(77);
    for (const [query] of anexSearchCatalog.mock.calls) {
      expect(query.nightOptions).toEqual([2, 3, 4, 5, 6, 7]);
    }
    expect(result.scope.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
