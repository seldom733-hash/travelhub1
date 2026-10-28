-- Hybrid RBAC: editable per-role permissions + multiple roles per user.
-- Primary role remains security.User.roleId (backward compatibility); the new
-- table stores ADDITIONAL roles with validity window/author/reason. Existing
-- users keep their current role as primary — no data rewrite needed.

ALTER TABLE "security"."Role"
  ADD COLUMN IF NOT EXISTS "description" TEXT;

UPDATE "security"."Role"
   SET "description" = COALESCE("description", "title")
 WHERE "description" IS NULL;

CREATE TABLE IF NOT EXISTS "security"."UserRoleAssignment" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "roleId"         TEXT NOT NULL,
  "startAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt"          TIMESTAMP(3),
  "reason"         TEXT,
  "assignedById"   TEXT,
  "assignedByName" TEXT,
  "revokedAt"      TIMESTAMP(3),
  "revokedById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_key"
  ON "security"."UserRoleAssignment" ("userId", "roleId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_startAt_endAt_idx"
  ON "security"."UserRoleAssignment" ("userId", "startAt", "endAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_userId_fkey') THEN
    ALTER TABLE "security"."UserRoleAssignment"
      ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "security"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_roleId_fkey') THEN
    ALTER TABLE "security"."UserRoleAssignment"
      ADD CONSTRAINT "UserRoleAssignment_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "security"."Role"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
