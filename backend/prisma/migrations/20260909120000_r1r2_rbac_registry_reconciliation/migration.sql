-- PHASE 3 — R1/R2 — PERMISSION REGISTRY ↔ DB RECONCILIATION
-- Catch-up for code-registry grants that never had a seed migration.
--
-- Mechanism (proven by R1/R2 audit):
--   * startup seed (SecurityService.seedRoles) creates missing Permission *codes*
--     but deliberately does NOT sync RolePermission rows (Step 3.2 design —
--     "Default assignments создаются one-time Prisma migration");
--   * therefore any grant added to ROLE_PERMISSIONS after the last migration is
--     MISSING on migration-built databases (fresh e2e test DB, new deployments).
--
-- This migration is ADDITIVE ONLY: it does not revoke or modify any existing row
-- (restart-persistence Test B contract: startup seed never deletes grants).
-- No revocation is performed here: the single stale code-side artifact
-- (order.import, dev-DB-only) is classified STALE in the R1/R2 report and is NOT
-- deleted without explicit approval.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. crm.partner.read — Step 3.5C code grant, no seed migration existed.
--    Canonical holders: ADMIN (ALL), DIRECTOR, SALES_MANAGER, OPERATOR.
--    IMPORTANT: the Permission ROW itself was also never migration-seeded —
--    it materialized only via the additive boot-time seed AFTER migrations.
--    Create it here first (idempotent), otherwise the grant INSERT below
--    joins against a missing row and silently inserts nothing.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "security"."Permission" ("id", "code", "description")
SELECT gen_random_uuid(), v.code, v.descr
FROM (VALUES
  ('crm.partner.read', 'Чтение партнёров (CRM)'),
  ('crm.customer.read_own', 'Чтение собственных CRM-отношений (partner own-scope)'),
  ('crm.customer.create_own', 'Прямое добавление клиента/лида в собственный CRM (partner intake)'),
  ('crm.customer.update_own', 'Обновление собственных CRM-отношений (lifecycle/tags/notes)')
) AS v(code, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."Permission" p WHERE p."code" = v.code
);

INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'crm.partner.read'
WHERE r."code" IN ('DIRECTOR', 'SALES_MANAGER', 'OPERATOR')
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ADMIN holds every permission by convention (ALL_PERMISSIONS); ensure the row
-- exists for migration-built DBs where it was never granted either.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'crm.partner.read'
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. crm.customer.*_own — Step 3.5C partner own-scope CRM code grants, no seed
--    migration existed. Canonical holders: ADMIN (ALL), PARTNER.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'crm.customer.read_own', 'crm.customer.create_own', 'crm.customer.update_own'
)
WHERE r."code" IN ('ADMIN', 'PARTNER')
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. analytics.read → FINANCE — Command Center page gate. Migration
--    20260823150000 (add_v3_dashboard_section_permissions) §6 granted it to
--    FINANCE ("add missing page gate + section grants"), but the code registry
--    and this migration-chain grant were never reconciled.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'analytics.read'
WHERE r."code" = 'FINANCE'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. support.case.read → FINANCE / ANALYST / SALES_MANAGER — Step 3.10
--    remediation migration 20260830000000 grants it to these roles; the code
--    registry block was never updated. Direct code-side back-port in
--    permissions.constants.ts (no SQL needed: grant rows already exist via
--    20260830000000).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. marketing.* — Step 3.8.1 Marketing Center permission set.
--    The 9 codes gate production endpoints (marketing.controller.ts
--    @RequirePermissions) and the Marketing Center UI (Shell nav + dashboard
--    page gate: marketing.campaign.read). They were seeded into the dev DB by
--    Step 3.8.1 runtime provisioning but NEVER existed in any migration or in
--    the code registry — migration-built DBs (fresh e2e, new deployments) had
--    no marketing rows at all. R2 decision: OPTION A — CANONICAL; codes
--    back-ported into PERMISSIONS + ROLE_PERMISSIONS in
--    permissions.constants.ts; this migration reproduces the exact Step 3.8.1
--    grant state (ADMIN, DIRECTOR, MARKETER, OPERATOR) additively.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "security"."Permission" ("id", "code", "description")
SELECT gen_random_uuid(), code, descr
FROM (VALUES
  ('marketing.read', 'Чтение маркетинговых данных (агрегированный Marketing read model)'),
  ('marketing.campaign.read', 'Чтение маркетинговых кампаний (Marketing Center page gate)'),
  ('marketing.campaign.create', 'Создание маркетинговых кампаний'),
  ('marketing.campaign.update', 'Обновление маркетинговых кампаний'),
  ('marketing.campaign.delete', 'Удаление маркетинговых кампаний'),
  ('marketing.audience.read', 'Чтение маркетинговых аудиторий'),
  ('marketing.audience.manage', 'Управление маркетинговыми аудиториями'),
  ('marketing.attribution.read', 'Чтение маркетинговых атрибуций'),
  ('marketing.attribution.manage', 'Управление маркетинговыми атрибуциями')
) AS v(code, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."Permission" p WHERE p."code" = v.code
);

-- Grants per Step 3.8.1 closure state: ADMIN, DIRECTOR, MARKETER, OPERATOR.
-- (FINANCE/ANALYST/MODERATOR/SALES_MANAGER/PARTNER/BUYER intentionally NOT
--  granted — verified against live dev-DB RolePermission rows, R1 §6.)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'marketing.read',
  'marketing.campaign.read', 'marketing.campaign.create',
  'marketing.campaign.update', 'marketing.campaign.delete',
  'marketing.audience.read', 'marketing.audience.manage',
  'marketing.attribution.read', 'marketing.attribution.manage'
)
WHERE r."code" IN ('ADMIN', 'DIRECTOR', 'MARKETER', 'OPERATOR')
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. order.import — R2 decision: OPTION B — LEGACY/STALE (dev-DB-only artifact;
--    zero guard/endpoint usage in backend/src; deliberately removed by Step 2.6;
--    auth-rbac.e2e asserts its absence from the ADMIN session). NOT deleted
--    here: DB removal requires explicit governance approval per R1/R2 §7/§14.
--    Documented as the sole remaining governance item in the R1/R2 report.
-- ─────────────────────────────────────────────────────────────────────────────
