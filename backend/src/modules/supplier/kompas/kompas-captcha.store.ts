import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { Page, BrowserContext } from "playwright";
import type { SupplierSearchQuery, PriceCalendarQuery, SupplierOfferRef } from "../supplier.types";
import { randomUUID } from "crypto";

/** Operation that was interrupted by CAPTCHA and must be resumed after solve. */
export type KompasCaptchaOperation =
  | "search"
  | "priceCalendar"
  | "refreshPrice"
  | "refreshAvailability"
  | "getOffer";

export type CaptchaSupplier = "KOMPAS" | "SUMMERTOUR";

export type KompasCaptchaChallengeStatus =
  | "WAITING_FOR_USER"
  | "SUBMITTING"
  | "SUCCESS"
  | "INVALID_ANSWER"
  | "EXPIRED"
  | "SESSION_LOST"
  | "KOMPAS_ERROR"
  | "TIMEOUT"
  | "CANCELLED";

export interface KompasCaptchaChallenge {
  challengeId: string;
  supplier: CaptchaSupplier;
  status: KompasCaptchaChallengeStatus;
  operation: KompasCaptchaOperation;
  createdAt: Date;
  expiresAt: Date;
  /** data:image/jpeg;base64,... — ephemeral, never persisted. */
  captchaImage: string;
  mimeType: string;
  /** Original request payload — needed to resume after success. */
  originalQuery: SupplierSearchQuery | PriceCalendarQuery | SupplierOfferRef;
  /** Browser context + page — MUST be same across captcha + resume. */
  context: BrowserContext;
  page: Page;
}

/**
 * Ephemeral CAPTCHA challenge store.
 *
 * Holds challenges in memory with TTL and same-session binding:
 *   challengeId → { BrowserContext, Page, originalQuery, captchaImage }
 *
 * No cookies / antibot tokens / answers are persisted.
 * A periodic timer cleans up expired entries and closes their contexts.
 */
@Injectable()
export class KompasCaptchaStore implements OnModuleDestroy {
  private readonly logger = new Logger(KompasCaptchaStore.name);
  private readonly challenges = new Map<string, KompasCaptchaChallenge>();
  private readonly ttlMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // TTL from env or default 7 minutes — within prompt's 5–10 min range.
    const envTtl = process.env.KOMPAS_CAPTCHA_TTL_MS ? parseInt(process.env.KOMPAS_CAPTCHA_TTL_MS, 10) : 7 * 60 * 1000;
    this.ttlMs = isNaN(envTtl) ? 7 * 60 * 1000 : envTtl;
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60_000);
    // Avoid blocking process exit.
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
    this.logger.log(`KompasCaptchaStore: TTL=${this.ttlMs}ms`);
  }

  create(args: {
    supplier: CaptchaSupplier;
    operation: KompasCaptchaOperation;
    originalQuery: SupplierSearchQuery | PriceCalendarQuery | SupplierOfferRef;
    context: BrowserContext;
    page: Page;
    captchaImage: string;
    mimeType?: string;
  }): KompasCaptchaChallenge {
    const challengeId = randomUUID();
    const now = new Date();
    const challenge: KompasCaptchaChallenge = {
      challengeId,
      supplier: args.supplier,
      status: "WAITING_FOR_USER",
      operation: args.operation,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      captchaImage: args.captchaImage,
      mimeType: args.mimeType ?? "image/jpeg",
      originalQuery: args.originalQuery,
      context: args.context,
      page: args.page,
    };
    this.challenges.set(challengeId, challenge);
    this.logger.log(
      JSON.stringify({
        event: `${args.supplier}_CAPTCHA_DETECTED`,
        challengeId,
        operation: args.operation,
        supplier: args.supplier,
      }),
    );
    this.logger.log(
      JSON.stringify({
        event: `${args.supplier}_CAPTCHA_PRESENTED`,
        challengeId,
        operation: args.operation,
      }),
    );
    return challenge;
  }

  get(challengeId: string): KompasCaptchaChallenge | undefined {
    const ch = this.challenges.get(challengeId);
    if (!ch) return undefined;
    if (ch.expiresAt.getTime() < Date.now()) {
      ch.status = "EXPIRED";
      // Do not delete yet — let caller observe EXPIRED, cleanup will close context.
      return ch;
    }
    return ch;
  }

  /** Update image after refresh (same challengeId, same context). */
  updateImage(challengeId: string, newImage: string, mimeType = "image/jpeg"): KompasCaptchaChallenge | undefined {
    const ch = this.get(challengeId);
    if (!ch) return undefined;
    if (ch.status === "EXPIRED") return ch;
    ch.captchaImage = newImage;
    ch.mimeType = mimeType;
    ch.status = "WAITING_FOR_USER";
    this.logger.log(
      JSON.stringify({
        event: "KOMPAS_CAPTCHA_REFRESHED",
        challengeId,
        operation: ch.operation,
      }),
    );
    return ch;
  }

  setStatus(challengeId: string, status: KompasCaptchaChallengeStatus): void {
    const ch = this.challenges.get(challengeId);
    if (ch) ch.status = status;
  }

  /** Remove and close associated browser context (called on SUCCESS/EXPIRED/CANCELLED/SESSION_LOST). */
  async remove(challengeId: string): Promise<void> {
    const ch = this.challenges.get(challengeId);
    if (!ch) return;
    this.challenges.delete(challengeId);
    // Close the context that was held for this captcha flow.
    // The page is inside this context; closing context closes page as well.
    try {
      await ch.context.close().catch(() => {});
    } catch {}
    this.logger.debug(`KompasCaptchaStore: removed challenge ${challengeId} status=${ch.status}`);
  }

  /**
   * Called when the challenge is fully done and the original operation
   * has been resumed successfully. We no longer need the ephemeral page,
   * but we do NOT want the adapter's normal `context.close()` to double-close.
   * The store owns the context for captcha challenges.
   */
  async consume(challengeId: string): Promise<KompasCaptchaChallenge | undefined> {
    const ch = this.challenges.get(challengeId);
    if (!ch) return undefined;
    // Keep reference but remove from active map so cleanup doesn't double-close.
    this.challenges.delete(challengeId);
    return ch;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, ch] of this.challenges) {
      if (ch.expiresAt.getTime() < now && ch.status !== "SUCCESS") {
        ch.status = "EXPIRED";
        this.logger.log(
          JSON.stringify({
            event: "KOMPAS_CAPTCHA_EXPIRED",
            challengeId: id,
            operation: ch.operation,
          }),
        );
        // Close context and delete.
        ch.context.close().catch(() => {});
        this.challenges.delete(id);
      } else if (ch.status === "CANCELLED" || ch.status === "SESSION_LOST") {
        ch.context.close().catch(() => {});
        this.challenges.delete(id);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [id] of this.challenges) {
      await this.remove(id).catch(() => {});
    }
  }

  /** For tests / metrics — number of active challenges. */
  size(): number {
    return this.challenges.size;
  }
}
