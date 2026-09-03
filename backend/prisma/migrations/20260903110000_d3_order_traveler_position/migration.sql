-- D3 §13: deterministic OrderTraveler ordering (stable multi-traveler collection UI).
-- OrderTraveler has no createdAt; without position the view order is unstable
-- (PostgreSQL does not guarantee row order), which breaks save/resume identity
-- mapping in the multi-traveler panel.
ALTER TABLE "order"."OrderTraveler" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
