import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { Request } from "express";
import { CommercialPeriodService } from "./commercial-period.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS, COMMERCIAL_PERIOD_UPDATE_FORBIDDEN_KEYS } from "./period.validation";
import { RoleCode } from "../../generated/prisma/enums";

class CreatePeriodDto {
  @IsOptional()
  @IsIn(["PERIOD", "DATE_OVERRIDE"])
  kind?: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dayOfWeek?: number[];

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsBoolean()
  sellable?: boolean;
}

class UpdatePeriodDto {
  @IsOptional()
  @IsIn(["PERIOD", "DATE_OVERRIDE"])
  kind?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dayOfWeek?: number[];

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  sellable?: boolean;
}

class BulkCreatePeriodDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePeriodDto)
  periods!: CreatePeriodDto[];
}

class ListPeriodsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED", "ALL"])
  status?: string;
}

/**
 * PHASE 1 STEP 1.8C — CommercialPeriod REST API (Catalog owner).
 *
 * Ownership: период принадлежит Tariff (partnerId наследуется из Product).
 *  - PARTNER: own-scope reuse catalog.product.*; коммерческие правки — только
 *    под DRAFT Product (как 1.8B); 
 *  - staff/ADMIN: catalog.product.read/write;
 *  - archive/activate — catalog.rate_plan.publish (staff, как Rate Plan);
 *  - MODERATOR: 403 (периоды — не moderation-объекты).
 * Security: raw-body forbidden-key check → 422 (server-owned/1.8D/Quote/hold
 * факты, валюта, ownership, lifecycle, timestamps).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CommercialPeriodsController {
  constructor(private readonly periods: CommercialPeriodService) {}

  private static permission(req: AuthedRequest, manage: boolean): string[] {
    if (req.user.role === RoleCode.PARTNER) {
      return manage ? ["catalog.product.update_own_draft"] : ["catalog.product.read_own"];
    }
    return manage ? ["catalog.product.write"] : ["catalog.product.read"];
  }

  @Post("tariffs/:tariffId/commercial-periods")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, true))
  create(
    @Param("tariffId") tariffId: string,
    @Body() dto: CreatePeriodDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS);
    return this.periods.create(
      tariffId,
      {
        kind: dto.kind,
        startDate: dto.startDate,
        endDate: dto.endDate,
        dayOfWeek: dto.dayOfWeek,
        price: dto.price,
        sellable: dto.sellable,
      },
      actor,
    );
  }

  @Post("tariffs/:tariffId/commercial-periods/bulk")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, true))
  bulkCreate(
    @Param("tariffId") tariffId: string,
    @Body() dto: BulkCreatePeriodDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS);
    return this.periods.bulkCreate(tariffId, dto.periods, actor);
  }

  @Get("tariffs/:tariffId/commercial-periods")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, false))
  listForTariff(
    @Param("tariffId") tariffId: string,
    @Query() query: ListPeriodsQuery,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.periods.listForTariff(tariffId, actor, query.limit ?? 50, query.offset ?? 0, query.status ?? "ACTIVE");
  }

  @Get("commercial-periods/:id")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, false))
  get(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.periods.get(id, actor);
  }

  @Get("commercial-periods/:id/history")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, false))
  history(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.periods.history(id, actor);
  }

  @Patch("commercial-periods/:id")
  @RequirePermissions((req: AuthedRequest) => CommercialPeriodsController.permission(req, true))
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePeriodDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, COMMERCIAL_PERIOD_UPDATE_FORBIDDEN_KEYS);
    return this.periods.update(
      id,
      {
        kind: dto.kind,
        startDate: dto.startDate,
        endDate: dto.endDate,
        dayOfWeek: dto.dayOfWeek,
        price: dto.price,
        sellable: dto.sellable,
      },
      actor,
    );
  }

  @Post("commercial-periods/:id/archive")
  @RequirePermissions("catalog.rate_plan.publish")
  archive(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.periods.archive(id, actor);
  }

  @Post("commercial-periods/:id/activate")
  @RequirePermissions("catalog.rate_plan.publish")
  activate(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.periods.activate(id, actor);
  }
}
