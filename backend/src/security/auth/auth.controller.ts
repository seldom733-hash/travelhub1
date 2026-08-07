import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AuthService, type LoginResult } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SecurityService } from "../security.service";
import type { AuthedRequest } from "./jwt-auth.guard";

class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
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
  register(@Body() dto: RegisterDto): Promise<LoginResult> {
    return this.auth.register(dto);
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
