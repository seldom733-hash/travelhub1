-- M4.1 identity foundation (ADR-0016 phone-first Customer identity).
--
-- security.User: loginPhone (canonical E.164, nullable, unique) — новый primary
--   login identity; username остаётся legacy compatibility. country — ISO-code
--   registration attribute. Nullable-колонки: существующие строки получают NULL
--   (backfill — отдельная явная команда; phone не выдумывается).
-- crm.Customer: phoneCanonical (canonical E.164 из phone) + index.
--   НЕ unique: инспекция dev-данных показала 2 группы дубликатов канонического
--   телефона (тестовые) — partial-unique упал бы; AMBIGUOUS обрабатывает
--   resolver, constraint отложен до M4.6 (решение владельца, ADR-0016 §2.3).
-- Детерминировано, идемпотентно (IF NOT EXISTS), без уничтожения данных.

-- 1. security.User
ALTER TABLE "security"."User" ADD COLUMN IF NOT EXISTS "loginPhone" TEXT;
ALTER TABLE "security"."User" ADD COLUMN IF NOT EXISTS "country" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_loginPhone_key" ON "security"."User"("loginPhone");

-- 2. crm.Customer
ALTER TABLE "crm"."Customer" ADD COLUMN IF NOT EXISTS "phoneCanonical" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_phoneCanonical_idx" ON "crm"."Customer"("phoneCanonical");
