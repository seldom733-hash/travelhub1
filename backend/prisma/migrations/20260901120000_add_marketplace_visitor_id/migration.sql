-- Phase 3 Pre-Step 3.12: Add visitorId to MarketplaceBehavioralEvent
-- visitorId = persistent anonymous browser identity for Visitors KPI
-- Historical events will have NULL visitorId (coverage limitation documented)

ALTER TABLE "catalog"."MarketplaceBehavioralEvent" ADD COLUMN "visitorId" TEXT;

CREATE INDEX "MarketplaceBehavioralEvent_visitorId_idx" ON "catalog"."MarketplaceBehavioralEvent"("visitorId");
