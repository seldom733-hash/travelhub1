import {
  normalizeSearchQuery,
  requiresMarketplaceCategory,
  requiresMarketplaceProduct,
  validateMarketplaceEventType,
  validateMarketplacePath,
  validateMarketplacePayload,
} from "./marketplace-behavioral.validation";
import { validateEventLocale, validateOccurredAt, validateSessionId } from "./storefront-behavioral.validation";

describe("Phase 1 Step 1.13B — Marketplace behavioral validation", () => {
  describe("eventType", () => {
    it("принимает все canonical MARKETPLACE_* типы", () => {
      for (const t of [
        "MARKETPLACE_VIEWED",
        "MARKETPLACE_PRODUCT_IMPRESSION",
        "MARKETPLACE_PRODUCT_VIEWED",
        "MARKETPLACE_SEARCH_PERFORMED",
        "MARKETPLACE_CATEGORY_VIEWED",
        "MARKETPLACE_FILTER_APPLIED",
        "MARKETPLACE_SORT_CHANGED",
        "MARKETPLACE_CTA_CLICKED",
      ]) {
        expect(validateMarketplaceEventType(t)).toBe(t);
      }
    });

    it("отклоняет произвольный/Storefront eventType", () => {
      expect(() => validateMarketplaceEventType("STOREFRONT_VIEWED")).toThrow(/eventType/);
      expect(() => validateMarketplaceEventType("ARBITRARY")).toThrow(/eventType/);
      expect(() => validateMarketplaceEventType(42)).toThrow(/eventType/);
    });
  });

  describe("path", () => {
    it("принимает публичные Marketplace path", () => {
      expect(validateMarketplacePath("/")).toBe("/");
      expect(validateMarketplacePath("/search")).toBe("/search");
      expect(validateMarketplacePath("/categories/tours")).toBe("/categories/tours");
      expect(validateMarketplacePath("/categories/accommodation-hotels")).toBe("/categories/accommodation-hotels");
      expect(validateMarketplacePath("/products/baku-tour")).toBe("/products/baku-tour");
    });

    it("отклоняет internal/чужие/traversal path", () => {
      expect(() => validateMarketplacePath("/app/dashboard")).toThrow(/path/);
      expect(() => validateMarketplacePath("/partner/storefront")).toThrow(/path/);
      expect(() => validateMarketplacePath("/account/orders")).toThrow(/path/);
      expect(() => validateMarketplacePath("/store/kavkaz")).toThrow(/path/);
      expect(() => validateMarketplacePath("/products/a?x=1")).toThrow(/path/);
      expect(() => validateMarketplacePath("/categories/..")).toThrow(/path/);
      expect(() => validateMarketplacePath("")).toThrow(/path/);
    });
  });

  describe("requiresProduct / requiresCategory", () => {
    it("требует productSlug для IMPRESSION/VIEWED, иначе нет", () => {
      expect(requiresMarketplaceProduct("MARKETPLACE_PRODUCT_IMPRESSION")).toBe(true);
      expect(requiresMarketplaceProduct("MARKETPLACE_PRODUCT_VIEWED")).toBe(true);
      expect(requiresMarketplaceProduct("MARKETPLACE_VIEWED")).toBe(false);
      expect(requiresMarketplaceProduct("MARKETPLACE_SEARCH_PERFORMED")).toBe(false);
    });

    it("требует categorySlug для CATEGORY_VIEWED/FILTER_APPLIED", () => {
      expect(requiresMarketplaceCategory("MARKETPLACE_CATEGORY_VIEWED")).toBe(true);
      expect(requiresMarketplaceCategory("MARKETPLACE_FILTER_APPLIED")).toBe(true);
      expect(requiresMarketplaceCategory("MARKETPLACE_PRODUCT_VIEWED")).toBe(false);
    });
  });

  describe("payload whitelist", () => {
    it("VIEWED/PRODUCT_VIEWED/CATEGORY_VIEWED/CTA_CLICKED — пустой payload", () => {
      expect(validateMarketplacePayload("MARKETPLACE_VIEWED", undefined)).toBeNull();
      expect(validateMarketplacePayload("MARKETPLACE_VIEWED", {})).toBeNull();
      expect(validateMarketplacePayload("MARKETPLACE_CTA_CLICKED", {})).toBeNull();
      expect(() => validateMarketplacePayload("MARKETPLACE_VIEWED", { q: 1 })).toThrow(/does not accept/);
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_VIEWED", { placement: "grid" })).toThrow(/does not accept/);
    });

    it("IMPRESSION — только placement/position", () => {
      expect(validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", undefined)).toBeNull();
      expect(validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { placement: "grid" })).toEqual({ placement: "grid" });
      expect(validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { position: 0 })).toEqual({ position: 0 });
      expect(validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { placement: "grid", position: 5 })).toEqual({ placement: "grid", position: 5 });
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { placement: "hero" })).toThrow(/placement/);
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { position: -1 })).toThrow(/position/);
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { position: 1.5 })).toThrow(/position/);
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { extra: 1 })).toThrow(/unexpected/);
    });

    it("SEARCH — нормализованная query или null", () => {
      expect(validateMarketplacePayload("MARKETPLACE_SEARCH_PERFORMED", undefined)).toBeNull();
      expect(validateMarketplacePayload("MARKETPLACE_SEARCH_PERFORMED", { query: "Баку тур" })).toEqual({ query: "Баку тур" });
      expect(validateMarketplacePayload("MARKETPLACE_SEARCH_PERFORMED", { query: "" })).toBeNull();
      expect(() => validateMarketplacePayload("MARKETPLACE_SEARCH_PERFORMED", { q: "x" })).toThrow(/unexpected/);
    });

    it("FILTER — key/value whitelist", () => {
      expect(validateMarketplacePayload("MARKETPLACE_FILTER_APPLIED", { key: "days", value: "3" })).toEqual({ key: "days", value: "3" });
      expect(() => validateMarketplacePayload("MARKETPLACE_FILTER_APPLIED", { key: "Bad Key", value: "x" })).toThrow(/filter key/);
      expect(() => validateMarketplacePayload("MARKETPLACE_FILTER_APPLIED", { key: "days" })).toThrow(/filter value/);
      expect(() => validateMarketplacePayload("MARKETPLACE_FILTER_APPLIED", { key: "days", value: "a@b.c" })).toThrow(/privacy guard/);
    });

    it("SORT — whitelist enum", () => {
      expect(validateMarketplacePayload("MARKETPLACE_SORT_CHANGED", { sort: "newest" })).toEqual({ sort: "newest" });
      expect(validateMarketplacePayload("MARKETPLACE_SORT_CHANGED", { sort: "price_asc" })).toEqual({ sort: "price_asc" });
      expect(() => validateMarketplacePayload("MARKETPLACE_SORT_CHANGED", { sort: "random" })).toThrow(/sort must be/);
      expect(() => validateMarketplacePayload("MARKETPLACE_SORT_CHANGED", { sort: "newest", x: 1 })).toThrow(/unexpected/);
    });

    it("отклоняет arbitrary nested JSON и contact values", () => {
      expect(() => validateMarketplacePayload("MARKETPLACE_PRODUCT_IMPRESSION", { placement: "grid", nested: { deep: [1] } })).toThrow(/unexpected/);
      expect(() => validateMarketplacePayload("MARKETPLACE_FILTER_APPLIED", { key: "days", value: "x", phone: "+994501234567" })).toThrow(/unexpected/);
    });
  });

  describe("search privacy guard (§15)", () => {
    it("нормализует (trim + collapse) и усекает", () => {
      expect(normalizeSearchQuery("  Баку   тур  ")).toBe("Баку тур");
      expect(normalizeSearchQuery("a".repeat(200))).toHaveLength(80);
      expect(normalizeSearchQuery("")).toBeNull();
      expect(normalizeSearchQuery(undefined)).toBeNull();
    });

    it("отклоняет email/phone/URL-like контент", () => {
      expect(() => normalizeSearchQuery("contact me at a@b.c")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("call +994501234567 now")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("visit https://example.com")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("www.example.com deals")).toThrow(/privacy guard/);
      expect(normalizeSearchQuery("обычный запрос про тур")).toBe("обычный запрос про тур");
    });

    it("отклоняет messaging-хендлы без схемы (strict review §4)", () => {
      expect(() => normalizeSearchQuery("t.me/travel_agent")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("https://t.me/travel_agent")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("Telegram: @travel_agent")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("whatsapp +994501234567")).toThrow(/privacy guard/);
      expect(() => normalizeSearchQuery("wa.me/994501234567")).toThrow(/privacy guard/);
    });

    it("generic bare domain (legit search term) не блокируется", () => {
      expect(normalizeSearchQuery("booking.com туры")).toBe("booking.com туры");
    });
  });

  describe("общие helpers переиспользованы (Storefront discipline)", () => {
    it("sessionId: opaque 8-64", () => {
      expect(validateSessionId("anon_session_12345")).toBe("anon_session_12345");
      expect(() => validateSessionId("short")).toThrow(/sessionId/);
    });

    it("occurredAt: clock-skew окно", () => {
      const now = new Date();
      expect(validateOccurredAt(new Date(now.getTime() - 5 * 60 * 1000).toISOString(), now)).toBeInstanceOf(Date);
      expect(() => validateOccurredAt("2026-01-01T00:00:00.000Z", now)).toThrow(/skew/);
    });

    it("locale: ru/az/en", () => {
      expect(validateEventLocale("az")).toBe("az");
      expect(() => validateEventLocale("de")).toThrow(/locale/);
    });
  });
});
