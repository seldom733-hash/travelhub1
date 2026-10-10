/**
 * Supplier Markup (STRICT PROMPT Phase 3 §13 / §30) — customerAccept gates.
 *
 * Acceptance must reject:
 *   supplierPrice <= 0 / missing supplier price / missing currency /
 *   invalid public price / invalid final price / final < supplier
 *
 * Also proves (§30):
 *  - floor: supplier 1000 / public 1050 / discount 30 → final 1020 PASS;
 *           supplier 1000 / public 1050 / discount 60 → final 990 REJECT;
 *  - proposal below the supplier basis → REJECT (no selling below floor);
 *  - legacy request without snapshot → money-gate only (e2e parity);
 *  - frozen snapshot (customerAcceptedAt + accepted final) written on accept.
 *
 * Order conversion money-gate (order.service:658-661) is NOT touched here.
 */
import { QuoteDiscountType } from "../../generated/prisma/enums";
import { ValidationDomainError } from "../../shared/errors";
import {
  applyIndividualDiscount,
  buildWorkingSnapshot,
} from "../pricing/commercial-snapshot";
import { RequestService } from "./request.service";

function workingSnapshot() {
  return buildWorkingSnapshot({
    supplierCode: "KOMPAS",
    serviceType: "tours",
    pricing: {
      supplierAmount: 1000,
      currency: "USD",
      markupRate: "0.05",
      markupAmount: 50,
      publicAmount: 1050,
      markupRuleCode: "MKR-00000001",
      markupRuleVersion: 1,
      configurationState: "CONFIGURED",
      calculatedAt: "2026-10-01T10:00:00.000Z",
    },
    supplierPriceFetchedAt: "2026-10-01T10:00:00.000Z",
    supplierPriceExpiresAt: "2026-10-01T10:15:00.000Z",
  });
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    code: "REQ-1",
    status: "PRICE_CHANGED",
    customerActionDeadline: null,
    customerId: null,
    productId: null,
    partnerId: null,
    quantity: 1,
    travelerCount: null,
    pinnedRequirements: null,
    productSnapshot: null,
    displayedPrice: 1050,
    displayedCurrency: "USD",
    supplierPriceProposal: null,
    commercialSnapshot: workingSnapshot(),
    ...overrides,
  };
}

interface Harness {
  service: RequestService;
  prisma: {
    request: { findUnique: jest.Mock; update: jest.Mock };
    product: { findUnique: jest.Mock };
    requestHistory: { create: jest.Mock };
    requestTraveler: { findMany: jest.Mock };
  };
  security: { audit: jest.Mock };
}

/** Two-stage §6: базовый «готовый» состав Request-стадии (FIO + birthDate). */
function readyTravelers(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    requestId: "r1",
    position: i + 1,
    firstName: `IVAN${i + 1}`,
    lastName: `IVANOV${i + 1}`,
    birthDate: new Date("1990-01-01T00:00:00.000Z"),
  }));
}

function makeHarness(
  row: Record<string, unknown>,
  travelers: Record<string, unknown>[] = readyTravelers(),
): Harness {
  const prisma = {
    request: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({ ...row, status: "CUSTOMER_ACCEPTED" }),
    },
    product: { findUnique: jest.fn().mockResolvedValue(null) },
    requestHistory: { create: jest.fn().mockResolvedValue({}) },
    requestTraveler: { findMany: jest.fn().mockResolvedValue(travelers) },
  };
  const security = { audit: jest.fn().mockResolvedValue(undefined) };
  const service = new RequestService(
    prisma as never,
    {} as never,
    {} as never,
    security as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, security };
}

const ACTOR = { id: "u1", username: "admin" } as never;

function updateData(h: Harness): Record<string, unknown> {
  return h.prisma.request.update.mock.calls[0][0].data;
}

