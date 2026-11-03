CREATE TABLE "sales"."SalesAssignmentSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "mode" TEXT NOT NULL DEFAULT 'AUTO',
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesAssignmentSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "sales"."SalesAssignmentSettings" ("id","mode","updatedAt")
VALUES ('default','AUTO',CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
