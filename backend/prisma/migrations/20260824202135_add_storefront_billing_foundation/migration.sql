-- CreateEnum
CREATE TYPE "catalog"."BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "catalog"."SubscriptionInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "catalog"."SubscriptionPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "catalog"."StorefrontSubscriptionStatus" ADD VALUE 'TRIAL';

-- CreateTable
CREATE TABLE "catalog"."SubscriptionContract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "contractedUnitAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "billingInterval" "catalog"."BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "contractedTotalAmount" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "catalog"."SubscriptionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "catalog"."SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionContract_code_key" ON "catalog"."SubscriptionContract"("code");

-- CreateIndex
CREATE INDEX "SubscriptionContract_subscriptionId_idx" ON "catalog"."SubscriptionContract"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionContract_isActive_idx" ON "catalog"."SubscriptionContract"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_code_key" ON "catalog"."SubscriptionInvoice"("code");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON "catalog"."SubscriptionInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_idx" ON "catalog"."SubscriptionInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_contractId_periodStart_key" ON "catalog"."SubscriptionInvoice"("contractId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_code_key" ON "catalog"."SubscriptionPayment"("code");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_invoiceId_idx" ON "catalog"."SubscriptionPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "catalog"."SubscriptionPayment"("status");

-- AddForeignKey
ALTER TABLE "catalog"."SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "catalog"."StorefrontSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_planId_fkey" FOREIGN KEY ("planId") REFERENCES "catalog"."StorefrontSubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "catalog"."SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "catalog"."StorefrontSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "catalog"."SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
