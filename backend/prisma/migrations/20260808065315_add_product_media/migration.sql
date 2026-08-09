-- CreateEnum
CREATE TYPE "catalog"."MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "catalog"."MediaStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "catalog"."Product" ADD COLUMN     "partnerId" TEXT;

-- CreateTable
CREATE TABLE "catalog"."ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "catalog"."MediaType" NOT NULL DEFAULT 'IMAGE',
    "originalStorageKey" TEXT NOT NULL,
    "largeStorageKey" TEXT NOT NULL,
    "thumbnailStorageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "caption" TEXT,
    "altText" TEXT,
    "status" "catalog"."MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_originalStorageKey_key" ON "catalog"."ProductMedia"("originalStorageKey");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_idx" ON "catalog"."ProductMedia"("productId");

-- CreateIndex
CREATE INDEX "ProductMedia_status_idx" ON "catalog"."ProductMedia"("status");

-- AddForeignKey
ALTER TABLE "catalog"."ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

