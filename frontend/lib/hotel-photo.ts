"use client";

import { useEffect, useState } from "react";

/**
 * Локальные фото отелей для витрины туров.
 *
 * Синхи поставщиков (KOMPAS/KAZUNION/SUMMERTOUR) кладут карточки с
 * code/slug = `<supplier>-<tourinc>-<hotelKey>` (summer добавляет `-resort`).
 * Скрипт fetch-hotel-photos скачивает фото отелей с tripadvisor.ru в
 * frontend/public/hotels/ с именем `<tourinc>-<hotelKey>.jpg` (как просил
 * заказчик; рядом может лежать `.png`, если Tripadvisor отдал PNG).
 *
 * Фотография НЕ является частью ProductMedia-контракта (тот требует
 * ProductMedia/S3) — это лёгкий file-convention fallback для витрины.
 */

export const HOTEL_PHOTO_DIR = "/hotels";

/** Фото-ключ из product slug:
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

function extFor(mime: string): string | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  return null;
}

/**
 * Кеш пробников: ОДИН HEAD на ключ за жизнь страницы — включая отрицательный
 * результат. Раньше каждый монтаж карточки снова и снова сыпал HEAD на
 * `/hotels/*` (в логе dev-сервера — 836 запросов по ~763 мс, суммарно ~10 минут
 * занятого сервера), и навигация по клику на карточку стояла в очереди позади
 * них — пользователь видел «отклик срабатывает поздно».
 */
const photoProbeCache = new Map<string, Promise<string | null>>();

async function probeHotelPhoto(key: string): Promise<string | null> {
  for (const ext of ["jpg", "png"]) {
    const url = `${HOTEL_PHOTO_DIR}/${encodeURIComponent(key)}.${ext}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        const mime = res.headers.get("content-type") ?? "";
        if (extFor(mime) === ext) return url;
      }
    } catch {
      // network hiccup → try next ext
    }
  }
  return null;
}

/**
 * Локальный URL фото отеля, если оно уже скачано (`/hotels/<key>.jpg|.png`).
 * Проверяется файл-конвенцией запросом HEAD — 404 (файла нет) → null.
 */
export function fetchHotelPhoto(key: string): Promise<string | null> {
  let pending = photoProbeCache.get(key);
  if (!pending) {
    pending = probeHotelPhoto(key);
    photoProbeCache.set(key, pending);
    // Сбой транспорта не должен отравлять кеш: повторный монтаж попробует снова.
    pending.catch(() => photoProbeCache.delete(key));
  }
  return pending;
}

/**
 * React-хук: URL локального фото отеля для карточки товара (по slug).
 * Возвращает null, если slug не тур-синка или файл ещё не скачан.
 */
export function useHotelPhoto(slug: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!slug) return;
    const key = hotelPhotoKeyFromSlug(slug);
    if (!key) return;
    let alive = true;
    void fetchHotelPhoto(key).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  return url;
}
