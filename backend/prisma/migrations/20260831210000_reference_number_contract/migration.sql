-- ============================================================
-- PHASE 3 PRE-STEP 3.12: Tenant-Scoped Reference Number Contract
-- ============================================================
-- 1. PartnerStorefront.storefrontCode — immutable short code (SF001, SF002, ...)
-- 2. referenceNumber on Order, Booking, Payment, Invoice, Refund
--    Marketplace: MKT-{TYPE}-{SEQ}
--    Storefront:  {SF_CODE}-{TYPE}-{SEQ}
--    SaaS:        SAAS-{SF_CODE}-{TYPE}-{SEQ}
-- ============================================================

-- 1. Storefront stable short code
ALTER TABLE "catalog"."PartnerStorefront" ADD COLUMN "storefrontCode" TEXT;
CREATE UNIQUE INDEX "PartnerStorefront_storefrontCode_key" ON "catalog"."PartnerStorefront"("storefrontCode");

-- 2. referenceNumber columns (nullable initially for backfill)
ALTER TABLE "order"."Order" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "booking"."Booking" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "finance"."Payment" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "finance"."Invoice" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "finance"."Refund" ADD COLUMN "referenceNumber" TEXT;

-- 3. Deterministic storefrontCode assignment (sorted by existing code, stable order)
UPDATE "catalog"."PartnerStorefront" sf
SET "storefrontCode" = sub.new_code
FROM (
  SELECT id, 'SF' || LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 3, '0') AS new_ref
  FROM "catalog"."PartnerStorefront"
) sub
WHERE sf.id = sub.id
AND sub.new_ref = (
  SELECT 'SF' || LPAD(ROW_NUMBER() OVER (ORDER BY sf2."code")::TEXT, 3, '0')
  FROM "catalog"."PartnerStorefront" sf2 WHERE sf2.id = sf.id
);

-- Fix: use simpler approach
-- Reset and re-assign
UPDATE "catalog"."PartnerStorefront" SET "storefrontCode" = NULL;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "code") AS rn
  FROM "catalog"."PartnerStorefront"
)
UPDATE "catalog"."PartnerStorefront" sf
SET "storefrontCode" = 'SF' || LPAD(o.rn::TEXT, 3, '0')
FROM ordered o WHERE sf.id = o.id;

-- 4. Backfill Order referenceNumbers
-- Marketplace Orders: MKT-ORD-{SEQ} ordered by code
UPDATE "order"."Order" o
SET "referenceNumber" = 'MKT-ORD-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "order"."Order"
  WHERE "acquisitionSource" = 'MARKETPLACE'
) sub
WHERE o.id = sub.id;

-- Storefront Orders with matching storefront: {SF_CODE}-ORD-{SEQ}
UPDATE "order"."Order" o
SET "referenceNumber" = sf."storefrontCode" || '-ORD-' || sub.new_ref
FROM (
  SELECT o2.id,
    o2."sellerPartnerId",
    ROW_NUMBER() OVER (
      PARTITION BY o2."sellerPartnerId"
      ORDER BY o2."code"
    ) AS rn
  FROM "order"."Order" o2
  WHERE o2."acquisitionSource" = 'PARTNER_STOREFRONT'
    AND o2."sellerPartnerId" IS NOT NULL
) sub
JOIN "catalog"."PartnerStorefront" sf ON sf."partnerId" = sub."sellerPartnerId"
WHERE o.id = sub.id;

-- Storefront Orders without matching storefront (orphaned): MKT-ORD fallback
UPDATE "order"."Order" o
SET "referenceNumber" = 'MKT-ORD-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "order"."Order"
  WHERE "referenceNumber" IS NULL
) sub
WHERE o.id = sub.id;

-- 5. Backfill Booking referenceNumbers
-- Marketplace Bookings: MKT-BKG-{SEQ}
UPDATE "booking"."Booking" b
SET "referenceNumber" = 'MKT-BKG-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "booking"."Booking"
  WHERE "acquisitionSource" = 'MARKETPLACE'
) sub
WHERE b.id = sub.id;

-- Storefront Bookings with matching storefront
UPDATE "booking"."Booking" b
SET "referenceNumber" = sf."storefrontCode" || '-BKG-' || sub.new_ref
FROM (
  SELECT b2.id,
    o."sellerPartnerId",
    ROW_NUMBER() OVER (
      PARTITION BY o."sellerPartnerId"
      ORDER BY b2."code"
    ) AS rn
  FROM "booking"."Booking" b2
  JOIN "order"."Order" o ON o.id = b2."orderId"
  WHERE b2."acquisitionSource" = 'PARTNER_STOREFRONT'
    AND o."sellerPartnerId" IS NOT NULL
) sub
JOIN "catalog"."PartnerStorefront" sf ON sf."partnerId" = sub."sellerPartnerId"
WHERE b.id = sub.id;

-- Remaining orphaned storefront bookings: MKT-BKG fallback
UPDATE "booking"."Booking" b
SET "referenceNumber" = 'MKT-BKG-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "booking"."Booking"
  WHERE "referenceNumber" IS NULL
) sub
WHERE b.id = sub.id;

