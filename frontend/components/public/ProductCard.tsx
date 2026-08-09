"use client";

import Link from "next/link";
import { t, useLocale } from "@/lib/i18n";
import { useMarketplaceCardImpression } from "@/lib/behavioral-events";
import type { PublicProductCard } from "@/lib/public-api";
import { formatLocation } from "@/lib/locations";
import { availabilityText } from "@/lib/marketplace-utils";
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
  const img = card.primaryImage;
  const availability = availabilityText(card.availabilitySummary, locale);
  const icon = TYPE_ICON[card.type] ?? "🏝";

  // Step 1.13B: rendered-card impression (карточка реально отрисована в grid;
  // viewport — deferred). 0-based позиция в текущем grid; fire-once per mount.
  useMarketplaceCardImpression(card.slug, position, true);

  // Простые локации/длительности карточка получает из публичного контракта:
  // здесь только то, что реально отдаёт PublicProductCard.
  return (
    <Link
      href={`/products/${card.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">{icon}</div>
        )}
        {availability.tone === "limited" && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {t("card.availability_limited", locale)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {card.category?.title ?? card.type}
        </div>
        <div className="line-clamp-2 font-bold text-slate-900 transition-colors group-hover:text-blue-600" title={card.title}>
          {card.title}
        </div>
        {/* Step 1.11 §9: seller-safe projection — ANONYMOUS → generic label, никогда raw CRM name */}
        {card.seller && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="truncate">
              {card.seller.visibilityMode === "ANONYMOUS" ? t("seller.anonymous_label", locale) : (card.seller.displayName ?? t("seller.anonymous_label", locale))}
            </span>
            {card.seller.verified && <span className="shrink-0 text-emerald-600" title={t("seller.verified_badge", locale)}>✓</span>}
          </div>
        )}
        {/* FIX 2: география — коды (countryCode/cityCode), локализуется по locale. */}
        {card.seller &&
          (() => {
            const loc = formatLocation(card.seller.countryCode, card.seller.cityCode, locale);
            return loc ? <div className="text-[11px] text-slate-400">📍 {loc}</div> : null;
          })()}
        {card.shortDescription && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{card.shortDescription}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price amount={card.priceFrom} currency={card.currency} size="sm" />
          <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
