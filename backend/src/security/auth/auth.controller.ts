import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AuthService, type LoginResult } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SecurityService } from "../security.service";
import { LoginThrottleService } from "../../shared/login-throttle.service";
import { assertNoForbiddenKeys, REGISTER_FORBIDDEN_KEYS } from "../../shared/field-validation";
import { ApplicantType } from "../../generated/prisma/enums";
import type { AuthedRequest } from "./jwt-auth.guard";
import type { Request, Response } from "express";

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
    private readonly throttle: LoginThrottleService,
  ) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResult> {
    // Explicit rejection forged identity fields (role/partnerId/customerId/…).
    assertNoForbiddenKeys(req.body, REGISTER_FORBIDDEN_KEYS);
    const result = await this.auth.register(dto);
    // Step 2.17: единая серверная сессия — cookie ставится и при регистрации
    // (после успешного входа в неё), чтобы refresh не терял сессию.
    this.setSessionCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post("partner-register")
  async partnerRegister(@Body() dto: PartnerRegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResult> {
    // Explicit rejection forged identity fields (role/partnerId/customerId/…).
    assertNoForbiddenKeys(req.body, REGISTER_FORBIDDEN_KEYS);
    const result = await this.auth.registerPartner(dto);
    this.setSessionCookie(res, result.accessToken);
    return result;
  }

  /**
   * Step 2.17 — публичная сессионная проба (для cookie-аутентификации).
   *
   * Возвращает { user } или { user: null } — НЕ 401: frontend вызывает этот
   * эндпоинт на каждом mount (в т.ч. публичные страницы), чтобы узнать сессию
   * по HttpOnly cookie без JS-readable токена. Токен (header или cookie)
   * проверяется: невалидный/истёкший/revoked/INACTIVE → user:null (безопасно,
   * без редиректов). Отличие от /auth/me (strict 401 для защищённых контуров).
   */
  @Public()
  @Get("session")
  async session(@Req() req: Request): Promise<{ user: (AuthedRequest["user"]) | null }> {
    const user = await this.auth.sessionUser(req);
    return { user };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResult> {
    // Step 2.17: brute-force защита — sliding window per `username|ip`.
    // Успешный вход сбрасывает окно. Ограничение: in-memory per-instance.
    const throttleKey = `${dto.username.toLowerCase()}|${req.ip ?? "unknown"}`;
    this.throttle.check(throttleKey);
    const result = await this.auth.login(dto.username, dto.password);
    this.throttle.reset(throttleKey);
    // Step 2.17: серверная сессия — HttpOnly cookie (Secure в prod, SameSite=Lax,
    // path=/). JS не читает токен; Authorization-заголовок остаётся для
    // API-клиентов/e2e. Body всё ещё возвращает accessToken (legacy контракт,
    // используется e2e и API-клиентами).
    this.setSessionCookie(res, result.accessToken);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthedRequest["user"]) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    // Step 2.17: реальная инвалидация — инкремент tokenVersion делает ВСЕ
    // ранее выданные токены недействительными (даже не истёкшие).
    await this.auth.revokeSession(req.user.id);
    this.clearSessionCookie(res);
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

  /** HttpOnly-кука сессии: Secure в production, SameSite=Lax, scoped path=/. */
  private setSessionCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === "production";
    res.cookie("travelhub.auth", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000, // = JWT_EXPIRES_IN (8h default)
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie("travelhub.auth", { path: "/" });
  }
}
