/*
  Warnings:

  - Added the required column `updatedAt` to the `ExceptionLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ExceptionLogHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exceptionLogId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "comment" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExceptionLogHistory_exceptionLogId_fkey" FOREIGN KEY ("exceptionLogId") REFERENCES "ExceptionLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
-- Backfill: существующие строки получают updatedAt = createdAt (в INSERT ниже)
CREATE TABLE "new_ExceptionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criticality" TEXT NOT NULL DEFAULT 'critical',
    "orderNumber" TEXT,
    "manager" TEXT,
    "status" TEXT NOT NULL DEFAULT 'working',
    "description" TEXT NOT NULL,
    "aiSuggestion" TEXT,
    "actorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExceptionLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExceptionLog" ("actorName", "aiSuggestion", "category", "createdAt", "criticality", "description", "id", "manager", "orderId", "orderNumber", "status", "type", "updatedAt") SELECT "actorName", "aiSuggestion", "category", "createdAt", "criticality", "description", "id", "manager", "orderId", "orderNumber", "status", "type", "createdAt" FROM "ExceptionLog";
DROP TABLE "ExceptionLog";
ALTER TABLE "new_ExceptionLog" RENAME TO "ExceptionLog";
CREATE INDEX "ExceptionLog_orderId_idx" ON "ExceptionLog"("orderId");
CREATE INDEX "ExceptionLog_createdAt_idx" ON "ExceptionLog"("createdAt");
CREATE INDEX "ExceptionLog_status_idx" ON "ExceptionLog"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExceptionLogHistory_exceptionLogId_idx" ON "ExceptionLogHistory"("exceptionLogId");

-- CreateIndex
CREATE INDEX "ExceptionLogHistory_createdAt_idx" ON "ExceptionLogHistory"("createdAt");
