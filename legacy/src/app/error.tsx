"use client";

import ErrorScreen from "@/components/ErrorScreen";

/**
 * Error boundary для сегментов публичного сайта (внутри (site)).
 * Показывается вместо упавшего содержимого — не белый экран.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorScreen error={error} unstable_retry={unstable_retry} />;
}
