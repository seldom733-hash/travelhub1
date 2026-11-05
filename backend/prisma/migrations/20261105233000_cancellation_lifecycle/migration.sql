ALTER TYPE "order"."OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_REQUESTED';
ALTER TYPE "order"."OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_APPROVED';

ALTER TABLE "order"."Order"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancellationComment" TEXT,
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "cancellationRequestedById" TEXT,
ADD COLUMN "cancellationApprovedAt" TIMESTAMP(3),
ADD COLUMN "cancellationApprovedById" TEXT;
