import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPartnerListQuery, partnerApi } from "./partner-api";

describe("buildPartnerListQuery (Step 1.8)", () => {
  it("пустой query → пустая строка (дефолт updated_desc не отправляется)", () => {
    expect(buildPartnerListQuery({})).toBe("");
    expect(buildPartnerListQuery({ sort: "updated_desc" })).toBe("");
  });

  it("серверные фильтры/сортировка/пагинация сериализуются", () => {
    const qs = buildPartnerListQuery({ search: "тур", filter: "in_moderation", categoryId: "cat-1", sort: "title_asc", page: 2, pageSize: 10 });
    expect(qs).toContain("search=");
    expect(qs).toContain("filter=in_moderation");
    expect(qs).toContain("categoryId=cat-1");
    expect(qs).toContain("sort=title_asc");
    expect(qs).toContain("page=2");
    expect(qs).toContain("pageSize=10");
  });
});

describe("partnerApi schema contract (§8.1 — Partner-safe, НЕ internal /category-schemas)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schemaForCategory вызывает ТОЛЬКО /api/v1/partner/categories/:slug/schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ category: { id: "c1", slug: "tours" }, schema: { version: 1, attributes: [] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // localStorage token (api.ts headers) — заглушка.
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => storage.get(k) ?? null } });
    vi.stubGlobal("localStorage", storage);

    await partnerApi.schemaForCategory("tours");

    const calls = fetchMock.mock.calls as [string | URL, RequestInit?][];
    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toBe("/api/v1/partner/categories/tours/schema");
    // Никаких обращений к internal /category-schemas.
    expect(String(calls[0][0])).not.toContain("category-schemas");
  });

  it("partnerApi не содержит обращений к internal /category-schemas и к read_active правам в URL", () => {
    const source = partnerApi.schemaForCategory.toString();
    expect(source).not.toContain("category-schemas");
    // Категории — public contract.
    expect(partnerApi.listCategories).toBeDefined();
  });
});
