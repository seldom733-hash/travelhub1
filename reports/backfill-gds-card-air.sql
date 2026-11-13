WITH g AS (
  SELECT id,
         attributes->>'tourIncValue' AS program,
         (attributes->>'startingPrice')::numeric AS base_usd,
         CASE attributes->>'tourIncValue'
           WHEN '256' THEN 1370.08
           WHEN '238' THEN 992.70
         END AS air_addon
  FROM catalog."Product"
  WHERE attributes->>'supplierCode' = 'SUMMERTOUR'
    AND attributes->>'tourIncValue' IN ('256','238')
    AND attributes->>'currency' = 'USD'
    AND "isGds" = true
)
UPDATE catalog."Product" p
SET attributes = p.attributes || jsonb_build_object(
      'startingPrice', round((g.base_usd * 1.7055) + g.air_addon, 2),
      'currency', 'AZN',
      'flightAddon', jsonb_build_object('source','AZAL','amount',g.air_addon,'currency','AZN')
    ),
    "updatedAt" = now()
FROM g
WHERE p.id = g.id;

UPDATE catalog."Tariff" t
SET price = (p.attributes->>'startingPrice')::numeric,
    currency = 'AZN',
    "updatedAt" = now()
FROM catalog."Product" p
WHERE t."productId" = p.id
  AND p.attributes->>'supplierCode' = 'SUMMERTOUR'
  AND p.attributes->>'tourIncValue' IN ('256','238')
  AND p.attributes->>'currency' = 'AZN'
  AND p.attributes ? 'flightAddon';

SELECT count(*) FILTER (WHERE "isGds") AS gds_cards,
       count(*) FILTER (WHERE "attributes" ? 'flightAddon') AS with_air,
       min("updatedAt") AS min_update
FROM catalog."Product"
WHERE attributes->>'supplierCode' = 'SUMMERTOUR';
