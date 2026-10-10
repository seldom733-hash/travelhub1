import { TooManyRequestsError } from "../../shared/errors";
import type { WhatsAppConfig } from "./whatsapp.config";

/**
 * §6.4 Rate-limit для QR-эндпоинтов: скользящее окно per-user
 * (WHATSAPP_QR_RATE_LIMIT_MAX / WHATSAPP_QR_RATE_LIMIT_WINDOW_MS).
 * M5: один экземпляр на контроллер (legacy и sessions-роуты живут отдельно).
 */
export class QrRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly config: WhatsAppConfig) {}

  hit(userId: string): void {
    const now = Date.now();
    const windowStart = now - this.config.qrRateLimit.windowMs;
    const timestamps = (this.hits.get(userId) ?? []).filter((at) => at > windowStart);
    if (timestamps.length >= this.config.qrRateLimit.max) {
      this.hits.set(userId, timestamps);
      throw new TooManyRequestsError("QR endpoint rate limit exceeded, retry later");
    }
    timestamps.push(now);
    this.hits.set(userId, timestamps);
    if (this.hits.size > 10_000) {
      // Грубая защита памяти: выкидываем самые старые окна.
      const cutoff = now - this.config.qrRateLimit.windowMs * 2;
      for (const [key, values] of this.hits) {
        if (values.every((at) => at <= cutoff)) this.hits.delete(key);
      }
    }
  }
}
