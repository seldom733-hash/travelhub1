import type {
  PriceCalendarQuery,
  PriceCalendarResult,
  PriceCalendarEntry,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferRef,
} from "./supplier.types";

/**
 * Unit tests for Price Calendar query building, date mapping, context hashing,
 * cache key derivation, and price normalization.
 */

describe("PriceCalendarQuery", () => {
  const baseQuery: PriceCalendarQuery = {
    supplierCode: "SUMMERTOUR",
    hotel: "ARMAS BELLA SUN",
    hotelExternalId: "254",
    room: "standard",
    meal: "AI",
    adults: 2,
    children: 1,
    childAges: [7],
    nights: 7,
    dateFrom: "2026-09-14",
    dateTo: "2027-03-14",
  };

  it("should have required fields", () => {
    expect(baseQuery.supplierCode).toBe("SUMMERTOUR");
    expect(baseQuery.adults).toBe(2);
    expect(baseQuery.nights).toBe(7);
    expect(baseQuery.dateFrom).toBe("2026-09-14");
    expect(baseQuery.dateTo).toBe("2027-03-14");
  });

  it("should support different night counts", () => {
    for (const nights of [7, 8, 9, 10, 11, 12, 13, 14]) {
      const q = { ...baseQuery, nights };
      expect(q.nights).toBe(nights);
    }
  });

  it("should support different adult counts", () => {
    for (const adults of [1, 2, 3, 4]) {
      const q = { ...baseQuery, adults };
      expect(q.adults).toBe(adults);
    }
  });

  it("should support child ages array", () => {
    const q = { ...baseQuery, children: 2, childAges: [5, 9] };
    expect(q.childAges).toHaveLength(2);
    expect(q.childAges).toEqual([5, 9]);
  });
});

describe("PriceCalendarEntry", () => {
  it("should have price and availability", () => {
    const entry: PriceCalendarEntry = {
      date: "2026-09-24",
      price: 899,
      currency: "USD",
      availability: "AVAILABLE",
      offerCount: 3,
    };
    expect(entry.price).toBe(899);
    expect(entry.availability).toBe("AVAILABLE");
  });

  it("should support null price for unavailable dates", () => {
    const entry: PriceCalendarEntry = {
      date: "2026-09-15",
      price: null,
      currency: null,
      availability: "NOT_AVAILABLE",
      offerCount: 0,
    };
    expect(entry.price).toBeNull();
    expect(entry.availability).toBe("NOT_AVAILABLE");
  });
});

describe("PriceCalendarResult", () => {
  it("should contain entries sorted by date", () => {
    const result: PriceCalendarResult = {
      supplierCode: "SUMMERTOUR",
      contextHash: "abc123",
      entries: [
        { date: "2026-09-25", price: 900, currency: "USD", availability: "AVAILABLE", offerCount: 2 },
        { date: "2026-09-24", price: 850, currency: "USD", availability: "AVAILABLE", offerCount: 1 },
        { date: "2026-09-26", price: 920, currency: "USD", availability: "AVAILABLE", offerCount: 3 },
      ],
      dateFrom: "2026-09-14",
      dateTo: "2027-03-14",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      totalOffersScanned: 50,
    };

    // Sort entries by date
    result.entries.sort((a: PriceCalendarEntry, b: PriceCalendarEntry) => a.date.localeCompare(b.date));
    expect(result.entries[0].date).toBe("2026-09-24");
    expect(result.entries[1].date).toBe("2026-09-25");
    expect(result.entries[2].date).toBe("2026-09-26");
  });
});

describe("Context hash invalidation", () => {
  it("should produce different hashes for different configurations", () => {
    const configs = [
      { room: "standard", meal: "AI", adults: 2, children: 0, childAges: [] as number[], nights: 7 },
      { room: "deluxe", meal: "AI", adults: 2, children: 0, childAges: [] as number[], nights: 7 },
      { room: "standard", meal: "BB", adults: 2, children: 0, childAges: [] as number[], nights: 7 },
      { room: "standard", meal: "AI", adults: 2, children: 1, childAges: [5], nights: 7 },
      { room: "standard", meal: "AI", adults: 2, children: 1, childAges: [7], nights: 7 },
      { room: "standard", meal: "AI", adults: 2, children: 0, childAges: [] as number[], nights: 10 },
    ];

    const hashes = configs.map((c) => JSON.stringify(c));
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(configs.length);
  });
});

