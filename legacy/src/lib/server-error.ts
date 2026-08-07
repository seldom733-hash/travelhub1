import { NextResponse } from "next/server";

/**
 * Единый ответ на необработанную ошибку сервера (500).
 *
 * Логирует полную ошибку в серверную консоль (там — стек и причина), а клиенту
 * возвращает краткую расшифровку в поле `detail`, чтобы UI мог показать её
 * пользователю (см. describeApiError в src/lib/api-error.ts).
 */
export function serverErrorResponse(error: unknown, logPrefix = "API error"): NextResponse {
  console.error(`${logPrefix}:`, error);
  const detail = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return NextResponse.json({ error: "Server error", detail }, { status: 500 });
}
