"use client";

import { useState } from "react";

export type KompasCaptchaModalStatus =
  | "WAITING_FOR_USER"
  | "SUBMITTING"
  | "INVALID_ANSWER"
  | "EXPIRED"
  | "SESSION_LOST"
  | "KOMPAS_ERROR"
  | "TIMEOUT"
  | "CANCELLED";

export function KompasCaptchaModal({
  challengeId,
  captchaImage,
  status,
  errorText,
  onSubmit,
  onRefresh,
  onCancel,
}: {
  challengeId: string;
  /** data:image/jpeg;base64,... real image from #icaptcha */
  captchaImage: string;
  status?: KompasCaptchaModalStatus;
  errorText?: string;
  onSubmit: (answer: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onCancel: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isExpired = status === "EXPIRED";
  const isSessionLost = status === "SESSION_LOST";
  const isInvalid = status === "INVALID_ANSWER";

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      setLocalError("Введите символы с изображения");
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLocalError(null);
    try {
      await onRefresh();
      setAnswer("");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Проверка KOMPAS</h3>
          <button
            onClick={onCancel}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">Для обновления цен необходимо пройти проверку KOMPAS.</p>

          {/* Captcha image — real #icaptcha src, never fake */}
          <div className="flex justify-center">
            {captchaImage ? (
              <img
                id="kompas-captcha-image"
                src={captchaImage}
                alt="Captcha"
                className="rounded-lg border border-slate-200 bg-slate-50"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            ) : (
              <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                Изображение CAPTCHA не загружено
              </div>
            )}
          </div>

          {/* States */}
          {isExpired && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Срок проверки истёк. Нажмите «Обновить», чтобы получить новое изображение.
            </div>
          )}
          {isSessionLost && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              Сессия KOMPAS утеряна. Закройте окно и повторите запрос.
            </div>
          )}
          {isInvalid && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              Неверный код. Проверьте символы и попробуйте снова.
            </div>
          )}
          {errorText && !isInvalid && !isExpired && !isSessionLost && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errorText}</div>
          )}
          {localError && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{localError}</div>}

          {/* Answer field — maps to #fcaptcha on backend */}
          <div>
            <label htmlFor="kompas-captcha-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              Код с изображения
            </label>
            <input
              id="kompas-captcha-input"
              name="fcaptcha"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting && !refreshing) handleSubmit();
              }}
              disabled={submitting || refreshing || isSessionLost}
              placeholder="Введите символы"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={submitting || refreshing}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? "Обновление…" : "Обновить"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || refreshing || isSessionLost || isExpired}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Проверка…" : "Продолжить"}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">challengeId: {challengeId.slice(0, 8)}…</p>
        </div>
      </div>
    </div>
  );
}
