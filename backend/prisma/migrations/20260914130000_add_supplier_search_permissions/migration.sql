-- Supplier search permissions (Mode A: Dynamic Supplier Inventory)
-- supplier.search.read — search/detail/refresh (ADMIN + PARTNER)
-- supplier.search.manage — cache/metrics management (ADMIN only)

INSERT INTO "security"."Permission" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'supplier.search.read', 'Чтение поиска поставщика (Supplier Search/Detail/Refresh)'),
  (gen_random_uuid(), 'supplier.search.manage', 'Управление кэшем/метриками поставщика (ADMIN)')
ON CONFLICT ("code") DO NOTHING;

-- Assign to ADMIN role
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN' AND p."code" IN ('supplier.search.read', 'supplier.search.manage')
ON CONFLICT DO NOTHING;

-- Assign supplier.search.read to PARTNER role
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'PARTNER' AND p."code" = 'supplier.search.read'
ON CONFLICT DO NOTHING;
