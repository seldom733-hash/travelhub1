-- Master Geography: add coordinates to GeoAirport (symmetric with City/Resort).

-- AlterTable
ALTER TABLE "geo"."GeoAirport" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
