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
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ArrayNotEmpty } from "class-validator";
import { Request } from "express";
import { RequestsService } from "./requests.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import {
  assertNoForbiddenKeys,
  REQUEST_CREATE_FORBIDDEN_KEYS,
  REQUEST_UPDATE_FORBIDDEN_KEYS,
  REQUEST_LIFECYCLE_FORBIDDEN_KEYS,
} from "../../shared/field-validation";

class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsArray()
  @ArrayNotEmpty()
  destinations!: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serviceDateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serviceDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infants?: number;

  @IsOptional()
  budget?: unknown;

  @IsOptional()
  preferences?: unknown;
}

class UpdateRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  destinations?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serviceDateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  serviceDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infants?: number;

  @IsOptional()
  budget?: unknown;

  @IsOptional()
  preferences?: unknown;

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
 * PHASE 2 STEP 2.2B — Buyer Request Foundation (buyer-own контракт).
 * Ownership: actor.customerId (единственный security source); body/query НЕ
 * security source (forged buyerId/customerId/ownerId/status/version/source/
 * temporal → 422; stale version → 409; чужой id → neutral 404).
 * Seller/PARTNER доступа НЕ имеют (2.2C distribution — позже).
 */
@Controller("buyer/requests")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  @RequirePermissions("reverse.request.read_own")
  listOwn(@CurrentUser() actor: AuthedRequest["user"], @Query() query: ListQueryDto) {
    return this.requests.listOwn(actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Post()
  @RequirePermissions("reverse.request.write_own")
  createOwn(@Body() dto: CreateRequestDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body — explicit deny forged ownership/lifecycle/source/version/temporal.
    assertNoForbiddenKeys(req.body, REQUEST_CREATE_FORBIDDEN_KEYS);
    return this.requests.createOwn(actor, dto);
  }

  @Get(":id")
  @RequirePermissions("reverse.request.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.requests.getOwn(actor, id);
  }

  @Get(":id/history")
  @RequirePermissions("reverse.request.read_own")
  historyOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.requests.historyOwn(actor, id);
  }

  @Patch(":id")
  @RequirePermissions("reverse.request.write_own")
  updateOwn(@Body() dto: UpdateRequestDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    // Raw body — explicit deny: ownership/lifecycle/source/version/temporal → 422.
    assertNoForbiddenKeys(req.body, REQUEST_UPDATE_FORBIDDEN_KEYS);
    return this.requests.updateOwn(actor, id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions("reverse.request.write_own")
  submitOwn(
    @Body() dto: LifecycleDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
    @Param("id") id: string,
  ) {
    // Lifecycle-команды принимают ТОЛЬКО expectedVersion: forged lifecycle/
    // ownership/source/temporal → 422 (loud, не silent-strip).
    assertNoForbiddenKeys(req.body, REQUEST_LIFECYCLE_FORBIDDEN_KEYS);
    return this.requests.submitOwn(actor, id, dto.expectedVersion);
  }

  @Post(":id/cancel")
  @RequirePermissions("reverse.request.write_own")
  cancelOwn(
    @Body() dto: LifecycleDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
    @Param("id") id: string,
  ) {
    assertNoForbiddenKeys(req.body, REQUEST_LIFECYCLE_FORBIDDEN_KEYS);
    return this.requests.cancelOwn(actor, id, dto.expectedVersion);
  }
}
