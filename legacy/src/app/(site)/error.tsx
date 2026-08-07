"use client";

import ErrorScreen from "@/components/ErrorScreen";

/**
 * Error boundary для публичного сайта ((site) сегмент).
 * Отображается внутри (site)/layout.tsx, поэтому Header и Footer сохраняются —
 * страница 500 выглядит как часть сайта, с формой «Сообщить об ошибке».
 */
export default function SiteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorScreen error={error} unstable_retry={unstable_retry} />;
}
