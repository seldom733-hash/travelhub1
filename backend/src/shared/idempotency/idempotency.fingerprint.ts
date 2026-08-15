/**
 * PHASE 2 STEP 2.12H — canonical request fingerprint.
 *
 * Детерминированный server-derived fingerprint СЕМАНТИЧЕСКОГО запроса
 * (validated/canonical), НЕ raw transport:
 *  - property-order independent (recursive key sort);
 *  - array order preserved (semantic);
 *  - undefined = absent (omitted vs null — fail-loud distinct);
 *  - decimal/currency строки НЕ нормализуются («150.00»≠«150», «usd»≠«USD» —
 *    fail-loud per endpoint contract, та же позиция, что 2.12A canonical
 *    representation OBSERVATION);
 *  - исключает Idempotency-Key/auth/tracing/volatile metadata (они просто не
 *    входят во вход);
 *  - включает relevant path params (вход `params`);
 *  - query — вне входа по умолчанию (semantically relevant query для V1
 *    защищённого set отсутствует; документировано в arch doc);
 *  - никакой JS-float money нормализации (деньги в DTO — строки);
 *  - stable cryptographic digest (SHA-256).
 */
import { createHash } from "node:crypto";

/** Рекурсивная канонизация: sort object keys, preserve array order. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => canonicalize(v));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v === undefined) continue; // undefined = отсутствует
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value; // string | number | boolean | null
}

/** Стабильная JSON-сериализация canonicalized значения. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Fingerprint запроса: sha256(canonical({params, body})).
 * `params` — server-side path params (relevant); `body` — VALIDATED DTO
 * (канонический семантический запрос), см. idempotency.interceptor.
 */
export function deriveRequestFingerprint(params: Record<string, string>, body: unknown): string {
  return sha256Hex(stableStringify({ params: canonicalize(params), body: canonicalize(body) }));
}
