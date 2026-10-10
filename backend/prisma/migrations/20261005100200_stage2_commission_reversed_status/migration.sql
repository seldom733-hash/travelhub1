-- Stage 2 (Booking → Order, Q8): CommissionReversed — новый статус для
-- Commission/CommissionAccrual. CAS-переход ТОЛЬКО из ACCRUED; INVOICED/PAID/
-- COLLECTED не трогаются (никакого молчаливого ledger rewrite — факт фиксируется
-- событием CommissionReversed).
--
-- PG12+: ALTER TYPE ADD VALUE разрешён внутри транзакции (значение не
-- используется в том же транзакции). IF NOT EXISTS — идемпотентно.

ALTER TYPE "finance"."CommissionStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
ALTER TYPE "finance"."CommissionAccrualStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
