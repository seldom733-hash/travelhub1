// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { auth } from "./api";

/**
 * Step 1.6 §10: server-side auth boundary (middleware.ts) не может читать
 * localStorage — токен зеркалируется в httpOnly-less cookie `travelhub.auth`.
 * Эти тесты фиксируют cookie-контракт auth-стора.
 */
describe("api auth store (Step 1.6 §10 — cookie mirror for middleware boundary)", () => {
  it("setToken пишет токен в localStorage И в cookie travelhub.auth (path=/ SameSite=Lax)", () => {
    const setter = vi.spyOn(document, "cookie", "set");
    auth.setToken("jwt-abc");
    expect(window.localStorage.getItem("travelhub.token")).toBe("jwt-abc");
    expect(document.cookie).toContain("travelhub.auth=jwt-abc");
    // Атрибуты cookie задаются в строке setter'а (jsdom-джар их не отдаёт через getter).
    const setCalls = setter.mock.calls.map((c) => String(c[0])).join("|");
    expect(setCalls).toContain("travelhub.auth=jwt-abc; path=/; SameSite=Lax");
    setter.mockRestore();
  });

  it("clear удаляет токен из localStorage и убивает cookie (max-age=0)", () => {
    auth.setToken("jwt-abc");
    auth.clear();
    expect(window.localStorage.getItem("travelhub.token")).toBeNull();
    expect(document.cookie).not.toContain("travelhub.auth");
  });

  it("getter токена читает только localStorage (server-side middleware не используется)", () => {
    auth.clear();
    expect(auth.token).toBeNull();
    auth.setToken("jwt-xyz");
    expect(auth.token).toBe("jwt-xyz");
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
  });

  it("encodeURIComponent: токен с спецсимволами безопасно пишется в cookie", () => {
    auth.setToken("a b+c/d");
    expect(document.cookie).toContain(`travelhub.auth=${encodeURIComponent("a b+c/d")}`);
  });
});
