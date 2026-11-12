-- Order-level financial documents: a Payment/Refund document can exist before
-- a Booking is created. NULL bookingId means the document belongs to the Order.
ALTER TABLE "documents"."Document" ALTER COLUMN "bookingId" DROP NOT NULL;
