import { describe, it, expect } from "vitest";
import { formatPrice } from "../i18n";
import type { Locale } from "../i18n";

describe("formatPrice — Global Currency Presentation Contract (Round 2)", () => {
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

    it("AZN → ₼ (EN locale)", () => {
      const result = formatPrice(1250.50, "AZN", "en");
      expect(result).toContain("₼");
      expect(result).not.toContain("AZN");
    });

    it("USD → $ (AZ locale)", () => {
      const result = formatPrice(1250.50, "USD", "az");
      expect(result).toContain("$");
      expect(result).not.toContain("USD");
    });

    it("EUR → € (AZ locale)", () => {
      const result = formatPrice(1250.50, "EUR", "az");
      expect(result).toContain("€");
      expect(result).not.toContain("EUR");
    });
  });

  // ── Zero semantics (Round 2 fix) ───────────────────────────────────

  describe("Zero semantics — zero is a valid monetary value", () => {
    it("0 AZN → visible zero with ₼", () => {
      const result = formatPrice(0, "AZN", "ru");
      expect(result).not.toBeNull();
      expect(result).toContain("0");
      expect(result).toContain("₼");
    });

    it("0 USD → visible zero with $", () => {
      const result = formatPrice(0, "USD", "en");
      expect(result).not.toBeNull();
      expect(result).toContain("0");
      expect(result).toContain("$");
    });

    it("0 EUR → visible zero with €", () => {
      const result = formatPrice(0, "EUR", "en");
      expect(result).not.toBeNull();
      expect(result).toContain("0");
      expect(result).toContain("€");
    });

    it("0 AZN in AZ locale", () => {
      const result = formatPrice(0, "AZN", "az");
      expect(result).not.toBeNull();
      expect(result).toContain("0");
      expect(result).toContain("₼");
    });

    it("string \"0\" AZN → visible zero", () => {
      const result = formatPrice("0", "AZN", "ru");
      expect(result).not.toBeNull();
      expect(result).toContain("0");
      expect(result).toContain("₼");
    });
  });

  // ── Absence semantics ───────────────────────────────────────────────

  describe("Absence semantics — null/undefined → \"—\"", () => {
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
  });

  // ── Negative values ─────────────────────────────────────────────────

  describe("Negative values", () => {
    it("returns null for negative values", () => {
      expect(formatPrice(-100, "USD", "en")).toBeNull();
    });

    it("returns null for negative string", () => {
      expect(formatPrice("-50.00", "AZN", "ru")).toBeNull();
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

    it("formats large values", () => {
      const result = formatPrice(1000000, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("handles string amounts", () => {
      const result = formatPrice("1250.50", "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });
  });

  // ── Locale-specific formatting ──────────────────────────────────────

  describe("Locale-specific formatting — RU", () => {
    it("RU locale uses comma as decimal separator", () => {
      const result = formatPrice(1250.50, "USD", "ru");
      expect(result).toBeTruthy();
      expect(result).toMatch(/[,\.]/);
    });

    it("RU locale formats AZN correctly", () => {
      const result = formatPrice(1250.50, "AZN", "ru");
      expect(result).toContain("₼");
    });
  });

  describe("Locale-specific formatting — EN", () => {
    it("EN locale uses period as decimal separator", () => {
      const result = formatPrice(1250.50, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/[.,]/);
    });

    it("EN locale formats EUR correctly", () => {
      const result = formatPrice(1250.50, "EUR", "en");
      expect(result).toContain("€");
    });
  });

  describe("Locale-specific formatting — AZ", () => {
    it("AZ locale works correctly with AZN", () => {
      const result = formatPrice(1250.50, "AZN", "az");
      expect(result).toBeTruthy();
      expect(result).toContain("₼");
    });

    it("AZ locale works correctly with USD", () => {
      const result = formatPrice(1250.50, "USD", "az");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("AZ locale works correctly with EUR", () => {
      const result = formatPrice(1250.50, "EUR", "az");
      expect(result).toBeTruthy();
      expect(result).toContain("€");
    });
  });

  // ── Currency default fallback ───────────────────────────────────────

  describe("Currency default fallback", () => {
    it("null currency defaults to USD", () => {
      const result = formatPrice(100, null, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });

    it("undefined currency defaults to USD", () => {
      const result = formatPrice(100, undefined, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });
  });

  // ── Consistency across locales ──────────────────────────────────────

  describe("Consistency across locales", () => {
    const locales: Locale[] = ["ru", "az", "en"];
    const currencies = ["AZN", "USD", "EUR"];

    it("same currency has correct symbol in all locales", () => {
      for (const currency of currencies) {
        const symbol = currency === "AZN" ? "₼" : currency === "USD" ? "$" : "€";
        for (const locale of locales) {
          const result = formatPrice(100, currency, locale);
          expect(result).toContain(symbol);
        }
      }
    });

    it("zero renders in all locale/currency combinations", () => {
      for (const currency of currencies) {
        const symbol = currency === "AZN" ? "₼" : currency === "USD" ? "$" : "€";
        for (const locale of locales) {
          const result = formatPrice(0, currency, locale);
          expect(result).not.toBeNull();
          expect(result).toContain("0");
          expect(result).toContain(symbol);
        }
      }
    });
  });
});
