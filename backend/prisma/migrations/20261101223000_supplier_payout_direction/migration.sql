ALTER TABLE finance."SupplierPayout"
ADD COLUMN "direction" text NOT NULL DEFAULT 'OUTGOING';

CREATE INDEX "SupplierPayout_direction_idx" ON finance."SupplierPayout"("direction");
