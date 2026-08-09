-- CreateEnum
CREATE TYPE "catalog"."StorefrontStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "catalog"."PartnerStorefront" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "catalog"."StorefrontStatus" NOT NULL DEFAULT 'DRAFT',
    "displayName" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "activatedById" TEXT,
    "deactivatedById" TEXT,

    CONSTRAINT "PartnerStorefront_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStorefront_code_key" ON "catalog"."PartnerStorefront"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStorefront_partnerId_key" ON "catalog"."PartnerStorefront"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStorefront_slug_key" ON "catalog"."PartnerStorefront"("slug");

-- CreateIndex
CREATE INDEX "PartnerStorefront_status_idx" ON "catalog"."PartnerStorefront"("status");
