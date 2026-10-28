-- Auditable obligation history for the "debt as of date" report (2026-10-25).
--
-- SupplierObligation is mutable in place (adjust/cancel), so a historical
-- report cannot be derived from the current row alone. This append-only table
-- stores amount/status events with business time. Backfill reconstructs:
--   * CREATED  — at COALESCE(confirmedAt, createdAt); amount = the pre-adjust
--                value from the earliest AuditLog adjustment when present,
--                otherwise the current aznAmount;
--   * ADJUSTED — one row per finance.obligation.adjusted AuditLog entry;
--   * CANCELLED— one row per finance.obligation.cancelled AuditLog entry.
-- If an environment has no audit rows, CREATED is still backfilled from the
-- current obligation (legacy approximation is disclosed by the report as
-- `legacy` source when no events exist at all).
-- Additive, idempotent (NOT EXISTS guards), no data deletion.

CREATE TABLE IF NOT EXISTS "finance"."SupplierObligationEvent" (
  "id"           TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "aznAmount"    DECIMAL(18,2),
  "occurredAt"   TIMESTAMP(3) NOT NULL,
  "actorId"      TEXT,
  "details"      JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierObligationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierObligationEvent_obligationId_occurredAt_idx"
  ON "finance"."SupplierObligationEvent" ("obligationId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierObligationEvent_obligationId_fkey'
  ) THEN
    ALTER TABLE "finance"."SupplierObligationEvent"
      ADD CONSTRAINT "SupplierObligationEvent_obligationId_fkey"
      FOREIGN KEY ("obligationId") REFERENCES "finance"."SupplierObligation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CREATED
INSERT INTO "finance"."SupplierObligationEvent"
  ("id", "obligationId", "type", "aznAmount", "occurredAt", "actorId", "details", "createdAt")
SELECT gen_random_uuid(),
       o."id",
       'CREATED',
       COALESCE(
         (
           SELECT (a."details"->>'oldAznAmount')::numeric(18,2)
             FROM "security"."AuditLog" a
            WHERE a."resource" = 'SupplierObligation'
              AND a."resourceId" = o."id"
              AND a."action" = 'finance.obligation.adjusted'
            ORDER BY a."createdAt" ASC
            LIMIT 1
         ),
         o."aznAmount"
       ),
       COALESCE(o."confirmedAt", o."createdAt"),
       NULL,
       jsonb_build_object('source', 'BACKFILL_CREATED'),
       now()
  FROM "finance"."SupplierObligation" o
 WHERE NOT EXISTS (
   SELECT 1 FROM "finance"."SupplierObligationEvent" e
    WHERE e."obligationId" = o."id" AND e."type" = 'CREATED'
 );

-- ADJUSTED
INSERT INTO "finance"."SupplierObligationEvent"
  ("id", "obligationId", "type", "aznAmount", "occurredAt", "actorId", "details", "createdAt")
SELECT gen_random_uuid(),
       o."id",
       'ADJUSTED',
       (a."details"->>'newAznAmount')::numeric(18,2),
       a."createdAt",
       a."userId",
       a."details",
       now()
  FROM "security"."AuditLog" a
  JOIN "finance"."SupplierObligation" o ON o."id" = a."resourceId"
 WHERE a."resource" = 'SupplierObligation'
   AND a."action" = 'finance.obligation.adjusted'
   AND a."details" ? 'newAznAmount'
   AND NOT EXISTS (
     SELECT 1 FROM "finance"."SupplierObligationEvent" e
      WHERE e."obligationId" = o."id" AND e."type" = 'ADJUSTED' AND e."occurredAt" = a."createdAt"
   );

-- CANCELLED
INSERT INTO "finance"."SupplierObligationEvent"
  ("id", "obligationId", "type", "aznAmount", "occurredAt", "actorId", "details", "createdAt")
SELECT gen_random_uuid(),
       o."id",
       'CANCELLED',
       o."aznAmount",
       a."createdAt",
       a."userId",
       a."details",
       now()
  FROM "security"."AuditLog" a
  JOIN "finance"."SupplierObligation" o ON o."id" = a."resourceId"
 WHERE a."resource" = 'SupplierObligation'
   AND a."action" = 'finance.obligation.cancelled'
   AND NOT EXISTS (
     SELECT 1 FROM "finance"."SupplierObligationEvent" e
      WHERE e."obligationId" = o."id" AND e."type" = 'CANCELLED' AND e."occurredAt" = a."createdAt"
   );
