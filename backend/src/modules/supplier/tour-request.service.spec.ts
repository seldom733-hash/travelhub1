/**
 * Supplier Markup (STRICT PROMPT Phase 2 Â§16) â€” TourRequestService is the
 * server-authoritative boundary for public tour requests.
 *
 * Proves:
 *  - displayedPrice comes from the supplier re-check (refreshPrice â†’ markup
 *    boundary), NEVER from dto.price;
 *  - re-check returning amount <= 0 â†’ PRICE_UNAVAILABLE, no request written;
 *  - searchContext is rebuilt from the dto (hotel/room/meal/nights/dates);
 *  - Phase 3 Â§20: the working commercial snapshot is frozen at creation from
 *    the recheck pricing block (supplier price + fetchedAt/expiresAt TTL);
 *  - Â§4.8: traveler identity block â€” invalid phone/email â†’ 422 before any
 *    supplier call, Customer resolution (reuse/create/unlinked), AMBIGUOUS â†’
 *    ConflictError (409).
 */
import { TourRequestService } from "./tour-request.service";
import { resolveCustomer } from "../../shared/customer-resolver/customer-resolver";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import type { SupplierPriceSnapshot } from "./supplier.types";

jest.mock("../../shared/customer-resolver/customer-resolver", () => ({
  resolveCustomer: jest.fn(),
}));
const resolveCustomerMock = resolveCustomer as jest.Mock;

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
  price: 999999, // stale client number â€” must be ignored
  currency: "USD",
};

