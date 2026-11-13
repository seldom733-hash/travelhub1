-- Structured multi-service request composition for the "Create request" workspace.
ALTER TABLE "order"."Request"
  ADD COLUMN "requestType" TEXT,
  ADD COLUMN "primarySupplierCode" TEXT;

CREATE TABLE "order"."RequestService" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "serviceType" TEXT NOT NULL,
  "supplierCode" TEXT,
  "supplierName" TEXT,
  "title" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestService_requestId_idx" ON "order"."RequestService"("requestId");
CREATE INDEX "RequestService_supplierCode_idx" ON "order"."RequestService"("supplierCode");

ALTER TABLE "order"."RequestService"
  ADD CONSTRAINT "RequestService_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "order"."Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
