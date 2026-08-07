import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { BookingService, type BookingAction } from "./booking.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

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

/** Права команд Booking (RBAC Matrix §4). */
const ACTION_PERMISSIONS: Record<BookingAction, string> = {
  send: "booking.send_supplier",
  confirm: "booking.confirm",
  reject: "booking.confirm",
  service: "booking.confirm",
  complete: "booking.confirm",
  cancel: "booking.cancel",
  problem: "booking.confirm",
};

/**
 * REST API: /api/v1/bookings → Booking Center.
 * Создание Booking — только через событие BookingRequested (consumer), поэтому
 * POST /bookings не существует: Booking Center не принимает прямых команд на создание.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get("bookings")
  @RequirePermissions("booking.read")
  listBookings(@Query() query: ListBookingsQuery) {
    return this.bookings.listBookings(query);
  }

  @Get("bookings/:id")
  @RequirePermissions("booking.read")
  getBooking(@Param("id") id: string) {
    return this.bookings.getBooking(id);
  }

  @Patch("bookings/:id")
  @RequirePermissions((req) => [ACTION_PERMISSIONS[req.body?.action as BookingAction] ?? "booking.confirm"])
  bookingAction(@Param("id") id: string, @Body() dto: BookingActionDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.bookings.bookingAction(id, dto.action, actor.username);
  }
}
