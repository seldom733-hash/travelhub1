-- CreateEnum
CREATE TYPE "sales"."CheckoutStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "sales"."SalesAcquisitionSource" AS ENUM ('MARKETPLACE', 'PARTNER_STOREFRONT', 'DIRECT');

-- CreateTable
CREATE TABLE "sales"."CheckoutIntent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "sales"."CheckoutStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountType" "sales"."QuoteDiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "acquisitionSource" "sales"."SalesAcquisitionSource" NOT NULL DEFAULT 'DIRECT',
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."CheckoutIntentTraveler" (
    "id" TEXT NOT NULL,
    "checkoutIntentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutIntentTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."CheckoutIntentHistory" (
    "id" TEXT NOT NULL,
    "checkoutIntentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutIntentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_code_key" ON "sales"."CheckoutIntent"("code");

-- CreateIndex
CREATE INDEX "CheckoutIntent_status_idx" ON "sales"."CheckoutIntent"("status");

-- CreateIndex
CREATE INDEX "CheckoutIntent_quoteId_idx" ON "sales"."CheckoutIntent"("quoteId");

-- CreateIndex
CREATE INDEX "CheckoutIntent_customerId_idx" ON "sales"."CheckoutIntent"("customerId");

-- CreateIndex
CREATE INDEX "CheckoutIntent_status_createdAt_idx" ON "sales"."CheckoutIntent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutIntentTraveler_checkoutIntentId_idx" ON "sales"."CheckoutIntentTraveler"("checkoutIntentId");

-- CreateIndex
CREATE INDEX "CheckoutIntentHistory_checkoutIntentId_idx" ON "sales"."CheckoutIntentHistory"("checkoutIntentId");

-- AddForeignKey
ALTER TABLE "sales"."CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales"."Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."CheckoutIntentTraveler" ADD CONSTRAINT "CheckoutIntentTraveler_checkoutIntentId_fkey" FOREIGN KEY ("checkoutIntentId") REFERENCES "sales"."CheckoutIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."CheckoutIntentHistory" ADD CONSTRAINT "CheckoutIntentHistory_checkoutIntentId_fkey" FOREIGN KEY ("checkoutIntentId") REFERENCES "sales"."CheckoutIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
