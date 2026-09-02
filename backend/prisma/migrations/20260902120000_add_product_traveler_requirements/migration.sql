-- PHASE 3 PRE-STEP 3.12 D2 — Product Traveler Requirements
--
-- Add JSONB column for seller-defined Traveler Data Requirements per Product.
-- Shape: { firstName: "REQUIRED", lastName: "REQUIRED", birthDate: "OPTIONAL", ... }
-- States: NOT_REQUESTED | OPTIONAL | REQUIRED
-- NULL = use ProductType defaults (deterministic resolution).
-- Frozen at checkout acceptance (termsAcceptedAt) for D3 snapshot.

ALTER TABLE "catalog"."Product" ADD COLUMN "travelerRequirements" JSONB;
