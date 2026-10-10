-- M4.3 activation token mechanics (option B, ADR-0016 §19).
--
-- security.ActivationToken: single-use activation tokens.
--   - tokenHash = SHA-256(plaintext) — plaintext возвращается ОДИН раз в
--     ответе issue-endpoint и НИКОГДА не хранится/логируется;
--   - expiresAt — expiry mechanics (TTL задаётся при issue);
--   - usedAt — single-use (NULL = не использован);
--   - issuedBy — actor userId (audit; null = system).
-- Delivery (SMS/email/WhatsApp-ссылка) отложена: нет провайдера — нет
-- фиктивной доставки (§19: no fake SMS/email delivery).
-- Детерминировано, идемпотентно (IF NOT EXISTS), без уничтожения данных.

CREATE TABLE IF NOT EXISTS "security"."ActivationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "issuedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActivationToken_tokenHash_key" ON "security"."ActivationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ActivationToken_userId_idx" ON "security"."ActivationToken"("userId");
ALTER TABLE "security"."ActivationToken" ADD CONSTRAINT "ActivationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "security"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
