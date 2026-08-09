-- Phase 1 Step 1.13A — Temporal & Analytics Readiness Foundation.
--
-- Additive, nullable, deterministic. NO backfill: historical values are unknown
-- for legacy rows → NULL (temporal taxonomy §24: NULL = milestone never happened
-- OR historical value unknown). No NOW() guessing, no data rewrite.

-- Category entity time (base taxonomy §3): legacy seeded rows → NULL createdAt
-- (their exact creation moment is not provable).
ALTER TABLE "catalog"."Category" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "catalog"."Category" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- CategorySchema lifecycle timestamps (§3/§4): real transitions DRAFT→ACTIVE→
-- DEPRECATED, NOT updatedAt. NULL = transition never happened / legacy unknown.
ALTER TABLE "catalog"."CategorySchema" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "catalog"."CategorySchema" ADD COLUMN "deprecatedAt" TIMESTAMP(3);
