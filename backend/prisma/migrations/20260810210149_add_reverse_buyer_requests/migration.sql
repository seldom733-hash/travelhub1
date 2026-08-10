-- CreateEnum
CREATE TYPE "reverse"."BuyerRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "reverse"."BuyerRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "destinations" JSONB NOT NULL,
    "serviceDateFrom" TIMESTAMP(3),
    "serviceDateTo" TIMESTAMP(3),
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "budget" JSONB,
    "preferences" JSONB,
    "acquisitionSource" TEXT NOT NULL DEFAULT 'BUYER_REQUEST',
    "status" "reverse"."BuyerRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "BuyerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse"."BuyerRequestHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerRequest_code_key" ON "reverse"."BuyerRequest"("code");

-- CreateIndex
CREATE INDEX "BuyerRequest_buyerId_idx" ON "reverse"."BuyerRequest"("buyerId");

-- CreateIndex
CREATE INDEX "BuyerRequest_buyerId_status_idx" ON "reverse"."BuyerRequest"("buyerId", "status");

-- CreateIndex
CREATE INDEX "BuyerRequest_status_categoryId_idx" ON "reverse"."BuyerRequest"("status", "categoryId");

-- CreateIndex
CREATE INDEX "BuyerRequest_status_createdAt_idx" ON "reverse"."BuyerRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BuyerRequestHistory_requestId_idx" ON "reverse"."BuyerRequestHistory"("requestId");

-- AddForeignKey
ALTER TABLE "reverse"."BuyerRequestHistory" ADD CONSTRAINT "BuyerRequestHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "reverse"."BuyerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
