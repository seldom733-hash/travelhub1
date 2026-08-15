import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AuthService, type AuthUser } from "./auth.service";
import { IS_PUBLIC_KEY } from "./decorators";
import { setRequestActor } from "../../shared/request-context";

export interface AuthedRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Missing access token");

    let payload: { sub?: string; tv?: number };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: string; tv?: number }>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (!payload.sub) throw new UnauthorizedException("Invalid token payload");

    // Права загружаются из БД на каждый запрос — смена роли применяется сразу.
    // Step 2.17: payload.tv против user.tokenVersion — logout/revoke отклоняет
    // ранее выданные токены (даже не истёкшие).
    request.user = await this.auth.me(payload.sub, payload.tv);
    // Step 1.15A §10: authenticated actor в request context (внутри ALS-scope
    // middleware-а) — envelope.actor = {type:"USER", id} для бизнес-событий
    // этого запроса. Только canonical userId, без username/email/permissions.
    setRequestActor({ type: "USER", id: request.user.id });
    return true;
  }

  /**
   * Step 2.17: токен из Authorization: Bearer (API-клиенты/e2e, legacy контракт)
   * ИЛИ из HttpOnly cookie `travelhub.auth` (браузерная сессия, установлена
   * сервером при login — JS не может её прочитать). Приоритет: header.
   */
  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    if (type === "Bearer" && token) return token;
    const cookie = (request.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("travelhub.auth="))
      ?.slice("travelhub.auth=".length);
    return cookie ? decodeURIComponent(cookie) : undefined;
  }
}
