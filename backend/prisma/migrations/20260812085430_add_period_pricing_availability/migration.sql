-- CreateEnum
CREATE TYPE "catalog"."CommercialPeriodStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."CommercialPeriodKind" AS ENUM ('PERIOD', 'DATE_OVERRIDE');

-- CreateTable
CREATE TABLE "catalog"."CommercialPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "kind" "catalog"."CommercialPeriodKind" NOT NULL DEFAULT 'PERIOD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" INTEGER[],
    "price" DECIMAL(12,2) NOT NULL,
    "sellable" BOOLEAN NOT NULL DEFAULT true,
    "status" "catalog"."CommercialPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."CommercialPeriodHistory" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialPeriodHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialPeriod_code_key" ON "catalog"."CommercialPeriod"("code");

-- CreateIndex
CREATE INDEX "CommercialPeriod_tariffId_status_idx" ON "catalog"."CommercialPeriod"("tariffId", "status");

-- CreateIndex
CREATE INDEX "CommercialPeriodHistory_periodId_idx" ON "catalog"."CommercialPeriodHistory"("periodId");

-- AddForeignKey
ALTER TABLE "catalog"."CommercialPeriod" ADD CONSTRAINT "CommercialPeriod_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "catalog"."Tariff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."CommercialPeriodHistory" ADD CONSTRAINT "CommercialPeriodHistory_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "catalog"."CommercialPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
