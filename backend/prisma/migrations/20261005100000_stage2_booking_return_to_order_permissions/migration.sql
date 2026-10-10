-- Stage 2 (Booking → Order): granular permission booking.return_to_order.
-- Решение владельца Q7: ОТДЕЛЬНОЕ право (не booking.cancel): возврат брони в
-- заказ — операция round-trip, а не отмена поставщику.
-- Источник истины: backend/src/security/permissions.constants.ts (PERMISSIONS,
-- ROLE_PERMISSIONS) + PERMISSION_DESCRIPTIONS (security.service.ts).
-- Гранты:
--   booking.return_to_order → OPERATOR (операционный контур, как booking.cancel)
--                             + ADMIN (ALL_PERMISSIONS convention).
-- Idempotent: safe to re-apply. НЕ удаляет существующие RolePermission.
-- rbac-parity e2e требует точного соответствия DB ↔ ROLE_PERMISSIONS.

-- 1. Permission catalog (boot seed тоже добавляет отсутствующие коды, идемпотентно)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'booking.return_to_order', 'Возврат бронирования в заказ (Booking → Order round-trip)')
ON CONFLICT ("code") DO NOTHING;

-- 2. Матричный грант OPERATOR (зеркало booking.cancel)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('OPERATOR', 'booking.return_to_order')
) AS g("roleCode", "permissionCode")
JOIN "security"."Role" r ON r."code"::text = g."roleCode"
JOIN "security"."Permission" p ON p."code" = g."permissionCode"
WHERE NOT EXISTS (
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
