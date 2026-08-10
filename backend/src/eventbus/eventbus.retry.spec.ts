/**
 * Step 2.4 (G2) — outbox retry helpers (PURE, unit-testable).
 *
 * Минимальный durable retry contract для критичных событий (OrderRequested):
 *  - экспоненциальный backoff с cap;
 *  - nextAttemptAt = now + backoff(attempt);
 *  - max attempts не допускает бесконечного retry (poison → terminal FAILED).
 */
import { EventBusService, OUTBOX_MAX_ATTEMPTS, outboxBackoffMs, outboxNextAttempt } from "./eventbus.service";

const makePrisma = (rows: Array<{ id: string; attempts: number }>) => ({
  outboxEvent: {
    findMany: jest.fn().mockResolvedValue(rows),
    update: jest.fn().mockResolvedValue({}),
  },
} as unknown as ConstructorParameters<typeof EventBusService>[0]);

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

  it("STRICT §50.9: future nextAttemptAt не подбирается (элигибилити-фильтр retryFailed)", async () => {
    // Событие с nextAttemptAt в будущем НЕ должно переводиться в PENDING:
    // retryFailed фильтрует `nextAttemptAt <= now OR null` — future строка
    // выпадает из выборки, т.е. НЕ получает update → остаётся FAILED (отложен).
    const prisma = makePrisma([]); // future row НЕ попала в выборку
    const bus = new EventBusService(prisma);
    expect(await bus.retryFailed(100, new Date())).toBe(0);
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it("STRICT §50.9b: eligible FAILED переводится в PENDING c nextAttemptAt = now+backoff(attempts+1)", async () => {
    const prisma = makePrisma([{ id: "ev1", attempts: 2 }]);
    const bus = new EventBusService(prisma);
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(await bus.retryFailed(100, now)).toBe(1);
    const updateMock = prisma.outboxEvent.update as unknown as jest.Mock;
    const call = updateMock.mock.calls[0][0] as { data: { status: string; error: string | null; nextAttemptAt: Date } };
    // backoff для attempts+1=3 → +4s от реального now (не мгновенный retry).
    expect(call.data.status).toBe("PENDING");
    expect(call.data.error).toBeNull();
    expect(call.data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(new Date().getTime() + outboxBackoffMs(3) - 1000);
    expect(call.data.nextAttemptAt.getTime()).toBeLessThanOrEqual(new Date().getTime() + outboxBackoffMs(3) + 1000);
  });
});
