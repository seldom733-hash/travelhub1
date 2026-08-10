-- CreateEnum
CREATE TYPE "catalog"."AvailabilityReservationStatus" AS ENUM ('HELD', 'RELEASED');

-- AlterTable
ALTER TABLE "events"."OutboxEvent" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "retryable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sales"."Sale" ADD COLUMN     "acquisitionSource" "sales"."SalesAcquisitionSource",
ADD COLUMN     "checkoutIntentId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "discountType" "sales"."QuoteDiscountType",
ADD COLUMN     "discountValue" DECIMAL(12,2),
ADD COLUMN     "initialAmount" DECIMAL(12,2),
ADD COLUMN     "orderRequestedEventId" TEXT,
ADD COLUMN     "paymentScheme" "sales"."PaymentScheme",
ADD COLUMN     "prepaymentType" "sales"."PaymentPrepaymentType",
ADD COLUMN     "prepaymentValue" DECIMAL(12,2),
ADD COLUMN     "remainingAmount" DECIMAL(12,2),
ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "serviceDate" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(12,2),
ADD COLUMN     "total" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "catalog"."AvailabilityReservation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tariffId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sourceSaleId" TEXT NOT NULL,
    "status" "catalog"."AvailabilityReservationStatus" NOT NULL DEFAULT 'HELD',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "AvailabilityReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityReservation_code_key" ON "catalog"."AvailabilityReservation"("code");

-- CreateIndex
CREATE INDEX "AvailabilityReservation_productId_tariffId_date_idx" ON "catalog"."AvailabilityReservation"("productId", "tariffId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityReservation_sourceSaleId_idx" ON "catalog"."AvailabilityReservation"("sourceSaleId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_retryable_attempts_idx" ON "events"."OutboxEvent"("status", "retryable", "attempts");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_checkoutIntentId_key" ON "sales"."Sale"("checkoutIntentId");

-- CreateIndex
CREATE INDEX "Sale_status_completedAt_idx" ON "sales"."Sale"("status", "completedAt");

