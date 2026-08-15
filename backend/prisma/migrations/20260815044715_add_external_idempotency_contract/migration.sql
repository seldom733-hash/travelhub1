-- CreateEnum
CREATE TYPE "events"."ExternalIdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "events"."ExternalIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "events"."ExternalIdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdempotencyRecord_slotKey_key" ON "events"."ExternalIdempotencyRecord"("slotKey");

-- CreateIndex
CREATE INDEX "ExternalIdempotencyRecord_scopeType_scopeId_operation_idx" ON "events"."ExternalIdempotencyRecord"("scopeType", "scopeId", "operation");

-- CreateIndex
CREATE INDEX "ExternalIdempotencyRecord_status_claimedAt_idx" ON "events"."ExternalIdempotencyRecord"("status", "claimedAt");
