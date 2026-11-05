ALTER TABLE "finance"."OrderFinancialSettlement"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "supplierPenaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "cancellationResult" DECIMAL(12,2) NOT NULL DEFAULT 0;
