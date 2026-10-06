import { AnexHotelAdapter, type AnexHotelPriceRow } from "./anex-hotel.adapter";
import type { SupplierSearchQuery } from "../supplier.types";

/**
 * Unit tests for the local city filter of the ANEX hotel adapter — the two
 * channels that make city searches work when the supplier answers with a
 * NEGATIVE townInc (no-flight packets) and with its own spelling of the town
 * («Гёйнюк» vs Master Geography «Гойнюк»).
 */
describe("AnexHotelAdapter applyLocalFilters", () => {
  const adapter = new AnexHotelAdapter({} as never);
  const filter = (rows: AnexHotelPriceRow[], query: Partial<SupplierSearchQuery>) =>
    (adapter as never as {
      applyLocalFilters(r: AnexHotelPriceRow[], q: SupplierSearchQuery): AnexHotelPriceRow[];
    }).applyLocalFilters(rows, { adults: 2, ...query });

  const vienna: AnexHotelPriceRow = { townInc: -767422, townName: "Vienna", hotelTownName: "Vienna" };
  const goynuk: AnexHotelPriceRow = { townInc: 16, townName: "Гёйнюк", hotelTownName: "Гёйнюк" };
  const beldibi: AnexHotelPriceRow = { townInc: 21, townName: "Белдиби", hotelTownName: "Белдиби" };

  it("keeps all rows when no city filter is set", () => {
    expect(filter([vienna, goynuk, beldibi], {})).toHaveLength(3);
  });

  it("matches by id channel when townInc is positive (legacy behaviour)", () => {
    expect(filter([goynuk, beldibi], { towns: "16" })).toEqual([goynuk]);
  });

  it("matches by name when the id channel is dead (negative townInc)", () => {
    // ANEX no-flight rows: townInc is a negative hash, never the link id.
    const out = filter([vienna], { towns: "1150", townNames: ["Вена", "Vienna"] });
    expect(out).toEqual([vienna]);
  });

  it("matches the supplier's «Гёйнюк» against «Гойнюк» via the translit key", () => {
    const out = filter([goynuk, beldibi], { townNames: ["Гойнюк", "Goynuk"] });
    expect(out).toEqual([goynuk]);
  });

  it("matches via hotelTownName when townName is absent", () => {
    const row: AnexHotelPriceRow = { townInc: -1, hotelTownName: "Гёйнюк" };
    expect(filter([row], { townNames: ["Goynuk"] })).toEqual([row]);
  });

  it("rejects other towns once a city filter is active", () => {
    expect(filter([vienna, goynuk, beldibi], { townNames: ["Гойнюк"] })).toEqual([goynuk]);
  });
});

/**
 * §4.8 re-check: hotel offers carry town/region labels as destination — the
 * strict resolveHotelState() threw UNSUPPORTED. search() must go through the
 * flexible resolver (hotel-country match → hotelTowns probe).
 */
describe("AnexHotelAdapter.search — state resolution (§4.8 re-check)", () => {
  const query = {
    service: "hotels",
    hotelExternalId: "555",
    departureDateFrom: "2026-10-24",
    nightsFrom: 6,
    nightsTo: 6,
    adults: 2,
    children: 0,
  };

  it("delegates country/destination resolution to resolveHotelStateFlexible", async () => {
    const provider = {
      resolveHotelStateFlexible: jest
        .fn()
        .mockResolvedValue({ id: 90, name: "Egypt", nameAlt: "Египет", stateISO: "EG" }),
      fetchJson: jest.fn().mockResolvedValue([]),
    };
    const adapter = new AnexHotelAdapter(provider as never);

    const offers = await adapter.search({ ...query, destination: "Sharm El Sheikh" });

    expect(provider.resolveHotelStateFlexible).toHaveBeenCalledWith("Sharm El Sheikh");
    expect(offers).toEqual([]);
    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ STATE: "90" }),
    );
  });

  it("propagates the descriptive error when nothing resolves", async () => {
    const provider = {
      resolveHotelStateFlexible: jest
        .fn()
        .mockRejectedValue(new Error("ANEX: UNSUPPORTED query — country/destination is required")),
    };
    const adapter = new AnexHotelAdapter(provider as never);

    await expect(adapter.search({ adults: 2 })).rejects.toThrow(
      /country\/destination is required/,
    );
  });
});


// ── Phase 5 §5.5/5.7 — amount:0 fallback elimination ──────────────────────

describe("AnexHotelAdapter — no amount:0 fallbacks (§5.5/§5.7)", () => {
  const baseProvider = () => ({
    resolveHotelStateFlexible: jest
      .fn()
      .mockResolvedValue({ id: 90, name: "Egypt", nameAlt: "Египет", stateISO: "EG" }),
    fetchJson: jest.fn().mockResolvedValue([]),
  });

  it("search drops rows without a positive supplier price (no synthesized amount:0 offer)", async () => {
    const provider = baseProvider();
    provider.fetchJson.mockResolvedValue([
      {
        prices: [
          { hotelName: "Hurgada Resort", checkIn: "2026-10-24", nights: 6 },
          { hotelName: "Hurgada Resort", checkIn: "2026-10-24", nights: 6, price: 0 },
          { hotelName: "Hurgada Resort", checkIn: "2026-10-24", nights: 6, converted_price: -1 },
        ],
        result: { pageCount: 1 },
      },
    ]);
    const adapter = new AnexHotelAdapter(provider as never);

    const offers = await adapter.search({
      service: "hotels",
      destination: "Hurgada",
      departureDateFrom: "2026-10-24",
      nightsFrom: 6,
      nightsTo: 6,
      adults: 2,
      children: 0,
    });

    expect(offers).toEqual([]);
  });

  it("search keeps a row with a positive price as an offer at that price", async () => {
    const provider = baseProvider();
    provider.fetchJson.mockResolvedValue([
      {
        prices: [
          { hotelName: "Hurgada Resort", checkIn: "2026-10-24", nights: 6, converted_price: 700 },
        ],
        result: { pageCount: 1 },
      },
    ]);
    const adapter = new AnexHotelAdapter(provider as never);

    const offers = await adapter.search({
      service: "hotels",
      destination: "Hurgada",
      departureDateFrom: "2026-10-24",
      nightsFrom: 6,
      nightsTo: 6,
      adults: 2,
      children: 0,
    });

    expect(offers).toHaveLength(1);
    expect(offers[0].price.amount).toBe(700);
  });

  it("getOffer: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const adapter = new AnexHotelAdapter(baseProvider() as never);
    (adapter as any).search = jest.fn().mockResolvedValue([]);

    await expect(
      adapter.getOffer({
        supplierCode: "ANEX-HOTEL",
        externalOfferId: "MISSING",
        searchContext: { service: "hotels", adults: 2 },
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });

  it("refreshPrice: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const adapter = new AnexHotelAdapter(baseProvider() as never);
    (adapter as any).search = jest.fn().mockResolvedValue([]);

    await expect(
      adapter.refreshPrice({
        supplierCode: "ANEX-HOTEL",
        externalOfferId: "MISSING",
        searchContext: { service: "hotels", adults: 2 },
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });
});