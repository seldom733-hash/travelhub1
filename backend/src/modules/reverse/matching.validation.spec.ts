import { coversDestination, isRequestEligible, requestCoveredByCapability } from "./matching.validation";
import type { CapabilityDestination } from "./capabilities.validation";

const D = (countryCode?: string, cityCode?: string, worldwide?: boolean): CapabilityDestination =>
  worldwide ? { worldwide: true } : cityCode ? { countryCode, cityCode } : { countryCode };

describe("reverse.matching.validation", () => {
  describe("coversDestination (containment)", () => {
    it("worldwide capability covers everything; worldwide request only worldwide", () => {
      expect(coversDestination(D(undefined, undefined, true), D("TR"))).toBe(true);
      expect(coversDestination(D(undefined, undefined, true), D("TR", "ANTALYA"))).toBe(true);
      expect(coversDestination(D("TR"), D(undefined, undefined, true))).toBe(false);
      expect(coversDestination(D(undefined, undefined, true), D(undefined, undefined, true))).toBe(true);
    });

    it("country capability covers country and same-country city requests", () => {
      expect(coversDestination(D("TR"), D("TR"))).toBe(true);
      expect(coversDestination(D("TR"), D("TR", "ANTALYA"))).toBe(true);
      expect(coversDestination(D("TR"), D("GE"))).toBe(false);
    });

    it("city capability covers same city only (strict containment)", () => {
      expect(coversDestination(D("TR", "ANTALYA"), D("TR", "ANTALYA"))).toBe(true);
      // Строгий containment: city capability НЕ покрывает country-level request
      // (Buyer гибок по всей стране; Seller покрывает только город).
      expect(coversDestination(D("TR", "ANTALYA"), D("TR"))).toBe(false);
      expect(coversDestination(D("TR", "ANTALYA"), D("TR", "ISTANBUL"))).toBe(false);
      expect(coversDestination(D("TR", "ANTALYA"), D("GE", "TBILISI"))).toBe(false);
      // Обратное: country-level capability покрывает city-level request (Roadmap §10).
      expect(coversDestination(D("TR"), D("TR", "ANTALYA"))).toBe(true);
    });

    it("country mismatch excluded; malformed destinations excluded", () => {
      expect(coversDestination(D("AZ"), D("TR"))).toBe(false);
      expect(coversDestination(D("TR"), {})).toBe(false);
    });
  });

  describe("requestCoveredByCapability (multi-destination)", () => {
    it("any request destination covered → true", () => {
      const caps = [D("TR"), D("GE")];
      expect(requestCoveredByCapability(caps, [D("AZ"), D("TR")])).toBe(true);
      expect(requestCoveredByCapability(caps, [D("AZ"), D("DE")])).toBe(false);
      expect(requestCoveredByCapability([D(undefined, undefined, true)], [D("AZ")])).toBe(true);
    });
  });

  describe("isRequestEligible (full gate)", () => {
    const base = {
      request: { status: "SUBMITTED", categoryId: "cat-hotel", destinations: [D("TR", "ANTALYA")] },
      capability: {
        status: "ACTIVE",
        categoryId: "cat-hotel",
        destinations: [D("TR", "ANTALYA")],
        acceptsBuyerRequests: true,
      },
      sellerStatus: "ACTIVE",
    };

    it("Baku/AZ seller with HOTEL→TR capability matches TR hotel request (legal country не критерий)", () => {
      // Seller зарегистрирован в AZ, capability покрывает TR — eligible.
      expect(isRequestEligible(base).eligible).toBe(true);
      // Seller зарегистрирован в TR без capability на TR — НЕ eligible (legal country не fallback).
      expect(
        isRequestEligible({
          ...base,
          capability: { ...base.capability, destinations: [D("AZ")] },
        }).eligible,
      ).toBe(false);
    });

    it("gate order: status → capability state → seller → category → coverage", () => {
      expect(isRequestEligible({ ...base, request: { ...base.request, status: "DRAFT" } })).toEqual({
        eligible: false,
        reasons: ["request_not_submitted"],
      });
      expect(isRequestEligible({ ...base, request: { ...base.request, status: "CANCELLED" } })).toEqual({
        eligible: false,
        reasons: ["request_not_submitted"],
      });
      expect(isRequestEligible({ ...base, capability: { ...base.capability, status: "INACTIVE" } })).toEqual({
        eligible: false,
        reasons: ["capability_not_active"],
      });
      expect(isRequestEligible({ ...base, capability: { ...base.capability, acceptsBuyerRequests: false } })).toEqual({
        eligible: false,
        reasons: ["capability_not_accepting"],
      });
      expect(isRequestEligible({ ...base, sellerStatus: "INACTIVE" })).toEqual({
        eligible: false,
        reasons: ["seller_not_active"],
      });
      expect(isRequestEligible({ ...base, capability: { ...base.capability, categoryId: "cat-tour" } })).toEqual({
        eligible: false,
        reasons: ["category_mismatch"],
      });
      expect(
        isRequestEligible({ ...base, capability: { ...base.capability, destinations: [D("GE", "TBILISI")] } }),
      ).toEqual({ eligible: false, reasons: ["coverage_mismatch"] });
    });

    it("zero-Product capability matches (capability ≠ inventory)", () => {
      // Product наличие не входит в eligibility-входы вообще.
      expect(isRequestEligible(base).eligible).toBe(true);
    });

    it("capability ≠ entitlement: нет entitlement-поля — participation gate = capability-level", () => {
      expect(isRequestEligible(base)).toEqual({ eligible: true, reasons: ["eligible"] });
    });
  });
});
