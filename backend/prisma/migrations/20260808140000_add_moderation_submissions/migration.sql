-- CreateEnum
CREATE TYPE "catalog"."ModerationSubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "catalog"."ModerationSubmission" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersion" INTEGER NOT NULL,
    "submittedById" TEXT,
    "submittedByUsername" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "catalog"."ModerationSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assignedModeratorId" TEXT,
    "assignedModeratorUsername" TEXT,
    "reviewStartedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "reasonCode" TEXT,
    "comment" TEXT,
    "snapshot" JSONB NOT NULL,
    "previousSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationSubmission_productId_idx" ON "catalog"."ModerationSubmission"("productId");

-- CreateIndex
CREATE INDEX "ModerationSubmission_status_idx" ON "catalog"."ModerationSubmission"("status");

-- CreateIndex
CREATE INDEX "ModerationSubmission_submittedAt_idx" ON "catalog"."ModerationSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "ModerationSubmission_assignedModeratorId_idx" ON "catalog"."ModerationSubmission"("assignedModeratorId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationSubmission_one_submitted_per_product" ON "catalog"."ModerationSubmission"("productId") WHERE ("status" = 'SUBMITTED');

-- CreateIndex
CREATE UNIQUE INDEX "ModerationSubmission_one_inreview_per_product" ON "catalog"."ModerationSubmission"("productId") WHERE ("status" = 'IN_REVIEW');

-- AddForeignKey
ALTER TABLE "catalog"."ModerationSubmission" ADD CONSTRAINT "ModerationSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
