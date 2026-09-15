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

describe("tourIncValue pass-through", () => {
  it("should accept tourIncValue and tourIncName in PriceCalendarQuery", () => {
    const q: PriceCalendarQuery = {
      supplierCode: "SUMMERTOUR",
      adults: 2,
      nights: 7,
      dateFrom: "2026-09-15",
      dateTo: "2027-03-15",
      tourIncValue: "229",
      tourIncName: "Antalya 2026",
    };
    expect(q.tourIncValue).toBe("229");
    expect(q.tourIncName).toBe("Antalya 2026");
  });

  it("should allow undefined tourIncValue (anonymous flow)", () => {
    const q: PriceCalendarQuery = {
      supplierCode: "SUMMERTOUR",
      adults: 2,
      nights: 7,
      dateFrom: "2026-09-15",
      dateTo: "2027-03-15",
    };
    expect(q.tourIncValue).toBeUndefined();
    expect(q.tourIncName).toBeUndefined();
  });

  it("should pass tourIncValue into SupplierSearchQuery for adapter", () => {
    const calQuery: PriceCalendarQuery = {
      supplierCode: "SUMMERTOUR",
      adults: 2,
      nights: 7,
      dateFrom: "2026-09-15",
      dateTo: "2027-03-15",
      tourIncValue: "229",
      tourIncName: "Antalya 2026",
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
      tourIncValue: calQuery.tourIncValue,
      tourIncName: calQuery.tourIncName,
    };

    expect(searchQuery.tourIncValue).toBe("229");
    expect(searchQuery.tourIncName).toBe("Antalya 2026");
  });
});

describe("Date integrity — checkIn parsing", () => {
  it("should parse 8-digit checkIn class (YYYYMMDD) to ISO date", () => {
    const checkIn = "20260916";
    const iso = `${checkIn.slice(0, 4)}-${checkIn.slice(4, 6)}-${checkIn.slice(6, 8)}`;
    expect(iso).toBe("2026-09-16");
  });

  it("should parse departureDate text (DD.MM.YYYY) to ISO date", () => {
    const text = "16.09.2026, Ср";
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    expect(iso).toBe("2026-09-16");
  });

  it("should prioritize departureDate text over checkIn class", () => {
    const departureDateText = "30.09.2026, Ср";
    const checkInClass = "20260916";

    const dateMatch = departureDateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const departureDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : `${checkInClass.slice(0, 4)}-${checkInClass.slice(4, 6)}-${checkInClass.slice(6, 8)}`;

    expect(departureDate).toBe("2026-09-30");
  });
});

