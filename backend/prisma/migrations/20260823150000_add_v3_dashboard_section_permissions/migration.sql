-- Stage A: Granular RBAC Remediation
-- Add 4 new V3 section permissions + role assignments

-- 1. Add missing Permission rows
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'dashboard.catalog.read', 'Чтение Catalog Health (Published, Archived, Without Sales, High Demand, Low Conversion)'),
  (gen_random_uuid(), 'dashboard.channels.read', 'Чтение Channel Health (Marketplace/Storefront GMV, Revenue, Orders, Conversion)'),
  (gen_random_uuid(), 'dashboard.attention.read', 'Чтение Needs Attention (Pending Confirmations, Failed Payments, Cancellations, Refunds)'),
  (gen_random_uuid(), 'dashboard.insights.read', 'Чтение AI Decision Feed (Risks, Opportunities, Catalog Insights)')
ON CONFLICT ("code") DO NOTHING;

-- 2. ADMIN gets all 4 new permissions
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND p."code" IN ('dashboard.catalog.read', 'dashboard.channels.read', 'dashboard.attention.read', 'dashboard.insights.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- 3. DIRECTOR gets all 4 new permissions
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'DIRECTOR'
  AND p."code" IN ('dashboard.catalog.read', 'dashboard.channels.read', 'dashboard.attention.read', 'dashboard.insights.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- 4. MARKETER gets catalog, channels, insights
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'MARKETER'
  AND p."code" IN ('dashboard.catalog.read', 'dashboard.channels.read', 'dashboard.insights.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- 5. ANALYST gets catalog
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ANALYST'
  AND p."code" IN ('dashboard.catalog.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- 6. FINANCE gets attention
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'FINANCE'
  AND p."code" IN ('dashboard.attention.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- 7. OPERATOR gets page gate + operational + attention
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'OPERATOR'
  AND p."code" IN ('analytics.read', 'dashboard.operational.read', 'dashboard.attention.read')
  AND NOT EXISTS (SELECT 1 FROM "security"."RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");
