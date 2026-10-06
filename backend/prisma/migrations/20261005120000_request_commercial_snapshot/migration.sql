-- Supplier Markup (STRICT PROMPT phase 3, section 20): frozen commercial snapshot on Request.
-- Non-destructive: adds an optional JSON column. Working state (supplier price,
-- markup, public price, source, freshness) is written by the pricing boundary at
-- request creation and FROZEN at customerAccept. NULL = legacy/staff requests
-- without a supplier-priced basis.
ALTER TABLE "order"."Request" ADD COLUMN "commercialSnapshot" JSONB;
