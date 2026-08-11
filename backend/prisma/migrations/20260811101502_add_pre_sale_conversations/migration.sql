-- AlterEnum
ALTER TYPE "communication"."CommunicationContextType" ADD VALUE 'BUYER_REQUEST';

-- AlterTable
ALTER TABLE "communication"."Communication" ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "communication"."CommunicationThread" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyerRequestId" TEXT NOT NULL,
    "buyerCustomerId" TEXT NOT NULL,
    "sellerPartnerId" TEXT NOT NULL,
    "proposalId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationThread_code_key" ON "communication"."CommunicationThread"("code");

-- CreateIndex
CREATE INDEX "CommunicationThread_buyerCustomerId_idx" ON "communication"."CommunicationThread"("buyerCustomerId");

-- CreateIndex
CREATE INDEX "CommunicationThread_sellerPartnerId_idx" ON "communication"."CommunicationThread"("sellerPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationThread_buyerRequestId_sellerPartnerId_key" ON "communication"."CommunicationThread"("buyerRequestId", "sellerPartnerId");

-- CreateIndex
CREATE INDEX "Communication_threadId_idx" ON "communication"."Communication"("threadId");

-- AddForeignKey
ALTER TABLE "communication"."Communication" ADD CONSTRAINT "Communication_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "communication"."CommunicationThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
