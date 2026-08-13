/**
 * PHASE 2 STEP 2.10 — finance.validation unit tests (pure validators).
 */
import {
  assertValidRange,
  FINANCE_MASTER_FORBIDDEN_KEYS,
  validateCountryIso,
  validateIsoCode,
  validateRate,
  validateTaxRate,
} from "./finance.validation";
import { ValidationDomainError } from "../../shared/errors";

describe("finance.validation — ISO 4217", () => {
  it("accepts 3-letter uppercase codes", () => {
    expect(validateIsoCode("USD")).toBe("USD");
    expect(validateIsoCode("AZN")).toBe("AZN");
    expect(validateIsoCode("EUR")).toBe("EUR");
  });

  it("rejects lowercase / wrong length / non-letters", () => {
    expect(() => validateIsoCode("usd")).toThrow(ValidationDomainError);
    expect(() => validateIsoCode("US")).toThrow(ValidationDomainError);
    expect(() => validateIsoCode("US1")).toThrow(ValidationDomainError);
    expect(() => validateIsoCode("")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — ISO 3166-1 alpha-2 (countryIso)", () => {
  it("accepts 2-letter uppercase country codes", () => {
    expect(validateCountryIso("AZ")).toBe("AZ");
    expect(validateCountryIso("RU")).toBe("RU");
    expect(validateCountryIso("DE")).toBe("DE");
  });

  it("rejects locale strings, 3-letter codes, lowercase and empty", () => {
    // locale (ru/az/en) — НЕ страна
    expect(() => validateCountryIso("ru")).toThrow(ValidationDomainError);
    expect(() => validateCountryIso("az")).toThrow(ValidationDomainError);
    // 3-буквенные коды валют/стран не проходят alpha-2
    expect(() => validateCountryIso("AZE")).toThrow(ValidationDomainError);
    expect(() => validateCountryIso("USA")).toThrow(ValidationDomainError);
    expect(() => validateCountryIso("")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — rate (ExchangeRate)", () => {
  it("accepts positive decimal with up to 6 places", () => {
    expect(validateRate("1.7")).toBe("1.7");
    expect(validateRate("1.700000")).toBe("1.700000");
    expect(validateRate("0.000001")).toBe("0.000001");
  });

  it("rejects zero/negative/non-numeric/too many decimals", () => {
    expect(() => validateRate("0")).toThrow(ValidationDomainError);
    expect(() => validateRate("-1")).toThrow(ValidationDomainError);
    expect(() => validateRate("abc")).toThrow(ValidationDomainError);
    expect(() => validateRate("1.0000001")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — tax rate", () => {
  it("accepts non-negative decimal up to 2 places", () => {
    expect(validateTaxRate("0")).toBe("0");
    expect(validateTaxRate("18")).toBe("18");
    expect(validateTaxRate("7.25")).toBe("7.25");
  });

  it("rejects negative / more than 2 decimals", () => {
    expect(() => validateTaxRate("-1")).toThrow(ValidationDomainError);
    expect(() => validateTaxRate("1.234")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — period range", () => {
  it("accepts validTo after validFrom and missing validTo", () => {
    expect(() => assertValidRange("2026-01-01T00:00:00Z", undefined)).not.toThrow();
    expect(() => assertValidRange("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).not.toThrow();
  });

  it("rejects validTo <= validFrom", () => {
    expect(() => assertValidRange("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toThrow(ValidationDomainError);
    expect(() => assertValidRange("2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — forbidden keys", () => {
  it("protects all server-owned fields", () => {
    expect(FINANCE_MASTER_FORBIDDEN_KEYS).toEqual(expect.arrayContaining(["id", "code", "createdAt", "updatedAt", "version"]));
  });
});
