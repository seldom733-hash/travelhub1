CREATE TABLE "catalog"."AirlineClass" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "names" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "AirlineClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AirlineClass_code_key" ON "catalog"."AirlineClass"("code");
CREATE INDEX "AirlineClass_status_idx" ON "catalog"."AirlineClass"("status");
CREATE INDEX "AirlineClass_sortOrder_idx" ON "catalog"."AirlineClass"("sortOrder");

CREATE TABLE "catalog"."BaggageAllowance" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "names" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "BaggageAllowance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BaggageAllowance_code_key" ON "catalog"."BaggageAllowance"("code");
CREATE INDEX "BaggageAllowance_status_idx" ON "catalog"."BaggageAllowance"("status");
CREATE INDEX "BaggageAllowance_sortOrder_idx" ON "catalog"."BaggageAllowance"("sortOrder");
