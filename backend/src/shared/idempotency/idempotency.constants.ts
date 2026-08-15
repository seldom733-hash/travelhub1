/**
 * PHASE 2 STEP 2.12H — External API Idempotency Contract: constants.
 *
 * V1 protected operation set = minimal PSP-readiness set (prompt §5):
 * the payment-initiation boundary that future Step 2.12B builds on
 * (POST /api/v1/finance/payments). Не оборачиваем «каждый POST/PATCH/DELETE»:
 * переходы (confirm/fail/cancel) остаются CAS-идемпотентными по state machine
 * (повторный переход → 409 — канонический контракт), и их HTTP-ретрай
 * идемпотентен без этого слоя. Новые защищённые операции добавляются явно
 * в registry (fail-closed: неизвестная операция → ошибка при декорировании).
 */
export const IDEMPOTENCY_HEADER = "idempotency-key";

/** Max length (chars) — bounded, opaque, URL-safe charset. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** URL-safe charset: RFC 3986 unreserved + `~` — без пробелов/control chars. */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]+$/;

/** Реестр защищённых операций (explicit metadata). */
export const IDEMPOTENT_OPERATIONS = new Set<string>(["payment.create"]);

/** Metadata key для @Idempotent() декоратора. */
export const IDEMPOTENT_KEY = "idempotentOperation";

/** Технический bound stale-claim (crash recovery), ms. НЕ бизнес-policy:
 *  это граница «запрос считался завершённым процессом, который умер».
 *  НЕ retention: completed-слоты живут до явного cleanup-решения (§17: V1
 *  no-auto-expiry / deferred cleanup).
 */
export const IDEMPOTENCY_STALE_AFTER_MS = 30_000;

/** Bounded in-progress wait: poll интервал и максимум ожидания. */
export const IDEMPOTENCY_POLL_INTERVAL_MS = 100;
export const IDEMPOTENCY_MAX_WAIT_MS = 2_000;

/** Проверка ключа: синхронная, детерминированная (fail-closed). */
export function validateIdempotencyKeyHeader(value: unknown): void {
  // Express: одно значение — string; дубликат заголовка — string[].
  if (Array.isArray(value)) {
    throw new Error("multiple Idempotency-Key header values");
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Idempotency-Key header is required for this operation");
  }
  if (value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new Error("Idempotency-Key must not exceed 128 characters");
  }
  if (!IDEMPOTENCY_KEY_RE.test(value)) {
    throw new Error("Idempotency-Key contains unsupported characters");
  }
}
