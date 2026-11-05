INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE (
    (
      r."code" IN ('SALES_MANAGER', 'SALES_HEAD')
      AND p."code" IN ('order.accept', 'order.edit_noncritical', 'order.request_booking', 'order.cancel', 'order.suspend')
    ) OR (
      r."code" = 'SALES_HEAD'
      AND p."code" = 'order.close'
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
