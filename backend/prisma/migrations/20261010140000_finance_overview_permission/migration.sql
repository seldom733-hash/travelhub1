-- UNIFIED FINANCE CENTER Phase 3 — finance.overview.read permission.
--
-- Least-privilege (§5): сводные KPI (overview) — отдельное read-право.
-- Payment-read НЕ даёт overview; overview НЕ даёт payout-write/FX-admin.
-- Granted read-only to FINANCE / DIRECTOR / ANALYST; ADMIN gets ALL.
-- Idempotent: safe to re-apply (ON CONFLICT DO NOTHING / NOT EXISTS).

INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'finance.overview.read', 'Чтение сводных финансовых KPI (Finance Overview)')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('FINANCE',  'finance.overview.read'),
  ('DIRECTOR', 'finance.overview.read'),
  ('ANALYST',  'finance.overview.read')
) AS g("roleCode", "permissionCode")
JOIN "security"."Role" r ON r."code"::text = g."roleCode"
JOIN "security"."Permission" p ON p."code" = g."permissionCode"
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."RolePermission" rp
  WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
);

-- ADMIN gets ALL_PERMISSIONS (idempotent add-missing).
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
