-- Dictionary propose RBAC: catalog.dictionary.propose permission row
-- and default grants (PARTNER: propose; ADMIN: all).
-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.

-- 1. Permission catalog row (boot seed also adds missing codes, idempotent here)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'catalog.dictionary.propose', 'Предложение записи справочника типов/видов (PARTNER, PENDING → модерация)')
ON CONFLICT ("code") DO NOTHING;

-- 2. PARTNER grant: propose new room/view dictionary entries (PENDING queue)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'catalog.dictionary.propose'
WHERE r."code" = 'PARTNER'
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
