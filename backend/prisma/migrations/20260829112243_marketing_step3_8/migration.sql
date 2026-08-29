-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "marketing";

-- CreateEnum
CREATE TYPE "marketing"."CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "marketing"."CampaignObjective" AS ENUM ('AWARENESS', 'ENGAGEMENT', 'CONVERSION', 'RETENTION', 'REACTIVATION');

-- CreateTable
CREATE TABLE "marketing"."Campaign" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" "marketing"."CampaignObjective",
    "status" "marketing"."CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "partnerId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing"."CampaignAudience" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB,
    "estimatedCount" INTEGER,
    "partnerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CampaignAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing"."CampaignAttribution" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "attributionType" TEXT NOT NULL DEFAULT 'FIRST_TOUCH',
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "partnerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_code_key" ON "marketing"."Campaign"("code");

-- CreateIndex
CREATE INDEX "Campaign_partnerId_status_idx" ON "marketing"."Campaign"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_createdAt_idx" ON "marketing"."Campaign"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAudience_code_key" ON "marketing"."CampaignAudience"("code");

-- CreateIndex
CREATE INDEX "CampaignAudience_campaignId_idx" ON "marketing"."CampaignAudience"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignAudience_partnerId_idx" ON "marketing"."CampaignAudience"("partnerId");

-- CreateIndex
CREATE INDEX "CampaignAttribution_entityType_entityId_idx" ON "marketing"."CampaignAttribution"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CampaignAttribution_partnerId_campaignId_idx" ON "marketing"."CampaignAttribution"("partnerId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAttribution_campaignId_entityType_entityId_key" ON "marketing"."CampaignAttribution"("campaignId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "marketing"."Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "security"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."CampaignAudience" ADD CONSTRAINT "CampaignAudience_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."CampaignAudience" ADD CONSTRAINT "CampaignAudience_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "security"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "security"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "crm"."CrmActivity_dedupe_key" RENAME TO "CrmActivity_sourceType_sourceId_sourceEvent_key";
