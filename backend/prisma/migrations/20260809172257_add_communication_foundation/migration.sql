-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "communication";

-- CreateEnum
CREATE TYPE "communication"."CommunicationType" AS ENUM ('MESSAGE', 'NOTE');

-- CreateEnum
CREATE TYPE "communication"."CommunicationChannel" AS ENUM ('PLATFORM');

-- CreateEnum
CREATE TYPE "communication"."CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "communication"."CommunicationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "communication"."CommunicationContextType" AS ENUM ('CUSTOMER', 'PARTNER', 'ORDER', 'BOOKING');

-- CreateEnum
CREATE TYPE "communication"."CommunicationParticipantType" AS ENUM ('USER', 'CUSTOMER', 'PARTNER', 'SYSTEM');

-- CreateTable
CREATE TABLE "communication"."Communication" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "communication"."CommunicationType" NOT NULL,
    "channel" "communication"."CommunicationChannel" NOT NULL DEFAULT 'PLATFORM',
    "direction" "communication"."CommunicationDirection" NOT NULL,
    "status" "communication"."CommunicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "contextType" "communication"."CommunicationContextType",
    "contextId" TEXT,
    "actorUserId" TEXT,
    "senderType" "communication"."CommunicationParticipantType",
    "senderId" TEXT,
    "recipientType" "communication"."CommunicationParticipantType",
    "recipientId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Communication_code_key" ON "communication"."Communication"("code");

-- CreateIndex
CREATE INDEX "Communication_contextType_contextId_idx" ON "communication"."Communication"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "Communication_occurredAt_idx" ON "communication"."Communication"("occurredAt");

-- CreateIndex
CREATE INDEX "Communication_direction_status_idx" ON "communication"."Communication"("direction", "status");
