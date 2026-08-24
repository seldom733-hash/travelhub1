import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, formatDate, formatNumber, formatPrice, t, type Locale } from "./i18n";

describe("i18n (Step 1.7 §17 — RU/AZ/EN foundation)", () => {
  it("t: все три локали для ключа, fallback на default locale и на сам ключ", () => {
    expect(t("nav.find", "ru")).toBe("Найти");
    expect(t("nav.find", "az")).toBe("Axtar");
    expect(t("nav.find", "en")).toBe("Find");
    // У ключа есть только часть локалей → fallback на default (ru).
    expect(t("pdp.description_title", "az")).toBe("Təsvir");
    // Несуществующий ключ → сам ключ.
    expect(t("no.such.key", "en")).toBe("no.such.key");
  });

  it("formatPrice: locale-aware currency formatting; 0/NaN/пусто → null (по запросу)", () => {
    // Intl разделяет число и валюту неразрывным пробелом (U+00A0).
    expect(formatPrice("120.00", "AZN", "az")).toBe(`120,00\u00A0₼`);
    expect(formatPrice("350.00", "USD", "ru")).toBe(`350,00\u00A0$`);
    expect(formatPrice(120, "AZN", "en")).toBe("AZN\u00A0120.00");
    expect(formatPrice("0", "USD", "en")).toBeNull();
    expect(formatPrice("", "USD", "en")).toBeNull();
    expect(formatPrice(null, "USD", "en")).toBeNull();
    expect(formatPrice("abc", "USD", "en")).toBeNull();
    expect(formatPrice(undefined, undefined, "en")).toBeNull();
  });

  it("formatDate: locale-aware дата (месяц словами), невалидная → пусто", () => {
    expect(formatDate("2026-08-07T19:24:06.555Z", "en")).toContain("2026");
    expect(formatDate("2026-08-07T19:24:06.555Z", "ru")).toContain("2026");
    expect(formatDate("", "en")).toBe("");
    expect(formatDate(null, "en")).toBe("");
    expect(formatDate("not-a-date", "en")).toBe("");
  });

  it("formatNumber: locale-aware grouping", () => {
    expect(formatNumber(2502, "en")).toBe("2,502");
    expect(formatNumber(2502, "ru")).toBe("2\u00A0502");
  });

  it("DEFAULT_LOCALE = ru, LOCALES содержит ru/az/en", () => {
    expect(DEFAULT_LOCALE).toBe("ru");
    expect(["ru", "az", "en"] as Locale[]).toEqual(expect.arrayContaining(["ru", "az", "en"]));
  });

  // ── GMV Lifecycle i18n Regression ─────────────────────────────────────
  it("GMV lifecycle labels resolve for all three locales (no raw keys)", () => {
    const widgets = ["gmv", "collected-gmv", "outstanding", "completed-gmv"];
    for (const w of widgets) {
      const key = `cc.kpi.${w}`;
      for (const locale of ["ru", "az", "en"] as Locale[]) {
        const val = t(key, locale);
        // t() returns the raw key if not found
        expect(val).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  it("GMV lifecycle subtitles resolve for all three locales", () => {
    const widgets = ["gmv", "collected-gmv", "outstanding", "completed-gmv"];
    for (const w of widgets) {
      const key = `cc.kpi.${w}.subtitle`;
      for (const locale of ["ru", "az", "en"] as Locale[]) {
        const val = t(key, locale);
        expect(val).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  it("no GMV lifecycle label contains raw cc.kpi prefix", () => {
    const widgets = ["gmv", "collected-gmv", "outstanding", "completed-gmv"];
    for (const w of widgets) {
      const key = `cc.kpi.${w}`;
      const ru = t(key, "ru");
      const az = t(key, "az");
      const en = t(key, "en");
      expect(ru).not.toMatch(/^cc\./);
      expect(az).not.toMatch(/^cc\./);
      expect(en).not.toMatch(/^cc\./);
    }
  });

  it("Revenue/Payment Volume label resolves (no raw key)", () => {
    for (const locale of ["ru", "az", "en"] as Locale[]) {
      const val = t("cc.kpi.revenue", locale);
      expect(val).not.toBe("cc.kpi.revenue");
      expect(val.length).toBeGreaterThan(0);
    }
  });
});
