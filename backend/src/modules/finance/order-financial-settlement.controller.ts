import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { OrderFinancialSettlementService } from "./order-financial-settlement.service";

const MONEY = /^\d+(\.\d{1,2})?$/;

class SettlementPreviewDto {
  @IsOptional()
  @IsString()
  @Matches(MONEY)
  finalCustomerLiability?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  penaltyAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  platformPenaltyShare?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  supplierPenaltyShare?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

class SettlementConfirmDto {
  @IsOptional()
  @IsString()
  @Matches(MONEY)
  finalCustomerLiability?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  penaltyAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  platformPenaltyShare?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  supplierPenaltyShare?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

@Controller("orders")
export class OrderFinancialSettlementController {
  constructor(private readonly settlements: OrderFinancialSettlementService) {}

  @Get(":id/financial-settlement")
  @RequirePermissions("finance.settlement.read")
  get(@Param("id") id: string) {
    return this.settlements.get(id);
  }

  @Post(":id/financial-settlement/preview")
  @RequirePermissions("finance.settlement.read")
  preview(@Param("id") id: string, @Body() dto: SettlementPreviewDto) {
    return this.settlements.preview(id, dto);
  }

  @Post(":id/financial-settlement/confirm")
  @RequirePermissions("finance.settlement.manage")
  confirm(
    @Param("id") id: string,
    @Body() dto: SettlementConfirmDto,
    @CurrentUser() user: { id: string; username: string },
  ) {
    return this.settlements.confirm(id, dto, user);
  }
}
