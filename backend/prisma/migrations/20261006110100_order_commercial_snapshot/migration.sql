-- Supplier Markup Phase 4 §4.6 — Request → Order commercial snapshot
-- propagation. JSON-колонка хранит verbatim-копию frozen
-- Request.commercialSnapshot на момент конверсии (Gate G: immutable;
-- позднейший MarkupRule change не пересчитывает принятые деньги).
-- Применяется только в порядке prisma migrate deploy (migrate dev
-- запрещён prompt'ом: в _prisma_migrations есть дрейф без папок).
ALTER TABLE "order"."Order" ADD COLUMN IF NOT EXISTS "commercialSnapshot" JSONB;
