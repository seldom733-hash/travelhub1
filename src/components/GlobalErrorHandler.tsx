"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ErrorToast {
  id: number;
  message: string;
  kind: "error" | "rejection";
}

const MAX_TOASTS = 4;
const AUTO_DISMISS_MS = 8000;

/**
 * Глобальный перехват непойманных ошибок JavaScript.
 *
 * React-error-boundaries (error.tsx / global-error.tsx) ловят ошибки рендера,
 * но не ловят ошибки в обработчиках событий и асинхронном коде (fetch, setTimeout,
 * промисы без catch). Этот компонент вешает window.onerror / unhandledrejection
 * и показывает ненавязчивый тост вместо «тихого» падения.
 *
 * Монтируется в корневом layout (src/app/layout.tsx), поэтому работает на всём сайте.
 */
export default function GlobalErrorHandler() {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, kind: ErrorToast["kind"]) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, kind }]);
      // Автоскрытие
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      // Некоторые «ошибки» (например, ResizeObserver loop) — шум, не требующий внимания
      if (event.message && /ResizeObserver loop/i.test(event.message)) return;
      // Не дублируем ошибки, уже обработанные React error boundaries:
      // они перехватываются до window.onerror, так что сюда попадают только
      // действительно непойманные ошибки.
      console.error("[global:error]", event.error ?? event.message);
      pushToast(event.message || "Произошла непредвиденная ошибка", "error");
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = "Необработанный промис";
      if (event.reason instanceof Error) {
        message = event.reason.message || message;
      } else if (typeof event.reason === "string" && event.reason) {
        message = event.reason;
      }
      console.error("[global:rejection]", event.reason);
      pushToast(message, "rejection");
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [pushToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]"
      role="region"
      aria-label="Уведомления об ошибках"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="bg-secondary text-white rounded-2xl shadow-2xl border border-white/10 p-4 animate-fadeInUp flex items-start gap-3"
        >
          <div className="w-9 h-9 shrink-0 rounded-xl bg-danger/20 flex items-center justify-center text-lg">
            {toast.kind === "rejection" ? "⚠️" : "❌"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {toast.kind === "rejection" ? "Ошибка в фоновой задаче" : "Произошла ошибка"}
            </p>
            <p className="text-xs text-gray-300 mt-0.5 break-words line-clamp-3">{toast.message}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 h-7 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-medium transition-colors"
              >
                Перезагрузить
              </button>
              <button
                onClick={() => dismiss(toast.id)}
                className="px-3 h-7 rounded-lg border border-white/20 text-gray-300 hover:text-white text-xs transition-colors"
              >
                Скрыть
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
