import { describe, expect, it } from "vitest";
import {
  EXTERNAL_ROLES,
  INTERNAL_ROLES,
  LEGACY_INTERNAL_REDIRECTS,
  homeForRole,
  isAccountPath,
  isExternalRole,
  isInternalRole,
  isPublicPath,
  postLoginTarget,
  resolveLegacyRedirect,
  safeNextPath,
} from "./routes";

describe("routes (Step 1.6 — Public Marketplace Routing & Frontend Split)", () => {
  it("роли: internal = employee Work Centers, external = PARTNER/BUYER", () => {
    for (const r of INTERNAL_ROLES) expect(isInternalRole(r)).toBe(true);
    for (const r of EXTERNAL_ROLES) expect(isExternalRole(r)).toBe(true);
    expect(isInternalRole("PARTNER")).toBe(false);
    expect(isInternalRole("BUYER")).toBe(false);
    expect(isExternalRole("ADMIN")).toBe(false);
    expect(isExternalRole("OPERATOR")).toBe(false);
  });

  it("homeForRole: internal → /app/dashboard; PARTNER → /partner (Step 1.8); BUYER → /account (Step 1.13)", () => {
    expect(homeForRole("ADMIN")).toBe("/app/dashboard");
    expect(homeForRole("OPERATOR")).toBe("/app/dashboard");
    expect(homeForRole("MODERATOR")).toBe("/app/dashboard");
    // Step 1.8: PARTNER login → Partner Cabinet.
    expect(homeForRole("PARTNER")).toBe("/partner");
    // Step 1.13: BUYER login → Buyer Cabinet.
    expect(homeForRole("BUYER")).toBe("/account");
  });

  it("legacy internal redirect map (§9): все старые внутренние route сохранены как redirect на /app/*", () => {
    expect(resolveLegacyRedirect("/catalog")).toBe("/app/catalog");
    expect(resolveLegacyRedirect("/orders")).toBe("/app/orders");
    expect(resolveLegacyRedirect("/bookings")).toBe("/app/bookings");
    expect(resolveLegacyRedirect("/customers")).toBe("/app/crm");
    expect(resolveLegacyRedirect("/users")).toBe("/app/users");
    // Не legacy пути не редиректятся.
    expect(resolveLegacyRedirect("/dashboard")).toBeNull();
    expect(resolveLegacyRedirect("/")).toBeNull();
    expect(resolveLegacyRedirect("/search")).toBeNull();
    // Каждый target — канонический /app/*.
    for (const target of Object.values(LEGACY_INTERNAL_REDIRECTS)) {
      expect(target.startsWith("/app/")).toBe(true);
    }
  });

  it("isPublicPath: / + /search + /products/* + /categories/* public; /app/* и legacy — нет", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/search")).toBe(true);
    expect(isPublicPath("/search?q=тур")).toBe(true);
    expect(isPublicPath("/products/tour-1")).toBe(true);
    expect(isPublicPath("/categories/tours")).toBe(true);
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/app/dashboard")).toBe(false);
    expect(isPublicPath("/login")).toBe(false);
    expect(isPublicPath("/catalog")).toBe(false);
    expect(isPublicPath("/users")).toBe(false);
  });

  it("safeNextPath: анти-open-redirect (только относительные пути без // и /\\\\)", () => {
    expect(safeNextPath("/app/dashboard")).toBe("/app/dashboard");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });

  it("safeNextPath: encoded-slash /%2F%2Fevil.example отклоняется (decode ДО проверки)", () => {
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/");
    expect(safeNextPath("/%2f%2fevil.example")).toBe("/");
    expect(safeNextPath("/%5C%5Cevil.example")).toBe("/");
    expect(safeNextPath("/%252F%252Fevil.example")).toBe("/%252F%252Fevil.example"); // %25 → literal %, безопасно
    // Легитимный encoded-путь сохраняется в исходной (encoded) форме.
    expect(safeNextPath("/search?q=%D1%82%D1%83%D1%80")).toBe("/search?q=%D1%82%D1%83%D1%80");
  });

  it("isAccountPath: /account/* — защищённый внешний контур (Step 1.9)", () => {
    expect(isAccountPath("/account")).toBe(true);
    expect(isAccountPath("/account/profile")).toBe(true);
    expect(isAccountPath("/account?x=1")).toBe(true);
    expect(isAccountPath("/accounting")).toBe(false);
    expect(isAccountPath("/partner")).toBe(false);
    expect(isAccountPath("/")).toBe(false);
  });

  it("postLoginTarget (Step 1.9 §5-6 + Step 1.13 §16): BUYER — public путь ИЛИ /account/* deep-link, иначе /account", () => {
    // BUYER: public Marketplace-пути сохраняются;
    expect(postLoginTarget("BUYER", "/products/tour-x")).toBe("/products/tour-x");
    expect(postLoginTarget("BUYER", "/products/tour-x?f=1")).toBe("/products/tour-x?f=1");
    expect(postLoginTarget("BUYER", "/search?q=тур")).toBe("/search?q=тур");
    expect(postLoginTarget("BUYER", "/categories/tours")).toBe("/categories/tours");
    expect(postLoginTarget("BUYER", "/")).toBe("/");
    // Step 1.13 §16: deep-link в Buyer Cabinet сохраняется (anonymous → login → /account/orders).
    expect(postLoginTarget("BUYER", "/account")).toBe("/account");
    expect(postLoginTarget("BUYER", "/account/orders")).toBe("/account/orders");
    expect(postLoginTarget("BUYER", "/account/profile?x=1")).toBe("/account/profile?x=1");
    // Без next / пустой next → Buyer Cabinet home.
    expect(postLoginTarget("BUYER", null)).toBe("/account");
    expect(postLoginTarget("BUYER", "")).toBe("/account");
    // BUYER никогда не уходит в /app/* или /partner/* даже при forged next.
    expect(postLoginTarget("BUYER", "/app/dashboard")).toBe("/account");
    expect(postLoginTarget("BUYER", "/partner")).toBe("/account");
    // Forged/внешний URL санитизируется в нейтральный public fallback (безопасно).
    expect(postLoginTarget("BUYER", "//evil.example")).toBe("/");
    expect(postLoginTarget("BUYER", "https://evil.example")).toBe("/");
  });

  it("postLoginTarget: internal — только /app/* next; PARTNER — только /partner/* next", () => {
    expect(postLoginTarget("ADMIN", "/app/dashboard")).toBe("/app/dashboard");
    expect(postLoginTarget("OPERATOR", "/app/orders")).toBe("/app/orders");
    expect(postLoginTarget("ADMIN", "/products/tour-x")).toBe("/app/dashboard");
    expect(postLoginTarget("ADMIN", null)).toBe("/app/dashboard");
    expect(postLoginTarget("PARTNER", "/partner/products")).toBe("/partner/products");
    expect(postLoginTarget("PARTNER", "/partner")).toBe("/partner");
    expect(postLoginTarget("PARTNER", "/app/dashboard")).toBe("/partner");
    expect(postLoginTarget("PARTNER", null)).toBe("/partner");
    expect(postLoginTarget("UNKNOWN", null)).toBe("/");
  });
});
