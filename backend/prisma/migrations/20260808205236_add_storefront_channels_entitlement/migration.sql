-- CreateEnum
CREATE TYPE "catalog"."StorefrontEntitlementStatus" AS ENUM ('NONE', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "catalog"."PublicationChannel" AS ENUM ('MARKETPLACE', 'PARTNER_STOREFRONT');

-- AlterTable
ALTER TABLE "catalog"."PartnerStorefront" ADD COLUMN     "entitlementStatus" "catalog"."StorefrontEntitlementStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "catalog"."ProductPublicationChannel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" "catalog"."PublicationChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ProductPublicationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPublicationChannel_channel_idx" ON "catalog"."ProductPublicationChannel"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPublicationChannel_productId_channel_key" ON "catalog"."ProductPublicationChannel"("productId", "channel");

-- AddForeignKey
ALTER TABLE "catalog"."ProductPublicationChannel" ADD CONSTRAINT "ProductPublicationChannel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (REVIEW FIX 4): legacy/существующие Product получают MARKETPLACE как
-- единственный публичный канал (обратная совместимость — Marketplace остаётся
-- основным каналом; PARTNER_STOREFRONT включается только явно).
INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
SELECT gen_random_uuid(), p."id", 'MARKETPLACE', now()
FROM "catalog"."Product" p
WHERE NOT EXISTS (
  SELECT 1 FROM "catalog"."ProductPublicationChannel" pc
  WHERE pc."productId" = p."id" AND pc."channel" = 'MARKETPLACE'
);
