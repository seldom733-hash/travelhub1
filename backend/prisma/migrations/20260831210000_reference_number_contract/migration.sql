-- ============================================================
-- PHASE 3 PRE-STEP 3.12: Tenant-Scoped Reference Number Contract
-- ============================================================
-- Idempotent: safe for fresh DB and existing populated DB
-- Backfill queries handle 0 rows on fresh empty DB gracefully
-- ============================================================

-- 1. Storefront stable short code
DO $$ BEGIN
  ALTER TABLE "catalog"."PartnerStorefront" ADD COLUMN "storefrontCode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerStorefront_storefrontCode_key" ON "catalog"."PartnerStorefront"("storefrontCode");

-- 2. referenceNumber columns (nullable for backfill)
DO $$ BEGIN
  ALTER TABLE "order"."Order" ADD COLUMN "referenceNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "booking"."Booking" ADD COLUMN "referenceNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "finance"."Payment" ADD COLUMN "referenceNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "finance"."Invoice" ADD COLUMN "referenceNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "finance"."Refund" ADD COLUMN "referenceNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Deterministic storefrontCode assignment (0 rows on fresh DB)
DO $$ BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY "code") AS rn
    FROM "catalog"."PartnerStorefront"
  )
  UPDATE "catalog"."PartnerStorefront" sf
  SET "storefrontCode" = 'SF' || LPAD(o.rn::TEXT, 3, '0')
  FROM ordered o WHERE sf.id = o.id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Backfill Order referenceNumbers (0 rows on fresh DB)
DO $$ BEGIN
  WITH refs AS (
    SELECT id, 'MKT-ORD-' || LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS rn
    FROM "order"."Order" WHERE "referenceNumber" IS NULL
  )
  UPDATE "order"."Order" o SET "referenceNumber" = refs.rn FROM refs WHERE o.id = refs.id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Backfill Booking referenceNumbers (0 rows on fresh DB)
DO $$ BEGIN
  WITH refs AS (
    SELECT id, 'MKT-BKG-' || LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS rn
    FROM "booking"."Booking" WHERE "referenceNumber" IS NULL
  )
  UPDATE "booking"."Booking" b SET "referenceNumber" = refs.rn FROM refs WHERE b.id = refs.id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Backfill Payment referenceNumbers (0 rows on fresh DB)
DO $$ BEGIN
  WITH refs AS (
    SELECT id, 'MKT-PAY-' || LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS rn
    FROM "finance"."Payment" WHERE "referenceNumber" IS NULL
  )
  UPDATE "finance"."Payment" p SET "referenceNumber" = refs.rn FROM refs WHERE p.id = refs.id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Backfill Refund referenceNumbers (0 rows on fresh DB)
DO $$ BEGIN
  WITH refs AS (
    SELECT id, 'MKT-REF-' || LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS rn
    FROM "finance"."Refund" WHERE "referenceNumber" IS NULL
  )
  UPDATE "finance"."Refund" r SET "referenceNumber" = refs.rn FROM refs WHERE r.id = refs.id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Add NOT NULL after backfill (safe for empty tables)
DO $$ BEGIN
  ALTER TABLE "catalog"."PartnerStorefront" ALTER COLUMN "storefrontCode" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Final unique constraints (defense-in-depth)
CREATE UNIQUE INDEX IF NOT EXISTS "Order_referenceNumber_key" ON "order"."Order"("referenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_referenceNumber_key" ON "booking"."Booking"("referenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_referenceNumber_key" ON "finance"."Payment"("referenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_referenceNumber_key" ON "finance"."Refund"("referenceNumber");
