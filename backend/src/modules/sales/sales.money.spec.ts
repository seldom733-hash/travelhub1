import { Prisma } from "../../generated/prisma/client";
import { QuoteDiscountType } from "../../generated/prisma/enums";
import {
  toMoney2,
  validateDiscountValue,
  lineAmount,
  subtotalOf,
  discountAmountOf,
  totalOf,
  MONEY_SCALE,
  MONEY_MAX,
} from "./sales.money";
import { ValidationDomainError } from "../../shared/errors";

const D = (s: string) => new Prisma.Decimal(s);

describe("sales.money (Step 2.3 quote monetary contract)", () => {
  describe("toMoney2", () => {
    it("normalizes to 2dp half-up", () => {
      expect(toMoney2("99.999").toString()).toBe("100");
      expect(toMoney2("99.994").toString()).toBe("99.99");
      expect(toMoney2("10").toString()).toBe("10");
      expect(toMoney2("0").toString()).toBe("0");
    });
    it("rejects NaN/Infinity", () => {
      expect(() => toMoney2("abc")).toThrow(ValidationDomainError);
      expect(() => toMoney2("Infinity")).toThrow(ValidationDomainError);
      expect(() => toMoney2("NaN")).toThrow(ValidationDomainError);
    });
    it("rejects negative", () => {
      expect(() => toMoney2("-1")).toThrow(ValidationDomainError);
    });
    it("rejects values beyond DECIMAL(12,2) max (overflow guard)", () => {
      expect(toMoney2(MONEY_MAX.toString()).toString()).toBe("9999999999.99");
      expect(() => toMoney2("10000000000")).toThrow(ValidationDomainError);
      expect(() => toMoney2("99999999999999")).toThrow(ValidationDomainError);
      // Rounding вверх может выйти за границу.
      expect(() => toMoney2("9999999999.995")).toThrow(ValidationDomainError);
    });
  });

  describe("validateDiscountValue", () => {
    it("NONE: value must be absent", () => {
      expect(validateDiscountValue(QuoteDiscountType.NONE, undefined)).toBeNull();
      expect(() => validateDiscountValue(QuoteDiscountType.NONE, "5")).toThrow(ValidationDomainError);
    });
    it("PERCENTAGE: 0..100", () => {
      expect(validateDiscountValue(QuoteDiscountType.PERCENTAGE, "12.5")!.toString()).toBe("12.5");
      expect(validateDiscountValue(QuoteDiscountType.PERCENTAGE, "100")!.toString()).toBe("100");
      expect(validateDiscountValue(QuoteDiscountType.PERCENTAGE, "0")!.toString()).toBe("0");
      expect(() => validateDiscountValue(QuoteDiscountType.PERCENTAGE, "100.01")).toThrow(ValidationDomainError);
      expect(() => validateDiscountValue(QuoteDiscountType.PERCENTAGE, "-5")).toThrow(ValidationDomainError);
      expect(() => validateDiscountValue(QuoteDiscountType.PERCENTAGE)).toThrow(ValidationDomainError);
    });
    it("FIXED: >= 0, 2dp", () => {
      expect(validateDiscountValue(QuoteDiscountType.FIXED, "250")!.toString()).toBe("250");
      expect(() => validateDiscountValue(QuoteDiscountType.FIXED, "-1")).toThrow(ValidationDomainError);
    });
  });

  describe("lineAmount", () => {
    it("price * quantity exact", () => {
      expect(lineAmount("99.99", 3).toString()).toBe("299.97");
      expect(lineAmount("10", 1).toString()).toBe("10");
    });
    it("rejects non-positive / non-integer quantity", () => {
      expect(() => lineAmount("10", 0)).toThrow(ValidationDomainError);
      expect(() => lineAmount("10", -1)).toThrow(ValidationDomainError);
      expect(() => lineAmount("10", 1.5)).toThrow(ValidationDomainError);
    });
    it("rejects line overflow beyond DECIMAL(12,2)", () => {
      // 9999999999.99 * 2 > 9999999999.99 → 422, не Prisma numeric overflow.
      expect(() => lineAmount("9999999999.99", 2)).toThrow(ValidationDomainError);
      expect(lineAmount("9999999999.99", 1).toString()).toBe("9999999999.99");
    });
  });

  describe("subtotalOf", () => {
    it("sums exact", () => {
      expect(subtotalOf([D("299.97"), D("10.00")]).toString()).toBe("309.97");
      expect(subtotalOf([]).toString()).toBe("0");
    });
    it("rejects subtotal overflow beyond DECIMAL(12,2)", () => {
      expect(() => subtotalOf([D("9999999999.99"), D("0.01")])).toThrow(ValidationDomainError);
      expect(subtotalOf([D("9999999999.99")]).toString()).toBe("9999999999.99");
    });
  });

  describe("discountAmountOf / totalOf", () => {
    it("NONE → 0, total = subtotal", () => {
      const d = discountAmountOf("309.97", QuoteDiscountType.NONE, null);
      expect(d.toString()).toBe("0");
      expect(totalOf("309.97", d).toString()).toBe("309.97");
    });
    it("PERCENTAGE: round_half_up(subtotal * pct / 100)", () => {
      // 309.97 * 10% = 30.997 → half-up 2dp = 31
      const d = discountAmountOf("309.97", QuoteDiscountType.PERCENTAGE, D("10"));
      expect(d.toString()).toBe("31");
      expect(totalOf("309.97", d).toString()).toBe("278.97");
      // 99.99 * 12.5% = 12.49875 → 12.5
      expect(discountAmountOf("99.99", QuoteDiscountType.PERCENTAGE, D("12.5")).toString()).toBe("12.5");
      // 100% → total 0
      expect(discountAmountOf("50", QuoteDiscountType.PERCENTAGE, D("100")).toString()).toBe("50");
      expect(totalOf("50", D("50")).toString()).toBe("0");
    });
    it("FIXED: точное значение; > subtotal → 422 (СТРОГО, без silent clamp)", () => {
      expect(discountAmountOf("100", QuoteDiscountType.FIXED, D("30")).toString()).toBe("30");
      expect(totalOf("100", D("30")).toString()).toBe("70");
      expect(() => discountAmountOf("100", QuoteDiscountType.FIXED, D("150"))).toThrow(ValidationDomainError);
    });
    it("total must not be negative", () => {
      expect(() => totalOf("10", "20")).toThrow(ValidationDomainError);
    });
    it("scale is 2", () => {
      expect(MONEY_SCALE).toBe(2);
    });
  });
});
