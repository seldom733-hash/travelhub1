-- Backfill commerceSequence for existing MKT-ORD-* orders
-- Extract the 8-digit numeric part from referenceNumber
UPDATE "order"."Order"
SET "commerceSequence" = LPAD(SUBSTRING("referenceNumber" FROM 'MKT-ORD-(\d+)'), 8, '0')
WHERE "referenceNumber" LIKE 'MKT-ORD-%' AND "commerceSequence" IS NULL;

-- Backfill Booking commerceSequence from parent Order
UPDATE "booking"."Booking" b
SET "commerceSequence" = o."commerceSequence"
FROM "order"."Order" o
WHERE b."orderId" = o."id" AND o."commerceSequence" IS NOT NULL AND b."commerceSequence" IS NULL;

-- Backfill Payment commerceSequence from parent Order
UPDATE "finance"."Payment" p
SET "commerceSequence" = o."commerceSequence"
FROM "order"."Order" o
WHERE p."orderId" = o."id" AND o."commerceSequence" IS NOT NULL AND p."commerceSequence" IS NULL;

-- Backfill Payment ordinal (position within order)
WITH payment_ordinals AS (
  SELECT p.id, ROW_NUMBER() OVER (PARTITION BY p."orderId" ORDER BY p."createdAt" ASC, p.id ASC)::int as ordinal
  FROM "finance"."Payment" p
)
UPDATE "finance"."Payment" p
SET "paymentOrdinal" = po.ordinal
FROM payment_ordinals po
WHERE p.id = po.id AND p."paymentOrdinal" IS NULL;