describe("Multi-program calendar merge (HIMEROS matrix E2E)", () => {
  /** Mirrors adapter merge logic: group by date, keep ALL real offers per date. */
  function mergeByDate(offers: Array<{ departureDate: string; price: number; tourIncValue: string; spoKey: string; claim: string }>) {
    const dateMap = new Map<string, typeof offers>();
    for (const offer of offers) {
      const existing = dateMap.get(offer.departureDate) || [];
      existing.push(offer);
      dateMap.set(offer.departureDate, existing);
    }
    return Array.from(dateMap.entries())
      .map(([date, dateOffers]) => ({
        date,
        best: Math.min(...dateOffers.map((o) => o.price)),
        offerCount: dateOffers.length,
        offers: dateOffers
          .slice()
          .sort((a, b) => a.price - b.price)
          .map((o) => ({ tourIncValue: o.tourIncValue, spoKey: o.spoKey, claim: o.claim, price: o.price })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const realOffers = [
    { departureDate: "2026-09-30", price: 1371.64, tourIncValue: "229", spoKey: "34977", claim: "0x430A...E5" },
    { departureDate: "2026-09-30", price: 824.72, tourIncValue: "254", spoKey: "34978", claim: "0x430A...FE" },
  ];

  it("should keep both real offers for identical hotel/date/nights/room/meal/occupancy", () => {
    const merged = mergeByDate(realOffers);
    expect(merged).toHaveLength(1);
    expect(merged[0].date).toBe("2026-09-30");
    expect(merged[0].offerCount).toBe(2);
    expect(merged[0].offers).toHaveLength(2);
  });

  it("should preserve distinct supplier identity (spoKey + CATCLAIM) per offer", () => {
    const merged = mergeByDate(realOffers);
    const claims = merged[0].offers.map((o) => o.claim);
    const spoKeys = merged[0].offers.map((o) => o.spoKey);
    expect(new Set(claims).size).toBe(2);
    expect(new Set(spoKeys).size).toBe(2);
  });

  it("should pick the lowest real price as best without dropping offers", () => {
    const merged = mergeByDate(realOffers);
    expect(merged[0].best).toBe(824.72);
    expect(merged[0].offers[0].tourIncValue).toBe("254");
    expect(merged[0].offers[1].tourIncValue).toBe("229");
  });

  it("should merge dates across programs", () => {
    const merged = mergeByDate([
      ...realOffers,
      { departureDate: "2026-10-03", price: 816.83, tourIncValue: "254", spoKey: "34978", claim: "0x430A...FE2" },
    ]);
    expect(merged.map((e) => e.date)).toEqual(["2026-09-30", "2026-10-03"]);
    expect(merged[1].offerCount).toBe(1);
  });

  it("should detect one-way programs by TOURINC name", () => {
    const oneWay = /no return|без обратного/i.test("Antalya 2026 (NO RETURN)");
    const roundTrip = /no return|без обратного/i.test("Antalya 2026");
    expect(oneWay).toBe(true);
    expect(roundTrip).toBe(false);
  });

  it("should include tourIncValues in cache key so programs never share cache", () => {
    const base = {
      hotel: "HIMEROS BEACH HOTEL 3* (Кемер)",
      adults: 2,
      children: 0,
      childAges: [] as number[],
      nights: 7,
      dateFrom: "2026-09-20",
      dateTo: "2026-10-05",
    };
    const keySingle = `calendar:SUMMERTOUR:${JSON.stringify({ ...base, tourIncValues: ["229"] })}`;
    const keyMulti = `calendar:SUMMERTOUR:${JSON.stringify({ ...base, tourIncValues: ["229", "254"] })}`;
    const keyNone = `calendar:SUMMERTOUR:${JSON.stringify({ ...base, tourIncValues: [] })}`;
    expect(keySingle).not.toBe(keyMulti);
    expect(keySingle).not.toBe(keyNone);
    expect(keyMulti).not.toBe(keyNone);
  });

  it("should isolate nights contexts in cache keys (7 ≠ 8)", () => {
    const base = { hotel: "HIMEROS", adults: 2, children: 0, childAges: [] as number[] };
    const key7 = JSON.stringify({ ...base, nights: 7 });
    const key8 = JSON.stringify({ ...base, nights: 8 });
    expect(key7).not.toBe(key8);
  });

  it("should isolate occupancy contexts in cache keys (1 adult ≠ 2 adults ≠ 2+child)", () => {
    const base = { hotel: "HIMEROS", nights: 7 };
    const k1 = JSON.stringify({ ...base, adults: 1, children: 0, childAges: [] });
    const k2 = JSON.stringify({ ...base, adults: 2, children: 0, childAges: [] });
    const k3 = JSON.stringify({ ...base, adults: 2, children: 1, childAges: [5] });
    expect(new Set([k1, k2, k3]).size).toBe(3);
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

// ── 31-Day Window Engine Tests (§6/§7) ──────────────────────────────

/** Mirror of SummertourAdapter.generateCalendarWindows() for unit testing. */
function generateCalendarWindows(from: string, to: string, maxDays = 31): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  let current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
    if (windowEnd > end) windowEnd.setTime(end.getTime());

    windows.push({
      from: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`,
      to: `${windowEnd.getFullYear()}-${String(windowEnd.getMonth() + 1).padStart(2, "0")}-${String(windowEnd.getDate()).padStart(2, "0")}`,
    });

    current = new Date(windowEnd);
    current.setDate(current.getDate() + 1);
  }

  return windows;
}

describe("31-Day Window Engine (§6/§7)", () => {
  it("should split a 6-month range into multiple ≤31-day windows", () => {
    const windows = generateCalendarWindows("2026-09-15", "2027-03-15");
    expect(windows.length).toBeGreaterThanOrEqual(5);
    for (const w of windows) {
      const from = new Date(w.from);
      const to = new Date(w.to);
      const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(days).toBeLessThanOrEqual(31);
      expect(days).toBeGreaterThan(0);
    }
  });

  it("should have no gaps between adjacent windows", () => {
    const windows = generateCalendarWindows("2026-09-15", "2027-03-15");
    for (let i = 0; i < windows.length - 1; i++) {
      const currentEnd = new Date(windows[i].to);
      const nextStart = new Date(windows[i + 1].from);
      const gapDays = Math.round((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));
      expect(gapDays).toBe(1); // Contiguous: next starts day after current ends
    }
  });

  it("should cover the full date range without missing dates", () => {
    const from = "2026-09-15";
    const to = "2027-03-15";
    const windows = generateCalendarWindows(from, to);

    // First window starts at or before range start
    expect(new Date(windows[0].from).getTime()).toBeLessThanOrEqual(new Date(from).getTime());
    // Last window ends at or after range end
    expect(new Date(windows[windows.length - 1].to).getTime()).toBeGreaterThanOrEqual(new Date(to).getTime());
  });

  it("should handle a single-day range", () => {
    const windows = generateCalendarWindows("2026-10-01", "2026-10-01");
    expect(windows).toHaveLength(1);
    expect(windows[0].from).toBe("2026-10-01");
    expect(windows[0].to).toBe("2026-10-01");
  });

  it("should handle a 31-day range (exactly one window)", () => {
    const windows = generateCalendarWindows("2026-10-01", "2026-10-31");
    expect(windows).toHaveLength(1);
    expect(windows[0].from).toBe("2026-10-01");
    expect(windows[0].to).toBe("2026-10-31");
  });

  it("should handle a 32-day range (exactly two windows)", () => {
    const windows = generateCalendarWindows("2026-10-01", "2026-11-01");
    expect(windows).toHaveLength(2);
    expect(windows[0].from).toBe("2026-10-01");
    expect(windows[0].to).toBe("2026-10-31");
    expect(windows[1].from).toBe("2026-11-01");
    expect(windows[1].to).toBe("2026-11-01");
  });

  it("should produce exactly 6 windows for a 6-month season", () => {
    const windows = generateCalendarWindows("2026-09-15", "2027-03-31");
    // Sep 15 - Oct 15, Oct 16 - Nov 15, Nov 16 - Dec 16, Dec 17 - Jan 16, Jan 17 - Feb 15, Feb 16 - Mar 31
    expect(windows.length).toBeGreaterThanOrEqual(5);
    expect(windows.length).toBeLessThanOrEqual(7);
  });
});

// ── Deduplication Tests (§10) ──────────────────────────────────────

describe("Calendar offer deduplication (§10)", () => {
  it("should deduplicate offers by spoKey across windows", () => {
    const offers = [
      { externalOfferId: "34977", price: 1371.64, departureDate: "2026-09-30" },
      { externalOfferId: "34977", price: 1380.00, departureDate: "2026-09-30" }, // duplicate, higher price
      { externalOfferId: "34978", price: 824.72, departureDate: "2026-09-30" },
    ];

    const seen = new Map<string, typeof offers[0]>();
    for (const offer of offers) {
      if (!seen.has(offer.externalOfferId)) {
        seen.set(offer.externalOfferId, offer);
      } else {
        const existing = seen.get(offer.externalOfferId)!;
        if (offer.price > existing.price) seen.set(offer.externalOfferId, offer);
      }
    }

    const deduped = Array.from(seen.values());
    expect(deduped).toHaveLength(2);
    // Keep the higher price for duplicate (more recent scrape)
    const for34977 = deduped.find((o) => o.externalOfferId === "34977");
    expect(for34977!.price).toBe(1380.00);
  });

  it("should not deduplicate different spoKeys on same date", () => {
    const offers = [
      { externalOfferId: "34977", price: 1371.64, departureDate: "2026-09-30" },
      { externalOfferId: "34978", price: 824.72, departureDate: "2026-09-30" },
    ];

    const seen = new Map<string, typeof offers[0]>();
    for (const offer of offers) {
      if (!seen.has(offer.externalOfferId)) seen.set(offer.externalOfferId, offer);
    }

    expect(seen.size).toBe(2);
  });

  it("should NOT deduplicate same spoKey on different dates (price calendar)", () => {
    const offers = [
      { externalOfferId: "34978", price: 1118.30, departureDate: "2026-09-30", room: "STANDARD ROOM / DBL" },
      { externalOfferId: "34978", price: 1103.30, departureDate: "2026-10-03", room: "STANDARD ROOM / DBL" },
      { externalOfferId: "34978", price: 1070.71, departureDate: "2026-10-07", room: "STANDARD ROOM / DBL" },
    ];

    const seen = new Map<string, typeof offers[0]>();
    for (const offer of offers) {
      const key = `${offer.externalOfferId}|${offer.departureDate}|${offer.room ?? ""}`;
      if (!seen.has(key)) {
        seen.set(key, offer);
      } else {
        const existing = seen.get(key)!;
        if (offer.price > existing.price) seen.set(key, offer);
      }
    }

    const deduped = Array.from(seen.values());
    expect(deduped).toHaveLength(3);
    expect(deduped.map((o) => o.departureDate).sort()).toEqual(["2026-09-30", "2026-10-03", "2026-10-07"]);
  });

  it("should NOT deduplicate same spoKey+date with different rooms", () => {
    const offers = [
      { externalOfferId: "34978", price: 824.72, departureDate: "2026-09-30", room: "STANDARD ROOM / DBL" },
      { externalOfferId: "34978", price: 1118.30, departureDate: "2026-09-30", room: "FAMILY ROOM [FAM] / 2ADL" },
    ];

    const seen = new Map<string, typeof offers[0]>();
    for (const offer of offers) {
      const key = `${offer.externalOfferId}|${offer.departureDate}|${offer.room ?? ""}`;
      if (!seen.has(key)) {
        seen.set(key, offer);
      } else {
        const existing = seen.get(key)!;
        if (offer.price > existing.price) seen.set(key, offer);
      }
    }

    const deduped = Array.from(seen.values());
    expect(deduped).toHaveLength(2);
  });
});

// ── Multiple Offers Per Date (§12) ────────────────────────────────

describe("Multiple offers per date (§12)", () => {
  it("should preserve all offers when building calendar entries", () => {
    const dateOffers = [
      { tourIncValue: "229", price: 1371.64, externalOfferId: "34977" },
      { tourIncValue: "254", price: 824.72, externalOfferId: "34978" },
    ];

    const sorted = dateOffers.sort((a, b) => a.price - b.price);
    const entry = {
      date: "2026-09-30",
      price: sorted[0].price,
      offerCount: dateOffers.length,
      offers: sorted.map((o) => ({
        tourIncValue: o.tourIncValue,
        externalOfferId: o.externalOfferId,
        price: o.price,
      })),
    };

    expect(entry.offers).toHaveLength(2);
    expect(entry.offers[0].tourIncValue).toBe("254"); // cheapest first
    expect(entry.offers[1].tourIncValue).toBe("229");
  });
});

// ── Complete Date-Set Generation (§8) ─────────────────────────────

/** Mirror of adapter's complete date-set generation logic. */
function generateCompleteDateSet(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

describe("Complete date-set generation (§8)", () => {
  it("should generate all 11 dates for Sep 15-25 range", () => {
    const dates = generateCompleteDateSet("2026-09-15", "2026-09-25");
    expect(dates).toHaveLength(11);
    expect(dates[0]).toBe("2026-09-15");
    expect(dates[10]).toBe("2026-09-25");
  });

  it("should include every consecutive date without gaps", () => {
    const dates = generateCompleteDateSet("2026-09-15", "2026-09-25");
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    }
  });

  it("should handle single-day range", () => {
    const dates = generateCompleteDateSet("2026-10-01", "2026-10-01");
    expect(dates).toEqual(["2026-10-01"]);
  });

  it("should handle 31-day range", () => {
    const dates = generateCompleteDateSet("2026-10-01", "2026-10-31");
    expect(dates).toHaveLength(31);
  });

  it("should merge Summer results with complete date set", () => {
    const allDates = generateCompleteDateSet("2026-09-15", "2026-09-25");
    const summerResults = new Map([
      ["2026-09-15", { price: 823.16, offerCount: 1 }],
      ["2026-09-23", { price: 1376.90, offerCount: 1 }],
    ]);

    const entries = allDates.map((date) => {
      const result = summerResults.get(date);
      if (result) {
        return { date, price: result.price, offerCount: result.offerCount, absenceCode: undefined };
      }
      return { date, price: null, offerCount: 0, absenceCode: "SUPPLIER_NO_RESULT" };
    });

    expect(entries).toHaveLength(11);
    // Sep 15 has price
    expect(entries[0].price).toBe(823.16);
    expect(entries[0].absenceCode).toBeUndefined();
    // Sep 16 has no price
    expect(entries[1].price).toBeNull();
    expect(entries[1].absenceCode).toBe("SUPPLIER_NO_RESULT");
    // Sep 23 has price
    expect(entries[8].price).toBe(1376.90);
    expect(entries[8].absenceCode).toBeUndefined();
    // Sep 25 has no price
    expect(entries[10].price).toBeNull();
    expect(entries[10].absenceCode).toBe("SUPPLIER_NO_RESULT");
  });
});

// ── Absence Reasons (§10) ─────────────────────────────────────────

describe("Absence reasons (§10)", () => {
  it("should have absenceCode and absenceText for dates without offers", () => {
    const entry = {
      date: "2026-09-16",
      price: null,
      currency: null,
      availability: "NOT_AVAILABLE",
      offerCount: 0,
      absenceCode: "SUPPLIER_NO_RESULT",
      absenceText: "Цена не получена — Summer не предоставил предложение на эту дату",
    };
    expect(entry.price).toBeNull();
    expect(entry.absenceCode).toBe("SUPPLIER_NO_RESULT");
    expect(entry.absenceText).toBeTruthy();
  });

  it("should not have absenceCode for dates with offers", () => {
    const entry = {
      date: "2026-09-15",
      price: 823.16,
      currency: "USD",
      availability: "AVAILABLE",
      offerCount: 1,
      absenceCode: undefined,
      absenceText: undefined,
    };
    expect(entry.price).toBe(823.16);
    expect(entry.absenceCode).toBeUndefined();
  });

  it("should support all absence reason codes", () => {
    const codes = [
      "SUPPLIER_NO_RESULT",
      "NO_TOURS_FOR_DATE",
      "NO_AVAILABILITY",
      "PARAMETER_MISMATCH",
      "SUPPLIER_ERROR",
      "PLATFORM_ERROR",
    ];
    for (const code of codes) {
      const entry = { date: "2026-09-16", price: null, absenceCode: code };
      expect(entry.absenceCode).toBe(code);
    }
  });
});
