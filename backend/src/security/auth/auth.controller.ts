import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AuthService, type LoginResult } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SecurityService } from "../security.service";
import { ActivationService } from "../activation.service";
import { LoginThrottleService, normalizeLoginKey } from "../../shared/login-throttle.service";
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
 *
 * M4.3 §15 (ADR-0016): country + phone — phone-first identity. Оба поля
 * опциональны в API (legacy-совместимость 42+ существующих контрактов);
 * фронтенд buyer-registration ВСЕГДА отправляет оба. При наличии — строгая
 * валидация в сервисе (2-letter ISO country; phone нормализуется в canonical
 * E.164 с country как default region, невалидный номер → 422).
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

  /** M4.3: ISO-3166 alpha-2 (валидация строго в сервисе: ^[A-Z]{2}$). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  country?: string;

  /** M4.3: телефон в любом поддерживаемом формате (нормализация → E.164). */
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone?: string;
}

class LoginDto {
  /** M4.3 §12: identifier — canonical phone (phone-first) ИЛИ legacy username. */
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

/** M4.3 §19: consume activation token (public; throttled per IP). */
class ActivateDto {
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  token!: string;
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
    private readonly activation: ActivationService,
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
    // Step 2.17: brute-force защита — sliding window per `identifier|ip`.
    // M4.3 §13: identifier нормализуется (canonical E.164 для телефона,
    // lowercase для username) — ротация формата записи НЕ обходит окно.
    // Успешный вход сбрасывает окно. Ограничение: in-memory per-instance.
    const throttleKey = `${normalizeLoginKey(dto.username)}|${req.ip ?? "unknown"}`;
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

  /**
   * M4.3 §19 (option B) — consume activation token (public).
   * Mechanics: single-use + expiry + SHA-256 storage; отказы неотличимы
   * (401 без enumeration); throttled per IP (защита перебора). Delivery
   * отложена — зависимость задокументирована в M4-IMPLEMENTATION-REPORT.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("activate")
  async activate(@Body() dto: ActivateDto, @Req() req: Request): Promise<{ ok: true; userId: string }> {
    const throttleKey = `activation|${req.ip ?? "unknown"}`;
    this.throttle.check(throttleKey);
    const result = await this.activation.consume(dto.token);
    this.throttle.reset(throttleKey);
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
