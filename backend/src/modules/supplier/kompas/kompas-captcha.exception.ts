/**
 * CAPTCHA-required exception — thrown when KOMPAS/Summertour returns a real CAPTCHA.
 * The controller catches this and returns a structured CAPTCHA_REQUIRED response
 * (200) instead of an error, so the frontend can show the human-in-the-loop modal.
 *
 * Security: no cookies / session identifiers / antibot tokens are exposed here.
 */
export class KompasCaptchaRequiredException extends Error {
  public readonly challengeId: string;
  public readonly captchaImage: string; // data:image/jpeg;base64,...
  public readonly mimeType: string; // image/jpeg
  public readonly supplier: "KOMPAS" | "SUMMERTOUR";

  constructor(
    challengeId: string,
    captchaImage: string,
    mimeType = "image/jpeg",
    supplier: "KOMPAS" | "SUMMERTOUR" = "KOMPAS",
  ) {
    super(`${supplier} CAPTCHA_REQUIRED challengeId=${challengeId}`);
    this.name = "KompasCaptchaRequiredException";
    this.challengeId = challengeId;
    this.captchaImage = captchaImage;
    this.mimeType = mimeType;
    this.supplier = supplier;
  }
}

export type KompasCaptchaVerifyStatus =
  | "SUCCESS"
  | "INVALID_ANSWER"
  | "NEW_CAPTCHA"
  | "EXPIRED"
  | "SESSION_LOST"
  | "KOMPAS_ERROR"
  | "TIMEOUT"
  | "CANCELLED";
