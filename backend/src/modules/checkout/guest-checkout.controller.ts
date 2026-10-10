import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { IsEmail, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import type { Request } from "express";
import { Public } from "../../security/auth/decorators";
import { LoginThrottleService } from "../../shared/login-throttle.service";
import { GuestCheckoutService } from "./guest-checkout.service";

/**
 * M4.5 §23 — public guest checkout (anonymous onboarding → Request).
 *
 * @Public: endpoint без аутентификации (anonymous visitor — это и есть сценарий);
 * PermissionsGuard — no-op без @RequirePermissions. Throttle per-IP (та же
 * модель, что /auth/login): check() на входе, reset() при успехе — 10
 * неуспешных попыток/15мин → 429.
 *
 * Forbidden-поля вырезает ValidationPipe (whitelist: true): customerId/роли
 * из body игнорируются — commerce owner берётся ТОЛЬКО из Customer Resolver.
 */
class GuestCheckoutDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone!: string;

  /** 2-letter ISO country — регион для нормализации локального формата. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

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
  @MaxLength(64)
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  travelerCount?: number;

  @IsOptional()
  @IsISO8601()
  requestedServiceDate?: string;
}

@Public()
@Controller("checkout")
export class GuestCheckoutController {
  constructor(
    private readonly service: GuestCheckoutService,
    private readonly throttle: LoginThrottleService,
  ) {}

  @Post("guest")
  @HttpCode(HttpStatus.CREATED)
  async guest(@Body() dto: GuestCheckoutDto, @Req() req: Request) {
    const key = `guest-checkout|${req.ip ?? "unknown"}`;
    this.throttle.check(key);
    const result = await this.service.checkout(dto);
    this.throttle.reset(key);
    return result;
  }
}
