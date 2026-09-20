"use client";

import { useState, useCallback } from "react";
import {
  isCaptchaRequired,
  verifyKompasCaptcha,
  refreshKompasCaptcha,
  cancelKompasCaptcha,
  type KompasCaptchaRequiredResponse,
} from "./supplier-api";

export type CaptchaChallengeState = {
  challengeId: string;
  captchaImage: string; // data:image/...
  status: "WAITING_FOR_USER" | "INVALID_ANSWER" | "EXPIRED" | "SESSION_LOST";
};

export function useKompasCaptcha() {
  const [challenge, setChallenge] = useState<CaptchaChallengeState | null>(null);

  const handleCaptchaRequired = useCallback((res: KompasCaptchaRequiredResponse) => {
    setChallenge({
      challengeId: res.challengeId,
      captchaImage: res.captcha.data,
      status: "WAITING_FOR_USER",
    });
  }, []);

  const checkResponseForCaptcha = useCallback(
    (data: unknown): boolean => {
      if (isCaptchaRequired(data)) {
        handleCaptchaRequired(data);
        return true;
      }
      return false;
    },
    [handleCaptchaRequired],
  );

  const submit = useCallback(
    async (answer: string, onSuccess: (data: unknown) => void): Promise<{ status: string; newImage?: string }> => {
      if (!challenge) return { status: "EXPIRED" };
      const res: any = await verifyKompasCaptcha(challenge.challengeId, answer);
      if (res.status === "SUCCESS") {
        setChallenge(null);
        onSuccess(res.data);
        return { status: "SUCCESS" };
      }
      if (res.status === "INVALID_ANSWER") {
        const newImg = res.captcha?.data ?? challenge.captchaImage;
        setChallenge({ challengeId: res.challengeId ?? challenge.challengeId, captchaImage: newImg, status: "INVALID_ANSWER" });
        return { status: "INVALID_ANSWER", newImage: newImg };
      }
      if (res.status === "CAPTCHA_REQUIRED" && res.captcha) {
        // New captcha after success attempt — e.g. second challenge
        setChallenge({ challengeId: res.challengeId, captchaImage: res.captcha.data, status: "WAITING_FOR_USER" });
        return { status: "CAPTCHA_REQUIRED", newImage: res.captcha.data };
      }
      if (res.status === "EXPIRED" || res.status === "SESSION_LOST") {
        setChallenge({ ...challenge, status: res.status as any });
        return { status: res.status };
      }
      // KOMPAS_ERROR etc — keep modal open with error
      setChallenge({ ...challenge, status: "WAITING_FOR_USER" });
      return { status: res.status };
    },
    [challenge],
  );

  const refresh = useCallback(async () => {
    if (!challenge) return;
    const res: any = await refreshKompasCaptcha(challenge.challengeId);
    if (res.status === "WAITING_FOR_USER" && res.captcha) {
      setChallenge({ challengeId: res.challengeId, captchaImage: res.captcha.data, status: "WAITING_FOR_USER" });
    } else if (res.status === "EXPIRED" || res.status === "SESSION_LOST") {
      setChallenge({ ...challenge, status: res.status as any });
    }
  }, [challenge]);

  const cancel = useCallback(async () => {
    if (challenge) {
      await cancelKompasCaptcha(challenge.challengeId).catch(() => {});
      setChallenge(null);
    }
  }, [challenge]);

  const clear = useCallback(() => setChallenge(null), []);

  return { challenge, handleCaptchaRequired, checkResponseForCaptcha, submit, refresh, cancel, clear };
}
