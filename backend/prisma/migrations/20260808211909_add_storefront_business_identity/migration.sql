/*
  Warnings:

  - You are about to drop the column `displayName` on the `PartnerStorefront` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "catalog"."StorefrontMediaKind" AS ENUM ('LOGO', 'HERO');

-- AlterTable
ALTER TABLE "catalog"."PartnerStorefront" DROP COLUMN "displayName",
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "heroHeading" TEXT,
ADD COLUMN     "heroSubheading" TEXT,
ADD COLUMN     "publicEmail" TEXT,
ADD COLUMN     "publicPhone" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "themePreset" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "catalog"."StorefrontMedia" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "kind" "catalog"."StorefrontMediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalFileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "StorefrontMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorefrontMedia_storefrontId_idx" ON "catalog"."StorefrontMedia"("storefrontId");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontMedia_storefrontId_kind_key" ON "catalog"."StorefrontMedia"("storefrontId", "kind");

-- AddForeignKey
ALTER TABLE "catalog"."StorefrontMedia" ADD CONSTRAINT "StorefrontMedia_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "catalog"."PartnerStorefront"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
