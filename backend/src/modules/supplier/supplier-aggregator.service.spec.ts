import { SupplierAggregatorService } from "./supplier-aggregator.service";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierOfferService } from "./supplier-offer.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { SupplierSearchQuery, SupplierOffer } from "./supplier.types";

/**
 * Geo-precision contract: when the user picks a Master Geography city
 * (geoCity/geoResort), each supplier must receive a precise city filter
 * (SAMO: TOWNS=<ids>&TOWNS_ANY=0). A supplier without a mapping for the
 * selected city must be SKIPPED — never silently widened to a whole-country
 * search (that is the "страна+город → все туры страны" bug).
 */

function makeOffer(code: string, hotel: string): SupplierOffer {
  const now = new Date();
  return {
    supplierCode: code,
    externalOfferId: `${code}-${hotel}`,
    hotel,
    departureDate: "2026-10-11",
    nights: 3,
    adults: 2,
    children: 0,
    childAges: [],
    price: { amount: 100, currency: "USD", fetchedAt: now, expiresAt: now, queryHash: "", source: code },
    availability: "AVAILABLE",
    fetchedAt: now,
    expiresAt: now,
  };
}

describe("SupplierAggregatorService geo precision (страна+город)", () => {
  let aggregator: SupplierAggregatorService;
  let searchedQueries: SupplierSearchQuery[];
  let searchedSuppliers: string[];
  let mockRegistry: SupplierAdapterRegistry;
  let mockOfferService: { search: jest.Mock };
  let mockPrisma: {
    supplierGeoLink: { findMany: jest.Mock };
    geoCity: { findUnique: jest.Mock };
    geoResort: { findUnique: jest.Mock };
  };

  const adapter = (code: string) =>
    ({
      code,
      name: code,
      enabled: true,
      search: () => Promise.resolve([]),
      getOffer: () => Promise.resolve({} as never),
      refreshPrice: () => Promise.resolve({} as never),
      refreshAvailability: () => Promise.resolve({} as never),
      getPriceCalendar: () => Promise.resolve({} as never),
    }) as never;

  beforeEach(() => {
    searchedQueries = [];
    searchedSuppliers = [];

    const config = (code: string) => ({
      code,
      name: code,
      enabled: true,
      searchEnabled: true,
      livePriceEnabled: true,
      availabilityEnabled: true,
      maxConcurrency: 1,
      requestsPerMinute: 60,
      timeoutMs: 60000,
      searchCacheTtlMs: 300000,
      priceCacheTtlMs: 300000,
      availabilityCacheTtlMs: 300000,
      detailCacheTtlMs: 300000,
      circuitBreakerThreshold: 5,
      circuitBreakerOpenMs: 60000,
    });
    // Entries-based mock: the aggregator resolves candidates via getEntries()
    // (service-aware registration model: one code, one adapter per service).
    const entries = () =>
      ["KOMPAS", "SUMMERTOUR", "KAZUNION"].map((code) => ({
        adapter: adapter(code),
        config: config(code),
      }));
    mockRegistry = {
      getEntries: entries,
      getEnabled: () => entries().map((e) => e.adapter),
      getConfig: (code: string) => config(code),
    } as unknown as SupplierAdapterRegistry;

    mockOfferService = {
      search: jest.fn((code: string, q: SupplierSearchQuery) => {
        searchedSuppliers.push(code);
        searchedQueries.push(q);
        return Promise.resolve([makeOffer(code, `Hotel ${code}`)]);
      }),
    };

    mockPrisma = {
      supplierGeoLink: { findMany: jest.fn().mockResolvedValue([]) },
      geoCity: { findUnique: jest.fn().mockResolvedValue(null) },
      geoResort: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    aggregator = new SupplierAggregatorService(
      mockRegistry,
      mockOfferService as unknown as SupplierOfferService,
      mockPrisma as unknown as PrismaService,
    );
  });

  const baseQuery: SupplierSearchQuery = {
    country: "AE",
    geoCity: "DUBAI",
    adults: 2,
    nightsFrom: 3,
    nightsTo: 3,
  };

  it("passes towns=<ids> to a supplier that has TOWN links for the city", async () => {
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "457", label: "Deira", kind: "TOWN" },
      { supplierCode: "KOMPAS", externalId: "458", label: "Bur Dubai", kind: "TOWN" },
    ]);

    await aggregator.searchByService("tours", baseQuery);

    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(kompasIdx).toBeGreaterThanOrEqual(0);
    expect(searchedQueries[kompasIdx].towns).toBe("457,458");
  });

  it("skips a supplier without any geo link for the selected city (no whole-country fallback)", async () => {
    // Only KOMPAS has links for Дубай; SUMMERTOUR/KAZUNION must not be queried at all.
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "457", label: "Deira", kind: "TOWN" },
    ]);

    const result = await aggregator.searchByService("tours", baseQuery);

    expect(searchedSuppliers).toContain("KOMPAS");
    expect(searchedSuppliers).not.toContain("SUMMERTOUR");
    expect(searchedSuppliers).not.toContain("KAZUNION");
    expect(result.perSupplier["SUMMERTOUR"]).toBeUndefined();
    expect(result.perSupplier["KAZUNION"]).toBeUndefined();
  });

  it("returns NO offers when geo resolution throws (no silent country-wide search)", async () => {
    mockPrisma.supplierGeoLink.findMany.mockRejectedValue(new Error("db down"));

    const result = await aggregator.searchByService("tours", baseQuery);

    expect(result.offers).toHaveLength(0);
    expect(mockOfferService.search).not.toHaveBeenCalled();
  });

  it("queries all candidates normally when no geoCity/geoResort is set (country-level search)", async () => {
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([]);

    // Turkey: KOMPAS, SUMMERTOUR and KAZUNION all pass the capability gate,
    // so the country-level search must reach every one of them.
    await aggregator.searchByService("tours", {
      ...baseQuery,
      country: "TR",
      geoCity: undefined,
    });

    expect(searchedSuppliers).toEqual(expect.arrayContaining(["KOMPAS", "SUMMERTOUR", "KAZUNION"]));
    for (const q of searchedQueries) {
      expect(q.towns).toBeUndefined();
    }
  });

  it("searches WITHOUT a program («Любой») when the supplier only has TOUR links for the city", async () => {
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "3706", label: "AE: Дубай из Баку (GDS: AZAL)", kind: "TOUR" },
    ]);

    await aggregator.searchByService("tours", baseQuery);

    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(kompasIdx).toBeGreaterThanOrEqual(0);
    // The legacy TOURINC fan-out pinned the search to the programs stored at
    // ingest time; when the supplier re-numbered its programs those ids went
    // stale and the search silently returned nothing. No program, ever.
    expect(searchedQueries[kompasIdx].tourIncValue).toBeUndefined();
    expect(searchedQueries[kompasIdx].tourIncValues).toBeUndefined();
    expect(searchedQueries[kompasIdx].towns).toBeUndefined();
  });

  it("matches supplier labels against the geo entity's own names, scoped to its country", async () => {
    // "AE-DEIRA" never appears verbatim in a supplier label — "Deira" does.
    mockPrisma.geoCity.findUnique.mockResolvedValue({
      names: { ru: "Дейра", en: "Deira" },
      country: { code: "AE" },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "457", label: "Deira", kind: "TOWN" },
    ]);

    await aggregator.searchByService("tours", { ...baseQuery, geoCity: "AE-DEIRA" });

    const where = (mockPrisma.supplierGeoLink.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { geoCity: { code: "AE-DEIRA" } },
        { label: { contains: "Дейра", mode: "insensitive" }, geoCountry: { code: "AE" } },
        { label: { contains: "Deira", mode: "insensitive" }, geoCountry: { code: "AE" } },
      ]),
    );
    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(searchedQueries[kompasIdx].towns).toBe("457");
  });

  it("resolves an unlinked resort code through its GeoResort names", async () => {
    mockPrisma.geoCity.findUnique.mockResolvedValue(null);
    mockPrisma.geoResort.findUnique.mockResolvedValue({
      names: { en: "Saadiyat Island", ru: "Саадият" },
      city: { country: { code: "AE" } },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "2533", label: "Saadiyat Island", kind: "TOWN" },
    ]);

    const result = await aggregator.searchByService("tours", {
      ...baseQuery,
      geoCity: undefined,
      geoResort: "SAADIYAT",
    });

    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(kompasIdx).toBeGreaterThanOrEqual(0);
    expect(searchedQueries[kompasIdx].towns).toBe("2533");
    expect(result.perSupplier["KOMPAS"]).toEqual({ count: 1 });
  });

  it("keeps a resort query on its own TOWN links (never widens to the city)", async () => {
    // resolveGeoNames returns no cityId for resorts: widening Гойнюк to
    // KEMER's TOWN links would answer with the whole city. Precision comes
    // from the direct link + the townNames name channel.
    mockPrisma.geoCity.findUnique.mockResolvedValue(null);
    mockPrisma.geoResort.findUnique.mockResolvedValue({
      names: { ru: "Гойнюк" },
      city: { country: { code: "TR" } },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "16", label: "Гёйнюк", kind: "TOWN" },
    ]);

    await aggregator.searchByService("tours", {
      ...baseQuery,
      country: "TR",
      geoCity: undefined,
      geoResort: "GOYNUK",
    });

    const where = (mockPrisma.supplierGeoLink.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).not.toEqual(expect.arrayContaining([{ geoResort: { cityId: expect.anything() } }]));
    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(searchedQueries[kompasIdx].towns).toBe("16");
    // entity name + the supplier's own TOWN label ("Гёйнюк")
    expect(searchedQueries[kompasIdx].townNames).toEqual(["Гойнюк", "Гёйнюк"]);
  });

  it("scopes the label-contains-code match to the entity's own country", async () => {
    // "BAKU" inside "Bakung Beach Resort" (Indonesia) must not be picked up:
    // unscoped it fanned BAKU out into 3 whole-inventory ANEX jobs (102 = 3×34).
    mockPrisma.geoCity.findUnique.mockResolvedValue({
      names: { en: "Baku", ru: "Баку" },
      country: { code: "AE" },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([]);

    await aggregator.searchByService("tours", {
      ...baseQuery,
      country: "AE",
      geoCity: "BAKU",
    });

    const where = (mockPrisma.supplierGeoLink.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { label: { contains: "BAKU", mode: "insensitive" }, geoCountry: { code: "AE" } },
      ]),
    );
    expect(where.OR).not.toContainEqual({ label: { contains: "BAKU", mode: "insensitive" } });
  });

  it("sends townNames (entity names + TOWN labels) next to the towns ids", async () => {
    // The name channel: ANEX no-flight rows carry a NEGATIVE townInc, so the
    // id-only filter alone drops them (AT/FR/IT/SG = 0 positive ids).
    mockPrisma.geoCity.findUnique.mockResolvedValue({
      names: { ru: "Гойнюк", en: "Goynuk" },
      country: { code: "TR" },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "16", label: "Гёйнюк", kind: "TOWN" },
    ]);

    await aggregator.searchByService("tours", { ...baseQuery, country: "TR", geoCity: "GOYNUK" });

    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(searchedQueries[kompasIdx].towns).toBe("16");
    expect(searchedQueries[kompasIdx].townNames).toEqual(
      expect.arrayContaining(["Гойнюк", "Goynuk", "Гёйнюк"]),
    );
  });

  it("passes the entity's names as townNames even when the supplier has no TOWN links", async () => {
    mockPrisma.geoCity.findUnique.mockResolvedValue({
      names: { ru: "Баку", en: "Baku" },
      country: { code: "TR" },
    });
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "77", label: "Bakung Beach Resort", kind: "HOTEL" },
    ]);

    await aggregator.searchByService("tours", { ...baseQuery, country: "TR", geoCity: "BAKU" });

    const kompasIdx = searchedSuppliers.indexOf("KOMPAS");
    expect(searchedQueries[kompasIdx].towns).toBeUndefined();
    expect(searchedQueries[kompasIdx].townNames).toEqual(["Баку", "Baku"]);
  });

  it("counts one offer when a job answers the same external id twice", async () => {
    // One job per supplier («Любой», no TOURINC fan-out); the global dedupe
    // still collapses duplicate external ids inside a job's own rows.
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "77", label: "Dubai City Tour", kind: "TOUR" },
    ]);
    mockOfferService.search.mockImplementation((code: string, q: SupplierSearchQuery) => {
      searchedSuppliers.push(code);
      searchedQueries.push(q);
      return Promise.resolve([makeOffer(code, "Hotel X"), makeOffer(code, "Hotel X")]);
    });

    const result = await aggregator.searchByService("tours", baseQuery);

    expect(searchedSuppliers.filter((c) => c === "KOMPAS")).toHaveLength(1);
    expect(result.offers).toHaveLength(1);
    expect(result.perSupplier["KOMPAS"]).toEqual({ count: 1 });
  });

  it("never turns a label-substring hit into a city filter or a program filter", async () => {
    // KAZUNION has no TOWN link for Dubai but a TOUR label contains "DUBAI"
    // → the label must NOT become towns=…, and «Любой» means no tourIncValue
    // either (the legacy TOURINC fan-out is gone).
    mockPrisma.supplierGeoLink.findMany.mockImplementation(async (args: { where: { supplierCode: { in: string[] }; OR: unknown } }) => {
      const codes = args.where.supplierCode.in;
      return codes.includes("KOMPAS")
        ? [{ supplierCode: "KOMPAS", externalId: "457", label: "Deira", kind: "TOWN" }]
        : [{ supplierCode: "KAZUNION", externalId: "77", label: "DUBAI CITY TOUR", kind: "TOUR" }];
    });

    const result = await aggregator.searchByService("tours", baseQuery);

    const kazIdx = searchedSuppliers.indexOf("KAZUNION");
    if (kazIdx >= 0) {
      expect(searchedQueries[kazIdx].tourIncValue).toBeUndefined();
      expect(searchedQueries[kazIdx].towns).toBeUndefined();
    } else {
      expect(result.perSupplier["KAZUNION"]).toBeUndefined();
    }
  });

  it("resolveSuppliers returns exactly the suppliers searchByService will query, without spending a live request", async () => {
    mockPrisma.supplierGeoLink.findMany.mockImplementation(async (args: { where: { supplierCode: { in: string[] } } }) =>
      args.where.supplierCode.in.includes("KOMPAS")
        ? [{ supplierCode: "KOMPAS", externalId: "457", label: "Deira", kind: "TOWN" }]
        : [],
    );

    const resolved = await aggregator.resolveSuppliers("tours", baseQuery);

    expect(resolved).toEqual(["KOMPAS"]);
    expect(mockOfferService.search).not.toHaveBeenCalled();

    await aggregator.searchByService("tours", baseQuery);
    expect([...new Set(searchedSuppliers)]).toEqual(resolved);
  });

  it("resolveSuppliers lists the capable suppliers for a country-level query", async () => {
    const query: SupplierSearchQuery = { country: "AE", adults: 2 };
    const resolved = await aggregator.resolveSuppliers("tours", query);

    expect(mockOfferService.search).not.toHaveBeenCalled();
    expect(resolved).toContain("KOMPAS");

    await aggregator.searchByService("tours", query);
    expect([...new Set(searchedSuppliers)]).toEqual(resolved);
  });

  it("resolveSuppliers lists the supplier once when it only has TOUR links (no fan-out)", async () => {
    mockPrisma.supplierGeoLink.findMany.mockResolvedValue([
      { supplierCode: "KOMPAS", externalId: "77", label: "Dubai City Tour", kind: "TOUR" },
      { supplierCode: "KOMPAS", externalId: "78", label: "Dubai Safari", kind: "TOUR" },
    ]);

    const resolved = await aggregator.resolveSuppliers("tours", baseQuery);

    expect(resolved).toEqual(["KOMPAS"]);
  });
});
