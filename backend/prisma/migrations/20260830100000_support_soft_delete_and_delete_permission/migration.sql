-- R13: Soft delete fields on Case
ALTER TABLE "support"."Case" ADD COLUMN "deletedAt"   TIMESTAMP(3);
ALTER TABLE "support"."Case" ADD COLUMN "deletedBy"   TEXT;
ALTER TABLE "support"."Case" ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Case_deletedAt_idx" ON "support"."Case"("deletedAt") WHERE "deletedAt" IS NOT NULL;

-- R13: Ensure support.case.delete Permission row exists
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'support.case.delete', 'Административное мягкое удаление support cases (только ADMIN)')
ON CONFLICT ("code") DO NOTHING;

-- R13: RBAC seed — support.case.delete granted ONLY to ADMIN
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" = 'support.case.delete'
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
