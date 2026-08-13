-- Phase 2 Step 2.8 — canonical OrderItem ↔ Booking linkage.
-- Additive: NULL для legacy Booking (до 2.8), уникальность — DB-level инвариант
-- «1 OrderItem → ≤1 Booking» для новых броней. Legacy-дубликатов нет (nullable,
-- unique index допускает множественные NULL).
-- AlterTable
ALTER TABLE "booking"."Booking" ADD COLUMN "orderItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_orderItemId_key" ON "booking"."Booking"("orderItemId");
