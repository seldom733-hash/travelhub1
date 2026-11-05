-- Cancellation approval permission: granted to ADMIN and FINANCE.
INSERT INTO "security"."Permission" ("id", "code", "description")
VALUES (gen_random_uuid(), 'finance.settlement.approve', 'Утверждение расчёта отмены сделки')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" IN ('ADMIN', 'FINANCE')
  AND p."code" = 'finance.settlement.approve'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
