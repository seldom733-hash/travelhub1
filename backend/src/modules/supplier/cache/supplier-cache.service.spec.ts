import { SupplierCacheService } from "./supplier-cache.service";

describe("SupplierCacheService", () => {
  let cache: SupplierCacheService;

  beforeEach(() => {
    cache = new SupplierCacheService();
  });

  describe("search cache", () => {
    it("returns undefined for cache miss", () => {
      const result = cache.getSearch("test:key");
      expect(result).toBeUndefined();
      expect(cache.misses).toBe(1);
    });

    it("stores and retrieves search results", () => {
      const offers = [
        {
          supplierCode: "TEST",
          externalOfferId: "1",
          hotel: "Test Hotel",
          departureDate: "2026-09-20",
          nights: 7,
          adults: 2,
          children: 0,
          childAges: [],
          price: { amount: 100, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "TEST" },
          availability: "AVAILABLE" as const,
          fetchedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      cache.setSearch("test:key", offers);
      const result = cache.getSearch("test:key");
      expect(result).toEqual(offers);
      expect(cache.hits).toBe(1);
    });

    it("returns undefined for expired entries", () => {
      cache.setSearch("test:key", []);
      // Manually set entry to expired
      const entry = (cache as unknown as { searchCache: Map<string, { expiresAt: number }> }).searchCache.get("test:key")!;
      entry.expiresAt = Date.now() - 1000;
      const result = cache.getSearch("test:key");
      expect(result).toBeUndefined();
    });
  });

  describe("price cache", () => {
    it("stores and retrieves price snapshots", () => {
      const snapshot = {
        amount: 500,
        currency: "USD",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        queryHash: "abc",
        source: "TEST",
      };

      cache.setPrice("test:price:1", snapshot);
      const result = cache.getPrice("test:price:1");
      expect(result).toEqual(snapshot);
    });
  });

  describe("key derivation", () => {
    it("produces stable keys from query objects", () => {
      const key1 = SupplierCacheService.deriveSearchKey("TEST", { adults: 2, country: "turkey" }, 1);
      const key2 = SupplierCacheService.deriveSearchKey("TEST", { adults: 2, country: "turkey" }, 1);
      expect(key1).toBe(key2);
    });

    it("produces different keys for different queries", () => {
      const key1 = SupplierCacheService.deriveSearchKey("TEST", { adults: 2 }, 1);
      const key2 = SupplierCacheService.deriveSearchKey("TEST", { adults: 1 }, 1);
      expect(key1).not.toBe(key2);
    });

    it("includes page in key", () => {
      const key1 = SupplierCacheService.deriveSearchKey("TEST", { adults: 2 }, 1);
      const key2 = SupplierCacheService.deriveSearchKey("TEST", { adults: 2 }, 2);
      expect(key1).not.toBe(key2);
    });
  });

  describe("invalidateSupplier", () => {
    it("removes all entries for a supplier", () => {
      cache.setSearch("TEST:key1", []);
      cache.setSearch("TEST:key2", []);
      cache.setSearch("OTHER:key3", []);
      cache.invalidateSupplier("TEST");
      expect(cache.getSearch("TEST:key1")).toBeUndefined();
      expect(cache.getSearch("TEST:key2")).toBeUndefined();
      expect(cache.getSearch("OTHER:key3")).toBeDefined();
    });
  });

  describe("clear", () => {
    it("removes all entries and resets metrics", () => {
      cache.setSearch("a", []);
      cache.setPrice("b", { amount: 1, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "" });
      cache.clear();
      expect(cache.stats().searchSize).toBe(0);
      expect(cache.stats().priceSize).toBe(0);
      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(0);
    });
  });
});
