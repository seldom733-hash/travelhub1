-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookingMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookingMessage" ("bookingId", "createdAt", "id", "senderId", "senderName", "senderRole", "text") SELECT "bookingId", "createdAt", "id", "senderId", "senderName", "senderRole", "text" FROM "BookingMessage";
DROP TABLE "BookingMessage";
ALTER TABLE "new_BookingMessage" RENAME TO "BookingMessage";
CREATE INDEX "BookingMessage_bookingId_idx" ON "BookingMessage"("bookingId");
CREATE INDEX "BookingMessage_senderRole_isRead_idx" ON "BookingMessage"("senderRole", "isRead");
CREATE INDEX "BookingMessage_createdAt_idx" ON "BookingMessage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
