import { KompasSyncService } from "./kompas-sync.service";

/** Identity markup (NOT_CONFIGURED semantics) — catalog writes pass prices through. */
const pricingMock = () =>
  ({
    publicAmountFor: jest.fn(async (price: number) => price),
  }) as any;

/** Neutral PRD code generator mock (sync вставляет code=PRD-*, supplierRef=токен). */
const idsMock = () =>
  ({
    nextCode: jest.fn(async (_tx: any, prefix: string) => `${prefix}-00000001`),
  }) as any;

describe("KompasSyncService", () => {
  describe("formatDate", () => {
    it("formats date as YYYY-MM-DD", () => {
      const service = new KompasSyncService(null as any, null as any, null as any, idsMock());
      const result = (service as any).formatDate(new Date(2026, 8, 19));
      expect(result).toBe("2026-09-19");
    });

    it("pads single-digit month and day", () => {
      const service = new KompasSyncService(null as any, null as any, null as any, idsMock());
      const result = (service as any).formatDate(new Date(2026, 0, 5));
      expect(result).toBe("2026-01-05");
    });
  });

  describe("runSync", () => {
    it("returns error when KOMPAS partner not found (no partner)", async () => {
      const mockPrisma = {
        partner: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const service = new KompasSyncService(mockPrisma as any, null as any, null as any, idsMock());
      const result = await service.runSync("p1");
      expect(result.errors).toContain("KOMPAS partner not found");
      expect(result.newCards).toBe(0);
    });

    it("returns error when tours category not found", async () => {
      const mockPrisma = {
        partner: {
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = new KompasSyncService(mockPrisma as any, null as any, null as any, idsMock());
      const result = await service.runSync("p1");
      expect(result.errors).toContain("Tours category not found");
    });

    it("returns error when KOMPAS partner not found", async () => {
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1", name: "Test Partner" }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1", slug: "tours" }) },
      };
      const service = new KompasSyncService(mockPrisma as any, null as any, null as any, idsMock());
      const result = await service.runSync("p1");
      expect(result.errors).toContain("KOMPAS partner not found");
    });

    it("returns error when program discovery fails", async () => {
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1", name: "Test" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockRejectedValue(new Error("CAPTCHA blocked")),
      };
      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");
      expect(result.errors[0]).toContain("Country/program discovery failed");
      expect(result.programsDiscovered).toBe(0);
    });

    it("returns zero offers when no programs discovered", async () => {
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([]),
      };
      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");
      expect(result.offersReceived).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("groups offers by tourIncValue+hotelKey and creates products", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 1000, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-20",
          nights: 7, room: "SGL", meal: "BB", adults: 2, children: 0, childAges: [],
          price: { amount: 800, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35001", externalClaim: "cat2",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];

      let queryRawCalled = false;
      let executeRawCalled = false;
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        product: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          $queryRaw: jest.fn().mockImplementation(async () => {
            queryRawCalled = true;
            return [{ id: "new-product" }];
          }),
          $executeRaw: jest.fn().mockImplementation(async () => {
            executeRawCalled = true;
          }),
        })),
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya 2026" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };

      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");

      expect(result.programsDiscovered).toBe(1);
      expect(result.programsSearched).toBe(1);
      expect(result.offersReceived).toBe(2);
      expect(result.uniqueIdentities).toBe(1);
      expect(result.newCards).toBe(1);
      expect(queryRawCalled).toBe(true);
      expect(executeRawCalled).toBe(true);
    });

    it("updates existing product when price changes", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 900, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];

      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        product: {
          findFirst: jest.fn().mockResolvedValue({
            id: "existing",
            attributes: { startingPrice: 1200, currency: "USD" },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          product: { update: jest.fn() },
          tariff: { findFirst: jest.fn().mockResolvedValue(null) },
        })),
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };

      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");

      expect(result.updatedCards).toBe(1);
      expect(result.newCards).toBe(0);
    });

    it("skips update when price unchanged", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 1200, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];

      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        product: {
          findFirst: jest.fn().mockResolvedValue({
            id: "existing",
            attributes: { startingPrice: 1200, currency: "USD" },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          product: { update: jest.fn() },
          tariff: { findFirst: jest.fn().mockResolvedValue(null) },
        })),
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };

      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");

      expect(result.unchangedCards).toBe(1);
      expect(result.updatedCards).toBe(0);
    });

    it("writes the PUBLIC (marked-up) startingPrice at the catalog boundary", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 1000, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];

      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        // Existing card already stores the PUBLIC price (1000 + 5% = 1050):
        // unchanged iff minPrice was markups BEFORE the comparison.
        product: {
          findFirst: jest.fn().mockResolvedValue({
            id: "existing",
            attributes: { startingPrice: 1050, currency: "USD" },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          product: { update: jest.fn() },
          tariff: { findFirst: jest.fn().mockResolvedValue(null) },
        })),
      };
      const mockKompas = {
        code: "KOMPAS",
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };

      const pricing = {
        publicAmountFor: jest.fn(async (price: number) => (price === 1000 ? 1050 : price)),
      };
      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricing as any, idsMock());
      const result = await service.runSync("p1");

      expect(pricing.publicAmountFor).toHaveBeenCalledWith(1000, "USD", "KOMPAS", "tours");
      expect(result.unchangedCards).toBe(1);
      expect(result.updatedCards).toBe(0);
    });

    // ── Phase 5 §5.8 — reconciliation (stored/public ↔ supplier) ──────────

    it("reconciles stored Tariff + startingPrice to the PUBLIC price when the supplier price changes", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 900, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];
      const tx = {
        product: { update: jest.fn() },
        tariff: {
          findFirst: jest.fn().mockResolvedValue({ id: "t1", price: { toNumber: () => 1100 } }),
          update: jest.fn(),
        },
      };
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        product: {
          findFirst: jest.fn().mockResolvedValue({
            id: "existing",
            attributes: { startingPrice: 1100, currency: "USD" },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
      };
      const mockKompas = {
        code: "KOMPAS",
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };
      const pricing = {
        publicAmountFor: jest.fn(async (price: number) => (price === 900 ? 945 : price)),
      };

      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricing as any, idsMock());
      const result = await service.runSync("p1");

      // Supplier = 900 → markup 5% → PUBLIC 945 — ONE calculation at the
      // approved boundary, then reconciliation writes 945 (не 900, не 1100).
      expect(pricing.publicAmountFor).toHaveBeenCalledWith(900, "USD", "KOMPAS", "tours");
      expect(result.errors).toEqual([]);
      expect(result.updatedCards).toBe(1);
      expect(tx.tariff.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { price: 945 },
      });
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: expect.objectContaining({ startingPrice: 945 }),
          }),
        }),
      );
    });

    it("sync writes only catalog entities — accepted Request/Order commercialSnapshot never touched", async () => {
      const mockOffers = [
        {
          hotel: "Rixos", hotelExternalId: "2807", departureDate: "2026-09-19",
          nights: 7, room: "DBL", meal: "AI", adults: 2, children: 0, childAges: [],
          price: { amount: 900, currency: "USD" }, availability: "AVAILABLE",
          externalOfferId: "35000", externalClaim: "cat1",
          rawMetadata: { tourIncValue: "229", tourIncName: "Antalya", hotelKey: "2807", country: "Turkey" },
          fetchedAt: new Date(), expiresAt: new Date(),
        },
      ];
      const tx = {
        product: { update: jest.fn() },
        tariff: {
          findFirst: jest.fn().mockResolvedValue({ id: "t1", price: { toNumber: () => 1100 } }),
          update: jest.fn(),
        },
        // §5.8: after customer acceptance the commercialSnapshot is a frozen
        // historical fact — sync reconciliation must never write it.
        request: { update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
        order: { update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      };
      const mockPrisma = {
        partner: {
          findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "k1", name: "KOMPAS" }),
        },
        category: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
        product: {
          findFirst: jest.fn().mockResolvedValue({
            id: "existing",
            attributes: { startingPrice: 1100, currency: "USD" },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
      };
      const mockKompas = {
        discoverCountriesAndPrograms: jest.fn().mockResolvedValue([
          { countryId: "17", countryName: "Turkey", programs: [{ value: "229", name: "Antalya" }] },
        ]),
        search: jest.fn().mockResolvedValue(mockOffers),
      };

      const service = new KompasSyncService(mockPrisma as any, mockKompas as any, pricingMock(), idsMock());
      const result = await service.runSync("p1");

      expect(result.errors).toEqual([]);
      expect(result.updatedCards).toBe(1);
      expect(tx.product.update).toHaveBeenCalled();
      expect(tx.tariff.update).toHaveBeenCalled();
      expect(tx.request.update).not.toHaveBeenCalled();
      expect(tx.request.updateMany).not.toHaveBeenCalled();
      expect(tx.request.upsert).not.toHaveBeenCalled();
      expect(tx.order.update).not.toHaveBeenCalled();
      expect(tx.order.updateMany).not.toHaveBeenCalled();
      expect(tx.order.upsert).not.toHaveBeenCalled();
    });
  });
});
