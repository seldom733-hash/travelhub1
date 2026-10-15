import { stat } from "node:fs/promises";
import path from "node:path";

/**
 * Дешёвый отрицательный ответ на HEAD-проб фото отелей (см. lib/hotel-photo.ts).
 *
 * Карточки витрины проверяют `/hotels/<key>.jpg|.png` файл-конвенцией. Файлов в
 * `public/hotels/` почти нет, и каждый такой промах раньше упирался в рендер
 * not-found страницы: ~763 мс application-code на запрос, 836 запросов за сессию
 * (~10 минут занятого dev-сервера) — навигация по клику на карточку стояла в
 * очереди позади и отклик казался поздним.
 *
 * Хендлер отвечает за миллисекунды, отдаёт 404 с `cache-control` (браузер
 * запоминает промах и перестаёт стучаться) и НИКОГДА не затирает настоящие
 * файлы: `public/*` обслуживается статикой раньше динамических маршрутов, а на
 * случай расхождения файл читается и отдаётся здесь.
 */
const PUBLIC_HOTELS = path.join(process.cwd(), "public", "hotels");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  // Единый каталог фото отелей хранит файлы как `hotel_<id>.webp`.
  ".webp": "image/webp",
};

function notFound(): Response {
  return new Response(null, {
    status: 404,
    // Короткий TTL: после скачания новых фото (fetch-hotel-photos) карточка
    // увидит их без долгого ожидания протухания.
    headers: { "cache-control": "public, max-age=300" },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await ctx.params;
  // basename — защита от path traversal (`../../…`).
  const safe = path.basename(file);
  const type = CONTENT_TYPES[path.extname(safe).toLowerCase()];
  if (!type) return notFound();

  let size: number;
  try {
    size = (await stat(path.join(PUBLIC_HOTELS, safe))).size;
  } catch {
    return notFound();
  }

  const headers: Record<string, string> = {
    "content-type": type,
    "content-length": String(size),
    "cache-control": "public, max-age=31536000, immutable",
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });

  const { readFile } = await import("node:fs/promises");
  return new Response(await readFile(path.join(PUBLIC_HOTELS, safe)), { status: 200, headers });
}
