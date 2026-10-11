-- Unified supplier/partner code scheme — PRN-* (Owner Decision).
--
-- Ранее сосуществовали ТРИ формата кодов Partner: PAR-00000001 (канонический
-- IdsService "PAR"), PAR-KAZUNION / KOMPAS-001 (хардкоды в синках), PRN-00000001
-- (demo-seed). Приводим к ЕДИНОЙ схеме PRN-* (перfix "PRN", 8 цифр), Partner —
-- родительская таблица поставщиков, от которой наследуют FX-курсы и карточки.
--
-- Изменения БЕЗОПАСНЫ для ссылок: почти все lookup'ы Partner идут по id (uuid),
-- code — business/display идентификатор. SupplierFxRate.supplierCode хранит API-
-- токен адаптера (KAZUNION/KOMPAS/SUMMERTOUR) — отдельный неймспейс, НЕ трогаем.
--
-- Идемпотентная: повторное применение не меняет уже-unified коды.

-- 1. Seed/raise счётчик "PRN" как минимум до максимального существующего PRN-
--    суффикса, чтобы nextCode("PRN") не коллидировал с уже выданными кодами
--    (demo-seed пишет PRN-00000001..N напрямую, минуя BusinessSequence).
INSERT INTO "events"."BusinessSequence" ("prefix", "value")
SELECT 'PRN', COALESCE((
    SELECT MAX(
        CASE WHEN "code" ~ '^PRN-[0-9]+$'
             THEN substring("code", 5)::int
             ELSE 0 END
    )
    FROM "crm"."Partner"
), 0)
ON CONFLICT ("prefix") DO UPDATE
SET "value" = GREATEST("events"."BusinessSequence"."value", EXCLUDED."value");

-- 2. Backfill: перекодировать НЕ-unified Partner'ов (PAR-*, PAR-KAZUNION,
--    KOMPAS-*, ...) в последовательные PRN-*, начиная сразу за максимальным
--    существующим PRN-кодом (base.start). Уже-unified (PRN-########) — не трогаем.
WITH base AS (
    SELECT COALESCE((SELECT "value" FROM "events"."BusinessSequence" WHERE "prefix" = 'PRN'), 0) AS start
),
ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (ORDER BY "id" ASC) AS rn
    FROM "crm"."Partner"
    WHERE "code" !~ '^PRN-[0-9]{8}$'
)
UPDATE "crm"."Partner" p
SET "code" = 'PRN-' || LPAD((base.start + ranked.rn)::text, 8, '0')
FROM ranked, base
WHERE p."id" = ranked."id";

-- 3. Поднять счётчик до итогового максимума (существующие PRN + перекодированные),
--    чтобы следующий nextCode("PRN") продолжил последовательность без коллизий.
INSERT INTO "events"."BusinessSequence" ("prefix", "value")
SELECT 'PRN', COALESCE((
    SELECT MAX(
        CASE WHEN "code" ~ '^PRN-[0-9]+$'
             THEN substring("code", 5)::int
             ELSE 0 END
    )
    FROM "crm"."Partner"
), 0)
ON CONFLICT ("prefix") DO UPDATE
SET "value" = GREATEST("events"."BusinessSequence"."value", EXCLUDED."value");
