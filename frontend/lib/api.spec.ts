// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { auth, fetchSessionUser } from "./api";

/**
 * Step 2.17 — Auth hardening: сессионный credential НЕ хранится в JS-readable
 * сторадже. Токен — в серверной HttpOnly cookie (JS не читает); этот стор —
 * только in-memory «флаг сессии» для реактивного UI. localStorage и
 * document.cookie больше НЕ используются как credential-хранилище.
 */
describe("api auth store (Step 2.17 — in-memory session flag, no JS-readable credential)", () => {
  it("setToken хранит токен ТОЛЬКО в памяти — НЕ пишет в localStorage и НЕ в document.cookie", () => {
    auth.setToken("jwt-abc");
    expect(auth.token).toBe("jwt-abc");
    expect(window.localStorage.getItem("travelhub.token")).toBeNull();
    expect(document.cookie).not.toContain("travelhub.auth");
    expect(document.cookie).toBe("");
  });

  it("clear снимает флаг сессии (in-memory) — ничего не пишет в localStorage/cookie", () => {
    auth.setToken("jwt-abc");
    auth.clear();
    expect(auth.token).toBeNull();
    expect(window.localStorage.getItem("travelhub.token")).toBeNull();
    expect(document.cookie).toBe("");
  });

  it("getter токена читает in-memory флаг", () => {
    auth.clear();
    expect(auth.token).toBeNull();
    auth.setToken("jwt-xyz");
    expect(auth.token).toBe("jwt-xyz");
    auth.clear();
  });

  it("subscribe уведомляет подписчиков при set/clear (reactive useCurrentUser)", () => {
    const listener = vi.fn();
    const unsubscribe = auth.subscribe(listener);
    auth.setToken("t1");
    expect(listener).toHaveBeenCalledTimes(1);
    auth.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    auth.setToken("t2");
    expect(listener).toHaveBeenCalledTimes(2);
    auth.clear();
  });

  it("fetchSessionUser: 200 {user} → пользователь; 200 {user:null} → null; сетевая ошибка → null", async () => {
    const ok = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "u1", role: "BUYER" } }),
    });
    vi.stubGlobal("fetch", ok);
    expect(await fetchSessionUser()).toEqual({ id: "u1", role: "BUYER" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null }) }),
    );
    expect(await fetchSessionUser()).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await fetchSessionUser()).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await fetchSessionUser()).toBeNull();

    vi.unstubAllGlobals();
  });
});
