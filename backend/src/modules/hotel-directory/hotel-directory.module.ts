import { Module } from "@nestjs/common";
import { HotelDirectoryController } from "./hotel-directory.controller";
import { HotelDirectoryService } from "./hotel-directory.service";

@Module({
  controllers: [HotelDirectoryController],
  providers: [HotelDirectoryService],
  exports: [HotelDirectoryService],
})
export class HotelDirectoryModule {}
