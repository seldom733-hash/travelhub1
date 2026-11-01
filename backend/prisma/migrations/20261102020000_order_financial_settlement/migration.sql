DO $$ BEGIN
  CREATE TYPE "order"."OrderFinancialStatus" AS ENUM (
    'OPEN',
    'PENDING_SETTLEMENT',
    'FINANCIALLY_SETTLED',
    'FINANCIALLY_SETTLED_WITH_PENALTY',
    'FINANCIALLY_SETTLED_FULL_REFUND',
    'FINANCIALLY_SETTLED_NO_CHARGES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "order"."Order"
  ADD COLUMN IF NOT EXISTS "financialStatus" "order"."OrderFinancialStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "financiallySettledAt" timestamp(3);

CREATE TABLE IF NOT EXISTS "finance"."OrderFinancialSettlement" (
  "id" text NOT NULL,
  "code" text NOT NULL,
  "orderId" text NOT NULL,
  "originalAmount" decimal(12,2) NOT NULL,
  "currency" text NOT NULL,
  "capturedAmount" decimal(12,2) NOT NULL,
  "refundedAmount" decimal(12,2) NOT NULL,
  "pendingRefundAmount" decimal(12,2) NOT NULL,
  "finalCustomerLiability" decimal(12,2) NOT NULL,
  "penaltyAmount" decimal(12,2) NOT NULL,
  "platformPenaltyShare" decimal(12,2) NOT NULL,
  "supplierPenaltyShare" decimal(12,2) NOT NULL,
  "annulledUnpaidAmount" decimal(12,2) NOT NULL,
  "remainingToPay" decimal(12,2) NOT NULL,
  "remainingToRefund" decimal(12,2) NOT NULL,
  "status" "order"."OrderFinancialStatus" NOT NULL,
  "reason" text NOT NULL,
  "confirmedAt" timestamp(3) NOT NULL,
  "confirmedById" text,
  "version" integer NOT NULL DEFAULT 1,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "OrderFinancialSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderFinancialSettlement_code_key" ON "finance"."OrderFinancialSettlement"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderFinancialSettlement_orderId_key" ON "finance"."OrderFinancialSettlement"("orderId");
CREATE INDEX IF NOT EXISTS "OrderFinancialSettlement_status_idx" ON "finance"."OrderFinancialSettlement"("status");

CREATE TABLE IF NOT EXISTS "finance"."OrderFinancialAdjustment" (
  "id" text NOT NULL,
  "code" text NOT NULL,
  "orderId" text NOT NULL,
  "settlementId" text NOT NULL,
  "type" text NOT NULL,
  "amount" decimal(12,2) NOT NULL,
  "currency" text NOT NULL,
  "reason" text NOT NULL,
  "actorId" text,
  "actorName" text,
  "occurredAt" timestamp(3) NOT NULL,
  "ledgerTransactionId" text,
  "idempotencyKey" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderFinancialAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderFinancialAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "finance"."OrderFinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderFinancialAdjustment_code_key" ON "finance"."OrderFinancialAdjustment"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderFinancialAdjustment_idempotencyKey_key" ON "finance"."OrderFinancialAdjustment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "OrderFinancialAdjustment_orderId_idx" ON "finance"."OrderFinancialAdjustment"("orderId");
CREATE INDEX IF NOT EXISTS "OrderFinancialAdjustment_settlementId_idx" ON "finance"."OrderFinancialAdjustment"("settlementId");
