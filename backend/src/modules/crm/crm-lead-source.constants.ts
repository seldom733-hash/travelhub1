/**
 * PHASE 3 STEP 3.6A — Canonical CRM Lead Source constants.
 *
 * PartnerCustomerRelation.leadSource values.
 * Convention-based (DB column is String?), but business logic
 * must validate against these canonical values.
 */
export const LEAD_SOURCES = {
  MARKETPLACE: "MARKETPLACE",   // Customer via TravelHub Marketplace
  STOREFRONT: "STOREFRONT",     // Customer via Partner's own Storefront
  DIRECT: "DIRECT",             // Direct/manual acquisition
  PHONE: "PHONE",               // First acquisition by phone
  OFFICE: "OFFICE",             // First acquisition in office
  EMAIL: "EMAIL",               // First acquisition via email
  REFERRAL: "REFERRAL",         // First acquisition by referral
  OTHER: "OTHER",               // Other acquisition source
} as const;

export type LeadSourceValue = typeof LEAD_SOURCES[keyof typeof LEAD_SOURCES];

/** All valid lead source values for validation. */
export const VALID_LEAD_SOURCES: readonly string[] = Object.values(LEAD_SOURCES);

/** Manual intake sources: what a human can select when creating a PCR manually. */
export const MANUAL_INTAKE_SOURCES: readonly string[] = [
  LEAD_SOURCES.DIRECT,
  LEAD_SOURCES.PHONE,
  LEAD_SOURCES.OFFICE,
  LEAD_SOURCES.EMAIL,
  LEAD_SOURCES.REFERRAL,
  LEAD_SOURCES.OTHER,
] as const;

/** Platform-generated source: only auto-attribution should set this. */
export const AUTO_ASSIGNED_SOURCES: readonly string[] = [
  LEAD_SOURCES.MARKETPLACE,
  LEAD_SOURCES.STOREFRONT,
] as const;

/** Validate a lead source value against canonical values. */
export function isValidLeadSource(source: string | null | undefined): boolean {
  if (!source) return true; // null/undefined = allowed (nullable field)
  return VALID_LEAD_SOURCES.includes(source);
}
