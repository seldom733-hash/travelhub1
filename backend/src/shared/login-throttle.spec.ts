import { describe, expect, it, jest } from "@jest/globals";
import { LoginThrottleService } from "./login-throttle.service";
import { TooManyRequestsError } from "./errors";

/**
 * Step 2.17 — login rate limiter unit tests.
 * Покрывают: sliding window, controlled 429, reset при успешном входе,
 * bounded cleanup (истёкшие окна не растят Map бесконечно).
 */
describe("Step 2.17 — LoginThrottleService", () => {
  it("порог: N попыток проходят, следующая (в окне) → 429", () => {
    const t = new LoginThrottleService();
    for (let i = 0; i < 10; i++) {
      t.check("u|ip");
    }
    expect(() => t.check("u|ip")).toThrow(TooManyRequestsError);
  });

  it("окна разделены по ключам (username|ip) — разные ключи независимы", () => {
    const t = new LoginThrottleService();
    // Свой лимит alice|ip1: 10 попыток → следующая → 429.
    for (let i = 0; i < 10; i++) {
      t.check("alice|ip1");
    }
    expect(() => t.check("alice|ip1")).toThrow(TooManyRequestsError);
    // Другие ключи не затронуты (проверка сама потребляет 1 попытку bob).
    t.check("bob|ip1");
    expect(() => t.check("alice|ip2")).not.toThrow();
    // bob|ip1: 1 (проверка выше) + 9 = 10 → следующая → свой 429.
    for (let i = 0; i < 9; i++) {
      t.check("bob|ip1");
    }
    expect(() => t.check("bob|ip1")).toThrow(TooManyRequestsError);
  });

  it("reset (успешный вход) сбрасывает окно ключа", () => {
    const t = new LoginThrottleService();
    for (let i = 0; i < 10; i++) {
      t.check("u|ip");
    }
    t.reset("u|ip");
    expect(t.count("u|ip")).toBe(0);
    // После reset попытки снова доступны.
    t.check("u|ip");
    expect(t.count("u|ip")).toBe(1);
  });

  it("bounded cleanup: истёкшее окно не аккумулирует — при повторном check ключ обновляется, а не растёт", () => {
    const t = new LoginThrottleService();
    const inner = (t as unknown as { attempts: Map<string, number[]> }).attempts;
    const cutoff = Date.now() - 16 * 60 * 1000;
    // Имитация: ключ с 10 истёкшими попытками (прошлое окно).
    inner.set("u|ip", [cutoff, cutoff, cutoff, cutoff, cutoff, cutoff, cutoff, cutoff, cutoff, cutoff]);
    t.check("u|ip"); // старые отфильтрованы → список пуст → ключ пересоздан с 1 свежей
    // БЕЗ cleanup список вырос бы до 11; с cleanup — ровно 1 свежая попытка.
    expect(inner.get("u|ip")).toHaveLength(1);
    expect(t.count("u|ip")).toBe(1);
  });

  it("истёкшие попытки не считаются (sliding window)", () => {
    jest.useFakeTimers();
    try {
      const t = new LoginThrottleService();
      for (let i = 0; i < 10; i++) {
        t.check("u|ip");
      }
      expect(() => t.check("u|ip")).toThrow(TooManyRequestsError);
      // Сдвигаем время за окно → попытки устарели, лимит снова доступен.
      jest.advanceTimersByTime(16 * 60 * 1000);
      expect(() => t.check("u|ip")).not.toThrow();
    } finally {
      jest.useRealTimers();
    }
  });
});
