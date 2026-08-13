-- CreateEnum
CREATE TYPE "booking"."BookingServiceTimeType" AS ENUM ('DATE_ONLY', 'TIME_SLOT', 'DATE_RANGE', 'OPEN_DATE');

-- AlterTable
ALTER TABLE "booking"."Booking" ADD COLUMN     "serviceEndTime" TEXT,
ADD COLUMN     "serviceEndsAt" TIMESTAMP(3),
ADD COLUMN     "serviceStartsAt" TIMESTAMP(3),
ADD COLUMN     "serviceTime" TEXT,
ADD COLUMN     "serviceTimeType" "booking"."BookingServiceTimeType" NOT NULL DEFAULT 'DATE_ONLY',
ADD COLUMN     "serviceTimeZone" TEXT;

-- AlterTable
ALTER TABLE "catalog"."Product" ADD COLUMN     "serviceTimeZone" TEXT;

-- AlterTable
ALTER TABLE "order"."Order" ADD COLUMN     "serviceEndTime" TEXT,
ADD COLUMN     "serviceTime" TEXT,
ADD COLUMN     "serviceTimeZone" TEXT;

-- AlterTable
ALTER TABLE "sales"."CheckoutIntent" ADD COLUMN     "serviceEndTime" TEXT,
ADD COLUMN     "serviceTime" TEXT,
ADD COLUMN     "serviceTimeZone" TEXT;

-- AlterTable
ALTER TABLE "sales"."Sale" ADD COLUMN     "serviceEndTime" TEXT,
ADD COLUMN     "serviceTime" TEXT,
ADD COLUMN     "serviceTimeZone" TEXT;
