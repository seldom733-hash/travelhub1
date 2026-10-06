-- Supplier Markup (SUPPLIER_MARKUP_IMPLEMENTATION_DESIGN §3 / STRICT PROMPT §6, Phase 1):
-- MarkupRule (MKR-*) — master data наценки платформы на supplier live price.
-- ОТДЕЛЬНАЯ концепция от finance.CommissionPolicy (Gate B): наценка ≠ seller
-- commission; CommissionPolicy НЕ изменяется.
--
-- 1) finance.MarkupRuleStatus enum: DRAFT → ACTIVE → ARCHIVED (CAS).
-- 2) finance.MarkupRule: matching key supplierCode + serviceType (строки —
--    registry SSOT SupplierAdapterRegistry + FlightSupplierRegistry; новый
--    supplier/service расширяет матрицу БЕЗ миграции, Gate A). rate —
--    десятичная доля 0 ≤ rate < 1 (0.05 = 5%), DECIMAL(18,6); явный 0 валиден
--    и отличим от NOT_CONFIGURED (нет активной rule → runtime 0%). version
--    server-owned (+1 draft-итерация, expectedVersion → stale-update 409);
--    effectiveFrom/effectiveTo — окно [from, to); ≤1 ACTIVE с пересекающимся
--    окном на key — service-level pg_advisory_xact_lock
--    ('markup-rule:'||supplierCode||':'||serviceType) + overlap-проверка.
-- 3) finance.MarkupRuleHistory: audit + state snapshot на версию (frozen
--    snapshot в Request воспроизводится по (code, version) без live lookup).
--
-- Аддитивная миграция: 0 существующих строк, 0 изменения CommissionPolicy.

CREATE TYPE "finance"."MarkupRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "finance"."MarkupRule" (
  "id"            TEXT          NOT NULL,
  "code"          TEXT          NOT NULL,
  "supplierCode"  TEXT          NOT NULL,
  "serviceType"   TEXT          NOT NULL,
  "rate"          DECIMAL(18,6) NOT NULL,
  "status"        "finance"."MarkupRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "version"       INTEGER       NOT NULL DEFAULT 1,
  "effectiveFrom" TIMESTAMP(3)  NOT NULL,
  "effectiveTo"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "MarkupRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarkupRule_code_key" ON "finance"."MarkupRule"("code");
CREATE INDEX "MarkupRule_supplierCode_serviceType_status_idx" ON "finance"."MarkupRule"("supplierCode", "serviceType", "status");
CREATE INDEX "MarkupRule_effectiveFrom_idx" ON "finance"."MarkupRule"("effectiveFrom");

CREATE TABLE "finance"."MarkupRuleHistory" (
  "id"        TEXT         NOT NULL,
  "ruleId"    TEXT         NOT NULL,
  "action"    TEXT         NOT NULL,
  "version"   INTEGER      NOT NULL,
  "fields"    JSONB,
  "actorId"   TEXT,
  "actorName" TEXT,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarkupRuleHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarkupRuleHistory_ruleId_idx" ON "finance"."MarkupRuleHistory"("ruleId");

ALTER TABLE "finance"."MarkupRuleHistory"
  ADD CONSTRAINT "MarkupRuleHistory_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "finance"."MarkupRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
