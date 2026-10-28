-- Server-side idempotency slot for supplier payment creation (2026-10-25).
--
-- Mirrors finance.Payment.idempotencySlotKey: the HTTP Idempotency-Key is
-- scoped by user + operation, hashed into a slot key, and stored on the
-- created payout. A stale IN_PROGRESS takeover re-executes business logic but
-- finds this row and returns it instead of creating a duplicate.
-- Additive, nullable for legacy rows; unique backstop for concurrent inserts.

ALTER TABLE "finance"."SupplierPayout"
  ADD COLUMN IF NOT EXISTS "idempotencySlotKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayout_idempotencySlotKey_key"
  ON "finance"."SupplierPayout" ("idempotencySlotKey");
