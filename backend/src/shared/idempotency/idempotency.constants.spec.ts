/**
 * PHASE 2 STEP 2.12H — header contract unit tests (prompt §7, adversarial §36).
 *
 * Deterministic server-side validation: missing/empty/whitespace/oversized/
 * invalid printable chars → error; duplicate (Array) values → deterministic
 * reject; valid keys pass. Node/Express join duplicate header values with
 * ", " (кроме set-cookie) — запятая не проходит charset → детерминированный 400;
 * Array-форма покрыта здесь (framework-независимо).
 */
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  validateIdempotencyKeyHeader,
} from "./idempotency.constants";

describe("2.12H Idempotency-Key header contract", () => {
  it("1. missing / undefined → error", () => {
    expect(() => validateIdempotencyKeyHeader(undefined)).toThrow(/required/);
  });

  it("2. empty string → error", () => {
    expect(() => validateIdempotencyKeyHeader("")).toThrow(/required/);
  });

  it("3. whitespace-only → error (charset)", () => {
    expect(() => validateIdempotencyKeyHeader("   ")).toThrow(/unsupported characters/);
  });

  it("4. длина > max → error", () => {
    expect(() => validateIdempotencyKeyHeader("a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1))).toThrow(/128/);
    expect(() => validateIdempotencyKeyHeader("a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH))).not.toThrow();
  });

  it("5. invalid printable chars (пробел/!,/@/=/;/,#) → error", () => {
    for (const bad of ["bad key!", "key,with-comma", "key;with-semicolon", "key@domain", "key=value", "key#frag", "key/with/slash"]) {
      expect(() => validateIdempotencyKeyHeader(bad)).toThrow(/unsupported characters/);
    }
  });

  it("6. duplicate header values (Array form) → deterministic error", () => {
    expect(() => validateIdempotencyKeyHeader(["k1", "k2"])).toThrow(/multiple/);
  });

  it("7. valid keys pass", () => {
    expect(() => validateIdempotencyKeyHeader("k")).not.toThrow();
    expect(() => validateIdempotencyKeyHeader("req_123.abc~DEF-xyz")).not.toThrow();
    expect(() => validateIdempotencyKeyHeader("a".repeat(IDEMPOTENCY_KEY_MAX_LENGTH))).not.toThrow();
  });
});
