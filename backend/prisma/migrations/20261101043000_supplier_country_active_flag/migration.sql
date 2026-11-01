-- Country refresh is authoritative: a country absent from the supplier's live
-- dictionary is kept as an inactive tombstone instead of disappearing silently.
ALTER TABLE catalog."SupplierCatalogCountry"
ADD COLUMN "isActive" boolean NOT NULL DEFAULT true;