-- 6. Backfill Payment referenceNumbers
-- Payments to Marketplace Orders: MKT-PAY-{SEQ}
UPDATE "finance"."Payment" p
SET "referenceNumber" = 'MKT-PAY-' || sub.new_ref
FROM (
  SELECT p2.id,
    LPAD(ROW_NUMBER() OVER (ORDER BY p2."code")::TEXT, 6, '0') AS new_ref
  FROM "finance"."Payment" p2
  JOIN "order"."Order" o ON o.id = p2."orderId"
  WHERE o."acquisitionSource" = 'MARKETPLACE'
) sub
WHERE p.id = sub.id;

-- Payments to Storefront Orders with matching storefront
UPDATE "finance"."Payment" p
SET "referenceNumber" = sf."storefrontCode" || '-PAY-' || sub.new_ref
FROM (
  SELECT p2.id,
    o."sellerPartnerId",
    ROW_NUMBER() OVER (
      PARTITION BY o."sellerPartnerId"
      ORDER BY p2."code"
    ) AS rn
  FROM "finance"."Payment" p2
  JOIN "order"."Order" o ON o.id = p2."orderId"
  WHERE o."acquisitionSource" = 'PARTNER_STOREFRONT'
    AND o."sellerPartnerId" IS NOT NULL
) sub
JOIN "catalog"."PartnerStorefront" sf ON sf."partnerId" = sub."sellerPartnerId"
WHERE p.id = sub.id;

-- Remaining orphaned storefront payments: MKT-PAY fallback
UPDATE "finance"."Payment" p
SET "referenceNumber" = 'MKT-PAY-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "finance"."Payment"
  WHERE "referenceNumber" IS NULL
) sub
WHERE p.id = sub.id;

-- 7. Backfill Refund referenceNumbers
-- Refunds to Marketplace Orders: MKT-REF-{SEQ}
UPDATE "finance"."Refund" r
SET "referenceNumber" = 'MKT-REF-' || sub.new_ref
FROM (
  SELECT r2.id,
    LPAD(ROW_NUMBER() OVER (ORDER BY r2."code")::TEXT, 6, '0') AS new_ref
  FROM "finance"."Refund" r2
  JOIN "order"."Order" o ON o.id = r2."orderId"
  WHERE o."acquisitionSource" = 'MARKETPLACE'
) sub
WHERE r.id = sub.id;

-- Refunds to Storefront Orders with matching storefront
UPDATE "finance"."Refund" r
SET "referenceNumber" = sf."storefrontCode" || '-REF-' || sub.new_ref
FROM (
  SELECT r2.id,
    o."sellerPartnerId",
    ROW_NUMBER() OVER (
      PARTITION BY o."sellerPartnerId"
      ORDER BY r2."code"
    ) AS rn
  FROM "finance"."Refund" r2
  JOIN "order"."Order" o ON o.id = r2."orderId"
  WHERE o."acquisitionSource" = 'PARTNER_STOREFRONT'
    AND o."sellerPartnerId" IS NOT NULL
) sub
JOIN "catalog"."PartnerStorefront" sf ON sf."partnerId" = sub."sellerPartnerId"
WHERE r.id = sub.id;

-- Remaining orphaned storefront refunds: MKT-REF fallback
UPDATE "finance"."Refund" r
SET "referenceNumber" = 'MKT-REF-' || sub.new_ref
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "code")::TEXT, 6, '0') AS new_ref
  FROM "finance"."Refund"
  WHERE "referenceNumber" IS NULL
) sub
WHERE r.id = sub.id;

-- 8. Enforce NOT NULL + unique constraints after backfill
ALTER TABLE "order"."Order" ALTER COLUMN "referenceNumber" SET NOT NULL;
ALTER TABLE "booking"."Booking" ALTER COLUMN "referenceNumber" SET NOT NULL;
ALTER TABLE "finance"."Payment" ALTER COLUMN "referenceNumber" SET NOT NULL;
ALTER TABLE "finance"."Refund" ALTER COLUMN "referenceNumber" SET NOT NULL;
ALTER TABLE "catalog"."PartnerStorefront" ALTER COLUMN "storefrontCode" SET NOT NULL;
-- Invoice remains nullable (0 rows exist, SaaS billing not implemented yet)

CREATE UNIQUE INDEX "Order_referenceNumber_key" ON "order"."Order"("referenceNumber");
CREATE INDEX "Order_referenceNumber_idx" ON "order"."Order"("referenceNumber");
CREATE UNIQUE INDEX "Booking_referenceNumber_key" ON "booking"."Booking"("referenceNumber");
CREATE INDEX "Booking_referenceNumber_idx" ON "booking"."Booking"("referenceNumber");
CREATE UNIQUE INDEX "Payment_referenceNumber_key" ON "finance"."Payment"("referenceNumber");
CREATE INDEX "Payment_referenceNumber_idx" ON "finance"."Payment"("referenceNumber");
CREATE UNIQUE INDEX "Refund_referenceNumber_key" ON "finance"."Refund"("referenceNumber");
CREATE INDEX "Refund_referenceNumber_idx" ON "finance"."Refund"("referenceNumber");
