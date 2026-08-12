import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Request } from "express";
import { CommercialRestrictionService, COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS } from "./commercial-restriction.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { RoleCode } from "../../generated/prisma/enums";

class CreateRestrictionDto {
  @IsIn(["PERIOD", "DATE"])
  scope!: string;

  @IsIn(["STOP_SELL", "MIN_STAY", "ADVANCE_BOOKING", "CLOSED_TO_ARRIVAL", "CLOSED_TO_DEPARTURE"])
  type!: string;

  @IsOptional()
  @IsInt()
  value?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  commercialPeriodId?: string;
}

class UpdateRestrictionDto {
  @IsOptional()
  @IsIn(["PERIOD", "DATE"])
  scope?: string;

  @IsOptional()
  @IsIn(["STOP_SELL", "MIN_STAY", "ADVANCE_BOOKING", "CLOSED_TO_ARRIVAL", "CLOSED_TO_DEPARTURE"])
  type?: string;

  @IsOptional()
  @IsInt()
  value?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  commercialPeriodId?: string;
}

class ListRestrictionsQuery {
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
 * PHASE 1 STEP 1.8D — CommercialRestriction REST API (Catalog owner).
 *
 * Ownership: restriction принадлежит Tariff (partnerId наследуется из Product).
 *  - PARTNER: own-scope reuse catalog.product.*; коммерческие правки — только
 *    под DRAFT Product (как 1.8B/1.8C);
 *  - staff/ADMIN: catalog.product.read/write;
 *  - archive/activate — catalog.rate_plan.publish (staff, как Rate Plan/Period);
 *  - MODERATOR: 403 (restrictions — не moderation-объекты).
 * Security: raw-body forbidden-key check → 422 (ownership/lifecycle/audit/
 * Quote/hold/1.8D/time-slot forged факты запрещены).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CommercialRestrictionsController {
  constructor(private readonly restrictions: CommercialRestrictionService) {}

  private static permission(req: AuthedRequest, manage: boolean): string[] {
    if (req.user.role === RoleCode.PARTNER) {
      return manage ? ["catalog.product.update_own_draft"] : ["catalog.product.read_own"];
    }
    return manage ? ["catalog.product.write"] : ["catalog.product.read"];
  }

  @Post("tariffs/:tariffId/commercial-restrictions")
  @RequirePermissions((req: AuthedRequest) => CommercialRestrictionsController.permission(req, true))
  create(
    @Param("tariffId") tariffId: string,
    @Body() dto: CreateRestrictionDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS);
    return this.restrictions.create(
      tariffId,
      {
        scope: dto.scope,
        type: dto.type,
        value: dto.value,
        startDate: dto.startDate,
        endDate: dto.endDate,
        commercialPeriodId: dto.commercialPeriodId,
      },
      actor,
    );
  }

  @Get("tariffs/:tariffId/commercial-restrictions")
  @RequirePermissions((req: AuthedRequest) => CommercialRestrictionsController.permission(req, false))
  listForTariff(
    @Param("tariffId") tariffId: string,
    @Query() query: ListRestrictionsQuery,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.restrictions.listForTariff(tariffId, actor, query.limit ?? 50, query.offset ?? 0, query.status ?? "ACTIVE");
  }

  @Get("commercial-restrictions/:id")
  @RequirePermissions((req: AuthedRequest) => CommercialRestrictionsController.permission(req, false))
  get(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.restrictions.get(id, actor);
  }

  @Get("commercial-restrictions/:id/history")
  @RequirePermissions((req: AuthedRequest) => CommercialRestrictionsController.permission(req, false))
  history(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.restrictions.history(id, actor);
  }

  @Patch("commercial-restrictions/:id")
  @RequirePermissions((req: AuthedRequest) => CommercialRestrictionsController.permission(req, true))
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRestrictionDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS);
    return this.restrictions.update(
      id,
      {
        scope: dto.scope,
        type: dto.type,
        value: dto.value,
        startDate: dto.startDate,
        endDate: dto.endDate,
        commercialPeriodId: dto.commercialPeriodId,
      },
      actor,
    );
  }

  @Post("commercial-restrictions/:id/archive")
  @RequirePermissions("catalog.rate_plan.publish")
  archive(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.restrictions.archive(id, actor);
  }

  @Post("commercial-restrictions/:id/activate")
  @RequirePermissions("catalog.rate_plan.publish")
  activate(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.restrictions.activate(id, actor);
  }
}
