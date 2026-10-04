-- M1 «Фундамент» интеграции WhatsApp (мастер-промпт v2.3, ADR M0-02):
-- схема whatsapp.* + таблицы provider/session metadata + WHATSAPP в
-- CommunicationChannel. Никаких business-доменов и никакого текста
-- сообщений (правило I2). Фича выключена по умолчанию (WHATSAPP_ENABLED=false).
--
-- Idempotent: safe to re-apply (IF NOT EXISTS / ADD VALUE IF NOT EXISTS).
-- Источник генерации: prisma migrate diff --from-config-datasource
--   --to-schema prisma/schema.prisma (только whatsapp-часть; чужой дрейф
--   dev-БД — PartnerActiveCategory/RoomView/RoomType.aliases/geo index —
--   сюда НЕ включён, он вне scope M1 и задокументирован в gate report).

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS "whatsapp";

-- 2. Enums (PG не поддерживает CREATE TYPE IF NOT EXISTS → DO-блоки,
--    как в 20260831220000_security_schema_drift_remediation)
DO $$ BEGIN
    CREATE TYPE "whatsapp"."WhatsAppConnectionState" AS ENUM (
        'DISCONNECTED', 'INITIALIZING', 'QR_REQUIRED', 'CONNECTING',
        'CONNECTED', 'RECONNECTING', 'ERROR', 'LOGGING_OUT'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "whatsapp"."WhatsAppOutboundStatus" AS ENUM (
        'CREATED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ',
        'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'UNKNOWN'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "whatsapp"."WhatsAppContactLinkSource" AS ENUM ('AUTO', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. CommunicationChannel: WHATSAPP (транспорт объявляется, когда он реально
-- подключён — см. комментарий в schema.prisma). PG >= 12: ADD VALUE в
-- транзакции допустим (новое значение не используется до конца txn).
ALTER TYPE "communication"."CommunicationChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';

-- 4. WhatsAppAccount (v1: одна platform-строка, dedicated number)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'baileys',
    "state" "whatsapp"."WhatsAppConnectionState" NOT NULL DEFAULT 'DISCONNECTED',
    "phone" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- 5. WhatsAppContact (D3: jid ↔ Customer, LID/PN provider-neutral)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppContact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "lid" TEXT,
    "canonicalPhone" TEXT,
    "customerId" TEXT,
    "linkSource" "whatsapp"."WhatsAppContactLinkSource" NOT NULL DEFAULT 'AUTO',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- 6. WhatsAppInboundMessage (D7: inbound dedup)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppInboundMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "participant" TEXT,
    "lid" TEXT,
    "senderPn" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "communicationId" TEXT,

    CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

-- 7. WhatsAppOutboundMessage (D6/D7, M0-05: integration lifecycle)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppOutboundMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "recipientJid" TEXT,
    "recipientPhone" TEXT,
    "status" "whatsapp"."WhatsAppOutboundStatus" NOT NULL DEFAULT 'CREATED',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "fencingToken" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppOutboundMessage_pkey" PRIMARY KEY ("id")
);

-- 8. WhatsAppSessionLease (D2/I13: single-owner + fencing token)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppSessionLease" (
    "key" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "fencingToken" INTEGER NOT NULL DEFAULT 1,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSessionLease_pkey" PRIMARY KEY ("key")
);

-- 9. WhatsAppSuppression (D9: opt-out по каноническому телефону)
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppSuppression" (
    "id" TEXT NOT NULL,
    "canonicalPhone" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppSuppression_pkey" PRIMARY KEY ("id")
);

-- 10. Indexes
CREATE INDEX IF NOT EXISTS "WhatsAppContact_canonicalPhone_idx" ON "whatsapp"."WhatsAppContact"("canonicalPhone");
CREATE INDEX IF NOT EXISTS "WhatsAppContact_customerId_idx" ON "whatsapp"."WhatsAppContact"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppContact_accountId_jid_key" ON "whatsapp"."WhatsAppContact"("accountId", "jid");

CREATE INDEX IF NOT EXISTS "WhatsAppInboundMessage_providerMessageId_idx" ON "whatsapp"."WhatsAppInboundMessage"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppInboundMessage_communicationId_idx" ON "whatsapp"."WhatsAppInboundMessage"("communicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInboundMessage_accountId_remoteJid_fromMe_providerM_key" ON "whatsapp"."WhatsAppInboundMessage"("accountId", "remoteJid", "fromMe", "providerMessageId");

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboundMessage_communicationId_key" ON "whatsapp"."WhatsAppOutboundMessage"("communicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboundMessage_operationKey_key" ON "whatsapp"."WhatsAppOutboundMessage"("operationKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboundMessage_providerMessageId_key" ON "whatsapp"."WhatsAppOutboundMessage"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboundMessage_status_nextAttemptAt_idx" ON "whatsapp"."WhatsAppOutboundMessage"("status", "nextAttemptAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSuppression_canonicalPhone_key" ON "whatsapp"."WhatsAppSuppression"("canonicalPhone");

-- 11. FK (внутри схемы whatsapp — каскадные удаления аккаунта)
DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "whatsapp"."WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "whatsapp"."WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD CONSTRAINT "WhatsAppOutboundMessage_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "whatsapp"."WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
