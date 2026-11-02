CREATE TABLE "finance"."PaymentWebhookEvent" (
  "id" text NOT NULL,
  "eventId" text NOT NULL,
  "provider" text NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "finance"."PaymentWebhookEvent"("eventId");
