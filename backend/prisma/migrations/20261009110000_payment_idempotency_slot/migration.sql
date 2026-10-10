-- MULTI/PARTIAL §13 (2.12H crash window 3): бизнес-идемпотентность payment.create
-- на уровне идемпотентного слота. Раньше её давал снятый частичный unique
-- "Payment_one_active_per_order" (один активный платёж на Order ⇒ повтор того же
-- create request не мог создать дубль). С multi/partial cardinality этот механизм
-- неприменим (разные легальные платежи на один Order — норма), поэтому связка
-- "Idempotency-Key слот → Payment" выносится в отдельный server-owned ключ:
--   * тот же create request (stale-crash re-execution) → тот же Payment, без дубля;
--   * другой Idempotency-Key → NULL-свойство уникальности не мешает → новый платёж.
ALTER TABLE "finance"."Payment" ADD COLUMN "idempotencySlotKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencySlotKey_key" ON "finance"."Payment"("idempotencySlotKey");
