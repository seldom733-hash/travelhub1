/**
 * Step 2.17 — CORS allowlist (вместо origin:true).
 *
 * Чистая функция: парсит список разрешённых origins из CORS_ORIGINS (CSV).
 * Default — http://localhost:3000 (dev). Произвольные origins (не из списка)
 * НЕ разрешаются. `credentials: true` — только вместе с явным allowlist
 * (cookie-сессии; никогда wildcard).
 */
export function parseCorsOrigins(raw?: string): string[] {
  return (raw ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Проверка: разрешён ли origin (для CORS-мидлвары/тестов). */
export function isCorsOriginAllowed(origins: string[], origin: string | undefined): boolean {
  if (!origin) return false; // non-browser/non-CORS запросы — не через CORS
  return origins.includes(origin);
}
