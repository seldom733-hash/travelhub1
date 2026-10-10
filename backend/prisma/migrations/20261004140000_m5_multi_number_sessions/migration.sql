-- M5 multi-number: WhatsAppAccount становится многостроковым.
--   label     — человекочитаемое имя сессии в UI (null → phone / «Номер N»).
--   archivedAt — soft-archive номера: строка НЕ удаляется, каскад
--                (диалоги/сообщения/контакты onDelete: Cascade) не срабатывает —
--                история номера сохраняется по требованию владельца.
-- Существующая v1-строка становится «первым активным» (primary) аккаунтом:
-- legacy-эндпоинты /whatsapp/status|qr|connect|... адресуют её.
--
-- Idempotent: safe to re-apply (IF NOT EXISTS).

ALTER TABLE "whatsapp"."WhatsAppAccount" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "whatsapp"."WhatsAppAccount" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
