import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ExportService } from '../shared/export/export.service';
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Request } from "express";
import { OrderService, type OrderAction } from "./order.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { Response } from 'express';
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { ORDER_ACTION_FORBIDDEN_KEYS, ORDER_TRAVELERS_FORBIDDEN_KEYS } from "./order.validation";

class TravelerDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  citizenship?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;
}

class OrderActionDto {
  @IsEnum(["process", "markWaitingData", "resumeProcessing", "confirm", "send", "complete", "close", "cancel", "problem", "suspend"] as const)
  action!: OrderAction;

  // Step 3.6C.1: mandatory reason for Platform support transitions.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;
}

class UpdateTravelersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerDto)
  travelers!: TravelerDto[];
}

class ListOrdersQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** Sales Channel scope: MARKETPLACE / PARTNER_STOREFRONT / omit = ALL */
  @IsOptional()
  @IsString()
  acquisitionSource?: string;

  /** ROUND 5: orders cancelled within N days (detector: RECENT_CANCELLATIONS). */
  @IsOptional()
  @IsString()
  cancelledWithin?: string;

  /** ROUND 5: orders with at least one FAILED payment (detector: FAILED_PAYMENTS). */
  @IsOptional()
  @IsString()
  paymentFailed?: string;

  /** ROUND 5: orders with at least one REQUESTED refund (detector: PENDING_REFUNDS). */
  @IsOptional()
  @IsString()
  pendingRefund?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;  @IsOptional()
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

/** Права, необходимые для каждой команды жизненного цикла Order (RBAC Matrix §4). */
const ACTION_PERMISSIONS: Record<OrderAction, string> = {
  process: "order.accept",
  markWaitingData: "order.edit_noncritical",
  resumeProcessing: "order.edit_noncritical",
  confirm: "order.edit_noncritical",
  send: "order.request_booking",
  complete: "order.edit_noncritical",
  close: "order.close",
  cancel: "order.cancel",
  problem: "order.edit_noncritical",
  suspend: "order.suspend",
};

/**
 * REST API: /api/v1/orders → Order Center.
 *
 * Step 2.6: POST /orders/bootstrap удалён. Единственный путь создания нормального
 * Order — canonical flow: Quote → CheckoutIntent → Sale → OrderRequested →
 * Outbox/EventBus → Order-owned consumer → Order (OrderCreated).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get("orders")
  @RequirePermissions("order.read")
  listOrders(@Query() query: ListOrdersQuery, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.orders.listOrders(query, actor);
  }

  @Get("orders/export")
  @RequirePermissions("order.read")
  async exportOrders(
    @Query() query: ListOrdersQuery & { format?: string; sellerPartnerId?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows, total } = await this.orders.exportOrders({
      status: query.status,
      customerId: query.customerId,
      search: query.search,
      paymentStatus: query.paymentStatus,
      cancelledWithin: query.cancelledWithin,
      paymentFailed: query.paymentFailed,
      pendingRefund: query.pendingRefund,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      acquisitionSource: query.acquisitionSource,
      sellerPartnerId: query.sellerPartnerId,
    });
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Code', key: 'code', width: 22 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
      { header: 'updatedAt', key: 'updatedAt', width: 22 },
      { header: 'Source', key: 'acquisitionSource', width: 16 },
      { header: 'Partner ID', key: 'partnerId', width: 38 },
      { header: 'Partner Code', key: 'partnerCode', width: 16 },
      { header: 'Partner Name', key: 'partnerName', width: 28 },
      { header: 'Customer ID', key: 'customerId', width: 38 },
      { header: 'Customer Code', key: 'customerCode', width: 16 },
      { header: 'Customer Name', key: 'customerName', width: 28 },
      { header: 'Booking IDs', key: 'bookingIds', width: 40 },
      { header: 'Booking Codes', key: 'bookingCodes', width: 28 },
      { header: 'Booking References', key: 'bookingReferences', width: 28 },
      { header: 'Booking Statuses', key: 'bookingStatuses', width: 28 },
      { header: 'Payment IDs', key: 'paymentIds', width: 40 },
      { header: 'Payment References', key: 'paymentReferences', width: 28 },
      { header: 'Payment Statuses', key: 'paymentStatuses', width: 28 },
      { header: 'Payment Amounts', key: 'paymentAmounts', width: 28 },
      { header: 'Paid At', key: 'paidAt', width: 28 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Orders');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="orders_export.xlsx"`);
      return res.send(buf);
    }
    // CSV
    const csv = svc.toCsv(columns, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders_export.csv"`);
    return res.send(csv);
  }

  @Get("orders/:id")
  @RequirePermissions("order.read")
  getOrder(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.orders.getOrder(id, actor);
  }

  @Patch("orders/:id")
  @RequirePermissions((req) => [ACTION_PERMISSIONS[req.body?.action as OrderAction] ?? "order.edit_noncritical"])
  orderAction(
    @Param("id") id: string,
    @Body() dto: OrderActionDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    // STRICT REVIEW §28: forged server-owned поля → ЯВНЫЙ 422 (конвенция
    // assertNoForbiddenKeys, как в Sales/Reverse/Catalog), а не silent-strip
    // через whitelist. Команда принимает ТОЛЬКО `action`.
    assertNoForbiddenKeys(req.body, ORDER_ACTION_FORBIDDEN_KEYS);
    return this.orders.orderAction(id, dto.action, actor.username, dto.reason ?? null);
  }

  @Patch("orders/:id/travelers")
  @RequirePermissions("order.edit_noncritical")
  updateTravelers(
    @Param("id") id: string,
    @Body() dto: UpdateTravelersDto,
    @CurrentUser() actor: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    // STRICT REVIEW §28: server-owned OrderTraveler ключи (id/orderId/version/
    // dataCompleteness/…) → 422, а не молчаливая обрезка (как в checkout-конвенции).
    assertNoForbiddenKeys(req.body, ORDER_TRAVELERS_FORBIDDEN_KEYS);
    const raw = (req.body as { travelers?: unknown[] } | undefined)?.travelers;
    if (raw) {
      for (const t of raw) assertNoForbiddenKeys(t, ORDER_TRAVELERS_FORBIDDEN_KEYS);
    }
    return this.orders.updateTravelers(id, dto.travelers, actor.username);
  }
}
