import { Controller, Post, Body, Logger } from "@nestjs/common";
import { Public } from "../../../security/auth/decorators";
import { KompasCaptchaStore } from "./kompas-captcha.store";
import { KompasSupplierAdapter } from "./kompas.adapter";
import { KompasCaptchaRequiredException } from "./kompas-captcha.exception";

/**
 * Public KOMPAS CAPTCHA human-in-the-loop controller.
 *
 * Holds SAME browser context/page across challenge → verify → resume.
 * Never exposes cookies / antibot tokens / answers in logs or responses.
 */
@Controller()
export class KompasCaptchaController {
  private readonly logger = new Logger(KompasCaptchaController.name);

  constructor(
    private readonly store: KompasCaptchaStore,
    private readonly adapter: KompasSupplierAdapter,
  ) {}

  /** Refresh CAPTCHA image — uses samo.captchaRefreshUrl / #recaptcha in SAME context. */
  @Post("public/supplier/kompas/captcha/refresh")
  @Public()
  async refresh(@Body() body: { challengeId: string }) {
    const { challengeId } = body;
    if (!challengeId) return { status: "EXPIRED" };
    const ch = this.store.get(challengeId);
    if (!ch) return { status: "EXPIRED" };
    if (ch.expiresAt.getTime() < Date.now()) {
      this.store.setStatus(challengeId, "EXPIRED");
      return { status: "EXPIRED" };
    }
    const res = await this.adapter.refreshCaptchaImage(challengeId);
    if (res.status === "EXPIRED" || res.status === "SESSION_LOST") return { status: res.status };
    if (res.newImage) {
      return {
        status: "WAITING_FOR_USER",
        challengeId,
        supplier: "KOMPAS",
        captcha: { type: "image", mimeType: "image/jpeg", data: res.newImage },
      };
    }
    return { status: res.status };
  }

  /** Verify user-typed answer in SAME context, then resume original operation. */
  @Post("public/supplier/kompas/captcha/verify")
  @Public()
  async verify(@Body() body: { challengeId: string; answer: string }) {
    const { challengeId, answer } = body;
    if (!challengeId || typeof answer !== "string") return { status: "EXPIRED" };
    const ch = this.store.get(challengeId);
    if (!ch) return { status: "EXPIRED" };
    if (ch.expiresAt.getTime() < Date.now()) {
      this.store.setStatus(challengeId, "EXPIRED");
      await this.store.remove(challengeId).catch(() => {});
      return { status: "EXPIRED" };
    }
    // Do NOT log answer.
    const submit = await this.adapter.submitCaptchaAnswer(challengeId, answer);

    if (submit.status === "INVALID_ANSWER") {
      // Adapter already updated store with new image if KOMPAS issued one.
      const cur = this.store.get(challengeId);
      const data = submit.newImage ?? cur?.captchaImage;
      return {
        status: "INVALID_ANSWER",
        challengeId,
        supplier: "KOMPAS",
        captcha: data ? { type: "image", mimeType: "image/jpeg", data } : undefined,
      };
    }
    if (submit.status === "EXPIRED") return { status: "EXPIRED" };
    if (submit.status === "SESSION_LOST") {
      await this.store.remove(challengeId).catch(() => {});
      return { status: "SESSION_LOST" };
    }
    if (submit.status === "KOMPAS_ERROR") return { status: "KOMPAS_ERROR" };
    if (submit.status !== "SUCCESS") return { status: submit.status };

    // SUCCESS → resume original operation in SAME page/context.
    try {
      const result = await this.adapter.resumeOperationAfterCaptcha(challengeId);
      // Challenge consumed — remove store entry and close context after successful resume.
      // The adapter's resume method used the page; now we can clean up.
      // We keep page alive until resume finished; now close.
      await this.store.remove(challengeId).catch(() => {});

      // Return operation-specific payload so frontend can continue without re-issuing request.
      if (ch.operation === "priceCalendar") {
        return { status: "SUCCESS", challengeId, supplier: "KOMPAS", data: result };
      }
      if (ch.operation === "search") {
        return { status: "SUCCESS", challengeId, supplier: "KOMPAS", data: result };
      }
      if (ch.operation === "refreshPrice" || ch.operation === "refreshAvailability" || ch.operation === "getOffer") {
        return { status: "SUCCESS", challengeId, supplier: "KOMPAS", data: result };
      }
      return { status: "SUCCESS", challengeId, supplier: "KOMPAS", data: result };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`resume after captcha failed ${challengeId}: ${msg}`);
      if (msg === "SESSION_LOST") return { status: "SESSION_LOST" };
      if (msg === "EXPIRED") return { status: "EXPIRED" };
      // If resume hits another CAPTCHA (new challenge), surface it.
      if (err instanceof KompasCaptchaRequiredException) {
        return {
          status: "CAPTCHA_REQUIRED",
          challengeId: (err as any).challengeId,
          supplier: "KOMPAS",
          captcha: { type: "image", mimeType: (err as any).mimeType, data: (err as any).captchaImage },
        };
      }
      await this.store.remove(challengeId).catch(() => {});
      return { status: "KOMPAS_ERROR" };
    }
  }

  /** Cancel challenge — user closed modal. */
  @Post("public/supplier/kompas/captcha/cancel")
  @Public()
  async cancel(@Body() body: { challengeId: string }) {
    const { challengeId } = body;
    if (!challengeId) return { status: "CANCELLED" };
    const ch = this.store.get(challengeId);
    if (ch) {
      this.store.setStatus(challengeId, "CANCELLED");
      this.logger.log(JSON.stringify({ event: "KOMPAS_CAPTCHA_CANCELLED", challengeId }));
      await this.store.remove(challengeId).catch(() => {});
    }
    return { status: "CANCELLED" };
  }
}
