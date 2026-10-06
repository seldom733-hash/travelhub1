/**
 * Supplier Markup (STRICT PROMPT Phase 2 §16) — TourRequestService is the
 * server-authoritative boundary for public tour requests.
 *
 * Proves:
 *  - displayedPrice comes from the supplier re-check (refreshPrice → markup
 *    boundary), NEVER from dto.price;
 *  - re-check returning amount <= 0 → PRICE_UNAVAILABLE, no request written;
 *  - searchContext is rebuilt from the dto (hotel/room/meal/nights/dates);
 *  - Phase 3 §20: the working commercial snapshot is frozen at creation from
 *    the recheck pricing block (supplier price + fetchedAt/expiresAt TTL);
 */
import { TourRequestService } from "./tour-request.service";
import type { SupplierPriceSnapshot } from "./supplier.types";


const DTO = {
  supplierCode: "KOMPAS",
  externalOfferId: "35000",
  hotel: "Rixos",
  hotelExternalId: "2807",
  departureDate: "2026-09-19",
  nights: 7,
  adults: 2,
  children: 0,
  room: "DBL",
  meal: "AI",
  price: 999999, // stale client number — must be ignored
  currency: "USD",
};

function snapshot(overrides: Partial<SupplierPriceSnapshot> = {}): SupplierPriceSnapshot {
  return {
    amount: 1050,
    currency: "USD",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    queryHash: "h",
    source: "KOMPAS",
    pricing: {
      supplierAmount: 1000,
      currency: "USD",
      markupRate: "0.05",
      markupAmount: 50,
      publicAmount: 1050,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      configurationState: "CONFIGURED",
      calculatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

interface Harness {
  service: TourRequestService;
  prisma: { product: { findFirst: jest.Mock }; request: { create: jest.Mock } };
  offerService: { refreshPrice: jest.Mock };
}

function makeHarness(): Harness {
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue(null) },
    request: {
      create: jest.fn().mockResolvedValue({
        id: "r1",
        code: "REQ-1",
        referenceNumber: "R-1",
        status: "NEW",
        displayedPrice: 1050,
        displayedCurrency: "USD",
        createdAt: new Date(),
      }),
    },
  };
  const ids = { nextCode: jest.fn().mockResolvedValue("REQ-1") };
  const refNum = {
    nextCommerceSequence: jest.fn().mockResolvedValue(1),
    commerceRequestRef: jest.fn().mockReturnValue("R-1"),
  };
  const offerService = { refreshPrice: jest.fn().mockResolvedValue(snapshot()) };
  const service = new TourRequestService(
    prisma as never,
    ids as never,
    refNum as never,
    offerService as never,
  );
  return { service, prisma, offerService };
}

describe("TourRequestService — server-authoritative displayedPrice (Phase 2 §16)", () => {
  it("displayedPrice = re-check public amount; dto.price is never trusted", async () => {
    const h = makeHarness();

    const out = await h.service.createTourRequest(DTO);

    expect(h.offerService.refreshPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierCode: "KOMPAS",
        externalOfferId: "35000",
        searchContext: expect.objectContaining({
          service: "tours",
          hotel: "Rixos",
          room: "DBL",
          meal: "AI",
          adults: 2,
          children: 0,
          nightsFrom: 7,
          nightsTo: 7,
          departureDateFrom: "2026-09-19",
          departureDateTo: "2026-09-19",
        }),
      }),
    );

    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.displayedPrice).toBe(1050);
    expect(data.displayedCurrency).toBe("USD");
    expect(data.displayedPrice).not.toBe(999999);

    expect(out.displayedPrice).toBe(1050);
    expect(out.status).toBe("NEW");
  });

  it("passes geography/program hints (country/tourIncValue/tourIncName) to the re-check", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({
      ...DTO,
      destination: "Аль-Джаддаф",
      departureCity: "Baku",
      country: "Turkey",
      tourIncValue: "15614",
      tourIncName: "TR: Antalya 2026",
    });

    expect(h.offerService.refreshPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        searchContext: expect.objectContaining({
          destination: "Аль-Джаддаф",
          departureCity: "Baku",
          country: "Turkey",
          tourIncValue: "15614",
          tourIncName: "TR: Antalya 2026",
        }),
      }),
    );
  });

  it("re-check amount 0 → PRICE_UNAVAILABLE, no request row written", async () => {
    const h = makeHarness();
    h.offerService.refreshPrice.mockResolvedValue(snapshot({ amount: 0 }));

    await expect(h.service.createTourRequest(DTO)).rejects.toThrow(/PRICE_UNAVAILABLE/);
    expect(h.prisma.request.create).not.toHaveBeenCalled();
    expect(h.prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it("re-check failure propagates — request is never created with a stale price", async () => {
    const h = makeHarness();
    h.offerService.refreshPrice.mockRejectedValue(new Error("PRICE_UNAVAILABLE: supplier dead"));

    await expect(h.service.createTourRequest(DTO)).rejects.toThrow(/PRICE_UNAVAILABLE/);
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("product lookup keys on hotelExternalId and pins supplier context", async () => {
    const h = makeHarness();
    h.prisma.product.findFirst.mockResolvedValue({ id: "p1", code: "PRD-1", title: "Rixos" });

    await h.service.createTourRequest(DTO);

    expect(h.prisma.product.findFirst).toHaveBeenCalledWith({
      where: { attributes: { path: ["hotelExternalId"], equals: "2807" } },
      select: { id: true, code: true, title: true },
    });
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.productId).toBe("p1");
    expect(data.productSnapshot).toMatchObject({ productId: "p1", type: "TOUR", productType: "TOUR" });
    expect(data.pinnedRequirements).toMatchObject({ supplierCode: "KOMPAS", externalOfferId: "35000" });
  });

  it("Phase 4: service params frozen (country/destination/party), productSnapshot ALWAYS written, supplier-confirmed price set", async () => {
    const h = makeHarness(); // product lookup misses (findFirst → null)

    await h.service.createTourRequest({
      ...DTO,
      country: "Turkey",
      destination: "Antalya",
      departureCity: "Baku",
    });

    const data = h.prisma.request.create.mock.calls[0][0].data;
    // Selected-service parameters for the requests table (ночи, 2+0, страна, город)
    expect(data.pinnedRequirements).toMatchObject({
      country: "Turkey",
      destination: "Antalya",
      departureCity: "Baku",
      nights: 7,
      adults: 2,
      children: 0,
    });
    // productSnapshot is written even when the product lookup misses — the
    // «Услуга» cell falls back to the hotel name (productId stays unset).
    expect(data.productSnapshot).toMatchObject({
      productTitle: "Rixos",
      productType: "TOUR",
      type: "TOUR",
    });
    expect((data.productSnapshot as Record<string, unknown>).productId).toBeUndefined();
    expect(data.productId).toBeNull();
    // «Подтв. цена» = server-authoritative re-check right after service selection
    expect(data.confirmedPrice).toBe(1050);
    expect(data.confirmedCurrency).toBe("USD");
  });

  it("Phase 3 §20: working commercial snapshot frozen at creation from the recheck pricing block", async () => {
    const h = makeHarness();
    const fetchedAt = new Date("2026-10-01T10:00:00Z");
    const expiresAt = new Date("2026-10-01T10:15:00Z");
    h.offerService.refreshPrice.mockResolvedValue(snapshot({ fetchedAt, expiresAt }));

    await h.service.createTourRequest(DTO);

    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.commercialSnapshot).toMatchObject({
      supplierCode: "KOMPAS",
      serviceType: "tours",
      supplierPrice: 1000,
      supplierCurrency: "USD",
      markupRate: "0.05",
      markupAmount: 50,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      publicPrice: 1050,
      individualDiscount: false,
      discountAmount: 0,
      customerFinalPrice: 1050,
      customerCurrency: "USD",
      priceSource: "PUBLIC",
      supplierPriceFetchedAt: fetchedAt.toISOString(),
      supplierPriceExpiresAt: expiresAt.toISOString(),
      customerAcceptedAt: null,
    });
    expect(data.displayedPrice).toBe(1050);
  });

  it("recheck without pricing block → legacy request (no commercialSnapshot)", async () => {
    const h = makeHarness();
    const raw = snapshot();
    delete (raw as { pricing?: unknown }).pricing;
    h.offerService.refreshPrice.mockResolvedValue(raw);

    await h.service.createTourRequest(DTO);

    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.commercialSnapshot).toBeUndefined();
    expect(data.displayedPrice).toBe(1050);
    // Product rule: «Подтв. цена» = принята́я цена витрины at card creation —
    // frozen unconditionally (money-gate sees confirmed === displayed anyway).
    expect(data.confirmedPrice).toBe(1050);
    expect(data.confirmedCurrency).toBe("USD");
    // …but the productSnapshot is still written for the «Услуга» cell
    expect(data.productSnapshot).toMatchObject({ productTitle: "Rixos", productType: "TOUR" });
  });

});
