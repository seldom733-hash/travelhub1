import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { Request } from "express";
import { RatePlanService } from "./rate-plan.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { RATE_PLAN_CREATE_FORBIDDEN_KEYS, RATE_PLAN_UPDATE_FORBIDDEN_KEYS } from "./rate-plan.validation";
import { RoleCode } from "../../generated/prisma/enums";

class CreateRatePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  price!: number;

  // currency immutable после создания (одна canonical валюта на план, DD-029).
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  serviceUnitId?: string;

  @IsOptional()
  @IsString()
  priceBasis?: string;

  @IsOptional()
  @IsString()
  refundability?: string;

  @IsOptional()
  @IsString()
  pricingMode?: string;

  @IsOptional()
  @IsObject()
  inclusions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  restrictions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;
}

class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  serviceUnitId?: string | null;

  @IsOptional()
  @IsString()
  priceBasis?: string;

  @IsOptional()
  @IsString()
  refundability?: string;

  @IsOptional()
  @IsString()
  pricingMode?: string;

  @IsOptional()
  @IsObject()
  inclusions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  restrictions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;
}

class ListRatePlansQuery {
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
}

/**
 * PHASE 1 STEP 1.8B — Rate Plan (Tariff → canonical Rate Plan foundation) — REST API.
 *
 * Ownership: Rate Plan принадлежит Product (partnerId наследуется из Product).
 *  - PARTNER: create/list/get/update СВОИХ Rate Plans (reuse catalog.product.*
 *    own-scope — child-entity Product); коммерческие правки — только под DRAFT
 *    Product (конвенция PARTNER-правит-draft, сервис-гейт);
 *  - staff/ADMIN: catalog.product.write / catalog.product.read; archive/activate —
 *    НОВОЕ catalog.rate_plan.publish (отдельная publication/commercial-state authority);
 *  - MODERATOR: 403 (Rate Plans не moderation-объекты в 1.8B).
 *
 * Security: raw-body forbidden-key check (не срезанный ValidationPipe) — forged
 * ownership/lifecycle/identity/1.8C-факты → 422 (loud, §29).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RatePlansController {
  constructor(private readonly ratePlans: RatePlanService) {}

  @Post("products/:productId/tariffs")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.create_own"] : ["catalog.product.write"],
  )
  create(
    @Param("productId") productId: string,
    @Body() dto: CreateRatePlanDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, RATE_PLAN_CREATE_FORBIDDEN_KEYS);
    return this.ratePlans.create(
      productId,
      {
        name: dto.name,
        price: dto.price,
        currency: dto.currency ?? null,
        serviceUnitId: dto.serviceUnitId ?? null,
        priceBasis: dto.priceBasis ?? null,
        refundability: dto.refundability ?? null,
        pricingMode: dto.pricingMode,
        inclusions: dto.inclusions ?? null,
        restrictions: dto.restrictions ?? null,
        validFrom: dto.validFrom ?? null,
        validTo: dto.validTo ?? null,
      },
      actor,
    );
  }

  @Get("products/:productId/tariffs")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  listForProduct(
    @Param("productId") productId: string,
    @Query() query: ListRatePlansQuery,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.ratePlans.listForProduct(productId, actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Get("tariffs/:id")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  get(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.ratePlans.get(id, actor);
  }

  @Get("tariffs/:id/history")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  history(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.ratePlans.history(id, actor);
  }

  @Patch("tariffs/:id")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.update_own_draft"] : ["catalog.product.write"],
  )
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRatePlanDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    // currency immutable после создания — forbidden key на update → 422 (loud).
    assertNoForbiddenKeys(req.body, RATE_PLAN_UPDATE_FORBIDDEN_KEYS);
    return this.ratePlans.update(
      id,
      {
        name: dto.name,
        price: dto.price,
        serviceUnitId: dto.serviceUnitId,
        priceBasis: dto.priceBasis,
        refundability: dto.refundability,
        pricingMode: dto.pricingMode,
        inclusions: dto.inclusions,
        restrictions: dto.restrictions,
        validFrom: dto.validFrom,
        validTo: dto.validTo,
      },
      actor,
    );
  }

  @Post("tariffs/:id/archive")
  @RequirePermissions("catalog.rate_plan.publish")
  archive(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.ratePlans.archive(id, actor);
  }

  @Post("tariffs/:id/activate")
  @RequirePermissions("catalog.rate_plan.publish")
  activate(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.ratePlans.activate(id, actor);
  }
}
