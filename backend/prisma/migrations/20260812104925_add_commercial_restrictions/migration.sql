-- CreateEnum
CREATE TYPE "catalog"."CommercialRestrictionScope" AS ENUM ('PERIOD', 'DATE');

-- CreateEnum
CREATE TYPE "catalog"."CommercialRestrictionType" AS ENUM ('STOP_SELL', 'MIN_STAY', 'ADVANCE_BOOKING', 'CLOSED_TO_ARRIVAL', 'CLOSED_TO_DEPARTURE');

-- CreateEnum
CREATE TYPE "catalog"."CommercialRestrictionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "catalog"."CommercialRestriction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "scope" "catalog"."CommercialRestrictionScope" NOT NULL,
    "commercialPeriodId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "type" "catalog"."CommercialRestrictionType" NOT NULL,
    "value" INTEGER,
    "status" "catalog"."CommercialRestrictionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CommercialRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."CommercialRestrictionHistory" (
    "id" TEXT NOT NULL,
    "restrictionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialRestrictionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialRestriction_code_key" ON "catalog"."CommercialRestriction"("code");

-- CreateIndex
CREATE INDEX "CommercialRestriction_tariffId_status_idx" ON "catalog"."CommercialRestriction"("tariffId", "status");

-- CreateIndex
CREATE INDEX "CommercialRestriction_commercialPeriodId_idx" ON "catalog"."CommercialRestriction"("commercialPeriodId");

-- CreateIndex
CREATE INDEX "CommercialRestriction_type_status_idx" ON "catalog"."CommercialRestriction"("type", "status");

-- CreateIndex
CREATE INDEX "CommercialRestrictionHistory_restrictionId_idx" ON "catalog"."CommercialRestrictionHistory"("restrictionId");

-- AddForeignKey
ALTER TABLE "catalog"."CommercialRestriction" ADD CONSTRAINT "CommercialRestriction_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "catalog"."Tariff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."CommercialRestriction" ADD CONSTRAINT "CommercialRestriction_commercialPeriodId_fkey" FOREIGN KEY ("commercialPeriodId") REFERENCES "catalog"."CommercialPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."CommercialRestrictionHistory" ADD CONSTRAINT "CommercialRestrictionHistory_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "catalog"."CommercialRestriction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
