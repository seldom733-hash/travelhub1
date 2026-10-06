/**
 * Phase 4 (requests table data contract) — requestDto row mapping:
 *  - «Услуга» fallback chain: product table title → productSnapshot.productTitle
 *    → pinnedRequirements.hotel (supplier-created requests are never a dash);
 *  - «Поставщик» = pinned supplierCode (commercialSnapshot/productSnapshot
 *    fallbacks); partner* stays the B2B partner, a separate concept;
 *  - selected-service parameters (nights, party «2+0», country, city) exposed
 *    from the frozen pinnedRequirements;
 *  - legacy/minimal rows map to nulls without throwing.
 */
import { RequestService } from "./request.service";

function makeService(): RequestService {
  return new RequestService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function dtoOf(
  row: Record<string, unknown>,
  productMap: Map<string, any> = new Map(),
  partnerMap: Map<string, any> = new Map(),
) {
  return (makeService() as unknown as {
    requestDto: (
      r: Record<string, unknown>,
      customerMap?: Map<string, any>,
      productMap?: Map<string, any>,
      partnerMap?: Map<string, any>,
    ) => Record<string, unknown>;
  }).requestDto(row, new Map(), productMap, partnerMap);
}

const TOUR_ROW: Record<string, unknown> = {
  id: "r1",
  code: "REQ-1",
  commerceSequence: 1,
  referenceNumber: "MKT-REQ-00000101",
  customerId: null,
  productId: null,
  partnerId: null,
  status: "NEW",
  requestedServiceDate: new Date("2026-09-19"),
  quantity: 1,
  travelerCount: 2,
  displayedPrice: 1050,
  displayedCurrency: "USD",
  confirmedPrice: 1050,
  confirmedCurrency: "USD",
  productSnapshot: { productTitle: "Rixos Dubai", productType: "TOUR" },
  pinnedRequirements: {
    supplierCode: "KAZUNION",
    hotel: "Rixos Dubai",
    nights: 7,
    adults: 2,
    children: 0,
    country: "Turkey",
    destination: "Antalya",
    departureCity: "Baku",
  },
  commercialSnapshot: null,
  createdAt: new Date("2026-10-06T10:00:00Z"),
};

describe("requestDto — requests table data contract (Phase 4)", () => {
  it("tour row without product link: service = snapshot/hotel fallback, supplier + params exposed", () => {
    const dto = dtoOf(TOUR_ROW);

    expect(dto.productName).toBe("Rixos Dubai");
    expect(dto.productCode).toBeNull();
    // «Услуга» type (тур / отель / авиабилет) comes from the frozen snapshot
    expect(dto.serviceType).toBe("TOUR");
    expect(dto.supplierCode).toBe("KAZUNION");
    expect(dto.nights).toBe(7);
    expect(dto.adults).toBe(2);
    expect(dto.children).toBe(0);
    expect(dto.country).toBe("Turkey");
    expect(dto.destination).toBe("Antalya");
    expect(dto.departureCity).toBe("Baku");
    expect(dto.travelerCount).toBe(2);
    expect(dto.confirmedPrice).toBe("1050");
    expect(dto.confirmedCurrency).toBe("USD");
    expect(dto.displayedPrice).toBe("1050");
    // partner stays separate from supplier (B2B partner is not the supplier)
    expect(dto.partnerName).toBeNull();
  });

  it("product table title wins over the snapshot; partner maps render alongside supplier", () => {
    const productMap = new Map([
      ["p1", { id: "p1", code: "PRD-1", title: "Catalog title" }],
    ]);
    const partnerMap = new Map([["pt1", { id: "pt1", code: "PTR-1", name: "Azure Travel" }]]);
    const dto = dtoOf({ ...TOUR_ROW, productId: "p1", partnerId: "pt1" }, productMap, partnerMap);

    expect(dto.productName).toBe("Catalog title");
    expect(dto.productCode).toBe("PRD-1");
    expect(dto.partnerName).toBe("Azure Travel");
    expect(dto.partnerCode).toBe("PTR-1");
    expect(dto.supplierCode).toBe("KAZUNION");
  });

  it("commercialSnapshot supplies the supplier when pinned is absent (legacy shapes)", () => {
    const dto = dtoOf({
      ...TOUR_ROW,
      pinnedRequirements: null,
      productSnapshot: null,
      commercialSnapshot: { supplierCode: "KOMPAS" },
    });

    expect(dto.supplierCode).toBe("KOMPAS");
    expect(dto.productName).toBeNull();
    expect(dto.serviceType).toBeNull();
    expect(dto.nights).toBeNull();
    expect(dto.country).toBeNull();
    expect(dto.destination).toBeNull();
  });

  it("minimal/legacy row maps to nulls without throwing", () => {
    const dto = dtoOf({ id: "r2" });

    expect(dto.productName).toBeNull();
    expect(dto.serviceType).toBeNull();
    expect(dto.supplierCode).toBeNull();
    expect(dto.nights).toBeNull();
    expect(dto.adults).toBeNull();
    expect(dto.children).toBeNull();
    expect(dto.country).toBeNull();
    expect(dto.displayedPrice).toBeNull();
    expect(dto.confirmedPrice).toBeNull();
    expect(dto.status).toBeUndefined();
  });
});
