-- Traveler two-stage model (PHASE: REQUEST TRAVELERS → ORDER TRAVELER EXPANSION)
-- SAFE / ADDITIVE ONLY — no destructive operations.
--
-- 1) order.RequestTraveler            — Request-stage travelers (FIO + birthDate)
-- 2) order.OrderTraveler.passportSeries  — Order-stage document data
-- 3) booking.Passenger.passportSeries    — downstream booking payload
--
-- НИЧЕГО не удаляется: gender / passportNumber / passportExpiry сохраняются.

-- CreateTable
CREATE TABLE "order"."RequestTraveler" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestTraveler_requestId_idx" ON "order"."RequestTraveler"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestTraveler_requestId_position_key" ON "order"."RequestTraveler"("requestId", "position");

-- AddForeignKey
ALTER TABLE "order"."RequestTraveler" ADD CONSTRAINT "RequestTraveler_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "order"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "order"."OrderTraveler" ADD COLUMN "passportSeries" TEXT;

-- AlterTable
ALTER TABLE "booking"."Passenger" ADD COLUMN "passportSeries" TEXT;
