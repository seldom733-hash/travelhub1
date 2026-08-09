"use client";

import { useCallback, useEffect, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import type { PublicMedia } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.7 §13 — Media Gallery на стабильных public delivery URL
 * (/api/v1/public/media/:id/thumb|large). Только PUBLISHED media текущей версии
 * (backend уже фильтрует); moderation signed URLs не используются.
 * - keyboard: ← → переключение, focus-visible на кнопках, aria-live для alt;
 * - lazy loading + graceful fallback.
 */
export default function MediaGallery({ media }: { media: PublicMedia[] }) {
  const locale = useLocale();
  const [active, setActive] = useState(0);

  const ordered = [...media].sort((a, b) => a.sortOrder - b.sortOrder || Number(b.isPrimary) - Number(a.isPrimary));
  const images = ordered.length > 0 ? ordered : [];
  const current = images[Math.min(active, Math.max(0, images.length - 1))];

  const go = useCallback(
    (dir: 1 | -1) => {
      if (images.length === 0) return;
      setActive((a) => (a + dir + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    setActive(0);
  }, [media]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl bg-slate-100 text-5xl text-slate-300">
        🏝
      </div>
    );
  }

  const alt = (current?.altText ?? `${current?.caption ?? ""}`.trim()) || t("pdp.gallery_main_alt", locale);

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-xl bg-slate-100"
        tabIndex={0}
        role="group"
        aria-roledescription="gallery"
        aria-label={`${t("pdp.gallery_main_alt", locale)} (${images.indexOf(current) + 1} / ${images.length})`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current?.id}
          src={current?.url.large}
          alt={alt}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("pdp.gallery_prev", locale)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/50 p-2 text-white backdrop-blur transition hover:bg-slate-900/70 focus-visible:outline-2 focus-visible:outline-white"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("pdp.gallery_next", locale)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/50 p-2 text-white backdrop-blur transition hover:bg-slate-900/70 focus-visible:outline-2 focus-visible:outline-white"
            >
              →
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="gallery thumbnails">
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${i + 1} / ${images.length}`}
              aria-current={i === active}
              className={`overflow-hidden rounded-lg border-2 transition focus-visible:outline-2 focus-visible:outline-blue-500 ${
                i === active ? "border-blue-600" : "border-transparent hover:border-blue-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url.thumb} alt="" loading="lazy" className="size-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
