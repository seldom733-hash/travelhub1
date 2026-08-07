-- Канонические статусы (Baseline 1.1, §0.4–0.6).
-- OrderStatus: NEW → IN_PROCESSING → WAITING_FOR_DATA → READY_FOR_BOOKING →
-- SENT_TO_BOOKING → PARTIALLY_FULFILLED → FULFILLED → READY_TO_CLOSE → CLOSED
-- (ветви: CANCELLED, PROBLEM, SUSPENDED). Оплата вынесена в Order.paymentStatus
-- (UNPAID | PARTIALLY_PAID | PAID | REFUNDED) — §0.6 «Правило локализации статусов».
-- BookingStatus: NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER → AWAITING_CONFIRMATION
-- → CONFIRMED → IN_SERVICE → COMPLETED (ветви: NEEDS_CLARIFICATION,
-- SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM).

-- ── Order: новая колонка paymentStatus + ремап статусов ──
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
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
INSERT INTO "new_Order" ("code", "amount", "createdAt", "currency", "id", "orderNumber", "paidAmount", "paymentStatus", "priority", "serviceDate", "source", "status", "updatedAt", "userId")
SELECT
  "code", "amount", "createdAt", "currency", "id", "orderNumber", "paidAmount",
  CASE
    WHEN "status" IN ('PAID', 'DOCUMENT_PREP', 'READY', 'COMPLETED') THEN 'PAID'
    WHEN "status" = 'PARTIALLY_PAID' THEN 'PARTIALLY_PAID'
    WHEN "status" = 'REFUNDED' THEN 'REFUNDED'
    ELSE 'UNPAID'
  END,
  "priority", "serviceDate", "source",
  CASE
    WHEN "status" IN ('DRAFT', 'CREATED') THEN 'NEW'
    WHEN "status" = 'PROCESSING' THEN 'IN_PROCESSING'
    WHEN "status" = 'AWAITING_CONFIRMATION' THEN 'WAITING_FOR_DATA'
    WHEN "status" = 'CONFIRMED' THEN 'READY_FOR_BOOKING'
    WHEN "status" IN ('AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID') THEN 'READY_FOR_BOOKING'
    WHEN "status" = 'DOCUMENT_PREP' THEN 'FULFILLED'
    WHEN "status" = 'READY' THEN 'READY_TO_CLOSE'
    WHEN "status" = 'COMPLETED' THEN 'CLOSED'
    WHEN "status" = 'CHANGED' THEN 'IN_PROCESSING'
    WHEN "status" IN ('REFUNDED', 'ARCHIVED') THEN 'CLOSED'
    WHEN "status" = 'OVERDUE' THEN 'PROBLEM'
    ELSE 'CANCELLED'
  END,
  "updatedAt", "userId"
FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_serviceDate_idx" ON "Order"("serviceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ── Booking: ремап статусов на канонический жизненный цикл ──
-- PENDING→NEW, CONFIRMED→CONFIRMED, PAID→CONFIRMED (оплата на уровне Order),
-- REFUNDED→CANCELLED, COMPLETED→COMPLETED.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
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
  "code", "amount", "createdAt", "id", "orderId", "serviceDate", "serviceId",
  CASE
    WHEN "status" = 'PENDING' THEN 'NEW'
    WHEN "status" = 'PAID' THEN 'CONFIRMED'
    WHEN "status" = 'REFUNDED' THEN 'CANCELLED'
    ELSE "status"
  END,
  "updatedAt", "userId"
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
