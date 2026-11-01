ALTER TABLE finance."SupplierPayout"
ADD COLUMN "orderId" text,
ADD COLUMN "orderCode" text,
ADD COLUMN "bookingId" text,
ADD COLUMN "bookingCode" text,
ADD COLUMN "customerId" text;

CREATE INDEX "SupplierPayout_orderId_idx" ON finance."SupplierPayout"("orderId");
CREATE INDEX "SupplierPayout_bookingId_idx" ON finance."SupplierPayout"("bookingId");
CREATE INDEX "SupplierPayout_customerId_idx" ON finance."SupplierPayout"("customerId");
