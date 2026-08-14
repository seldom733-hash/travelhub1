-- PHASE 2 STEP 2.11 — Pricing & Financial Snapshot: Booking.currency.
-- Frozen money fact: валюта, скопированная consumer-ом verbatim из
-- OrderItem.currency при создании Booking. Без валюты сумма amount не имеет
-- однозначной денежной семантики.
-- Additive + nullable: NULL = legacy Booking (до 2.11, валюта не
-- фиксировалась). БЕЗ backfill: валюта исторических броней неизвестна/не
-- доказана — честный NULL, не выдуманное значение.
ALTER TABLE "booking"."Booking" ADD COLUMN "currency" TEXT;
