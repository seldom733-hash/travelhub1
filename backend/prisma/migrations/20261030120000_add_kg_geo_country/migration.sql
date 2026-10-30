-- Kyrgyzstan was present in supplier catalogs (KZ/KG offers) but missing from
-- Master Geography, so its published products had geoCountryId = NULL and
-- /destinations never listed it. Keep this seed idempotent.
INSERT INTO geo."GeoCountry" ("id", "code", "names", "status", "createdAt", "updatedAt")
VALUES (
  '7d7f0b7b-2f6f-4f4a-9f6c-6d4e8a9c1b2d',
  'KG',
  jsonb_build_object(
    'ru', 'Кыргызстан',
    'az', 'Qırğızıstan',
    'en', 'Kyrgyzstan'
  ),
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE
SET "names" = EXCLUDED."names",
    "status" = 'ACTIVE',
    "updatedAt" = NOW();

UPDATE catalog."Product" p
SET "geoCountryId" = gc.id
FROM geo."GeoCountry" gc
WHERE gc.code = 'KG'
  AND p."attributes"->>'countryCode' = 'KG'
  AND p."geoCountryId" IS NULL;
