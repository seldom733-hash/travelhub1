-- M3 «WhatsApp Inbound & Chat» (промпт M3 §4/§6/§7):
-- 1) WhatsAppConversation — минимальный связующий слой истории (§4);
--    CommunicationThread остаётся pre-sale (buyerRequestId NOT NULL) и
--    для WhatsApp НЕ используется (не ломаем существующую архитектуру).
-- 2) WhatsAppInboundMessage: поля §6 (text/messageType/canonicalPhone/
--    processingStatus/matchingStatus) + conversationId.
-- 3) WhatsAppOutboundMessage.conversationId — вкладка исходящего в историю.
-- 4) §7: канонический dedup-ключ (accountId, providerMessageId) вместо
--    составного (accountId, remoteJid, fromMe, providerMessageId).
--
-- Idempotent: safe to re-apply. Применяется через `prisma migrate deploy`
-- (как M1/M2); pre-existing dev-DB drift (PartnerActiveCategory/RoomView/
-- RoomType.aliases) намеренно вне scope — см. gate report M1/M3.

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE "whatsapp"."WhatsAppMatchingStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'AMBIGUOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "whatsapp"."WhatsAppInboundProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. WhatsAppConversation (якорь: (accountId, remoteJid); бизнес-контекст
--    Booking→Order→Request→Customer резолвится на лету и не хранится).
CREATE TABLE IF NOT EXISTS "whatsapp"."WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "canonicalPhone" TEXT,
    "customerId" TEXT,
    "matchingStatus" "whatsapp"."WhatsAppMatchingStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- 3. WhatsAppInboundMessage: M3 §6
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "text" TEXT;
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "messageType" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "canonicalPhone" TEXT;
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "processingStatus" "whatsapp"."WhatsAppInboundProcessingStatus" NOT NULL DEFAULT 'RECEIVED';
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "matchingStatus" "whatsapp"."WhatsAppMatchingStatus" NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

-- 4. WhatsAppOutboundMessage: вкладка исходящего в общую историю
ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

-- 5. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_accountId_remoteJid_key" ON "whatsapp"."WhatsAppConversation"("accountId", "remoteJid");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_matchingStatus_idx" ON "whatsapp"."WhatsAppConversation"("matchingStatus");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_customerId_idx" ON "whatsapp"."WhatsAppConversation"("customerId");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_canonicalPhone_idx" ON "whatsapp"."WhatsAppConversation"("canonicalPhone");

CREATE INDEX IF NOT EXISTS "WhatsAppInboundMessage_conversationId_idx" ON "whatsapp"."WhatsAppInboundMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboundMessage_conversationId_idx" ON "whatsapp"."WhatsAppOutboundMessage"("conversationId");

-- §7: канонический dedup-ключ. Таблицы пустые в prod (M3 ещё не выпущен) —
-- замена составного ключа безопасна.
DROP INDEX IF EXISTS "whatsapp"."WhatsAppInboundMessage_accountId_remoteJid_fromMe_providerM_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInboundMessage_accountId_providerMessageId_key" ON "whatsapp"."WhatsAppInboundMessage"("accountId", "providerMessageId");

-- 6. FK (внутри схемы whatsapp)
DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "whatsapp"."WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "whatsapp"."WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD CONSTRAINT "WhatsAppOutboundMessage_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "whatsapp"."WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
