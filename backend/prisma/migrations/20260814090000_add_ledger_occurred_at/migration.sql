-- PHASE 2 STEP 2.10C — Finance Temporal Contract: LedgerTransaction.occurredAt.
-- Business occurrence time (UTC), ОТДЕЛЬНО от createdAt (persistence time).
-- Additive + nullable: NULL = unknown occurrence (legacy / producer не передал).
-- БЕЗ backfill: время наступления исторических фактов неизвестно — не выдумывается.
ALTER TABLE "finance"."LedgerTransaction" ADD COLUMN "occurredAt" TIMESTAMP(3);
