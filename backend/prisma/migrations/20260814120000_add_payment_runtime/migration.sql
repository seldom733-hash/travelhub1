-- PHASE 2 STEP 2.12 — Payment Flow (provider-neutral Payment runtime).
-- 1) Payment lifecycle milestones (2.10C DEFER → 2.12): paidAt (success,
--    PENDING → CAPTURED), failedAt (PENDING → FAILED), cancelledAt
--    (PENDING → CANCELLED). authorizedAt/capturedAt — DEFER (2.12B, PSP).
--    Additive nullable; NULL = milestone ещё не произошёл; БЕЗ backfill.
-- 2) Partial unique index по managed boolean isActivePayment: ≤1 активный
--    Payment на Order (паттерн ModerationSubmission.isActiveSubmission).
--    isActivePayment=true для PENDING/AUTHORIZED/CAPTURED/REFUNDED (overpayment
--    protection), false для FAILED/CANCELLED (повторная инициация легальна).
--    Server-owned, устанавливается атомарно с CAS-переходом статуса
--    (PaymentService — единственный writer). Детерминизм concurrent duplicate
--    create (P2002 → controlled 409, один факт). 2.12F (partial/installments)
--    переработает этот индекс в своей аддитивной миграции — будущие approved
--    semantics не блокируются (Prompt §6).
-- 3) PaymentHistory — audit by default (как QuoteHistory/SaleHistory).
ALTER TABLE "finance"."Payment" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "finance"."Payment" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "finance"."Payment" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "finance"."Payment" ADD COLUMN "isActivePayment" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Payment_one_active_per_order"
  ON "finance"."Payment"("orderId")
  WHERE "isActivePayment" = true;

CREATE TABLE "finance"."PaymentHistory" (
  "id"        TEXT        NOT NULL,
  "paymentId" TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "from"      TEXT,
  "to"        TEXT,
  "actorId"   TEXT,
  "actorName" TEXT,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentHistory_paymentId_idx" ON "finance"."PaymentHistory"("paymentId");

-- FK внутри схемы finance.* (PaymentHistory → Payment) — как остальные
-- history-модели (QuoteHistory → Quote и т.п.), onDelete Cascade.
ALTER TABLE "finance"."PaymentHistory"
  ADD CONSTRAINT "PaymentHistory_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "finance"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