describe("customerAccept — commercial acceptance gate (Phase 3 §13)", () => {
  it("floor PASS: supplier 1000 / public 1050 / discount 30 → final 1020 accepted + frozen", async () => {
    const snapshot = applyIndividualDiscount(workingSnapshot(), QuoteDiscountType.FIXED, "30");
    expect(snapshot.customerFinalPrice).toBe(1020);
    const h = makeHarness(requestRow({ commercialSnapshot: snapshot, displayedPrice: 1020 }));

    await h.service.customerAccept("r1", ACTOR);

    const data = updateData(h);
    expect(data.status).toBe("CUSTOMER_ACCEPTED");
    expect(data.confirmedPrice).toBe(1020);
    expect(data.confirmedCurrency).toBe("USD");
    const frozen = data.commercialSnapshot as Record<string, unknown>;
    expect(frozen.customerAcceptedAt).toEqual(expect.any(String));
    expect(frozen.customerFinalPrice).toBe(1020);
    expect(frozen.supplierPrice).toBe(1000);
    expect(frozen.publicPrice).toBe(1050); // discount never alters publicPrice
    expect(h.prisma.requestHistory.create).toHaveBeenCalled();
  });

  it("floor REJECT: supplier 1000 / public 1050 / discount 60 → final 990 rejected (422)", async () => {
    const snapshot = applyIndividualDiscount(workingSnapshot(), QuoteDiscountType.FIXED, "60");
    expect(snapshot.customerFinalPrice).toBe(990);
    const h = makeHarness(requestRow({ commercialSnapshot: snapshot, displayedPrice: 990 }));

    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /final price < supplier price/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
    expect(h.prisma.requestHistory.create).not.toHaveBeenCalled();
  });

  it("invalid supplier price (supplierPrice 0 / negative) → rejected", async () => {
    const zero = { ...workingSnapshot(), supplierPrice: 0 };
    const h1 = makeHarness(requestRow({ commercialSnapshot: zero }));
    await expect(h1.service.customerAccept("r1", ACTOR)).rejects.toThrow(/supplierPrice <= 0/);
    expect(h1.prisma.request.update).not.toHaveBeenCalled();

    const neg = { ...workingSnapshot(), supplierPrice: -1 };
    const h2 = makeHarness(requestRow({ commercialSnapshot: neg }));
    await expect(h2.service.customerAccept("r1", ACTOR)).rejects.toThrow(/supplierPrice <= 0/);
  });

  it("missing supplier price (null) → rejected", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: { ...workingSnapshot(), supplierPrice: null } }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(/missing supplier price/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("missing currency → rejected", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: { ...workingSnapshot(), supplierCurrency: "" } }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(/missing currency/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("invalid public price (tampered snapshot) → rejected", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: { ...workingSnapshot(), publicPrice: 9999 } }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(/invalid public price/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("invalid final price (tampered final) → rejected", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: { ...workingSnapshot(), customerFinalPrice: 0 } }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(/invalid final price/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("supplier proposal below the basis (950 < 1000) → rejected; above (1100) → accepted", async () => {
    const hLow = makeHarness(
      requestRow({ status: "CONFIRMED", supplierPriceProposal: 950, displayedPrice: 950 }),
    );
    await expect(hLow.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /final price < supplier price/,
    );
    expect(hLow.prisma.request.update).not.toHaveBeenCalled();

    const hHigh = makeHarness(
      requestRow({ status: "CONFIRMED", supplierPriceProposal: 1100, displayedPrice: 1100 }),
    );
    await hHigh.service.customerAccept("r1", ACTOR);
    const data = updateData(hHigh);
    expect(data.confirmedPrice).toBe(1100);
    const frozen = data.commercialSnapshot as Record<string, unknown>;
    expect(frozen.customerFinalPrice).toBe(1100);
    expect(frozen.supplierPrice).toBe(1000); // supplier basis preserved
    expect(frozen.customerAcceptedAt).toEqual(expect.any(String));
  });

  it("no commercial money anywhere → 400 (never CUSTOMER_ACCEPTED with 0/missing money)", async () => {
    const h = makeHarness(
      requestRow({
        commercialSnapshot: null,
        displayedPrice: null,
        displayedCurrency: null,
        supplierPriceProposal: null,
      }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /no valid commercial money/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("legacy request without snapshot → money-gate only (e2e parity: accepts displayed price)", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: null, displayedPrice: 1050, displayedCurrency: "USD" }),
    );

    await h.service.customerAccept("r1", ACTOR);

    const data = updateData(h);
    expect(data.status).toBe("CUSTOMER_ACCEPTED");
    expect(data.confirmedPrice).toBe(1050);
    expect("commercialSnapshot" in data).toBe(false); // untouched — no snapshot written
  });

  it("invalid status (NEW) → 400, no mutation (deterministic validation)", async () => {
    const h = makeHarness(requestRow({ status: "NEW" }));
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(/Cannot accept in status NEW/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("ValidationDomainError is the rejection type (mapped to 422 by AppExceptionFilter)", async () => {
    const h = makeHarness(
      requestRow({ commercialSnapshot: { ...workingSnapshot(), publicPrice: 1 } }),
    );
    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toBeInstanceOf(
      ValidationDomainError,
    );
  });
});

/**
 * TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX §8 — «do not reintroduce the
 * bug at acceptance»:
 *  - product-less tour request: creation-time pin (canonical TravelerFullRequirements)
 *    is PRESERVED — no second rewrite, no masking of the producer;
 *  - product-backed request: existing rewrite semantics stay (effective
 *    requirements from the Product), but the product snapshot MERGE keeps the
 *    offer facts frozen at creation (productSnapshot.offer) — §6 no data loss.
 */
describe("customerAccept — data-shape fix §8 (pin preservation / snapshot merge)", () => {
  // Two-stage §3: canonical TOUR pin (birthDate/passport-поля REQUIRED).
  const TRAVELER_PIN = {
    firstName: "REQUIRED",
    lastName: "REQUIRED",
    birthDate: "REQUIRED",
    citizenship: "REQUIRED",
    gender: "NOT_REQUESTED",
    passportSeries: "REQUIRED",
    passportNumber: "REQUIRED",
    passportExpiry: "REQUIRED",
  };

  it("product-less tour request: creation-time traveler pin + offer snapshot are untouched", async () => {
    const h = makeHarness(
      requestRow({
        productId: null,
        pinnedRequirements: { ...TRAVELER_PIN },
        productSnapshot: {
          productTitle: "Rixos",
          productType: "TOUR",
          offer: { hotel: "Rixos", nights: 7, supplierCode: "KOMPAS" },
        },
      }),
    );

    await h.service.customerAccept("r1", ACTOR);

    const data = updateData(h);
    expect(data.status).toBe("CUSTOMER_ACCEPTED");
    // Product-less: pin/snapshot НЕ трогаем (undefined = no-op) — фиксированный
    // при создании канонический traveler-pin сохраняется как есть.
    expect("pinnedRequirements" in data).toBe(false);
    expect("productSnapshot" in data).toBe(false);
    expect(h.prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it("product-backed: pin = effective requirements; productSnapshot.offer survives the identity refresh", async () => {
    const h = makeHarness(
      requestRow({
        productId: "p1",
        pinnedRequirements: { ...TRAVELER_PIN },
        productSnapshot: {
          productTitle: "Rixos",
          productType: "TOUR",
          offer: { hotel: "Rixos", nights: 7, supplierCode: "KOMPAS" },
        },
      }),
    );
    h.prisma.product.findUnique.mockResolvedValue({
      id: "p1",
      code: "PRD-1",
      title: "Rixos",
      type: "TOUR",
      travelerRequirements: { passportNumber: "OPTIONAL" },
    });

    await h.service.customerAccept("r1", ACTOR);

    const data = updateData(h);
    expect(data.pinnedRequirements).toEqual({ ...TRAVELER_PIN, passportNumber: "OPTIONAL" });
    expect(data.productSnapshot).toMatchObject({
      productId: "p1",
      productCode: "PRD-1",
      productTitle: "Rixos",
      productType: "TOUR",
      // §6: offer facts are NOT deleted by the acceptance rewrite (merge).
      offer: { hotel: "Rixos", nights: 7, supplierCode: "KOMPAS" },
    });
  });
});

describe("customerAccept — two-stage traveler readiness gate (§6)", () => {
  it("ready composition (FIO + birthDate, count == travelerCount) → accepted", async () => {
    const h = makeHarness(requestRow({ travelerCount: 1 }), readyTravelers(1));

    await h.service.customerAccept("r1", ACTOR);

    expect(h.prisma.request.update).toHaveBeenCalledTimes(1);
    expect(updateData(h).status).toBe("CUSTOMER_ACCEPTED");
  });

  it("count mismatch (travelerCount=2, rows=1) → 422, request not updated", async () => {
    const h = makeHarness(requestRow({ travelerCount: 2 }), readyTravelers(1));

    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /traveler count mismatch/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
    expect(h.prisma.requestHistory.create).not.toHaveBeenCalled();
  });

  it("empty composition (no RequestTraveler rows) → 422, request not updated", async () => {
    const h = makeHarness(requestRow({ travelerCount: 1 }), []);

    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /traveler count mismatch/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("incomplete traveler (missing birthDate) → 422 «incomplete», request not updated", async () => {
    const h = makeHarness(requestRow({ travelerCount: 1 }), [
      { id: "t1", requestId: "r1", position: 1, firstName: "IVAN", lastName: "IVANOV", birthDate: null },
    ]);

    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /travelers are incomplete/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("readiness is checked BEFORE the money gate (422 traveller error, not money error)", async () => {
    const zero = { ...workingSnapshot(), supplierPrice: 0 };
    const h = makeHarness(requestRow({ commercialSnapshot: zero, travelerCount: 1 }), []);

    await expect(h.service.customerAccept("r1", ACTOR)).rejects.toThrow(
      /traveler count mismatch/,
    );
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });
});
