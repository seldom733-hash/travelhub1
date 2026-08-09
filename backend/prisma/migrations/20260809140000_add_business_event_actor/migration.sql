-- Phase 1 Step 1.15A — Business Event Temporal Contract: typed actor.
--
-- Additive, nullable, deterministic. NO backfill: historical actor is unknown
-- for legacy rows → NULL (contract §10: don't fabricate actor retroactively).
-- Envelope fields occurredAt/entityId/entityType are DERIVED at read time
-- (occurredAt = createdAt, written atomically with the transition; entityId =
-- aggregateId) — no columns needed. source/version/metadata are intentionally
-- ABSENT (no authoritative value exists in Phase 1 — no guessing, §12/§13/§14).

ALTER TABLE "events"."OutboxEvent" ADD COLUMN "actor" JSONB;
