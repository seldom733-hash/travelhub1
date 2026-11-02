CREATE TABLE "finance"."SupplierCommissionRule" (
  "id" text NOT NULL,
  "code" text NOT NULL,
  "supplierCode" text NOT NULL,
  "serviceType" text NOT NULL,
  "commissionType" text NOT NULL DEFAULT 'PERCENT',
  "rate" decimal(18,6),
  "fixedAmount" decimal(18,2),
  "fixedCurrency" text,
  "calculationBase" text NOT NULL DEFAULT 'SUPPLIER_BASE',
  "status" "finance"."MarkupRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "version" integer NOT NULL DEFAULT 1,
  "effectiveFrom" timestamp(3) NOT NULL,
  "effectiveTo" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "SupplierCommissionRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierCommissionRule_code_key" ON "finance"."SupplierCommissionRule"("code");
CREATE INDEX "SupplierCommissionRule_supplierCode_serviceType_status_idx" ON "finance"."SupplierCommissionRule"("supplierCode", "serviceType", "status");
CREATE INDEX "SupplierCommissionRule_effectiveFrom_idx" ON "finance"."SupplierCommissionRule"("effectiveFrom");

CREATE TABLE "finance"."SupplierCommissionRuleHistory" (
  "id" text NOT NULL,
  "ruleId" text NOT NULL,
  "action" text NOT NULL,
  "version" integer NOT NULL,
  "fields" jsonb,
  "actorId" text,
  "actorName" text,
  "comment" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCommissionRuleHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCommissionRuleHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "finance"."SupplierCommissionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupplierCommissionRuleHistory_ruleId_idx" ON "finance"."SupplierCommissionRuleHistory"("ruleId");
