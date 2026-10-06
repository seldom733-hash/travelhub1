/**
 * Supplier Markup (STRICT PROMPT Phase 2 §9) — SupplierOfferService is the
 * single pricing boundary for tours/hotels reads.
 *
 * Proves:
 *  - search / getOffer / refreshPrice / getPriceCalendar return PUBLIC price
 *    with the §20 pricing block attached;
 *  - caches store RAW supplier data (raw in, markup applied on every return
 *    path — a rule change is reflected on the next call);
 *  - NO DOUBLE MARKUP: already-priced entries are never re-applied;
 *  - Gate E: refreshPrice zero amount → PRICE_UNAVAILABLE (fresh AND cached);
 *  - refreshAvailability is not a money path (passthrough);
 *  - serviceType flows from query.service into the markup rule lookup.
 */
import { Prisma } from "../../generated/prisma/client";
import { SupplierPricingService } from "../pricing/supplier-pricing.service";
import type { MarkupRuleService } from "../pricing/markup-rule.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import type {
  PriceCalendarResult,
  SupplierAvailabilitySnapshot,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierSearchQuery,
} from "./supplier.types";

function makePricing(rate = "0.05"): SupplierPricingService {
  const ruleService = {
    resolve: jest.fn().mockResolvedValue({ found: true, rate: new Prisma.Decimal(rate), ruleCode: "MKR-00000001", ruleVersion: 1 }),
  } as unknown as MarkupRuleService;
  return new SupplierPricingService(ruleService);
}

