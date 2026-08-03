/**
 * Разбор неуспешного ответа API (4xx/5xx) для показа пользователю.
 *
 * Возвращает понятное сообщение вида «Сервер вернул 500: <причина>» и
 * логирует детали (URL, статус, тело ответа) в консоль браузера (F12 → Console).
 *
 * Использование: `if (!res.ok) throw new Error(await describeApiError(res, fallback));`
 */

interface ApiErrorBody {
  error?: string;
  detail?: string;
  message?: string;
}

export async function describeApiError(res: Response, fallback: string): Promise<string> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null; // ответ не JSON (например, 502 от прокси или HTML-страница)
  }

  const statusText = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;

  // Детали из тела ответа: сервер может прислать detail (расшифровка) или error (общее).
  const detail = body?.detail || body?.error || body?.message || "";

  // Подробности — в консоль браузера: URL, статус и тело ответа целиком (без обрезки).
  console.error(`[API] ${res.status} ${res.url}`, {
    status: res.status,
    statusText: res.statusText,
    body,
  });

  if (detail) {
    // На экране показываем краткую расшифровку — длинные сообщения Prisma обрезаем,
    // полный текст остаётся в консоли браузера (F12 → Console).
    const displayDetail = detail.length > 300 ? `${detail.slice(0, 300)}…` : detail;
    return `Сервер вернул ${statusText}: ${displayDetail}`;
  }
  return `${fallback} (HTTP ${res.status})`;
}
