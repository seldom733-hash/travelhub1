-- CreateEnum
CREATE TYPE "catalog"."StorefrontBehavioralEventType" AS ENUM ('STOREFRONT_VIEWED', 'STOREFRONT_PRODUCT_IMPRESSION', 'STOREFRONT_PRODUCT_VIEWED', 'STOREFRONT_CONTACT_CLICKED');

-- CreateEnum
CREATE TYPE "catalog"."AcquisitionSource" AS ENUM ('MARKETPLACE', 'PARTNER_STOREFRONT', 'DIRECT');

-- CreateTable
CREATE TABLE "catalog"."StorefrontBehavioralEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" "catalog"."StorefrontBehavioralEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storefrontId" TEXT NOT NULL,
    "productId" TEXT,
    "sessionId" TEXT NOT NULL,
    "acquisitionSource" "catalog"."AcquisitionSource" NOT NULL,
    "locale" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "StorefrontBehavioralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontBehavioralEvent_eventId_key" ON "catalog"."StorefrontBehavioralEvent"("eventId");

-- CreateIndex
CREATE INDEX "StorefrontBehavioralEvent_storefrontId_occurredAt_idx" ON "catalog"."StorefrontBehavioralEvent"("storefrontId", "occurredAt");

-- CreateIndex
CREATE INDEX "StorefrontBehavioralEvent_eventType_occurredAt_idx" ON "catalog"."StorefrontBehavioralEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "StorefrontBehavioralEvent_productId_idx" ON "catalog"."StorefrontBehavioralEvent"("productId");

-- CreateIndex
CREATE INDEX "StorefrontBehavioralEvent_sessionId_idx" ON "catalog"."StorefrontBehavioralEvent"("sessionId");

-- CreateIndex
CREATE INDEX "StorefrontBehavioralEvent_acquisitionSource_occurredAt_idx" ON "catalog"."StorefrontBehavioralEvent"("acquisitionSource", "occurredAt");
