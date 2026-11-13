ALTER TABLE "catalog"."Product" ADD COLUMN "isGds" BOOLEAN NOT NULL DEFAULT false;
UPDATE "catalog"."Product"
SET "isGds" = true
WHERE type = 'TOUR'
  AND title ~* '(^|[^A-Za-z])GDS([^A-Za-z]|$)';
CREATE INDEX "Product_isGds_idx" ON "catalog"."Product"("isGds");
