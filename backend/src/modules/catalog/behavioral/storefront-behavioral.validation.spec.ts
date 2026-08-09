import { describe, expect, it } from "@jest/globals";
import { ValidationDomainError } from "../../../shared/errors";
import { SOCIAL_PLATFORMS } from "../storefront/storefront.service";
import {
  OCCURRED_AT_SKEW_MS,
  requiresProduct,
  validateEventLocale,
  validateEventPath,
  validateEventPayload,
  validateEventType,
  validateOccurredAt,
  validateSessionId,
} from "./storefront-behavioral.validation";

const NOW = new Date("2026-08-09T12:00:00.000Z");

describe("storefront-behavioral.validation (Step 1.12.3)", () => {
  describe("sessionId", () => {
    it("принимает opaque non-PII 8-64 [A-Za-z0-9_-]", () => {
      expect(validateSessionId("abc12345_ABC-xyz")).toBe("abc12345_ABC-xyz");
    });
    it("отклоняет короткие / с пробелами / спецсимволами / PII-подобные", () => {
      expect(() => validateSessionId("short")).toThrow(ValidationDomainError);
      expect(() => validateSessionId("a b c d e f g h")).toThrow(ValidationDomainError);
      expect(() => validateSessionId("user+email@example.com!")).toThrow(ValidationDomainError);
      expect(() => validateSessionId(12345678 as unknown as string)).toThrow(ValidationDomainError);
    });
  });

  describe("occurredAt (temporal, §22)", () => {
    it("принимает UTC в пределах окна", () => {
      const ok = validateOccurredAt("2026-08-09T12:05:00.000Z", NOW);
      expect(ok.toISOString()).toBe("2026-08-09T12:05:00.000Z");
      const okPast = validateOccurredAt("2026-08-09T11:52:00.000Z", NOW);
      expect(okPast.getTime()).toBe(NOW.getTime() - 8 * 60 * 1000);
    });
    it("отклоняет forged далёкое прошлое/будущее и невалидные строки", () => {
      expect(() => validateOccurredAt("2026-01-01T00:00:00.000Z", NOW)).toThrow(/clock-skew/);
      expect(() => validateOccurredAt("2027-08-09T12:00:00.000Z", NOW)).toThrow(/clock-skew/);
      expect(() => validateOccurredAt("not-a-date", NOW)).toThrow(ValidationDomainError);
      expect(() => validateOccurredAt(undefined, NOW)).toThrow(ValidationDomainError);
    });
    it("граница окна: ровно ±10 минут допустима", () => {
      const edge = validateOccurredAt(new Date(NOW.getTime() + OCCURRED_AT_SKEW_MS).toISOString(), NOW);
      expect(edge.getTime()).toBe(NOW.getTime() + OCCURRED_AT_SKEW_MS);
      expect(() => validateOccurredAt(new Date(NOW.getTime() + OCCURRED_AT_SKEW_MS + 1000).toISOString(), NOW)).toThrow(/clock-skew/);
    });
  });

  describe("path (§7/§9)", () => {
    it("принимает только публичные Storefront path данной витрины", () => {
      expect(validateEventPath("/store/kavkaz", "kavkaz")).toBe("/store/kavkaz");
      expect(validateEventPath("/store/kavkaz/products/tour-baku", "kavkaz")).toBe("/store/kavkaz/products/tour-baku");
    });
    it("отклоняет чужую витрину / query / hash / traversal / мусор", () => {
      expect(() => validateEventPath("/store/other", "kavkaz")).toThrow(/does not belong/);
      expect(() => validateEventPath("/store/kavkaz?x=1", "kavkaz")).toThrow(ValidationDomainError);
      expect(() => validateEventPath("/store/kavkaz/products/a?x=1", "kavkaz")).toThrow(ValidationDomainError);
      expect(() => validateEventPath("/store/../../etc", "kavkaz")).toThrow(ValidationDomainError);
      expect(() => validateEventPath("", "kavkaz")).toThrow(ValidationDomainError);
      expect(() => validateEventPath("/", "kavkaz")).toThrow(ValidationDomainError);
    });
  });

  describe("eventType / requiresProduct (§9)", () => {
    it("принимает только whitelist", () => {
      expect(validateEventType("STOREFRONT_VIEWED")).toBe("STOREFRONT_VIEWED");
      expect(() => validateEventType("ARBITRARY")).toThrow(ValidationDomainError);
      expect(() => validateEventType("MARKETPLACE_VIEWED")).toThrow(ValidationDomainError);
    });
    it("product-события требуют productSlug", () => {
      expect(requiresProduct("STOREFRONT_PRODUCT_IMPRESSION")).toBe(true);
      expect(requiresProduct("STOREFRONT_PRODUCT_VIEWED")).toBe(true);
      expect(requiresProduct("STOREFRONT_VIEWED")).toBe(false);
      expect(requiresProduct("STOREFRONT_CONTACT_CLICKED")).toBe(false);
    });
  });

  describe("payload whitelist (§4/§15/§21)", () => {
    it("VIEWED/PRODUCT_VIEWED — пустой payload", () => {
      expect(validateEventPayload("STOREFRONT_VIEWED", undefined, SOCIAL_PLATFORMS)).toBeNull();
      expect(validateEventPayload("STOREFRONT_VIEWED", {}, SOCIAL_PLATFORMS)).toBeNull();
      expect(() => validateEventPayload("STOREFRONT_VIEWED", { contactType: "PHONE" }, SOCIAL_PLATFORMS)).toThrow(/does not accept a payload/);
    });
    it("IMPRESSION — только optional placement grid", () => {
      expect(validateEventPayload("STOREFRONT_PRODUCT_IMPRESSION", undefined, SOCIAL_PLATFORMS)).toBeNull();
      expect(validateEventPayload("STOREFRONT_PRODUCT_IMPRESSION", { placement: "grid" }, SOCIAL_PLATFORMS)).toEqual({ placement: "grid" });
      expect(() => validateEventPayload("STOREFRONT_PRODUCT_IMPRESSION", { placement: "hero" }, SOCIAL_PLATFORMS)).toThrow(/placement/);
      expect(() => validateEventPayload("STOREFRONT_PRODUCT_IMPRESSION", { productId: "P-1" }, SOCIAL_PLATFORMS)).toThrow(/placement/);
    });
    it("CONTACT_CLICKED — contactType enum, без контактного значения", () => {
      expect(validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "PHONE" }, SOCIAL_PLATFORMS)).toEqual({ contactType: "PHONE" });
      expect(validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "EMAIL" }, SOCIAL_PLATFORMS)).toEqual({ contactType: "EMAIL" });
      expect(validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "SOCIAL", platform: "instagram" }, SOCIAL_PLATFORMS)).toEqual({
        contactType: "SOCIAL",
        platform: "instagram",
      });
    });
    it("отклоняет невалидный contactType, platform вне SOCIAL, unknown ключи", () => {
      expect(() => validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "SMS" }, SOCIAL_PLATFORMS)).toThrow(/contactType/);
      expect(() => validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "PHONE", platform: "x" }, SOCIAL_PLATFORMS)).toThrow(/only for SOCIAL/);
      expect(() => validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "SOCIAL" }, SOCIAL_PLATFORMS)).toThrow(/platform/);
      expect(() => validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "SOCIAL", platform: "myspace" }, SOCIAL_PLATFORMS)).toThrow(/platform/);
      expect(() => validateEventPayload("STOREFRONT_CONTACT_CLICKED", { contactType: "PHONE", phone: "+994..." }, SOCIAL_PLATFORMS)).toThrow(/unexpected/);
    });
  });

  describe("locale", () => {
    it("принимает ru/az/en, отклоняет прочее", () => {
      expect(validateEventLocale("ru")).toBe("ru");
      expect(validateEventLocale("az")).toBe("az");
      expect(validateEventLocale("en")).toBe("en");
      expect(() => validateEventLocale("de")).toThrow(ValidationDomainError);
      expect(() => validateEventLocale("RU")).toThrow(ValidationDomainError);
    });
  });
});
