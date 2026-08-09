/**
 * PHASE 1 STEP 1.6 — Public Marketplace Routing & Frontend Split.
 *
 * Централизованная route-классификация + legacy redirect map + ролевые границы.
 * Чистые функции — покрываются unit-тестами (frontend/lib/routes.spec.ts).
 *
 * Главный invariant:
 *   /        = Public Marketplace (anonymous)
 *   /app/*   = Internal TravelHub application (auth + RBAC)
 *   /partner/* = Partner Cabinet (Step 1.8)
 *   /account/* = Buyer Cabinet (Step 1.13)
 *   PARTNER/BUYER — ВНЕШНИЕ роли: не получают внутренние employee Work Centers.
 */
export const INTERNAL_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "FINANCE",
  "MARKETER",
  "ANALYST",
  "MODERATOR",
  "SALES_MANAGER",
  "OPERATOR",
] as const;

export const EXTERNAL_ROLES = ["PARTNER", "BUYER"] as const;

export const isInternalRole = (role: string): boolean => (INTERNAL_ROLES as readonly string[]).includes(role);

export const isExternalRole = (role: string): boolean => (EXTERNAL_ROLES as readonly string[]).includes(role);

/**
 * Целевой домашний route после входа (Step 1.6 + 1.8 + 1.13):
 *  - внутренние роли → /app/dashboard;
 *  - PARTNER → /partner (Partner Cabinet, Step 1.8);
 *  - BUYER → /account (Buyer Cabinet, Step 1.13).
 */
export const homeForRole = (role: string): string => {
  if (isInternalRole(role)) return "/app/dashboard";
  if (role === "PARTNER") return "/partner";
  if (role === "BUYER") return "/account";
  return "/";
};

/** Path находится под Partner Cabinet (/partner/*). */
export const isPartnerPath = (raw: string): boolean => {
  const path = raw.split(/[?#]/, 1)[0];
  return path === "/partner" || path.startsWith("/partner/");
};

/**
 * Legacy internal routes → canonical /app/* (мigration map, Step 1.6 §9).
 * Старые URL не удаляются — оставляются redirect-стабы (app/<legacy>/page.tsx → redirect()).
 */
export const LEGACY_INTERNAL_REDIRECTS: Record<string, string> = {
  "/catalog": "/app/catalog",
  "/orders": "/app/orders",
  "/bookings": "/app/bookings",
  "/customers": "/app/crm",
  "/users": "/app/users",
};

/** Legacy route → canonical target (null — не legacy). */
export const resolveLegacyRedirect = (path: string): string | null => LEGACY_INTERNAL_REDIRECTS[path] ?? null;

/** Публичные пути (anonymous). Внутренние — всё под /app/* (плюс /login как auth entry). */
export const PUBLIC_PATH_PREFIXES = ["/search", "/products", "/categories"] as const;

/**
 * Публичный ли путь. Устойчив к query/hash (middleware использует pathname,
 * но вызывающие могут передать полный URL) — `?` и `#` отбрасываются до сравнения.
 */
export const isPublicPath = (raw: string): boolean => {
  const path = raw.split(/[?#]/, 1)[0];
  return path === "/" || PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
};

/**
 * Валидация `?next=` из query (анти-open-redirect): только относительные пути,
 * без // и /\\ (не URL). Используется login'ом после редиректа middleware.
 */
/**
 * Валидация `?next=` из query (анти-open-redirect): только относительные пути,
 * без // и /\\ (не URL). Декодирование ДО проверки закрывает encoded-slash
 * вариант (/%2F%2Fevil.com) — проверка идёт по декодированной форме, а возврат
 * сохраняет исходную (encoded) форму для корректного router.replace.
 */
export const safeNextPath = (raw: string | null | undefined, fallback = "/"): string => {
  if (!raw || !raw.startsWith("/")) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* malformed %-sequence → treat as-is */
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  return raw;
};

/** Путь под аккаунтом (/account/*) — защищённый внешний контур (Step 1.9). */
export const isAccountPath = (raw: string): boolean => {
  const path = raw.split(/[?#]/, 1)[0];
  return path === "/account" || path.startsWith("/account/");
};

/**
 * Step 1.9 §5-6 + Step 1.13 §16 — целевой route после login/register
 * (safe return context, сохраняет deep-link).
 *
 *  - internal-роль: ?next= только под /app/*, иначе /app/dashboard;
 *  - PARTNER: ?next= под /partner/*, иначе /partner;
 *  - BUYER:   ?next= public Marketplace-путь (/, /products/*, /search*,
 *    /categories/*) ИЛИ /account/* (deep-link в Buyer Cabinet, Step 1.13 §16:
 *    anonymous /account/orders → login → /account/orders); иначе /account;
 *    BUYER никогда не попадает в /app/* или /partner/*;
 *  - иное: /.
 * next уже провалидирован safeNextPath (анти-open-redirect) вызывающим.
 */
export const postLoginTarget = (role: string, next?: string | null): string => {
  const safe = safeNextPath(next);
  if (isInternalRole(role)) return safe.startsWith("/app") ? safe : "/app/dashboard";
  if (role === "PARTNER") return isPartnerPath(safe) ? safe : "/partner";
  if (role === "BUYER") {
    // Явный public/deep-link в кабинет сохраняется; без next (или forged) → /account.
    if (next && (isPublicPath(safe) || isAccountPath(safe))) return safe;
    return "/account";
  }
  return "/";
};
