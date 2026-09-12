"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Tag } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";

const SERVICE_BADGES: Record<string, { ru: string; az: string; en: string }> = {
  TOUR: { ru: "ТУР", az: "TUR", en: "TOUR" },
  HOTEL: { ru: "ОТЕЛЬ", az: "OTEL", en: "HOTEL" },
  FLIGHT: { ru: "АВИА", az: "AVİA", en: "FLIGHT" },
  SANATORIUM: { ru: "САНАТОРИЙ", az: "SANATORİ", en: "SANATORIUM" },
  EXCURSION: { ru: "ЭКСКУРСИЯ", az: "EKSKURSİYA", en: "EXCURSION" },
  TRANSFER: { ru: "ТРАНСФЕР", az: "TRANSFER", en: "TRANSFER" },
  CAR_RENTAL: { ru: "АВТО", az: "AVTO", en: "CAR" },
  RAILWAY: { ru: "Ж/Д", az: "DƏMİR YOLU", en: "RAILWAY" },
  CRUISE: { ru: "КРУИЗ", az: "KRUIZ", en: "CRUISE" },
  GUIDE: { ru: "ГИД", az: "BƏLƏDÇİ", en: "GUIDE" },
};

function OfferCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-dark-card">
      <div className="flex">
        <div className="aspect-[4/3] w-32 shrink-0 animate-pulse bg-dark-border sm:w-40" />
        <div className="flex flex-1 flex-col justify-center p-4">
          <div className="mb-2 h-3 w-14 animate-pulse rounded bg-dark-border" />
          <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-dark-border" />
          <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-dark-border" />
          <div className="h-4 w-20 animate-pulse rounded bg-dark-border" />
        </div>
      </div>
    </div>
  );
}

function OfferCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  const img = card.primaryImage;
  const badge = card.type ? SERVICE_BADGES[card.type] : null;

  return (
    <Link
      href={`/products/${card.slug}`}
      className="card-premium group relative flex overflow-hidden rounded-2xl bg-dark-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden bg-dark-border sm:w-40">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-neutral-600">
            <Tag size={28} weight="light" />
          </div>
        )}
        <div className="destination-overlay absolute inset-0" />
        {/* Service badge */}
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            {badge[locale] ?? badge.en}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {card.category?.title && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {card.category.title}
            </p>
          )}
          <h3 className="line-clamp-2 font-serif text-sm font-semibold text-white transition-colors group-hover:text-amber-400 sm:text-base">
            {card.title}
          </h3>
          {card.seller && (
            <p className="mt-1 text-[11px] text-neutral-500">
              {card.seller.visibilityMode === "ANONYMOUS"
                ? t("seller.anonymous_label", locale)
                : card.seller.displayName ?? t("seller.anonymous_label", locale)}
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          {card.priceFrom ? (
            <p className="text-sm font-semibold text-amber-400">
              {t("price.from", locale)} {card.priceFrom} {card.currency || ""}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">{t("price.on_request", locale)}</p>
          )}
          <div className="flex size-7 items-center justify-center rounded-full border border-dark-border bg-dark/60 text-neutral-400 transition-colors group-hover:border-amber-400/40 group-hover:text-amber-400">
            <ArrowRight size={14} weight="light" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SpecialOffers() {
  const locale = useLocale();
  const [offers, setOffers] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    // No dedicated promotion/discount backend exists. Use the public catalog
    // with price_asc sort to surface the most affordable published products
    // as a "special offers" collection. All types shown (not just tours).
    void publicApi
      .listProducts({ sort: "price_asc", pageSize: 50 })
      .then((r) => {
        if (alive) {
          // Take first 4 affordable products across all types
          setOffers(r.items.slice(0, 4));
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, []);

  // Don't render section at all if empty or error
  if (!loading && (offers.length === 0 || error)) return null;

  return (
    <section className="bg-dark-card/30 py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.special_offers_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.special_offers_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?sort=price_asc"
            className="hidden items-center gap-1.5 text-sm text-amber-400 transition-colors hover:text-amber-300 sm:flex"
          >
            {t("marketplace.all_offers", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <OfferCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Offer cards */}
        {!loading && offers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {offers.map((offer) => (
              <OfferCard key={offer.id} card={offer} />
            ))}
          </div>
        )}

        {/* Mobile all offers link */}
        {!loading && offers.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/search?sort=price_asc"
              className="inline-flex items-center gap-1.5 text-sm text-amber-400 transition-colors hover:text-amber-300"
            >
              {t("marketplace.all_offers", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
