import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { BookingService, type BookingAction } from "./booking.service";

class ListBookingsQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

class BookingActionDto {
  @IsEnum(["send", "confirm", "reject", "service", "complete", "cancel", "problem"] as const)
  action!: BookingAction;
}

/**
 * REST API: /api/v1/bookings → Booking Center.
 * Создание Booking — только через событие BookingRequested (consumer), поэтому
 * POST /bookings не существует: Booking Center не принимает прямых команд на создание.
 */
@Controller()
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get("bookings")
  listBookings(@Query() query: ListBookingsQuery) {
    return this.bookings.listBookings(query);
  }

  @Get("bookings/:id")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }

  @Patch("bookings/:id")
  bookingAction(@Param("id") id: string, @Body() dto: BookingActionDto) {
    return this.bookings.bookingAction(id, dto.action, "api");
  }
}
