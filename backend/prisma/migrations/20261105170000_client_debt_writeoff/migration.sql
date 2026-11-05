CREATE TABLE "finance"."ClientDebtWriteOff" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "reason" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientDebtWriteOff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientDebtWriteOff_code_key" ON "finance"."ClientDebtWriteOff"("code");
CREATE INDEX "ClientDebtWriteOff_orderId_idx" ON "finance"."ClientDebtWriteOff"("orderId");