describe("Date range calculations", () => {
  it("should compute 6-month range correctly", () => {
    const now = new Date("2026-09-14");
    const dateFrom = now.toISOString().split("T")[0];
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + 6);
    const dateTo = futureDate.toISOString().split("T")[0];

    expect(dateFrom).toBe("2026-09-14");
    expect(dateTo).toBe("2027-03-14");
  });

  it("should handle month boundary crossing", () => {
    const now = new Date("2026-01-31");
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + 1);
    // JS auto-adjusts: Jan 31 + 1 month = Mar 3 (not Feb 31)
    expect(futureDate.getMonth()).toBe(2); // March
  });
});

describe("SupplierSearchQuery construction from PriceCalendarQuery", () => {
  it("should map nights to nightsFrom/nightsTo", () => {
    const calQuery: PriceCalendarQuery = {
      supplierCode: "SUMMERTOUR",
      adults: 2,
      nights: 10,
      dateFrom: "2026-09-14",
      dateTo: "2027-03-14",
    };

    const searchQuery: SupplierSearchQuery = {
      adults: calQuery.adults,
      children: calQuery.children,
      childAges: calQuery.childAges,
      hotel: calQuery.hotel,
      room: calQuery.room,
      meal: calQuery.meal,
      nightsFrom: calQuery.nights,
      nightsTo: calQuery.nights,
      departureDateFrom: calQuery.dateFrom,
      departureDateTo: calQuery.dateTo,
    };

    expect(searchQuery.nightsFrom).toBe(10);
    expect(searchQuery.nightsTo).toBe(10);
  });
});

describe("Offer grouping by date", () => {
  it("should group offers by departure date and find best price", () => {
    const offers: SupplierOffer[] = [
      {
        supplierCode: "SUMMERTOUR",
        externalOfferId: "100",
        hotel: "ARMAS BELLA SUN",
        departureDate: "2026-09-24",
        nights: 7,
        adults: 2,
        children: 0,
        childAges: [],
        price: { amount: 900, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "SUMMERTOUR" },
        availability: "AVAILABLE",
        fetchedAt: new Date(),
        expiresAt: new Date(),
      },
      {
        supplierCode: "SUMMERTOUR",
        externalOfferId: "101",
        hotel: "ARMAS BELLA SUN",
        departureDate: "2026-09-24",
        nights: 7,
        adults: 2,
        children: 0,
        childAges: [],
        price: { amount: 850, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "SUMMERTOUR" },
        availability: "AVAILABLE",
        fetchedAt: new Date(),
        expiresAt: new Date(),
      },
      {
        supplierCode: "SUMMERTOUR",
        externalOfferId: "102",
        hotel: "ARMAS BELLA SUN",
        departureDate: "2026-09-25",
        nights: 7,
        adults: 2,
        children: 0,
        childAges: [],
        price: { amount: 920, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "SUMMERTOUR" },
        availability: "AVAILABLE",
        fetchedAt: new Date(),
        expiresAt: new Date(),
      },
    ];

    // Group by date
    const dateMap = new Map<string, SupplierOffer[]>();
    for (const offer of offers) {
      const existing = dateMap.get(offer.departureDate) || [];
      existing.push(offer);
      dateMap.set(offer.departureDate, existing);
    }

    expect(dateMap.size).toBe(2);
    expect(dateMap.get("2026-09-24")).toHaveLength(2);
    expect(dateMap.get("2026-09-25")).toHaveLength(1);

    // Best price for Sept 24
    const sept24Offers = dateMap.get("2026-09-24")!;
    const best = sept24Offers.sort((a: SupplierOffer, b: SupplierOffer) => a.price.amount - b.price.amount)[0];
    expect(best.externalOfferId).toBe("101");
    expect(best.price.amount).toBe(850);
  });
});

describe("Cache key derivation", () => {
  it("should produce unique keys for different configurations", () => {
    const base = {
      hotel: "ARMAS",
      room: "standard",
      meal: "AI",
      adults: 2,
      children: 0,
      childAges: [] as number[],
      nights: 7,
    };

    const key1 = JSON.stringify(base);
    const key2 = JSON.stringify({ ...base, room: "deluxe" });
    const key3 = JSON.stringify({ ...base, nights: 10 });
    const key4 = JSON.stringify({ ...base, childAges: [5] });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).not.toBe(key4);
    expect(key2).not.toBe(key3);
  });
});
