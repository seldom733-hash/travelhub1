-- AlterEnum
ALTER TYPE "sales"."SalesAcquisitionSource" ADD VALUE 'BUYER_REQUEST';

-- AlterTable
ALTER TABLE "booking"."Booking" ADD COLUMN     "acquisitionSource" TEXT;
