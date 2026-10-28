"use client";

import Link from "next/link";
import { useEffect } from "react";
import { t, useLocale } from "@/lib/i18n";

/**
 * Global error boundary (App Router). Next.js показывает его вместо белого
 * экрана/дефолтной страницы, когда рендер/загрузка данных падает.
 *
 * Требования:
 *  - client component с `reset()` — повторная попытка без полной перезагрузки;
 *  - локализация RU/AZ/EN через тот же i18n, что и остальной marketplace;
 *  - никаких деталей ошибки в UI (message/stack — только в консоль Next) —
 *    внутренние данные не должны утекать пользователю.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();

  useEffect(() => {
    // Next логирует ошибку на сервере; здесь — клиентская диагностика без PII.
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-2xl"
        >
          !
        </div>
        <h1 className="text-lg font-semibold text-ink">{t("error.title", locale)}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("error.description", locale)}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t("error.retry", locale)}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t("error.home", locale)}
          </Link>
        </div>
      </div>
    </main>
  );
}
