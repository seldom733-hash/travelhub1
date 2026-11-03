ALTER TABLE "finance"."SupplierObligation" ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "finance"."SupplierObligation" ADD COLUMN "commerceSequence" TEXT;
ALTER TABLE "finance"."SupplierObligation" ADD COLUMN "dealOrdinal" INTEGER;
CREATE UNIQUE INDEX "SupplierObligation_referenceNumber_key" ON "finance"."SupplierObligation"("referenceNumber");
CREATE UNIQUE INDEX "SupplierObligation_commerceSequence_dealOrdinal_key" ON "finance"."SupplierObligation"("commerceSequence", "dealOrdinal");
