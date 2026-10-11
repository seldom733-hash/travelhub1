-- TRAVELHUB_UNIFIED_FINANCE_CENTER Phase 2 — supplier obligations + payouts.
--
-- SupplierObligation: сумма, которую платформа ДОЛЖНА поставщику за
-- подтверждённую услугу. Создаётся идемпотентно на событии BookingConfirmed
-- (_supplier-obligation.consumer). Замороженный денежный факт:
--   sourceAmount/sourceCurrency — исходная валюта поставщика;
--   aznAmount/fxRate/fxRateCode — AZN management-эквивалент + применённый
--     курс (снапшот; изменение текущего курса НЕ переписывает obligation).
-- UNKNOWN (нет commercialSnapshot/курса) хранится как NULL, НИКОГДА как 0;
-- payout в таком состоянии заблокирован (blocked, never zero).
--
-- SupplierPayout: ФАКТ исходящего платежа (деньги реально ушли). Повторяет
-- append-only/провенанс конвенции Payout, но добавляет partial-payment
-- cardinality (НЕСКОЛЬКО payout на obligation) + providerRef-idempotency,
-- несовместимые с @@unique([sourceType, sourceId]) существующего Payout.
-- Фактическое движение amount/currency хранится ОТДЕЛЬНО от aznAmount —
-- FX variance фиксируется, замороженный obligation НЕ переписывается.
--
-- Decimal(18,2) для сумм (sales.money half-up 2dp), Decimal(18,6) для курсов.
-- Idempotent: safe to re-apply (IF NOT EXISTS / DO blocks).

-- 1. Обязательство поставщика (SBO-*).
CREATE TABLE IF NOT EXISTS "finance"."SupplierObligation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingCode" TEXT,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT,
    "orderItemId" TEXT,
    "supplierCode" TEXT,
    "partnerId" TEXT,
    "serviceType" TEXT,
    "sourceAmount" DECIMAL(18,2) NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "aznAmount" DECIMAL(18,2),
    "fxRate" DECIMAL(18,6),
    "fxRateCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(18,2),
    "source" TEXT NOT NULL DEFAULT 'BOOKING_CONFIRMED',
    "sourceEventId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierObligation_pkey" PRIMARY KEY ("id")
);

-- 2. Факт исходящего платежа (SPO-*).
CREATE TABLE IF NOT EXISTS "finance"."SupplierPayout" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "aznAmount" DECIMAL(18,2) NOT NULL,
    "fxRate" DECIMAL(18,6),
    "fxVariance" DECIMAL(18,2),
    "method" TEXT,
    "providerRef" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "evidenceUrl" TEXT,
    "correlationId" TEXT,
    "causationId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayout_pkey" PRIMARY KEY ("id")
);

-- 3. Constraints / indexes (совпадают с schema.prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierObligation_code_key"
    ON "finance"."SupplierObligation"("code");

-- Идемпотентность создания: одна obligation на booking (= item/service).
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierObligation_bookingId_key"
    ON "finance"."SupplierObligation"("bookingId");

CREATE INDEX IF NOT EXISTS "SupplierObligation_orderId_idx"
    ON "finance"."SupplierObligation"("orderId");
CREATE INDEX IF NOT EXISTS "SupplierObligation_status_idx"
    ON "finance"."SupplierObligation"("status");
CREATE INDEX IF NOT EXISTS "SupplierObligation_supplierCode_idx"
    ON "finance"."SupplierObligation"("supplierCode");
CREATE INDEX IF NOT EXISTS "SupplierObligation_partnerId_idx"
    ON "finance"."SupplierObligation"("partnerId");

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayout_code_key"
    ON "finance"."SupplierPayout"("code");

-- Idempotency replay: один payout на providerRef (null допускается).
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayout_providerRef_key"
    ON "finance"."SupplierPayout"("providerRef");

CREATE INDEX IF NOT EXISTS "SupplierPayout_obligationId_idx"
    ON "finance"."SupplierPayout"("obligationId");

-- 4. FK: payout → obligation (RESTRICT: financial fact не каскадится).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SupplierPayout_obligationId_fkey'
    ) THEN
        ALTER TABLE "finance"."SupplierPayout"
            ADD CONSTRAINT "SupplierPayout_obligationId_fkey"
            FOREIGN KEY ("obligationId") REFERENCES "finance"."SupplierObligation"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Permission catalog: finance.obligation.read/manage,
--    finance.supplier_payout.read/manage (read/write разделены).
--    Источник истины: permissions.constants.ts + PERMISSION_DESCRIPTIONS.
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'finance.obligation.read', 'Чтение обязательств поставщиков (SupplierObligation)'),
  (gen_random_uuid(), 'finance.obligation.manage', 'Управление обязательствами поставщиков (cancel/adjust)'),
  (gen_random_uuid(), 'finance.supplier_payout.read', 'Чтение выплат поставщикам (SupplierPayout)'),
  (gen_random_uuid(), 'finance.supplier_payout.manage', 'Создание выплат поставщикам (SupplierPayout)')
ON CONFLICT ("code") DO NOTHING;

-- 6. Дефолтные гранты ролей.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('FINANCE',  'finance.obligation.read'),
  ('DIRECTOR', 'finance.obligation.read'),
  ('ANALYST',  'finance.obligation.read'),
  ('FINANCE',  'finance.obligation.manage'),
  ('FINANCE',  'finance.supplier_payout.read'),
  ('DIRECTOR', 'finance.supplier_payout.read'),
  ('ANALYST',  'finance.supplier_payout.read'),
  ('FINANCE',  'finance.supplier_payout.manage')
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
