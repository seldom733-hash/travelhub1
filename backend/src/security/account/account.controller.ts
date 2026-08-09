import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { AccountService, type OwnProfileResult, type UpdateOwnProfileInput } from "./account.service";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { assertNoForbiddenKeys, PROFILE_FORBIDDEN_KEYS } from "../../shared/field-validation";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthedRequest } from "../auth/jwt-auth.guard";
import type { Request } from "express";

/** Пагинация read-моделей Buyer Cabinet (§8): page/pageSize, безопасный cap. */
class OwnCabinetQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

/** Только разрешённые own-поля. ValidationPipe whitelist срежет всё остальное. */
class UpdateProfileDto implements UpdateOwnProfileInput {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

/**
 * PHASE 1 STEP 1.9 + 1.13 — /api/v1/account/*.
 * userId всегда из JWT-actor; клиент не может менять role/permissions/partnerId/
 * customerId/status/username (forbidden-keys → 422 + DTO whitelist → 400).
 * Buyer Cabinet read-models (Step 1.13): strict BUYER-only role gate — даже
 * ADMIN (ALL_PERMISSIONS) и PARTNER получают явный 403: кабинет by design
 * BUYER-only, «пусто из-за отсутствия customerId» не маскирует role-gate (§5).
 */
@UseGuards(JwtAuthGuard)
@Controller("account")
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Строгий role-gate: кабинет доступен ТОЛЬКО роли BUYER (§5, §3). */
  private assertBuyerActor(user: AuthedRequest["user"]): void {
    if (user.role !== RoleCode.BUYER) {
      throw new ForbiddenException("Buyer Cabinet is available to BUYER role only");
    }
  }

  @RequirePermissions("account.profile.read")
  @Get("profile")
  getProfile(@CurrentUser() user: AuthedRequest["user"]): Promise<OwnProfileResult> {
    return this.account.getProfile(user.id);
  }

  // ── Buyer Cabinet own-scope read-models (Step 1.13) ────────────────────────
  // Объектный scope всегда из actor (JWT); никаких customerId/userId query
  // параметров — forged значения игнорируются (whitelist DTO срезает query).
  // Только узкие own-scope права + строгая роль BUYER (см. assertBuyerActor).

  @RequirePermissions("account.order.read_own")
  @Get("orders")
  getOwnOrders(@CurrentUser() user: AuthedRequest["user"], @Query() query: OwnCabinetQuery) {
    this.assertBuyerActor(user);
    return this.account.getOwnOrders(user.id, query.page, query.pageSize);
  }

  @RequirePermissions("account.booking.read_own")
  @Get("bookings")
  getOwnBookings(@CurrentUser() user: AuthedRequest["user"], @Query() query: OwnCabinetQuery) {
    this.assertBuyerActor(user);
    return this.account.getOwnBookings(user.id, query.page, query.pageSize);
  }

  @RequirePermissions("account.payment.read_own")
  @Get("payments")
  getOwnPayments(@CurrentUser() user: AuthedRequest["user"]) {
    this.assertBuyerActor(user);
    return this.account.getOwnPayments();
  }

  @RequirePermissions("account.document.read_own")
  @Get("documents")
  getOwnDocuments(@CurrentUser() user: AuthedRequest["user"]) {
    this.assertBuyerActor(user);
    return this.account.getOwnDocuments();
  }

  @RequirePermissions("account.support.read_own")
  @Get("support")
  getOwnSupport(@CurrentUser() user: AuthedRequest["user"]) {
    this.assertBuyerActor(user);
    return this.account.getOwnSupport();
  }

  @RequirePermissions("account.profile.update")
  @HttpCode(HttpStatus.OK)
  @Patch("profile")
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthedRequest["user"],
    @Req() req: Request,
  ): Promise<OwnProfileResult> {
    // Raw body (req.body не срезан ValidationPipe) — явное отклонение mass-assignment.
    assertNoForbiddenKeys(req.body, PROFILE_FORBIDDEN_KEYS);
    return this.account.updateProfile(user.id, dto);
  }
}
