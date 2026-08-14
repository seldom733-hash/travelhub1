-- PHASE 2 STEP 2.13A — Chargeback / Dispute Foundation (provider-neutral).
-- 1) DisputeStatus enum: OPENED → RESOLVED | CANCELLED (минимальный честный
--    provider-neutral lifecycle; won/lost liability-исход и PSP-статусы —
--    deferred 2.12A/2.12B/2.12D/2.12C/2.14A).
-- 2) finance.Dispute: immutable frozen money snapshot (amount/currency verbatim
--    из CAPTURED Payment), milestones openedAt/resolvedAt/cancelledAt
--    (server-owned UTC, first-only, атомарны с CAS), isActiveDispute —
--    idempotency slot «один активный Dispute на Payment» (паттерн
--    Payment.isActivePayment / Refund.isActiveRefund).
-- 3) Partial unique index по managed boolean isActiveDispute: ≤1 активный
--    Dispute на Payment; RESOLVED/CANCELLED освобождают слот (повторное
--    открытие после терминального состояния легально). Concurrent duplicate
--    → P2002 → controlled 409, один факт.
-- 4) DisputeHistory — audit by default (как PaymentHistory/RefundHistory).
-- Аддитивная, без backfill (таблица новая, 0 legacy-строк). Никаких
-- PSP/webhook/ledger/commission/settlement-колонок (boundaries 2.12A–G/2.14+).
CREATE TYPE "finance"."DisputeStatus" AS ENUM ('OPENED', 'RESOLVED', 'CANCELLED');

CREATE TABLE "finance"."Dispute" (
  "id"              TEXT          NOT NULL,
  "code"            TEXT          NOT NULL,
  "paymentId"       TEXT          NOT NULL,
  "orderId"         TEXT          NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "currency"        TEXT          NOT NULL DEFAULT 'USD',
  "status"          "finance"."DisputeStatus" NOT NULL DEFAULT 'OPENED',
  "reason"          TEXT,
  "version"         INTEGER       NOT NULL DEFAULT 1,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,
  "openedAt"        TIMESTAMP(3),
  "resolvedAt"      TIMESTAMP(3),
  "cancelledAt"     TIMESTAMP(3),
  "isActiveDispute" BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dispute_code_key" ON "finance"."Dispute"("code");
CREATE UNIQUE INDEX "Dispute_one_active_per_payment"
  ON "finance"."Dispute"("paymentId")
  WHERE "isActiveDispute" = true;
CREATE INDEX "Dispute_paymentId_idx" ON "finance"."Dispute"("paymentId");
CREATE INDEX "Dispute_orderId_idx" ON "finance"."Dispute"("orderId");
CREATE INDEX "Dispute_status_idx" ON "finance"."Dispute"("status");

CREATE TABLE "finance"."DisputeHistory" (
  "id"        TEXT         NOT NULL,
  "disputeId" TEXT         NOT NULL,
  "action"    TEXT         NOT NULL,
  "from"      TEXT,
  "to"        TEXT,
  "actorId"   TEXT,
  "actorName" TEXT,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisputeHistory_disputeId_idx" ON "finance"."DisputeHistory"("disputeId");

ALTER TABLE "finance"."DisputeHistory"
  ADD CONSTRAINT "DisputeHistory_disputeId_fkey"
  FOREIGN KEY ("disputeId") REFERENCES "finance"."Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
