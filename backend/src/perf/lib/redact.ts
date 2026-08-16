/**
 * Step 2.17B — artifact redaction.
 *
 * Result/environment artifacts must never contain: passwords, JWTs, cookies,
 * raw Idempotency-Key values, DB URL credentials, PSP secrets, PAN/CVV.
 * The loader never stores headers/bodies — only status + duration; redaction
 * here is a second line of defence for environment/scenario metadata.
 */

const SENSITIVE_KEY = /password|secret|token|authorization|set-cookie|cookie|idempotency|access[_-]?key|api[_-]?key/i;

export const REDACTED = "[REDACTED]";

/** Recursively replace values whose key looks sensitive. */
export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 12) return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return obj;
}

/** Scrub credentials out of a connection-string-like value (e.g. postgresql://u:p@h/db). */
export function scrubUrlCredentials(value: string): string {
  // postgresql://user:pass@host:port/db → postgresql://***@host:port/db
  const m = value.match(/^((?:postgres(?:ql)?|http|https):\/\/)([^/@\s:]+)(?::([^@\s]+))?@(.+)$/);
  if (m) {
    return `${m[1]}***@${m[4]}`;
  }
  return value;
}

/** Deep-redact and credential-scrub a metadata object before serialization. */
export function sanitizeMetadata<T>(obj: T): T {
  const cleaned = redact(obj as unknown) as T;
  return JSON.parse(JSON.stringify(cleaned), (_k, v) => (typeof v === "string" ? scrubUrlCredentials(v) : v)) as T;
}
