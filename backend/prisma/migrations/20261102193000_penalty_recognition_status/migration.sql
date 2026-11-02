ALTER TABLE "finance"."OrderFinancialSettlement"
  ADD COLUMN "clientPenaltyStatus" text NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "supplierPenaltyStatus" text NOT NULL DEFAULT 'CONFIRMED';
