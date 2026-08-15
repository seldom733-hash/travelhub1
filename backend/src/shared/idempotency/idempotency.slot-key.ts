/**
 * PHASE 2 STEP 2.12H — idempotency slot key.
 *
 * Серверный слот = digest(scope + operation + client key). Никогда не
 * доверяем client-supplied hashes/fingerprints (prompt §3): клиент даёт только
 * opaque key; scope берётся из authenticated server context, operation — из
 * registry metadata, а семантический fingerprint — из validated DTO.
 *
 * scope: principal isolation (prompt §7) — одинаковый literal key разных
 * principals попадает в РАЗНЫЕ слоты (scopeId в составе digest). Operation:
 * одинаковый key на другой операции — независимый слот (prompt §8).
 */
import { sha256Hex, stableStringify } from "./idempotency.fingerprint";

export interface IdempotencyScope {
  /** Серверный principal scope type ("USER"). */
  type: string;
  /** Серверный principal id (authenticated user id — не из body/query). */
  id: string;
}

/**
 * Детерминированный slot key: sha256(JSON([scopeType, scopeId, operation,
 * clientKey])). Чистая функция — одинаковый вход → одинаковый слот на любом
 * instance/restart (prompt §8/§9).
 */
export function deriveSlotKey(scope: IdempotencyScope, operation: string, clientKey: string): string {
  return sha256Hex(stableStringify([scope.type, scope.id, operation, clientKey]));
}
