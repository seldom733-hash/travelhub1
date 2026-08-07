import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY, type PermissionResolver } from "./decorators";
import type { AuthedRequest } from "./jwt-auth.guard";

type PermissionMetadata = string[] | PermissionResolver;

/**
 * Проверка granular permissions (RBAC Matrix §4): эндпоинт требует ВСЕ
 * перечисленные права (AND). Права пользователя загружены JwtAuthGuard из БД.
 * Метаданные могут быть resolver-функцией (права по содержимому запроса).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<PermissionMetadata>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    if (!user) return true; // public-эндпоинт без auth — не блокируем

    const required = typeof metadata === "function" ? metadata(request) : metadata;
    if (required.length === 0) return true;

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
