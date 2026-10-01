-- GatewayAirportMapping — destination → gateway airport business link
-- (spec: GATEWAY AIRPORT MAPPING; confirmed provenance only, never distance-derived)

-- CreateTable
CREATE TABLE "geo"."GatewayAirportMapping" (
    "id" TEXT NOT NULL,
    "geoCountryId" TEXT,
    "geoCityId" TEXT,
    "geoResortId" TEXT,
    "airportId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "providerId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "GatewayAirportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GatewayAirportMapping_geoCountryId_idx" ON "geo"."GatewayAirportMapping"("geoCountryId");

-- CreateIndex
CREATE INDEX "GatewayAirportMapping_geoCityId_idx" ON "geo"."GatewayAirportMapping"("geoCityId");

-- CreateIndex
CREATE INDEX "GatewayAirportMapping_geoResortId_idx" ON "geo"."GatewayAirportMapping"("geoResortId");

-- CreateIndex
CREATE INDEX "GatewayAirportMapping_airportId_idx" ON "geo"."GatewayAirportMapping"("airportId");

-- CreateIndex
CREATE INDEX "GatewayAirportMapping_active_idx" ON "geo"."GatewayAirportMapping"("active");

-- AddForeignKey
ALTER TABLE "geo"."GatewayAirportMapping" ADD CONSTRAINT "GatewayAirportMapping_geoCountryId_fkey" FOREIGN KEY ("geoCountryId") REFERENCES "geo"."GeoCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo"."GatewayAirportMapping" ADD CONSTRAINT "GatewayAirportMapping_geoCityId_fkey" FOREIGN KEY ("geoCityId") REFERENCES "geo"."GeoCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo"."GatewayAirportMapping" ADD CONSTRAINT "GatewayAirportMapping_geoResortId_fkey" FOREIGN KEY ("geoResortId") REFERENCES "geo"."GeoResort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo"."GatewayAirportMapping" ADD CONSTRAINT "GatewayAirportMapping_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "geo"."GeoAirport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
