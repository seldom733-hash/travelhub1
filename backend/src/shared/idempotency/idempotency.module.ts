/**
 * PHASE 2 STEP 2.12H — IdempotencyModule (platform infrastructure).
 *
 * Регистрация: AppModule импортирует модуль и регистрирует IdempotencyInterceptor
 * как APP_INTERCEPTOR (глобально — passthrough для незащищённых эндпоинтов).
 */
import { Module } from "@nestjs/common";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";

@Module({
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
