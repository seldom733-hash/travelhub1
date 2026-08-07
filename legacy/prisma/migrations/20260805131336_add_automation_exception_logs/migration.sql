-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "event" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'success',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'Business Event Engine',
    "actorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExceptionLog" (
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
    CONSTRAINT "ExceptionLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AutomationLog_orderId_idx" ON "AutomationLog"("orderId");

-- CreateIndex
CREATE INDEX "AutomationLog_createdAt_idx" ON "AutomationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExceptionLog_orderId_idx" ON "ExceptionLog"("orderId");

-- CreateIndex
CREATE INDEX "ExceptionLog_createdAt_idx" ON "ExceptionLog"("createdAt");
