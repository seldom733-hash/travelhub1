ALTER TABLE "order"."RequestTraveler"
  ADD COLUMN "passportSeries" TEXT,
  ADD COLUMN "passportNumber" TEXT,
  ADD COLUMN "passportExpiry" TIMESTAMP(3);
