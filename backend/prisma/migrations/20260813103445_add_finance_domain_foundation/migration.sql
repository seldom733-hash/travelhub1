-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateEnum
CREATE TYPE "finance"."PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "finance"."RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "finance"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "finance"."CommissionStatus" AS ENUM ('ACCRUED', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "finance"."CommissionAccrualStatus" AS ENUM ('ACCRUED', 'INVOICED', 'COLLECTED');

-- CreateTable
CREATE TABLE "finance"."Payment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "partnerId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "finance"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "providerRef" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."PaymentTerms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "prepaymentType" TEXT,
    "prepaymentValue" DECIMAL(12,2),
    "initialAmount" DECIMAL(12,2) NOT NULL,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Refund" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "finance"."RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Invoice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "finance"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Commission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "finance"."CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."CommissionAccrual" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "finance"."CommissionAccrualStatus" NOT NULL DEFAULT 'ACCRUED',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."ExchangeRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "baseCurrencyIso" TEXT NOT NULL,
    "quoteCurrencyIso" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Tax" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "countryIso" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "productType" TEXT,
    "countryIso" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "finance"."Payment"("code");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "finance"."Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "finance"."Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_partnerId_idx" ON "finance"."Payment"("partnerId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "finance"."Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTerms_code_key" ON "finance"."PaymentTerms"("code");

-- CreateIndex
CREATE INDEX "PaymentTerms_orderId_idx" ON "finance"."PaymentTerms"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_code_key" ON "finance"."Refund"("code");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "finance"."Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "finance"."Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "finance"."Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_code_key" ON "finance"."Invoice"("code");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "finance"."Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "finance"."Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "finance"."Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_code_key" ON "finance"."Commission"("code");

-- CreateIndex
CREATE INDEX "Commission_orderId_idx" ON "finance"."Commission"("orderId");

-- CreateIndex
CREATE INDEX "Commission_partnerId_idx" ON "finance"."Commission"("partnerId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "finance"."Commission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionAccrual_code_key" ON "finance"."CommissionAccrual"("code");

-- CreateIndex
CREATE INDEX "CommissionAccrual_partnerId_idx" ON "finance"."CommissionAccrual"("partnerId");

-- CreateIndex
CREATE INDEX "CommissionAccrual_status_idx" ON "finance"."CommissionAccrual"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "finance"."Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_isoCode_key" ON "finance"."Currency"("isoCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_code_key" ON "finance"."ExchangeRate"("code");

-- CreateIndex
CREATE INDEX "ExchangeRate_baseCurrencyIso_quoteCurrencyIso_idx" ON "finance"."ExchangeRate"("baseCurrencyIso", "quoteCurrencyIso");

-- CreateIndex
CREATE UNIQUE INDEX "Tax_code_key" ON "finance"."Tax"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "finance"."TaxRule"("code");

-- CreateIndex
CREATE INDEX "TaxRule_taxId_idx" ON "finance"."TaxRule"("taxId");

-- AddForeignKey
ALTER TABLE "finance"."TaxRule" ADD CONSTRAINT "TaxRule_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "finance"."Tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
