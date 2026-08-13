/**
 * PHASE 2 STEP 2.10 — finance.money: платформенный денежный контракт
 * (DECIMAL(12,2), half-up 2dp) — единый источник истины sales.money.
 * Тест подтверждает identity контракта: Finance использует те же helpers,
 * что и Quote/Sale/Order/Booking — никакого drift между доменами.
 */
import { Prisma } from "../../generated/prisma/client";
import { MONEY_SCALE, MONEY_MAX, toMoney2 } from "./finance.money";

describe("finance.money — platform money contract", () => {
  it("re-export scale/max идентичны платформенному контракту", () => {
    expect(MONEY_SCALE).toBe(2);
    expect(MONEY_MAX.toString()).toBe("9999999999.99");
  });

  it("toMoney2: half-up 2dp, без JS float drift", () => {
    expect(toMoney2("0.1").add(toMoney2("0.2")).toString()).toBe("0.3");
    expect(toMoney2("19.99").toString()).toBe("19.99");
    expect(toMoney2("123.456").toString()).toBe("123.46"); // half-up
    expect(toMoney2("1.005").toString()).toBe("1.01");
  });

  it("toMoney2: Decimal out — без повторного округления", () => {
    const d = new Prisma.Decimal("12.345").toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    expect(toMoney2(d).toString()).toBe("12.35");
  });

  it("toMoney2: отклоняет negative / non-finite / overflow", () => {
    expect(() => toMoney2("-1")).toThrow();
    expect(() => toMoney2("NaN")).toThrow();
    expect(() => toMoney2("10000000000.00")).toThrow(); // > DECIMAL(12,2)
  });
});
