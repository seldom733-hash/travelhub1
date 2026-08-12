/*
  Warnings:

  - Added the required column `updatedAt` to the `Tariff` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "catalog"."PriceBasis" AS ENUM ('PER_UNIT', 'PER_ROOM', 'PER_PERSON', 'PER_NIGHT', 'PER_DAY', 'PER_HOUR', 'PER_TRIP', 'PER_SERVICE', 'PACKAGE_TOTAL');

-- CreateEnum
CREATE TYPE "catalog"."Refundability" AS ENUM ('REFUNDABLE', 'NON_REFUNDABLE');

-- CreateEnum
CREATE TYPE "catalog"."RatePlanPricingMode" AS ENUM ('FIXED', 'PRICE_ON_REQUEST');

-- CreateEnum
CREATE TYPE "catalog"."RatePlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "catalog"."Tariff" ADD COLUMN     "inclusions" JSONB,
ADD COLUMN     "priceBasis" "catalog"."PriceBasis",
ADD COLUMN     "pricingMode" "catalog"."RatePlanPricingMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "refundability" "catalog"."Refundability",
ADD COLUMN     "restrictions" JSONB,
ADD COLUMN     "serviceUnitId" TEXT,
ADD COLUMN     "status" "catalog"."RatePlanStatus" NOT NULL DEFAULT 'ACTIVE',
-- Prisma @updatedAt не генерит DEFAULT в ALTER для существующей таблицы;
-- фактическое значение поддерживается @updatedAt (обновления), а default нужен
-- только для additive backfill существующих legacy-строк (момент миграции).
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "catalog"."TariffHistory" (
    "id" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TariffHistory_tariffId_idx" ON "catalog"."TariffHistory"("tariffId");

-- CreateIndex
CREATE INDEX "Tariff_serviceUnitId_idx" ON "catalog"."Tariff"("serviceUnitId");

-- CreateIndex
CREATE INDEX "Tariff_status_idx" ON "catalog"."Tariff"("status");

-- AddForeignKey
ALTER TABLE "catalog"."Tariff" ADD CONSTRAINT "Tariff_serviceUnitId_fkey" FOREIGN KEY ("serviceUnitId") REFERENCES "catalog"."ServiceUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- STRICT REVIEW §52: Restrict — Rate Plan с аудит-историей нельзя удалить
-- физически (legacy tariffs-replacement перехватывается → 409 в сервисе).
ALTER TABLE "catalog"."TariffHistory" ADD CONSTRAINT "TariffHistory_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "catalog"."Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
