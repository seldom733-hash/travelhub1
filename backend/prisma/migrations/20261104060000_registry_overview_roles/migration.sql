INSERT INTO security."RolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM security."Role" r CROSS JOIN security."Permission" p
WHERE r.code IN ('SALES_MANAGER','OPERATOR') AND p.code='finance.overview.read'
ON CONFLICT DO NOTHING;
