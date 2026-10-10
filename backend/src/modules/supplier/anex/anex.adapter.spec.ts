/**
 * §4.8 Request Modal re-check — ANEX search/calendar state resolution.
 *
 * The re-check (refreshPrice → search) rebuilds the query from the offer:
 *  - calendar offers carry a resort/town label as destination (and often no
 *    country at all) → the strict resolveState() used to throw UNSUPPORTED;
 *  - hotel-scoped calendars may carry no usable country/destination at all.
 * search() must resolve STATEINC the way getPriceCalendar() does — flexible
 * country/destination resolution (country match → town probe) → hotel
 * dictionary scan → the original descriptive error.
 */
import { AnexAdapter } from "./anex.adapter";
import type { AnexProvider, AnexState, AnexHotel } from "./anex.provider";
import type { SupplierSearchQuery } from "../supplier.types";

const TURKEY: AnexState = {
  id: 85,
  name: "Turkey",
  nameAlt: "Турция",
  stateISO: "TR",
};
const GEORGIA: AnexState = {
  id: 88,
  name: "Georgia",
  nameAlt: "Грузия",
  stateISO: "GE",
};

interface ProviderMock {
  resolveStateFlexible: jest.Mock;
  resolveState: jest.Mock;
  states: jest.Mock;
  hotels: jest.Mock;
  stars: jest.Mock;
  towns: jest.Mock;
  fetchJson: jest.Mock;
}

function makeAdapter(): { adapter: AnexAdapter; provider: ProviderMock } {
  const provider: ProviderMock = {
    resolveStateFlexible: jest.fn(),
    resolveState: jest.fn(),
    states: jest.fn().mockResolvedValue([TURKEY, GEORGIA]),
    hotels: jest.fn().mockResolvedValue([] as AnexHotel[]),
    stars: jest.fn().mockResolvedValue([]),
    towns: jest.fn().mockResolvedValue([]),
    fetchJson: jest.fn().mockResolvedValue([]),
  };
  const adapter = new AnexAdapter(provider as unknown as AnexProvider);
  return { adapter, provider };
}

const QUERY: SupplierSearchQuery = {
  service: "tours",
  hotel: "Movenpick Living Istanbul",
  hotelExternalId: "23788",
  departureDateFrom: "2026-10-24",
  departureDateTo: "2026-10-24",
  nightsFrom: 6,
  nightsTo: 6,
  adults: 2,
  children: 0,
};

describe("AnexAdapter.search — state resolution for the §4.8 re-check", () => {
  it("resolves country/destination via the flexible resolver (country match, then town probe)", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    const offers = await adapter.search({ ...QUERY, destination: "Istanbul" });

    expect(provider.resolveStateFlexible).toHaveBeenCalledWith("Istanbul");
    expect(offers).toEqual([]);
    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ STATE: "85" }),
    );
  });

  it("prefers country over destination when both are present", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(GEORGIA);

    await adapter.search({ ...QUERY, country: "Georgia", destination: "Istanbul" });

    expect(provider.resolveStateFlexible).toHaveBeenCalledWith("Georgia");
    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ STATE: "88" }),
    );
  });

  it("falls back to the hotel dictionary scan when no country/destination resolves", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockRejectedValue(
      new Error('ANEX: UNSUPPORTED query — country/destination is required (serves: Turkey, Georgia)'),
    );
    provider.hotels.mockImplementation(async (stateInc: string) =>
      stateInc === "85"
        ? [{ id: 23788, name: "Movenpick Living Istanbul" }]
        : [],
    );

    const offers = await adapter.search(QUERY);

    expect(offers).toEqual([]);
    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ STATE: "85" }),
    );
  });

  it("throws the original descriptive error when nothing resolves", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockRejectedValue(
      new Error('ANEX: UNSUPPORTED query — country/destination is required (serves: Turkey, Georgia)'),
    );

    await expect(adapter.search({ service: "tours", adults: 2 })).rejects.toThrow(
      /country\/destination is required/,
    );
    expect(provider.fetchJson).not.toHaveBeenCalled();
  });

  it("getPriceCalendar uses the same resolution (hotel scan for hotel-scoped calendars)", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockRejectedValue(
      new Error("ANEX: UNSUPPORTED destination — no state"),
    );
    provider.hotels.mockResolvedValue([{ id: 23788, name: "Movenpick Living Istanbul" }]);

    const out = await adapter.getPriceCalendar({
      supplierCode: "ANEX",
      hotelExternalId: "23788",
      adults: 2,
      children: 0,
      nights: 6,
      dateFrom: "2026-10-24",
      dateTo: "2026-10-24",
    });

    expect(out.supplierCode).toBe("ANEX");
    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ STATE: "85" }),
    );
  });
});

// ── Phase 5 §5.5/5.7 — amount:0 fallback elimination ──────────────────────

