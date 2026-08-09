import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { OrderService, type OrderAction } from "./order.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

class BootstrapItemDto {
  @IsString()
  productId!: string;

  @IsString()
  title!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  serviceDate?: string;
}

class BootstrapTravelerDto {
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

class BootstrapOrderDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  serviceDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BootstrapItemDto)
  items!: BootstrapItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BootstrapTravelerDto)
  travelers?: BootstrapTravelerDto[];
}

class OrderActionDto {
  @IsEnum(["process", "markWaitingData", "resumeProcessing", "confirm", "send", "complete", "close", "cancel", "problem", "suspend"] as const)
  action!: OrderAction;
}

class UpdateTravelersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BootstrapTravelerDto)
  travelers!: BootstrapTravelerDto[];
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
 * POST /orders/bootstrap — ADMIN-only exception (Phase 1 bootstrap, Phase 2 §4:
 * «убрать из обычного UI; оставить только как ADMIN/import exception»).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post("orders/bootstrap")
  @RequirePermissions("order.import")
  bootstrapOrder(@Body() dto: BootstrapOrderDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.orders.bootstrapOrder(dto, actor.username);
  }

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
  orderAction(@Param("id") id: string, @Body() dto: OrderActionDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.orders.orderAction(id, dto.action, actor.username);
  }

  @Patch("orders/:id/travelers")
  @RequirePermissions("order.edit_noncritical")
  updateTravelers(@Param("id") id: string, @Body() dto: UpdateTravelersDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.orders.updateTravelers(id, dto.travelers, actor.username);
  }
}

export { IsObject };
