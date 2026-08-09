-- DB-level invariant (Step 1.2 review fix #1):
-- для одного Product физически невозможно иметь более одного
-- ProductMedia.isPrimary = true (partial unique index, PostgreSQL).
-- Раньше инвариант гарантировался только application-транзакцией (setPrimary:
-- updateMany(clear) + update(set)) — теперь дублируется на уровне БД, поэтому
-- даже concurrent writes не могут оставить два primary media.
CREATE UNIQUE INDEX "ProductMedia_one_primary_per_product"
  ON "catalog"."ProductMedia"("productId")
  WHERE "isPrimary" = true;
