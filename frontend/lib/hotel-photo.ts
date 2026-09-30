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

/** `<tourinc>-<hotelKey>` из product slug (например `kazunion-1553-7493-antalya` → `1553-7493`). */
export function hotelPhotoKeyFromSlug(slug: string): string | null {
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
 * Локальный URL фото отеля, если оно уже скачано (`/hotels/<key>.jpg|.png`).
 * Проверяется файл-конвенцией запросом HEAD — 404 (файла нет) → null.
 */
export async function fetchHotelPhoto(key: string): Promise<string | null> {
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
