import { Injectable } from "@nestjs/common";
import { TooManyRequestsError } from "./errors";

/**
 * Step 2.17 — минимальный login rate limiter (in-memory, single-instance).
 *
 * Закрывает: brute-force по паролю на /auth/login (ранее — без ограничений).
 * Sliding window per key `username|ip`: MAX_ATTEMPTS попыток за WINDOW_MS.
 * Превышение → 429 TooManyRequestsError (controlled).
 *
 * ОГРАНИЧЕНИЕ (документированное, §report): in-memory состояние per-instance —
 * при горизонтальном масштабировании лимит на инстанс. Для single-instance
 * deployment это корректно; для multi-instance требуется external store
 * (Redis/DB) — вне scope 2.17 (обозначено как известное ограничение).
 */
@Injectable()
export class LoginThrottleService {
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 минут
  private static readonly MAX_ATTEMPTS = 10;
  private readonly attempts = new Map<string, number[]>();

  /** Проверить и зарегистрировать попытку. Бросает 429 при превышении. */
  check(key: string): void {
    const now = Date.now();
    const cutoff = now - LoginThrottleService.WINDOW_MS;
    const list = (this.attempts.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= LoginThrottleService.MAX_ATTEMPTS) {
      this.attempts.set(key, list);
      throw new TooManyRequestsError("Too many login attempts. Try again later.");
    }
    list.push(now);
    this.attempts.set(key, list);
  }

  /** Зарегистрировать успешный вход (сброс окна для ключа). */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Текущее число попыток по ключу (наблюдаемость/тесты). */
  count(key: string): number {
    const cutoff = Date.now() - LoginThrottleService.WINDOW_MS;
    return (this.attempts.get(key) ?? []).filter((t) => t > cutoff).length;
  }
}
