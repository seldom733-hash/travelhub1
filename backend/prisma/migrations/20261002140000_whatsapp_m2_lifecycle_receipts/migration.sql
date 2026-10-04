-- M2 «Real WhatsApp Provider / Session Foundation».
--
-- 1) WhatsAppConnectionState: явный терминал удалённого logout (решение
--    владельца M2: lifecycle DISCONNECTED/CONNECTING/QR/CONNECTED/LOGGED_OUT/
--    ERROR); до M2 удалённый loggedOut подменялся бы DISCONNECTED.
-- 2) WhatsAppOutboundMessage: фактические receipt-отметки. Для строк в
--    UNKNOWN колонки служат EVIDENCE для явного Reconcile (решение №5):
--    статус НЕ меняется автоматически по receipt.
--
-- Idempotent (пере-применимо): ALTER TYPE ... ADD VALUE IF NOT EXISTS (PG12+,
-- в транзакции разрешено), ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

ALTER TYPE "whatsapp"."WhatsAppConnectionState" ADD VALUE IF NOT EXISTS 'LOGGED_OUT';

ALTER TABLE "whatsapp"."WhatsAppOutboundMessage"
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
