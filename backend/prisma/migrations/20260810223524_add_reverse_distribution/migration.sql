-- CreateTable
CREATE TABLE "reverse"."BuyerRequestDistribution" (
    "id" TEXT NOT NULL,
    "buyerRequestId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerRequestDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyerRequestDistribution_sellerId_idx" ON "reverse"."BuyerRequestDistribution"("sellerId");

-- CreateIndex
CREATE INDEX "BuyerRequestDistribution_sellerId_distributedAt_idx" ON "reverse"."BuyerRequestDistribution"("sellerId", "distributedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerRequestDistribution_buyerRequestId_sellerId_key" ON "reverse"."BuyerRequestDistribution"("buyerRequestId", "sellerId");

-- AddForeignKey
ALTER TABLE "reverse"."BuyerRequestDistribution" ADD CONSTRAINT "BuyerRequestDistribution_buyerRequestId_fkey" FOREIGN KEY ("buyerRequestId") REFERENCES "reverse"."BuyerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
