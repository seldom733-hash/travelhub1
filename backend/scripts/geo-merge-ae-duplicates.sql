-- Merge duplicate Master Geography rows for the UAE (AE).
--
-- The geo ingests match supplier towns by normalized label, and KOMPAS
-- labels are Latin while ANEX labels are Cyrillic; transliterations that do
-- not line up («Шарджа» → shardzha vs «Sharjah», «Саадият» vs «Saadiyat
-- Island») created a parallel row per language. Each row then kept only the
-- links of one supplier, so picking the "wrong" synonym silently excluded
-- the other supplier from resolve — e.g. Saadiyat Island: KOMPAS=100 hotels
-- under «Саадият», while «Садият Айленд» resolved ANEX only (=0 offers).
--
-- Strategy: keep the Cyrillic row (it holds the resorts and reads better in
-- RU), repoint every link of the Latin twin onto it, retire the twin.
-- Idempotent: re-running finds no links on retired codes and does nothing.
--
-- Usage: PGPASSWORD=... psql -U postgres -d travelhub -v ON_ERROR_STOP=1 -f geo-merge-ae-duplicates.sql

BEGIN;

-- ── Cities (5 pairs) ────────────────────────────────────────────────────
UPDATE geo."SupplierGeoLink" SET "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-SHARDZHA')
  WHERE "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-SHARJAH');
UPDATE geo."SupplierGeoLink" SET "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-ADZHMAN')
  WHERE "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-AJMAN');
UPDATE geo."SupplierGeoLink" SET "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-FUDZHEYRA')
  WHERE "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-FUJAIRAH');
UPDATE geo."SupplierGeoLink" SET "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-RAS AL HAYMA')
  WHERE "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-RAS AL KHAIMAH');
UPDATE geo."SupplierGeoLink" SET "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-UMM AL KUVEYN')
  WHERE "geoCityId" = (SELECT id FROM geo."GeoCity" WHERE code = 'AE-UMM AL QUWAIN');

UPDATE geo."GeoCity" SET status = 'INACTIVE', "updatedAt" = NOW(), "updatedBy" = 'geo-merge-ae'
  WHERE code IN ('AE-SHARJAH', 'AE-AJMAN', 'AE-FUJAIRAH', 'AE-RAS AL KHAIMAH', 'AE-UMM AL QUWAIN');

-- ── Resorts under Абу-Даби (3 pairs) ────────────────────────────────────
UPDATE geo."SupplierGeoLink" SET "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'AE-SADIYAT AYLEND')
  WHERE "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'SAADIYAT');
UPDATE geo."SupplierGeoLink" SET "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'AE-YAS AYLEND')
  WHERE "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'YAS');
UPDATE geo."SupplierGeoLink" SET "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'AE-AL AYN')
  WHERE "geoResortId" = (SELECT id FROM geo."GeoResort" WHERE code = 'AE-AL AIN');

UPDATE geo."GeoResort" SET status = 'INACTIVE', "updatedAt" = NOW(), "updatedBy" = 'geo-merge-ae'
  WHERE code IN ('SAADIYAT', 'YAS', 'AE-AL AIN');

COMMIT;

-- ── Post-merge expectations ─────────────────────────────────────────────
-- Cities: each pair collapsed to one ACTIVE row holding both suppliers' links.
SELECT code, names->>'ru' AS ru, status,
  (SELECT COUNT(*) FROM geo."SupplierGeoLink" l WHERE l."geoCityId" = c.id) AS city_links,
  (SELECT COUNT(*) FROM geo."GeoResort" r WHERE r."cityId" = c.id AND r.status = 'ACTIVE') AS resorts
FROM geo."GeoCity" c
JOIN geo."GeoCountry" g ON g.id = c."countryId"
WHERE g.code = 'AE' AND c.status = 'ACTIVE'
  AND c.code IN ('AE-SHARDZHA','AE-ADZHMAN','AE-FUDZHEYRA','AE-RAS AL HAYMA','AE-UMM AL KUVEYN',
                 'AE-SHARJAH','AE-AJMAN','AE-FUJAIRAH','AE-RAS AL KHAIMAH','AE-UMM AL QUWAIN')
ORDER BY c.code;

SELECT r.code, r.names->>'ru' AS ru, r.status,
  (SELECT COUNT(*) FROM geo."SupplierGeoLink" l WHERE l."geoResortId" = r.id) AS resort_links
FROM geo."GeoResort" r
WHERE r.code IN ('AE-SADIYAT AYLEND','AE-YAS AYLEND','AE-AL AYN','SAADIYAT','YAS','AE-AL AIN')
ORDER BY r.code;
