-- CreateEnum
CREATE TYPE "reverse"."ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "reverse"."SellerProposal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerRequestId" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "description" TEXT,
    "includedServices" TEXT,
    "exclusions" TEXT,
    "conditions" TEXT,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "status" "reverse"."ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "SellerProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse"."SellerProposalHistory" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerProposalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerProposal_code_key" ON "reverse"."SellerProposal"("code");

-- CreateIndex
CREATE INDEX "SellerProposal_sellerId_idx" ON "reverse"."SellerProposal"("sellerId");

-- CreateIndex
CREATE INDEX "SellerProposal_sellerId_status_idx" ON "reverse"."SellerProposal"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerProposal_buyerRequestId_status_idx" ON "reverse"."SellerProposal"("buyerRequestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProposal_buyerRequestId_sellerId_key" ON "reverse"."SellerProposal"("buyerRequestId", "sellerId");

-- CreateIndex
CREATE INDEX "SellerProposalHistory_proposalId_idx" ON "reverse"."SellerProposalHistory"("proposalId");

-- AddForeignKey
ALTER TABLE "reverse"."SellerProposal" ADD CONSTRAINT "SellerProposal_buyerRequestId_fkey" FOREIGN KEY ("buyerRequestId") REFERENCES "reverse"."BuyerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse"."SellerProposal" ADD CONSTRAINT "SellerProposal_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "reverse"."BuyerRequestDistribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse"."SellerProposalHistory" ADD CONSTRAINT "SellerProposalHistory_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "reverse"."SellerProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
