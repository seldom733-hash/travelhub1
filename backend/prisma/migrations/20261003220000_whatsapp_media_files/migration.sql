ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "mediaFilename" TEXT;
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "mediaMime" TEXT;
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "mediaSize" INTEGER;
ALTER TABLE "whatsapp"."WhatsAppInboundMessage" ADD COLUMN IF NOT EXISTS "mediaPath" TEXT;
ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD COLUMN IF NOT EXISTS "mediaFilename" TEXT;
ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD COLUMN IF NOT EXISTS "mediaMime" TEXT;
ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD COLUMN IF NOT EXISTS "mediaSize" INTEGER;
ALTER TABLE "whatsapp"."WhatsAppOutboundMessage" ADD COLUMN IF NOT EXISTS "mediaPath" TEXT;