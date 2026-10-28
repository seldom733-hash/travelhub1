-- Additive: discovered countries for supplier catalog capabilities.
CREATE TABLE "catalog"."SupplierCatalogCountry" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "countryLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCatalogCountry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCatalogCountry_supplierCode_serviceType_countryKey_key"
    ON "catalog"."SupplierCatalogCountry"("supplierCode", "serviceType", "countryKey");

CREATE INDEX "SupplierCatalogCountry_supplierCode_serviceType_idx"
    ON "catalog"."SupplierCatalogCountry"("supplierCode", "serviceType");
