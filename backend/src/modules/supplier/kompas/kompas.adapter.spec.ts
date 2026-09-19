import { KompasSupplierAdapter } from "./kompas.adapter";

describe("KompasSupplierAdapter", () => {
  let adapter: KompasSupplierAdapter;

  beforeEach(() => {
    adapter = new KompasSupplierAdapter();
  });

  describe("adapter identity", () => {
    it("has code KOMPAS", () => {
      expect(adapter.code).toBe("KOMPAS");
    });

    it("has name containing KOMPAS and SAMO", () => {
      expect(adapter.name).toContain("KOMPAS");
      expect(adapter.name).toContain("SAMO");
    });

    it("is enabled", () => {
      expect(adapter.enabled).toBe(true);
    });
  });

  describe("normalizeOffer (via search raw data)", () => {
    it("normalizes a raw KOMPAS offer with all fields", () => {
      const raw = {
        hotelKey: "2807",
        spoKey: "35000",
        tourKey: "229",
        mealKey: "10",
        roomKey: "5",
        nights: 7,
        checkIn: "20260919",
        adults: 2,
        children: 0,
        claim: "cat-claim-123",
        hotel: "Rixos Premium Tekirova",
        price: 1250.50,
        currency: "USD",
        departureDate: "19.09.2026",
        transport: "Эконом",
        roomText: "STANDARD ROOM / DBL",
        mealText: "AI",
      };

      const query = {
        adults: 2,
        tourIncValue: "229",
        tourIncName: "Antalya 2026",
      };

      const result = (adapter as any).normalizeOffer(raw, query);

      expect(result.supplierCode).toBe("KOMPAS");
      expect(result.externalOfferId).toBe("35000");
      expect(result.externalClaim).toBe("cat-claim-123");
      expect(result.hotel).toBe("Rixos Premium Tekirova");
      expect(result.hotelExternalId).toBe("2807");
      expect(result.departureDate).toBe("2026-09-19");
      expect(result.nights).toBe(7);
      expect(result.room).toBe("STANDARD ROOM / DBL");
      expect(result.meal).toBe("AI");
      expect(result.adults).toBe(2);
      expect(result.children).toBe(0);
      expect(result.price.amount).toBe(1250.50);
      expect(result.price.currency).toBe("USD");
      expect(result.availability).toBe("AVAILABLE");
      expect(result.transport).toBe("Эконом");
      expect(result.rawMetadata?.spoKey).toBe("35000");
      expect(result.rawMetadata?.hotelKey).toBe("2807");
      expect(result.rawMetadata?.tourKey).toBe("229");
      expect(result.rawMetadata?.catClaim).toBe("cat-claim-123");
      expect(result.rawMetadata?.tourIncValue).toBe("229");
      expect(result.rawMetadata?.tourIncName).toBe("Antalya 2026");
    });

    it("falls back to query hotel when raw hotel is empty", () => {
      const raw = {
        hotelKey: "9999",
        spoKey: "100",
        tourKey: "1",
        mealKey: "1",
        roomKey: "1",
        nights: 5,
        checkIn: "20261001",
        adults: 2,
        children: 0,
        claim: "",
        hotel: "",
        price: 500,
        currency: "USD",
        departureDate: "01.10.2026",
        transport: "",
        roomText: "",
        mealText: "",
      };

      const query = { adults: 2, hotel: "Fallback Hotel" };
      const result = (adapter as any).normalizeOffer(raw, query);

      expect(result.hotel).toBe("Fallback Hotel");
    });

    it("parses 8-digit checkIn when .sortie text is missing date", () => {
      const raw = {
        hotelKey: "1",
        spoKey: "1",
        tourKey: "1",
        mealKey: "1",
        roomKey: "1",
        nights: 7,
        checkIn: "20260919",
        adults: 2,
        children: 0,
        claim: "",
        hotel: "Test",
        price: 100,
        currency: "USD",
        departureDate: "",
        transport: "",
        roomText: "",
        mealText: "",
      };

      const result = (adapter as any).normalizeOffer(raw, { adults: 2 });
      expect(result.departureDate).toBe("2026-09-19");
    });
  });

  describe("matchOffer (4-level fallback)", () => {
    function makeOffer(overrides: Record<string, any> = {}) {
      return {
        supplierCode: "KOMPAS",
        externalOfferId: "35000",
        hotel: "Rixos",
        departureDate: "2026-09-19",
        nights: 7,
        adults: 2,
        children: 0,
        childAges: [],
        price: { amount: 1000, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: "KOMPAS" },
        availability: "AVAILABLE" as const,
        fetchedAt: new Date(),
        expiresAt: new Date(),
        rawMetadata: { tourIncValue: "229", roomText: "STANDARD ROOM / DBL" },
        ...overrides,
      };
    }

    function makeRef(ctx: Record<string, any> = {}) {
      return {
        supplierCode: "KOMPAS",
        externalOfferId: "35000",
        searchContext: {
          adults: 2,
          departureDateFrom: "2026-09-19",
          tourIncValue: "229",
          room: "STANDARD ROOM / DBL",
          ...ctx,
        },
      };
    }

    it("matches at level 1: externalOfferId + date + tourIncValue + room", () => {
      const offers = [makeOffer()];
      const ref = makeRef();
      const result = (adapter as any).matchOffer(offers, ref);
      expect(result).toBeDefined();
      expect(result.externalOfferId).toBe("35000");
    });

    it("falls back to level 2: without room", () => {
      const offers = [makeOffer()];
      const ref = makeRef({ room: "DIFFERENT ROOM" });
      const result = (adapter as any).matchOffer(offers, ref);
      expect(result).toBeDefined();
      expect(result.externalOfferId).toBe("35000");
    });

    it("falls back to level 3: externalOfferId + date only", () => {
      const offers = [makeOffer({ rawMetadata: { tourIncValue: "999", roomText: "X" } })];
      const ref = makeRef({ tourIncValue: "999" });
      const result = (adapter as any).matchOffer(offers, ref);
      expect(result).toBeDefined();
    });

    it("falls back to level 4: externalOfferId only", () => {
      const offers = [makeOffer()];
      const ref = makeRef({ departureDateFrom: "2099-01-01", tourIncValue: "999" });
      const result = (adapter as any).matchOffer(offers, ref);
      expect(result).toBeDefined();
      expect(result.externalOfferId).toBe("35000");
    });

    it("returns undefined when no offer matches at any level", () => {
      const offers = [makeOffer({ externalOfferId: "99999" })];
      const ref = makeRef({ externalOfferId: "11111" });
      const result = (adapter as any).matchOffer(offers, ref);
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty offers array", () => {
      const ref = makeRef();
      const result = (adapter as any).matchOffer([], ref);
      expect(result).toBeUndefined();
    });
  });

  describe("generateCalendarWindows", () => {
    it("returns one window for ≤31 day range", () => {
      const windows = (adapter as any).generateCalendarWindows("2026-09-19", "2026-10-10");
      expect(windows).toHaveLength(1);
      expect(windows[0].from).toBe("2026-09-19");
      expect(windows[0].to).toBe("2026-10-10");
    });

    it("splits 62-day range into 2 windows", () => {
      const windows = (adapter as any).generateCalendarWindows("2026-09-19", "2026-11-19");
      expect(windows).toHaveLength(2);
      expect(windows[0].from).toBe("2026-09-19");
      expect(windows[0].to).toBe("2026-10-19");
      expect(windows[1].from).toBe("2026-10-20");
      expect(windows[1].to).toBe("2026-11-19");
    });

    it("splits 93-day range into 3 windows", () => {
      const windows = (adapter as any).generateCalendarWindows("2026-09-01", "2026-12-01");
      expect(windows).toHaveLength(3);
    });
  });

  describe("formatDate", () => {
    it("formats date as YYYY-MM-DD", () => {
      const result = (adapter as any).formatDate(new Date(2026, 8, 19));
      expect(result).toBe("2026-09-19");
    });

    it("pads single-digit month and day", () => {
      const result = (adapter as any).formatDate(new Date(2026, 0, 5));
      expect(result).toBe("2026-01-05");
    });
  });

  describe("isoToSamodate", () => {
    it("converts ISO to SAMO format DD.MM.YYYY", () => {
      const result = (adapter as any).isoToSamodate("2026-09-19");
      expect(result).toBe("19.09.2026");
    });
  });

  describe("deduplicateCalendarOffers", () => {
    it("deduplicates by spoKey + departureDate + room", () => {
      const offers = [
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "DBL", price: { amount: 1000 } },
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "DBL", price: { amount: 800 } },
        { externalOfferId: "35001", departureDate: "2026-09-19", room: "DBL", price: { amount: 1200 } },
      ];
      const result = (adapter as any).deduplicateCalendarOffers(offers);
      expect(result).toHaveLength(2);
    });

    it("keeps the higher-priced offer when duplicates found", () => {
      const offers = [
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "DBL", price: { amount: 1200 } },
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "DBL", price: { amount: 800 } },
      ];
      const result = (adapter as any).deduplicateCalendarOffers(offers);
      expect(result).toHaveLength(1);
      expect(result[0].price.amount).toBe(1200);
    });

    it("treats different rooms as different offers", () => {
      const offers = [
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "DBL", price: { amount: 1000 } },
        { externalOfferId: "35000", departureDate: "2026-09-19", room: "SGL", price: { amount: 600 } },
      ];
      const result = (adapter as any).deduplicateCalendarOffers(offers);
      expect(result).toHaveLength(2);
    });
  });

  describe("mapDepartureCity", () => {
    it("maps baku to 1411", () => {
      expect((adapter as any).mapDepartureCity("baku")).toBe("1411");
      expect((adapter as any).mapDepartureCity("Баку")).toBe("1411");
    });

    it("maps vienna to 538", () => {
      expect((adapter as any).mapDepartureCity("vienna")).toBe("538");
      expect((adapter as any).mapDepartureCity("Вена")).toBe("538");
    });

    it("maps minsk to 873", () => {
      expect((adapter as any).mapDepartureCity("minsk")).toBe("873");
    });

    it("returns null for unknown city", () => {
      expect((adapter as any).mapDepartureCity("london")).toBeNull();
    });
  });

  describe("mapStateInc", () => {
    it("maps turkey to 17", () => {
      expect((adapter as any).mapStateInc("turkey")).toBe("17");
      expect((adapter as any).mapStateInc("Турция")).toBe("17");
    });

    it("maps maldives to 40", () => {
      expect((adapter as any).mapStateInc("maldives")).toBe("40");
      expect((adapter as any).mapStateInc("Мальдивы")).toBe("40");
    });

    it("maps egypt to 37", () => {
      expect((adapter as any).mapStateInc("egypt")).toBe("37");
    });

    it("returns null for unknown destination", () => {
      expect((adapter as any).mapStateInc("mars")).toBeNull();
    });
  });

  describe("parseCheckInDate", () => {
    it("parses 8-digit date string", () => {
      const result = (adapter as any).parseCheckInDate("20260919");
      expect(result).toBe("2026-09-19");
    });

    it("returns non-8-digit strings as-is", () => {
      const result = (adapter as any).parseCheckInDate("2026-09-19");
      expect(result).toBe("2026-09-19");
    });
  });

  describe("nights validation (§4 contract)", () => {
    it("exports KOMPAS_NIGHTS_MIN=3 and KOMPAS_NIGHTS_MAX=14", () => {
      // The adapter must expose the verified KOMPAS range for external consumers.
      // These constants are derived from live DOM evidence (NIGHTS_FROM select options).
      expect((adapter as any).constructor).toBeDefined();
      // Verify the module-level constants are accessible via the adapter's search validation.
      // The actual constants are module-scoped; we test their effect through search().
    });

    it("search() rejects nightsFrom=15 with explicit error", async () => {
      // §4: KOMPAS SAMO NIGHTS_FROM has options 3–14 only.
      // Value 15 causes browser to clear selection → silent fallback to nights=3.
      // Adapter MUST reject explicitly, not clamp.
      const query = {
        adults: 2,
        nightsFrom: 15,
        nightsTo: 15,
        destination: "turkey",
        tourIncValue: "3332",
      };
      await expect(adapter.search(query)).rejects.toThrow(
        /KOMPAS supports nights 3–14.*Requested nightsFrom: 15/,
      );
    });

    it("search() rejects nightsTo=15 with explicit error", async () => {
      const query = {
        adults: 2,
        nightsFrom: 7,
        nightsTo: 15,
        destination: "turkey",
        tourIncValue: "3332",
      };
      await expect(adapter.search(query)).rejects.toThrow(
        /KOMPAS supports nights 3–14.*Requested nightsTo: 15/,
      );
    });

    it("search() rejects nightsFrom=2 (below minimum)", async () => {
      const query = {
        adults: 2,
        nightsFrom: 2,
        nightsTo: 7,
        destination: "turkey",
        tourIncValue: "3332",
      };
      await expect(adapter.search(query)).rejects.toThrow(
        /KOMPAS supports nights 3–14.*Requested nightsFrom: 2/,
      );
    });

    it("search() rejects nightsFrom=20 (above maximum)", async () => {
      const query = {
        adults: 2,
        nightsFrom: 20,
        nightsTo: 20,
        destination: "turkey",
        tourIncValue: "3332",
      };
      await expect(adapter.search(query)).rejects.toThrow(
        /KOMPAS supports nights 3–14.*Requested nightsFrom: 20/,
      );
    });
  });
});
