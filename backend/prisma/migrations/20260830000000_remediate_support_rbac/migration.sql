-- PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — STRICT REVIEW FINDINGS REMEDIATION
-- Finding F1: support.case.* RolePermission rows are missing.

-- 1. Ensure all support.case.* Permission rows exist (canonical set)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'support.case.create', 'Создание support cases'),
  (gen_random_uuid(), 'support.case.read', 'Чтение support cases'),
  (gen_random_uuid(), 'support.case.update', 'Обновление support cases'),
  (gen_random_uuid(), 'support.case.assign', 'Назначение support cases')
ON CONFLICT ("code") DO NOTHING;

-- 2. Default RolePermission assignments for support.case.*
-- ADMIN gets all support.case.* permissions
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.create', 'support.case.read', 'support.case.update', 'support.case.assign'
)
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- OPERATOR gets all support.case.* permissions
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.create', 'support.case.read', 'support.case.update', 'support.case.assign'
)
WHERE r."code" = 'OPERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- DIRECTOR gets support.case.read only
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.read'
)
WHERE r."code" = 'DIRECTOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- FINANCE gets support.case.read (as per established pattern for read-only financial oversight)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.read'
)
WHERE r."code" = 'FINANCE'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ANALYST gets support.case.read (as per established pattern for read-only data analysis)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.read'
)
WHERE r."code" = 'ANALYST'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- SALES_MANAGER gets support.case.read (as per established pattern for customer context)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'support.case.read'
)
WHERE r."code" = 'SALES_MANAGER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