describe("AnexAdapter — no amount:0 fallbacks (§5.5/§5.7)", () => {
  const row = (price: Record<string, unknown>) => ({
    hotelInc: 23788,
    hotelName: "Movenpick Living Istanbul",
    checkIn: "2026-10-24",
    nights: 6,
    cat_Claim: "CLAIM-1",
    ...price,
  });

  function providerWithPrices(prices: Array<Record<string, unknown>>) {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);
    provider.fetchJson.mockResolvedValue([
      { prices, result: { pageCount: 1 } },
    ]);
    return { adapter, provider };
  }

  it("search drops rows without a positive supplier price (no synthesized amount:0 offer)", async () => {
    const { adapter } = providerWithPrices([
      row({}),
      row({ price: 0 }),
      row({ converted_price: -5 }),
      row({ price: "garbage" as unknown as number }),
    ]);

    const offers = await adapter.search({ ...QUERY, destination: "Turkey" });

    expect(offers).toEqual([]);
  });

  it("search keeps a row with a positive price as an offer at that price", async () => {
    const { adapter } = providerWithPrices([row({ price: 900 })]);

    const offers = await adapter.search({ ...QUERY, destination: "Turkey" });

    expect(offers).toHaveLength(1);
    expect(offers[0].price.amount).toBe(900);
  });

  it("getOffer: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const { adapter } = providerWithPrices([]);

    await expect(
      adapter.getOffer({
        supplierCode: "ANEX",
        externalOfferId: "MISSING",
        searchContext: { ...QUERY, destination: "Turkey" },
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });

  it("refreshPrice: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const { adapter } = providerWithPrices([]);

    await expect(
      adapter.refreshPrice({
        supplierCode: "ANEX",
        externalOfferId: "MISSING",
        searchContext: { ...QUERY, destination: "Turkey" },
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });

  it("price calendar: priceless rows → honest null-price absence entry (not 0)", async () => {
    const { adapter } = providerWithPrices([row({})]);

    const out = await adapter.getPriceCalendar({
      supplierCode: "ANEX",
      hotel: "Movenpick Living Istanbul",
      adults: 2,
      children: 0,
      nights: 6,
      dateFrom: "2026-10-24",
      dateTo: "2026-10-24",
    });

    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].price).toBeNull();
    expect(out.entries[0].absenceCode).toBe("SUPPLIER_NO_RESULT");
  });

  it("price calendar: priced rows keep the supplier price (entry + offers)", async () => {
    const { adapter } = providerWithPrices([row({ converted_price: 1000 })]);

    const out = await adapter.getPriceCalendar({
      supplierCode: "ANEX",
      hotel: "Movenpick Living Istanbul",
      adults: 2,
      children: 0,
      nights: 6,
      dateFrom: "2026-10-24",
      dateTo: "2026-10-24",
    });

    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].price).toBe(1000);
    expect(out.entries[0].offers?.[0]?.price).toBe(1000);
  });
});

// ── Hotel Identity contract (HOTEL_IDENTITY_AUDIT_REPORT §9.4) ─────────────
// ANEX native hotel identifier = hotelInc; the adapter owns the mapping
// hotelInc → platform hotelExternalId. There MUST be no expectation that
// ANEX has a `hotelKey` (SAMO-family native name).

describe("AnexAdapter — supplier-native identity mapping (hotelInc → hotelExternalId)", () => {
  it("normalizeRow maps raw.hotelInc → SupplierOffer.hotelExternalId", () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    const raw = {
      hotelInc: 23788,
      hotelName: "Movenpick Living Istanbul",
      checkIn: "2026-10-24",
      nights: 6,
      cat_Claim: "CLAIM-1",
      price: 1000,
    };
    provider.fetchJson.mockResolvedValue([{ prices: [raw], result: { pageCount: 1 } }]);

    return adapter.search(QUERY).then((offers) => {
      expect(offers).toHaveLength(1);
      expect(offers[0].hotelExternalId).toBe("23788");
    });
  });

  it("reverse mapping: query.hotelExternalId filters rows by native hotelInc", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    const row = (hotelInc: number) => ({
      hotelInc,
      hotelName: "Movenpick Living Istanbul",
      checkIn: "2026-10-24",
      nights: 6,
      cat_Claim: `CLAIM-${hotelInc}`,
      price: 1000,
    });
    provider.fetchJson.mockResolvedValue([
      { prices: [row(23788), row(99999)], result: { pageCount: 1 } },
    ]);

    const offers = await adapter.search(QUERY); // hotelExternalId: "23788"
    expect(offers).toHaveLength(1);
    expect(offers[0].hotelExternalId).toBe("23788");
  });
});

// ── Confirmed AGES contract (owner-supplied real request) ──────────────────
// ADULT=2 CHILD=3 AGES=1,6,13 — the supplier takes the CSV of ALL child
// ages. Locks the audit fix: the mapping used to truncate to childAges[0].

describe("AnexAdapter — AGES multi-child mapping (confirmed contract)", () => {
  const MULTI: SupplierSearchQuery = {
    ...QUERY,
    children: 3,
    childAges: [1, 6, 13],
  };

  it("sends every child age as one CSV (AGES=1,6,13), not only the first", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    await adapter.search(MULTI);

    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ ADULT: 2, CHILD: 3, AGES: "1,6,13" }),
    );
  });

  it("single child → AGES=<age>", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    await adapter.search({ ...QUERY, children: 1, childAges: [7] });

    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ CHILD: 1, AGES: "7" }),
    );
  });

  it("zero children → empty AGES (no ages invented)", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    await adapter.search(QUERY);

    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ CHILD: 0, AGES: "" }),
    );
  });

  it("CSV length follows the CHILD count (parity with the Anex Hotels AGES contract)", async () => {
    const { adapter, provider } = makeAdapter();
    provider.resolveStateFlexible.mockResolvedValue(TURKEY);

    await adapter.search({ ...QUERY, children: 3, childAges: [1] });

    expect(provider.fetchJson).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({ CHILD: 3, AGES: "1,0,0" }),
    );
  });
});
