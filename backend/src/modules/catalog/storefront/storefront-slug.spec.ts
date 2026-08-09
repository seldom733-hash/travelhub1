/**
 * Unit — Partner Storefront slug policy (Phase 1 Step 1.12.1 §7/§21):
 *  - normalization (lowercase/trim/collapse);\n *  - reserved slug rejection;\n *  - invalid slug rejection (URL-safety, path traversal, length);
 *  - valid slug acceptance.
 */
import { normalizeStorefrontSlug, RESERVED_STOREFRONT_SLUGS, STOREFRONT_SLUG_MAX_LENGTH, validateStorefrontSlug } from "./storefront-slug";

describe("storefront-slug", () => {
  it("нормализация: lowercase, trim, collapse пробелов/подчёркиваний/дублей «-»", () => {
    expect(normalizeStorefrontSlug("  My Cool Store  ")).toBe("my-cool-store");
    expect(normalizeStorefrontSlug("my__cool---store")).toBe("my-cool-store");
    expect(normalizeStorefrontSlug("  UpperCase  Name ")).toBe("uppercase-name");
    expect(normalizeStorefrontSlug("a - b")).toBe("a-b");
  });

  it("валидные slug принимаются (URL-safe)", () => {
    expect(validateStorefrontSlug("my-store").ok).toBe(true);
    expect(validateStorefrontSlug("baku-tours-2026").ok).toBe(true);
    expect(validateStorefrontSlug("a1-b2").ok).toBe(true);
    const res = validateStorefrontSlug("  My Store  ");
    expect(res.ok).toBe(true);
    expect(res.slug).toBe("my-store");
  });

  it("пустой slug отклоняется", () => {
    const res = validateStorefrontSlug("   ");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("required");
  });

  it("reserved slug отклоняется (spec §7 + реальные route-конфликты)", () => {
    for (const reserved of ["app", "api", "login", "register", "search", "products", "categories", "store", "partner", "account", "admin", "auth", "public", "media", "orders", "storefronts"]) {
      const res = validateStorefrontSlug(reserved);
      expect(res.ok).toBe(false);
      expect(res.error).toContain("reserved");
    }
    expect(RESERVED_STOREFRONT_SLUGS.size).toBeGreaterThanOrEqual(11);
  });

  it("invalid slug отклоняется: path traversal / encoded tricks / не-ASCII", () => {
    for (const bad of ["..", "../admin", "a/b", "a\\b", "a.b", "a%2Fb", "a#b", "a?b", "a b/c", "привет-мир", "a@b", "a:b", "a=b", "a+b", "a~b"]) {
      const res = validateStorefrontSlug(bad);
      expect(res.ok).toBe(false);
    }
  });

  it("нормализуемые варианты становятся валидными URL-safe slug (не silent mutation опасных символов)", () => {
    // Подчёркивания/дубли «-»/крайние «-»/пробелы — детерминированная нормализация,
    // а не удаление опасных символов (точки/слэши/проценты остаются недопустимыми).
    expect(validateStorefrontSlug("a_b").slug).toBe("a-b");
    expect(validateStorefrontSlug("a--b").slug).toBe("a-b");
    expect(validateStorefrontSlug("-a").slug).toBe("a");
    expect(validateStorefrontSlug("a-").slug).toBe("a");
    expect(validateStorefrontSlug("  Az  Tours  ").slug).toBe("az-tours");
  });

  it("превышение длины отклоняется", () => {
    const long = "a".repeat(STOREFRONT_SLUG_MAX_LENGTH + 1);
    const res = validateStorefrontSlug(long);
    expect(res.ok).toBe(false);
    expect(res.error).toContain(String(STOREFRONT_SLUG_MAX_LENGTH));
  });

  it("граница длины принимается", () => {
    expect(validateStorefrontSlug("a".repeat(STOREFRONT_SLUG_MAX_LENGTH)).ok).toBe(true);
  });

  it("детерминированность: одинаковый вход → одинаковый slug", () => {
    expect(validateStorefrontSlug("  Az  Tours  ").slug).toBe(validateStorefrontSlug("az-tours").slug);
  });
});
