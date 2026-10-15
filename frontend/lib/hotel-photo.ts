"use client";

import { useEffect, useState } from "react";

/**
 * Единый каталог фотографий отелей Navitravel.
 *
 * Одна физическая гостиница = ОДНА фотография в `frontend/public/hotels/`,
 * имя файла `hotel_<hotelId>.webp` (hotelId — `catalog."Hotel".id` из реестра).
 * Ссылку отдаёт бэкенд (`PublicProductCard.hotelImage` /
 * `PublicProductDetail.product.hotelImage`) — она одинакова для тура с этим
 * отелем, карточки в услуге «Отели», результатов поиска и конструктора и для
 * всех поставщиков, предлагающих этот отель. Копий для туров/поставщиков нет.
 *
 * Здесь — только проверка доступности файла (HEAD, с кешем). Файл может быть
 * ещё не скачан — тогда карточка показывает иконку-фолбэк.
 *
 * Legacy: до перехода на реестр имена были `<tourinc>-<hotelKey>.jpg` (туры) и
 * `htl-<hotelKey>.jpg` (отели). Разбираются из slug и используются как резерв,
 * пока такие файлы ещё лежат на диске.
 */

export const HOTEL_PHOTO_DIR = "/hotels";

/** Legacy фото-ключ из product slug:
 *  - тур `<supplier>-<tourinc>-<hotelKey>…` → `<tourinc>-<hotelKey>` (напр. `5283-31215`);
 *  - отель `kompas-hotel-<iso>-<hotelKey>` → `htl-<hotelKey>`. */
export function hotelPhotoKeyFromSlug(slug: string): string | null {
  const hotel = slug.match(/^[a-z]+-hotel-[a-z]{2}-(\d+)/);
  if (hotel) return `htl-${hotel[1]}`;
  const parts = slug.split("-");
  if (parts.length < 3) return null;
  const tourInc = parts[1];
  const hotelKey = parts[2];
  if (!/^\d+$/.test(tourInc) || !/^\d+$/.test(hotelKey)) return null;
  return `${tourInc}-${hotelKey}`;
}

/** Расширения, в которых ищем legacy-файл (реестр всегда отдаёт точное имя). */
const LEGACY_EXTS = ["jpg", "png", "webp"] as const;

/**
 * Кеш HEAD-проверок: ОДИН запрос на URL за жизнь страницы — включая
 * отрицательный результат. Иначе каждая карточка при каждом монтаже снова
 * сыпала HEAD на `/hotels/*` (в логе dev-сервера — 836 запросов по ~763 мс),
 * и навигация по клику стояла в их очереди — «отклик срабатывает поздно».
 */
const photoProbeCache = new Map<string, Promise<string | null>>();

/** Сброс кеша проб (только для тестов). */
export function resetPhotoProbeCache(): void {
  photoProbeCache.clear();
}

/** HEAD-проверка конкретного публичного URL (`/hotels/...`). 404 → null. */
export function probePhotoUrl(url: string): Promise<string | null> {
  let pending = photoProbeCache.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return url;
      } catch {
        // транспортная ошибка — считаем, что файла нет (кеш не отравляем)
      }
      return null;
    })();
    photoProbeCache.set(url, pending);
    pending.catch(() => photoProbeCache.delete(url));
  }
  return pending;
}

/** Legacy-файл по ключу `<tourinc>-<hotelKey>` / `htl-<hotelKey>` (jpg|png|webp). */
export async function fetchHotelPhoto(key: string): Promise<string | null> {
  for (const ext of LEGACY_EXTS) {
    const url = `${HOTEL_PHOTO_DIR}/${encodeURIComponent(key)}.${ext}`;
    const found = await probePhotoUrl(url);
    if (found) return found;
  }
  return null;
}

/**
 * React-хук: доступный URL фото отеля карточки.
 *  1. `imageUrl` от бэкенда (единый файл реестра или legacy-.jpg) — если доступен;
 *  2. иначе legacy-файл по slug (перебор расширений);
 *  3. иначе null — карточка показывает иконку-фолбэк.
 */
export function useHotelPhoto(imageUrl?: string | null, legacySlug?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    void (async () => {
      const direct = imageUrl ? await probePhotoUrl(imageUrl) : null;
      if (direct) {
        if (alive) setUrl(direct);
        return;
      }
      const key = legacySlug ? hotelPhotoKeyFromSlug(legacySlug) : null;
      const legacy = key ? await fetchHotelPhoto(key) : null;
      if (alive) setUrl(legacy);
    })();
    return () => {
      alive = false;
    };
  }, [imageUrl, legacySlug]);
  return url;
}
