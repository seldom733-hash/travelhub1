-- D4 F3 fix: Payment/Refund lifecycle endpoints (Step 2.12/2.12H/2.13) reference
-- granular permission keys (finance.payment.create, finance.payment.manage,
-- finance.refund.execute) that were missing from the catalog and NOT granted to
-- any role — POST /finance/payments, /payments/:code/confirm|fail|cancel and
-- /refunds/:code/process|fail returned 403 for ALL roles (including ADMIN).
-- This migration adds the permission rows and grants them to FINANCE (operator
-- of the payment/refund lifecycle) and ADMIN (ALL_PERMISSIONS convention).
-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.

-- 1. Permission catalog rows
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'finance.payment.create', 'Создание платежа (инициация, Step 2.12H)'),
  (gen_random_uuid(), 'finance.payment.manage', 'Управление платежом (confirm/fail/cancel)'),
  (gen_random_uuid(), 'finance.refund.execute', 'Исполнение возврата (process/fail)')
ON CONFLICT ("code") DO NOTHING;

-- 2. FINANCE grants (payment initiation/manage + refund execution)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'finance.payment.create', 'finance.payment.manage', 'finance.refund.execute'
)
WHERE r."code" = 'FINANCE'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- 3. ADMIN gets ALL_PERMISSIONS (idempotent add-missing)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
