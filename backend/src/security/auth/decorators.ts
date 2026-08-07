import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AuthedRequest } from "./jwt-auth.guard";

export const IS_PUBLIC_KEY = "isPublic";
export const PERMISSIONS_KEY = "requiredPermissions";

/** Маркер публичного эндпоинта (без JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type PermissionResolver = (request: AuthedRequest) => string[];

/**
 * Требуемые granular permissions (ALL must be present).
 * Можно передать список прав или resolver-функцию (для проверки по телу запроса).
 */
export const RequirePermissions = (...permissions: (string | PermissionResolver)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions.length === 1 && typeof permissions[0] === "function" ? permissions[0] : permissions);

/** Текущий аутентифицированный пользователь (типизированный). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
