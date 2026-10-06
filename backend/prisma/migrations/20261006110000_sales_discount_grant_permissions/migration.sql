-- Supplier Markup Phase 4 §4.3 — sales.discount.grant (Live Sales individual
-- discount, server-authoritative). Источники истины (как в 20261005110100):
--   1) permissions.constants PERMISSIONS (каталог; boot seed вставит строку,
--      если миграция не успела — ON CONFLICT DO NOTHING);
--   2) permissions.constants ROLE_PERMISSIONS (SALES_MANAGER + FINANCE);
--   3) ADMIN gets ALL_PERMISSIONS (idempotent add-missing).
-- Startup seed НЕ трогает RolePermission — только эти гранты
-- (rbac-parity e2e сверяет PERMISSIONS ↔ DB).

-- 1. Permission catalog.
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'sales.discount.grant', 'Применение индивидуальной скидки к заявке (Live Sales, server-authoritative)')
ON CONFLICT ("code") DO NOTHING;

-- 2. Дефолтные гранты ролей.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('SALES_MANAGER', 'sales.discount.grant'),
  ('FINANCE',       'sales.discount.grant')
) AS g("roleCode", "permissionCode")
JOIN "security"."Role" r ON r."code"::text = g."roleCode"
JOIN "security"."Permission" p ON p."code" = g."permissionCode"
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."RolePermission" rp
  WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
);

-- 3. ADMIN gets ALL_PERMISSIONS (idempotent add-missing).
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
