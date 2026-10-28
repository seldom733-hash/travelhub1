-- Supplier catalog sync: durable identity, preview/apply runs and per-card report.
-- Additive only. Existing Product.supplierRef values are not rewritten.

CREATE TABLE "catalog"."SupplierCatalogIdentity" (
  "id" TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "externalKey" TEXT NOT NULL,
  "countryCode" TEXT,
  "stateCode" TEXT,
  "productId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "archivedByRunId" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCatalogIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCatalogIdentity_supplierCode_serviceType_externalKey_key"
  ON "catalog"."SupplierCatalogIdentity" ("supplierCode", "serviceType", "externalKey");
CREATE INDEX "SupplierCatalogIdentity_productId_idx"
  ON "catalog"."SupplierCatalogIdentity" ("productId");
CREATE INDEX "SupplierCatalogIdentity_supplierCode_serviceType_status_idx"
  ON "catalog"."SupplierCatalogIdentity" ("supplierCode", "serviceType", "status");
CREATE INDEX "SupplierCatalogIdentity_countryCode_idx"
  ON "catalog"."SupplierCatalogIdentity" ("countryCode");

CREATE TABLE "catalog"."SupplierCatalogRun" (
  "id" TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "countryCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PREVIEWING',
  "coverage" TEXT NOT NULL DEFAULT 'PARTIAL',
  "scope" JSONB,
  "counts" JSONB,
  "errors" JSONB,
  "activeKey" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCatalogRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCatalogRun_activeKey_key"
  ON "catalog"."SupplierCatalogRun" ("activeKey");
CREATE INDEX "SupplierCatalogRun_supplierCode_serviceType_countryCode_createdAt_idx"
  ON "catalog"."SupplierCatalogRun" ("supplierCode", "serviceType", "countryCode", "createdAt");
CREATE INDEX "SupplierCatalogRun_status_idx"
  ON "catalog"."SupplierCatalogRun" ("status");

CREATE TABLE "catalog"."SupplierCatalogRunItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "productId" TEXT,
  "supplierRef" TEXT,
  "externalKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "error" TEXT,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCatalogRunItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCatalogRunItem_runId_fkey" FOREIGN KEY ("runId")
    REFERENCES "catalog"."SupplierCatalogRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SupplierCatalogRunItem_runId_action_idx"
  ON "catalog"."SupplierCatalogRunItem" ("runId", "action");
CREATE INDEX "SupplierCatalogRunItem_productId_idx"
  ON "catalog"."SupplierCatalogRunItem" ("productId");
