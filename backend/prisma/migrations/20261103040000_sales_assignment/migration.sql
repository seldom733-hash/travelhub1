ALTER TABLE "order"."Request"
  ADD COLUMN "assignedManagerId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "assignmentType" TEXT,
  ADD COLUMN "assignmentState" TEXT NOT NULL DEFAULT 'UNASSIGNED',
  ADD COLUMN "firstOpenedAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "firstContactAt" TIMESTAMP(3),
  ADD COLUMN "slaDueAt" TIMESTAMP(3),
  ADD COLUMN "assignmentVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Request_assignedManagerId_status_idx" ON "order"."Request"("assignedManagerId", "status");
CREATE INDEX "Request_assignmentState_createdAt_idx" ON "order"."Request"("assignmentState", "createdAt");
CREATE INDEX "Request_slaDueAt_status_idx" ON "order"."Request"("slaDueAt", "status");

CREATE TABLE "sales"."SalesManagerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "participatesInAutoDistribution" BOOLEAN NOT NULL DEFAULT true,
  "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "maxActiveRequests" INTEGER,
  "allowedRequestTypes" JSONB,
  "lastAssignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesManagerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesManagerProfile_userId_key" ON "sales"."SalesManagerProfile"("userId");
CREATE INDEX "SalesManagerProfile_availability_participatesInAutoDistribution_idx" ON "sales"."SalesManagerProfile"("availability", "participatesInAutoDistribution");

CREATE TABLE "security"."UserNotification" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "payload" JSONB,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserNotification_dedupeKey_key" ON "security"."UserNotification"("dedupeKey");
CREATE INDEX "UserNotification_recipientId_readAt_idx" ON "security"."UserNotification"("recipientId", "readAt");
CREATE INDEX "UserNotification_recipientId_type_readAt_idx" ON "security"."UserNotification"("recipientId", "type", "readAt");
