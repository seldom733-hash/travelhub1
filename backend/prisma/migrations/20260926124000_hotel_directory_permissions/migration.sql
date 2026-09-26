-- Hotel directory RBAC: hotel_directory.read/create/update/delete rows
-- and default grants (ADMIN: all four, DIRECTOR: read-only).
-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.

-- 1. Permission catalog rows
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'hotel_directory.read', 'Reading the hotel reference directory'),
  (gen_random_uuid(), 'hotel_directory.create', 'Creating hotel reference directory entries'),
  (gen_random_uuid(), 'hotel_directory.update', 'Updating hotel reference directory entries'),
  (gen_random_uuid(), 'hotel_directory.delete', 'Deleting hotel reference directory entries')
ON CONFLICT ("code") DO NOTHING;

-- 2. DIRECTOR grant (read-only master data visibility)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'hotel_directory.read'
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
