CREATE TABLE "finance"."OrderCancellationSupplierTerm" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "supplierCode" TEXT,
  "supplierName" TEXT,
  "serviceTitle" TEXT,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "supplierPenalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "supplierRefundAgreed" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "supplierRefundActual" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "clientRefundAgreed" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "clientRefundActual" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderCancellationSupplierTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderCancellationSupplierTerm_orderId_supplierCode_serviceTitle_key"
  ON "finance"."OrderCancellationSupplierTerm"("orderId", "supplierCode", "serviceTitle");
CREATE INDEX "OrderCancellationSupplierTerm_orderId_idx" ON "finance"."OrderCancellationSupplierTerm"("orderId");
