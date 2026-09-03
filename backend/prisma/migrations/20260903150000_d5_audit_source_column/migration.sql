-- D5-R1: Add structured audit source column to OrderHistory.
-- Legacy rows receive DEFAULT 'API'; new rows must specify source explicitly.
ALTER TABLE "order"."OrderHistory" ADD COLUMN "source" TEXT DEFAULT 'API';
