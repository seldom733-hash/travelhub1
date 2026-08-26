-- CreateTable
CREATE TABLE "crm"."OperationalNote" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "authorUserId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "OperationalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalNote_entityType_entityId_createdAt_idx" ON "crm"."OperationalNote"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalNote_authorUserId_createdAt_idx" ON "crm"."OperationalNote"("authorUserId", "createdAt");
