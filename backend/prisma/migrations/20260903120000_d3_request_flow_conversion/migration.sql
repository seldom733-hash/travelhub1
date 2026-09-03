-- PHASE 3 PRE-STEP 3.12 D3 — Request Flow Integration (F6 closure).
-- Additive: legacy rows keep NULL (no backfill; conversion of legacy rows
-- without a D3 acceptance snapshot is rejected by the application).

ALTER TABLE "order"."Request"
  ADD COLUMN "travelerCount" INTEGER,
  ADD COLUMN "pinnedRequirements" JSONB,
  ADD COLUMN "productSnapshot" JSONB;
