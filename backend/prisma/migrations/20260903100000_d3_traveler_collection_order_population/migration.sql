-- D3: Traveler Collection + Order/Booking Population
-- Pinned requirements snapshot, completion timestamps, canonical traveler count.

-- Order: D3 temporal contract + pinned requirements + traveler count
ALTER TABLE "order"."Order" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "travelerDataCompletedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "finalConfirmedAt" TIMESTAMP(3);
ALTER TABLE "order"."Order" ADD COLUMN "pinnedRequirements" JSONB;
ALTER TABLE "order"."Order" ADD COLUMN "travelerCount" INTEGER;
