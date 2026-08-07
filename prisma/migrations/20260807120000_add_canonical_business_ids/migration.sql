-- Каноническая ID Policy (Baseline 1.1, §0.8)
-- Добавляем business code: Order.code (ORD-*), Booking.code (BKG-*), User.code (USR-*/CUS-*).
-- Order.orderNumber переводим на пользовательский формат TH-YYYY-######.

-- ── User.code (nullable, уникальный): USR-* для персонала, CUS-* для клиентов/партнёров ──
ALTER TABLE "User" ADD COLUMN "code" TEXT;
UPDATE "User" SET "code" = 'USR-' || printf('%08d',
  (SELECT COUNT(*) FROM "User" u2 WHERE u2."rowid" <= "User"."rowid" AND u2."role" NOT IN ('BUYER', 'PARTNER')))
  WHERE "role" NOT IN ('BUYER', 'PARTNER');
UPDATE "User" SET "code" = 'CUS-' || printf('%08d',
  (SELECT COUNT(*) FROM "User" u2 WHERE u2."rowid" <= "User"."rowid" AND u2."role" IN ('BUYER', 'PARTNER')))
  WHERE "role" IN ('BUYER', 'PARTNER');
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- ── Order: добавляем code = ORD-00000001, orderNumber переводим в TH-YYYY-###### ──
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
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
INSERT INTO "new_Order" ("code", "amount", "createdAt", "currency", "id", "orderNumber", "paidAmount", "serviceDate", "source", "status", "updatedAt", "userId")
SELECT
  'ORD-' || printf('%08d', CAST(substr("orderNumber", 5) AS INTEGER)),
  "amount", "createdAt", "currency", "id",
  'TH-' || strftime('%Y', 'now') || '-' || printf('%06d', CAST(substr("orderNumber", 5) AS INTEGER)),
  "paidAmount", "serviceDate", "source", "status", "updatedAt", "userId"
FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_serviceDate_idx" ON "Order"("serviceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ── Booking: добавляем code = BKG-00000001 ──
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" REAL NOT NULL,
    "serviceDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orderId" TEXT,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("code", "amount", "createdAt", "id", "orderId", "serviceDate", "serviceId", "status", "updatedAt", "userId")
SELECT
  'BKG-' || printf('%08d', ROW_NUMBER() OVER (ORDER BY "createdAt", "id")),
  "amount", "createdAt", "id", "orderId", "serviceDate", "serviceId", "status", "updatedAt", "userId"
FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");
CREATE INDEX "Booking_orderId_idx" ON "Booking"("orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