function makeOffer(overrides: Partial<SupplierOffer> = {}): SupplierOffer {
  return {
    supplierCode: "SUMMERTOUR",
    externalOfferId: "OFF-1",
    hotel: "Himeros Beach",
    departureDate: "2026-09-19",
    nights: 7,
    adults: 2,
    children: 0,
    childAges: [],
    price: { amount: 1000, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "h", source: "SUMMERTOUR" },
    availability: "AVAILABLE",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SupplierPriceSnapshot> = {}): SupplierPriceSnapshot {
  return {
    amount: 1000,
    currency: "USD",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    queryHash: "h",
    source: "SUMMERTOUR",
    ...overrides,
  };
}

function makeCalendar(): PriceCalendarResult {
  return {
    supplierCode: "SUMMERTOUR",
    contextHash: "ctx",
    dateFrom: "2026-09-19",
    dateTo: "2026-09-26",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    totalOffersScanned: 1,
    entries: [
      {
        date: "2026-09-19",
        price: 1000,
        currency: "USD",
        availability: "AVAILABLE",
        offerCount: 1,
        offers: [
          {
            tourIncValue: "254",
            externalOfferId: "E1",
            hotel: "Himeros Beach",
            departureDate: "2026-09-19",
            nights: 7,
            adults: 2,
            children: 0,
            childAges: [],
            availability: "AVAILABLE",
            price: 1000,
            currency: "USD",
          },
        ],
      },
      { date: "2026-09-20", price: null, currency: null, availability: "AVAILABLE", offerCount: 0 },
    ],
  };
}

const config = {
  searchEnabled: true,
  livePriceEnabled: true,
  availabilityEnabled: true,
  maxConcurrency: 5,
  requestsPerMinute: 60,
  timeoutMs: 0,
  serviceTypes: ["tours"],
};

interface Harness {
  service: SupplierOfferService;
  adapter: {
    enabled: boolean;
    search: jest.Mock;
    getOffer: jest.Mock;
    refreshPrice: jest.Mock;
    refreshAvailability: jest.Mock;
    getPriceCalendar: jest.Mock;
  };
  registry: { get: jest.Mock; getConfig: jest.Mock };
  cache: {
    getSearch: jest.Mock;
    setSearch: jest.Mock;
    getDetail: jest.Mock;
    setDetail: jest.Mock;
    getPrice: jest.Mock;
    setPrice: jest.Mock;
    getAvailability: jest.Mock;
    setAvailability: jest.Mock;
  };
  pricing: SupplierPricingService;
}

function makeHarness(): Harness {
  const adapter = {
    enabled: true,
    search: jest.fn(),
    getOffer: jest.fn(),
    refreshPrice: jest.fn(),
    refreshAvailability: jest.fn(),
    getPriceCalendar: jest.fn(),
  };
  const registry = {
    get: jest.fn().mockReturnValue(adapter),
    getConfig: jest.fn().mockReturnValue(config),
  };
  const cache = {
    getSearch: jest.fn().mockReturnValue(null),
    setSearch: jest.fn(),
    getDetail: jest.fn().mockReturnValue(null),
    setDetail: jest.fn(),
    getPrice: jest.fn().mockReturnValue(null),
    setPrice: jest.fn(),
    getAvailability: jest.fn().mockReturnValue(null),
    setAvailability: jest.fn(),
  };
  const resilience = {
    isCircuitOpen: jest.fn().mockReturnValue(false),
    coalesce: jest.fn((_key: string, fn: () => unknown) => Promise.resolve().then(fn)),
    acquireBucket: jest.fn(),
    incrementInflight: jest.fn(),
    decrementInflight: jest.fn(),
    withRetry: jest.fn((_code: string, fn: () => unknown) => Promise.resolve().then(fn)),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    stats: jest.fn().mockReturnValue({}),
  };
  const pricing = makePricing();
  const service = new SupplierOfferService(
    registry as never,
    cache as unknown as SupplierCacheService,
    resilience as never,
    pricing,
  );
  return { service, adapter, registry, cache, pricing };
}

const query: SupplierSearchQuery = { adults: 2, service: "tours" };
const ref: SupplierOfferRef = { supplierCode: "SUMMERTOUR", externalOfferId: "OFF-1", searchContext: query };
const calQuery = (service?: string) => ({
  supplierCode: "SUMMERTOUR",
  adults: 2,
  nights: 7,
  dateFrom: "2026-09-19",
  dateTo: "2026-09-26",
  ...(service ? { service } : {}),
});

describe("SupplierOfferService — pricing boundary (Phase 2 §9)", () => {
  describe("search", () => {
    it("returns PUBLIC price with §20 block; caches RAW supplier offers", async () => {
      const h = makeHarness();
      h.adapter.search.mockResolvedValue([makeOffer()]);

      const out = await h.service.search("SUMMERTOUR", query);

      expect(out[0].price.amount).toBe(1050);
      expect(out[0].pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050, markupRate: "0.05" });
      // Cache stores RAW: setSearch got the unmarked 1000.
      expect(h.cache.setSearch).toHaveBeenCalledTimes(1);
      const cachedRaw = h.cache.setSearch.mock.calls[0][1] as SupplierOffer[];
      expect(cachedRaw[0].price.amount).toBe(1000);
      expect(cachedRaw[0].pricing).toBeUndefined();
    });

    it("cache hit still applies markup on the return path (fresh rule each call)", async () => {
      const h = makeHarness();
      h.cache.getSearch.mockReturnValue([makeOffer()]); // raw cache entry

      const out = await h.service.search("SUMMERTOUR", query);

      expect(h.adapter.search).not.toHaveBeenCalled();
      expect(out[0].price.amount).toBe(1050);
      expect(out[0].pricing!.supplierAmount).toBe(1000);
    });

    it("markup rule serviceType comes from query.service", async () => {
      const h = makeHarness();
      h.adapter.search.mockResolvedValue([makeOffer({ supplierCode: "ANEX" })]);
      await h.service.search("ANEX", { adults: 2, service: "hotels" });

      expect(h.registry.get).toHaveBeenCalledWith("ANEX", "hotels");
      expect(h.registry.getConfig).toHaveBeenCalledWith("ANEX", "hotels");
      expect((h.pricing as never as { markupRules: { resolve: jest.Mock } }).markupRules.resolve).toHaveBeenCalledWith(
        "ANEX",
        "hotels",
        expect.any(Date),
      );
    });

    it("schema-invalid / zero-price offers are filtered BEFORE the boundary", async () => {
      const h = makeHarness();
      h.adapter.search.mockResolvedValue([
        makeOffer(),
        makeOffer({ externalOfferId: "BAD", price: { ...makeOffer().price, amount: 0 } }),
      ]);

      const out = await h.service.search("SUMMERTOUR", query);
      expect(out).toHaveLength(1);
      expect(out[0].price.amount).toBe(1050);
    });
  });

  describe("getOffer", () => {
    it("cache hit → public price + pricing block (adapter not called)", async () => {
      const h = makeHarness();
      h.cache.getDetail.mockReturnValue(makeOffer() as SupplierOfferDetail);

      const out = await h.service.getOffer(ref);

      expect(h.adapter.getOffer).not.toHaveBeenCalled();
      expect(out.price.amount).toBe(1050);
      expect(out.pricing!.supplierAmount).toBe(1000);
    });

    it("fresh detail → cached RAW, returned PUBLIC", async () => {
      const h = makeHarness();
      h.adapter.getOffer.mockResolvedValue(makeOffer() as SupplierOfferDetail);

      const out = await h.service.getOffer(ref);

      expect(out.price.amount).toBe(1050);
      const cachedRaw = h.cache.setDetail.mock.calls[0][1] as SupplierOffer;
      expect(cachedRaw.price.amount).toBe(1000);
      expect(cachedRaw.pricing).toBeUndefined();
    });
  });

  describe("refreshPrice (Gate E)", () => {
    it("fresh snapshot → public amount; RAW stored in cache", async () => {
      const h = makeHarness();
      h.adapter.refreshPrice.mockResolvedValue(makeSnapshot());

      const out = await h.service.refreshPrice(ref);

      expect(out.amount).toBe(1050);
      expect(out.pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050 });
      expect(h.cache.setPrice.mock.calls[0][1].amount).toBe(1000);
    });

    it("adapter returns amount 0 → PRICE_UNAVAILABLE (never commercial money)", async () => {
      const h = makeHarness();
      h.adapter.refreshPrice.mockResolvedValue(makeSnapshot({ amount: 0 }));

      await expect(h.service.refreshPrice(ref)).rejects.toThrow(/PRICE_UNAVAILABLE/);
    });

    it("CACHED zero amount → PRICE_UNAVAILABLE too (boundary runs on cache path)", async () => {
      const h = makeHarness();
      h.cache.getPrice.mockReturnValue(makeSnapshot({ amount: 0 }));

      await expect(h.service.refreshPrice(ref)).rejects.toThrow(/PRICE_UNAVAILABLE/);
      expect(h.adapter.refreshPrice).not.toHaveBeenCalled();
    });

    it("cached public snapshot is NOT re-marked (NO DOUBLE MARKUP)", async () => {
      const h = makeHarness();
      const priced = makeSnapshot({ amount: 1050, pricing: {
        supplierAmount: 1000, currency: "USD", markupRate: "0.05", markupAmount: 50,
        publicAmount: 1050, markupRuleCode: "MKR-00000001", markupRuleVersion: 1,
        configurationState: "CONFIGURED", calculatedAt: new Date().toISOString(),
      } });
      h.cache.getPrice.mockReturnValue(priced);

      const out = await h.service.refreshPrice(ref);
      expect(out.amount).toBe(1050); // NOT 1102.50
    });
  });

  describe("refreshAvailability — not a money path", () => {
    it("returns the availability snapshot untouched (no pricing block)", async () => {
      const h = makeHarness();
      const snapshot: SupplierAvailabilitySnapshot = {
        availability: "AVAILABLE",
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };
      h.adapter.refreshAvailability.mockResolvedValue(snapshot);

      const out = await h.service.refreshAvailability(ref);
      expect(out).toEqual(snapshot);
      expect((out as { pricing?: unknown }).pricing).toBeUndefined();
    });
  });

  describe("getPriceCalendar", () => {
    it("marks up entry price + offers with ONE resolution; caches RAW", async () => {
      const h = makeHarness();
      h.adapter.getPriceCalendar.mockResolvedValue(makeCalendar());

      const out = await h.service.getPriceCalendar(calQuery("tours"));

      expect(out.entries[0].price).toBe(1050);
      expect(out.entries[0].pricing).toMatchObject({ supplierAmount: 1000, publicAmount: 1050 });
      expect(out.entries[0].offers![0].price).toBe(1050);
      expect(out.entries[0].offers![0].pricing!.supplierAmount).toBe(1000);
      expect(out.entries[1].price).toBeNull();

      const cachedRaw = h.cache.setSearch.mock.calls[0][1] as unknown as PriceCalendarResult;
      expect(cachedRaw.entries[0].price).toBe(1000);
      expect(cachedRaw.entries[0].pricing).toBeUndefined();
      expect(cachedRaw.entries[0].offers![0].price).toBe(1000);
    });

    it("cached calendar is marked up on the return path (NO DOUBLE MARKUP on repeat)", async () => {
      const h = makeHarness();
      h.cache.getSearch.mockReturnValue(makeCalendar());

      const first = await h.service.getPriceCalendar(calQuery("tours"));
      expect(first.entries[0].price).toBe(1050);

      // Simulate the public result being fed back through the same cache — the
      // cache itself stores raw, so a second call re-derives 1050, never 1102.50.
      const second = await h.service.getPriceCalendar(calQuery("tours"));
      expect(second.entries[0].price).toBe(1050);
      expect(second.entries[0].pricing!.supplierAmount).toBe(1000);
    });

    it("serviceType: query.service wins, otherwise registry default", async () => {
      const h = makeHarness();
      h.adapter.getPriceCalendar.mockResolvedValue(makeCalendar());

      await h.service.getPriceCalendar(calQuery());
      // no query.service → registry.getConfig(code) default (serviceTypes[0])
      expect(
        (h.pricing as never as { markupRules: { resolve: jest.Mock } }).markupRules.resolve,
      ).toHaveBeenLastCalledWith("SUMMERTOUR", "tours", expect.any(Date));
    });
  });
});
