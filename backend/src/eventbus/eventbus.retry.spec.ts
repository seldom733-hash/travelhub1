/**
 * Step 2.4 (G2) — outbox retry helpers (PURE, unit-testable).
 *
 * Минимальный durable retry contract для критичных событий (OrderRequested):
 *  - экспоненциальный backoff с cap;
 *  - nextAttemptAt = now + backoff(attempt);
 *  - max attempts не допускает бесконечного retry (poison → terminal FAILED).
 */
import { OUTBOX_MAX_ATTEMPTS, outboxBackoffMs, outboxNextAttempt } from "./eventbus.service";

describe("Step 2.4 — outbox retry helpers", () => {
  it("backoff экспоненциальный: 1s, 2s, 4s, 8s, 16s (первые 5)", () => {
    expect(outboxBackoffMs(1)).toBe(1000);
    expect(outboxBackoffMs(2)).toBe(2000);
    expect(outboxBackoffMs(3)).toBe(4000);
    expect(outboxBackoffMs(4)).toBe(8000);
    expect(outboxBackoffMs(5)).toBe(16000);
  });

  it("backoff capped на 60s (не растёт бесконечно)", () => {
    expect(outboxBackoffMs(7)).toBe(60000);
    expect(outboxBackoffMs(10)).toBe(60000);
    expect(outboxBackoffMs(50)).toBe(60000);
  });

  it("attempt <= 0 → 0 (без задержки)", () => {
    expect(outboxBackoffMs(0)).toBe(0);
    expect(outboxBackoffMs(-3)).toBe(0);
  });

  it("nextAttemptAt = now + backoff (детерминированно)", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(outboxNextAttempt(1, now).toISOString()).toBe("2026-08-10T12:00:01.000Z");
    expect(outboxNextAttempt(3, now).toISOString()).toBe("2026-08-10T12:00:04.000Z");
    expect(outboxNextAttempt(8, now).toISOString()).toBe("2026-08-10T12:01:00.000Z"); // cap 60s
  });

  it("max attempts = 5 (после 5 попыток событие остаётся FAILED терминальным)", () => {
    expect(OUTBOX_MAX_ATTEMPTS).toBe(5);
  });
});