function snapshot(overrides: Partial<SupplierPriceSnapshot> = {}): SupplierPriceSnapshot {
  return {
    amount: 1050,
    // UNIFIED FINANCE CENTER Phase 1: recheck Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ AZN (management
    // currency; USD-Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸Ðº ÐºÐ¾Ð½Ð²ÐµÑ€Ñ‚Ð¸Ñ€ÑƒÐµÑ‚ÑÑ Ð½Ð° pricing-Ð³Ñ€Ð°Ð½Ð¸Ñ†Ðµ Ð¸Ð»Ð¸ gate
    // Ð±Ð»Ð¾ÐºÐ¸Ñ€ÑƒÐµÑ‚ request Ð¿Ñ€Ð¸ Ð¾Ñ‚ÑÑƒÑ‚ÑÑ‚Ð²Ð¸Ð¸ ÐºÑƒÑ€ÑÐ°).
    currency: "AZN",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    queryHash: "h",
    source: "KOMPAS",
    pricing: {
      supplierAmount: 1000,
      currency: "AZN",
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
  crm: { createCustomer: jest.Mock };
  assignment: { assign: jest.Mock };
}

function makeHarness(): Harness {
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue(null) },
    request: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "r1",
        code: "REQ-1",
        referenceNumber: "R-1",
        status: "NEW",
        displayedPrice: 1050,
        displayedCurrency: "AZN",
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
  const assignment = { assign: jest.fn().mockResolvedValue({}) };
  const crm = {
    createCustomer: jest.fn().mockResolvedValue({ customer: { id: "c-new" } }),
  };
  resolveCustomerMock.mockReset();
  resolveCustomerMock.mockResolvedValue({
    status: "UNMATCHED",
    customerId: null,
    candidates: [],
    canonicalPhone: "+994501112233",
    source: "phone",
  });
  const service = new TourRequestService(
    prisma as never,
    ids as never,
    refNum as never,
    offerService as never,
    crm as never,
    assignment as never,
  );
  return { service, prisma, offerService, crm, assignment };
}

describe("TourRequestService â€” server-authoritative displayedPrice (Phase 2 Â§16)", () => {
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
    expect(data.displayedCurrency).toBe("AZN");
    expect(data.displayedPrice).not.toBe(999999);

    expect(h.assignment.assign).toHaveBeenCalledWith("r1");
    expect(out.displayedPrice).toBe(1050);
    expect(out.status).toBe("NEW");
  });

  it("Â§SERVICE-PASSTHROUGH: dto.service selects the re-check adapter (hotels)", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({ ...DTO, service: "hotels" });

    expect(h.offerService.refreshPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        searchContext: expect.objectContaining({ service: "hotels" }),
      }),
    );
    // A hotel request must not convert into a TOUR OrderItem.
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.productSnapshot.productType).toBe("HOTEL");
    expect(data.productSnapshot.type).toBe("HOTEL");
    expect(data.productSnapshot.offer.service).toBe("hotels");
  });

  it("service defaults to tours when dto.service is absent (back-compat)", async () => {
    const h = makeHarness();

    await h.service.createTourRequest(DTO);

    expect(h.offerService.refreshPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        searchContext: expect.objectContaining({ service: "tours" }),
      }),
    );
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.productSnapshot.productType).toBe("TOUR");
  });

  it("passes geography/program hints (country/tourIncValue/tourIncName) to the re-check", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({
      ...DTO,
      destination: "ÐÐ»ÑŒ-Ð”Ð¶Ð°Ð´Ð´Ð°Ñ„",
      departureCity: "Baku",
      country: "Turkey",
      tourIncValue: "15614",
      tourIncName: "TR: Antalya 2026",
    });

    expect(h.offerService.refreshPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        searchContext: expect.objectContaining({
          destination: "ÐÐ»ÑŒ-Ð”Ð¶Ð°Ð´Ð´Ð°Ñ„",
          departureCity: "Baku",
          country: "Turkey",
          tourIncValue: "15614",
          tourIncName: "TR: Antalya 2026",
        }),
      }),
    );
  });

  it("re-check amount 0 â†’ PRICE_UNAVAILABLE, no request row written", async () => {
    const h = makeHarness();
    h.offerService.refreshPrice.mockResolvedValue(snapshot({ amount: 0 }));

    await expect(h.service.createTourRequest(DTO)).rejects.toThrow(/PRICE_UNAVAILABLE/);
    expect(h.prisma.request.create).not.toHaveBeenCalled();
    expect(h.prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it("re-check failure propagates â€” request is never created with a stale price", async () => {
    const h = makeHarness();
    h.offerService.refreshPrice.mockRejectedValue(new Error("PRICE_UNAVAILABLE: supplier dead"));

    await expect(h.service.createTourRequest(DTO)).rejects.toThrow(/PRICE_UNAVAILABLE/);
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("product lookup keys on hotelExternalId OR supplier-native hotelKey, supplier-scoped", async () => {
    const h = makeHarness();
    h.prisma.product.findFirst.mockResolvedValue({ id: "p1", code: "PRD-1", title: "Rixos" });

    await h.service.createTourRequest(DTO);

    // Fix A: the lookup is supplier-scoped and maps the PLATFORM transport id
    // onto BOTH stored shapes: legacy hotelExternalId AND supplier-native
    // hotelKey (real catalog shape â€” 3010/3010 SAMO-family Products).
    expect(h.prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { attributes: { path: ["supplierCode"], equals: "KOMPAS" } },
          {
            OR: [
              { attributes: { path: ["hotelExternalId"], equals: "2807" } },
              { attributes: { path: ["hotelKey"], equals: "2807" } },
            ],
          },
        ],
      },
      select: { id: true, code: true, title: true, travelerRequirements: true },
    });
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.productId).toBe("p1");
    expect(data.productSnapshot).toMatchObject({ productId: "p1", type: "TOUR", productType: "TOUR" });
    // Data-shape fix Â§5/Â§6: the offer snapshot moved OUT of pinnedRequirements
    // into productSnapshot.offer; the pin itself is the canonical traveler map.
    expect((data.productSnapshot as Record<string, any>).offer).toMatchObject({
      supplierCode: "KOMPAS",
      externalOfferId: "35000",
    });
    expect(data.pinnedRequirements).toMatchObject({
      firstName: "REQUIRED",
      lastName: "REQUIRED",
      birthDate: "REQUIRED",
    });
  });

  // Hotel Identity Fix A â€” Product lookup test matrix (V2 prompt Â§10).
  describe("Product lookup matrix (supplier-native identity mapping)", () => {
    /** Simulates the REAL catalog read: the mock honours the actual where
     *  clause against realistic attribute shapes (the old mock accepted any
     *  findFirst call â€” the audit's false-confidence pattern). */
    function makeCatalogHarness(catalog: Array<Record<string, unknown>>) {
      const h = makeHarness();
      h.prisma.product.findFirst.mockImplementation(({ where }: { where: any }) => {
        const match = (attrs: Record<string, unknown>) => {
          // Replicate the production where: AND[ supplierCode, OR[hotelExternalId, hotelKey] ]
          const or = where?.AND?.[1]?.OR ?? where?.OR;
          const andSupplier = where?.AND?.[0]?.attributes;
          if (andSupplier) {
            if (attrs.supplierCode !== andSupplier.equals) return false;
          }
          return or.some((c: any) => attrs[c.attributes.path[0]] === c.attributes.equals);
        };
        const found = catalog.find((p) => match(p.attributes as Record<string, unknown>));
        return Promise.resolve(found ? { id: found.id, code: found.code, title: found.title } : null);
      });
      return h;
    }

    const requestWith = (supplierCode: string, hotelExternalId: string) =>
      h2(hotelExternalId, supplierCode);
    function h2(hotelExternalId: string, supplierCode: string) {
      return { ...DTO, supplierCode, hotelExternalId };
    }

    it("A/B/C: resolves productId from attributes.hotelKey for SAMO-family suppliers", async () => {
      for (const [supplier, code] of [
        ["SUMMERTOUR", "SUMMERTOUR-255-1144"],
        ["KOMPAS", "KOMPAS-3706-2807"],
        ["KAZUNION", "KAZUNION-1553-14015"],
      ] as const) {
        const hotelKey = code.split("-")[2];
        const h = makeCatalogHarness([
          { id: "p-1", code, title: "Hotel", attributes: { supplierCode: supplier, hotelKey } },
        ]);
        const out = await h.service.createTourRequest(requestWith(supplier, hotelKey));
        expect(out).toBeDefined();
        const data = h.prisma.request.create.mock.calls[0][0].data;
        expect(data.productId).toBe("p-1");
        expect(data.productSnapshot).toMatchObject({ productId: "p-1", productCode: code });
      }
    });

    it("D: same numeric id across suppliers resolves only the requested supplier's Product", async () => {
      const h = makeCatalogHarness([
        { id: "p-A", code: "SUPA-1-123", title: "A hotel", attributes: { supplierCode: "SUPPLIER_A", hotelKey: "123" } },
        { id: "p-B", code: "SUPB-2-123", title: "B hotel", attributes: { supplierCode: "SUPPLIER_B", hotelKey: "123" } },
      ]);
      await h.service.createTourRequest(requestWith("SUPPLIER_A", "123"));
      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.productId).toBe("p-A");
      expect(data.productId).not.toBe("p-B");
    });

    it("E: legacy Product stored under attributes.hotelExternalId still resolves (backward compat)", async () => {
      const h = makeCatalogHarness([
        { id: "p-legacy", code: "SOME-1-123", title: "Legacy", attributes: { supplierCode: "SOME_SUPPLIER", hotelExternalId: "123" } },
      ]);
      await h.service.createTourRequest(requestWith("SOME_SUPPLIER", "123"));
      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.productId).toBe("p-legacy");
    });

    it("F: ANEX (no catalog Product) â†’ productId stays NULL, request creation remains valid", async () => {
      const h = makeCatalogHarness([]);
      await h.service.createTourRequest({ ...DTO, supplierCode: "ANEX", hotelExternalId: "5050" });
      const data = h.prisma.request.create.mock.calls[0][0].data;
      expect(data.productId).toBeNull();
      // Frozen snapshot still written from the dto (product-less contract Â§12).
      expect(data.productSnapshot).toMatchObject({ productType: "TOUR" });
    });
  });

  it("Phase 4: service params frozen (country/destination/party), productSnapshot ALWAYS written, supplier-confirmed price set", async () => {
    const h = makeHarness(); // product lookup misses (findFirst â†’ null)

    await h.service.createTourRequest({
      ...DTO,
      country: "Turkey",
      destination: "Antalya",
      departureCity: "Baku",
    });

    const data = h.prisma.request.create.mock.calls[0][0].data;
    // Selected-service parameters (Ð½Ð¾Ñ‡Ð¸, 2+0, ÑÑ‚Ñ€Ð°Ð½Ð°, Ð³Ð¾Ñ€Ð¾Ð´) â€” frozen in
    // productSnapshot.offer (data-shape fix Â§6), ÐÐ• Ð² pinnedRequirements.
    expect((data.productSnapshot as Record<string, any>).offer).toMatchObject({
      country: "Turkey",
      destination: "Antalya",
      departureCity: "Baku",
      nights: 7,
      adults: 2,
      children: 0,
    });
    // Â§5: the pin carries ONLY the canonical traveler requirements map.
    expect(data.pinnedRequirements).toMatchObject({
      firstName: "REQUIRED",
      lastName: "REQUIRED",
      birthDate: "REQUIRED",
    });
    expect(data.pinnedRequirements).not.toHaveProperty("country");
    expect(data.pinnedRequirements).not.toHaveProperty("nights");
    // productSnapshot is written even when the product lookup misses â€” the
    // Â«Ð£ÑÐ»ÑƒÐ³Ð°Â» cell falls back to the hotel name (productId stays unset).
    expect(data.productSnapshot).toMatchObject({
      productTitle: "Rixos",
      productType: "TOUR",
      type: "TOUR",
    });
    expect((data.productSnapshot as Record<string, unknown>).productId).toBeUndefined();
    expect(data.productId).toBeNull();
    // Â«ÐŸÐ¾Ð´Ñ‚Ð². Ñ†ÐµÐ½Ð°Â» = server-authoritative re-check right after service selection
    expect(data.confirmedPrice).toBe(1050);
    expect(data.confirmedCurrency).toBe("AZN");
  });

  it("Phase 3 Â§20: working commercial snapshot frozen at creation from the recheck pricing block", async () => {
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
      supplierCurrency: "AZN",
      markupRate: "0.05",
      markupAmount: 50,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      publicPrice: 1050,
      individualDiscount: false,
      discountAmount: 0,
      customerFinalPrice: 1050,
      customerCurrency: "AZN",
      priceSource: "PUBLIC",
      supplierPriceFetchedAt: fetchedAt.toISOString(),
      supplierPriceExpiresAt: expiresAt.toISOString(),
      customerAcceptedAt: null,
    });
    expect(data.displayedPrice).toBe(1050);
  });

  it("recheck without pricing block â†’ legacy request (no commercialSnapshot)", async () => {
    const h = makeHarness();
    const raw = snapshot();
    delete (raw as { pricing?: unknown }).pricing;
    h.offerService.refreshPrice.mockResolvedValue(raw);

    await h.service.createTourRequest(DTO);

    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.commercialSnapshot).toBeUndefined();
    expect(data.displayedPrice).toBe(1050);
    // Product rule: Â«ÐŸÐ¾Ð´Ñ‚Ð². Ñ†ÐµÐ½Ð°Â» = Ð¿Ñ€Ð¸Ð½ÑÑ‚Ð°ÌÑ Ñ†ÐµÐ½Ð° Ð²Ð¸Ñ‚Ñ€Ð¸Ð½Ñ‹ at card creation â€”
    // frozen unconditionally (money-gate sees confirmed === displayed anyway).
    expect(data.confirmedPrice).toBe(1050);
    expect(data.confirmedCurrency).toBe("AZN");
    // â€¦but the productSnapshot is still written for the Â«Ð£ÑÐ»ÑƒÐ³Ð°Â» cell
    expect(data.productSnapshot).toMatchObject({ productTitle: "Rixos", productType: "TOUR" });
  });

  it("Phase 1 FX strict gate: recheck Ð² USD Ð±ÐµÐ· fx-Ð±Ð»Ð¾ÐºÐ° â†’ controlled error (Ð½Ð¸ÐºÐ¾Ð³Ð´Ð° Ð½Ðµ Ð·Ð°ÑÐ²Ð¸Ñ‚ÑŒ AZN)", async () => {
    const h = makeHarness();
    const raw = snapshot();
    // ÐŸÐ¾ÑÑ‚Ð°Ð²Ñ‰Ð¸Ðº Ð²ÐµÑ€Ð½ÑƒÐ» USD-Ð´ÐµÐ½ÑŒÐ³Ð¸ Ð±ÐµÐ· fx-Ð±Ð»Ð¾ÐºÐ° â€” ÐºÑƒÑ€ÑÐ° Ð½ÐµÑ‚, ÐºÐ¾Ð½Ð²ÐµÑ€Ñ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ
    // Ð½ÐµÑ‡ÐµÐ¼. ÐÐ¸ÐºÐ¾Ð³Ð´Ð° Ð½Ðµ Ð¿Ð¾Ð´Ð¼ÐµÐ½ÑÑ‚ÑŒ 1 Ð¸ Ð½Ðµ Ð¿Ð¸ÑÐ°Ñ‚ÑŒ snapshot ÐºÐ°Ðº AZN.
    raw.currency = "USD";
    raw.pricing = {
      supplierAmount: 1000,
      currency: "USD",
      markupRate: "0.05",
      markupAmount: 50,
      publicAmount: 1050,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      configurationState: "CONFIGURED",
      calculatedAt: new Date().toISOString(),
    };
    h.offerService.refreshPrice.mockResolvedValue(raw);

    await expect(h.service.createTourRequest(DTO)).rejects.toThrow(/missing FX rate/);
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("Phase 1 FX: recheck Ð² USD Ñ fx-Ð±Ð»Ð¾ÐºÐ¾Ð¼ â†’ snapshot frozen Ð² AZN Ñ SOURCE-Ñ„Ð°ÐºÑ‚Ð°Ð¼Ð¸", async () => {
    const h = makeHarness();
    const raw = snapshot();
    raw.currency = "AZN"; // snapshot-Ð´ÐµÐ½ÐµÐ¶Ð½Ð°Ñ Ñ†ÐµÐ¿Ð¾Ñ‡ÐºÐ° Ð² AZN Ð¿Ð¾ÑÐ»Ðµ convert
    raw.amount = 1785;
    raw.pricing = {
      supplierAmount: 1000, // SOURCE USD
      currency: "USD",
      publicCurrency: "AZN",
      markupRate: "0.05",
      markupAmount: 85, // 1700 Ã— 5%
      publicAmount: 1785,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      configurationState: "CONFIGURED",
      calculatedAt: new Date().toISOString(),
      fx: {
        sourceAmount: 1000,
        sourceCurrency: "USD",
        rate: "1.7",
        rateCode: "SFX-00000001",
        aznAmount: 1700,
        convertedAt: new Date("2026-10-10T00:00:00Z").toISOString(),
      },
    };
    h.offerService.refreshPrice.mockResolvedValue(raw);

    await h.service.createTourRequest(DTO);

    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.commercialSnapshot).toMatchObject({
      supplierPrice: 1000, // SOURCE
      supplierCurrency: "USD",
      customerCurrency: "AZN",
      publicPrice: 1785,
      customerFinalPrice: 1785,
      fx: { sourceAmount: 1000, sourceCurrency: "USD", rate: "1.7", aznAmount: 1700 },
    });
    expect(data.displayedPrice).toBe(1785);
    expect(data.displayedCurrency).toBe("AZN");
  });

  it("legacy (no customer block) â†’ request created unlinked, resolver untouched", async () => {
    const h = makeHarness();

    await h.service.createTourRequest(DTO);

    expect(resolveCustomerMock).not.toHaveBeenCalled();
    expect(h.crm.createCustomer).not.toHaveBeenCalled();
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.customerId).toBeNull();
  });
});

