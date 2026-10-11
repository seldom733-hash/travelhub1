-- Neutral product URLs (Owner Decision): synced catalog cards currently store
-- the SUPPLIER-NATIVE token directly in Product.code (e.g. KAZUNION-3548-4105),
-- which is also the buyer-facing URL (/products/<code>) and the sync upsert key.
-- Buyers must not see supplier identity in URLs.
--
-- Fix: split the two roles.
--   • supplierRef — supplier-native stable key (the sync natural key, e.g.
--     "KAZUNION-3548-4105"). Sync services match existing cards by THIS column.
--   • code        — neutral public identifier PRD-* (URL /products/PRD-*).
-- Manual (non-synced) products already use PRD-* and keep supplierRef = NULL.
--
-- Idempotent: already-re-coded cards (code ~ PRD-*) are excluded from backfill.

-- 1. Add supplier-native stable key column.
ALTER TABLE "catalog"."Product" ADD COLUMN IF NOT EXISTS "supplierRef" TEXT;

-- 2. Unique index (nullable: multiple NULLs allowed for manual products).
CREATE UNIQUE INDEX IF NOT EXISTS "Product_supplierRef_key"
    ON "catalog"."Product"("supplierRef");

-- 3. Backfill: синк-товары (attributes->>'supplierCode' present, code ещё не PRD-*)
--    → supplierRef = старый code (токен); code перекодируется в нейтральный PRD-*.
--    base.start = максимум(текущий PRD-счётчик, макс существующий PRD-суффикс),
--    чтобы новые коды НЕ коллидировали с ручными PRD-товарами.
WITH target AS (
    SELECT "id", "code",
           ROW_NUMBER() OVER (ORDER BY "id") AS rn
    FROM "catalog"."Product"
    WHERE "attributes"->>'supplierCode' IS NOT NULL
      AND "code" !~ '^PRD-[0-9]{8}$'
),
base AS (
    SELECT GREATEST(
        COALESCE((SELECT "value" FROM "events"."BusinessSequence" WHERE "prefix" = 'PRD'), 0),
        COALESCE((SELECT MAX(substring("code", 5)::int)
                  FROM "catalog"."Product" WHERE "code" ~ '^PRD-[0-9]{8}$'), 0)
    ) AS start
)
UPDATE "catalog"."Product" p
SET "supplierRef" = target."code",
    "code" = 'PRD-' || LPAD((base.start + target.rn)::text, 8, '0')
FROM target, base
WHERE p."id" = target."id";

-- 4. Поднять PRD-счётчик до итогового максимума (ручные PRD + перекодированные),
--    чтобы следующий nextCode("PRD") продолжил последовательность без коллизий.
INSERT INTO "events"."BusinessSequence" ("prefix", "value")
SELECT 'PRD', COALESCE((
    SELECT MAX(CASE WHEN "code" ~ '^PRD-[0-9]+$'
                    THEN substring("code", 5)::int
                    ELSE 0 END)
    FROM "catalog"."Product"
), 0)
ON CONFLICT ("prefix") DO UPDATE
SET "value" = GREATEST("events"."BusinessSequence"."value", EXCLUDED."value");
