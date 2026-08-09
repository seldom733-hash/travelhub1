// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountApi } from "./account-api";
import { auth } from "./api";

/** Step 1.9 — account-api contract: register (BUYER) + own-scope profile. */
describe("account-api (Step 1.9 — Buyer Identity)", () => {
  const ok = (body: unknown, init?: { status?: number }) =>
    new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { "Content-Type": "application/json" } });

  beforeEach(() => {
    auth.clear();
    vi.unstubAllGlobals();
  });

  it("register: POST /auth/register (публичная self-registration, без role/customerId)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      ok({ accessToken: "jwt-buyer", user: { id: "u1", role: "BUYER", permissions: [] } }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await accountApi.register({ email: "Buyer@Example.com", password: "buyerpass123", firstName: "Иван", lastName: "Иванов" });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/register");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.email).toBe("Buyer@Example.com");
    expect(body.password).toBe("buyerpass123");
    // Frontend никогда не отправляет identity-поля, которыми владеет backend.
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("customerId");
    expect(body).not.toHaveProperty("partnerId");
  });

  it("getProfile: GET /account/profile (own-scope)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      ok({
        user: { id: "u1", role: "BUYER", email: "b@t.local", customerId: "c1" },
        customer: { id: "c1", code: "CUS-00000001", firstName: "Иван", lastName: "Иванов", email: "b@t.local", phone: null },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
    auth.setToken("jwt");

    const profile = await accountApi.getProfile();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/account/profile");
    expect(init.method ?? "GET").toBe("GET"); // api.get не передаёт method — default GET
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt" });
    expect(profile.customer?.code).toBe("CUS-00000001");
  });

  it("updateProfile: PATCH /account/profile только с разрешёнными own-полями", async () => {
    const mockFetch = vi.fn().mockResolvedValue(ok({ user: { id: "u1" }, customer: null }));
    vi.stubGlobal("fetch", mockFetch);
    auth.setToken("jwt");

    await accountApi.updateProfile({ email: "new@t.local", firstName: "Новое", lastName: "Имя", phone: "+994500000000" });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/account/profile");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ email: "new@t.local", firstName: "Новое" });
    // Никаких защищённых полей в запросе.
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("customerId");
  });

  it("ошибка бэкенда пробрасывается (недоступный email → HTTP 409)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(ok({ message: "Email already registered" }, { status: 409 }));
    vi.stubGlobal("fetch", mockFetch);
    await expect(accountApi.register({ email: "dup@t.local", password: "buyerpass123" })).rejects.toThrow(
      "Email already registered",
    );
  });

  // ── Buyer Cabinet read-models (Step 1.13) ───────────────────────────────────

  it("getOrders: GET /account/orders — own-scope, БЕЗ customerId в запросе, пагинация §8", async () => {
    // Свежий Response на каждый вызов (тело Response одноразовое).
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        ok({
          items: [
            {
              id: "o1",
              code: "ORD-00000001",
              number: "TH-2026-000001",
              status: "NEW",
              paymentStatus: "UNPAID",
              currency: "USD",
              amount: "250.00",
              serviceDate: "2026-10-01T00:00:00.000Z",
              createdAt: "2026-08-09T00:00:00.000Z",
              items: [{ id: "i1", title: "Тур", productCode: "PRD-00000001", quantity: 1, price: "250.00", amount: "250.00", serviceDate: null }],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          hasMore: false,
        }),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
    auth.setToken("jwt");

    const res = await accountApi.getOrders();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/account/orders");
    expect(init.method ?? "GET").toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt" });
    // Frontend НЕ передаёт customerId — объектный scope всегда на сервере (§14).
    expect(url).not.toContain("customerId");
    expect(res.total).toBe(1);
    expect(res.hasMore).toBe(false);
    expect(res.items[0].code).toBe("ORD-00000001");

    // Пагинация: page/pageSize уходят в query (без customerId).
    await accountApi.getOrders({ page: 2, pageSize: 10 });
    const [url2] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url2).toBe("/api/v1/account/orders?page=2&pageSize=10");
    expect(url2).not.toContain("customerId");
  });

  it("getBookings: GET /account/bookings — own-scope", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      ok({ items: [{ id: "b1", code: "BKG-00000001", orderId: "o1", orderCode: "ORD-00000001", currency: "USD", status: "CONFIRMED", amount: "250.00", serviceDate: null, createdAt: "2026-08-09T00:00:00.000Z" }], total: 1 }),
    );
    vi.stubGlobal("fetch", mockFetch);
    auth.setToken("jwt");

    const res = await accountApi.getBookings();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/account/bookings");
    expect(res.items[0].orderCode).toBe("ORD-00000001");
  });

  it("getPayments/getDocuments/getSupport: GET /account/* — controlled empty contract (available:false)", async () => {
    // Свежий Response на каждый вызов (тело Response одноразовое) + Promise.
    const mockFetch = vi.fn().mockImplementation(() => Promise.resolve(ok({ items: [], total: 0, available: false })));
    vi.stubGlobal("fetch", mockFetch);
    auth.setToken("jwt");

    for (const [method, path] of [
      [accountApi.getPayments, "/api/v1/account/payments"],
      [accountApi.getDocuments, "/api/v1/account/documents"],
      [accountApi.getSupport, "/api/v1/account/support"],
    ] as const) {
      const res = await method();
      expect(res).toEqual({ items: [], total: 0, available: false });
    }
    const urls = mockFetch.mock.calls.map((c) => c[0]) as string[];
    expect(urls).toEqual(["/api/v1/account/payments", "/api/v1/account/documents", "/api/v1/account/support"]);
    for (const u of urls) expect(u).not.toContain("customerId");
  });
});