describe("TourRequestService â€” Â§4.8 traveler identity (Request Modal contract)", () => {
  const CUSTOMER = {
    phone: "+994501112233",
    email: "Traveler@Example.COM",
    firstName: "Ali",
    lastName: "Veliev",
  };

  it("invalid phone â†’ ValidationDomainError 422, no supplier re-check, no resolver", async () => {
    const h = makeHarness();

    await expect(
      h.service.createTourRequest({ ...DTO, customer: { ...CUSTOMER, phone: "123" } }),
    ).rejects.toThrow(ValidationDomainError);
    await expect(
      h.service.createTourRequest({ ...DTO, customer: { ...CUSTOMER, phone: "abc" } }),
    ).rejects.toThrow("Invalid phone number");

    expect(h.offerService.refreshPrice).not.toHaveBeenCalled();
    expect(resolveCustomerMock).not.toHaveBeenCalled();
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("empty phone â†’ ValidationDomainError 422 (phone is required within customer)", async () => {
    const h = makeHarness();

    await expect(
      h.service.createTourRequest({ ...DTO, customer: { ...CUSTOMER, phone: "" } }),
    ).rejects.toThrow("Invalid phone number");
    expect(h.offerService.refreshPrice).not.toHaveBeenCalled();
  });

  it("invalid email format â†’ ValidationDomainError 422 before the supplier call", async () => {
    const h = makeHarness();

    await expect(
      h.service.createTourRequest({ ...DTO, customer: { ...CUSTOMER, email: "not-an-email" } }),
    ).rejects.toThrow("Invalid email address");

    expect(h.offerService.refreshPrice).not.toHaveBeenCalled();
    expect(resolveCustomerMock).not.toHaveBeenCalled();
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("matched by phone (empty email allowed) â†’ links existing customerId, no create", async () => {
    const h = makeHarness();
    resolveCustomerMock.mockResolvedValue({
      status: "MATCHED",
      customerId: "c-match",
      candidates: ["c-match"],
      canonicalPhone: "+994501112233",
      source: "phone",
    });

    await h.service.createTourRequest({
      ...DTO,
      customer: { phone: "+994501112233", email: "" },
    });

    expect(resolveCustomerMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ phone: "+994501112233" }),
    );
    expect(h.crm.createCustomer).not.toHaveBeenCalled();
    expect(h.offerService.refreshPrice).toHaveBeenCalled();
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.customerId).toBe("c-match");
    expect(data.displayedPrice).toBe(1050);
  });

  it("unmatched + email â†’ creates Customer (normalized email, E.164 phone) and links", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({ ...DTO, customer: CUSTOMER });

    expect(h.crm.createCustomer).toHaveBeenCalledWith(
      {
        type: "PERSON",
        firstName: "Ali",
        lastName: "Veliev",
        email: "traveler@example.com",
        phone: "+994501112233",
      },
      "public-request",
    );
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.customerId).toBe("c-new");
  });

  it("unmatched + empty email â†’ request stays unlinked (no fake identity data)", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({
      ...DTO,
      customer: { phone: "+994501112233", email: "", firstName: "Ali" },
    });

    expect(h.crm.createCustomer).not.toHaveBeenCalled();
    const data = h.prisma.request.create.mock.calls[0][0].data;
    expect(data.customerId).toBeNull();
  });

  it("ambiguous phone â†’ ConflictError (409), no re-check, no request row", async () => {
    const h = makeHarness();
    resolveCustomerMock.mockResolvedValue({
      status: "AMBIGUOUS",
      customerId: null,
      candidates: ["c1", "c2"],
      canonicalPhone: "+994501112233",
      source: "phone",
    });

    await expect(
      h.service.createTourRequest({ ...DTO, customer: CUSTOMER }),
    ).rejects.toThrow(ConflictError);
    await expect(
      h.service.createTourRequest({ ...DTO, customer: CUSTOMER }),
    ).rejects.toThrow(/manual selection required/);

    expect(h.offerService.refreshPrice).not.toHaveBeenCalled();
    expect(h.crm.createCustomer).not.toHaveBeenCalled();
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("local phone format is normalized with country region hint (050â€¦ â†’ +994â€¦)", async () => {
    const h = makeHarness();

    await h.service.createTourRequest({
      ...DTO,
      customer: { phone: "050 111 22 33", country: "az", email: "a@b.com" },
    });

    expect(resolveCustomerMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ phone: "+994501112233" }),
    );
    expect(h.crm.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+994501112233" }),
      "public-request",
    );
  });
});

