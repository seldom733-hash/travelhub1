/**
 * PHASE 2 STEP 2.2C — Matching & Distribution: чистые eligibility-хелперы.
 *
 * Server-authoritative matching. Никаких writes из этих функций — только
 * оценка eligibility по server-owned state.
 *
 * Destination coverage semantics (containment: request destination ⊂ capability
 * coverage):
 *  - capability {worldwide} покрывает любой request destination;
 *  - request {worldwide} покрывается ТОЛЬКО capability {worldwide};
 *  - request {countryCode=X} покрывается capability {worldwide} ИЛИ capability
 *    с countryCode=X (country-level capability, без city);
 *  - request {countryCode=X, cityCode=C} покрывается capability {worldwide}
 *    ИЛИ capability (countryCode=X, без cityCode) ИЛИ capability
 *    (countryCode=X, cityCode=C);
 *  - strict containment: city capability НЕ покрывает country-level request
 *    (Buyer гибок по всей стране, Seller покрывает только город) и не
 *    покрывает city-level request другого города;
 *  - legal/registration country Seller НИКОГДА не участвует (не fallback).
 *
 * Multi-destination request: eligible если ХОТЯ БЫ ОДИН request destination
 * покрыт capability.
 */
import type { CapabilityDestination } from "./capabilities.validation";

export type EligibilityReason = "eligible" | "request_not_submitted" | "category_mismatch" | "coverage_mismatch" | "capability_not_active" | "capability_not_accepting" | "seller_not_active";

export interface EligibilityInput {
  request: {
    status: string;
    categoryId: string;
    destinations: CapabilityDestination[];
  };
  capability: {
    status: string;
    categoryId: string;
    destinations: CapabilityDestination[];
    acceptsBuyerRequests: boolean;
  };
  sellerStatus: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

/** Покрывает ли capability-дестинация request-дестинацию (containment). */
export function coversDestination(capabilityDest: CapabilityDestination, requestDest: CapabilityDestination): boolean {
  if (capabilityDest.worldwide === true) return true; // worldwide покрывает всё
  if (requestDest.worldwide === true) return false; // только worldwide покрывает worldwide
  if (requestDest.countryCode === undefined) return false;
  if (capabilityDest.countryCode !== requestDest.countryCode) return false;
  // Country-level capability (без city) покрывает и country-, и city-level request.
  if (capabilityDest.cityCode === undefined) return true;
  // City-level capability покрывает только тот же город.
  return capabilityDest.cityCode === requestDest.cityCode;
}

/** Хотя бы один request destination покрыт capability. */
export function requestCoveredByCapability(capabilityDests: CapabilityDestination[], requestDests: CapabilityDestination[]): boolean {
  return requestDests.some((rd) => capabilityDests.some((cd) => coversDestination(cd, rd)));
}

/**
 * Полная eligibility-оценка (чистая). Все входы — server-owned state.
 * Entitlement: канонический entitlement authority для reverse marketplace
 * отсутствует (StorefrontEntitlementStatus — отдельный commercial контекст
 * paid SaaS; reverse marketplace — commission path). Participation gate =
 * capability-level (ACTIVE + acceptsBuyerRequests), capability ≠ entitlement.
 */
export function isRequestEligible(input: EligibilityInput): EligibilityResult {
  const reasons: EligibilityReason[] = [];
  if (input.request.status !== "SUBMITTED") {
    return { eligible: false, reasons: ["request_not_submitted"] };
  }
  if (input.capability.status !== "ACTIVE") {
    return { eligible: false, reasons: ["capability_not_active"] };
  }
  if (input.capability.acceptsBuyerRequests !== true) {
    return { eligible: false, reasons: ["capability_not_accepting"] };
  }
  if (input.sellerStatus !== "ACTIVE") {
    return { eligible: false, reasons: ["seller_not_active"] };
  }
  if (input.capability.categoryId !== input.request.categoryId) {
    return { eligible: false, reasons: ["category_mismatch"] };
  }
  if (!requestCoveredByCapability(input.capability.destinations, input.request.destinations)) {
    return { eligible: false, reasons: ["coverage_mismatch"] };
  }
  return { eligible: true, reasons: ["eligible"] };
}
