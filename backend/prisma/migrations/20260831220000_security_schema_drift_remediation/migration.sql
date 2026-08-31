-- Phase 3 Pre-Step 3.12: Prisma/Runtime Schema Drift Remediation
-- Root cause: security schema never applied; public.users has old flat model
-- This migration creates security.* tables and migrates data from public.users

-- 1. Create security schema (idempotent)
CREATE SCHEMA IF NOT EXISTS "security";

-- 2. Create enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "security"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "security"."RoleCode" AS ENUM (
    'ADMIN', 'DIRECTOR', 'FINANCE', 'MARKETER', 'ANALYST',
    'MODERATOR', 'SALES_MANAGER', 'OPERATOR', 'PARTNER', 'BUYER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create Role table
CREATE TABLE IF NOT EXISTS "security"."Role" (
  "id" TEXT NOT NULL,
  "code" "security"."RoleCode" NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- 4. Create Permission table
CREATE TABLE IF NOT EXISTS "security"."Permission" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- 5. Create RolePermission junction
CREATE TABLE IF NOT EXISTS "security"."RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- 6. Create User table (security schema — canonical)
CREATE TABLE IF NOT EXISTS "security"."User" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT,
  "status" "security"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "roleId" TEXT NOT NULL,
  "partnerId" TEXT,
  "customerId" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- 7. Create AuditLog table
CREATE TABLE IF NOT EXISTS "security"."AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "username" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "resourceId" TEXT,
  "details" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- 8. Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_code_key" ON "security"."User"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "security"."User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "security"."User"("email");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "security"."User"("roleId");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "security"."User"("status");

-- 9. Seed Roles (canonical role set)
INSERT INTO "security"."Role" ("id", "code", "title") VALUES
  ('role-admin',    'ADMIN',          'Администратор'),
  ('role-director', 'DIRECTOR',       'Директор'),
  ('role-finance',  'FINANCE',        'Финансовый менеджер'),
  ('role-marketer', 'MARKETER',       'Маркетолог'),
  ('role-analyst',  'ANALYST',        'Аналитик'),
  ('role-moderator','MODERATOR',      'Модератор'),
  ('role-sales',    'SALES_MANAGER',  'Менеджер по продажам'),
  ('role-operator', 'OPERATOR',       'Оператор'),
  ('role-partner',  'PARTNER',        'Партнёр'),
  ('role-buyer',    'BUYER',          'Покупатель')
ON CONFLICT ("id") DO NOTHING;

-- 10. Migrate users from public.users → security.User
-- Old schema: id, email, passwordHash, firstName, lastName, role (enum), isActive
-- New schema: id, code, username, email, passwordHash, fullName, status, roleId, tokenVersion, etc.
INSERT INTO "security"."User" (
  "id", "code", "username", "email", "passwordHash", "fullName",
  "status", "roleId", "tokenVersion", "version", "createdAt", "updatedAt"
)
SELECT
  u.id,
  'USR-' || LPAD(CAST(ROW_NUMBER() OVER (ORDER BY u.id) AS TEXT), 8, '0') AS "code",
  u.email AS "username",
  u.email,
  u."passwordHash",
  u."firstName" || ' ' || u."lastName" AS "fullName",
  CASE WHEN u."isActive" THEN 'ACTIVE'::"security"."UserStatus" ELSE 'INACTIVE'::"security"."UserStatus" END AS "status",
  CASE u.role
    WHEN 'ADMIN' THEN 'role-admin'
    WHEN 'PARTNER' THEN 'role-partner'
    WHEN 'BUYER' THEN 'role-buyer'
    WHEN 'ANALYST' THEN 'role-analyst'
    ELSE 'role-buyer'
  END AS "roleId",
  0 AS "tokenVersion",
  1 AS "version",
  COALESCE(u."createdAt", CURRENT_TIMESTAMP) AS "createdAt",
  COALESCE(u."updatedAt", CURRENT_TIMESTAMP) AS "updatedAt"
FROM users u
ON CONFLICT ("id") DO NOTHING;

-- 11. Create _prisma_migrations table (required by Prisma migrate)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- 12. Mark all existing migrations as applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
SELECT
  '00000000-0000-0000-0000-' || LPAD(CAST(ROW_NUMBER() OVER (ORDER BY m.name) AS TEXT), 12, '0') AS "id",
  'legacy-reconciled' AS "checksum",
  CURRENT_TIMESTAMP AS "finished_at",
  m.name AS "migration_name",
  1 AS "applied_steps_count"
FROM (
  SELECT unnest(ARRAY[
    '20260807190230_init',
    '20260807190425_add_business_sequences',
    '20260807191031_add_created_at',
    '20260807194102_add_security_rbac',
    '20260808015505_add_category_schema_foundation',
    '20260808065315_add_product_media',
    '20260808090000_enforce_single_primary_media',
    '20260808120000_add_product_partner_scope_index',
    '20260808140000_add_moderation_submissions',
    '20260808150000_add_change_proposal_and_active_submission_invariant',
    '20260808160000_add_partner_onboarding',
    '20260808200000_add_public_seller_profile',
    '20260808202608_add_partner_storefront',
    '20260808205236_add_storefront_channels_entitlement',
    '20260808211909_add_storefront_business_identity',
    '20260808225507_add_storefront_behavioral_events',
    '20260808230000_add_seller_geography',
    '20260809110000_add_temporal_readiness',
    '20260809130000_add_marketplace_behavioral_events',
    '20260809140000_add_business_event_actor'
  ]) AS name
) m
ON CONFLICT ("migration_name") DO NOTHING;
