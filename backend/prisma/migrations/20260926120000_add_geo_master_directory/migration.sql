-- Master Geography: geo.* directory (Country/City/Resort/Airport) + Product linkage.
-- NOTE: scoped to geo changes only; pre-existing dev-DB drift
-- (catalog.PartnerActiveCategory) is intentionally left untouched.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "geo";

-- CreateEnum
CREATE TYPE "geo"."GeoStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable: Product geography linkage (nullable ID refs, no cross-schema FK per ADR-0001)
ALTER TABLE "catalog"."Product" ADD COLUMN "geoAirportId" TEXT,
ADD COLUMN "geoCityId" TEXT,
ADD COLUMN "geoCountryId" TEXT,
ADD COLUMN "geoResortId" TEXT;

-- CreateTable
CREATE TABLE "geo"."GeoCountry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "status" "geo"."GeoStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "GeoCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo"."GeoCity" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "geo"."GeoStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "GeoCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo"."GeoResort" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "geo"."GeoStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "GeoResort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo"."GeoAirport" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "timeZone" TEXT,
    "status" "geo"."GeoStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "GeoAirport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoCountry_code_key" ON "geo"."GeoCountry"("code");

-- CreateIndex
CREATE INDEX "GeoCountry_status_idx" ON "geo"."GeoCountry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoCity_code_key" ON "geo"."GeoCity"("code");

-- CreateIndex
CREATE INDEX "GeoCity_countryId_idx" ON "geo"."GeoCity"("countryId");

-- CreateIndex
CREATE INDEX "GeoCity_status_idx" ON "geo"."GeoCity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoResort_code_key" ON "geo"."GeoResort"("code");

-- CreateIndex
CREATE INDEX "GeoResort_cityId_idx" ON "geo"."GeoResort"("cityId");

-- CreateIndex
CREATE INDEX "GeoResort_status_idx" ON "geo"."GeoResort"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoAirport_code_key" ON "geo"."GeoAirport"("code");

-- CreateIndex
CREATE INDEX "GeoAirport_cityId_idx" ON "geo"."GeoAirport"("cityId");

-- CreateIndex
CREATE INDEX "GeoAirport_status_idx" ON "geo"."GeoAirport"("status");

-- CreateIndex
CREATE INDEX "Product_geoCountryId_idx" ON "catalog"."Product"("geoCountryId");

-- CreateIndex
CREATE INDEX "Product_geoCityId_idx" ON "catalog"."Product"("geoCityId");

-- CreateIndex
CREATE INDEX "Product_geoResortId_idx" ON "catalog"."Product"("geoResortId");

-- CreateIndex
CREATE INDEX "Product_geoAirportId_idx" ON "catalog"."Product"("geoAirportId");

-- AddForeignKey
ALTER TABLE "geo"."GeoCity" ADD CONSTRAINT "GeoCity_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "geo"."GeoCountry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo"."GeoResort" ADD CONSTRAINT "GeoResort_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "geo"."GeoCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo"."GeoAirport" ADD CONSTRAINT "GeoAirport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "geo"."GeoCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
