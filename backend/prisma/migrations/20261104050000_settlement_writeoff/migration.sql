ALTER TABLE "finance"."OrderFinancialSettlement"
  ADD COLUMN "writeOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "writeOffReason" TEXT,
  ADD COLUMN "writeOffAt" TIMESTAMP(3),
  ADD COLUMN "writeOffById" TEXT;
