WITH g AS (
  SELECT id,
         (attributes->>'startingPrice')::numeric AS base_usd,
         992.70::numeric AS air_addon
  FROM catalog."Product"
  WHERE attributes->>'supplierCode' = 'SUMMERTOUR'
    AND attributes->>'tourIncValue' = '238'
    AND attributes->>'currency' = 'USD'
    AND code IN ('PRD-00000003','PRD-00000004')
)
UPDATE catalog."Product" p
SET attributes = p.attributes || jsonb_build_object(
      'startingPrice', round((g.base_usd * 1.7055) + g.air_addon, 2),
      'currency', 'AZN',
      'flightAddon', jsonb_build_object('source','AZAL','amount',g.air_addon,'currency','AZN')
    ),
    "isGds" = true,
    "updatedAt" = now()
FROM g
WHERE p.id = g.id;

UPDATE catalog."Tariff" t
SET price = (p.attributes->>'startingPrice')::numeric,
    currency = 'AZN',
    "updatedAt" = now()
FROM catalog."Product" p
WHERE t."productId" = p.id
  AND p.code IN ('PRD-00000003','PRD-00000004');
