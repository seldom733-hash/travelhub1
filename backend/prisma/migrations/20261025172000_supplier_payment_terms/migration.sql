-- Minimal supplier payment terms + obligation snapshot (2026-10-25).
--
-- Rule is applied ONLY when an obligation is created; the computed due date and
-- the rule snapshot are stored on the obligation, so later rule changes never
-- rewrite history. No invented contract terms: only IMMEDIATE / NET_DAYS, and
-- absence of a rule leaves dueDate NULL (manual input, audited).
-- Additive; no existing data is changed.

CREATE TABLE IF NOT EXISTS "finance"."SupplierPaymentTerms" (
  "id"           TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "rule"         TEXT NOT NULL,
  "days"         INTEGER NOT NULL DEFAULT 0,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "updatedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierPaymentTerms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPaymentTerms_supplierCode_key"
  ON "finance"."SupplierPaymentTerms" ("supplierCode");

ALTER TABLE "finance"."SupplierObligation"
  ADD COLUMN IF NOT EXISTS "paymentTermsRule" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentTermsAppliedAt" TIMESTAMP(3);
