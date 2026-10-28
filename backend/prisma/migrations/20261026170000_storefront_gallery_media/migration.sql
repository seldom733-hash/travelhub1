-- Storefront media library: multiple GALLERY images, ordering and alt text.
ALTER TYPE "catalog"."StorefrontMediaKind" ADD VALUE IF NOT EXISTS 'GALLERY';

ALTER TABLE "catalog"."StorefrontMedia"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "altText" TEXT;

DROP INDEX IF EXISTS "catalog"."StorefrontMedia_storefrontId_kind_key";

CREATE INDEX IF NOT EXISTS "StorefrontMedia_storefrontId_kind_idx"
  ON "catalog"."StorefrontMedia" ("storefrontId", "kind");