/**
 * TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX (Â§5/Â§6/Â§7/Â§15) â€” REGRESSION
 * for the previously untested tour-offer path.
 *
 * Root defect: createTourRequest wrote the OFFER snapshot into
 * Request.pinnedRequirements, so tour-offer-originated Orders reached
 * TravelerCollectionPanel with ZERO input fields (fieldsFor filtered every key
 * out) and the D3 lifecycle was unreachable.
 *
 * Required assertions (Â§15):
 *  - pin = canonical TOUR requirements (product-less AND product-backed);
 *  - hotel / room / meal / externalOfferId are NOT traveler requirement keys;
 *  - offer facts remain preserved in productSnapshot.offer (Â§6).
 */
describe("TourRequestService â€” data-shape fix: pinnedRequirements = TravelerFullRequirements", () => {
  const OFFER_KEYS = [
    "supplierCode",
    "externalOfferId",
    "hotel",
    "hotelExternalId",
    "departureDate",
    "nights",
    "adults",
    "children",
    "childAges",
    "room",
    "meal",
    "destination",
    "departureCity",
    "country",
  ];

  const TOUR_DEFAULTS = {
    firstName: "REQUIRED",
    lastName: "REQUIRED",
    birthDate: "REQUIRED",
    citizenship: "REQUIRED",
    gender: "NOT_REQUESTED",
    passportSeries: "REQUIRED",
    passportNumber: "REQUIRED",
    passportExpiry: "REQUIRED",
  };

  const created = (h: Harness) => h.prisma.request.create.mock.calls[0][0].data;

  it("product-less (productId = null) â†’ canonical TOUR pin; offer facts in productSnapshot.offer", async () => {
    const h = makeHarness(); // product.findFirst â†’ null (ANEX-style, no catalog hit)

    await h.service.createTourRequest({
      ...DTO,
      destination: "Antalya",
      departureCity: "Baku",
      country: "Turkey",
      childAges: [5],
    });

    const data = created(h);
    expect(data.productId).toBeNull();

    // Â§7: requirements are NOT a Product prerequisite.
    expect(data.pinnedRequirements).toEqual(TOUR_DEFAULTS);

    // Â§15: no offer key may leak into the traveler requirements map.
    for (const key of OFFER_KEYS) {
      expect(data.pinnedRequirements).not.toHaveProperty(key);
    }

    // Â§6: every offer fact survives in the existing product snapshot.
    expect((data.productSnapshot as Record<string, any>).offer).toMatchObject({
      supplierCode: "KOMPAS",
      externalOfferId: "35000",
      hotel: "Rixos",
      hotelExternalId: "2807",
      departureDate: "2026-09-19",
      nights: 7,
      adults: 2,
      children: 0,
      childAges: [5],
      room: "DBL",
      meal: "AI",
      destination: "Antalya",
      departureCity: "Baku",
      country: "Turkey",
    });
  });

  it("product-backed with Product.travelerRequirements â†’ Product override wins over TOUR defaults", async () => {
    const h = makeHarness();
    h.prisma.product.findFirst.mockResolvedValue({
      id: "p1",
      code: "PRD-1",
      title: "Rixos",
      travelerRequirements: {
        birthDate: "OPTIONAL",
        passportNumber: "OPTIONAL",
        citizenship: "OPTIONAL",
      },
    });

    await h.service.createTourRequest(DTO);

    const data = created(h);
    expect(data.productId).toBe("p1");
    // Two-stage Â§3: TOUR defaults ÑÑ‚Ñ€Ð¾Ð¶Ðµ â€” override Ð¾Ð±ÑÐ·Ð°Ð½ Ð¸Ñ… Ð¿ÐµÑ€ÐµÐºÑ€Ñ‹Ð²Ð°Ñ‚ÑŒ.
    expect(data.pinnedRequirements).toEqual({
      ...TOUR_DEFAULTS,
      birthDate: "OPTIONAL",
      citizenship: "OPTIONAL",
      passportNumber: "OPTIONAL",
    });
    expect(data.pinnedRequirements).not.toHaveProperty("hotel");
    expect(data.pinnedRequirements).not.toHaveProperty("externalOfferId");
  });

  it("product-backed WITHOUT travelerRequirements â†’ resolver defaults (no hand-written default object)", async () => {
    const h = makeHarness();
    h.prisma.product.findFirst.mockResolvedValue({ id: "p1", code: "PRD-1", title: "Rixos" });

    await h.service.createTourRequest(DTO);

    const data = created(h);
    expect(data.pinnedRequirements).toEqual(TOUR_DEFAULTS);
    // â€¦and the offer facts still land in the snapshot (Ð½Ðµ Ñ‚ÐµÑ€ÑÑŽÑ‚ÑÑ).
    expect((data.productSnapshot as Record<string, any>).offer).toMatchObject({
      hotel: "Rixos",
      externalOfferId: "35000",
    });
  });

  it("universal-search request requires first name, last name and valid email before supplier call", async () => {
    const h = makeHarness();
    await expect(
      h.service.createTourRequest({ ...DTO, source: "UNIVERSAL_SEARCH", customer: { phone: "+994501234567", firstName: "A", lastName: "" } }),
    ).rejects.toThrow(ValidationDomainError);
    expect(h.offerService.refreshPrice).not.toHaveBeenCalled();
    expect(h.prisma.request.create).not.toHaveBeenCalled();
  });

  it("universal-search request stores customer contact and search id in the offer snapshot", async () => {
    const h = makeHarness();
    const customer = { phone: "+994501234567", email: "guest@example.com", firstName: "Aysel", lastName: "Mammadova" };
    await h.service.createTourRequest({
      ...DTO,
      source: "UNIVERSAL_SEARCH",
      searchId: "search-42",
      idempotencyKey: "retry-1",
      customer,
    });
    const data = created(h);
    expect(data.productSnapshot.offer).toMatchObject({
      searchId: "search-42",
      idempotencyKey: "retry-1",
      customer,
    });
  });
});

