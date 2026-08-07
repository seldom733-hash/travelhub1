import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
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

/**
 * REST API: /api/v1/orders → Order Center.
 * POST /orders/bootstrap — временный служебный сценарий Phase 1; после Phase 2
 * основной Order создаётся consumer-ом OrderRequested (Sales Center).
 */
@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post("orders/bootstrap")
  bootstrapOrder(@Body() dto: BootstrapOrderDto) {
    return this.orders.bootstrapOrder(dto, "api");
  }

  @Get("orders")
  listOrders(@Query() query: ListOrdersQuery) {
    return this.orders.listOrders(query);
  }

  @Get("orders/:id")
  getOrder(@Param("id") id: string) {
    return this.orders.getOrder(id);
  }

  @Patch("orders/:id")
  orderAction(@Param("id") id: string, @Body() dto: OrderActionDto) {
    return this.orders.orderAction(id, dto.action, "api");
  }

  @Patch("orders/:id/travelers")
  updateTravelers(@Param("id") id: string, @Body() dto: UpdateTravelersDto) {
    return this.orders.updateTravelers(id, dto.travelers, "api");
  }
}

export { IsObject };
