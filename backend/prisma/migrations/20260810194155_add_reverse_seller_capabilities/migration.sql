-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reverse";

-- CreateEnum
CREATE TYPE "reverse"."CapabilityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "reverse"."SellerCapability" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "destinations" JSONB NOT NULL,
    "acceptsBuyerRequests" BOOLEAN NOT NULL DEFAULT false,
    "status" "reverse"."CapabilityStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "SellerCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse"."SellerCapabilityHistory" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerCapabilityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerCapability_code_key" ON "reverse"."SellerCapability"("code");

-- CreateIndex
CREATE INDEX "SellerCapability_sellerId_idx" ON "reverse"."SellerCapability"("sellerId");

-- CreateIndex
CREATE INDEX "SellerCapability_sellerId_status_idx" ON "reverse"."SellerCapability"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerCapability_status_categoryId_idx" ON "reverse"."SellerCapability"("status", "categoryId");

-- CreateIndex
CREATE INDEX "SellerCapability_status_acceptsBuyerRequests_idx" ON "reverse"."SellerCapability"("status", "acceptsBuyerRequests");

-- CreateIndex
CREATE UNIQUE INDEX "SellerCapability_sellerId_categoryId_key" ON "reverse"."SellerCapability"("sellerId", "categoryId");

-- CreateIndex
CREATE INDEX "SellerCapabilityHistory_capabilityId_idx" ON "reverse"."SellerCapabilityHistory"("capabilityId");

-- AddForeignKey
ALTER TABLE "reverse"."SellerCapabilityHistory" ADD CONSTRAINT "SellerCapabilityHistory_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "reverse"."SellerCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
