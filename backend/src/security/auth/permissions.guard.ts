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
    // Step 2.17: FAIL-CLOSED. Раньше public-эндпоинт с ошибочно навешанным
    // @RequirePermissions тихо пропускался (no-op) — маскировал misconfiguration.
    // Теперь: если endpoint требует прав, а authenticated user отсутствует —
    // отказ (JwtAuthGuard уже выполнился ДО PermissionsGuard в APP_GUARD-цепочке;
    // отсутствие user здесь = public/неверная конфигурация, а не легитимный вход).
    if (!user) {
      throw new ForbiddenException("Authentication required");
    }

    const required = typeof metadata === "function" ? metadata(request) : metadata;
    if (required.length === 0) return true;

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
