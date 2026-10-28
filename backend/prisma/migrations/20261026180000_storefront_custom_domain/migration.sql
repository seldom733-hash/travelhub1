-- Custom domain for Storefront public host routing.
ALTER TABLE "catalog"."PartnerStorefront"
  ADD COLUMN IF NOT EXISTS "customDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "customDomainStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "customDomainToken" TEXT,
  ADD COLUMN IF NOT EXISTS "customDomainVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerStorefront_customDomain_key"
  ON "catalog"."PartnerStorefront" ("customDomain");
