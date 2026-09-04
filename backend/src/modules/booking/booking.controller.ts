import { Body, Controller, Get, Param, Patch, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ExportService } from '../shared/export/export.service';
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { Request } from "express";
import { BookingService, type BookingAction } from "./booking.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { Response } from 'express';
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

  /** Sales Channel scope: MARKETPLACE / PARTNER_STOREFRONT / omit = ALL */
  @IsOptional()
  @IsString()
  acquisitionSource?: string;

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

  // Step 3.6C.1: mandatory reason for Platform support transitions.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;
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

  @Get("bookings/export")
  @RequirePermissions("booking.read")
  async exportBookings(
    @Query() query: ListBookingsQuery & { format?: string; dateFrom?: string; dateTo?: string; sellerPartnerId?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows, total } = await this.bookings.exportBookings({
      status: query.status,
      orderId: query.orderId,
      search: query.search,
      acquisitionSource: query.acquisitionSource,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sellerPartnerId: query.sellerPartnerId,
    });
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Status', key: 'status', width: 22 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
      { header: 'updatedAt', key: 'updatedAt', width: 22 },
      { header: 'serviceDate', key: 'serviceDate', width: 22 },
      { header: 'Source', key: 'acquisitionSource', width: 16 },
      { header: 'Order ID', key: 'orderId', width: 38 },
      { header: 'Order Reference', key: 'orderReference', width: 22 },
      { header: 'Partner ID', key: 'partnerId', width: 38 },
      { header: 'Partner Code', key: 'partnerCode', width: 16 },
      { header: 'Partner Name', key: 'partnerName', width: 28 },
      { header: 'Customer ID', key: 'customerId', width: 38 },
      { header: 'Customer Code', key: 'customerCode', width: 16 },
      { header: 'Customer Name', key: 'customerName', width: 28 },
      { header: 'Payment IDs', key: 'paymentIds', width: 40 },
      { header: 'Payment References', key: 'paymentReferences', width: 28 },
      { header: 'Payment Statuses', key: 'paymentStatuses', width: 28 },
      { header: 'Payment Amounts', key: 'paymentAmounts', width: 28 },
      { header: 'Paid At', key: 'paidAt', width: 28 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Bookings');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="bookings_export.xlsx"`);
      return res.send(buf);
    }
    const csv = svc.toCsv(columns, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings_export.csv"`);
    return res.send(csv);
  }

  @Get("bookings/:id/history")
  @RequirePermissions("booking.read")
  async getBookingHistory(
    @Param("id") id: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    // D6: immutable booking change history
    await this.bookings.getBooking(id, actor, actor.permissions ?? []);
    return this.bookings.getBookingHistory(id);
  }

  @Get("bookings/:id")
  @RequirePermissions("booking.read")
  getBooking(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.bookings.getBooking(id, actor, actor.permissions ?? []);
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
    return this.bookings.bookingAction(id, dto.action, actor.username, dto.reason ?? null);
  }
}
