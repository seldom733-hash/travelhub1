-- CreateEnum
CREATE TYPE "sales"."PaymentScheme" AS ENUM ('FULL_PREPAYMENT', 'PARTIAL_PREPAYMENT', 'DEPOSIT', 'PAY_LATER', 'PAY_AT_SERVICE');

-- CreateEnum
CREATE TYPE "sales"."PaymentPrepaymentType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "sales"."CheckoutIntent" ADD COLUMN     "initialAmount" DECIMAL(12,2),
ADD COLUMN     "paymentScheme" "sales"."PaymentScheme",
ADD COLUMN     "prepaymentType" "sales"."PaymentPrepaymentType",
ADD COLUMN     "prepaymentValue" DECIMAL(12,2),
ADD COLUMN     "remainingAmount" DECIMAL(12,2);
