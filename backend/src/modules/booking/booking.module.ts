import { Module } from "@nestjs/common";
import { BookingController } from "./booking.controller";
import { BookingService } from "./booking.service";
import { BookingQueryService } from "./booking-query.service";
import { BookingSubscribers } from "./booking.subscribers";

@Module({
  controllers: [BookingController],
  providers: [BookingService, BookingQueryService, BookingSubscribers],
  exports: [BookingQueryService],
})
export class BookingModule {}
