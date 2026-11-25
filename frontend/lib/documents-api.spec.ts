import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentsApi } from "./documents-api";

const fetchMock = vi.fn();
let lastRequest: { url: string; init: RequestInit | undefined } | null = null;

beforeEach(() => {
  lastRequest = null;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    lastRequest = { url, init };
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: [], total: 0 }), json: async () => ({ items: [], total: 0 }) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("documentsApi.list (server-side search & sort)", () => {
  it("basic list: no leftover query params", async () => {
    await documentsApi.list({ page: 1, pageSize: 20 });
    expect(lastRequest?.url).toBe("/api/v1/documents?page=1&pageSize=20");
  });

  it("server-side search: q is forwarded", async () => {
    await documentsApi.list({ page: 1, pageSize: 20, q: "00020016" });
    expect(lastRequest?.url).toContain("/api/v1/documents?");
    expect(lastRequest?.url).toContain("q=00020016");
  });

  it("server-side sort: sortBy + direction are forwarded", async () => {
    await documentsApi.list({ page: 1, pageSize: 20, sortBy: "totalAmount", sortDirection: "asc" });
    expect(lastRequest?.url).toBe("/api/v1/documents?page=1&pageSize=20&sortBy=totalAmount&sortDirection=asc");
  });

  it("type/status filters still forwarded", async () => {
    await documentsApi.list({ page: 1, pageSize: 20, type: "VOUCHER", status: "ISSUED" });
    expect(lastRequest?.url).toContain("type=VOUCHER");
    expect(lastRequest?.url).toContain("status=ISSUED");
  });
});
