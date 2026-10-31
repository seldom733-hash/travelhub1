"use client";

import Link from "next/link";
import { t, useLocale, formatDateShort } from "@/lib/i18n";
import { useMarketplaceCardImpression } from "@/lib/behavioral-events";
import type { PublicProductCard } from "@/lib/public-api";
import { availabilityText } from "@/lib/marketplace-utils";
import { categoryLabel } from "@/lib/category-label";
import { useHotelPhoto } from "@/lib/hotel-photo";
import Price from "./Price";

/** Дефолтная иконка по типу категории/услуги (нейтральный fallback без image). */
const TYPE_ICON: Record<string, string> = {
  TOUR: "🗺",
  ACCOMMODATION: "🏨",
  EXCURSION: "🧭",
  FLIGHT: "✈️",
  TRANSFER: "🚐",
  RAIL: "🚆",
  CRUISE: "🛳",
  CAR_RENTAL: "🚗",
  GUIDE: "🎧",
  TICKET: "🎟",
  FOOD: "🍽",
  WELLNESS: "🧖",
  INSURANCE: "🛡",
  VISA: "🛂",
};

/**
 * PHASE 1 STEP 1.7 §7 — reusable Product Card на контракте PublicProductCard.
 * - НЕ показывает internal status/partnerId/storage keys/moderation;
 * - корректно работает без image, без price, без location, с длинным title;
 * - priceFrom через locale-aware Price (никогда «0»);
 * - availability — discovery-подсказка из реального availabilitySummary.
 */
export default function ProductCard({ card, position = 0 }: { card: PublicProductCard; position?: number }) {
  const locale = useLocale();
  const availability = availabilityText(card.availabilitySummary, locale);
  const icon = TYPE_ICON[card.type] ?? "🏝";

  // Фото отеля: единый файл физической гостиницы из реестра — бэкенд отдаёт
  // `hotelImage` (`/hotels/hotel_<hotelId>.webp`) один и тот же для тура, услуги
  // «Отели» и всех поставщиков этого отеля. Используется, когда у карточки нет
  // primaryImage (ProductMedia пуст у supplier-синков).
  // См. lib/hotel-photo.ts.
  const hotelPhoto = useHotelPhoto(card.hotelImage);
  const img = card.primaryImage ? { thumbUrl: card.primaryImage.thumbUrl } : hotelPhoto ? { thumbUrl: hotelPhoto } : null;

  // Step 1.13B: rendered-card impression (карточка реально отрисована в grid;
  // viewport — deferred). 0-based позиция в текущем grid; fire-once per mount.
  useMarketplaceCardImpression(card.slug, position, true);

  // Простые локации/длительности карточка получает из публичного контракта:
  // здесь только то, что реально отдаёт PublicProductCard.
  return (
    <Link
      href={`/products/${card.code}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-dark-border bg-dark-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-gold"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-dark-surface">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-600">{icon}</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-dark-card/80 to-transparent" />
        {availability.tone === "limited" && (
          <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-dark">
            {t("card.availability_limited", locale)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
          <span>{categoryLabel(card.category, locale) || card.type}</span>
          {card.partnerCode && (
            <span className="flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-neutral-500">
              <span>{`${t("card.supplier_code", locale)}:`}</span>
              <span className="font-mono">{card.partnerCode}</span>
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-white transition-colors group-hover:text-gold" title={card.title}>
          {card.title}
        </h3>
        {card.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">{card.shortDescription}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <Price amount={card.priceFrom} currency={card.currency} size="sm" withPrefix={false} tone="gold" />
            {(card.headlineDepartureDate || card.headlineNights) && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-400">
                {card.headlineDepartureDate && (
                  <span>{formatDateShort(card.headlineDepartureDate, locale)}</span>
                )}
                {card.headlineDepartureDate && card.headlineNights && <span>·</span>}
                {card.headlineNights != null && (
                  <span>{card.headlineNights} {card.headlineNights === 1 ? t("card.night", locale) : t("card.nights", locale)}</span>
                )}
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-dark-border px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-dark">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
