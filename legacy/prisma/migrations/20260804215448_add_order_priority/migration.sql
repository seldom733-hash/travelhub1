-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "serviceDate" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'Сайт',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("amount", "createdAt", "currency", "id", "orderNumber", "paidAmount", "serviceDate", "source", "status", "updatedAt", "userId") SELECT "amount", "createdAt", "currency", "id", "orderNumber", "paidAmount", "serviceDate", "source", "status", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_serviceDate_idx" ON "Order"("serviceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
