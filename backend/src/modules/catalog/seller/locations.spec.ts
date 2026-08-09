/**
 * Unit — authoritative location reference (Phase 1 Step 1.11 FIX 2).
 *
 * География — ТОЛЬКО коды; RU/AZ/EN меняют display label, не identity.
 */
import { CITY_REF, COUNTRY_NAMES, assertValidCityForCountry, cityName, countryName, formatLocation, isKnownCityCode, isKnownCountryCode } from "./locations";

describe("locations (authoritative geography reference)", () => {
  it("country codes — 2-letter, все три локали присутствуют", () => {
    for (const [code, names] of Object.entries(COUNTRY_NAMES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(names.ru).toBeTruthy();
      expect(names.az).toBeTruthy();
      expect(names.en).toBeTruthy();
    }
  });

  it("city codes принадлежат ровно одной стране и имеют все три локали", () => {
    for (const [code, city] of Object.entries(CITY_REF)) {
      expect(code).toMatch(/^[A-Z0-9_]+$/);
      expect(city.countryCode in COUNTRY_NAMES).toBe(true);
      expect(city.ru).toBeTruthy();
      expect(city.az).toBeTruthy();
      expect(city.en).toBeTruthy();
    }
  });

  it("assertValidCityForCountry: город своей страны проходит, чужой/неизвестный — падает", () => {
    expect(() => assertValidCityForCountry("BAKU", "AZ")).not.toThrow();
    expect(() => assertValidCityForCountry("TBILISI", "GE")).not.toThrow();
    expect(() => assertValidCityForCountry("BAKU", "RU")).toThrow(/BAKU/);
    expect(() => assertValidCityForCountry("NOWHERE", "AZ")).toThrow(/NOWHERE/);
  });

  it("formatLocation: одна и та же география локализуется по locale (RU/AZ/EN)", () => {
    expect(formatLocation("AZ", "BAKU", "ru")).toBe("Баку, Азербайджан");
    expect(formatLocation("AZ", "BAKU", "az")).toBe("Bakı, Azərbaycan");
    expect(formatLocation("AZ", "BAKU", "en")).toBe("Baku, Azerbaijan");
    expect(formatLocation(null, null, "en")).toBeNull();
    expect(formatLocation("RU", null, "ru")).toBe("Россия");
  });

  it("локали не смешиваются: RU locale ≠ страна RU для AZ-партнёра", () => {
    // Системная identity партнёра — AZ; locale RU даёт label «Азербайджан»,
    // а НЕ «Россия». Locale никогда не является country code.
    expect(countryName("AZ", "ru")).toBe("Азербайджан");
    expect(countryName("AZ", "ru")).not.toBe("Россия");
    expect(isKnownCountryCode("RU")).toBe(true);
    expect(isKnownCountryCode("ru")).toBe(false); // locale-строка не код страны
    expect(isKnownCityCode("baku")).toBe(false);
    expect(isKnownCityCode("BAKU")).toBe(true);
    expect(cityName("BAKU", "ru")).toBe("Баку");
  });
});
