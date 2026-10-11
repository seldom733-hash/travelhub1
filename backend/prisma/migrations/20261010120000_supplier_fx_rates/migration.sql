-- TRAVELHUB_UNIFIED_FINANCE_CENTER Phase 1 — supplier-specific FX rates.
--
-- Единая валюта управления/отображения — AZN (Confirmed decision). Каждый
-- поставщик может иметь СВОЙ курс «1 sourceCurrency = N AZN» (пара
-- supplier × sourceCurrency, target = AZN). Хранилище расширяемо: колонка
-- targetCurrencyIso есть, но V1 API принимает только AZN.
--
-- AZN→AZN всегда 1 — строка НЕ создаётся (resolver возвращает identity без
-- lookup). Отсутствие строки = нет курса → контролируемая ошибка, НИКОГДА не
-- подставлять 1 или чужой курс (никогда silent-substitute).
--
-- Изменение курса влияет ТОЛЬКО на будущие расчёты: замороженные snapshot'ы
-- (Request/Order commercialSnapshot.fx) не переписываются — история курсов
-- append-only (SupplierFxRateHistory), текущий курс — upsert-in-place на
-- unique (supplierCode, sourceCurrencyIso, targetCurrencyIso).
--
-- Decimal(18,6): rate > 0, ≤ 6 знаков (validateRate контракт); amount-конверсия
-- — toMoney2 (DECIMAL(12,2), half-up 2dp, sales.money platform contract).
--
-- Idempotent: safe to re-apply (IF NOT EXISTS).

-- 1. Текущий курс поставщика (SFX-*).
CREATE TABLE IF NOT EXISTS "finance"."SupplierFxRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "sourceCurrencyIso" TEXT NOT NULL,
    "targetCurrencyIso" TEXT NOT NULL DEFAULT 'AZN',
    "rate" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "SupplierFxRate_pkey" PRIMARY KEY ("id")
);

-- 2. Append-only история: old/new value, timestamp, admin identity.
CREATE TABLE IF NOT EXISTS "finance"."SupplierFxRateHistory" (
    "id" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldRate" DECIMAL(18,6),
    "newRate" DECIMAL(18,6) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,

    CONSTRAINT "SupplierFxRateHistory_pkey" PRIMARY KEY ("id")
);

-- 3. Constraints / indexes (совпадают с @@unique / @@index в schema.prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierFxRate_code_key"
    ON "finance"."SupplierFxRate"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierFxRate_supplierCode_sourceCurrencyIso_targetCurrencyIso_key"
    ON "finance"."SupplierFxRate"("supplierCode", "sourceCurrencyIso", "targetCurrencyIso");

CREATE INDEX IF NOT EXISTS "SupplierFxRate_supplierCode_idx"
    ON "finance"."SupplierFxRate"("supplierCode");

CREATE INDEX IF NOT EXISTS "SupplierFxRateHistory_rateId_changedAt_idx"
    ON "finance"."SupplierFxRateHistory"("rateId", "changedAt");

-- 4. FK: history → current rate (CASCADE при удалении current rate; сама
--    история append-only, удаление current — редкий admin-акт).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SupplierFxRateHistory_rateId_fkey'
    ) THEN
        ALTER TABLE "finance"."SupplierFxRateHistory"
            ADD CONSTRAINT "SupplierFxRateHistory_rateId_fkey"
            FOREIGN KEY ("rateId") REFERENCES "finance"."SupplierFxRate"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Permission catalog: finance.fx_rate.read / finance.fx_rate.manage.
--    Источник истины: permissions.constants.ts (PERMISSIONS, ROLE_PERMISSIONS)
--    + PERMISSION_DESCRIPTIONS (security.service.ts). Гранты:
--      finance.fx_rate.read    → FINANCE, DIRECTOR, ANALYST (+ ADMIN по ALL)
--      finance.fx_rate.manage  → FINANCE (+ ADMIN по ALL)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'finance.fx_rate.read', 'Чтение курсов поставщиков к AZN (SupplierFxRate)'),
  (gen_random_uuid(), 'finance.fx_rate.manage', 'Управление курсами поставщиков к AZN (SupplierFxRate)')
ON CONFLICT ("code") DO NOTHING;

-- 6. Дефолтные гранты ролей.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('FINANCE',  'finance.fx_rate.read'),
  ('DIRECTOR', 'finance.fx_rate.read'),
  ('ANALYST',  'finance.fx_rate.read'),
  ('FINANCE',  'finance.fx_rate.manage')
) AS g("roleCode", "permissionCode")
JOIN "security"."Role" r ON r."code"::text = g."roleCode"
JOIN "security"."Permission" p ON p."code" = g."permissionCode"
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."RolePermission" rp
  WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
);

-- 7. ADMIN gets ALL_PERMISSIONS (idempotent add-missing).
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
