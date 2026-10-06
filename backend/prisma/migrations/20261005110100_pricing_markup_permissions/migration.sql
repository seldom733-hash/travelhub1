-- Supplier Markup (STRICT PROMPT §23 / Gate J, Phase 1): canonical permissions
-- pricing.markup.read / pricing.markup.manage.
-- Источник истины: backend/src/security/permissions.constants.ts (PERMISSIONS,
-- ROLE_PERMISSIONS) + PERMISSION_DESCRIPTIONS (security.service.ts).
-- Гранты (дизайн §12):
--   pricing.markup.read    → DIRECTOR, FINANCE, ANALYST (+ ADMIN по ALL)
--   pricing.markup.manage  → FINANCE (+ ADMIN по ALL)
-- Admin markup UI обязан зависеть ТОЛЬКО от этих прав и НЕ от
-- supplier.search.* (undeclared, fail-closed 403 — audit дефект, Gate J).
-- Idempotent: safe to re-apply. Startup seed НЕ трогает RolePermission —
-- только эти гранты (rbac-parity e2e сверяет PERMISSIONS ↔ DB).

-- 1. Permission catalog (boot seed вставит строку при новом коде, если
--    миграция не успела — ON CONFLICT DO NOTHING).
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'pricing.markup.read', 'Чтение MarkupRule и матрицы наценок'),
  (gen_random_uuid(), 'pricing.markup.manage', 'Управление MarkupRule (master data, DRAFT→ACTIVE→ARCHIVED)')
ON CONFLICT ("code") DO NOTHING;

-- 2. Дефолтные гранты ролей.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('DIRECTOR', 'pricing.markup.read'),
  ('FINANCE',  'pricing.markup.read'),
  ('ANALYST',  'pricing.markup.read'),
  ('FINANCE',  'pricing.markup.manage')
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
