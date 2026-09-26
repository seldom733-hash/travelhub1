import { Module } from "@nestjs/common";
import { GeoController } from "./geo.controller";
import { GeoService } from "./geo.service";
import { GeographyAvailabilityService } from "./geo-availability.service";

@Module({
  controllers: [GeoController],
  providers: [GeoService, GeographyAvailabilityService],
  exports: [GeoService, GeographyAvailabilityService],
})
export class GeoModule {}
