-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "documents";

-- CreateEnum
CREATE TYPE "documents"."DocumentType" AS ENUM ('PARTIAL_PAYMENT', 'VOUCHER', 'REFUND');

-- CreateEnum
CREATE TYPE "documents"."DocumentStatus" AS ENUM ('NOT_ISSUED', 'ISSUED', 'SUPERSEDED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "documents"."Document" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "documents"."DocumentType" NOT NULL,
    "status" "documents"."DocumentStatus" NOT NULL DEFAULT 'NOT_ISSUED',
    "bookingId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "currentVersionId" TEXT,
    "serviceDate" TIMESTAMP(3),
    "serviceTime" TEXT,
    "serviceTimeZone" TEXT,
    "totalAmount" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2),
    "currency" TEXT,
    "paymentStatus" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "documents"."DocumentStatus" NOT NULL DEFAULT 'NOT_ISSUED',
    "s3Key" TEXT,
    "fileSize" INTEGER,
    "templateId" TEXT,
    "templateVersion" TEXT,
    "issuedAt" TIMESTAMP(3),
    "triggeringEvent" TEXT,
    "actorId" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."DocumentHistory" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "versionNumber" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "documents"."DocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "schema" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_code_key" ON "documents"."Document"("code");

-- CreateIndex
CREATE INDEX "Document_bookingId_idx" ON "documents"."Document"("bookingId");

-- CreateIndex
CREATE INDEX "Document_orderId_idx" ON "documents"."Document"("orderId");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "documents"."Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "documents"."Document"("type");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "documents"."Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "documents"."DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "documents"."DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentHistory_documentId_idx" ON "documents"."DocumentHistory"("documentId");

-- CreateIndex
CREATE INDEX "DocumentHistory_createdAt_idx" ON "documents"."DocumentHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_name_key" ON "documents"."DocumentTemplate"("name");

-- CreateIndex
CREATE INDEX "DocumentTemplate_type_idx" ON "documents"."DocumentTemplate"("type");
