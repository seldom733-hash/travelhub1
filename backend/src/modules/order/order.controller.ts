import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Request } from "express";
import { OrderService, type OrderAction } from "./order.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
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
  customerId?: string;

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
    return this.orders.orderAction(id, dto.action, actor.username);
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
