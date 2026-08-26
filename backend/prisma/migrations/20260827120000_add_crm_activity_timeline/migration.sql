-- CreateEnum
CREATE TYPE "crm"."CrmActivitySourceType" AS ENUM (
  'OPERATIONAL_NOTE',
  'ORDER',
  'BOOKING',
  'PAYMENT',
  'REFUND',
  'MESSAGE',
  'AUDIT_EVENT',
  'CUSTOMER_HISTORY',
  'BUYER_REQUEST',
  'PARTNER_APPLICATION'
);

-- CreateEnum
CREATE TYPE "crm"."CrmActivityActivityType" AS ENUM (
  'NOTE_CREATED',
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_CANCELLED',
  'BOOKING_CREATED',
  'BOOKING_STATUS_CHANGED',
  'BOOKING_COMPLETED',
  'PAYMENT_CREATED',
  'PAYMENT_CAPTURED',
  'REFUND_CREATED',
  'REFUND_PROCESSED',
  'MESSAGE_SENT',
  'AUDIT_CUSTOMER_CREATED',
  'AUDIT_CUSTOMER_STATUS_CHANGED',
  'AUDIT_PARTNER_APPROVED',
  'CUSTOMER_HISTORY_CREATED',
  'CUSTOMER_HISTORY_STATUS_CHANGED',
  'CUSTOMER_HISTORY_UPDATED',
  'BUYER_REQUEST_CREATED',
  'BUYER_REQUEST_SUBMITTED',
  'BUYER_REQUEST_CANCELLED',
  'PARTNER_APPLICATION_SUBMITTED',
  'PARTNER_APPLICATION_APPROVED',
  'PARTNER_APPLICATION_REJECTED'
);

-- CreateEnum
CREATE TYPE "crm"."CrmActivitySubjectType" AS ENUM (
  'CUSTOMER',
  'PARTNER'
);

-- CreateTable
CREATE TABLE "crm"."CrmActivity" (
    "id" TEXT NOT NULL,
    "sourceType" "crm"."CrmActivitySourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceEvent" TEXT NOT NULL,
    "activityType" "crm"."CrmActivityActivityType" NOT NULL,
    "subjectType" "crm"."CrmActivitySubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "customerId" TEXT,
    "partnerId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "deepLink" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmActivity_dedupe_key" ON "crm"."CrmActivity"("sourceType", "sourceId", "sourceEvent");

-- CreateIndex
CREATE INDEX "CrmActivity_customer_timeline" ON "crm"."CrmActivity"("customerId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "CrmActivity_partner_timeline" ON "crm"."CrmActivity"("partnerId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "CrmActivity_source_identity" ON "crm"."CrmActivity"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CrmActivity_activity_type_time" ON "crm"."CrmActivity"("activityType", "occurredAt");
