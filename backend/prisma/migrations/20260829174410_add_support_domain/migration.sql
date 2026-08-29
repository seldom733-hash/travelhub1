-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "support";

-- CreateEnum
CREATE TYPE "support"."SupportCaseType" AS ENUM ('GENERAL', 'ORDER_ISSUE', 'BOOKING_ISSUE', 'PAYMENT_ISSUE', 'REFUND_REQUEST', 'TECHNICAL', 'BILLING', 'PARTNER_ISSUE', 'PRODUCT_QUALITY');

-- CreateEnum
CREATE TYPE "support"."SupportCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "support"."SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_PARTNER', 'WAITING_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "support"."Case" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "caseType" "support"."SupportCaseType" NOT NULL DEFAULT 'GENERAL',
    "priority" "support"."SupportCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "support"."SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "bookingId" TEXT,
    "assignedToId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "escalatedById" TEXT,
    "escalationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support"."CaseComment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CaseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support"."CaseCommunicationLink" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CaseCommunicationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support"."CaseHistory" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Case_code_key" ON "support"."Case"("code");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "support"."Case"("status");

-- CreateIndex
CREATE INDEX "Case_customerId_idx" ON "support"."Case"("customerId");

-- CreateIndex
CREATE INDEX "Case_orderId_idx" ON "support"."Case"("orderId");

-- CreateIndex
CREATE INDEX "Case_bookingId_idx" ON "support"."Case"("bookingId");

-- CreateIndex
CREATE INDEX "Case_assignedToId_idx" ON "support"."Case"("assignedToId");

-- CreateIndex
CREATE INDEX "Case_createdById_idx" ON "support"."Case"("createdById");

-- CreateIndex
CREATE INDEX "Case_createdAt_idx" ON "support"."Case"("createdAt");

-- CreateIndex
CREATE INDEX "CaseComment_caseId_idx" ON "support"."CaseComment"("caseId");

-- CreateIndex
CREATE INDEX "CaseComment_authorId_idx" ON "support"."CaseComment"("authorId");

-- CreateIndex
CREATE INDEX "CaseCommunicationLink_communicationId_idx" ON "support"."CaseCommunicationLink"("communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseCommunicationLink_caseId_communicationId_key" ON "support"."CaseCommunicationLink"("caseId", "communicationId");

-- CreateIndex
CREATE INDEX "CaseHistory_caseId_idx" ON "support"."CaseHistory"("caseId");

-- CreateIndex
CREATE INDEX "CaseHistory_createdAt_idx" ON "support"."CaseHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "support"."CaseComment" ADD CONSTRAINT "CaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "support"."Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support"."CaseCommunicationLink" ADD CONSTRAINT "CaseCommunicationLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "support"."Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support"."CaseHistory" ADD CONSTRAINT "CaseHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "support"."Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
