import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
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
  clientPenaltyAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(PENDING|CONFIRMED|WITHHELD|RECEIVED|WAIVED)$/)
  clientPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";

  @IsOptional()
  @IsString()
  @Matches(/^(PENDING|CONFIRMED|WITHHELD|RECEIVED|WAIVED)$/)
  supplierPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";

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
  @Matches(/^(CUSTOMER_FAULT|SUPPLIER_FAULT|NAVITRAVEL_FAULT|FORCE_MAJEURE|MUTUAL_AGREEMENT)$/)
  cancellationReason?: "CUSTOMER_FAULT" | "SUPPLIER_FAULT" | "NAVITRAVEL_FAULT" | "FORCE_MAJEURE" | "MUTUAL_AGREEMENT";

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  supplierPenaltyAmount?: string;

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
  clientPenaltyAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(PENDING|CONFIRMED|WITHHELD|RECEIVED|WAIVED)$/)
  clientPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";

  @IsOptional()
  @IsString()
  @Matches(/^(PENDING|CONFIRMED|WITHHELD|RECEIVED|WAIVED)$/)
  supplierPenaltyStatus?: "PENDING" | "CONFIRMED" | "WITHHELD" | "RECEIVED" | "WAIVED";

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
  @Matches(/^(CUSTOMER_FAULT|SUPPLIER_FAULT|NAVITRAVEL_FAULT|FORCE_MAJEURE|MUTUAL_AGREEMENT)$/)
  cancellationReason?: "CUSTOMER_FAULT" | "SUPPLIER_FAULT" | "NAVITRAVEL_FAULT" | "FORCE_MAJEURE" | "MUTUAL_AGREEMENT";

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  supplierPenaltyAmount?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

class PenaltyCancelDto {
  @IsOptional()
  @IsBoolean()
  client?: boolean;

  @IsOptional()
  @IsBoolean()
  supplier?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

class WriteOffDto {
  @IsOptional()
  @IsString()
  @Matches(MONEY)
  amount?: string;

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

  @Get(":id/cancellation/approval")
  @RequirePermissions("finance.settlement.read")
  getCancellationApproval(@Param("id") id: string) {
    return this.settlements.getCancellationApproval(id);
  }

  @Post(":id/cancellation/submit")
  @RequirePermissions("finance.settlement.manage")
  submitCancellationApproval(@Param("id") id: string, @Body() dto: SettlementConfirmDto, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.submitCancellationApproval(id, dto, user);
  }

  @Post(":id/cancellation/approve")
  @RequirePermissions("finance.settlement.manage")
  approveCancellationApproval(@Param("id") id: string, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.approveCancellationApproval(id, user);
  }

  @Post(":id/cancellation/reject")
  @RequirePermissions("finance.settlement.manage")
  rejectCancellationApproval(@Param("id") id: string, @Body() body: { reason: string }, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.rejectCancellationApproval(id, body.reason ?? "", user);
  }

  @Get(":id/cancellation/supplier-terms")
  @RequirePermissions("finance.settlement.read")
  getCancellationSupplierTerms(@Param("id") id: string) {
    return this.settlements.getCancellationSupplierTerms(id);
  }

  @Put(":id/cancellation/supplier-terms")
  @RequirePermissions("finance.settlement.manage")
  saveCancellationSupplierTerms(@Param("id") id: string, @Body() body: { terms: Array<Record<string, unknown>> }, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.saveCancellationSupplierTerms(id, body.terms ?? [], user);
  }

  @Post(":id/financial-settlement/write-off-client-debt")
  @RequirePermissions("finance.settlement.manage")
  writeOffClientDebt(@Param("id") id: string, @Body() dto: WriteOffDto, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.writeOffClientDebt(id, dto, user);
  }

  @Post(":id/financial-settlement/write-off-supplier-debt")
  @RequirePermissions("finance.settlement.manage")
  writeOffSupplierDebt(@Param("id") id: string, @Body() dto: WriteOffDto, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.writeOffSupplierDebt(id, dto, user);
  }

  @Post(":id/financial-settlement/write-off-supplier")
  @RequirePermissions("finance.settlement.manage")
  writeOffSupplier(@Param("id") id: string, @Body() dto: WriteOffDto, @CurrentUser() user: { id: string; username: string }) {
    return this.settlements.writeOffSupplier(id, dto, user);
  }

  @Post(":id/financial-settlement/cancel-penalty")
  @RequirePermissions("finance.settlement.manage")
  cancelPenalty(
    @Param("id") id: string,
    @Body() dto: PenaltyCancelDto,
    @CurrentUser() user: { id: string; username: string },
  ) {
    return this.settlements.cancelPenalty(id, dto, user);
  }
}


