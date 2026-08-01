"use client";

import ErrorScreen from "@/components/ErrorScreen";

/**
 * Error boundary для админ-панели — тёмная тема (CSS-переменные --admin-*).
 */
export default function AdminErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorScreen
      error={error}
      unstable_retry={unstable_retry}
      dark
      title="Ошибка в админ-панели"
      subtitle="Не удалось отобразить раздел. Попробуйте ещё раз или вернитесь на главную страницу."
    />
  );
}
