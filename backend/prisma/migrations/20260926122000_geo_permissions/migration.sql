-- Master Geography RBAC: geography.read/create/update/delete permission rows
-- and default grants (ADMIN: all four, DIRECTOR: read-only).
-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.
-- (Permission rows are also auto-synced from constants at startup; this
-- migration additionally persists the default role assignments one-time.)

-- 1. Permission catalog rows
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'geography.read', 'Reading the master geography directory'),
  (gen_random_uuid(), 'geography.create', 'Creating master geography entries'),
  (gen_random_uuid(), 'geography.update', 'Updating master geography entries'),
  (gen_random_uuid(), 'geography.delete', 'Deleting master geography entries')
ON CONFLICT ("code") DO NOTHING;

-- 2. DIRECTOR grant (read-only master data visibility)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'geography.read'
)
WHERE r."code" = 'DIRECTOR'
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
