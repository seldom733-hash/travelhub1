/**
 * PHASE 2 STEP 2.12H — @Idempotent() decorator.
 *
 * Явная server-owned metadata защищённой операции (prompt §5): стабильная
 * строковая operation identity, НЕ зависящая от host/request-id/raw URL.
 * Неизвестная операция → fail-closed при декорировании (ошибка конфигурации
 * видна при загрузке модуля, а не в рантайме).
 */
import { SetMetadata } from "@nestjs/common";
import { IDEMPOTENT_KEY, IDEMPOTENT_OPERATIONS } from "./idempotency.constants";

export function Idempotent(operation: string): MethodDecorator {
  if (!IDEMPOTENT_OPERATIONS.has(operation)) {
    throw new Error(
      `[idempotency] Unknown protected operation "${operation}". ` +
        `Register it in IDEMPOTENT_OPERATIONS (idempotency.constants.ts) before use.`,
    );
  }
  return SetMetadata(IDEMPOTENT_KEY, operation);
}
