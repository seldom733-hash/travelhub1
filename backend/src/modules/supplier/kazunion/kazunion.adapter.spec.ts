/**
 * §4.8 Request Modal re-check — KazUnion search state resolution.
 *
 * The modal re-check (refreshPrice → search) rebuilds the query from the
 * offer; hotel-scoped calendar offers may carry no country/destination, so
 * search must resolve STATEINC the same way the calendar does:
 * country/destination → program STATEINC memory → hotel dictionary scan.
 */
import { KazunionAdapter } from "./kazunion.adapter";
import type {
  KazunionDictionary,
  KazunionHttpService,
} from "./kazunion-http.service";
import type { SupplierSearchQuery } from "../supplier.types";

const STATES = [
  { value: "42201", name: "Turkey" },
  { value: "42202", name: "Georgia" },
];

function makeDict(overrides: Partial<KazunionDictionary> = {}): KazunionDictionary {
  return {
    states: STATES,
    programs: [{ value: "p1", name: "Program 1" }],
    meals: [{ value: "10001", name: "AO" }],
    towns: [{ value: "500", name: "Istanbul" }],
    stars: [],
    hotels: [],
    ...overrides,
  };
}

interface HttpMock {
  discoverStates: jest.Mock;
  discoverPrograms: jest.Mock;
  fetchDictionary: jest.Mock;
  fetchPrices: jest.Mock;
}

function makeAdapter(): { adapter: KazunionAdapter; http: HttpMock } {
  const http: HttpMock = {
    discoverStates: jest.fn().mockResolvedValue(STATES),
    discoverPrograms: jest.fn().mockResolvedValue([{ value: "p1", name: "Program 1" }]),
    fetchDictionary: jest.fn().mockImplementation(async (_town: string, stateInc?: string) =>
      stateInc === "42201"
        ? makeDict({ hotels: [{ id: "23788", name: "Movenpick Living Istanbul" }] })
        : makeDict(),
    ),
    fetchPrices: jest.fn().mockResolvedValue([]),
  };
  const adapter = new KazunionAdapter(http as unknown as KazunionHttpService);
  return { adapter, http };
}

const RECHECK_QUERY: SupplierSearchQuery = {
  service: "tours",
  hotel: "Movenpick Living Istanbul Saklivadi Special Class",
  hotelExternalId: "23788",
  departureDateFrom: "2026-10-24",
  departureDateTo: "2026-10-24",
  nightsFrom: 6,
  nightsTo: 6,
  adults: 3,
  children: 0,
  room: "Superior Apartment / 3Ad",
  meal: "AO.",
  // no country / destination — hotel-scoped calendar offer (§4.8)
};

describe("KazunionAdapter.search — state resolution without country/destination (§4.8)", () => {
  it("resolves STATEINC via the hotel dictionary scan and completes the re-check", async () => {
    const { adapter, http } = makeAdapter();

    const offers = await adapter.search(RECHECK_QUERY);

    expect(offers).toEqual([]);
    expect(http.fetchPrices).toHaveBeenCalledWith(
      expect.objectContaining({ stateInc: "42201", hotelKey: "23788" }),
    );
    // Hotel found in Turkey's dictionary — no probing of other states needed
    // for fetchPrices, but discoverPrograms must run for the resolved state.
    expect(http.discoverPrograms).toHaveBeenCalledWith("42201", "849");
  });

  it("prefers program STATEINC memory when a tourIncValue is present", async () => {
    const { adapter, http } = makeAdapter();
    (adapter as unknown as { programState: Map<string, string> }).programState.set(
      "15614",
      "42201",
    );

    await adapter.search({ ...RECHECK_QUERY, tourIncValue: "15614" });

    expect(http.fetchPrices).toHaveBeenCalledWith(
      expect.objectContaining({ stateInc: "42201", tourInc: "15614" }),
    );
    expect(http.discoverPrograms).not.toHaveBeenCalled();
  });

  it("keeps the explicit country/destination path intact", async () => {
    const { adapter, http } = makeAdapter();

    await adapter.search({ ...RECHECK_QUERY, destination: "Turkey" });

    expect(http.fetchPrices).toHaveBeenCalledWith(
      expect.objectContaining({ stateInc: "42201" }),
    );
  });

  it("falls through to the program/hotel scan when the explicit destination is unresolvable", async () => {
    const { adapter, http } = makeAdapter();

    // A resort label the state dictionary does not know — the candidate path
    // throws, but the re-check must still resolve via the hotel dictionary
    // instead of failing the create-request with 400.
    await adapter.search({ ...RECHECK_QUERY, destination: "Аль-Джаддаф" });

    expect(http.fetchPrices).toHaveBeenCalledWith(
      expect.objectContaining({ stateInc: "42201", hotelKey: "23788" }),
    );
  });

  it("falls through to program memory when the explicit destination is unresolvable", async () => {
    const { adapter, http } = makeAdapter();
    (adapter as unknown as { programState: Map<string, string> }).programState.set(
      "15614",
      "42201",
    );

    await adapter.search({
      ...RECHECK_QUERY,
      destination: "Аль-Джаддаф",
      tourIncValue: "15614",
    });

    expect(http.fetchPrices).toHaveBeenCalledWith(
      expect.objectContaining({ stateInc: "42201", tourInc: "15614" }),
    );
    expect(http.discoverPrograms).not.toHaveBeenCalled();
  });

  it("throws the original UNSUPPORTED error when nothing resolves", async () => {
    const { adapter, http } = makeAdapter();
    // No destination, no program memory, hotel unknown to every state.
    await expect(
      adapter.search({ service: "tours", hotelExternalId: "99999", adults: 2 }),
    ).rejects.toThrow(/country\/destination is required/);
    expect(http.fetchPrices).not.toHaveBeenCalled();
  });
});


// ── Phase 5 §5.5/5.7 — amount:0 fallback elimination ──────────────────────

describe("KazunionAdapter — no amount:0 fallbacks (§5.5/§5.7)", () => {
  it("getOffer: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const { adapter } = makeAdapter(); // fetchPrices → [] → no match

    await expect(
      adapter.getOffer({
        supplierCode: "KAZUNION",
        externalOfferId: "MISSING",
        searchContext: RECHECK_QUERY,
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });

  it("refreshPrice: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const { adapter } = makeAdapter();

    await expect(
      adapter.refreshPrice({
        supplierCode: "KAZUNION",
        externalOfferId: "MISSING",
        searchContext: RECHECK_QUERY,
      }),
    ).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });
});