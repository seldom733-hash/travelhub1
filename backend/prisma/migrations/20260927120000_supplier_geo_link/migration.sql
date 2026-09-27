-- SupplierGeoLink: provider-agnostic supplier geo mapping for Master Geography.
--
-- Purpose: each supplier (KOMPAS, SUMMERTOUR, future ones) exposes its own
-- internal geo/tour identifiers (e.g. SAMO TOURINC=3706 "AE: Дубай из Баку").
-- These IDs live in ONE shared link table — adding a new supplier requires
-- ZERO schema changes: new rows with a new supplierCode only.
--
-- Discovery: per-supplier adapter implements discoverGeoOptions(countryStateId)
-- returning raw { externalId, label }[]; a normalization step matches labels
-- to Master Geography (GeoCity) and inserts missing cities/resorts, then links.
--
-- kind dimension: 'TOUR' (KOMPAS TOURINC), 'TOWN' (SAMO TOWNS), 'HOTEL', etc.

CREATE TABLE "geo"."SupplierGeoLink" (
    "id"            TEXT NOT NULL,
    "supplierCode"  TEXT NOT NULL,
    "kind"          TEXT NOT NULL,
    "externalId"    TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "geoCountryId"  TEXT,
    "geoCityId"     TEXT,
    "geoResortId"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierGeoLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierGeoLink_supplier_kind_ext_key"
  ON "geo"."SupplierGeoLink"("supplierCode", "kind", "externalId");
CREATE INDEX "SupplierGeoLink_geoCityId_idx"   ON "geo"."SupplierGeoLink"("geoCityId");
CREATE INDEX "SupplierGeoLink_geoCountryId_idx" ON "geo"."SupplierGeoLink"("geoCountryId");
CREATE INDEX "SupplierGeoLink_supplierCode_idx" ON "geo"."SupplierGeoLink"("supplierCode");

ALTER TABLE "geo"."SupplierGeoLink"
  ADD CONSTRAINT "SupplierGeoLink_geoCountryId_fkey"
  FOREIGN KEY ("geoCountryId") REFERENCES "geo"."GeoCountry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "geo"."SupplierGeoLink"
  ADD CONSTRAINT "SupplierGeoLink_geoCityId_fkey"
  FOREIGN KEY ("geoCityId") REFERENCES "geo"."GeoCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "geo"."SupplierGeoLink"
  ADD CONSTRAINT "SupplierGeoLink_geoResortId_fkey"
  FOREIGN KEY ("geoResortId") REFERENCES "geo"."GeoResort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
