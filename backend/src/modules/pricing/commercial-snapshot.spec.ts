/**
 * Supplier Markup (STRICT PROMPT Phase 3 §20 / design §7-§8) — commercial
 * snapshot acceptance gates.
 *
 * Mandatory test matrix (§30):
 *  - floor: supplier 1000 / public 1050 / discount 30 → final 1020 PASS;
 *           supplier 1000 / public 1050 / discount 60 → final 990 REJECT;
 *  - invalid supplier price: 0 / negative / missing → REJECT;
 *  - missing currency → REJECT;
 *  - invalid public price / invalid final price → REJECT;
 *  - snapshot freeze stamps customerAcceptedAt (Gate F basis);
 *  - individual discount never alters publicPrice (§11).
 */
import { QuoteDiscountType } from "../../generated/prisma/enums";
import { ValidationDomainError } from "../../shared/errors";
import type { MarkupPricingJson } from "./pricing.types";
import {
  CommercialSnapshot,
  applyIndividualDiscount,
  buildWorkingSnapshot,
  freezeForAcceptance,
  validateForAcceptance,
} from "./commercial-snapshot";

function pricingBlock(overrides: Partial<MarkupPricingJson> = {}): MarkupPricingJson {
  return {
    supplierAmount: 1000,
    currency: "USD",
    markupRate: "0.05",
    markupAmount: 50,
    publicAmount: 1050,
    markupRuleCode: "MKR-00000001",
    markupRuleVersion: 1,
    configurationState: "CONFIGURED",
    calculatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function working(overrides: Partial<MarkupPricingJson> = {}): CommercialSnapshot {
  return buildWorkingSnapshot({
    supplierCode: "SUMMERTOUR",
    serviceType: "tours",
    pricing: pricingBlock(overrides),
    supplierPriceFetchedAt: new Date("2026-10-01T10:00:00Z"),
    supplierPriceExpiresAt: new Date("2026-10-01T10:15:00Z"),
  });
}

describe("commercial snapshot — build (§20)", () => {
  it("1000 × 5% = 50 → public 1050; final = public (no discount yet)", () => {
    const s = working();
    expect(s.supplierPrice).toBe(1000);
    expect(s.supplierCurrency).toBe("USD");
    expect(s.markupRate).toBe("0.05");
    expect(s.markupAmount).toBe(50);
    expect(s.markupRuleCode).toBe("MKR-00000001");
    expect(s.markupRuleVersion).toBe(1);
    expect(s.publicPrice).toBe(1050);
    expect(s.customerFinalPrice).toBe(1050);
    expect(s.customerCurrency).toBe("USD");
    expect(s.priceSource).toBe("PUBLIC");
    expect(s.individualDiscount).toBe(false);
    expect(s.discountType).toBe(QuoteDiscountType.NONE);
    expect(s.discountAmount).toBe(0);
    expect(s.supplierPriceFetchedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(s.supplierPriceExpiresAt).toBe("2026-10-01T10:15:00.000Z");
    expect(s.customerAcceptedAt).toBeNull();
    expect(() => validateForAcceptance(s, s.customerFinalPrice, s.customerCurrency)).not.toThrow();
  });

  it("Gate E: supplier price 0 / negative / missing → reject at build", () => {
    expect(() => working({ supplierAmount: 0 })).toThrow(/supplierPrice <= 0/);
    expect(() => working({ supplierAmount: -5 })).toThrow(ValidationDomainError);
    expect(() =>
      buildWorkingSnapshot({
        supplierCode: "X",
        serviceType: "tours",
        pricing: { ...pricingBlock(), supplierAmount: undefined as never },
      }),
    ).toThrow(/missing supplier price/);
  });

  it("missing currency → reject at build", () => {
    expect(() => working({ currency: "" })).toThrow(/missing currency/);
  });

  it("inconsistent markup math → invalid public price", () => {
    expect(() => working({ publicAmount: 1051 })).toThrow(/invalid public price/);
    expect(() => working({ markupAmount: 40 })).toThrow(/invalid (markup amount|public price)/);
    expect(() => working({ publicAmount: 0, markupAmount: -1000 })).toThrow(ValidationDomainError);
  });
});

describe("individual discount (§11 / design §14)", () => {
  it("discount does not alter publicPrice / markup", () => {
    const s = applyIndividualDiscount(working(), QuoteDiscountType.FIXED, "30");
    expect(s.publicPrice).toBe(1050); // unchanged
    expect(s.supplierPrice).toBe(1000);
    expect(s.markupAmount).toBe(50);
    expect(s.discountAmount).toBe(30);
    expect(s.individualDiscount).toBe(true);
    expect(s.customerFinalPrice).toBe(1020);
  });

  it("PERCENTAGE discount: 10% of 1050 = 105 → final 945", () => {
    const s = applyIndividualDiscount(working(), QuoteDiscountType.PERCENTAGE, "10");
    expect(s.discountAmount).toBe(105);
    expect(s.customerFinalPrice).toBe(945);
    expect(s.discountValue).toBe(10);
  });

  it("percent > 100 rejected by sales.money primitive", () => {
    expect(() => applyIndividualDiscount(working(), QuoteDiscountType.PERCENTAGE, "150")).toThrow(
      ValidationDomainError,
    );
  });
});

describe("acceptance gate (§13 / design Phase 3)", () => {
  it("floor PASS: supplier 1000 / public 1050 / discount 30 → final 1020", () => {
    const s = applyIndividualDiscount(working(), QuoteDiscountType.FIXED, "30");
    expect(s.customerFinalPrice).toBe(1020);
    expect(() => validateForAcceptance(s, s.customerFinalPrice, "USD")).not.toThrow();
  });

  it("floor REJECT: supplier 1000 / public 1050 / discount 60 → final 990", () => {
    const s = applyIndividualDiscount(working(), QuoteDiscountType.FIXED, "60");
    expect(s.customerFinalPrice).toBe(990);
    expect(() => validateForAcceptance(s, s.customerFinalPrice, "USD")).toThrow(
      /final price < supplier price/,
    );
  });

  it("invalid supplier price: 0 / negative / missing → REJECT", () => {
    expect(() => validateForAcceptance({ ...working(), supplierPrice: 0 })).toThrow(/supplierPrice <= 0/);
    expect(() => validateForAcceptance({ ...working(), supplierPrice: -1 })).toThrow(/supplierPrice <= 0/);
    expect(() => validateForAcceptance({ ...working(), supplierPrice: Number.NaN })).toThrow(
      /missing supplier price/,
    );
  });

  it("missing currency → REJECT", () => {
    expect(() => validateForAcceptance({ ...working(), supplierCurrency: "" })).toThrow(/missing currency/);
    expect(() => validateForAcceptance({ ...working(), customerCurrency: "" })).toThrow(/missing currency/);
    expect(() => validateForAcceptance(working(), 1050, "")).toThrow(/missing currency/);
  });

  it("invalid public price → REJECT (tampered snapshot)", () => {
    expect(() => validateForAcceptance({ ...working(), publicPrice: 0 })).toThrow(/invalid public price/);
    expect(() => validateForAcceptance({ ...working(), publicPrice: 9999 })).toThrow(/invalid public price/);
    expect(() => validateForAcceptance({ ...working(), publicPrice: Number.NaN })).toThrow(
      /invalid public price/,
    );
  });

  it("invalid final price → REJECT (tampered final / inconsistent discount)", () => {
    expect(() => validateForAcceptance({ ...working(), customerFinalPrice: 0 })).toThrow(/invalid final price/);
    expect(() => validateForAcceptance({ ...working(), customerFinalPrice: 999 })).toThrow(
      /invalid final price/,
    );
    expect(() => validateForAcceptance({ ...working(), discountAmount: 30 })).toThrow(/invalid final price/);
  });

  it("accepted money below supplier basis → REJECT (proposal cannot sell below floor)", () => {
    expect(() => validateForAcceptance(working(), 950, "USD")).toThrow(/final price < supplier price/);
    expect(() => validateForAcceptance(working(), 0, "USD")).toThrow(/invalid final price/);
  });

  it("accepted money above floor passes (supplier proposal 1100)", () => {
    expect(() => validateForAcceptance(working(), 1100, "USD")).not.toThrow();
  });
});

describe("freeze (Gate F basis)", () => {
  it("stamps customerAcceptedAt and the accepted final money; validates first", () => {
    const frozen = freezeForAcceptance(working(), 1050, "USD", new Date("2026-10-05T12:00:00Z"));
    expect(frozen.customerAcceptedAt).toBe("2026-10-05T12:00:00.000Z");
    expect(frozen.customerFinalPrice).toBe(1050);
    expect(frozen.supplierPrice).toBe(1000);
    expect(frozen.publicPrice).toBe(1050);
  });

  it("freeze rejects and keeps working-state on floor violation", () => {
    expect(() => freezeForAcceptance(working(), 990, "USD", new Date())).toThrow(
      /final price < supplier price/,
    );
    expect(() => freezeForAcceptance({ ...working(), supplierPrice: 0 }, 1050, "USD", new Date())).toThrow(
      /supplierPrice <= 0/,
    );
  });

  it("§30: changing the active MarkupRule after acceptance does not mutate accepted pricing", () => {
    const workingAt5 = working(); // rule MKR-00000001 @ 5%: 1000 → 1050
    const frozen = freezeForAcceptance(workingAt5, 1050, "USD", new Date("2026-10-05T12:00:00Z"));

    // A later rule (10%) only affects NEW pricing — the accepted snapshot is a
    // frozen value, not a live reference.
    const underNewRule = buildWorkingSnapshot({
      supplierCode: "SUMMERTOUR",
      serviceType: "tours",
      pricing: { ...pricingBlock(), markupRate: "0.10", markupAmount: 100, publicAmount: 1100 },
    });
    expect(underNewRule.publicPrice).toBe(1100);

    expect(frozen.markupRate).toBe("0.05");
    expect(frozen.markupRuleCode).toBe("MKR-00000001");
    expect(frozen.markupRuleVersion).toBe(1);
    expect(frozen.supplierPrice).toBe(1000);
    expect(frozen.publicPrice).toBe(1050);
    expect(frozen.customerFinalPrice).toBe(1050);
    expect(frozen.customerAcceptedAt).toBe("2026-10-05T12:00:00.000Z");
    expect(() => validateForAcceptance(frozen, frozen.customerFinalPrice, frozen.customerCurrency)).not.toThrow();
  });
});
