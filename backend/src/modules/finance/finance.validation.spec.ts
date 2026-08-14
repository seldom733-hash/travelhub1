/**
 * PHASE 2 STEP 2.10 — finance.validation unit tests (pure validators).
 */
import "reflect-metadata";
import {
  assertValidRange,
  FINANCE_MASTER_FORBIDDEN_KEYS,
  validateCountryIso,
  validateIsoCode,
  validateLedgerAmount,
  validateOccurredAt,
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

describe("finance.validation — ledger amount (Step 2.10A)", () => {
  it("accepts positive decimal up to 2 places", () => {
    expect(validateLedgerAmount("100")).toBe("100");
    expect(validateLedgerAmount("1.5")).toBe("1.5");
    expect(validateLedgerAmount("0.01")).toBe("0.01");
  });

  it("rejects zero/negative/non-numeric/excess precision", () => {
    expect(() => validateLedgerAmount("0")).toThrow(ValidationDomainError);
    expect(() => validateLedgerAmount("-5")).toThrow(ValidationDomainError);
    expect(() => validateLedgerAmount("abc")).toThrow(ValidationDomainError);
    expect(() => validateLedgerAmount("1.234")).toThrow(ValidationDomainError);
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

describe("finance.validation — ledger occurredAt (Step 2.10C)", () => {
  it("accepts valid ISO 8601 UTC instants; null/undefined → null (unknown, no fabrication)", () => {
    expect(validateOccurredAt("2026-08-14T10:00:00.000Z")).toEqual(new Date("2026-08-14T10:00:00.000Z"));
    expect(validateOccurredAt("2026-08-14T10:00:00Z")).toEqual(new Date("2026-08-14T10:00:00Z"));
    expect(validateOccurredAt("2026-08-14T10:00:00.123Z")).toEqual(new Date("2026-08-14T10:00:00.123Z"));
    expect(validateOccurredAt(null)).toBeNull();
    expect(validateOccurredAt(undefined)).toBeNull();
  });

  it("STRICT REVIEW: offsets нормализуются в один абсолютный instant (Z/+02:00/-04:30/+0200)", () => {
    const utc = new Date("2026-08-14T10:00:00.000Z");
    expect(validateOccurredAt("2026-08-14T10:00:00.000Z")).toEqual(utc);
    expect(validateOccurredAt("2026-08-14T12:00:00+02:00")).toEqual(utc); // +02:00 → 10:00Z
    expect(validateOccurredAt("2026-08-14T05:30:00-04:30")).toEqual(utc); // -04:30 → 10:00Z
    expect(validateOccurredAt("2026-08-14T12:00:00+0200")).toEqual(utc); // ISO ±HHMM (без colon)
    expect(validateOccurredAt("2026-08-14T00:00:00-10:00")).toEqual(new Date("2026-08-14T10:00:00.000Z"));
  });

  it("rejects malformed / non-ISO / TZ-зависимые форматы — никогда не становятся authority", () => {
    // Голый Date.parse принял бы всё это, интерпретируя в ЛОКАЛЬНОМ TZ сервера
    // или выдумывая полночь: строгий контракт — полный UTC ISO 8601 datetime.
    expect(() => validateOccurredAt("abc")).toThrow(ValidationDomainError);
    expect(() => validateOccurredAt("")).toThrow(ValidationDomainError);
    expect(() => validateOccurredAt(42 as unknown as string)).toThrow(ValidationDomainError);
    expect(() => validateOccurredAt("2026-08-14")).toThrow(ValidationDomainError); // date-only → выдуманная полночь
    expect(() => validateOccurredAt("2026-08")).toThrow(ValidationDomainError); // month-only
    expect(() => validateOccurredAt("08/14/2026")).toThrow(ValidationDomainError); // US locale, TZ-зависим
    expect(() => validateOccurredAt("August 14, 2026")).toThrow(ValidationDomainError); // human string
    expect(() => validateOccurredAt("2026-08-14 10:00:00")).toThrow(ValidationDomainError); // space, без offset
    expect(() => validateOccurredAt("2026-08-14T10:00:00")).toThrow(ValidationDomainError); // без Z/offset
    expect(() => validateOccurredAt("2026-13-01T00:00:00Z")).toThrow(ValidationDomainError); // month 13
    expect(() => validateOccurredAt("2026-01-01T25:00:00Z")).toThrow(ValidationDomainError); // hour 25
    expect(() => validateOccurredAt("2026-01-01T00:60:00Z")).toThrow(ValidationDomainError); // minute 60
    expect(() => validateOccurredAt("2026-01-01T00:00:00+25:00")).toThrow(ValidationDomainError); // offset +25:00
    // Date.parse молча НОРМАЛИЗУЕТ невозможные календарные даты (2026-02-30 → 03-02):
    // round-trip проверка отклоняет их — иначе другой instant стал бы authority.
    expect(() => validateOccurredAt("2026-02-30T00:00:00Z")).toThrow(ValidationDomainError);
    expect(() => validateOccurredAt("2026-04-31T00:00:00Z")).toThrow(ValidationDomainError);
    expect(() => validateOccurredAt("2026-06-31T12:00:00+02:00")).toThrow(ValidationDomainError);
  });
});

describe("finance.validation — forbidden keys", () => {
  it("protects all server-owned fields", () => {
    expect(FINANCE_MASTER_FORBIDDEN_KEYS).toEqual(expect.arrayContaining(["id", "code", "createdAt", "updatedAt", "version"]));
  });
});
