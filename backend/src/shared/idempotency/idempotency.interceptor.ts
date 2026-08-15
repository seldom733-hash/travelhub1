/**
 * PHASE 2 STEP 2.12H — External API Idempotency Interceptor.
 *
 * Глобальный APP_INTERCEPTOR: для эндпоинтов с @Idempotent("operation")
 * метаданными выполняет полный контракт. Для остальных — passthrough.
 *
 * Security pipeline (prompt §18, HARD GATE): guards (JwtAuthGuard →
 * PermissionsGuard) выполняются ДО interceptors, поэтому:
 *  - анонимный запрос → 401 ДО чтения Idempotency-Key (T11);
 *  - RBAC-отказ → 403 ДО слота (T12) — replay не обходит auth/RBAC;
 *  - principal scope берётся ТОЛЬКО из request.user (серверный контекст),
 *    не из body/query (prompt §7).
 *
 * Fingerprint (prompt §9): валидируем body тем же ValidationPipe, что и
 * глобальный (GLOBAL_VALIDATION_PIPE_OPTIONS) — fingerprint строится по
 * canonical/validated DTO, а не по raw transport. Validation-ошибка бросается
 * ДО claim → слот не создаётся, ключ не poisoning.
 *
 * Replay (prompt §15): возвращаем только safe client-visible status + body;
 * заголовки (Set-Cookie/Authorization/tracing/request-ids) НЕ реплеятся
 * (хранится только responseStatus + responseBody).
 */
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  type Type,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { Observable, lastValueFrom, of } from "rxjs";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { ForbiddenError } from "../errors";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../validation-pipe";
import { IDEMPOTENT_KEY, validateIdempotencyKeyHeader } from "./idempotency.constants";
import { deriveRequestFingerprint } from "./idempotency.fingerprint";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const operation = this.reflector.getAllAndOverride<string>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!operation) return next.handle();

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // Guards уже отработали; защищённые операции authenticated-only → fail-closed.
    const user = request.user;
    if (!user) {
      throw new ForbiddenError("Idempotent operation requires an authenticated principal");
    }

    let clientKey: string;
    try {
      validateIdempotencyKeyHeader(request.headers["idempotency-key"]);
      clientKey = request.headers["idempotency-key"] as string;
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "Invalid Idempotency-Key");
    }

    const validatedBody = await this.validateBody(context, request);
    const fingerprint = deriveRequestFingerprint(
      (request.params ?? {}) as Record<string, string>,
      validatedBody,
    );

    const result = await this.idempotency.execute({
      scope: { type: "USER", id: user.id },
      operation,
      clientKey,
      fingerprint,
      execute: async () => {
        const body = await lastValueFrom(next.handle());
        const res = context.switchToHttp().getResponse();
        const status = this.deriveStatus(res.statusCode, request.method);
        return { status, body };
      },
    });

    if (result.replay) {
      const res = context.switchToHttp().getResponse();
      res.status(result.status);
      return of(result.body);
    }
    return of(result.body);
  }

  /**
   * Валидируем body тем же ValidationPipe (GLOBAL_VALIDATION_PIPE_OPTIONS) и
   * возвращаем canonical DTO для fingerprint. Без DTO (нет @Body() класса) —
   * raw body (для V1 protected set DTO есть всегда).
   */
  private async validateBody(context: ExecutionContext, request: AuthedRequest): Promise<unknown> {
    const handler = context.getHandler();
    const metatype = this.findBodyMetatype(handler);
    if (!metatype || metatype === Object) return request.body ?? {};
    try {
      return await new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS).transform(request.body ?? {}, {
        metatype: metatype as Type<unknown>,
        type: "body",
        data: undefined,
      });
    } catch (err) {
      // Validation-ошибка ДО claim — слот не создаётся.
      if (err instanceof Error) throw err;
      throw new BadRequestException("Invalid request body");
    }
  }

  /** Метатип @Body() параметра из route-args metadata + design:paramtypes. */
  private findBodyMetatype(handler: Function): unknown {
    const designTypes = Reflect.getMetadata("design:paramtypes", handler) as unknown[] | undefined;
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, handler) as
      | Record<string, { type: number; data?: unknown }>
      | undefined;
    if (!designTypes || !args) return undefined;
    const entry = Object.entries(args).find(
      ([, meta]) => meta.type === RouteParamtypes.BODY && meta.data === undefined,
    );
    if (!entry) return undefined;
    const metatype = designTypes[Number(entry[0])];
    return metatype;
  }

  /**
   * Эффективный HTTP status на момент завершения handler-а. Nest применяет
   * дефолт @Post()=201 ПОСЛЕ interceptor-ов, поэтому на этом этапе
   * res.statusCode ещё 200 (express default) — выводим дефолт по методу.
   * Явно установленный статус (res.status(x)) сохраняется.
   */
  private deriveStatus(current: number, method: string): number {
    if (current && current !== 200) return current;
    return method === "POST" ? 201 : 200;
  }
}
