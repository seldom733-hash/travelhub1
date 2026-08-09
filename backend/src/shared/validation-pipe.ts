import type { ValidationPipeOptions } from "@nestjs/common";

/**
 * ЕДИНЫЙ источник истины для глобального ValidationPipe: production (src/main.ts)
 * и e2e-спеки бутают AppModule с этими же опциями — конфигурации не расходятся.
 *
 * НАМЕРЕННО БЕЗ `transformOptions.enableImplicitConversion`:
 * implicit-конверсия class-transformer портит DTO-поля `unknown[]` — каждый
 * элемент-объект молча превращается в Array-инстанс (данные ломаются ДО сервисной
 * валидации, например `validateSchemaConfig` получает `attributes[0]` как массив
 * и корректно отклоняет payload → ложный 422 для валидного запроса). Все
 * числовые/булевы query- и param-поля в проекте уже конвертируются явными
 * `@Type(() => Number)` / `@Type(() => Boolean)`, поэтому implicit-конверсия
 * не нужна; body-поля JSON приходят нативно типизированными.
 */
export const GLOBAL_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
};
