-- CreateRequestStatus enum
CREATE TYPE "order"."RequestStatus" AS ENUM (
  'NEW', 'CHECKING', 'SUPPLIER_TIMEOUT', 'PRICE_CHANGED',
  'CUSTOMER_ACCEPTED', 'CONFIRMED', 'CONVERTED', 'REJECTED',
  'UNAVAILABLE', 'EXPIRED', 'CUSTOMER_PAYMENT_TIMEOUT', 'CANCELLED_BY_CUSTOMER'
);

-- Create Request table
CREATE TABLE "order"."Request" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commerceSequence" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "partnerId" TEXT,
    "status" "order"."RequestStatus" NOT NULL DEFAULT 'NEW',
    "requestedServiceDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "displayedPrice" DECIMAL(12,2),
    "displayedCurrency" TEXT,
    "confirmedPrice" DECIMAL(12,2),
    "confirmedCurrency" TEXT,
    "supplierResponseDeadline" TIMESTAMP(3),
    "supplierRespondedAt" TIMESTAMP(3),
    "supplierDecision" TEXT,
    "supplierPriceProposal" DECIMAL(12,2),
    "supplierNote" TEXT,
    "customerActionDeadline" TIMESTAMP(3),
    "customerAcceptedAt" TIMESTAMP(3),
    "customerDecision" TEXT,
    "convertedOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- Unique constraints on Request
CREATE UNIQUE INDEX "Request_code_key" ON "order"."Request"("code");
CREATE UNIQUE INDEX "Request_commerceSequence_key" ON "order"."Request"("commerceSequence");
CREATE UNIQUE INDEX "Request_referenceNumber_key" ON "order"."Request"("referenceNumber");

-- Indexes on Request
CREATE INDEX "Request_status_idx" ON "order"."Request"("status");
CREATE INDEX "Request_customerId_idx" ON "order"."Request"("customerId");
CREATE INDEX "Request_partnerId_idx" ON "order"."Request"("partnerId");
CREATE INDEX "Request_commerceSequence_idx" ON "order"."Request"("commerceSequence");

-- Create RequestHistory table
CREATE TABLE "order"."RequestHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestHistory_requestId_idx" ON "order"."RequestHistory"("requestId");

-- Add foreign key RequestHistory → Request
ALTER TABLE "order"."RequestHistory" ADD CONSTRAINT "RequestHistory_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "order"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add commerceSequence to Order (nullable for existing rows)
ALTER TABLE "order"."Order" ADD COLUMN "commerceSequence" TEXT;

-- Add unique + index on Order.commerceSequence (not unique: multiple Orders could theoretically share in future)
CREATE INDEX "Order_commerceSequence_idx" ON "order"."Order"("commerceSequence");

-- Add commerceSequence to Booking (nullable for existing rows)
ALTER TABLE "booking"."Booking" ADD COLUMN "commerceSequence" TEXT;

-- Add commerceSequence + paymentOrdinal to Payment (nullable for existing rows)
ALTER TABLE "finance"."Payment" ADD COLUMN "commerceSequence" TEXT;
ALTER TABLE "finance"."Payment" ADD COLUMN "paymentOrdinal" INTEGER;
