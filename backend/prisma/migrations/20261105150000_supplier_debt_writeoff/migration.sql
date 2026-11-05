CREATE TABLE "finance"."SupplierDebtWriteOff" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "reason" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierDebtWriteOff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierDebtWriteOff_code_key" ON "finance"."SupplierDebtWriteOff"("code");
CREATE INDEX "SupplierDebtWriteOff_orderId_idx" ON "finance"."SupplierDebtWriteOff"("orderId");
