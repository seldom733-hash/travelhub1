WITH cmr AS (
  SELECT COALESCE(MAX(substring(code FROM 'CMR-([0-9]+)')::int), 0) AS max_value
  FROM finance."SupplierCommissionRule"
), mkr AS (
  SELECT COALESCE(MAX(substring(code FROM 'MKR-([0-9]+)')::int), 0) AS max_value
  FROM finance."MarkupRule"
), vals AS (
  SELECT 'CMR' AS prefix, max_value FROM cmr
  UNION ALL
  SELECT 'MKR', max_value FROM mkr
)
INSERT INTO events."BusinessSequence" (prefix, value)
SELECT prefix, max_value FROM vals WHERE max_value > 0
ON CONFLICT (prefix) DO UPDATE
SET value = GREATEST(events."BusinessSequence".value, EXCLUDED.value);
