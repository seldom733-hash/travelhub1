/**
 * Partner Storefront slug policy (Phase 1 Step 1.12.1 §7).
 *
 * Требования:
 *  - normalized: lowercase, trim, внутренние пробелы/подчёркивания → «-»,
 *    недопустимые символы не транслитерируются и не «чистятся молча» — после
 *    нормализации slug валидируется строгим regex (invalid → 422);
 *  - URL-safe, без path traversal / encoded routing tricks: только
 *    [a-z0-9] и «-» между сегментами (никаких «.», «..», «%», «/», «\\», «#», «?»);
 *  - ограниченная длина: <= 60 символов;
 *  - case-normalized: всегда lowercase;
 *  - reserved system slugs: app/api/login/... + реальные конфликты проекта
 *    (фактические public/internal route сегменты TravelHub);
 *  - immutable после создания: PATCH не принимает slug (см. storefront service);
 *  - race на одинаковый slug → DB unique constraint → controlled 409 (не raw 500).
 */
export const STOREFRONT_SLUG_MAX_LENGTH = 60;

/** Резервированные системные slug (маршруты/сервисы TravelHub + spec §7). */
export const RESERVED_STOREFRONT_SLUGS: ReadonlySet<string> = new Set([
  // Spec §7: минимальный обязательный set.
  "app",
  "api",
  "login",
  "register",
  "search",
  "products",
  "categories",
  "store",
  "partner",
  "account",
  "admin",
  // Реальные конфликты проекта (фактические route-сегменты TravelHub):
  "auth",
  "users",
  "public",
  "media",
  "moderation",
  "product",
  "category",
  "partners",
  "customers",
  "suppliers",
  "orders",
  "bookings",
  "onboarding",
  "seller-profiles",
  "seller-profile",
  "storefronts",
  "storefront",
  "checkout",
  "checkouts",
  "payment",
  "payments",
  "sales",
  "finance",
  "reviews",
  "chat",
  "settings",
  "health",
  "docs",
]);

/** Строгий URL-safe формат: lowercase сегменты, «-» только между ними. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SlugValidationResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

/**
 * Нормализация: trim + lowercase + collapse (пробелы/подчёркивания/дубли «-»).
 * НЕ удаляет «неудобные» символы молча — итоговый slug обязан пройти SLUG_RE.
 */
export function normalizeStorefrontSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Валидация + нормализация входного slug. Вернёт результат (без throw). */
export function validateStorefrontSlug(raw: string): SlugValidationResult {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, error: "Slug is required" };
  }
  const slug = normalizeStorefrontSlug(raw);
  if (slug.length > STOREFRONT_SLUG_MAX_LENGTH) {
    return { ok: false, error: `Slug must be at most ${STOREFRONT_SLUG_MAX_LENGTH} characters` };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "Slug must be URL-safe: lowercase latin letters, digits and single hyphens between segments (no dots, slashes, percent-encoding, underscores, spaces or non-ASCII)",
    };
  }
  if (RESERVED_STOREFRONT_SLUGS.has(slug)) {
    return { ok: false, error: `Slug "${slug}" is reserved and cannot be used` };
  }
  return { ok: true, slug };
}
