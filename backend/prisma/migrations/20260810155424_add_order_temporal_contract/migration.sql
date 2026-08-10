-- Step 2.5A — Order Temporal Contract (business milestones).
-- Аддитивно: 5 nullable milestone-колонок, БЕЗ backfill (NULL = milestone
-- ещё не произошёл / legacy row до миграции). Существующие строки сохраняются.

ALTER TABLE "order"."Order"
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "fulfilledAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3);
