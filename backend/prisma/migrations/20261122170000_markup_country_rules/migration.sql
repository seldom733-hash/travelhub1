-- Country-scoped markup and commission rules.
ALTER TABLE "finance"."MarkupRule"
  ADD COLUMN IF NOT EXISTS "countryCodes" text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE "finance"."SupplierCommissionRule"
  ADD COLUMN IF NOT EXISTS "countryCodes" text[] NOT NULL DEFAULT ARRAY[]::text[];
