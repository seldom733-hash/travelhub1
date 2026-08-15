/**
 * PHASE 2 STEP 2.12H — canonical fingerprint / slot-key unit tests (prompt §21).
 *
 * Adversarial:
 *  - независимые эквивалентные объекты → одинаковый fingerprint;
 *  - property insertion order (вложенная сортировка);
 *  - array order preserved (семантический порядок);
 *  - decimal string semantics («150.00» vs «150» — fail-loud distinct);
 *  - currency case («usd» vs «USD» — distinct);
 *  - path param divergence;
 *  - omitted vs null — distinct;
 *  - volatile transport metadata excluded (не входит во вход);
 *  - разные principal/operation/request → правильный divergent identity;
 *  - slot key детерминирован (чистая функция, restart-stable).
 */
import { deriveRequestFingerprint, stableStringify } from "./idempotency.fingerprint";
import { deriveSlotKey } from "./idempotency.slot-key";

describe("2.12H canonical fingerprint", () => {
  it("1. независимые эквивалентные объекты → одинаковый fingerprint", () => {
    const a = deriveRequestFingerprint({}, { orderId: "ord-1", paymentMethod: "card" });
    const b = deriveRequestFingerprint({}, { orderId: "ord-1", paymentMethod: "card" });
    expect(a).toBe(b);
  });

  it("2. property insertion order — одинаковый fingerprint (вложенная сортировка)", () => {
    const a = deriveRequestFingerprint({}, { orderId: "ord-1", paymentMethod: "card", nested: { b: 1, a: 2 } });
    const b = deriveRequestFingerprint({}, { nested: { a: 2, b: 1 }, paymentMethod: "card", orderId: "ord-1" });
    expect(a).toBe(b);
  });

  it("3. array order preserved (семантический порядок массива)", () => {
    const a = deriveRequestFingerprint({}, { items: ["x", "y"] });
    const b = deriveRequestFingerprint({}, { items: ["y", "x"] });
    expect(a).not.toBe(b);
  });

  it("4. decimal string semantics: «150.00» vs «150» — distinct (fail-loud)", () => {
    const a = deriveRequestFingerprint({}, { amount: "150.00" });
    const b = deriveRequestFingerprint({}, { amount: "150" });
    expect(a).not.toBe(b);
  });

  it("5. currency case: «usd» vs «USD» — distinct (fail-loud)", () => {
    const a = deriveRequestFingerprint({}, { currency: "usd" });
    const b = deriveRequestFingerprint({}, { currency: "USD" });
    expect(a).not.toBe(b);
  });

  it("6. path param divergence — distinct fingerprint", () => {
    const a = deriveRequestFingerprint({ code: "PAY-00000001" }, {});
    const b = deriveRequestFingerprint({ code: "PAY-00000002" }, {});
    expect(a).not.toBe(b);
  });

  it("7. omitted vs null — distinct (endpoint treat as distinct)", () => {
    const a = deriveRequestFingerprint({}, { paymentMethod: null });
    const b = deriveRequestFingerprint({}, {});
    expect(a).not.toBe(b);
  });

  it("8. volatile transport metadata excluded by construction — функция принимает только {params, body}", () => {
    // deriveRequestFingerprint(params, body): headers/auth/tracing/request-id НЕ
    // являются входом (исключение — на call-site в interceptor-е, не strip в
    // canonicalizer-е). Поэтому транспортные значения в body — fail-loud distinct.
    const withFakeAuth = deriveRequestFingerprint({}, { orderId: "ord-1", authorization: "Bearer x" });
    const clean = deriveRequestFingerprint({}, { orderId: "ord-1" });
    expect(withFakeAuth).not.toBe(clean);
  });

  it("9. стабильная сериализация: числа/булевы/null", () => {
    expect(stableStringify({ b: null, a: 1 })).toBe(stableStringify({ a: 1, b: null }));
    expect(stableStringify({ flag: true })).toBe('{"flag":true}');
  });
});

describe("2.12H slot key", () => {
  const scope = { type: "USER", id: "user-1" };

  it("10. детерминирован: одинаковый вход → одинаковый слот (restart-stable)", () => {
    expect(deriveSlotKey(scope, "payment.create", "k-1")).toBe(deriveSlotKey(scope, "payment.create", "k-1"));
  });

  it("11. разные principals с одинаковым literal key → разные слоты (isolation)", () => {
    const a = deriveSlotKey({ type: "USER", id: "user-1" }, "payment.create", "same-key");
    const b = deriveSlotKey({ type: "USER", id: "user-2" }, "payment.create", "same-key");
    expect(a).not.toBe(b);
  });

  it("12. одинаковый key на другой операции → независимый слот (no wrong replay)", () => {
    const a = deriveSlotKey(scope, "payment.create", "k");
    const b = deriveSlotKey(scope, "refund.create", "k");
    expect(a).not.toBe(b);
  });

  it("13. одинаковый key/операция/principal → ТОТ ЖЕ слот (replay identity)", () => {
    expect(deriveSlotKey(scope, "payment.create", "k")).toBe(deriveSlotKey(scope, "payment.create", "k"));
  });

  it("14. slot key — детерминированный digest (64 hex), не client-forgeable значение", () => {
    const key = deriveSlotKey(scope, "payment.create", "k");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    // Отличается от самого raw key (digest, не raw хранение).
    expect(key).not.toContain("k");
  });
});
