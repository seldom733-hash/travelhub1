import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Request } from "express";
import { BookingService, type BookingAction } from "./booking.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { BOOKING_ACTION_FORBIDDEN_KEYS } from "./booking.validation";

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
  @IsString()
  upcoming?: string;

  /** ROUND 5: bookings overdue for confirmation (detector: BOOKING_CONFIRMATION_DELAY). */
  @IsOptional()
  @IsString()
  overdue?: string;

  /** ROUND 5: SLA threshold in minutes for overdue filter. */
  @IsOptional()
  @IsString()
  slaMinutes?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDirection?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

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
  @IsEnum(
    [
      "prepare",
      "send",
      "requestClarification",
      "resume",
      "confirm",
      "reject",
      "service",
      "requestChange",
      "resolveChange",
      "requestCancellation",
      "complete",
      "cancel",
      "problem",
    ] as const,
  )
  action!: BookingAction;
}

/**
 * Права команд Booking (RBAC Matrix §4) — Step 2.9: новые действия мапятся на
 * существующие каталоговые права (никаких новых permissions/ролей не вводится):
 *  - supplier-processing (prepare/send) → booking.send_supplier;
 *  - confirmation lifecycle (requestClarification/resume/confirm/reject/service/complete/problem)
 *    → booking.confirm;
 *  - change (requestChange/resolveChange) → booking.request_change;
 *  - cancellation (requestCancellation/cancel) → booking.cancel.
 * BUYER/PARTNER/MODERATOR этих прав не имеют (matrix §4) → 403 (Step 2.9 §26).
 */
const ACTION_PERMISSIONS: Record<BookingAction, string> = {
  prepare: "booking.send_supplier",
  send: "booking.send_supplier",
  requestClarification: "booking.confirm",
  resume: "booking.confirm",
  confirm: "booking.confirm",
  reject: "booking.confirm",
  service: "booking.confirm",
  requestChange: "booking.request_change",
  resolveChange: "booking.request_change",
  requestCancellation: "booking.cancel",
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
  getBooking(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.bookings.getBooking(id, actor);
  }

  @Patch("bookings/:id")
  @RequirePermissions((req) => [ACTION_PERMISSIONS[req.body?.action as BookingAction] ?? "booking.confirm"])
  bookingAction(
    @Param("id") id: string,
    @Body() dto: BookingActionDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    // STRICT REVIEW 2.8 §28: forged server-owned поля → ЯВНЫЙ 422 (конвенция
    // assertNoForbiddenKeys, как в Sales/Reverse/Catalog/Order), а не
    // silent-strip через whitelist. Команда принимает ТОЛЬКО `action`.
    assertNoForbiddenKeys(req.body, BOOKING_ACTION_FORBIDDEN_KEYS);
    return this.bookings.bookingAction(id, dto.action, actor.username);
  }
}
