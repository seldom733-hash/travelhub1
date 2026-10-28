-- Supplier payments registry + allocations (Finance completion, 2026-10-25).
--
-- Extends the existing append-only SupplierPayout fact into a payment header:
--   * supplier identity (supplierCode/partnerId) so an unallocated payment has
--     an owner without an obligation;
--   * lifecycle PENDING → CONFIRMED → CANCELLED (only CONFIRMED affects
--     obligation paid/remaining);
--   * purpose/comment/confirm/cancel/version fields;
--   * SupplierPayoutAllocation — one payment can cover several obligations,
--     and the unallocated remainder stays visible.
--
-- Backfill: every legacy payout (one obligation) becomes a CONFIRMED payment
-- with one allocation, preserving paid/remaining of all existing obligations.
-- No historical amounts are changed. Reversible-by-design (additive columns,
-- backfilled rows only); obligationId stays as a nullable legacy link.

-- 1. Obligation: invoice + due date + optimistic version.
ALTER TABLE "finance"."SupplierObligation"
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "SupplierObligation_dueDate_idx"
  ON "finance"."SupplierObligation" ("dueDate");

-- 2. Payment header columns (legacy rows are confirmed facts).
ALTER TABLE "finance"."SupplierPayout"
  ADD COLUMN IF NOT EXISTS "supplierCode" TEXT,
  ADD COLUMN IF NOT EXISTS "partnerId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "comment" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmedById" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledById" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "finance"."SupplierPayout"
  ALTER COLUMN "obligationId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "SupplierPayout_partnerId_idx" ON "finance"."SupplierPayout" ("partnerId");
CREATE INDEX IF NOT EXISTS "SupplierPayout_supplierCode_idx" ON "finance"."SupplierPayout" ("supplierCode");
CREATE INDEX IF NOT EXISTS "SupplierPayout_status_idx" ON "finance"."SupplierPayout" ("status");
CREATE INDEX IF NOT EXISTS "SupplierPayout_occurredAt_idx" ON "finance"."SupplierPayout" ("occurredAt");

-- 3. Allocations table.
CREATE TABLE IF NOT EXISTS "finance"."SupplierPayoutAllocation" (
  "id"           TEXT NOT NULL,
  "payoutId"     TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "amount"       DECIMAL(18,2) NOT NULL,
  "aznAmount"    DECIMAL(18,2) NOT NULL,
  "reversedAt"   TIMESTAMP(3),
  "reversedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"  TEXT,
  CONSTRAINT "SupplierPayoutAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayoutAllocation_payoutId_obligationId_key"
  ON "finance"."SupplierPayoutAllocation" ("payoutId", "obligationId");
CREATE INDEX IF NOT EXISTS "SupplierPayoutAllocation_obligationId_idx"
  ON "finance"."SupplierPayoutAllocation" ("obligationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayoutAllocation_payoutId_fkey'
  ) THEN
    ALTER TABLE "finance"."SupplierPayoutAllocation"
      ADD CONSTRAINT "SupplierPayoutAllocation_payoutId_fkey"
      FOREIGN KEY ("payoutId") REFERENCES "finance"."SupplierPayout"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayoutAllocation_obligationId_fkey'
  ) THEN
    ALTER TABLE "finance"."SupplierPayoutAllocation"
      ADD CONSTRAINT "SupplierPayoutAllocation_obligationId_fkey"
      FOREIGN KEY ("obligationId") REFERENCES "finance"."SupplierObligation"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Backfill: legacy payout → CONFIRMED payment + one allocation.
UPDATE "finance"."SupplierPayout" p
   SET "confirmedAt" = COALESCE(p."confirmedAt", p."occurredAt"),
       "status" = COALESCE(p."status", 'CONFIRMED'),
       "supplierCode" = COALESCE(p."supplierCode", o."supplierCode"),
       "partnerId" = COALESCE(p."partnerId", o."partnerId")
  FROM "finance"."SupplierObligation" o
 WHERE p."obligationId" = o."id";

INSERT INTO "finance"."SupplierPayoutAllocation"
  ("id", "payoutId", "obligationId", "amount", "aznAmount", "createdAt", "createdById")
SELECT gen_random_uuid(), p."id", p."obligationId", p."amount", p."aznAmount", p."occurredAt", p."actorId"
  FROM "finance"."SupplierPayout" p
 WHERE p."obligationId" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "finance"."SupplierPayoutAllocation" a
      WHERE a."payoutId" = p."id" AND a."obligationId" = p."obligationId"
   );

-- 5. Separate confirmation authority (draft → executed is a distinct control).
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'finance.supplier_payment.confirm', 'Подтверждение исполнения платежа поставщику')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" IN ('ADMIN', 'FINANCE')
  AND p."code" = 'finance.supplier_payment.confirm'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
