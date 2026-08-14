-- PHASE 2 STEP 2.13 — Refund Flow (provider-neutral Refund runtime).
-- 1) Refund lifecycle milestones (2.10C DEFER → 2.13): requestedAt (creation,
--    status REQUESTED), approvedAt (REQUESTED → APPROVED), processedAt
--    (APPROVED → PROCESSED, деньги возвращены), failedAt (REQUESTED|APPROVED
--    → FAILED). Additive nullable; NULL = milestone ещё не произошёл; БЕЗ
--    backfill (Refund-таблица пуста: schema-only foundation, 0 writer-ов).
-- 2) Partial unique index по managed boolean isActiveRefund: ≤1 НЕ-FAILED
--    Refund на (paymentId, amount) — idempotency slot «identical retry →
--    существующий факт; attempt 2 после FAILED легален» (паттерн
--    Payment.isActivePayment / ModerationSubmission.isActiveSubmission).
--    isActiveRefund=true для REQUESTED/APPROVED/PROCESSED (защита от двойного
--    refund при network retry — второй идентичный частичный refund блокируется
--    conservative), false ТОЛЬКО для FAILED. Server-owned, атомарно с CAS.
--    Различные суммы — независимые partial refunds (key = paymentId + amount).
--    Concurrent duplicate create → P2002 → controlled 409, один факт.
--    Future: несколько одинаковых частичных refund-ов (если business потребует)
--    — аддитивная переработка ключа (2.13+/2.14+), НЕ блокирует partial semantics.
-- 3) RefundHistory — audit by default (как PaymentHistory/QuoteHistory).
-- 4) Order.refundedAmount — Order-owned projection суммы возвратов (additive,
--    DEFAULT 0 как paidAmount; paidAmount — исторический факт НЕ меняется).
ALTER TABLE "finance"."Refund" ADD COLUMN "requestedAt" TIMESTAMP(3);
ALTER TABLE "finance"."Refund" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "finance"."Refund" ADD COLUMN "processedAt" TIMESTAMP(3);
ALTER TABLE "finance"."Refund" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "finance"."Refund" ADD COLUMN "isActiveRefund" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Refund_one_active_per_payment_amount"
  ON "finance"."Refund"("paymentId", "amount")
  WHERE "isActiveRefund" = true;

CREATE TABLE "finance"."RefundHistory" (
  "id"        TEXT        NOT NULL,
  "refundId"  TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "from"      TEXT,
  "to"        TEXT,
  "actorId"   TEXT,
  "actorName" TEXT,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundHistory_refundId_idx" ON "finance"."RefundHistory"("refundId");

-- FK внутри схемы finance.* (RefundHistory → Refund) — как PaymentHistory,
-- onDelete Cascade.
ALTER TABLE "finance"."RefundHistory"
  ADD CONSTRAINT "RefundHistory_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "finance"."Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order"."Order" ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
