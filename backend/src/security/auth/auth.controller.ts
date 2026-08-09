import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AuthService, type LoginResult } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SecurityService } from "../security.service";
import { assertNoForbiddenKeys, REGISTER_FORBIDDEN_KEYS } from "../../shared/field-validation";
import { ApplicantType } from "../../generated/prisma/enums";
import type { AuthedRequest } from "./jwt-auth.guard";
import type { Request } from "express";

/**
 * Step 1.9 — публичная self-registration BUYER.
 * Identity: email (обязателен), username опционален (default = email).
 * Роль НЕ принимается (всегда BUYER); role/partnerId/customerId/permissions/…
 * из body — явный 422 (ValidationPipe whitelist всё равно срезал бы их, но
 * требование clarification — явное отклонение forged полей).
 */
class RegisterDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

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
  @MaxLength(200)
  fullName?: string;
}

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

/**
 * Step 1.10 — публичная self-registration PARTNER (onboarding). Роль НЕ
 * принимается (всегда PARTNER); role/partnerId/status/permissions/… из body —
 * 422 (assertNoForbiddenKeys + whitelist). Registration ≠ approval: создаётся
 * только DRAFT PartnerApplication, selling-доступ не выдаётся.
 */
class PartnerRegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsEnum(ApplicantType)
  applicantType!: ApplicantType;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  brandName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];

  @IsBoolean()
  termsAccepted!: boolean;
}

/** REST API: /api/v1/auth → Auth (Phase 2). */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly security: SecurityService,
  ) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<LoginResult> {
    // Explicit rejection forged identity fields (role/partnerId/customerId/…).
    assertNoForbiddenKeys(req.body, REGISTER_FORBIDDEN_KEYS);
    return this.auth.register(dto);
  }

  @Public()
  @Post("partner-register")
  partnerRegister(@Body() dto: PartnerRegisterDto, @Req() req: Request): Promise<LoginResult> {
    // Explicit rejection forged identity fields (role/partnerId/customerId/…).
    assertNoForbiddenKeys(req.body, REGISTER_FORBIDDEN_KEYS);
    return this.auth.registerPartner(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.username, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthedRequest["user"]) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Req() req: AuthedRequest): Promise<{ ok: true }> {
    await this.security.audit(undefined, {
      userId: req.user.id,
      username: req.user.username,
      action: "auth.logout",
      resource: "User",
      resourceId: req.user.id,
      ip: req.ip,
    });
    return { ok: true };
  }
}
