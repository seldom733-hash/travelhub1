// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError, PublicNotFoundError, buildPublicQuery, publicApi } from "./public-api";

/**
 * Step 1.6 §15: public pages используют ТОЛЬКО Public Catalog API — БЕЗ JWT,
 * даже если пользователь залогинен. Это доказывается unit-тестами.
 */
describe("public-api (Step 1.6 §15 — public-only client)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("buildPublicQuery: q/category/sort/page/pageSize + category-specific f[key]=value (shareable URL)", () => {
    expect(buildPublicQuery()).toBe("");
    expect(buildPublicQuery({ page: 1 })).toBe(""); // page 1 не пишем в URL
    const qs = buildPublicQuery({ q: "тур", category: "tours", sort: "price_asc", page: 2, pageSize: 12, f: { days: "7", language: "en" } });
    expect(qs).toContain(`q=${encodeURIComponent("тур")}`);
    expect(qs).toContain("category=tours");
    expect(qs).toContain("sort=price_asc");
    expect(qs).toContain("page=2");
    expect(qs).toContain("pageSize=12");
    // URLSearchParams кодирует [] в %5B/%5D — backend декодирует обратно в f[days].
    expect(qs).toContain(`f%5Bdays%5D=7`);
    expect(qs).toContain(`f%5Blanguage%5D=en`);
  });

  it("НИКОГДА не отправляет Authorization — даже при существующем токене в localStorage", async () => {
    // «Залогиненный» пользователь: токен в localStorage есть, но public-api его не использует.
    localStorage.setItem("travelhub.token", "some-jwt");
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }) });

    await publicApi.listProducts({ q: "x" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toContain("/api/v1/public/products");
    expect(url).not.toMatch(/\/api\/v1\/products[?/]/); // не internal /products
    expect(init?.headers).toBeUndefined(); // вообще без заголовков
    const rawInit = JSON.stringify(init ?? {});
    expect(rawInit).not.toContain("Authorization");
    expect(rawInit).not.toContain("Bearer");
    expect(rawInit).not.toContain("some-jwt");
  });

  it("404 → PublicNotFoundError (нейтральный not-found для непубличного продукта/категории)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: "Product not found" }) });
    await expect(publicApi.getProduct("draft-slug")).rejects.toBeInstanceOf(PublicNotFoundError);
  });

  it("другие ошибки → PublicApiError с кодом статуса", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ message: "Bad filter" }) });
    const err = await publicApi.listProducts({ category: "t", f: { days: "x" } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PublicApiError);
    expect((err as PublicApiError).status).toBe(422);
    expect((err as PublicApiError).message).toBe("Bad filter");
  });
});
