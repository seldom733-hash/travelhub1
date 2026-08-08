-- CreateEnum
CREATE TYPE "catalog"."CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "catalog"."CategorySchemaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- AlterTable: slug добавляется nullable (environment-safe — корректно обрабатывает
-- существующие строки Category; display title НЕ источник identity)
ALTER TABLE "catalog"."Category" ADD COLUMN "slug" TEXT,
ADD COLUMN "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- Deterministic backfill: code (CAT-*) уникален → slug гарантированно уникален.
-- 'category-' || lower(code) — детерминированный технический id для исторических строк.
UPDATE "catalog"."Category" SET "slug" = 'category-' || lower("code") WHERE "slug" IS NULL;

-- Uniqueness validation: создание UNIQUE-индекса ниже упадёт при дубликатах (defensive).

-- Enforce NOT NULL
ALTER TABLE "catalog"."Category" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "catalog"."Product" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "categorySchemaId" TEXT;

-- CreateTable
CREATE TABLE "catalog"."CategorySchema" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "catalog"."CategorySchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "attributes" JSONB NOT NULL,
    "availability" JSONB,
    "tariffRules" JSONB,
    "mediaRequirements" JSONB,
    "pdpSections" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorySchema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategorySchema_status_idx" ON "catalog"."CategorySchema"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CategorySchema_categoryId_version_key" ON "catalog"."CategorySchema"("categoryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "catalog"."Category"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "catalog"."Product"("categoryId");

-- AddForeignKey
ALTER TABLE "catalog"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."Product" ADD CONSTRAINT "Product_categorySchemaId_fkey" FOREIGN KEY ("categorySchemaId") REFERENCES "catalog"."CategorySchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."CategorySchema" ADD CONSTRAINT "CategorySchema_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
