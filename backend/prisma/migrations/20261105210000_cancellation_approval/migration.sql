CREATE TABLE "finance"."CancellationApproval" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submittedById" TEXT NOT NULL,
  "submittedByName" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CancellationApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CancellationApproval_code_key" ON "finance"."CancellationApproval"("code");
CREATE INDEX "CancellationApproval_orderId_idx" ON "finance"."CancellationApproval"("orderId");
