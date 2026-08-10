-- CreateEnum
CREATE TYPE "sales"."QuoteDiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "sales"."Quote" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "discountType" "sales"."QuoteDiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "discountValue" DECIMAL(12,2),
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(12,2),
ADD COLUMN     "total" DECIMAL(12,2),
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sales"."QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "tariffCode" TEXT NOT NULL,
    "tariffName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."QuoteTraveler" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "sales"."QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteTraveler_quoteId_idx" ON "sales"."QuoteTraveler"("quoteId");

-- AddForeignKey
ALTER TABLE "sales"."QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."QuoteTraveler" ADD CONSTRAINT "QuoteTraveler_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
