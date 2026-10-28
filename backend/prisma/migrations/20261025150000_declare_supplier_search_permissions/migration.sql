-- Declare permissions that SupplierController already references.
--
-- @RequirePermissions("supplier.search.read"/"supplier.search.manage") existed
-- in backend/src/modules/supplier/supplier.controller.ts, but neither code was
-- present in the canonical permission registry (security.permissions.constants).
-- PermissionsGuard is fail-closed, so every authenticated supplier endpoint —
-- search, offer detail, refresh-price, price calendar, metrics and ALL sync
-- triggers — returned 403 for every role, including ADMIN. Recorded as an
-- RBAC defect in docs/prompts/SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN.md (§audit).
--
-- Grant policy:
--   supplier.search.read   — ADMIN (snapshot), DIRECTOR (oversight), OPERATOR
--                            (sales/ops reads supplier offers);
--   supplier.search.manage — ADMIN only: syncs are heavy external jobs and
--                            cache invalidation is destructive, so they stay
--                            with the admin convention (ALL_PERMISSIONS).
--
-- Idempotent: safe to re-apply, never deletes existing RolePermission rows.

INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'supplier.search.read', 'Чтение поиска/офферов поставщиков'),
  (gen_random_uuid(), 'supplier.search.manage', 'Запуск синхронизации и управление кэшем поставщиков')
ON CONFLICT ("code") DO NOTHING;

-- ADMIN gets every permission (persisted convention).
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('supplier.search.read', 'supplier.search.manage')
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- DIRECTOR: read-only oversight (same model as pricing.markup.read).
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'supplier.search.read'
WHERE r."code" = 'DIRECTOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- OPERATOR: reads supplier offers when working with requests/bookings.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'supplier.search.read'
WHERE r."code" = 'OPERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
