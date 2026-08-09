-- Phase 1 Step 1.13B — Marketplace Behavioral Events Foundation.
-- Additive, deterministic, no destructive changes, no backfill.
-- New narrow table (same envelope/semantic discipline as StorefrontBehavioralEvent
-- Step 1.12.3) — existing Storefront events untouched (no migration, no rewrite).

-- Marketplace event types (namespace MARKETPLACE_*).
CREATE TYPE "catalog"."MarketplaceBehavioralEventType" AS ENUM (
  'MARKETPLACE_VIEWED',
  'MARKETPLACE_PRODUCT_IMPRESSION',
  'MARKETPLACE_PRODUCT_VIEWED',
  'MARKETPLACE_SEARCH_PERFORMED',
  'MARKETPLACE_CATEGORY_VIEWED',
  'MARKETPLACE_FILTER_APPLIED',
  'MARKETPLACE_SORT_CHANGED',
  'MARKETPLACE_CTA_CLICKED'
);

CREATE TABLE "catalog"."MarketplaceBehavioralEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" "catalog"."MarketplaceBehavioralEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "productId" TEXT,
  "categoryId" TEXT,
  "sessionId" TEXT NOT NULL,
  "acquisitionSource" "catalog"."AcquisitionSource" NOT NULL,
  "locale" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "payload" JSONB,

  CONSTRAINT "MarketplaceBehavioralEvent_pkey" PRIMARY KEY ("id")
);

-- Dedup: один logical event — одна строка (retry/replay не удваивает метрики).
CREATE UNIQUE INDEX "MarketplaceBehavioralEvent_eventId_key" ON "catalog"."MarketplaceBehavioralEvent"("eventId");

-- Future aggregation / debugging indexes (только обоснованные, как у Storefront).
CREATE INDEX "MarketplaceBehavioralEvent_eventType_occurredAt_idx" ON "catalog"."MarketplaceBehavioralEvent"("eventType", "occurredAt");
CREATE INDEX "MarketplaceBehavioralEvent_productId_occurredAt_idx" ON "catalog"."MarketplaceBehavioralEvent"("productId", "occurredAt");
CREATE INDEX "MarketplaceBehavioralEvent_categoryId_occurredAt_idx" ON "catalog"."MarketplaceBehavioralEvent"("categoryId", "occurredAt");
CREATE INDEX "MarketplaceBehavioralEvent_sessionId_idx" ON "catalog"."MarketplaceBehavioralEvent"("sessionId");
CREATE INDEX "MarketplaceBehavioralEvent_acquisitionSource_occurredAt_idx" ON "catalog"."MarketplaceBehavioralEvent"("acquisitionSource", "occurredAt");
