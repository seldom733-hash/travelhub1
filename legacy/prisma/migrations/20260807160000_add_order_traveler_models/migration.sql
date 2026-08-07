-- TravelHub — Phase 1 completion: OrderItem, OrderTraveler, Passenger,
-- optimistic locking (version), correlationId/causationId на OrderEvent.

-- Позиции состава заказа (Order владеет составом, Baseline §3)
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" REAL NOT NULL,
    "serviceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Туристы заказа (до Booking; из них Booking Center создаёт Passenger)
CREATE TABLE "OrderTraveler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATETIME,
    "citizenship" TEXT,
    "gender" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" DATETIME,
    "dataCompleteness" TEXT NOT NULL DEFAULT 'incomplete',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderTraveler_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Пассажир конкретного Booking (Baseline §4; не заменяет OrderTraveler)
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATETIME,
    "citizenship" TEXT,
    "gender" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Passenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Optimistic locking (Baseline §13)
ALTER TABLE "Order" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Сквозная трассировка событий (Baseline §13: correlationId/causationId)
ALTER TABLE "OrderEvent" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN "causationId" TEXT;

-- Индексы
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_serviceId_idx" ON "OrderItem"("serviceId");
CREATE INDEX "OrderTraveler_orderId_idx" ON "OrderTraveler"("orderId");
CREATE INDEX "Passenger_bookingId_idx" ON "Passenger"("bookingId");
CREATE INDEX "OrderEvent_correlationId_idx" ON "OrderEvent"("correlationId");
