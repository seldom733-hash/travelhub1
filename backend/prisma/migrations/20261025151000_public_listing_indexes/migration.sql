-- Public Marketplace listing performance (measured on dev DB 2026-10-25).
--
-- Before: the listing query
--   WHERE status='PUBLISHED' AND publishedAt IS NOT NULL
--     AND EXISTS (channel='MARKETPLACE')
--   ORDER BY publishedAt DESC, createdAt DESC, id ASC LIMIT 24
-- planned as Seq Scan (17 589 rows) + Hash Join + top-N Sort ≈ 190 ms on the
-- dev database (EXPLAIN ANALYZE in reports/explain-public-queries.cjs).
--
-- Additive indexes only — no data/contract changes. Names match Prisma's
-- default index naming so `prisma migrate diff` stays clean.

CREATE INDEX IF NOT EXISTS "Product_status_publishedAt_idx"
  ON "catalog"."Product" ("status", "publishedAt");

CREATE INDEX IF NOT EXISTS "ProductPublicationChannel_channel_productId_idx"
  ON "catalog"."ProductPublicationChannel" ("channel", "productId");
