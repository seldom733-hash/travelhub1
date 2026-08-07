-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "security";

-- CreateEnum
CREATE TYPE "security"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "security"."RoleCode" AS ENUM ('ADMIN', 'DIRECTOR', 'FINANCE', 'MARKETER', 'ANALYST', 'MODERATOR', 'SALES_MANAGER', 'OPERATOR', 'PARTNER', 'BUYER');

-- CreateTable
CREATE TABLE "security"."User" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security"."Role" (
    "id" TEXT NOT NULL,
    "code" "security"."RoleCode" NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security"."Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security"."RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "security"."AuditLog" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "security"."User"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "security"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "security"."User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "security"."User"("roleId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "security"."User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "security"."Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "security"."Permission"("code");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "security"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "security"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "security"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "security"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "security"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "security"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "security"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "security"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
