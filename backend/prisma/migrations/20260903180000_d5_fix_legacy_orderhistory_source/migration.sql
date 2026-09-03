-- C5: Fix legacy OrderHistory source semantics
-- Legacy rows before D5 had no source column. The previous migration set them to 'API',
-- which is fictional provenance — we cannot prove these events came from an API call.
-- Correct approach: set legacy rows to NULL (honest unknown origin).

-- 1. Change column default from 'API' to NULL
ALTER TABLE "order"."OrderHistory" ALTER COLUMN "source" DROP DEFAULT;

-- 2. Null out legacy rows that were set to 'API' by the previous migration.
-- New rows created by D5-R1 code paths will have explicit source values.
-- This targets rows where source='API' AND no explicit source was set in code
-- (i.e., legacy lifecycle/field events created before structured source existed).
UPDATE "order"."OrderHistory" SET "source" = NULL WHERE "source" = 'API';
