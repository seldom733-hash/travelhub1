/**
 * PHASE 2 STEP 2.3B — Payment Terms pure helpers unit spec.
 * Покрывает: каждую схему, Decimal/rounding, boundaries, reconciliation,
 * invalid field combinations, строгие инварианты (0 < initial < total).
 */
import { Prisma } from "../../generated/prisma/client";
import { PaymentPrepaymentType, PaymentScheme } from "../../generated/prisma/enums";
import { computePaymentTerms } from "./sales.payment-terms";

const D = (v: string) => new Prisma.Decimal(v);

describe("Step 2.3B — sales.payment-terms (pure)", () => {
  describe("FULL_PREPAYMENT", () => {
    it("initial = total, remaining = 0, без параметров", () => {
      const r = computePaymentTerms(D("100.00"), { scheme: PaymentScheme.FULL_PREPAYMENT });
      expect(r.initialAmount.toString()).toBe("100");
      expect(r.remainingAmount.toString()).toBe("0");
      expect(r.prepaymentType).toBeNull();
      expect(r.prepaymentValue).toBeNull();
    });
    it("zero-total edge: initial = 0, remaining = 0 (full prepay корректна)", () => {
      const r = computePaymentTerms(D("0"), { scheme: PaymentScheme.FULL_PREPAYMENT });
      expect(r.initialAmount.toString()).toBe("0");
      expect(r.remainingAmount.toString()).toBe("0");
    });
    it("параметры запрещены → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.FULL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "10" })).toThrow(/does not accept/);
    });
  });

  describe("PARTIAL_PREPAYMENT (percentage)", () => {
    it("30% от 100 → initial 30, remaining 70 (сумма == total)", () => {
      const r = computePaymentTerms(D("100.00"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "30" });
      expect(r.initialAmount.toString()).toBe("30");
      expect(r.remainingAmount.toString()).toBe("70");
      expect(r.initialAmount.plus(r.remainingAmount).toString()).toBe("100");
    });
    it("awkward rounding: 33.33% от 99.99 → round_half_up 33.33, remaining 66.66", () => {
      const r = computePaymentTerms(D("99.99"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "33.33" });
      // 99.99 * 33.33 / 100 = 33.326667 → half-up 2dp = 33.33
      expect(r.initialAmount.toString()).toBe("33.33");
      expect(r.remainingAmount.toString()).toBe("66.66");
      expect(r.initialAmount.plus(r.remainingAmount).toString()).toBe("99.99");
    });
    it("0% → 422; 100% → 422 (use FULL_PREPAYMENT); >100% → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "0" })).toThrow(/must be > 0/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "100" })).toThrow(/use FULL_PREPAYMENT/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "100.01" })).toThrow(/use FULL_PREPAYMENT/);
    });
    it("negative/NaN/malformed → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "-5" })).toThrow(/negative/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "abc" })).toThrow(/valid decimal/);
    });
    it("без prepaymentType/value → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT })).toThrow(/requires prepaymentType/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE })).toThrow(/requires prepaymentValue/);
    });
    it("rounding обнуляет initial при крошечном total → 422 (не 0 initial)", () => {
      // 0.5% от 0.01 = 0.00005 → round 0.00 → 422.
      expect(() => computePaymentTerms(D("0.01"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "0.5" })).toThrow(/0 after rounding/);
    });
  });

  describe("PARTIAL_PREPAYMENT (fixed)", () => {
    it("FIXED 40 от 100 → initial 40, remaining 60", () => {
      const r = computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "40" });
      expect(r.initialAmount.toString()).toBe("40");
      expect(r.remainingAmount.toString()).toBe("60");
      expect(r.prepaymentValue?.toString()).toBe("40");
    });
    it("FIXED == total → 422 (use FULL_PREPAYMENT); FIXED > total → 422; FIXED 0 → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "100" })).toThrow(/use FULL_PREPAYMENT/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "150" })).toThrow(/use FULL_PREPAYMENT/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "0" })).toThrow(/must be > 0/);
    });
    it("FIXED normalization: 40.999 → 41.00 (half-up 2dp)", () => {
      const r = computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "40.999" });
      expect(r.initialAmount.toString()).toBe("41");
    });
  });

  describe("DEPOSIT", () => {
    it("DEPOSIT — часть total: initial=deposit, remaining=total-initial, AT_SERVICE semantics", () => {
      const r = computePaymentTerms(D("300.00"), { scheme: PaymentScheme.DEPOSIT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "90" });
      expect(r.scheme).toBe(PaymentScheme.DEPOSIT);
      expect(r.initialAmount.toString()).toBe("90");
      expect(r.remainingAmount.toString()).toBe("210");
      expect(r.initialAmount.plus(r.remainingAmount).toString()).toBe("300");
    });
    it("DEPOSIT percentage: 30% от 300 → initial 90, remaining 210", () => {
      const r = computePaymentTerms(D("300"), { scheme: PaymentScheme.DEPOSIT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "30" });
      expect(r.initialAmount.toString()).toBe("90");
      expect(r.remainingAmount.toString()).toBe("210");
    });
    it("DEPOSIT не может быть 0 или >= total", () => {
      expect(() => computePaymentTerms(D("300"), { scheme: PaymentScheme.DEPOSIT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "0" })).toThrow(/must be > 0/);
      expect(() => computePaymentTerms(D("300"), { scheme: PaymentScheme.DEPOSIT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "300" })).toThrow(/use FULL_PREPAYMENT/);
    });
    it("DEPOSIT требует параметры (не может быть «deposit без суммы»)", () => {
      expect(() => computePaymentTerms(D("300"), { scheme: PaymentScheme.DEPOSIT })).toThrow(/requires prepaymentType/);
    });
  });

  describe("PAY_LATER / PAY_AT_SERVICE", () => {
    it("PAY_LATER: initial 0, remaining = total (BEFORE_SERVICE)", () => {
      const r = computePaymentTerms(D("250.50"), { scheme: PaymentScheme.PAY_LATER });
      expect(r.initialAmount.toString()).toBe("0");
      expect(r.remainingAmount.toString()).toBe("250.5");
    });
    it("PAY_AT_SERVICE: initial 0, remaining = total (AT_SERVICE) — отличим от PAY_LATER схемой", () => {
      const r = computePaymentTerms(D("250.50"), { scheme: PaymentScheme.PAY_AT_SERVICE });
      expect(r.initialAmount.toString()).toBe("0");
      expect(r.remainingAmount.toString()).toBe("250.5");
      expect(r.scheme).toBe(PaymentScheme.PAY_AT_SERVICE);
    });
    it("параметры запрещены для PAY_LATER/PAY_AT_SERVICE → 422", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PAY_LATER, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: "10" })).toThrow(/does not accept/);
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PAY_AT_SERVICE, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "10" })).toThrow(/does not accept/);
    });
  });

  describe("Reconciliation invariant", () => {
    it("для всех prepaid-схем: initial + remaining == total (awkward values)", () => {
      const cases: Array<[string, string, string]> = [
        ["99.99", "33.33", "66.66"],
        ["0.05", "50", "0.02"], // 0.05*0.5=0.025 → 0.03 (half-up), remaining 0.02 → 0.03+0.02=0.05 ✓
        ["123.45", "17.5", "101.85"], // 123.45*0.175=21.60375 → 21.60, remaining 101.85
      ];
      for (const [total, pct, expectedRemaining] of cases) {
        const r = computePaymentTerms(D(total), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.PERCENTAGE, prepaymentValue: pct });
        expect(r.initialAmount.plus(r.remainingAmount).toString()).toBe(total);
        expect(r.remainingAmount.toString()).toBe(expectedRemaining);
      }
    });
    it("overflow: prepaymentValue за пределами DECIMAL(12,2) → 422, не 500", () => {
      expect(() => computePaymentTerms(D("100"), { scheme: PaymentScheme.PARTIAL_PREPAYMENT, prepaymentType: PaymentPrepaymentType.FIXED, prepaymentValue: "99999999999999" })).toThrow();
    });
  });
});
