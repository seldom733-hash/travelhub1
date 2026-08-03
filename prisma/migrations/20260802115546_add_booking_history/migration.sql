-- CreateTable
CREATE TABLE "BookingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BookingHistory_bookingId_idx" ON "BookingHistory"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHistory_createdAt_idx" ON "BookingHistory"("createdAt");
