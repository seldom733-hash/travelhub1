CREATE TABLE IF NOT EXISTS "catalog"."PartnerActiveCategory" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerActiveCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartnerActiveCategory_partnerId_categoryId_key" UNIQUE ("partnerId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "PartnerActiveCategory_partnerId_idx" ON "catalog"."PartnerActiveCategory"("partnerId");
