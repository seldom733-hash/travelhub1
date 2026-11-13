ALTER TABLE "catalog"."Product"
  ADD COLUMN "isGdsHotel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isBlock" BOOLEAN NOT NULL DEFAULT false;

UPDATE "catalog"."Product"
SET "isBlock" = true
WHERE title ILIKE '%(block)%';
