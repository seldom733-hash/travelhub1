-- PHASE 2 STEP 2.12E — PARTNER_COLLECT / Commission Accrual Foundation (ADR-0013).
-- Аддитивная миграция, 0 backfill, 0 destructive ALTER.
--
-- 1) Frozen commission snapshot chain (ADR-0013 D7): аддитивный nullable
--    `commissionSnapshot Json?` на Quote / CheckoutIntent / Sale / Order —
--    {policyCode, policyVersion, rateType, rate, baseAmount, baseCurrency,
--     channel, sellerPartnerId, selectedAt, roundingContractVersion}, verbatim
--    Quote ISSUE → Checkout → Sale → Order. NULL = нет commission-контекста
--    (no-commission канал / NO_POLICY fail-closed / legacy) — без backfill.
-- 2) Order.sellerPartnerId (ADR-0013 D14): аддитивная nullable колонка —
--    frozen seller attribution (snapshot-at-event); NULL = multi-seller/
--    отсутствие seller → 0 commission-фактов (fail-closed).
-- 3) Commission (ADR-0013 D9): + collectionModel enum (V1 PARTNER_COLLECT;
--    SPLIT_AT_PAYMENT — 2.12C аддитивно) + @@unique([orderId]) — один earned-
--    факт на Order (idempotency DB backstop). Таблица пуста (schema-only).
-- 4) CommissionAccrual (ADR-0013 D9): + sourceCommissionId (unique — один
--    receivable на Commission-факт) + accruedAt (2.10C DEFER → 2.12E,
--    сервер-owned время признания на Order creation). Таблица пуста.
-- 5) Enum CommissionCollectionModel {PARTNER_COLLECT} (SPLIT_AT_PAYMENT — 2.12C).
-- 0 Commission/CommissionAccrual фактов создаётся миграцией; 0 ledger/PSP/
-- settlement/payout/invoice side effects (boundaries 2.12D/2.12C/2.14).
CREATE TYPE "finance"."CommissionCollectionModel" AS ENUM ('PARTNER_COLLECT');

-- Frozen commission snapshot chain (nullable-first, additive)
ALTER TABLE "order"."Order" ADD COLUMN "sellerPartnerId" TEXT;
ALTER TABLE "order"."Order" ADD COLUMN "commissionSnapshot" JSONB;
ALTER TABLE "sales"."Quote" ADD COLUMN "commissionSnapshot" JSONB;
ALTER TABLE "sales"."CheckoutIntent" ADD COLUMN "commissionSnapshot" JSONB;
ALTER TABLE "sales"."Sale" ADD COLUMN "commissionSnapshot" JSONB;

CREATE INDEX "Order_sellerPartnerId_idx" ON "order"."Order"("sellerPartnerId");

-- Commission: collection-модель + один факт на Order (empty table — additive)
ALTER TABLE "finance"."Commission" ADD COLUMN "collectionModel" "finance"."CommissionCollectionModel" NOT NULL DEFAULT 'PARTNER_COLLECT';
CREATE UNIQUE INDEX "Commission_orderId_key" ON "finance"."Commission"("orderId");

-- CommissionAccrual: source-ссылка + время признания (empty table — additive)
ALTER TABLE "finance"."CommissionAccrual" ADD COLUMN "sourceCommissionId" TEXT;
ALTER TABLE "finance"."CommissionAccrual" ADD COLUMN "accruedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "CommissionAccrual_sourceCommissionId_key" ON "finance"."CommissionAccrual"("sourceCommissionId");
