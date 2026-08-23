-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "decision";

-- CreateEnum
CREATE TYPE "decision"."SignalStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "decision"."DecisionSignal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "decision"."SignalStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "affectedEntities" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" TEXT,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionSignal_fingerprint_key" ON "decision"."DecisionSignal"("fingerprint");

-- CreateIndex
CREATE INDEX "DecisionSignal_status_idx" ON "decision"."DecisionSignal"("status");

-- CreateIndex
CREATE INDEX "DecisionSignal_category_idx" ON "decision"."DecisionSignal"("category");

-- CreateIndex
CREATE INDEX "DecisionSignal_code_idx" ON "decision"."DecisionSignal"("code");

-- CreateIndex
CREATE INDEX "DecisionSignal_lastDetectedAt_idx" ON "decision"."DecisionSignal"("lastDetectedAt");

-- CreateIndex
CREATE INDEX "DecisionSignal_source_idx" ON "decision"."DecisionSignal"("source");
