-- The manager bonus screen used finance.overview.read, which exposed payroll data
-- to every role with finance KPI access (OPERATOR/ANALYST/SALES_MANAGER).
-- Introduce a dedicated permission and grant it to the finance roles only.
INSERT INTO security."Permission" ("id", "code", "description")
VALUES (gen_random_uuid(), 'finance.bonus.read', 'Просмотр бонусов менеджеров')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO security."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM security."Role" r
CROSS JOIN security."Permission" p
WHERE r."code" IN ('FINANCE', 'DIRECTOR')
  AND p."code" = 'finance.bonus.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
