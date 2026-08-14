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
  validateFrozenMoneyFact,
  validateFrozenSnapshot,
  type FrozenSnapshotInput,
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

  // ── Step 2.11 — canonical pricing / financial snapshot contract ────────────

  describe("validateFrozenMoneyFact (Step 2.11)", () => {
    it("accepts valid amount + ISO currency", () => {
      expect(() => validateFrozenMoneyFact("100.00", "USD")).not.toThrow();
      expect(() => validateFrozenMoneyFact("0", "AZN")).not.toThrow();
    });
    it("rejects invalid amount (negative / non-decimal / overflow)", () => {
      expect(() => validateFrozenMoneyFact("-1", "USD")).toThrow(ValidationDomainError);
      expect(() => validateFrozenMoneyFact("abc", "USD")).toThrow(ValidationDomainError);
      expect(() => validateFrozenMoneyFact("10000000000", "USD")).toThrow(ValidationDomainError);
    });
    it("rejects missing / non-ISO currency — деньги без валюты не имеют семантики", () => {
      expect(() => validateFrozenMoneyFact("100", "")).toThrow(ValidationDomainError);
      expect(() => validateFrozenMoneyFact("100", "usd")).toThrow(ValidationDomainError);
      expect(() => validateFrozenMoneyFact("100", "USD2")).toThrow(ValidationDomainError);
    });
  });

  describe("validateFrozenSnapshot (Step 2.11 consistency gate)", () => {
    const snapshot = (over: Partial<FrozenSnapshotInput> = {}): FrozenSnapshotInput => ({
      currency: "USD",
      lines: [
        { unitPrice: "99.99", quantity: 2, amount: "199.98" }, // 99.99 × 2
        { unitPrice: "10", quantity: 1, amount: "10" },
      ],
      subtotal: "209.98",
      discountType: QuoteDiscountType.PERCENTAGE,
      discountValue: "10",
      discountAmount: "21", // round_half_up(209.98 × 10% = 20.998) = 21
      total: "188.98",
      ...over,
    });

    it("accepts a consistent frozen snapshot (line/subtotal/discount/total)", () => {
      expect(() => validateFrozenSnapshot(snapshot())).not.toThrow();
    });
    it("accepts NONE discount (discountAmount 0, total = subtotal)", () => {
      expect(() =>
        validateFrozenSnapshot(
          snapshot({ discountType: QuoteDiscountType.NONE, discountValue: null, discountAmount: "0", total: "209.98" }),
        ),
      ).not.toThrow();
    });
    it("rejects line amount inconsistent with unitPrice × quantity", () => {
      expect(() => validateFrozenSnapshot(snapshot({ lines: [{ unitPrice: "99.99", quantity: 2, amount: "200.00" }] }))).toThrow(
        ValidationDomainError,
      );
    });
    it("rejects subtotal inconsistent with line amounts", () => {
      expect(() => validateFrozenSnapshot(snapshot({ subtotal: "200.00" }))).toThrow(ValidationDomainError);
    });
    it("rejects discountAmount inconsistent with discount type/value", () => {
      expect(() => validateFrozenSnapshot(snapshot({ discountAmount: "20" }))).toThrow(ValidationDomainError);
      // PERCENTAGE без value — невалидный snapshot
      expect(() => validateFrozenSnapshot(snapshot({ discountValue: null }))).toThrow(ValidationDomainError);
      // NONE с value — невалидный snapshot
      expect(() =>
        validateFrozenSnapshot(snapshot({ discountType: QuoteDiscountType.NONE, discountValue: "5", discountAmount: "0" })),
      ).toThrow(ValidationDomainError);
    });
    it("rejects total inconsistent with subtotal − discountAmount", () => {
      expect(() => validateFrozenSnapshot(snapshot({ total: "188.00" }))).toThrow(ValidationDomainError);
      expect(() => validateFrozenSnapshot(snapshot({ total: "-1" }))).toThrow(ValidationDomainError);
    });
    it("rejects overflow / bad currency / empty lines", () => {
      // Сумма строк превышает DECIMAL(12,2) → 422, не Prisma numeric overflow.
      expect(() =>
        validateFrozenSnapshot(
          snapshot({
            lines: [
              { unitPrice: "9999999999.99", quantity: 1, amount: "9999999999.99" },
              { unitPrice: "9999999999.99", quantity: 1, amount: "9999999999.99" },
            ],
          }),
        ),
      ).toThrow(ValidationDomainError);
      expect(() => validateFrozenSnapshot(snapshot({ currency: "usd" }))).toThrow(ValidationDomainError);
      expect(() => validateFrozenSnapshot(snapshot({ lines: [] }))).toThrow(ValidationDomainError);
    });
  });
});
