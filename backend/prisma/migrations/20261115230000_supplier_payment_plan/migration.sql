-- Per-booking supplier payment plan (Finance).
CREATE TABLE IF NOT EXISTS "finance"."SupplierPaymentPlan" (
  "id" text PRIMARY KEY,
  "obligationId" text NOT NULL UNIQUE,
  "mode" text NOT NULL,
  "createdById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  CONSTRAINT "SupplierPaymentPlan_obligationId_fkey"
    FOREIGN KEY ("obligationId") REFERENCES "finance"."SupplierObligation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "finance"."SupplierPaymentInstallment" (
  "id" text PRIMARY KEY,
  "planId" text NOT NULL,
  "kind" text NOT NULL,
  "dueDate" timestamp(3) NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "status" text NOT NULL DEFAULT 'PLANNED',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  CONSTRAINT "SupplierPaymentInstallment_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "finance"."SupplierPaymentPlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SupplierPaymentInstallment_planId_idx"
  ON "finance"."SupplierPaymentInstallment"("planId");
CREATE INDEX IF NOT EXISTS "SupplierPaymentInstallment_dueDate_idx"
  ON "finance"."SupplierPaymentInstallment"("dueDate");
CREATE INDEX IF NOT EXISTS "SupplierPaymentInstallment_status_idx"
  ON "finance"."SupplierPaymentInstallment"("status");
