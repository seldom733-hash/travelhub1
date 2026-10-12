-- Единый формат заголовка тура «HotelName (Country)» для всех поставщиков.
--   KOMPAS:     attributes.hotelName + attributes.country (из stateKey).
--   Summertour: attributes.hotel    + attributes.country ('Turkey').
-- tourIncName (generic-дескриптор) в title НЕ попадает.
--
-- Идемпотентно: обновляет только если вычисленный title отличается от текущего
-- (повторный запуск — no-op). city в скобках hotelName остаётся как есть
-- (честное enrichment города — отдельная задача).
--
-- Запуск: psql -U postgres -d travelhub -f unified-title-fix.sql

UPDATE catalog."Product" p
SET title = COALESCE(p.attributes->>'hotelName', p.attributes->>'hotel')
            || ' (' || (p.attributes->>'country') || ')'
WHERE (p."supplierRef" LIKE 'KOMPAS-%' OR p."supplierRef" LIKE 'SUMMERTOUR-%')
  AND p.attributes->>'country' IS NOT NULL
  AND p.title IS DISTINCT FROM (
        COALESCE(p.attributes->>'hotelName', p.attributes->>'hotel')
        || ' (' || (p.attributes->>'country') || ')');
