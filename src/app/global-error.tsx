"use client";

import ErrorScreen from "@/components/ErrorScreen";

/**
 * Корневой error boundary — заменяет весь layout при падении во время рендера.
 * Обязательно должен содержать собственные <html> и <body>.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ru">
      <body className="antialiased" style={{ margin: 0 }}>
        <ErrorScreen error={error} unstable_retry={unstable_retry} />
      </body>
    </html>
  );
}
