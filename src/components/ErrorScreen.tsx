"use client";

import { useEffect } from "react";
import Link from "next/link";
import ErrorReportForm from "@/components/ErrorReportForm";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
  /** Тёмный вариант для админки (CSS-переменные --admin-* из globals.css) */
  dark?: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * Общий экран ошибки для error.tsx / global-error.tsx.
 * Вместо белого экрана показывает понятное сообщение, кнопку «Попробовать снова»
 * (unstable_retry) и ссылку на главную.
 *
 * Светлая тема — через Tailwind-классы; тёмная — через CSS-переменные в inline style.
 * Базовый layout (мин-высота и центрирование) задан inline-стилями, чтобы экран
 * корректно рендерился и в global-error, который не получает глобальные стили.
 */
export default function ErrorScreen({
  error,
  unstable_retry,
  dark = false,
  title = "Что-то пошло не так",
  subtitle = "Произошла непредвиденная ошибка. Попробуйте ещё раз или вернитесь на главную страницу.",
}: ErrorScreenProps) {
  // Логируем ошибку (в консоль браузера; в будущем — в службу мониторинга)
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <main
      className={dark ? "" : "bg-gradient-to-b from-orange-50/60 to-white"}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1rem",
        background: dark ? "var(--admin-bg)" : undefined,
        color: dark ? "var(--admin-text)" : undefined,
      }}
    >
      <div
        className={dark ? "" : "bg-white"}
        style={{
          maxWidth: "28rem",
          width: "100%",
          borderRadius: "1.5rem",
          padding: "2rem",
          boxShadow: dark ? undefined : "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          border: dark ? "1px solid var(--admin-border)" : "1px solid #f1f5f9",
          background: dark ? "var(--admin-card)" : undefined,
        }}
      >
        <div className="text-center">
          <div className="text-5xl mb-3">🛠️</div>
          <h1 className="text-2xl font-bold mb-2" style={dark ? { color: "var(--admin-text)" } : { color: "#0f172a" }}>
            {title}
          </h1>
          <p className="text-sm mb-6" style={dark ? { color: "var(--admin-muted)" } : { color: "#6b7280" }}>
            {subtitle}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={unstable_retry}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-base transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
            style={{
              width: "100%",
              height: "3rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#f97316",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="w-full h-12 rounded-xl flex items-center justify-center text-sm font-medium transition-colors"
            style={{
              width: "100%",
              height: "3rem",
              borderRadius: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              ...(dark
                ? { border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }
                : { border: "1px solid #e5e7eb", color: "#6b7280" }),
            }}
          >
            ← На главную
          </Link>
        </div>

        {error.digest && (
          <p className="text-center text-[11px] mt-6 font-mono" style={dark ? { color: "var(--admin-muted)" } : { color: "#9ca3af" }}>
            Код ошибки: {error.digest}
          </p>
        )}

        <ErrorReportForm digest={error.digest} dark={dark} />
      </div>
    </main>
  );
}
