-- DropForeignKey / DropIndex are implied by the table drop.
-- GatewayAirportMapping — destination → gateway airport business link
-- (spec: GATEWAY AIRPORT MAPPING); the platform-tours / independent-tour
-- feature that consumed it was removed.

-- DropTable
DROP TABLE "geo"."GatewayAirportMapping";
