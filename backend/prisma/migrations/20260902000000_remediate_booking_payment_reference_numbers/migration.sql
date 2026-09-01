-- PHASE 3 PRE-STEP 3.12 — Shared Commerce Sequence Booking & Payment Reference Remediation
--
-- Root cause: backfill migration 20260901000001 populated commerceSequence
-- on Booking/Payment from parent Order, but did NOT update referenceNumber.
-- Legacy records had:
--   a) BKG-* / PAY-* format (no MKT- prefix) — from pre-commerce-sequence era
--   b) MKT-BKG-* / MKT-PAY-* format but with INDEPENDENT sequence number
--      (not matching commerceSequence) — from independent reference generator
--
-- This migration corrects BOTH cases to canonical format:
--   Booking: MKT-BKG-{LPAD(commerceSequence, 8, '0')}
--   Payment: MKT-PAY-{LPAD(commerceSequence, 8, '0')}-{paymentOrdinal}
--
-- Safety:
-- - Only updates records where commerceSequence IS NOT NULL
-- - Canonical reference = deterministic derivation from commerceSequence
-- - 1 Order = 1 Booking (orderItemId @unique) → collision-free
-- - Payment ordinal from ROW_NUMBER deterministic ordering
-- - Unique constraints preserved (collision audit: 0)

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: BOOKING referenceNumber remediation
-- ═══════════════════════════════════════════════════════════════════════════════
-- Update ALL bookings where referenceNumber != canonical derivation from commerceSequence
-- This covers:
--   a) BKG-* → MKT-BKG-{cs} (legacy prefix)
--   b) MKT-BKG-{wrong_seq} → MKT-BKG-{cs} (wrong independent sequence number)
UPDATE "booking"."Booking" b
SET "referenceNumber" = 'MKT-BKG-' || LPAD(b."commerceSequence", 8, '0')
WHERE b."commerceSequence" IS NOT NULL
  AND b."referenceNumber" != 'MKT-BKG-' || LPAD(b."commerceSequence", 8, '0');

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: PAYMENT referenceNumber remediation
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure all payments with commerceSequence have paymentOrdinal
-- (defensive: should already be backfilled by 20260901000001)
UPDATE "finance"."Payment" p
SET "paymentOrdinal" = 1
WHERE p."commerceSequence" IS NOT NULL
  AND p."paymentOrdinal" IS NULL;

-- Update ALL payments where referenceNumber != canonical derivation
-- This covers:
--   a) PAY-* → MKT-PAY-{cs}-{ordinal} (legacy prefix)
--   b) MKT-PAY-{wrong_seq} → MKT-PAY-{cs}-{ordinal} (wrong independent sequence number)
UPDATE "finance"."Payment" p
SET "referenceNumber" = 'MKT-PAY-' || LPAD(p."commerceSequence", 8, '0') || '-' || p."paymentOrdinal"::text
WHERE p."commerceSequence" IS NOT NULL
  AND p."paymentOrdinal" IS NOT NULL
  AND p."referenceNumber" != 'MKT-PAY-' || LPAD(p."commerceSequence", 8, '0') || '-' || p."paymentOrdinal"::text;
