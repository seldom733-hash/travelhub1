-- Evidence documents for supplier payments (2026-10-25).
--
-- Metadata only; binary lives in the private S3 bucket. Access is authenticated
-- + permissioned + signed URL (never public). Soft delete keeps an audit trail.
-- Additive migration; no existing data is changed.

CREATE TABLE IF NOT EXISTS "finance"."SupplierPaymentEvidence" (
  "id"           TEXT NOT NULL,
  "payoutId"     TEXT NOT NULL,
  "storageKey"   TEXT NOT NULL,
  "fileName"     TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "uploadedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"    TIMESTAMP(3),
  "deletedById"  TEXT,
  CONSTRAINT "SupplierPaymentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPaymentEvidence_storageKey_key"
  ON "finance"."SupplierPaymentEvidence" ("storageKey");
CREATE INDEX IF NOT EXISTS "SupplierPaymentEvidence_payoutId_idx"
  ON "finance"."SupplierPaymentEvidence" ("payoutId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPaymentEvidence_payoutId_fkey'
  ) THEN
    ALTER TABLE "finance"."SupplierPaymentEvidence"
      ADD CONSTRAINT "SupplierPaymentEvidence_payoutId_fkey"
      FOREIGN KEY ("payoutId") REFERENCES "finance"."SupplierPayout"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
