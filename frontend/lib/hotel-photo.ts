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
 * Легаси-имён (`<tourinc>-<hotelKey>.jpg|png|webp` для туров, `htl-<hotelKey>.jpg`
 * для отелей) здесь больше нет: в `public/hotels/` таких файлов не осталось
 * (весь каталог — `hotel_<id>.webp`, 4603 файла), а каждый промах стоил трёх
 * HEAD-запросов, которые гарантированно отвечали 404.
 */

export const HOTEL_PHOTO_DIR = "/hotels";

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

/**
 * React-хук: доступный URL фото отеля карточки.
 *  1. `imageUrl` от бэкенда (единый файл реестра `hotel_<id>.webp`) — если доступен;
 *  2. иначе null — карточка показывает иконку-фолбэк.
 */
export function useHotelPhoto(imageUrl?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    void (async () => {
      const direct = imageUrl ? await probePhotoUrl(imageUrl) : null;
      if (alive) setUrl(direct);
    })();
    return () => {
      alive = false;
    };
  }, [imageUrl]);
  return url;
}
