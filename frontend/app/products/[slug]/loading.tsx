"use client";

import { PdpSkeleton } from "@/components/public/Skeletons";
import { t, useLocale } from "@/lib/i18n";

/**
 * Мгновенный отклик на клик по карточке с витрины (§LATENCY).
 *
 * Без этого файла App Router держал на экране ПРЕДЫДУЩУЮ страницу, пока не
 * приходил RSC-ответ (~0,3 с в горячем состоянии и заметно больше, когда
 * dev-сервер занят): клик выглядел как «отклик срабатывает поздно». Граница
 * loading рисуется сразу по клику (и её же подхватывает prefetch по ховеру),
 * а layout выше уже даёт шапку/футер — видно ровно тот же chrome, что и на
 * самой карточке.
 */
export default function ProductLoading() {
  const locale = useLocale();
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{t("state.loading", locale)}</span>
      <PdpSkeleton />
    </div>
  );
}
