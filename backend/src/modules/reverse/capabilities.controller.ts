import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ArrayNotEmpty } from "class-validator";
import { Request } from "express";
import { CapabilitiesService } from "./capabilities.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys, CAPABILITY_CREATE_FORBIDDEN_KEYS, CAPABILITY_UPDATE_FORBIDDEN_KEYS } from "../../shared/field-validation";

class CreateCapabilityDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsArray()
  @ArrayNotEmpty()
  destinations!: unknown[];
}

class UpdateCapabilityDto {
  @IsArray()
  @ArrayNotEmpty()
  destinations!: unknown[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

class AcceptRequestsDto {
  @Type(() => Boolean)
  @IsBoolean()
  accepts!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

class LifecycleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

class ListQueryDto {
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
 * PHASE 2 STEP 2.2A — Seller Commercial Capabilities (partner-own контракт).
 * Ownership: actor.partnerId (единственный security source); body/query НЕ
 * являются security source (forged sellerId/status/version/temporal → 422,
 * stale version → 409, чужой id → neutral 404).
 */
@Controller("partner/reverse")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  @Get("capabilities")
  @RequirePermissions("reverse.capability.read_own")
  listOwn(@CurrentUser() actor: AuthedRequest["user"], @Query() query: ListQueryDto) {
    return this.capabilities.listOwn(actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Post("capabilities")
  @RequirePermissions("reverse.capability.write_own")
  createOwn(@Body() dto: CreateCapabilityDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body (не срезан ValidationPipe) — explicit deny forged ownership/
    // lifecycle/version/temporal (sellerId/partnerId/status/version/... → 422).
    assertNoForbiddenKeys(req.body, CAPABILITY_CREATE_FORBIDDEN_KEYS);
    return this.capabilities.createOwn(actor, dto);
  }

  @Get("capabilities/:id")
  @RequirePermissions("reverse.capability.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.capabilities.getOwn(actor, id);
  }

  @Get("capabilities/:id/history")
  @RequirePermissions("reverse.capability.read_own")
  historyOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.capabilities.historyOwn(actor, id);
  }

  @Patch("capabilities/:id")
  @RequirePermissions("reverse.capability.write_own")
  updateOwn(@Body() dto: UpdateCapabilityDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    // Raw body — explicit deny: categoryId immutable, ownership/lifecycle/
    // version/temporal → 422 (а не silent strip/mutation).
    assertNoForbiddenKeys(req.body, CAPABILITY_UPDATE_FORBIDDEN_KEYS);
    return this.capabilities.updateOwn(actor, id, dto);
  }

  @Post("capabilities/:id/accept-requests")
  @RequirePermissions("reverse.capability.write_own")
  setAcceptsRequests(@Body() dto: AcceptRequestsDto, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.capabilities.setAcceptsRequests(actor, id, dto.accepts, dto.expectedVersion);
  }

  @Post("capabilities/:id/activate")
  @RequirePermissions("reverse.capability.write_own")
  activateOwn(@Body() dto: LifecycleDto, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.capabilities.activateOwn(actor, id, dto.expectedVersion);
  }

  @Post("capabilities/:id/deactivate")
  @RequirePermissions("reverse.capability.write_own")
  deactivateOwn(@Body() dto: LifecycleDto, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.capabilities.deactivateOwn(actor, id, dto.expectedVersion);
  }
}
