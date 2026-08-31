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
ON CONFLICT ("code") DO NOTHING;

-- 10. Migrate users from public.users → security.User (only if public.users exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
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
  END IF;
END $$;

-- Note: _prisma_migrations table and migration tracking are managed by
-- Prisma's own migration engine. No manual INSERT needed here.
