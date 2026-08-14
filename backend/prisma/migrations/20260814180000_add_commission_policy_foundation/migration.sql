-- PHASE 2 STEP 2.14E — Channel-Based Commission Rules Foundation (ADR-0013).
-- 1) CommissionChannel enum (D15): MARKETPLACE (V1 commission-capable);
--    PARTNER_STOREFRONT (SaaS no-commission, ADR-0006); DIRECT / BUYER_REQUEST
--    (no commission); CUSTOM_DOMAIN/API — deferred (Roadmap 2.5B), НЕ добавлены.
-- 2) CommissionRateType enum (D3): PERCENTAGE only (fixed/hybrid/tiered —
--    deferred, аддитивное расширение).
-- 3) CommissionPolicyStatus enum (D16): DRAFT → ACTIVE → ARCHIVED (CAS).
-- 4) finance.CommissionPolicy (CMP-*): Finance-owned mutable master data;
--    rate DECIMAL(18,6) десятичная доля (0.15 = 15%); effectiveFrom/effectiveTo
--    — селекция [from, to); version server-owned (инкремент на draft-итерацию);
--    overlap-инвариант (≤1 ACTIVE policy на channel в точке времени) —
--    service-level pg_advisory_xact_lock(hashtext('commission-policy:'||channel))
--    + resolver fail-closed backstop (AMBIGUOUS → no policy).
-- 5) finance.CommissionPolicyHistory — audit by default + ПОЛНЫЙ state snapshot
--    на версию (future frozen snapshot репродукция (code, version)).
-- Аддитивная, без backfill (новые таблицы, 0 legacy-строк). Создаёт 0
-- Commission/CommissionAccrual фактов (boundary §19). Никаких ledger/PSP/
-- settlement/payout/invoice-колонок (boundaries §20–§23).
CREATE TYPE "finance"."CommissionChannel" AS ENUM ('MARKETPLACE', 'PARTNER_STOREFRONT', 'DIRECT', 'BUYER_REQUEST');

CREATE TYPE "finance"."CommissionRateType" AS ENUM ('PERCENTAGE');

CREATE TYPE "finance"."CommissionPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "finance"."CommissionPolicy" (
  "id"            TEXT          NOT NULL,
  "code"          TEXT          NOT NULL,
  "channel"       "finance"."CommissionChannel" NOT NULL,
  "rateType"      "finance"."CommissionRateType" NOT NULL DEFAULT 'PERCENTAGE',
  "rate"          DECIMAL(18,6) NOT NULL,
  "status"        "finance"."CommissionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "version"       INTEGER       NOT NULL DEFAULT 1,
  "effectiveFrom" TIMESTAMP(3)  NOT NULL,
  "effectiveTo"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommissionPolicy_code_key" ON "finance"."CommissionPolicy"("code");
CREATE INDEX "CommissionPolicy_channel_status_idx" ON "finance"."CommissionPolicy"("channel", "status");
CREATE INDEX "CommissionPolicy_effectiveFrom_idx" ON "finance"."CommissionPolicy"("effectiveFrom");

CREATE TABLE "finance"."CommissionPolicyHistory" (
  "id"        TEXT         NOT NULL,
  "policyId"  TEXT         NOT NULL,
  "action"    TEXT         NOT NULL,
  "version"   INTEGER      NOT NULL,
  "fields"    JSONB,
  "actorId"   TEXT,
  "actorName" TEXT,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionPolicyHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionPolicyHistory_policyId_idx" ON "finance"."CommissionPolicyHistory"("policyId");

ALTER TABLE "finance"."CommissionPolicyHistory"
  ADD CONSTRAINT "CommissionPolicyHistory_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "finance"."CommissionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
