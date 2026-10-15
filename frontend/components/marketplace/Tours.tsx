"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "@phosphor-icons/react";
import { t, useLocale, formatDate } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";
import { useHotelPhoto } from "@/lib/hotel-photo";

function TourCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-dark-card">
      <div className="h-36 w-full animate-pulse bg-dark-border" />
      <div className="p-4">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-dark-border" />
        <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-dark-border" />
        <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-dark-border" />
        <div className="mb-3 h-3 w-2/3 animate-pulse rounded bg-dark-border" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-dark-border" />
          <div className="h-3 w-16 animate-pulse rounded bg-dark-border" />
        </div>
      </div>
    </div>
  );
}

function TourCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  // Fallback: единое фото отеля из реестра (/hotels/hotel_<hotelId>.webp), а для
  // карточек без него — legacy-файл по slug (см. lib/hotel-photo.ts).
  const hotelPhoto = useHotelPhoto(card.hotelImage, card.slug);
  const img = card.primaryImage ? { thumbUrl: card.primaryImage.thumbUrl } : hotelPhoto ? { thumbUrl: hotelPhoto } : null;

  return (
    <Link
      href={`/products/${card.code}`}
      className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
    >
      {/* Image — уменьшенная высота фото */}
      <div className="relative h-36 overflow-hidden bg-dark-border">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-600">
            <Compass size={40} weight="light" />
          </div>
        )}
        <div className="destination-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="p-4">
        {card.category?.title && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            {card.category.title}
          </p>
        )}
        <h3 className="line-clamp-2 font-serif text-sm font-semibold text-white transition-colors group-hover:text-gold">
          {card.title}
        </h3>
        {card.shortDescription && (
          <p className="mt-1 line-clamp-1 text-[10px] text-neutral-500">
            {card.shortDescription}
          </p>
        )}
        {card.seller && (
          <p className="mt-1 text-[10px] text-neutral-500">
            {card.seller.visibilityMode === "ANONYMOUS"
              ? t("seller.anonymous_label", locale)
              : card.seller.displayName ?? t("seller.anonymous_label", locale)}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div>
            {card.priceFrom ? (
              <p className="text-xs font-semibold text-gold">
                {t("price.from", locale)} {card.priceFrom} {card.currency || ""}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">{t("price.on_request", locale)}</p>
            )}
            {(card.headlineDepartureDate || card.headlineNights != null) && (
              <p className="mt-1 text-[10px] text-neutral-400">
                {card.headlineDepartureDate && (
                  <span>{formatDate(card.headlineDepartureDate, locale)}</span>
                )}
                {card.headlineDepartureDate && card.headlineNights != null && <span> · </span>}
                {card.headlineNights != null && (
                  <span>{card.headlineNights} {card.headlineNights === 1 ? t("card.night", locale) : t("card.nights", locale)}</span>
                )}
              </p>
            )}
          </div>
          <span className="text-[11px] text-neutral-500 transition-colors group-hover:text-gold">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Tours() {
  const locale = useLocale();
  const [tours, setTours] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    // Server-side `category` filter: the newest-50 window is currently filled
    // entirely by HOTEL products (they were ingested after the tours), so a
    // client-side `type` filter over an unfiltered page silently yields zero
    // items and the whole section renders `null`. Filtering by category happens
    // in SQL over the full published set (5478 tours), so the block can no
    // longer be pushed out of the window by another product type.
    // Skip the first 6 (shown in Hot Tours) to avoid duplication.
    void publicApi
      .listProducts({ category: "tours", sort: "newest", pageSize: 50 })
      .then((r) => {
        if (alive) {
          const toursOnly = r.items
            .filter((item) => item.type === "TOUR")
            .slice(6, 12); // Skip first 6 (Hot Tours), take next 6
          setTours(toursOnly);
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
  if (!loading && (tours.length === 0 || error)) return null;

  return (
    <section className="bg-dark th-section">
      <div className="th-container">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.tours_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.tours_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?category=tours"
            className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
          >
            {t("marketplace.all_tours", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <TourCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Tour cards */}
        {!loading && tours.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tours.map((tour) => (
              <TourCard key={tour.id} card={tour} />
            ))}
          </div>
        )}

        {/* Mobile all tours link */}
        {!loading && tours.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/search?category=tours"
              className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
            >
              {t("marketplace.all_tours", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
