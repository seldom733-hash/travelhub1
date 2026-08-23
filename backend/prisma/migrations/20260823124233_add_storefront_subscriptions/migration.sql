-- CreateEnum
CREATE TYPE "catalog"."StorefrontPlanType" AS ENUM ('FREE_TRIAL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "catalog"."StorefrontSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- CreateTable
CREATE TABLE "catalog"."StorefrontSubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" "catalog"."StorefrontPlanType" NOT NULL,
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontSubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."StorefrontSubscription" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "catalog"."StorefrontSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "totalPaidUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontSubscriptionPlan_code_key" ON "catalog"."StorefrontSubscriptionPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontSubscription_code_key" ON "catalog"."StorefrontSubscription"("code");

-- CreateIndex
CREATE INDEX "StorefrontSubscription_status_idx" ON "catalog"."StorefrontSubscription"("status");

-- CreateIndex
CREATE INDEX "StorefrontSubscription_currentPeriodEnd_idx" ON "catalog"."StorefrontSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontSubscription_storefrontId_key" ON "catalog"."StorefrontSubscription"("storefrontId");

-- AddForeignKey
ALTER TABLE "catalog"."StorefrontSubscription" ADD CONSTRAINT "StorefrontSubscription_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "catalog"."PartnerStorefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."StorefrontSubscription" ADD CONSTRAINT "StorefrontSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "catalog"."StorefrontSubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
