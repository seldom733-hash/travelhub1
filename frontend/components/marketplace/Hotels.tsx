"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";

function HotelCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-dark-card">
      <div className="aspect-[4/3] w-full animate-pulse bg-dark-border" />
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

function HotelCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  const img = card.primaryImage;

  return (
    <Link
      href={`/products/${card.slug}`}
      className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-dark-border">
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
            <Buildings size={40} weight="light" />
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
        <h3 className="line-clamp-2 font-serif text-base font-semibold text-white transition-colors group-hover:text-gold">
          {card.title}
        </h3>
        {card.shortDescription && (
          <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
            {card.shortDescription}
          </p>
        )}
        {card.seller && (
          <p className="mt-1 text-[11px] text-neutral-500">
            {card.seller.visibilityMode === "ANONYMOUS"
              ? t("seller.anonymous_label", locale)
              : card.seller.displayName ?? t("seller.anonymous_label", locale)}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          {card.priceFrom ? (
            <p className="text-sm font-semibold text-gold">
              {t("price.from", locale)} {card.priceFrom} {card.currency || ""}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">{t("price.on_request", locale)}</p>
          )}
          <span className="text-xs text-neutral-500 transition-colors group-hover:text-gold">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Hotels() {
  const locale = useLocale();
  const [hotels, setHotels] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    // Category slug is not linked to HOTEL products in the seed data.
    // Use client-side type filter (same pattern as Hot Tours / Tours).
    void publicApi
      .listProducts({ sort: "newest", pageSize: 50 })
      .then((r) => {
        if (alive) {
          const hotelsOnly = r.items.filter((item) => item.type === "HOTEL").slice(0, 6);
          setHotels(hotelsOnly);
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
  if (!loading && (hotels.length === 0 || error)) return null;

  return (
    <section className="bg-dark-card/30 py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.hotels_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.hotels_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?category=accommodation"
            className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
          >
            {t("marketplace.all_hotels", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <HotelCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Hotel cards */}
        {!loading && hotels.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hotels.map((hotel) => (
              <HotelCard key={hotel.id} card={hotel} />
            ))}
          </div>
        )}

        {/* Mobile all hotels link */}
        {!loading && hotels.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/search?category=accommodation"
              className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
            >
              {t("marketplace.all_hotels", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
