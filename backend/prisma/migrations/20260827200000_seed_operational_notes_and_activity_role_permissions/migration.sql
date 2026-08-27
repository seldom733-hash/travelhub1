-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.
-- Authority: after this migration, RolePermission rows = persisted effective state.
--
-- Root cause: operational-notes.* and crm.activity.* Permission rows were created
-- by startup seedRoles(), but no migration created the RolePermission linking rows.
-- This migration adds them according to the RBAC matrix in permissions.constants.ts.

-- Ensure Permission rows exist (idempotent — startup seed also creates them)
INSERT INTO "security"."Permission" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'operational-notes.read', 'Чтение operational notes'),
  (gen_random_uuid(), 'operational-notes.create', 'Создание operational notes'),
  (gen_random_uuid(), 'operational-notes.update', 'Редактирование operational notes'),
  (gen_random_uuid(), 'operational-notes.delete', 'Удаление operational notes (soft-delete)'),
  (gen_random_uuid(), 'crm.activity.read', 'Чтение CRM Activity Timeline (customer/partner activity feeds)')
ON CONFLICT ("code") DO NOTHING;

-- ADMIN: ALL_PERMISSIONS (already has all via previous migration ADMIN grant, but add new ones idempotently)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN (
    'operational-notes.read', 'operational-notes.create',
    'operational-notes.update', 'operational-notes.delete',
    'crm.activity.read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- DIRECTOR: read-only operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'crm.activity.read'
)
WHERE r."code" = 'DIRECTOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- FINANCE: read-only operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'crm.activity.read'
)
WHERE r."code" = 'FINANCE'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- MARKETER: read-only operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'crm.activity.read'
)
WHERE r."code" = 'MARKETER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ANALYST: read-only operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'crm.activity.read'
)
WHERE r."code" = 'ANALYST'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- SALES_MANAGER: read + create operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'operational-notes.create', 'crm.activity.read'
)
WHERE r."code" = 'SALES_MANAGER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- OPERATOR: full CRUD operational-notes + crm.activity.read
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'operational-notes.read', 'operational-notes.create',
  'operational-notes.update', 'operational-notes.delete',
  'crm.activity.read'
)
WHERE r."code" = 'OPERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- PARTNER: NO operational-notes or crm.activity permissions (least privilege)
-- BUYER: NO operational-notes or crm.activity permissions (least privilege)
-- MODERATOR: NO operational-notes or crm.activity permissions (least privilege)
