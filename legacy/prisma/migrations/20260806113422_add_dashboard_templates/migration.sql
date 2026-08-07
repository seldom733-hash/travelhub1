-- CreateTable
CREATE TABLE "DashboardTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DashboardTemplate_role_idx" ON "DashboardTemplate"("role");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardTemplate_role_name_key" ON "DashboardTemplate"("role", "name");
