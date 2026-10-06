/**
 * Supplier Markup Phase 4 §4.3 — grantDiscount (Live Sales individual
 * discount, server-authoritative).
 *
 * Покрывает:
 *  - успех: FIXED/PERCENT пересчитывают snapshot из publicPrice/discount
 *    (publicPrice/displayedPrice не меняются) + history discount_granted
 *    + audit request.discount_granted;
 *  - floor: final < supplier price → ValidationDomainError 422 без записи;
 *  - guard'ы: invalid discountType, converted request (immutable),
 *    PRICE_CHANGED / pending supplier proposal (acceptance-контракт Phase 3
 *    отдаёт приоритет proposal → скидка была бы проигнорирована),
 *    отсутствующий snapshot, frozen snapshot, недопустимый статус.
 *
 * Order conversion money-gate (order.service:658-661) НЕ затрагивается.
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
    status: "NEW",
    customerActionDeadline: null,
    customerId: null,
    productId: null,
    partnerId: null,
    quantity: 1,
    travelerCount: null,
    pinnedRequirements: null,
    productSnapshot: null,
    convertedOrderId: null,
    supplierPriceProposal: null,
    displayedPrice: 1050,
    displayedCurrency: "USD",
    commercialSnapshot: workingSnapshot(),
    ...overrides,
  };
}

interface Harness {
  service: RequestService;
  prisma: {
    request: { findUnique: jest.Mock; update: jest.Mock };
    requestHistory: { create: jest.Mock };
  };
  security: { audit: jest.Mock };
}

function makeHarness(row: Record<string, unknown>): Harness {
  const prisma = {
    request: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        ...row,
        ...args.data,
      })),
    },
    requestHistory: { create: jest.fn().mockResolvedValue({}) },
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

const ACTOR = { id: "u1", username: "sales1" } as never;

function updateData(h: Harness): Record<string, unknown> {
  return h.prisma.request.update.mock.calls[0][0].data;
}

describe("grantDiscount — Live Sales server-authoritative discount (Phase 4 §4.3)", () => {
  it("success FIXED 30 → final 1020 stored in snapshot; publicPrice/displayedPrice untouched; history + audit", async () => {
    const h = makeHarness(requestRow());

    const dto = (await h.service.grantDiscount(
      "r1",
      { discountType: QuoteDiscountType.FIXED, discountValue: 30 },
      ACTOR,
    )) as Record<string, unknown>;

    const snapshot = updateData(h).commercialSnapshot as Record<string, unknown>;
    expect(snapshot.customerFinalPrice).toBe(1020);
    expect(snapshot.discountType).toBe("FIXED");
    expect(snapshot.discountAmount).toBe(30);
    expect(snapshot.publicPrice).toBe(1050);
    expect(snapshot.supplierPrice).toBe(1000);
    expect(snapshot.customerAcceptedAt).toBeNull();

    const history = h.prisma.requestHistory.create.mock.calls[0][0].data;
    expect(history.action).toBe("discount_granted");
    expect(history.actorId).toBe("u1");

    expect(h.security.audit).toHaveBeenCalledTimes(1);
    const audit = h.security.audit.mock.calls[0][1];
    expect(audit.action).toBe("request.discount_granted");
    expect(audit.resourceId).toBe("r1");

    expect(dto.commercialSnapshot).toBeDefined();
  });

  it("success PERCENTAGE 4 → final 1008 (4% of public price, above supplier floor)", async () => {
    const h = makeHarness(requestRow({ status: "CONFIRMED" }));

    await h.service.grantDiscount(
      "r1",
      { discountType: QuoteDiscountType.PERCENTAGE, discountValue: "4" },
      ACTOR,
    );

    const snapshot = updateData(h).commercialSnapshot as Record<string, unknown>;
    expect(snapshot.customerFinalPrice).toBe(1008);
    expect(snapshot.discountType).toBe("PERCENTAGE");
  });

  it("floor REJECT: FIXED 60 → final 990 < supplier 1000 → 422, no mutation", async () => {
    const h = makeHarness(requestRow());

    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 60 }, ACTOR),
    ).rejects.toThrow(/final price < supplier price/);
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 60 }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    expect(h.prisma.request.update).not.toHaveBeenCalled();
    expect(h.prisma.requestHistory.create).not.toHaveBeenCalled();
    expect(h.security.audit).not.toHaveBeenCalled();
  });

  it("invalid discountType → 422 with allowed values", async () => {
    const h = makeHarness(requestRow());
    await expect(
      h.service.grantDiscount("r1", { discountType: "CRYPTO", discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/invalid discountType/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("converted request → 422 (commercial snapshot immutable)", async () => {
    const h = makeHarness(requestRow({ convertedOrderId: "ord-1" }));
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/already converted/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("PRICE_CHANGED → 422: supplier price proposal pending (Phase 3 acceptance prefers proposal)", async () => {
    const h = makeHarness(
      requestRow({ status: "PRICE_CHANGED", supplierPriceProposal: 1100 }),
    );
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/supplier price proposal pending/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("pending supplierPriceProposal (any status) → 422 proposal pending", async () => {
    const h = makeHarness(requestRow({ status: "NEW", supplierPriceProposal: 1100 }));
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/supplier price proposal pending/);
  });

  it("missing commercial snapshot → 422 (discount requires priced request)", async () => {
    const h = makeHarness(requestRow({ commercialSnapshot: null }));
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/missing supplier price/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("frozen snapshot (customerAcceptedAt) → 422", async () => {
    const frozen = applyIndividualDiscount(workingSnapshot(), QuoteDiscountType.FIXED, "30");
    const h = makeHarness(
      requestRow({
        status: "CUSTOMER_ACCEPTED",
        commercialSnapshot: { ...frozen, customerAcceptedAt: "2026-10-02T10:00:00.000Z" },
      }),
    );
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/frozen/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("disallowed status (CUSTOMER_ACCEPTED without snapshot freeze marker) → 422", async () => {
    const h = makeHarness(requestRow({ status: "CUSTOMER_ACCEPTED", customerAcceptedAt: null }));
    await expect(
      h.service.grantDiscount("r1", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/discount cannot be applied in status CUSTOMER_ACCEPTED/);
    expect(h.prisma.request.update).not.toHaveBeenCalled();
  });

  it("unknown request → NotFoundException (404)", async () => {
    const h = makeHarness(null as unknown as Record<string, unknown>);
    await expect(
      h.service.grantDiscount("nope", { discountType: QuoteDiscountType.FIXED, discountValue: 10 }, ACTOR),
    ).rejects.toThrow(/not found/i);
  });
});
