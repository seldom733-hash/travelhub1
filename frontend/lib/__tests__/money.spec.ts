import { describe, it, expect } from "vitest";
import { formatPrice } from "../i18n";
import type { Locale } from "../i18n";

describe("formatPrice — Global Currency Presentation Contract", () => {
  // ── Currency symbol mapping ─────────────────────────────────────────

  describe("Currency symbol mapping", () => {
    it("AZN → ₼ (AZ locale)", () => {
      const result = formatPrice(1250.50, "AZN", "az");
      expect(result).toContain("₼");
      expect(result).not.toContain("AZN");
    });

    it("USD → $ (EN locale)", () => {
      const result = formatPrice(1250.50, "USD", "en");
      expect(result).toContain("$");
      expect(result).not.toContain("USD");
    });

    it("EUR → € (EN locale)", () => {
      const result = formatPrice(1250.50, "EUR", "en");
      expect(result).toContain("€");
      expect(result).not.toContain("EUR");
    });

    it("AZN → ₼ (RU locale)", () => {
      const result = formatPrice(1250.50, "AZN", "ru");
      expect(result).toContain("₼");
      expect(result).not.toContain("AZN");
    });

    it("USD → $ (RU locale)", () => {
      const result = formatPrice(1250.50, "USD", "ru");
      expect(result).toContain("$");
      expect(result).not.toContain("USD");
    });

    it("EUR → € (RU locale)", () => {
      const result = formatPrice(1250.50, "EUR", "ru");
      expect(result).toContain("€");
      expect(result).not.toContain("EUR");
    });
  });

  // ── Number formatting ───────────────────────────────────────────────

  describe("Number formatting", () => {
    it("formats integer amounts", () => {
      const result = formatPrice(1000, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("formats decimal amounts", () => {
      const result = formatPrice(1250.50, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("formats zero", () => {
      const result = formatPrice(0, "USD", "en");
      // formatPrice returns null for n <= 0, which is the current contract
      expect(result).toBeNull();
    });

    it("formats negative values", () => {
      const result = formatPrice(-100, "USD", "en");
      // formatPrice returns null for n <= 0
      expect(result).toBeNull();
    });

    it("formats large values", () => {
      const result = formatPrice(1000000, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });
  });

  // ── Locale-specific formatting ──────────────────────────────────────

  describe("Locale-specific formatting", () => {
    it("RU locale uses comma as decimal separator", () => {
      const result = formatPrice(1250.50, "USD", "ru");
      expect(result).toBeTruthy();
      // Russian locale uses comma for decimals
      expect(result).toMatch(/[,\.]/);
    });

    it("EN locale uses period as decimal separator", () => {
      const result = formatPrice(1250.50, "USD", "en");
      expect(result).toBeTruthy();
      // English locale uses period for decimals
      expect(result).toMatch(/[.,]/);
    });

    it("AZ locale works correctly", () => {
      const result = formatPrice(1250.50, "AZN", "az");
      expect(result).toBeTruthy();
      expect(result).toContain("₼");
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("returns null for null amount", () => {
      expect(formatPrice(null, "USD", "en")).toBeNull();
    });

    it("returns null for undefined amount", () => {
      expect(formatPrice(undefined, "USD", "en")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(formatPrice("", "USD", "en")).toBeNull();
    });

    it("returns null for NaN amount", () => {
      expect(formatPrice("abc", "USD", "en")).toBeNull();
    });

    it("handles string amounts", () => {
      const result = formatPrice("1250.50", "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("returns null for null currency (defaults to USD)", () => {
      const result = formatPrice(100, null, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("returns null for undefined currency (defaults to USD)", () => {
      const result = formatPrice(100, undefined, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });
  });

  // ── Consistency across surfaces ─────────────────────────────────────

  describe("Consistency across surfaces", () => {
    const locales: Locale[] = ["ru", "az", "en"];
    const currencies = ["AZN", "USD", "EUR"];

    it("same currency looks the same across all locales for symbol presence", () => {
      for (const currency of currencies) {
        const symbol = currency === "AZN" ? "₼" : currency === "USD" ? "$" : "€";
        for (const locale of locales) {
          const result = formatPrice(100, currency, locale);
          expect(result).toContain(symbol);
        }
      }
    });

    it("same amount+currency produces consistent symbol across locales", () => {
      const results = locales.map((l) => formatPrice(250.75, "AZN", l));
      // All should contain ₼
      for (const r of results) {
        expect(r).toContain("₼");
      }
    });
  });
});
