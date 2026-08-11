import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { Request } from "express";
import { ServiceUnitService } from "./service-unit.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { SERVICE_UNIT_CREATE_FORBIDDEN_KEYS, SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS } from "./service-unit.validation";
import { RoleCode } from "../../generated/prisma/enums";

class CreateServiceUnitDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  // Import identity (trusted provisioning): server-валидируется + PARTNER → 422 в сервисе.
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  externalKey?: string;
}

class UpdateServiceUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

class ListUnitsQuery {
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
 * PHASE 1 STEP 1.8A — Service Unit (Seller Commercial Unit) — REST API.
 *
 * Ownership: юнит принадлежит Product (partnerId наследуется из Product).
 *  - PARTNER: create/list/get/update СВОИХ юнитов (reuse catalog.product.*
 *    own-scope — child-entity Product, без новых CRUD-прав, §22);
 *  - staff/ADMIN: catalog.product.write / catalog.product.read; publish/archive —
 *    НОВОЕ catalog.service_unit.publish (отдельная publication authority для
 *    юнитов, документировано в permissions.constants).
 *  - MODERATOR: 403 (юниты не moderation-объекты в 1.8A).
 *
 * Security: raw-body forbidden-key check (не срезанный ValidationPipe) — forged
 * ownership/lifecycle/identity/temporal → 422 (loud, §23). source/externalKey —
 * только staff/ADMIN (сервис блокирует PARTNER 422).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ServiceUnitsController {
  constructor(private readonly units: ServiceUnitService) {}

  @Post("products/:productId/service-units")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.create_own"] : ["catalog.product.write"],
  )
  create(
    @Param("productId") productId: string,
    @Body() dto: CreateServiceUnitDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    assertNoForbiddenKeys(req.body, SERVICE_UNIT_CREATE_FORBIDDEN_KEYS);
    return this.units.create(
      productId,
      {
        name: dto.name,
        attributes: dto.attributes,
        source: dto.source ?? null,
        externalKey: dto.externalKey ?? null,
      },
      actor,
    );
  }

  @Get("products/:productId/service-units")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  listForProduct(
    @Param("productId") productId: string,
    @Query() query: ListUnitsQuery,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.units.listForProduct(productId, actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Get("service-units/:id")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  get(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.units.get(id, actor);
  }

  @Get("service-units/:id/history")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.read_own"] : ["catalog.product.read"],
  )
  history(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.units.history(id, actor);
  }

  @Patch("service-units/:id")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.update_own_draft"] : ["catalog.product.write"],
  )
  update(
    @Param("id") id: string,
    @Body() dto: UpdateServiceUnitDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    // source/externalKey immutable после создания (смена = delete + create).
    assertNoForbiddenKeys(req.body, SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS);
    return this.units.update(id, { name: dto.name, attributes: dto.attributes }, actor);
  }

  @Post("service-units/:id/publish")
  @RequirePermissions("catalog.service_unit.publish")
  publish(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.units.publish(id, actor);
  }

  @Post("service-units/:id/archive")
  @RequirePermissions("catalog.service_unit.publish")
  archive(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.units.archive(id, actor);
  }
}
