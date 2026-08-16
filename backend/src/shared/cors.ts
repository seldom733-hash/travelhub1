/**
 * Step 2.17 — CORS allowlist (вместо origin:true).
 *
 * Чистая функция: парсит список разрешённых origins из CORS_ORIGINS (CSV).
 * Произвольные origins (не из списка) НЕ разрешаются. `credentials: true` —
 * только вместе с явным allowlist (cookie-сессии; никогда wildcard).
 *
 * STRICT REVIEW FIX (dev-default не утекает в prod):
 *  - dev (NODE_ENV !== production), CORS_ORIGINS не задан → localhost:3000
 *    (удобный dev-default);
 *  - production, CORS_ORIGINS не задан ИЛИ пуст → ПУСТОЙ allowlist (fail-closed:
 *    все origins отклонены), а не подстановка dev-default;
 *  - явная пустая строка → пустой allowlist в любом окружении.
 */
export function parseCorsOrigins(raw: string | undefined, env: string | undefined = process.env.NODE_ENV): string[] {
  const value = raw ?? (env === "production" ? "" : "http://localhost:3000");
  return value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Проверка: разрешён ли origin (для CORS-мидлвары/тестов). */
export function isCorsOriginAllowed(origins: string[], origin: string | undefined): boolean {
  if (!origin) return false; // non-browser/non-CORS запросы — не через CORS
  return origins.includes(origin);
}
