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

/**
 * Hotel Identity Fix B (HOTEL_IDENTITY_AUDIT_REPORT §11 option C) —
 * conversion projection for product-less Requests with a valid frozen
 * productSnapshot (manual / live-sales contract §12):
 *   - projection precedence: live Product snapshot → frozen Request.productSnapshot;
 *   - convert must NOT be false solely because productId is NULL;
 *   - all execution gates (status/acceptance/money/permissions/already-converted)
 *     stay intact — projection only repairs the snapshot source.
 */
import {
  computeRequestAvailableActions,
  buildRequestProjectionProductSnapshot,
} from "./request.service";

describe("computeRequestAvailableActions — product-less conversion projection (Fix B)", () => {
  const FROZEN_SNAPSHOT = {
    productId: "",
    productCode: "",
    productTitle: "CONSTANTINOPOLIS HOTEL Бутик (Султанахмет)",
    productType: "TOUR",
  };
  const BASE = {
    convertedOrderId: null as string | null,
    customerActionDeadline: null as Date | null,
    customerAcceptedAt: new Date("2026-10-06T09:29:39Z"),
    pinnedRequirements: { supplierCode: "SUMMERTOUR", hotelExternalId: "1144" } as unknown,
    travelerCount: 2 as number | null,
    confirmedPrice: 698.76 as unknown,
    confirmedCurrency: "USD" as string | null,
    displayedPrice: 698.76 as unknown,
    displayedCurrency: "USD" as string | null,
  };
  const GRANTED = ["order.edit_noncritical"];

  it("positive: productId=NULL + valid frozen snapshot + CUSTOMER_ACCEPTED + money → convert=true", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
      },
      GRANTED,
    );
    expect(actions.convert).toBe(true);
  });

  it("precedence: live Product snapshot builds from Product; NULL product → frozen fallback path", () => {
    const live = buildRequestProjectionProductSnapshot({
      id: "p-live",
      code: "PRD-1",
      title: "Live",
      type: "TOUR" as never,
      travelerRequirements: null,
    });
    expect(live).toMatchObject({ productId: "p-live" });
    expect(buildRequestProjectionProductSnapshot(null)).toBeNull();
  });

  it("negative: frozen snapshot absent → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        productSnapshot: null,
      },
      GRANTED,
    );
    expect(actions.convert).toBe(false);
  });

  it("negative: status invalid (CONFIRMED) → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CONFIRMED" as never,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
      },
      GRANTED,
    );
    expect(actions.convert).toBe(false);
  });

  it("negative: money invalid (zero confirmed/displayed) → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
        confirmedPrice: 0,
        displayedPrice: 0,
      },
      GRANTED,
    );
    expect(actions.convert).toBe(false);
  });

  it("negative: already converted (convertedOrderId set) → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
        convertedOrderId: "ord-1",
      },
      GRANTED,
    );
    expect(actions.convert).toBe(false);
  });

  it("negative: permission missing (order.edit_noncritical not granted) → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
      },
      [],
    );
    expect(actions.convert).toBe(false);
  });

  it("negative: acceptance snapshot absent (customerAcceptedAt NULL) → convert=false", () => {
    const actions = computeRequestAvailableActions(
      {
        ...BASE,
        status: "CUSTOMER_ACCEPTED" as never,
        customerAcceptedAt: null,
        productSnapshot: FROZEN_SNAPSHOT as unknown,
      },
      GRANTED,
    );
    expect(actions.convert).toBe(false);
  });
});
