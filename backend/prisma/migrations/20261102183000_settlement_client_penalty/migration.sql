ALTER TABLE "finance"."OrderFinancialSettlement"
  ADD COLUMN "clientPenaltyAmount" decimal(12,2) NOT NULL DEFAULT 0;

UPDATE "finance"."OrderFinancialSettlement"
SET "clientPenaltyAmount" = GREATEST("penaltyAmount" - "supplierPenaltyShare", 0);
