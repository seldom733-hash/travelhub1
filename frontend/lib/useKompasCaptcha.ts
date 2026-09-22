"use client";

import { useState, useCallback } from "react";
import {
  isCaptchaRequired,
  verifyKompasCaptcha,
  refreshKompasCaptcha,
  cancelKompasCaptcha,
  verifySummertourCaptcha,
  refreshSummertourCaptcha,
  cancelSummertourCaptcha,
  type KompasCaptchaRequiredResponse,
} from "./supplier-api";

export type CaptchaSupplier = "KOMPAS" | "SUMMERTOUR";

export type CaptchaChallengeState = {
  challengeId: string;
  captchaImage: string; // data:image/...
  status: "WAITING_FOR_USER" | "INVALID_ANSWER" | "EXPIRED" | "SESSION_LOST";
  supplier: CaptchaSupplier;
};

export function useKompasCaptcha(defaultSupplier: CaptchaSupplier = "KOMPAS") {
  const [challenge, setChallenge] = useState<CaptchaChallengeState | null>(null);

  const handleCaptchaRequired = useCallback((res: KompasCaptchaRequiredResponse, supplier?: CaptchaSupplier) => {
    setChallenge({
      challengeId: res.challengeId,
      captchaImage: res.captcha.data,
      status: "WAITING_FOR_USER",
      supplier: supplier ?? res.supplier ?? defaultSupplier,
    });
  }, [defaultSupplier]);

  const checkResponseForCaptcha = useCallback(
    (data: unknown, supplier?: CaptchaSupplier): boolean => {
      if (isCaptchaRequired(data)) {
        handleCaptchaRequired(data, supplier);
        return true;
      }
      return false;
    },
    [handleCaptchaRequired],
  );

  const verifyFn = useCallback(
    (challengeId: string, answer: string) => {
      const s = challenge?.supplier ?? defaultSupplier;
      return s === "SUMMERTOUR"
        ? verifySummertourCaptcha(challengeId, answer)
        : verifyKompasCaptcha(challengeId, answer);
    },
    [challenge?.supplier, defaultSupplier],
  );

  const refreshFn = useCallback(
    (challengeId: string) => {
      const s = challenge?.supplier ?? defaultSupplier;
      return s === "SUMMERTOUR"
        ? refreshSummertourCaptcha(challengeId)
        : refreshKompasCaptcha(challengeId);
    },
    [challenge?.supplier, defaultSupplier],
  );

  const cancelFn = useCallback(
    (challengeId: string) => {
      const s = challenge?.supplier ?? defaultSupplier;
      return s === "SUMMERTOUR"
        ? cancelSummertourCaptcha(challengeId)
        : cancelKompasCaptcha(challengeId);
    },
    [challenge?.supplier, defaultSupplier],
  );

  const submit = useCallback(
    async (answer: string, onSuccess: (data: unknown) => void): Promise<{ status: string; newImage?: string }> => {
      if (!challenge) return { status: "EXPIRED" };
      const res: any = await verifyFn(challenge.challengeId, answer);
      if (res.status === "SUCCESS") {
        setChallenge(null);
        onSuccess(res.data);
        return { status: "SUCCESS" };
      }
      if (res.status === "INVALID_ANSWER") {
        const newImg = res.captcha?.data ?? challenge.captchaImage;
        setChallenge({ challengeId: res.challengeId ?? challenge.challengeId, captchaImage: newImg, status: "INVALID_ANSWER", supplier: challenge.supplier });
        return { status: "INVALID_ANSWER", newImage: newImg };
      }
      if (res.status === "CAPTCHA_REQUIRED" && res.captcha) {
        setChallenge({ challengeId: res.challengeId, captchaImage: res.captcha.data, status: "WAITING_FOR_USER", supplier: challenge.supplier });
        return { status: "CAPTCHA_REQUIRED", newImage: res.captcha.data };
      }
      if (res.status === "EXPIRED" || res.status === "SESSION_LOST") {
        setChallenge({ ...challenge, status: res.status as any });
        return { status: res.status };
      }
      setChallenge({ ...challenge, status: "WAITING_FOR_USER" });
      return { status: res.status };
    },
    [challenge, verifyFn],
  );

  const refresh = useCallback(async () => {
    if (!challenge) return;
    const res: any = await refreshFn(challenge.challengeId);
    if (res.status === "WAITING_FOR_USER" && res.captcha) {
      setChallenge({ challengeId: res.challengeId, captchaImage: res.captcha.data, status: "WAITING_FOR_USER", supplier: challenge.supplier });
    } else if (res.status === "EXPIRED" || res.status === "SESSION_LOST") {
      setChallenge({ ...challenge, status: res.status as any });
    }
  }, [challenge, refreshFn]);

  const cancel = useCallback(async () => {
    if (challenge) {
      await cancelFn(challenge.challengeId).catch(() => {});
      setChallenge(null);
    }
  }, [challenge, cancelFn]);

  const clear = useCallback(() => setChallenge(null), []);

  return { challenge, handleCaptchaRequired, checkResponseForCaptcha, submit, refresh, cancel, clear };
}
